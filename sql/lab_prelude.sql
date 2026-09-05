-- LAB apenas: imita o mínimo do Supabase que o setup usa (papel authenticated e atp_meu_escritorio()).
-- Em produção estas coisas JÁ existem — não rode isto lá.
do $$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if; end $$;
grant usage on schema public to authenticated;
create or replace function public.atp_meu_escritorio() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'escr', '')::uuid
$$;
grant execute on function public.atp_meu_escritorio() to authenticated;
grant authenticated to postgres;
