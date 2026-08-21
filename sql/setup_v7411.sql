-- ═══════════════════════════════════════════════════════════════════════════
-- setup_v7411.sql — Análise Tributária Pro
-- Corrige o soft-delete introduzido na v7.38.0 (C4), que nunca chegou a funcionar.
--
-- POR QUE QUEBRAVA
-- As políticas criadas no setup_v737_v2 são FOR ALL e trazem "excluido_em IS NULL"
-- dentro do USING. Numa política FOR ALL, esse USING também é a política de SELECT,
-- e o PostgreSQL exige que a linha RESULTANTE de um UPDATE continue visível por ela.
-- Marcar excluido_em torna a linha invisível => a própria gravação é recusada com
--   42501 new row violates row-level security policy
-- Ou seja: por construção, nenhum PATCH do app conseguia excluir. Confirmado em
-- PostgreSQL 16 nas quatro tabelas (atp_analises, atp_empresas, atp_fornec, atp_usuarios).
--
-- COMO CORRIGE
-- A exclusão passa a ser feita por funções SECURITY DEFINER, que rodam com o dono
-- da tabela e não passam pela RLS — mas conferem, elas mesmas, se o CNPJ (ou o
-- usuário) pertence ao escritório de quem chamou. As políticas ficam INTOCADAS:
-- linha excluída segue invisível no app, sem precisar filtrar nada nos GETs.
--
-- Rode este arquivo inteiro no SQL Editor do Supabase. É idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Exclusão de análises (e, opcionalmente, das consultas de fornecedores)
create or replace function atp_excluir_dados(
  p_cnpj text, p_ano int default null, p_fornec boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n_an int := 0; n_fo int := 0;
begin
  if atp_meu_escritorio() is null then
    raise exception 'Seu usuário não está vinculado a um escritório (atp_usuarios.escritorio_id).';
  end if;
  if not exists (select 1 from atp_empresas e
                  where e.cnpj = p_cnpj and e.escritorio_id = atp_meu_escritorio()
                    and e.excluido_em is null) then
    raise exception 'A empresa % não pertence ao seu escritório.', p_cnpj;
  end if;

  update atp_analises set excluido_em = now(), excluido_por = (auth.jwt() ->> 'email')
   where cnpj = p_cnpj and (p_ano is null or ano = p_ano) and excluido_em is null;
  get diagnostics n_an = row_count;

  if p_fornec then
    update atp_fornec set excluido_em = now(), excluido_por = (auth.jwt() ->> 'email')
     where cnpj = p_cnpj and excluido_em is null;
    get diagnostics n_fo = row_count;
  end if;

  return jsonb_build_object('analises', n_an, 'fornec', n_fo);
end $$;

-- 2) Exclusão da empresa (arrasta as análises da empresa)
create or replace function atp_excluir_empresa(p_cnpj text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n_an int := 0; n_em int := 0; quem text := (auth.jwt() ->> 'email');
begin
  if atp_meu_escritorio() is null then
    raise exception 'Seu usuário não está vinculado a um escritório (atp_usuarios.escritorio_id).';
  end if;
  if not exists (select 1 from atp_empresas e
                  where e.cnpj = p_cnpj and e.escritorio_id = atp_meu_escritorio()
                    and e.excluido_em is null) then
    raise exception 'A empresa % não pertence ao seu escritório.', p_cnpj;
  end if;

  update atp_analises set excluido_em = now(), excluido_por = quem
   where cnpj = p_cnpj and excluido_em is null;
  get diagnostics n_an = row_count;

  update atp_empresas set excluido_em = now(), excluido_por = quem
   where cnpj = p_cnpj and excluido_em is null;
  get diagnostics n_em = row_count;

  return jsonb_build_object('analises', n_an, 'empresa', n_em);
end $$;

-- 3) Exclusão de usuário — só admin, e só do próprio escritório
create or replace function atp_excluir_usuario(p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int := 0; quem text := (auth.jwt() ->> 'email');
begin
  if not exists (select 1 from atp_usuarios u
                  where u.email = quem and u.papel = 'admin' and u.excluido_em is null) then
    raise exception 'Apenas administradores podem excluir usuários.';
  end if;
  if p_email = quem then
    raise exception 'Você não pode excluir o próprio usuário.';
  end if;
  update atp_usuarios set excluido_em = now(), excluido_por = quem
   where email = p_email and escritorio_id = atp_meu_escritorio() and excluido_em is null;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Usuário % não encontrado no seu escritório.', p_email; end if;
  return jsonb_build_object('usuarios', n);
end $$;

grant execute on function atp_excluir_dados(text,int,boolean) to authenticated;
grant execute on function atp_excluir_empresa(text)           to authenticated;
grant execute on function atp_excluir_usuario(text)           to authenticated;
