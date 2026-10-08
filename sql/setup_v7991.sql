-- ═══════════════════════════════════════════════════════════════════════════════
--  Análise Tributária Pro v7.99.1 — Cadastro único da empresa (fase 1)
--  Rodar no SQL Editor do Supabase (idempotente: pode rodar mais de uma vez).
--
--  A ficha da empresa (atp_empresas) passa a guardar o que a Receita Federal já
--  devolve na consulta de CNPJ e o aplicativo descartava: data de abertura, código
--  do CNAE, datas de opção/exclusão do Simples e do MEI. A análise anual lê a data
--  de abertura daqui quando não tem o seu próprio "início de atividade" (origem E).
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.atp_empresas
  add column if not exists data_abertura          date,
  add column if not exists cnae_codigo            text,
  add column if not exists data_exclusao_simples  date,
  add column if not exists data_opcao_simei       date,
  add column if not exists data_exclusao_simei    date,
  add column if not exists natureza_juridica      text,
  add column if not exists receita_consultada_em  timestamp with time zone;

comment on column public.atp_empresas.data_abertura         is 'Data de início de atividade na Receita Federal (data_inicio_atividade da consulta de CNPJ) — editável na ficha. v7.99.1';
comment on column public.atp_empresas.cnae_codigo           is 'Código do CNAE fiscal principal (a coluna cnae guarda a descrição). v7.99.1';
comment on column public.atp_empresas.data_exclusao_simples is 'Data de exclusão do Simples Nacional, quando houver. v7.99.1';
comment on column public.atp_empresas.data_opcao_simei      is 'Data de opção pelo MEI (SIMEI), quando houver. v7.99.1';
comment on column public.atp_empresas.data_exclusao_simei   is 'Data de exclusão do MEI (SIMEI), quando houver. v7.99.1';
comment on column public.atp_empresas.natureza_juridica     is 'Natureza jurídica (texto da Receita). v7.99.1';
comment on column public.atp_empresas.receita_consultada_em is 'Quando a ficha foi preenchida/atualizada pela consulta à Receita. v7.99.1';
