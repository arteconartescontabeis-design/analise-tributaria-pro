-- setup_imob_v130.sql — OPCIONAL e idempotente (Análise Imobiliária Pro 1.3.0)
-- Grava na tabela de imóveis os campos ampliados do cadastro. Sem este script
-- o app continua funcionando: os campos viajam no snapshot de cada cálculo
-- (atp_imob_calculos.entrada.cadastro_imovel). Depois de rodar, ative
-- `cadastro_ampliado_no_banco: true` em modulos/imobiliario/imob_manifesto.js.
alter table public.atp_imob_imoveis
  add column if not exists lote_unidade_bloco      text,
  add column if not exists area_total              numeric(14,2),
  add column if not exists area_construida         numeric(14,2),
  add column if not exists fracao_ideal            numeric(10,6),
  add column if not exists data_conclusao          date,
  add column if not exists custos_construcao       numeric(16,2),
  add column if not exists valor_referencia_origem text,
  add column if not exists valor_referencia_data   date,
  add column if not exists situacao                text check (situacao is null or situacao in ('pronto','construcao','pos2027')),
  add column if not exists documentos              text,
  add column if not exists observacoes             text;
comment on column public.atp_imob_imoveis.situacao is 'pronto | construcao | pos2027 — situação em 31/12/2026 (art. 375)';
