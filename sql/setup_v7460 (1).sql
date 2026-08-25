-- ============================================================================
-- setup_v7460.sql  —  Análise Tributária Pro / Análise Imobiliária (Artecon)
--
-- DUAS CORREÇÕES, ambas reproduzidas em PostgreSQL 16.15 local antes de escrever:
--
--   (1) TRAVA DA OPÇÃO DO ART. 375 (RAJ) — atp_imob_trava_opcao_raj()
--       A função guardava QUAL opção foi exercida, mas não QUANDO nem POR QUEM.
--       Regravar a MESMA opção com outro autor e outra data passava em silêncio
--       (medido: raj_escolhido_por 7 -> 99 e raj_escolhido_em 25/08/2026 ->
--       10/03/2027, sem erro). Como o prazo do art. 375 é 31/12/2026, a data do
--       exercício é justamente o que prova a tempestividade numa fiscalização.
--       Agora autor e data são CONGELADOS na primeira gravação.
--       O texto da justificativa SEGUE editável — corrigir a redação de um laudo
--       é retificação legítima; reescrever autoria e data, não.
--
--   (2) POLÍTICAS DE atp_imob_imoveis E atp_imob_regras
--       Estavam em política única FOR ALL, sem "excluido_em IS NULL": o banco
--       ENTREGAVA os registros excluídos, e esconder dependia do front pedir o
--       filtro — que ele pedia em um único lugar. Em atp_imob_regras isso
--       significa regra revogada chegando ao motor.
--       Agora: 4 políticas por comando, com o filtro SÓ no SELECT.
--
-- ⚠️ PRÉ-REQUISITO OBRIGATÓRIO — LEIA ANTES DE RODAR:
--   O PASSO 2 SÓ pode ser aplicado JUNTO com persistenciaImob.js v1.1.0.
--   Motivo, provado em laboratório: o módulo gravava imóvel por
--   "POST ...?on_conflict=id" (upsert). Com "excluido_em IS NULL" na política de
--   SELECT, o Postgres avalia essa política contra a linha em conflito dentro do
--   ON CONFLICT DO UPDATE — imóvel excluído passaria a devolver
--   42501 "(USING expression)" e aquele id ficaria ingravável PARA SEMPRE.
--   É o mesmo defeito dos setups v7440/v7450, e aqui NÃO existe saída: a chave em
--   conflito é a PRIMARY KEY, referenciada por FK de atp_imob_calculos e
--   atp_imob_creditos — nem lixeira por DELETE nem renome "#exc" são possíveis.
--   A v1.1.0 do módulo elimina o caminho de conflito: com id -> PATCH;
--   sem id -> INSERT puro. Rodar este SQL com o módulo antigo REINTRODUZ o bug.
--
--   O (select public.atp_meu_escritorio()) com parênteses NÃO é estilo: sem a
--   subconsulta escalar a função STABLE é avaliada uma vez POR LINHA
--   (medido: 384,9 ms contra 24,6 ms em 50 mil linhas). NUNCA remover.
--
-- IDEMPOTENTE. NÃO TOCA: motor, lacre 5a5562df, index.html, Edge Functions,
-- as 4 tabelas dos setups v7440/v7450, nem as demais 16 tabelas em FOR ALL
-- (sem soft delete, não têm a mina — ficam para uma limpeza posterior).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASSO 0 — Registro do estado ANTES (guarde a saída)
-- ----------------------------------------------------------------------------
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('atp_imob_imoveis', 'atp_imob_regras')
order by tablename, policyname;

select pg_get_functiondef(oid) as trava_atual
from pg_proc where proname = 'atp_imob_trava_opcao_raj';

-- Imóveis com a opção já exercida: são os que a trava nova passa a proteger.
select count(*) filter (where raj_opcao_escolhida is not null) as opcoes_exercidas,
       count(*) filter (where raj_opcao_escolhida is not null
                          and raj_escolhido_em is null)        as sem_data_registrada,
       count(*)                                                as total_imoveis
from public.atp_imob_imoveis;


-- ----------------------------------------------------------------------------
-- PASSO 1 — Trava do art. 375: congelar também autor e data
--
--   O gatilho tg_atp_imob_trava_raj NÃO é recriado — só o corpo da função muda,
--   e o gatilho já aponta para ela. Nada a fazer do lado do gatilho.
--
--   Note "is distinct from" em vez de "<>": compara nulo corretamente (apagar a
--   opção é tão vedado quanto trocá-la) e, sendo timestamptz, o mesmo instante
--   escrito em outro fuso NÃO gera falso positivo (testado).
-- ----------------------------------------------------------------------------
create or replace function public.atp_imob_trava_opcao_raj()
returns trigger
language plpgsql
as $function$
begin
  -- QUAL opção — regra original, preservada
  if tg_op = 'UPDATE' and old.raj_opcao_escolhida is not null
     and new.raj_opcao_escolhida is distinct from old.raj_opcao_escolhida then
    raise exception 'A opção do art. 258 do imóvel % já foi exercida (%) em % e não pode ser trocada. Registre uma retificação.',
      coalesce(old.codigo_interno, old.id::text), old.raj_opcao_escolhida,
      coalesce(old.raj_escolhido_em::text, 'data não registrada');
  end if;

  -- v7.46.0 — QUANDO: a data prova a tempestividade do prazo de 31/12/2026
  if tg_op = 'UPDATE' and old.raj_escolhido_em is not null
     and new.raj_escolhido_em is distinct from old.raj_escolhido_em then
    raise exception 'A data do exercício da opção do imóvel % está registrada em % e não pode ser alterada. Registre uma retificação.',
      coalesce(old.codigo_interno, old.id::text), old.raj_escolhido_em::text;
  end if;

  -- v7.46.0 — POR QUEM: a autoria do ato é parte da trilha de auditoria
  if tg_op = 'UPDATE' and old.raj_escolhido_por is not null
     and new.raj_escolhido_por is distinct from old.raj_escolhido_por then
    raise exception 'A autoria do exercício da opção do imóvel % está registrada e não pode ser alterada. Registre uma retificação.',
      coalesce(old.codigo_interno, old.id::text);
  end if;

  if tg_op = 'UPDATE' then new.atualizado_em := now(); end if;

  if new.raj_opcao_escolhida is not null and coalesce(trim(new.raj_justificativa),'') = '' then
    raise exception 'A escolha da opção do art. 258 exige justificativa gravada.';
  end if;

  return new;
end $function$;


-- ----------------------------------------------------------------------------
-- PASSO 2 — Políticas por comando (⚠️ SÓ com persistenciaImob.js v1.1.0 no ar)
--
--   Transação única: entre o DROP e o CREATE a tabela ficaria sem política
--   nenhuma, o que nega tudo. Em BEGIN/COMMIT ninguém vê essa janela.
-- ----------------------------------------------------------------------------
begin;

-- ===== atp_imob_imoveis =====
drop policy if exists atp_imob_imoveis_esc on public.atp_imob_imoveis;
drop policy if exists atp_imob_imoveis_sel on public.atp_imob_imoveis;
drop policy if exists atp_imob_imoveis_ins on public.atp_imob_imoveis;
drop policy if exists atp_imob_imoveis_upd on public.atp_imob_imoveis;
drop policy if exists atp_imob_imoveis_del on public.atp_imob_imoveis;

create policy atp_imob_imoveis_sel on public.atp_imob_imoveis
  for select
  using (escritorio_id = (select public.atp_meu_escritorio())
         and excluido_em is null);

create policy atp_imob_imoveis_ins on public.atp_imob_imoveis
  for insert
  with check (escritorio_id = (select public.atp_meu_escritorio()));

create policy atp_imob_imoveis_upd on public.atp_imob_imoveis
  for update
  using      (escritorio_id = (select public.atp_meu_escritorio()))
  with check (escritorio_id = (select public.atp_meu_escritorio()));

create policy atp_imob_imoveis_del on public.atp_imob_imoveis
  for delete
  using (escritorio_id = (select public.atp_meu_escritorio()));

-- ===== atp_imob_regras =====
-- Sem upsert do front (o módulo só LÊ esta tabela) e com os gatilhos
-- tg_atp_imob_exige_hash e tg_atp_imob_homolog no lugar: sem mina.
drop policy if exists atp_imob_regras_esc on public.atp_imob_regras;
drop policy if exists atp_imob_regras_sel on public.atp_imob_regras;
drop policy if exists atp_imob_regras_ins on public.atp_imob_regras;
drop policy if exists atp_imob_regras_upd on public.atp_imob_regras;
drop policy if exists atp_imob_regras_del on public.atp_imob_regras;

create policy atp_imob_regras_sel on public.atp_imob_regras
  for select
  using (escritorio_id = (select public.atp_meu_escritorio())
         and excluido_em is null);

create policy atp_imob_regras_ins on public.atp_imob_regras
  for insert
  with check (escritorio_id = (select public.atp_meu_escritorio()));

create policy atp_imob_regras_upd on public.atp_imob_regras
  for update
  using      (escritorio_id = (select public.atp_meu_escritorio()))
  with check (escritorio_id = (select public.atp_meu_escritorio()));

create policy atp_imob_regras_del on public.atp_imob_regras
  for delete
  using (escritorio_id = (select public.atp_meu_escritorio()));

commit;


-- ----------------------------------------------------------------------------
-- PASSO 3 — Verificação
-- ----------------------------------------------------------------------------
-- (a) 4 políticas por tabela, filtro de exclusão SÓ no SELECT:
select tablename, policyname, cmd,
       (qual like '%excluido_em%') as filtra_excluido
from pg_policies
where schemaname = 'public'
  and tablename in ('atp_imob_imoveis', 'atp_imob_regras')
order by tablename, cmd;
--   ESPERADO: 8 linhas; filtra_excluido = true APENAS nas duas de SELECT.

-- (b) a trava nova está no corpo da função:
select proname,
       (pg_get_functiondef(oid) like '%raj_escolhido_em is distinct from%')  as congela_data,
       (pg_get_functiondef(oid) like '%raj_escolhido_por is distinct from%') as congela_autor
from pg_proc where proname = 'atp_imob_trava_opcao_raj';
--   ESPERADO: 1 linha, as duas colunas true.

-- (c) o gatilho segue apontando para a função e habilitado:
select tgname, tgenabled from pg_trigger
where tgrelid = 'public.atp_imob_imoveis'::regclass and tgname = 'tg_atp_imob_trava_raj';
--   ESPERADO: tgenabled = 'O'.

-- (d) a sessão real continua enxergando a carteira (ajuste o e-mail):
begin;
select set_config('request.jwt.claims',
       '{"email":"cleiver@artecon.cnt.br","role":"authenticated"}', true);
set local role authenticated;
select count(*) as imoveis_visiveis from public.atp_imob_imoveis;
select count(*) as regras_visiveis  from public.atp_imob_regras;
rollback;
--   ESPERADO: contagens iguais às de antes, MENOS os registros excluídos.


-- ----------------------------------------------------------------------------
-- PASSO 4 — Teste de fumaça da trava, em transação descartável
--   Troque <ID> por um imóvel COM a opção já exercida (ver PASSO 0).
--   Os três UPDATEs abaixo devem FALHAR; o quarto deve passar.
-- ----------------------------------------------------------------------------
-- begin;
--   update public.atp_imob_imoveis set raj_opcao_escolhida = 'referencia' where id = <ID>;   -- recusa
--   update public.atp_imob_imoveis set raj_escolhido_em  = now()          where id = <ID>;   -- recusa
--   update public.atp_imob_imoveis set raj_escolhido_por = 999            where id = <ID>;   -- recusa
--   update public.atp_imob_imoveis set raj_justificativa = 'texto retificado' where id = <ID>; -- passa
-- rollback;


-- ----------------------------------------------------------------------------
-- REVERSÃO
--   ⚠️ Reverter o PASSO 2 SEM reverter o módulo é seguro (volta ao estado de
--   hoje: excluídos visíveis). Reverter o MÓDULO sem reverter o PASSO 2 NÃO é:
--   traz de volta o upsert por id com o filtro na política = 42501.
-- ----------------------------------------------------------------------------
-- begin;
--   drop policy if exists atp_imob_imoveis_sel on public.atp_imob_imoveis;
--   drop policy if exists atp_imob_imoveis_ins on public.atp_imob_imoveis;
--   drop policy if exists atp_imob_imoveis_upd on public.atp_imob_imoveis;
--   drop policy if exists atp_imob_imoveis_del on public.atp_imob_imoveis;
--   create policy atp_imob_imoveis_esc on public.atp_imob_imoveis for all
--     using (escritorio_id = atp_meu_escritorio())
--     with check (escritorio_id = atp_meu_escritorio());
--
--   drop policy if exists atp_imob_regras_sel on public.atp_imob_regras;
--   drop policy if exists atp_imob_regras_ins on public.atp_imob_regras;
--   drop policy if exists atp_imob_regras_upd on public.atp_imob_regras;
--   drop policy if exists atp_imob_regras_del on public.atp_imob_regras;
--   create policy atp_imob_regras_esc on public.atp_imob_regras for all
--     using (escritorio_id = atp_meu_escritorio())
--     with check (escritorio_id = atp_meu_escritorio());
-- commit;
--
-- Para reverter SÓ a trava (mantendo as políticas), recrie a função com o corpo
-- guardado no PASSO 0 — o gatilho não precisa ser tocado.
