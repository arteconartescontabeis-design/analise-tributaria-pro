-- ============================================================================
-- setup_v7440.sql  —  Análise Tributária Pro (Artecon)
--
-- CORRIGE: 403 / 42501 "new row violates row-level security policy
--          (USING expression) for table atp_analises" ao GRAVAR uma
--          empresa/ano cuja análise havia sido excluída (soft delete).
--
-- CAUSA-RAIZ (confirmada em produção, 24/08/2026):
--   A política atp_analises_all é FOR ALL e carrega "excluido_em IS NULL"
--   dentro do USING. Num FOR ALL o USING também vale para o UPDATE, e o
--   PostgREST grava por upsert (INSERT ... ON CONFLICT DO UPDATE).
--   No caminho do ON CONFLICT o Postgres não consegue filtrar a linha em
--   conflito por WHERE — ela veio pelo índice único — então avalia o USING
--   da política de UPDATE contra a linha JÁ EXISTENTE, como se fosse um
--   check (WCO_RLS_CONFLICT_CHECK). Linha excluída reprova, e sai o 42501
--   com o sufixo "(USING expression)", que é exclusivo desse caminho.
--
--   Efeito prático: análise excluída torna a empresa/ano INGRAVÁVEL para
--   sempre. É a mesma incompatibilidade que a v7.41.1 corrigiu no caminho
--   da EXCLUSÃO (via RPC SECURITY DEFINER); o caminho da GRAVAÇÃO ficou.
--
-- ESCOPO: apenas atp_analises. As políticas de atp_empresas, atp_fornec e
--         atp_usuarios têm a mesma forma e o mesmo defeito — ver PASSO 5.
--
-- NÃO TOCA: motor de cálculo, lacre, index.html, Edge Functions.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASSO 0 — Registro do estado ANTES (guarde a saída antes de prosseguir)
-- ----------------------------------------------------------------------------
select policyname, cmd, permissive, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'atp_analises';

select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'atp_analises';

select tgname, tgenabled, pg_get_triggerdef(oid) as definicao
from pg_trigger
where tgrelid = 'public.atp_analises'::regclass and not tgisinternal
order by tgname;


-- ----------------------------------------------------------------------------
-- PASSO 1 — Linhas hoje presas (existem, mas a RLS não deixa gravar por cima)
--           Rode ANTES da correção para saber o tamanho do estrago.
-- ----------------------------------------------------------------------------
select id, cnpj, ano, status, excluido_em, excluido_por,
       octet_length(dados::text) as tamanho_dados
from public.atp_analises
where excluido_em is not null
order by ano, cnpj;


-- ----------------------------------------------------------------------------
-- PASSO 2 — Separar a política por comando
--
--   "excluido_em IS NULL" passa a existir SÓ no SELECT. O UPDATE deixa de
--   reprovar a linha excluída, que é o que destrava o upsert.
--
--   O (select public.atp_meu_escritorio()) com parênteses NÃO é estilo: sem a
--   subconsulta escalar a função STABLE é avaliada uma vez POR LINHA. Medido
--   em PostgreSQL 16 com 50 mil linhas: 384,9 ms sem, 24,6 ms com.
--   NUNCA remover os parênteses.
--
--   Transação única: entre o DROP e o CREATE a tabela ficaria sem política
--   nenhuma, o que nega tudo. Em BEGIN/COMMIT ninguém vê essa janela.
-- ----------------------------------------------------------------------------
--   IDEMPOTENTE: pode ser rodado quantas vezes for preciso — derruba a
--   política antiga E as quatro novas (se já existirem) antes de recriar.

begin;

drop policy if exists atp_analises_all on public.atp_analises;
drop policy if exists atp_analises_sel on public.atp_analises;
drop policy if exists atp_analises_ins on public.atp_analises;
drop policy if exists atp_analises_upd on public.atp_analises;
drop policy if exists atp_analises_del on public.atp_analises;

create policy atp_analises_sel on public.atp_analises
  for select
  using (
    cnpj in (select cnpj from public.atp_empresas
             where escritorio_id = (select public.atp_meu_escritorio()))
    and excluido_em is null
  );

create policy atp_analises_ins on public.atp_analises
  for insert
  with check (
    cnpj in (select cnpj from public.atp_empresas
             where escritorio_id = (select public.atp_meu_escritorio()))
  );

create policy atp_analises_upd on public.atp_analises
  for update
  using (
    cnpj in (select cnpj from public.atp_empresas
             where escritorio_id = (select public.atp_meu_escritorio()))
  )
  with check (
    cnpj in (select cnpj from public.atp_empresas
             where escritorio_id = (select public.atp_meu_escritorio()))
  );

create policy atp_analises_del on public.atp_analises
  for delete
  using (
    cnpj in (select cnpj from public.atp_empresas
             where escritorio_id = (select public.atp_meu_escritorio()))
  );

commit;


-- ----------------------------------------------------------------------------
-- PASSO 3 — Gatilho de reativação (OBRIGATÓRIO junto com o PASSO 2)
--
--   Sem ele o PASSO 2 troca um erro barulhento por uma falha silenciosa:
--   o upsert passaria, mas "excluido_em" continuaria preenchido (não vai no
--   payload), a gravação devolveria 200 e a análise seguiria invisível.
--
--   Semântica adotada: gravar conteúdo por cima de uma linha excluída = trazê-la
--   de volta. É o que o usuário espera ao salvar de novo a mesma empresa/ano.
--
--   O nome começa com "atp_z" de propósito. Gatilhos de mesmo momento disparam
--   em ordem ALFABÉTICA, e este precisa rodar DEPOIS de atp_trilha_auditoria,
--   que também mexe em excluido_por. Renomear quebra a garantia.
--
--   Não interfere em atp_excluir_dados(): lá OLD.excluido_em é null, e a
--   condição exige que já estivesse preenchido.
-- ----------------------------------------------------------------------------
create or replace function public.atp_analises_reviver()
returns trigger
language plpgsql
as $$
begin
  if old.excluido_em is not null
     and new.excluido_em is not distinct from old.excluido_em then
    new.excluido_em  := null;
    new.excluido_por := null;
  end if;
  return new;
end;
$$;

-- limpa também o nome antigo (sem o "z"), caso o bloco inline da conversa
-- tenha sido executado antes deste arquivo — dois gatilhos seriam inócuos,
-- mas não devem coexistir
drop trigger if exists atp_analises_reviver on public.atp_analises;
drop trigger if exists atp_z_analises_reviver on public.atp_analises;

create trigger atp_z_analises_reviver
  before update on public.atp_analises
  for each row execute function public.atp_analises_reviver();


-- ----------------------------------------------------------------------------
-- PASSO 3B — Lixeira + gatilho pré-insert  (DESCOBERTA de 24/08, validada em
--            PostgreSQL 16 local com reprodução fiel do erro de produção)
--
--   O PASSO 2 é necessário mas NÃO basta: no ON CONFLICT DO UPDATE o Postgres
--   aplica TAMBÉM a política de SELECT contra a linha em conflito. Como o
--   SELECT precisa manter "excluido_em IS NULL" (é o que esconde excluídos),
--   o upsert contra uma linha soft-deletada falha com o MESMO 42501,
--   qualquer que seja o arranjo das políticas — provado em laboratório.
--
--   Correção: remover o obstáculo ANTES do conflito. Um BEFORE INSERT move o
--   resto soft-deletado da mesma (cnpj, ano) para a lixeira; o INSERT então
--   entra limpo. Auditoria preservada (a lixeira guarda a linha inteira +
--   quem excluiu). Reativar via UPDATE dentro do próprio gatilho NÃO funciona:
--   "ON CONFLICT DO UPDATE command cannot affect row a second time".
--
--   SEGURANÇA: o gatilho é SECURITY DEFINER e dispara ANTES da checagem de
--   RLS do INSERT. A guarda de escritório dentro dele é OBRIGATÓRIA — sem
--   ela, um INSERT malicioso com ON CONFLICT DO NOTHING de outro escritório
--   apagaria restos alheios sem abortar a instrução. Testado: ataque
--   rejeitado e o registro alheio sobrevive.
-- ----------------------------------------------------------------------------
create table if not exists public.atp_analises_lixeira (
  like public.atp_analises including defaults,
  descartado_em timestamptz not null default now()
);
-- RLS ligada SEM política = ninguém lê via API; só service_role/console
alter table public.atp_analises_lixeira enable row level security;

create or replace function public.atp_analises_pre_insert()
returns trigger language plpgsql security definer as $fn$
begin
  with alvo as (
    delete from public.atp_analises a
     where a.cnpj = new.cnpj and a.ano = new.ano
       and a.excluido_em is not null
       and a.cnpj in (select cnpj from public.atp_empresas
                      where escritorio_id = public.atp_meu_escritorio())
     returning a.*
  )
  insert into public.atp_analises_lixeira
  select alvo.*, now() from alvo;
  return new;
end $fn$;

drop trigger if exists atp_a_analises_pre_insert on public.atp_analises;

create trigger atp_a_analises_pre_insert
  before insert on public.atp_analises
  for each row execute function public.atp_analises_pre_insert();

-- NOTA: o "select alvo.*, now()" casa POSICIONALMENTE com a lixeira, que é
-- "like atp_analises" + descartado_em. Se um dia atp_analises ganhar coluna
-- nova, acrescentar a MESMA coluna na lixeira (antes de descartado_em), senão
-- o gatilho quebra no próximo descarte. Validado em PostgreSQL 16 com schema
-- estendido (fechado_por, snapshot): tudo preservado na lixeira.


-- ----------------------------------------------------------------------------
-- PASSO 4 — Verificação, simulando a sessão real do usuário
--
--   O editor roda como postgres (ignora RLS). O bloco abaixo troca para o papel
--   authenticated e injeta o e-mail no claim, que é o que atp_meu_escritorio()
--   lê. Ajuste o e-mail. O rollback garante que nada persiste.
-- ----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
       '{"email":"cleiver@artecon.cnt.br","role":"authenticated"}', true);
set local role authenticated;

-- deve devolver um bigint, nunca null
select public.atp_meu_escritorio() as meu_escritorio;

-- deve listar as análises do escritório
select id, cnpj, ano, status from public.atp_analises where ano = 2026 order by id;

rollback;

-- Teste de fumaça do defeito original, em transação descartável.
-- Substitua <ID> por uma linha de teste com excluido_em preenchido.
-- Antes da correção este UPDATE dava 42501; agora deve reativar a linha.
--
-- begin;
--   update public.atp_analises set atualizado_em = now() where id = <ID>;
--   select id, excluido_em, excluido_por from public.atp_analises where id = <ID>;
-- rollback;


-- ----------------------------------------------------------------------------
-- PASSO 5 — As outras três tabelas têm o mesmo defeito
--
--   atp_empresas, atp_fornec e atp_usuarios foram criadas com a mesma forma de
--   política (FOR ALL + excluido_em IS NULL no USING). Enquanto não forem
--   separadas, excluir um registro nelas trava a gravação daquele registro.
--
--   Rode e me mande a saída: o predicado de cada uma é diferente (escritorio_id
--   direto em umas, cnpj IN (...) em outras) e não dá para reescrever no escuro.
-- ----------------------------------------------------------------------------
select tablename, policyname, cmd, permissive, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('atp_empresas', 'atp_fornec', 'atp_usuarios')
order by tablename, policyname;


-- ----------------------------------------------------------------------------
-- REVERSÃO — volta ao estado anterior ao PASSO 2 e 3
-- ----------------------------------------------------------------------------
-- begin;
--   drop trigger if exists atp_a_analises_pre_insert on public.atp_analises;
--   drop function if exists public.atp_analises_pre_insert();
--   -- a lixeira não é derrubada na reversão: pode conter dados movidos
--
--   drop trigger if exists atp_z_analises_reviver on public.atp_analises;
--   drop function if exists public.atp_analises_reviver();
--
--   drop policy if exists atp_analises_sel on public.atp_analises;
--   drop policy if exists atp_analises_ins on public.atp_analises;
--   drop policy if exists atp_analises_upd on public.atp_analises;
--   drop policy if exists atp_analises_del on public.atp_analises;
--
--   create policy atp_analises_all on public.atp_analises
--     for all
--     using (
--       cnpj in (select cnpj from public.atp_empresas
--                where escritorio_id = public.atp_meu_escritorio())
--       and excluido_em is null
--     )
--     with check (
--       cnpj in (select cnpj from public.atp_empresas
--                where escritorio_id = public.atp_meu_escritorio())
--     );
-- commit;
