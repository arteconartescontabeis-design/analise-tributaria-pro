// Conjunto de casos para congelar a saída do motor 1.2.0 (linha de base) e para os testes do item 7.
var CTX = { aliquotas: { ibs: 18.70, cbs: 9.21, classificacao: 'ESTIMADA', fonte: 'Res. CGIBS 14/2026' },
  parametros: { redutor_social_residencial_novo: 100000, redutor_social_lote_residencial: 30000, redutor_social_locacao_mes: 600 },
  indices: { ipca_fator: 1, competencia: '2026-01' },
  transicao: { 2026:{ibs:0.1,cbs:0.9}, 2027:{ibs:0.05,cbs:9.11}, 2028:{ibs:0.05,cbs:9.11}, 2029:{ibs:1.87,cbs:9.21},
               2030:{ibs:3.74,cbs:9.21}, 2031:{ibs:5.61,cbs:9.21}, 2032:{ibs:7.48,cbs:9.21}, 2033:{ibs:18.70,cbs:9.21} } };
var D = '2033-06-15';
var CASOS = {
  // Venda
  'V01 venda à vista sem redutor':      { operacao:'venda', data_fato_gerador:D, valor_operacao:500000, imovel:{id:'a',tipo:'comercial'} },
  'V02 venda à vista com redutor':      { operacao:'venda', data_fato_gerador:D, valor_operacao:900000, imovel:{id:'b',tipo:'residencial_novo'}, redutor_ajuste_saldo:400000 },
  'V03 venda parcelada 3 pagamentos':   { operacao:'venda', data_fato_gerador:D, valor_operacao:800000, imovel:{id:'c',tipo:'residencial_novo'}, redutor_ajuste_saldo:300000, pagamentos:[200000,100000,500000] },
  'V04 venda parcelada 7 iguais':       { operacao:'venda', data_fato_gerador:D, valor_operacao:333333.33, imovel:{id:'d',tipo:'comercial'}, parcelas:7 },
  'V05 venda lote residencial':         { operacao:'venda', data_fato_gerador:D, valor_operacao:150000, imovel:{id:'e',tipo:'lote_residencial'} },
  'V06 venda com créditos':             { operacao:'venda', data_fato_gerador:D, valor_operacao:500000, imovel:{id:'f',tipo:'comercial'}, redutor_ajuste_saldo:120000, creditos:5000 },
  'V07 venda social já utilizado':      { operacao:'venda', data_fato_gerador:D, valor_operacao:400000, imovel:{id:'g',tipo:'residencial_novo'}, redutor_social_ja_utilizado:true },
  'V08 venda ano-teste 2026':           { operacao:'venda', data_fato_gerador:'2026-06-15', valor_operacao:500000, imovel:{id:'h',tipo:'comercial'} },
  'V09 venda redutor > base':           { operacao:'venda', data_fato_gerador:D, valor_operacao:100000, imovel:{id:'i',tipo:'comercial'}, redutor_ajuste_saldo:150000 },
  // Locação
  'L01 residencial 1 mês':              { operacao:'locacao', data_fato_gerador:D, valor_operacao:2000, locacao:{finalidade:'residencial', meses:1} },
  'L02 comercial 1 mês':                { operacao:'locacao', data_fato_gerador:D, valor_operacao:10000, locacao:{finalidade:'nao_residencial', meses:1} },
  'L03 residencial com encargos':       { operacao:'locacao', data_fato_gerador:D, valor_operacao:5000, locacao:{finalidade:'residencial', meses:1, encargos_locatario:{prova_pagamento:true, tributos_emolumentos:180, condominio:850, foro_taxa_ocupacao:0}} },
  'L04 encargos sem prova':             { operacao:'locacao', data_fato_gerador:D, valor_operacao:5000, locacao:{finalidade:'residencial', meses:1, encargos_locatario:{prova_pagamento:false, condominio:850}} },
  'L05 misto e período parcial':        { operacao:'locacao', data_fato_gerador:D, valor_operacao:3000, locacao:{finalidade:'residencial', meses:1, dias_no_mes:18, fracao_area_residencial:0.6} },
  'L06 residencial 12 meses':           { operacao:'locacao', data_fato_gerador:D, valor_operacao:36000, locacao:{finalidade:'residencial', meses:12} },
  'L07 temporada 90 dias residencial':  { operacao:'locacao', data_fato_gerador:D, valor_operacao:10000, locacao:{finalidade:'residencial', meses:3, prazo_dias:90} },
  'L08 temporada 91 dias residencial':  { operacao:'locacao', data_fato_gerador:D, valor_operacao:10000, locacao:{finalidade:'residencial', meses:3, prazo_dias:91} },
  'L09 contrato antigo 3,65%':          { operacao:'locacao_transitoria', data_fato_gerador:'2027-03-01', valor_operacao:20000, contrato:{finalidade:'nao_residencial', firmado_ate_16_01_2025:true, prazo_determinado:true, data_comprovada:true, registrado_ate_2025:true} },
  'L10 contrato antigo sem registro':   { operacao:'locacao_transitoria', data_fato_gerador:'2027-03-01', valor_operacao:20000, contrato:{finalidade:'nao_residencial', firmado_ate_16_01_2025:true, prazo_determinado:true, data_comprovada:true, registrado_ate_2025:false} },
  // Permuta
  'P01 permuta sem torna':              { operacao:'permuta', data_fato_gerador:D, valor_operacao:1000000, permuta:{contraparte:'contribuinte', redutor_ajuste_dado:400000} },
  'P02 permuta com torna':              { operacao:'permuta', data_fato_gerador:D, valor_operacao:1000000, permuta:{contraparte:'nao_contribuinte', torna:200000, torna_paga_por:'contribuinte', redutor_ajuste_dado:400000} },
  'P03 permuta torna recebida':         { operacao:'permuta', data_fato_gerador:D, valor_operacao:1000000, permuta:{contraparte:'contribuinte', torna:150000, torna_paga_por:'nao_contribuinte', redutor_ajuste_dado:400000, redutor_ajuste_recebido:100000} },
  'P04 permuta dados incompletos':      { operacao:'permuta', data_fato_gerador:D, valor_operacao:1000000, permuta:{} },
  // Regimes
  'R01 RET normal 2,08%':               { operacao:'ret', data_fato_gerador:'2029-03-10', valor_operacao:250000, ret:{modalidade:'normal', patrimonio_afetacao:true} },
  'R02 RET social 0,53%':               { operacao:'ret', data_fato_gerador:'2029-03-10', valor_operacao:250000, ret:{modalidade:'social', patrimonio_afetacao:true} },
  'R03 RET sem afetação':               { operacao:'ret', data_fato_gerador:'2029-03-10', valor_operacao:250000, ret:{modalidade:'normal', patrimonio_afetacao:false} },
  'R04 loteamento 3,65%':               { operacao:'loteamento', data_fato_gerador:'2030-05-01', valor_operacao:500000, loteamento:{registro_ate_2028:true} },
  'R05 loteamento sem registro':        { operacao:'loteamento', data_fato_gerador:'2030-05-01', valor_operacao:500000, loteamento:{registro_ate_2028:false} }
};
var F3 = {
  lp_objeto_sim: { receita_venda:1000000, receita_locacao:240000, receita_servicos:60000, atividade_imobiliaria_no_objeto:true, meses_periodo:3 },
  lp_objeto_nao: { receita_venda:1000000, receita_locacao:0, receita_servicos:0, atividade_imobiliaria_no_objeto:false, meses_periodo:3 },
  gc: { valor_alienacao:800000, custo_contabil:500000, meses_periodo:3 },
  lr: { receita_total:1000000, custos_dedutiveis:600000, despesas_dedutiveis:150000, prejuizo_acumulado:200000, meses_periodo:3 }
};
module.exports = { CTX: CTX, CASOS: CASOS, F3: F3 };
