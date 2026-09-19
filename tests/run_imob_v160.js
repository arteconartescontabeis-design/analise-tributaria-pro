/* tests/run_imob_v160.js — Análise Imobiliária Pro v1.6.0 (motor 1.3.0)
 * (A) REGRESSÃO: compara o motor atual com a saída congelada do motor 1.2.0
 *     (baseline_motor_1.2.0.json). Toda divergência precisa estar na lista de
 *     DIVERGÊNCIAS ESPERADAS, nomeada e fundamentada — divergência não listada
 *     = FALHA. Substitui a run_imob.js (394), que não existe no repositório.
 * (B) TESTES DO ITEM 7 do prompt v1.5 (P0/P1, grupos venda, locação, permuta,
 *     regimes, integridade, fundamentação).
 * Uso: node tests/run_imob_v160.js   (sem dependências) */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');
var MOD = path.join(__dirname, '..', 'modulos', 'imobiliario');
var g = {}; vm.runInNewContext(fs.readFileSync(path.join(MOD, 'motorImob.js'), 'utf8'), g);
var M = g.MotorImob, B = require('./casos_base.js'), base = require('./baseline_motor_1.2.0.json');
var total = 0, falhas = 0, log = [];
function ok(cond, nome, detalhe) { total++; if (!cond) { falhas++; log.push('FALHA ' + nome + (detalhe ? ' — ' + detalhe : '')); } }
function r2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }
function limpa(r) { return { status: r.status, base: r.base, ibs: r.ibs, cbs: r.cbs, debito: r.debito, creditos: r.creditos, total: r.total, confianca: r.confianca && r.confianca.nivel, bloqueios: (r.bloqueios || []).map(function (b) { return b.codigo; }), parcelas: r.parcelas, linhas: (r.linhas || []).map(function (l) { return [l.ordem, l.descricao, l.valor, l.regra_id]; }) }; }
var CTX = B.CTX; // mesma ctx (inclui a escada ANTIGA, para a comparação ser justa)

/* ===== (A) REGRESSÃO ===================================================== */
var ESPERADAS = {
  'L07 temporada 90 dias residencial': 'IMOB-TEM-001 v2: o prazo sozinho não bloqueia; passa a exigir classificação (B001 → B005)'
};
Object.keys(base.casos).forEach(function (k) {
  var atual = limpa(M.calcular(B.CASOS[k], CTX)), antes = base.casos[k];
  var igual = JSON.stringify(atual) === JSON.stringify(antes);
  if (ESPERADAS[k]) ok(!igual, 'A-' + k + ' divergência esperada ocorreu', ESPERADAS[k]);
  else ok(igual, 'A-' + k + ' idêntico ao motor 1.2.0', igual ? '' : JSON.stringify(atual.bloqueios) + ' vs ' + JSON.stringify(antes.bloqueios) + ' total ' + atual.total + ' vs ' + antes.total);
});
// F3
var lpSim = M.calcLucroPresumido(Object.assign({ natureza_receita_venda: 'operacional' }, B.F3.lp_objeto_sim), CTX);
ok(lpSim.total === base.f3.lp_objeto_sim.total && lpSim.irpj === base.f3.lp_objeto_sim.irpj, 'A-LP objeto sim: números idênticos ao 1.2.0 (com natureza confirmada)');
var lpNao = M.calcLucroPresumido(B.F3.lp_objeto_nao, CTX);
ok(lpNao.status === 'BLOQUEADO' && base.f3.lp_objeto_nao.status === 'CALCULADO', 'A-LP objeto não: divergência esperada (1.2.0 calculava com aviso; 1.3.0 bloqueia — IMOB-LP-001 v2)');
ok(JSON.stringify(M.calcGanhoCapital(B.F3.gc, CTX).total) === JSON.stringify(base.f3.gc.total), 'A-ganho de capital idêntico');
ok(M.calcLucroRealIndicativo(B.F3.lr, CTX).total === base.f3.lr.total, 'A-Lucro Real idêntico');
var prjAntes = base.f3.transicao_V02, prjMesmaEscada = M.projetarTransicao(B.CASOS['V02 venda à vista com redutor'], CTX);
ok(prjMesmaEscada.anos.every(function (a, i) { return a.total === prjAntes.anos[i].total; }), 'A-projeção com a MESMA escada: totais idênticos (só mudam categorias)');
ok(prjMesmaEscada.anos.filter(function (a) { return a.classificacao === 'LEGAL'; }).map(function (a) { return a.ano; }).join() === '2026', 'A-projeção: escada legada SEM categorias → só 2026 é LEGAL, pela regra do ano (a UI antiga rotulava 2026-2028 como lei; e a legada traz IBS 0,05 em 2027, que não é o legal)');

/* ===== (B) ITEM 7 ======================================================= */
var CTXN = JSON.parse(JSON.stringify(CTX)); CTXN.transicao = M.transicaoPadrao(CTX);
// P0-1 categorias
var v = M.calcular(B.CASOS['V02 venda à vista com redutor'], CTX);
ok(Array.isArray(v.percentuais) && v.percentuais.length === 5, 'P0 venda: 5 percentuais nomeados');
ok(v.percentuais.every(function (p) { return p.categoria && p.fonte && p.vigencia && p.versao; }), 'P0 cada percentual tem categoria, fonte, vigência e versão');
ok(v.percentuais.filter(function (p) { return p.nome === 'reducao_imobiliaria'; })[0].categoria === 'LEGAL', 'P0 redução de 50% é LEGAL');
ok(v.percentuais.filter(function (p) { return p.nome === 'ibs_padrao'; })[0].categoria === 'ESTIMATIVA', 'P0 IBS padrão é ESTIMATIVA (CGIBS 14/2026)');
var l = M.calcular(B.CASOS['L01 residencial 1 mês'], CTX);
ok(l.percentuais.filter(function (p) { return p.nome === 'reducao_imobiliaria'; })[0].valor === 70, 'P0 locação usa redução de 70%');
var lin = v.linhas.filter(function (x) { return /Alíquotas reduzidas/.test(x.descricao); })[0];
ok(lin && lin.percentuais && lin.percentuais.length === 5, 'P0 linha de alíquotas da memória carrega os percentuais');
ok(M.normCategoria('ESTIMADA') === 'ESTIMATIVA' && M.normCategoria('legal') === 'LEGAL' && M.normCategoria('xyz') === 'ESTIMATIVA', 'P0 normalização de categoria (desconhecido nunca vira LEGAL)');
// P0-2 escada 2026-2033
var t = CTXN.transicao;
ok(t[2027].ibs === 0.10 && t[2028].ibs === 0.10, 'P0 2027-2028: IBS 0,10% (0,05 + 0,05, art. 344) — corrige 0,05 da v1.2.0');
ok(t[2027].cbs === 9.11 && t[2027].categoria_cbs === 'ESTIMATIVA' && t[2027].categoria_ibs === 'LEGAL', 'P0 2027: CBS 9,11 = referência − 0,1 (art. 347), categoria da referência; IBS LEGAL');
ok(t[2029].categoria_ibs === 'PROJECAO' && t[2032].ibs === 7.48, 'P0 2029-2032: IBS é PROJEÇÃO (10-40% da referência)');
ok(t[2026].classificacao === 'LEGAL' && t[2027].classificacao === 'ESTIMADA' && t[2033].classificacao === 'ESTIMADA', 'P0 só 2026 é linha LEGAL');
var prj = M.projetarTransicao(B.CASOS['V02 venda à vista com redutor'], CTXN);
ok(prj.status === 'CALCULADO' && prj.anos.length === 8, 'P0 projeção 2026-2033 calculada');
ok(prj.anos.every(function (a) { return a.categoria_ibs && a.categoria_cbs && a.percentuais; }), 'P0 cada ano mostra categoria de IBS e de CBS e os percentuais aplicados');
ok(prj.anos[1].ibs === r2(prj.anos[1].base * 0.10 * 0.5 / 100), 'P0 2027: IBS = base × 0,10% × (1 − 50%)');
ok(M.projetarTransicao(B.CASOS['V02 venda à vista com redutor'], { aliquotas: CTX.aliquotas }).status === 'BLOQUEADO', 'P0 sem escada informada continua BLOQUEANDO (nada silencioso)');
// P0-3 base reconciliada
var v3 = M.calcular(B.CASOS['V03 venda parcelada 3 pagamentos'], CTX);
var valor = 800000, raj = -v3.linhas[1].valor, rso = -v3.linhas[2].valor;
ok(r2(valor - raj - rso) === v3.base, 'P0 memória reconcilia: valor − redutor de ajuste − redutor social = base');
ok(r2(v3.ibs + v3.cbs) === v3.debito && r2(v3.debito - v3.creditos) === v3.total, 'P0 IBS + CBS = débito; débito − créditos = total');
// P0-4 IBS e CBS separados
['V01 venda à vista sem redutor', 'L02 comercial 1 mês', 'P02 permuta com torna'].forEach(function (k) { var r = M.calcular(B.CASOS[k], CTX); ok(typeof r.ibs === 'number' && typeof r.cbs === 'number' && typeof r.carga_efetiva_pct === 'number', 'P0 ' + k + ': IBS, CBS e carga efetiva separados'); });
// P1 rateio parcelado
[B.CASOS['V03 venda parcelada 3 pagamentos'], B.CASOS['V04 venda parcelada 7 iguais']].forEach(function (c, i) {
  var r = M.calcular(c, CTX); var soma = r.parcelas.reduce(function (a, p) { return a + (typeof p === 'number' ? p : p.total); }, 0);
  ok(r2(soma) === r.total, 'P1 rateio ' + (i + 1) + ': Σ parcelas = total (' + r2(soma) + ' = ' + r.total + ')');
});
var rp = M.calcular(B.CASOS['V03 venda parcelada 3 pagamentos'], CTX);
ok(rp.parcelas[0].proporcao === 25 && rp.parcelas[2].proporcao === 62.5, 'P1 proporção pelo principal de cada parcela (art. 380 §6º)');
// P1 permuta
ok(M.calcular(B.CASOS['P01 permuta sem torna'], CTX).total === 0, 'P1 permuta sem torna: incidência zero');
ok(M.calcular(B.CASOS['P02 permuta com torna'], CTX).base === 200000, 'P1 permuta com torna: só a torna é base');
var pf = M.calcular({ operacao: 'permuta', data_fato_gerador: '2033-06-15', valor_operacao: 1000000, permuta: { contraparte: 'nao_contribuinte', torna: 300000, torna_paga_por: 'contribuinte', redutor_ajuste_dado: 400000, torna_pagamentos: [100000, 100000, 100000] } }, CTX);
ok(pf.parcelas && pf.parcelas.length === 3 && r2(pf.parcelas[0].total + pf.parcelas[1].total + pf.parcelas[2].total) === pf.total, 'P1 permuta com torna parcelada: 3 parcelas, Σ = total, só a torna');
ok(pf.parcelas.every(function (p) { return p.base <= 100000; }), 'P1 permuta parcelada: nenhuma parcela tributa o valor permutado');
var pfin = M.calcular({ operacao: 'permuta', data_fato_gerador: '2033-06-15', valor_operacao: 1000000, permuta: { contraparte: 'contribuinte', torna: 300000, torna_paga_por: 'contribuinte', torna_financiada: true } }, CTX);
ok(pfin.parcelas === null && pfin.total === M.calcular(B.CASOS['P02 permuta com torna'], CTX).total * 1.5 && /financiamento/.test(pfin.notas.join(' ')), 'P1 permuta com torna financiada: incidência integral no recebimento, nota explicativa');
ok(M.calcular(B.CASOS['P04 permuta dados incompletos'], CTX).status === 'CALCULADO' || M.calcular(B.CASOS['P04 permuta dados incompletos'], CTX).status === 'BLOQUEADO', 'P1 permuta dados incompletos: sem exceção');
ok(M.calcular(B.CASOS['P03 permuta torna recebida'], CTX).redutor_ajuste_recebido === 400000, 'P1 permuta entre contribuintes: redutor migra integral (art. 360 §7º I), torna não altera');
ok(M.calcular({ operacao: 'permuta', data_fato_gerador: '2033-06-15', valor_operacao: 1000000, permuta: { contraparte: 'nao_contribuinte', torna: 150000, torna_paga_por: 'nao_contribuinte', redutor_ajuste_dado: 400000 } }, CTX).redutor_ajuste_recebido === 250000, 'P1 permuta com não contribuinte: redutor = dado − torna recebida (art. 360 §8º II c)');
// P1 Lucro Presumido × ganho de capital
ok(M.calcLucroPresumido({ receita_venda: 1e6, atividade_imobiliaria_no_objeto: true, meses_periodo: 3 }, CTX).bloqueios.some(function (b) { return b.codigo === 'LP03'; }), 'P1 LP sem natureza confirmada → bloqueia (LP03)');
ok(M.calcLucroPresumido({ receita_venda: 1e6, atividade_imobiliaria_no_objeto: true, natureza_receita_venda: 'ativo_nao_circulante' }, CTX).bloqueios.some(function (b) { return b.codigo === 'LP04' && b.alternativa === 'calcGanhoCapital'; }), 'P1 LP ativo não circulante → ganho de capital (LP04)');
ok(M.calcLucroPresumido({ receita_venda: 1e6, atividade_imobiliaria_no_objeto: false, natureza_receita_venda: 'operacional' }, CTX).bloqueios.some(function (b) { return b.codigo === 'LP02'; }), 'P1 LP fora do objeto social → bloqueia (LP02)');
ok(M.calcLucroPresumido({ receita_locacao: 240000, meses_periodo: 3 }, CTX).status === 'CALCULADO', 'P1 LP só locação: não exige confirmação de venda');
ok(M.calcGanhoCapital(B.F3.gc, CTX).pis === 0 && M.calcGanhoCapital(B.F3.gc, CTX).tributos_substituidos === 0, 'P1 ganho de capital sem PIS/COFINS');
// P1 Lucro Real indicativo
var lr = M.calcLucroRealIndicativo(B.F3.lr, CTX);
ok(/INDICATIV/i.test(lr.rotulo_obrigatorio || '') && M.REGRAS['IMOB-LR-001'].status === 'staging', 'P1 Lucro Real: rótulo indicativo e regra em staging');
// Locação
ok(M.calcular(B.CASOS['L03 residencial com encargos'], CTX).base === 5000 - 180 - 850 - 600, 'LOC encargos com prova excluídos e redutor social de R$ 600');
ok(M.calcular(B.CASOS['L04 encargos sem prova'], CTX).base === 5000 - 600, 'LOC encargos sem prova NÃO excluídos');
var l5 = M.calcular(B.CASOS['L05 misto e período parcial'], CTX);
ok(l5.status === 'CALCULADO' && l5.base < 3000, 'LOC misto/parcial: redutor social proporcional aplicado');
ok(M.calcular(B.CASOS['L07 temporada 90 dias residencial'], CTX).bloqueios[0].codigo === 'B005', 'LOC temporada ≤90 sem classificação → B005 (classificação obrigatória), não bloqueio por prazo');
var lh = M.calcular(Object.assign({}, B.CASOS['L07 temporada 90 dias residencial'], { locacao: { finalidade: 'residencial', meses: 3, prazo_dias: 90, classificacao_operacao: 'hospedagem' } }), CTX);
ok(lh.bloqueios[0].codigo === 'B001' && /hotelaria/i.test(lh.bloqueios[0].msg), 'LOC classificada como hospedagem → B001 com explicação da hotelaria');
var lc = M.calcular(Object.assign({}, B.CASOS['L07 temporada 90 dias residencial'], { locacao: { finalidade: 'residencial', meses: 3, prazo_dias: 90, classificacao_operacao: 'locacao_residencial', justificativa_classificacao: 'prorrogação contínua' } }), CTX);
ok(lc.status === 'CALCULADO' && lc.total === M.calcular(B.CASOS['L08 temporada 91 dias residencial'], CTX).total && /responsável técnico/.test(lc.notas.join(' ')), 'LOC classificada como locação residencial com justificativa → calcula como 91 dias e registra na memória');
ok(M.calcular(Object.assign({}, B.CASOS['L07 temporada 90 dias residencial'], { locacao: { finalidade: 'residencial', meses: 3, prazo_dias: 90, classificacao_operacao: 'locacao_residencial' } }), CTX).bloqueios[0].codigo === 'B006', 'LOC classificada sem justificativa → B006');
ok(M.calcular(B.CASOS['L09 contrato antigo 3,65%'], CTX).total === 730 && M.calcular(B.CASOS['L10 contrato antigo sem registro'], CTX).status === 'BLOQUEADO', 'LOC contrato antigo: 3,65% com requisitos; bloqueia sem registro');
// Regimes
ok(M.calcular(B.CASOS['R01 RET normal 2,08%'], CTX).total === 5200 && M.calcular(B.CASOS['R02 RET social 0,53%'], CTX).total === 1325, 'REG RET 2,08% e 0,53%');
ok(M.calcular(B.CASOS['R04 loteamento 3,65%'], CTX).total === 18250 && M.calcular(B.CASOS['R05 loteamento sem registro'], CTX).status === 'BLOQUEADO', 'REG loteamento 3,65% e bloqueio sem registro');
ok(M.calcular(B.CASOS['R01 RET normal 2,08%'], CTX).percentuais[0].categoria === 'LEGAL' && M.calcular(B.CASOS['R01 RET normal 2,08%'], CTX).percentuais[0].fonte === 'LC 214/2025, art. 485, I', 'REG percentual do RET: LEGAL com fonte');
// Ano-teste 2026
var a26 = M.calcular(B.CASOS['V08 venda ano-teste 2026'], CTX);
ok(a26.ano_teste_2026 === true && a26.percentuais.some(function (p) { return p.nome === 'ibs_teste_2026' && p.valor === 0.1 && p.categoria === 'LEGAL'; }) && a26.percentuais.filter(function (p) { return p.nome === 'ibs_final'; })[0].aplicada === false, '2026 percentuais de teste LEGAL e finais marcados como não aplicados');
// Integridade
ok(M.calcular(B.CASOS['V09 venda redutor > base'], CTX).base === 0 && M.calcular(B.CASOS['V09 venda redutor > base'], CTX).total === 0, 'INT base nunca negativa');
var r1 = M.calcular(B.CASOS['V02 venda à vista com redutor'], CTX), r1b = M.calcular(B.CASOS['V02 venda à vista com redutor'], CTX);
ok(JSON.stringify(limpa(r1)) === JSON.stringify(limpa(r1b)), 'INT idempotência');
ok(M.calcular({ operacao: 'venda', data_fato_gerador: '2033-01-01', valor_operacao: 'abc' }, CTX).status === 'BLOQUEADO', 'INT entrada hostil bloqueia sem exceção');
// Fundamentação (item 4)
var ids = Object.keys(M.REGRAS);
ok(ids.every(function (id) { var r = M.REGRAS[id]; return r.codigo && r.versao && r.formula && r.fonte_oficial.length && r.data_consulta && r.categoria && r.status; }), 'FUND toda regra tem código, versão, fórmula, fonte oficial (link), data de consulta, categoria e status');
ok(ids.every(function (id) { var r = M.REGRAS[id]; return !((r.categoria === 'premissa' || r.categoria === 'indicativa' || r.categoria === 'projecao') && r.status === 'homologada'); }), 'FUND nenhuma regra de premissa/indicativa/projeção está "homologada"');
ok(M.REGRAS['IMOB-TRA-001'].status === 'projecao' && M.REGRAS['IMOB-LP-001'].categoria === 'administrativa', 'FUND TRA-001 = projeção; LP-001 = administrativa');
ok(M.REGRAS['IMOB-RSO-002'].alteracao_posterior && /LC 227/.test(M.REGRAS['IMOB-RSO-002'].alteracao_posterior), 'FUND alerta de alteração por norma posterior (art. 260, LC 227/2026)');
ok(v.linhas.every(function (x) { return x.regra_id === null || (M.regra(x.regra_id) && M.regra(x.regra_id).fonte_oficial.length); }), 'FUND cada linha do resultado abre uma regra com fonte oficial');
// Varredura v1.6.1
ok(M.calcular({ operacao: 'permuta', data_fato_gerador: '2033-06-15', valor_operacao: 1e6, permuta: { contraparte: 'nao_contribuinte', torna: 300000, torna_paga_por: 'contribuinte', torna_pagamentos: ['a', null, -5, '100000'] } }, CTX).bloqueios[0].codigo === 'E015', 'VAR torna_pagamentos com texto/negativo → E015 (antes gerava parcela de R$ 0 com todo o imposto na última)');
ok(M.calcular({ operacao: 'venda', data_fato_gerador: '2033-06-15', valor_operacao: 800000, imovel: { id: 'a', tipo: 'comercial' }, pagamentos: ['200000', 600000] }, CTX).bloqueios[0].codigo === 'E015', 'VAR pagamentos da venda com texto → E015 (defeito pré-existente no 1.2.0)');
ok(M.calcular({ operacao: 'permuta', data_fato_gerador: '2033-06-15', valor_operacao: 1e6, permuta: { contraparte: 'nao_contribuinte', torna: 300000, torna_paga_por: 'contribuinte', torna_pagamentos: [] } }, CTX).bloqueios[0].codigo === 'E015', 'VAR lista de pagamentos vazia → E015');
ok(M.calcular({ operacao: 'locacao', data_fato_gerador: '2033-06-15', valor_operacao: 5000, locacao: { finalidade: 'residencial', meses: 1, prazo_dias: 10, classificacao_operacao: 'locacao_residencial', justificativa_classificacao: { a: 1 } } }, CTX).bloqueios[0].codigo === 'E016', 'VAR justificativa que não é texto → E016');
var leg = { 2026: { ibs: 0.1, cbs: 0.9, classificacao: 'LEGAL' }, 2027: { ibs: 0.1, cbs: 9.11, classificacao: 'LEGAL' }, 2033: { ibs: 18.7, cbs: 9.21 } };
var pl = M.projetarTransicao(B.CASOS['V01 venda à vista sem redutor'], Object.assign({}, CTX, { transicao: leg }));
ok(pl.anos[0].classificacao === 'LEGAL' && pl.anos[1].classificacao === 'ESTIMADA' && pl.anos[1].categoria_ibs === 'LEGAL' && pl.anos[1].categoria_cbs === 'ESTIMATIVA', 'VAR escada legada rotulada "LEGAL" em 2027 não herda o rótulo: categoria vem da regra do ano');
ok(M.transicaoPadrao({ aliquotas: {} }) === null && M.transicaoPadrao({ aliquotas: { ibs: 'x', cbs: null } }) === null, 'VAR transicaoPadrao sem alíquota de referência devolve null (nada de escada com zeros)');
ok(M.projetarTransicao(B.CASOS['V01 venda à vista sem redutor'], Object.assign({}, CTX, { transicao: null })).status === 'BLOQUEADO', 'VAR projeção com escada nula BLOQUEIA');
// v1.6.2 — pacote do parecer e catálogo
var pv = M.calcular(B.CASOS['V02 venda à vista com redutor'], CTX), pac = M.pacoteParecer(B.CASOS['V02 venda à vista com redutor'], pv, CTX, {});
ok(Array.isArray(pac.bloco_05b_percentuais) && pac.bloco_05b_percentuais.length === 5 && pac.bloco_05b_percentuais.every(function (p) { return p.categoria; }), 'PAC bloco_05b_percentuais com categoria no pacote do parecer');
ok(pac.numeros_autorizados.indexOf(9.35) >= 0 && pac.numeros_autorizados.indexOf(50) >= 0, 'PAC percentuais entram em numeros_autorizados (9,35 e 50)');
ok(pac.confianca === 'MEDIA' && pac.tipo === 'indicativa', 'PAC confianca e tipo propagados no topo do pacote (achado antigo do pdfImob)');
ok(pac.bloco_13_limitacoes_e_premissas.some(function (x) { return /NÃO fixados em lei/.test(x); }), 'PAC limitação lista os percentuais não legais');
ok(/bloco_05b_percentuais/.test(M.promptParecer(pac)) && /PROIBIDO chamar de "alíquota legal"/.test(M.promptParecer(pac)), 'PAC prompt proíbe chamar de legal o que não é');
ok(M.REGRAS['IMOB-BASE-001'].data_consulta === '2026-08-20' && M.REGRAS['IMOB-TRA-001'].data_consulta === '2026-09-18' && M.REGRAS['IMOB-LP-001'].data_consulta === '2026-08-22', 'CAT data de consulta por regra (Passo 0 / relidas hoje / fonte secundária)');
ok(M.REGRAS['IMOB-LP-001'].conferida_em_fonte_primaria === false && M.REGRAS['IMOB-BASE-001'].conferida_em_fonte_primaria === true, 'CAT marca as regras nunca relidas no texto da norma');
// Lacre
var lv = M.lacreVerificar();
ok(lv.integro === true, 'LACRE motor 1.3.0 íntegro (' + lv.hash_atual + ' = ' + lv.hash_homologado + ')');

console.log('\n' + log.join('\n'));
console.log('\n=== run_imob_v160: ' + (total - falhas) + '/' + total + ' OK, ' + falhas + ' falha(s) — motor ' + M.MOTOR_IMOB_VERSAO + ' · ruleset ' + M.RULESET_VERSAO + ' · lacre ' + lv.hash_atual);
process.exit(falhas ? 1 : 0);
