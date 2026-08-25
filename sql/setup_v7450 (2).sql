-- ============================================================================
-- setup_v7450.sql  —  Análise Tributária Pro (Artecon)
--
-- ESTENDE a correção do setup_v7440.sql (atp_analises) para as três tabelas
-- restantes com soft delete. Validado em PostgreSQL 16 local com o schema
-- real (constraints do pg_constraint de produção, 24/08/2026), bateria de
-- 6 cenários incluindo ataques entre escritórios.
--
-- DIAGNÓSTICO POR TABELA (pg_policies + pg_constraint de produção):
--
--   atp_empresas  política única FOR ALL com "excluido_em IS NULL" no USING
--                 + UNIQUE (cnpj). Recadastrar empresa excluída (upsert do
--                 garantirEmpresa) reproduz o MESMO 42501 da atp_analises.
--                 PORÉM: atp_imob_imoveis/calculos/creditos apontam FK para
--                 atp_empresas(id) → mover o resto para lixeira (DELETE) é
--                 IMPOSSÍVEL (viola FK; provado). Solução: RENOMEAR o cnpj
--                 do resto ("...#exc<id>"), liberando a chave única sem
--                 apagar a linha. Bônus: as análises ligam por CNPJ texto,
--                 então o histórico REATA sozinho ao cadastro novo.
--
--   atp_fornec    política única FOR ALL (mesmo defeito de forma), mas SEM
--                 chave única de negócio (só PK id) → a mina do upsert NÃO
--                 existe aqui. Recebe apenas a separação de políticas.
--
--   atp_usuarios  políticas JÁ separadas por comando e corretas (admin +
--                 auto-visão; excluido_em só no SELECT) → NÃO são tocadas.
--                 Mina restante: usuário excluído SEGURA o e-mail (readmitir
--                 dá 23505 chave duplicada; provado). Mesma solução do
--                 rename, restrita a admin do escritório. FKs de
--                 atp_imob_* e atp_analise_snapshots (usuarios.id) intactas.
--
-- RECUPERAÇÃO de um resto renomeado (console): o valor original é
--   split_part(cnpj, '#exc', 1)   /   split_part(email, '#exc', 1)
--
-- IDEMPOTENTE: pode rodar mais de uma vez. NÃO TOCA: motor, lacre, index,
-- Edge Functions, políticas de atp_usuarios, RPCs de exclusão da v7.41.1.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASSO 0 — Registro do estado ANTES (guarde a saída)
-- ----------------------------------------------------------------------------
select tablename, policyname, cmd, permissive, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('atp_empresas', 'atp_fornec', 'atp_usuarios')
order by tablename, policyname;


-- ----------------------------------------------------------------------------
-- PASSO 1 — Correção (bloco único, atômico). Rode inteiro de uma vez.
-- ----------------------------------------------------------------------------
begin;

-- ===== atp_empresas: políticas por comando =====
drop policy if exists atp_empresas_all on public.atp_empresas;
drop policy if exists atp_empresas_sel on public.atp_empresas;
drop policy if exists atp_empresas_ins on public.atp_empresas;
drop policy if exists atp_empresas_upd on public.atp_empresas;
drop policy if exists atp_empresas_del on public.atp_empresas;

create policy atp_empresas_sel on public.atp_empresas
  for select
  using (escritorio_id = (select public.atp_meu_escritorio())
         and excluido_em is null);

create policy atp_empresas_ins on public.atp_empresas
  for insert
  with check (escritorio_id = (select public.atp_meu_escritorio()));

create policy atp_empresas_upd on public.atp_empresas
  for update
  using      (escritorio_id = (select public.atp_meu_escritorio()))
  with check (escritorio_id = (select public.atp_meu_escritorio()));

create policy atp_empresas_del on public.atp_empresas
  for delete
  using (escritorio_id = (select public.atp_meu_escritorio()));

-- ===== atp_empresas: pré-insert renomeia o resto excluído do MESMO CNPJ =====
-- SECURITY DEFINER dispara ANTES da RLS do INSERT; a guarda de escritório é
-- obrigatória (sem ela, upsert malicioso de outro escritório renomearia
-- restos alheios). Testado: intruso rejeitado, resto intocado.
create or replace function public.atp_empresas_pre_insert()
returns trigger language plpgsql security definer as $fn$
begin
  update public.atp_empresas a
     set cnpj = a.cnpj || '#exc' || a.id
   where a.cnpj = new.cnpj
     and a.excluido_em is not null
     and a.escritorio_id = public.atp_meu_escritorio();
  return new;
end $fn$;

drop trigger if exists atp_a_empresas_pre_insert on public.atp_empresas;
create trigger atp_a_empresas_pre_insert
  before insert on public.atp_empresas
  for each row execute function public.atp_empresas_pre_insert();

-- ===== atp_fornec: políticas por comando (higiene; sem mina de upsert) =====
drop policy if exists atp_fornec_all on public.atp_fornec;
drop policy if exists atp_fornec_sel on public.atp_fornec;
drop policy if exists atp_fornec_ins on public.atp_fornec;
drop policy if exists atp_fornec_upd on public.atp_fornec;
drop policy if exists atp_fornec_del on public.atp_fornec;

create policy atp_fornec_sel on public.atp_fornec
  for select
  using (cnpj in (select cnpj from public.atp_empresas
                  where escritorio_id = (select public.atp_meu_escritorio()))
         and excluido_em is null);

create policy atp_fornec_ins on public.atp_fornec
  for insert
  with check (cnpj in (select cnpj from public.atp_empresas
                       where escritorio_id = (select public.atp_meu_escritorio())));

create policy atp_fornec_upd on public.atp_fornec
  for update
  using      (cnpj in (select cnpj from public.atp_empresas
                       where escritorio_id = (select public.atp_meu_escritorio())))
  with check (cnpj in (select cnpj from public.atp_empresas
                       where escritorio_id = (select public.atp_meu_escritorio())));

create policy atp_fornec_del on public.atp_fornec
  for delete
  using (cnpj in (select cnpj from public.atp_empresas
                  where escritorio_id = (select public.atp_meu_escritorio())));

-- ===== atp_usuarios: SÓ o pré-insert (políticas ficam como estão) =====
-- libera o e-mail de um usuário excluído na readmissão; restrito a admin
-- do escritório do resto. Testado: operador rejeitado, resto intocado.
create or replace function public.atp_usuarios_pre_insert()
returns trigger language plpgsql security definer as $fn$
begin
  if public.atp_sou_admin() then
    update public.atp_usuarios u
       set email = u.email || '#exc' || u.id
     where u.email = new.email
       and u.excluido_em is not null
       and u.escritorio_id = public.atp_meu_escritorio();
  end if;
  return new;
end $fn$;

drop trigger if exists atp_a_usuarios_pre_insert on public.atp_usuarios;
create trigger atp_a_usuarios_pre_insert
  before insert on public.atp_usuarios
  for each row execute function public.atp_usuarios_pre_insert();

commit;


-- ----------------------------------------------------------------------------
-- PASSO 2 — Verificação
-- ----------------------------------------------------------------------------
-- 4 políticas por tabela em empresas/fornec; as 4 originais em usuarios:
select tablename, policyname, cmd from pg_policies
where schemaname = 'public'
  and tablename in ('atp_empresas', 'atp_fornec', 'atp_usuarios')
order by tablename, policyname;

-- gatilhos novos presentes:
select tgrelid::regclass as tabela, tgname
from pg_trigger
where not tgisinternal
  and tgname in ('atp_a_empresas_pre_insert', 'atp_a_usuarios_pre_insert');

-- sessão continua enxergando o mundo (ajuste o e-mail):
begin;
select set_config('request.jwt.claims',
       '{"email":"cleiver@artecon.cnt.br","role":"authenticated"}', true);
set local role authenticated;
select count(*) as empresas_visiveis from public.atp_empresas;
select count(*) as usuarios_visiveis from public.atp_usuarios;
rollback;


-- ----------------------------------------------------------------------------
-- REVERSÃO — restaura políticas originais e remove os gatilhos
-- ----------------------------------------------------------------------------
-- begin;
--   drop trigger if exists atp_a_empresas_pre_insert on public.atp_empresas;
--   drop function if exists public.atp_empresas_pre_insert();
--   drop trigger if exists atp_a_usuarios_pre_insert on public.atp_usuarios;
--   drop function if exists public.atp_usuarios_pre_insert();
--
--   drop policy if exists atp_empresas_sel on public.atp_empresas;
--   drop policy if exists atp_empresas_ins on public.atp_empresas;
--   drop policy if exists atp_empresas_upd on public.atp_empresas;
--   drop policy if exists atp_empresas_del on public.atp_empresas;
--   create policy atp_empresas_all on public.atp_empresas for all
--     using (escritorio_id = atp_meu_escritorio() and excluido_em is null)
--     with check (escritorio_id = atp_meu_escritorio());
--
--   drop policy if exists atp_fornec_sel on public.atp_fornec;
--   drop policy if exists atp_fornec_ins on public.atp_fornec;
--   drop policy if exists atp_fornec_upd on public.atp_fornec;
--   drop policy if exists atp_fornec_del on public.atp_fornec;
--   create policy atp_fornec_all on public.atp_fornec for all
--     using (cnpj in (select cnpj from atp_empresas
--                     where escritorio_id = atp_meu_escritorio())
--            and excluido_em is null)
--     with check (cnpj in (select cnpj from atp_empresas
--                          where escritorio_id = atp_meu_escritorio()));
--   -- restos já renomeados NÃO são revertidos automaticamente; se preciso:
--   -- update atp_empresas set cnpj  = split_part(cnpj,  '#exc', 1) where cnpj  like '%#exc%';
--   -- update atp_usuarios set email = split_part(email, '#exc', 1) where email like '%#exc%';
-- commit;
