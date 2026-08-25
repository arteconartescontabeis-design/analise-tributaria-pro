-- ============================================================================
-- setup_v7470.sql  —  Análise Imobiliária Pro (Artecon)
--
-- OBJETIVO: completar o espelho de atp_imob_regras. O catálogo do motor
--   (motorImob 1.2.0, ruleset imob-2026.08.21, lacre c287341e) tem 29 regras;
--   a tabela tem 14. Faltam 15 — e são justamente as de maior conteúdo
--   interpretativo: permuta, loteamento, locação em regime transitório e todo
--   o bloco de Lucro Presumido / Lucro Real.
--
-- POR QUE IMPORTA: o motor NÃO lê esta tabela (conferido — nenhuma função do
--   módulo a consulta), então nenhum cálculo muda. O que está incompleto é a
--   TRILHA DE AUDITORIA: é ela que sustenta, diante de um questionamento, qual
--   regra foi aplicada, em que versão e com que base legal.
--
-- STATUS = 'staging' EM TODAS. Não é provisório, é o correto:
--   os gatilhos tg_atp_imob_exige_hash e tg_atp_imob_homolog exigem, para
--   promover a 'homologada', (a) fonte legal com hash_fonte e URL oficial
--   ligada à regra e (b) aprovação registrada em atp_imob_aprovacoes por
--   pessoa DIFERENTE de quem editou (duas, se alto_impacto). Em 'staging'
--   nenhum dos dois dispara. A promoção é ato de governança, não de script.
--
-- CLASSIFICAÇÃO (decisões de 25/08):
--   * As 9 "irmãs" (BASE-002, RAJ-002, RSO-003, CRE-002/003, PER-001/002,
--     LOT-001, LOC-TR1) espelham a classificação da regra irmã já cadastrada.
--   * hierarquia_normativa das LP = 'lei': Leis 9.249/1995, 9.430/1996,
--     9.718/1998 e 10.637/2002+10.833/2003 são ORDINÁRIAS. Registrar 'LC' por
--     uniformidade esvaziaria o campo — e a diferença de degrau normativo tem
--     efeito prático quando LC superveniente conflita com lei ordinária.
--   * LP-003 recebe tipo_operacao 'ambas' (valor novo; a coluna é texto livre,
--     sem CHECK): PIS/COFINS cumulativos incidem sobre venda E locação com a
--     mesma base. Marcar 'venda' esconderia a norma de quem filtra locação.
--   * nivel_interpretacao vem do campo `nivel` do catálogo do motor, que usa
--     exatamente o vocabulário do CHECK: LP-001 e LP-004 são 'administrativo'
--     (apoiam-se em SC COSIT), LR-001 é 'premissa'.
--
-- IDEMPOTENTE: o ON CONFLICT DO NOTHING sobre (regra_id, versao) faz o script
--   ignorar o que já existir. Rodar duas vezes não duplica nem altera.
--   NÃO TOCA nas 14 linhas já cadastradas.
--
-- VALIDADO em PostgreSQL 16.15 local contra réplica da tabela com os dois
--   gatilhos reais: as 15 entram em 'staging'; tentativa de entrar direto em
--   'homologada' é recusada pelos gatilhos, como deve ser.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASSO 0 — Estado ANTES (guarde a saída)
-- ----------------------------------------------------------------------------
select count(*) as regras_hoje,
       count(distinct escritorio_id) as escritorios
from public.atp_imob_regras;

select regra_id, versao, status from public.atp_imob_regras order by regra_id;


-- ----------------------------------------------------------------------------
-- PASSO 1 — Inserção das 15
--
--   O escritorio_id é herdado das regras já cadastradas. Se um dia houver mais
--   de um escritório com catálogo próprio, este bloco precisa ser revisto — a
--   verificação abaixo aborta nesse caso em vez de escolher um às cegas.
-- ----------------------------------------------------------------------------
do $$
declare esc bigint; n int;
begin
  select count(distinct escritorio_id) into n from public.atp_imob_regras;
  if n <> 1 then
    raise exception 'Há % escritórios com regras cadastradas. Informe o escritorio_id manualmente antes de rodar.', n;
  end if;
end $$;

insert into public.atp_imob_regras
  (escritorio_id, regra_id, versao, nome, tipo_operacao, tributo, status,
   hierarquia_normativa, nivel_interpretacao, requer_validacao_humana, alto_impacto,
   engine_build_id, calculation_contract_version, observacao)
select (select distinct escritorio_id from public.atp_imob_regras),
       v.regra_id, v.versao, v.nome, v.tipo_operacao, v.tributo, 'staging',
       v.hierarquia, v.nivel, false, v.alto_impacto,
       'motorImob 1.2.0 · ruleset imob-2026.08.21 · lacre c287341e',
       'calc-imob-1',
       'Espelho do catálogo do motor (setup_v7470). Fontes: ' || v.fontes
from (values
  -- ===== as 9 irmãs: classificação espelhada da regra já cadastrada =====
  ('IMOB-BASE-002', 1, 'Exclusões da base de cálculo da locação',
   'locacao', 'IBS+CBS', 'LC', 'legal', true,
   'LC 214/2025, art. 255; RIBS art. 364, §§ 2º a 4º; RCBS art. 364, §§ 2º a 4º'),

  ('IMOB-RAJ-002', 1, 'Valor inicial do redutor de ajuste — opções do art. 258',
   'venda', 'IBS+CBS', 'LC', 'legal', true,
   'LC 214/2025, art. 258; RIBS art. 375; RCBS art. 375; RIBS art. 366 (valor de referência)'),

  ('IMOB-RSO-003', 1, 'Redutor social proporcional — período parcial e imóvel misto',
   'locacao', 'IBS+CBS', 'LC', 'legal', true,
   'RIBS art. 377, parágrafo único, I; RIBS art. 378; RCBS arts. 377 e 378'),

  ('IMOB-CRE-002', 1, 'Créditos vedados — operações imunes, isentas, alíquota zero, diferimento e suspensão',
   'venda', 'IBS+CBS', 'LC', 'legal', false,
   'LC 214/2025, arts. 49, 50 e 52'),

  ('IMOB-CRE-003', 1, 'Ordem de utilização e prazo de 5 anos dos créditos',
   'venda', 'IBS+CBS', 'LC', 'legal', false,
   'LC 214/2025, arts. 53, 54 e 55'),

  ('IMOB-PER-001', 1, 'Permuta entre imóveis — não incidência, exceto sobre a torna',
   'venda', 'IBS+CBS', 'LC', 'legal', true,
   'LC 214/2025, art. 252, §3º; RIBS art. 360, §3º, I, e §4º; RCBS art. 360, §3º, I, e §4º'),

  ('IMOB-PER-002', 1, 'Permuta — transferência do redutor de ajuste',
   'venda', 'IBS+CBS', 'LC', 'legal', true,
   'RIBS art. 360, §§ 5º, 7º e 8º; RCBS art. 360, §§ 5º, 7º e 8º'),

  ('IMOB-LOT-001', 1, 'Loteamento — regime transitório de 3,65% sobre a receita bruta',
   'venda', 'IBS+CBS', 'LC', 'legal', true,
   'LC 214/2025, art. 486; RIBS art. 462; RCBS art. 462'),

  ('IMOB-LOC-TR1', 1, 'Locação — regime transitório de 3,65% para contratos antigos',
   'locacao', 'IBS+CBS', 'LC', 'legal', true,
   'LC 214/2025, art. 487; RIBS art. 463; RCBS art. 463'),

  -- ===== as 6 que inauguram vocabulário =====
  ('IMOB-LP-001', 1, 'Lucro Presumido — venda de imóveis (8% IRPJ / 12% CSLL)',
   'venda', 'IRPJ+CSLL', 'lei', 'administrativo', true,
   'Lei 9.249/1995, arts. 15 e 20; IN RFB 1.700/2017, arts. 33 e 34; SC COSIT 7/2021; SC COSIT 221/2024'),

  ('IMOB-LP-002', 1, 'Lucro Presumido — locação de imóveis (32% IRPJ / 32% CSLL)',
   'locacao', 'IRPJ+CSLL', 'lei', 'legal', true,
   'Lei 9.249/1995, art. 15, §1º, III, "c"; Lei 9.249/1995, art. 20'),

  ('IMOB-LP-003', 1, 'Lucro Presumido — PIS/COFINS cumulativos de 0,65% e 3%',
   'ambas', 'PIS+COFINS', 'lei', 'legal', true,
   'Lei 9.718/1998, arts. 2º e 3º; SC COSIT 7/2021'),

  ('IMOB-LP-004', 1, 'Ganho de capital — imóvel do ativo não circulante fora do objeto social',
   'venda', 'IRPJ+CSLL', 'lei', 'administrativo', true,
   'Lei 9.430/1996, art. 29; IN RFB 1.700/2017, art. 215; SC COSIT 221/2024'),

  ('IMOB-LR-001', 1, 'Lucro Real — simulação comparativa indicativa',
   'venda', 'IRPJ+CSLL', 'lei', 'premissa', false,
   'Lei 9.430/1996; Leis 10.637/2002 e 10.833/2003 (regime a confirmar por atividade)'),

  ('IMOB-TRA-001', 1, 'Projeção 2026-2033 — alíquotas vindas do motor genérico',
   'venda', 'IBS+CBS', 'LC', 'legal', true,
   'LC 214/2025, arts. 343, 346 e 348; LC 214/2025, art. 125 do ADCT (escada IBS)')
) as v(regra_id, versao, nome, tipo_operacao, tributo, hierarquia, nivel, alto_impacto, fontes)
on conflict (regra_id, versao) do nothing;


-- ----------------------------------------------------------------------------
-- PASSO 2 — Verificação
-- ----------------------------------------------------------------------------
-- (a) total e distribuição:
select count(*)                                        as total,
       count(*) filter (where status = 'staging')      as em_staging,
       count(*) filter (where status = 'homologada')   as homologadas
from public.atp_imob_regras;
--   ESPERADO: total = 29, em_staging = 29, homologadas = 0.

-- (b) as 15 novas, na ordem em que entraram:
select regra_id, tipo_operacao, tributo, nivel_interpretacao, hierarquia_normativa, alto_impacto
from public.atp_imob_regras
where engine_build_id like 'motorImob 1.2.0%'
order by regra_id;
--   ESPERADO: 15 linhas.

-- (c) o vocabulário novo, para conferir de uma olhada:
select tipo_operacao, tributo, count(*) as regras
from public.atp_imob_regras group by 1,2 order by 1,2;
--   ESPERADO: aparecem 'ambas'/'PIS+COFINS' e 'venda'/'IRPJ+CSLL' etc.

-- (d) nenhuma das 14 antigas foi alterada:
select count(*) as antigas_intactas from public.atp_imob_regras
where engine_build_id is null and status = 'staging';
--   ESPERADO: 14.


-- ----------------------------------------------------------------------------
-- PROMOÇÃO — o que falta para sair de 'staging' (NÃO faz parte deste script)
--
--   As 97 fontes legais em atp_imob_fontes_legais estão todas com hash_fonte e
--   fonte_oficial preenchidos, ligadas a 11 regras. Para essas 11, o
--   tg_atp_imob_exige_hash já passaria hoje; falta apenas a aprovação.
--   As demais 18 precisam antes da fonte ligada.
--
--   O caminho, por regra:
--     1. inserir em atp_imob_fontes_legais a fonte com hash_fonte e URL oficial,
--        apontando regra_uuid para o id da regra;
--     2. registrar em atp_imob_aprovacoes a decisão 'aprovada' por um usuário
--        DIFERENTE de quem consta em atualizado_por (duas aprovações se
--        alto_impacto = true);
--     3. só então: update ... set status = 'homologada'.
--
--   O gatilho recusa qualquer atalho, inclusive auto-aprovação. É por desenho.
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- REVERSÃO — remove SOMENTE as 15 inseridas por este script
-- ----------------------------------------------------------------------------
-- delete from public.atp_imob_regras
--  where engine_build_id like 'motorImob 1.2.0%'
--    and regra_id in ('IMOB-BASE-002','IMOB-RAJ-002','IMOB-RSO-003','IMOB-CRE-002',
--                     'IMOB-CRE-003','IMOB-PER-001','IMOB-PER-002','IMOB-LOT-001',
--                     'IMOB-LOC-TR1','IMOB-LP-001','IMOB-LP-002','IMOB-LP-003',
--                     'IMOB-LP-004','IMOB-LR-001','IMOB-TRA-001');
