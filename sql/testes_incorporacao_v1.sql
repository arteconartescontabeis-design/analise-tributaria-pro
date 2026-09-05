-- ═══════════════════════════════════════════════════════════════════════════════════════════
--  Simulação de Incorporação — testes do setup v1 (LAB: PostgreSQL 16 local, sem Supabase)
--  Como rodar no lab:  psql -f sql/lab_prelude.sql ; psql -f sql/setup_incorporacao_v1.sql ; psql -f sql/testes_incorporacao_v1.sql
--  Em PRODUÇÃO não é para rodar (escreve e apaga linhas de teste). Cada bloco imprime OK/FALHA.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP off
create temp table lab_res (n int, nome text, ok boolean);
grant all on lab_res to authenticated;
-- claims falsas: dois escritórios, dois e-mails
create or replace function lab_jwt(p_escr text, p_email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('escr', p_escr, 'email', p_email, 'role', 'authenticated')::text, false);
$$;
set role postgres;
delete from public.atp_incorporacoes where titulo like 'LAB %';

-- I01 · A grava
set role authenticated; select lab_jwt('11111111-1111-1111-1111-111111111111', 'a@lab');
insert into public.atp_incorporacoes (ano, cnpj_incorporadora, cnpjs_incorporadas, titulo, snapshot)
  values (2026, '11111111000191', '["22222222000192"]', 'LAB A1', '{"v":1}');
insert into lab_res select 1, 'A grava a sua simulação', (select count(*) = 1 from public.atp_incorporacoes where titulo = 'LAB A1');
-- I02 · nasce com escritório e autor carimbados
insert into lab_res select 2, 'escritório vem do atp_meu_escritorio() e criado_por do JWT',
  (select escritorio_id = '11111111-1111-1111-1111-111111111111' and criado_por = 'a@lab' from public.atp_incorporacoes where titulo = 'LAB A1');
-- I03 · B grava a sua
select lab_jwt('22222222-2222-2222-2222-222222222222', 'b@lab');
insert into public.atp_incorporacoes (ano, cnpj_incorporadora, cnpjs_incorporadas, titulo) values (2026, '33333333000193', '["44444444000194"]', 'LAB B1');
insert into lab_res select 3, 'B grava a sua', (select count(*) = 1 from public.atp_incorporacoes where titulo = 'LAB B1');
-- I04 · B não vê a de A
insert into lab_res select 4, 'B NÃO lê a simulação de A', (select count(*) = 0 from public.atp_incorporacoes where titulo = 'LAB A1');
-- I05 · B não altera a de A (0 linhas)
update public.atp_incorporacoes set titulo = 'LAB A1 invadida' where titulo = 'LAB A1';
set role postgres; insert into lab_res select 5, 'B NÃO altera a de A', (select count(*) = 1 from public.atp_incorporacoes where titulo = 'LAB A1'); set role authenticated;
-- I06 · B não exclui a de A pela função
select lab_jwt('22222222-2222-2222-2222-222222222222', 'b@lab');
do $$ begin
  begin perform public.atp_excluir_incorporacao((select id from public.atp_incorporacoes where titulo = 'LAB A1' limit 1));
    insert into lab_res values (6, 'B NÃO exclui a de A pela função', false);
  exception when others then insert into lab_res values (6, 'B NÃO exclui a de A pela função', true); end;
end $$;
-- I07 · A altera a sua e a trilha carimba
select lab_jwt('11111111-1111-1111-1111-111111111111', 'a@lab');
update public.atp_incorporacoes set titulo = 'LAB A1 editada', snapshot = '{"v":2}' where titulo = 'LAB A1';
insert into lab_res select 7, 'A altera a sua; atualizado_em/por carimbados',
  (select atualizado_em is not null and atualizado_por = 'a@lab' and snapshot->>'v' = '2' from public.atp_incorporacoes where titulo = 'LAB A1 editada');
-- I08 · chaves imutáveis (ano, incorporadora, escritório) não mudam por UPDATE
update public.atp_incorporacoes set ano = 2030, cnpj_incorporadora = '99999999000199', escritorio_id = '22222222-2222-2222-2222-222222222222' where titulo = 'LAB A1 editada';
set role postgres; insert into lab_res select 8, 'ano/incorporadora/escritório são imutáveis',
  (select ano = 2026 and cnpj_incorporadora = '11111111000191' and escritorio_id = '11111111-1111-1111-1111-111111111111' from public.atp_incorporacoes where titulo = 'LAB A1 editada'); set role authenticated;
-- I09 · A exclui a sua: some da lista, mas segue no banco (trilha)
select lab_jwt('11111111-1111-1111-1111-111111111111', 'a@lab');
select public.atp_excluir_incorporacao((select id from public.atp_incorporacoes where titulo = 'LAB A1 editada'));
insert into lab_res select 9, 'A exclui a sua: some da lista', (select count(*) = 0 from public.atp_incorporacoes where titulo = 'LAB A1 editada');
set role postgres; insert into lab_res select 10, 'e a linha segue no banco, com excluido_por', (select excluido_em is not null and excluido_por = 'a@lab' from public.atp_incorporacoes where titulo = 'LAB A1 editada'); set role authenticated;
-- I11 · excluída não volta por UPDATE do cliente
select lab_jwt('11111111-1111-1111-1111-111111111111', 'a@lab');
update public.atp_incorporacoes set excluido_em = null where titulo = 'LAB A1 editada';
set role postgres; insert into lab_res select 11, 'cliente NÃO revive excluída por UPDATE', (select excluido_em is not null from public.atp_incorporacoes where titulo = 'LAB A1 editada'); set role authenticated;
-- I12 · DELETE físico negado ao cliente
select lab_jwt('22222222-2222-2222-2222-222222222222', 'b@lab');
do $$ begin
  begin delete from public.atp_incorporacoes where titulo = 'LAB B1';
    insert into lab_res values (12, 'DELETE físico negado ao cliente', not exists (select 1 from public.atp_incorporacoes where titulo = 'LAB B1') = false);
  exception when others then insert into lab_res values (12, 'DELETE físico negado ao cliente', true); end;
end $$;
-- I13 · inserir já "excluída" nasce viva
insert into public.atp_incorporacoes (ano, cnpj_incorporadora, cnpjs_incorporadas, titulo, excluido_em) values (2026, '33333333000193', '["44444444000194"]', 'LAB B2', now());
insert into lab_res select 13, 'INSERT com excluido_em nasce viva', (select count(*) = 1 from public.atp_incorporacoes where titulo = 'LAB B2' and excluido_em is null);
-- I14 · sem incorporada não grava
do $$ begin
  begin insert into public.atp_incorporacoes (ano, cnpj_incorporadora, cnpjs_incorporadas, titulo) values (2026, '33333333000193', '[]', 'LAB B3');
    insert into lab_res values (14, 'sem incorporada não grava', false);
  exception when others then insert into lab_res values (14, 'sem incorporada não grava', true); end;
end $$;
-- I15 · 4 políticas, RLS forçada, gatilho
set role postgres;
insert into lab_res select 15, '4 políticas + RLS forçada + gatilho + função',
  (select count(*) = 4 from pg_policies where tablename = 'atp_incorporacoes')
  and (select relforcerowsecurity from pg_class where oid = 'public.atp_incorporacoes'::regclass)
  and (select count(*) = 1 from pg_trigger where tgrelid = 'public.atp_incorporacoes'::regclass and not tgisinternal)
  and (select count(*) = 1 from pg_proc where proname = 'atp_excluir_incorporacao');
delete from public.atp_incorporacoes where titulo like 'LAB %';
select n, case when ok then 'OK   ' else 'FALHA' end as resultado, nome from lab_res order by n;
select count(*) filter (where ok) || '/' || count(*) as aprovados from lab_res;
