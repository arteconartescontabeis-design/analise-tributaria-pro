/* tests/run_imob_ui.js — Análise Imobiliária Pro 1.4.0
 * Carrega o app inteiro (imobiliaria.html + módulos) num jsdom, roda os 25
 * testes de aceite do Prompt Mestre (item 17) e verificações estruturais.
 * Uso: npm i --no-save jsdom@24 && node tests/run_imob_ui.js
 * Registro: tests/relatorio_imob_v140.json (dados, esperado, obtido, status). */
'use strict';
var fs = require('fs'), path = require('path');
var JSDOM = require('jsdom').JSDOM;
var RAIZ = path.join(__dirname, '..');
var MOD = path.join(RAIZ, 'modulos', 'imobiliario');

var html = fs.readFileSync(path.join(RAIZ, 'imobiliaria.html'), 'utf8')
  .replace(/<script src="[^"]*"><\/script>\s*/g, '')                     // scripts são injetados manualmente
  .replace(/<script>[\s\S]*?<\/script>/g, '');                            // sem fetch/Supabase no teste
var dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://artecon.test/imobiliaria.html' });
var w = dom.window;
w.APP = { escritorioId: null, user: { email: 'tester@artecon' } };
w.open = function () { var d = new JSDOM('<html><head></head><body></body></html>'); var ww = d.window; ww.print = function () {}; ww.focus = function () {}; w.__ultimaJanela = ww; return ww; };
w.__ultimaJanela = null;
['imob_manifesto.js', 'imob_estilo.js', 'imob_pagina.js', 'motorImob.js', 'persistenciaImob.js', 'parecerImobIA.js', 'nucleoRastreio.js',
 'imob_premissas.js', 'imob_validacao.js', 'imob_relatorios.js', 'ui_imobiliaria.js'].forEach(function (f) {
  w.eval(fs.readFileSync(path.join(MOD, f), 'utf8'));
});
var d = w.document, M = w.MotorImob, PR = w.ImobPremissas, VA = w.ImobValidacao, RL = w.ImobRelatorios;
var registro = [], falhas = 0, total = 0;
function $(id) { return d.getElementById(id); }
function set(id, v) { $(id).value = String(v); }
function texto(id) { return $(id).textContent.replace(/\s+/g, ' '); }
function html_(id) { return $(id).innerHTML; }
function r2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }
function t(num, nome, dados, esperado, fn) {
  total++;
  var obtido, ok = false, err = null;
  try { obtido = fn(); ok = obtido === true || (obtido && obtido.ok === true); if (obtido && obtido.ok !== undefined) obtido = obtido.obtido; }
  catch (e) { err = e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : String(e); }
  if (!ok) falhas++;
  registro.push({ n: num, teste: nome, dados: dados, esperado: esperado, obtido: err || obtido, divergencia: ok ? null : 'esperado ≠ obtido', correcao: ok ? null : 'ver código', status: ok ? 'OK' : 'FALHOU' });
  console.log((ok ? '  ok ' : ' FAIL') + ' ' + num + ' ' + nome + (ok ? '' : ' → ' + (err || JSON.stringify(obtido))));
}
w.imobEntrar();
w.localStorage.clear();   // testes começam sem premissas nem simulações salvas
var PREM = w.__imobUI.PREM();
PR.restaurarTodas(PREM);

/* ===== estruturais =============================================================== */
t('E2', 'todo onclick da marcação aponta para função exportada', 'imob_pagina.js', 'todas definidas', function () {
  var fontes = fs.readFileSync(path.join(MOD, 'imob_pagina.js'), 'utf8'), re = /onclick="([a-zA-Z_]+)\(/g, m, f = {};
  while ((m = re.exec(fontes))) f[m[1]] = 1;
  var falt = Object.keys(f).filter(function (k) { return typeof w[k] !== 'function'; });
  return falt.length ? { ok: false, obtido: falt } : true;
});
t('E3', 'lacre do motor íntegro e versão do módulo 1.4.0 visível', 'lacreVerificar + ModulosInfo', 'c287341e / 1.4.0', function () {
  var v = M.lacreVerificar(); return v.integro && w.ModulosInfo.imobiliario.versao === '1.4.0' && w.ModulosInfo.imobiliario.changelog[0].versao === '1.4.0' ? true : { ok: false, obtido: v };
});
t('E4', '14 abas e página injetada; nav lateral marca ativo', 'abrirAba', 'aba on = venda', function () {
  w.abrirAba('venda'); var on = d.querySelectorAll('#imob-tabs .tab.on');
  return on.length === 1 && on[0].dataset.t === 'venda' && $('t-venda').style.display === '' && $('t-imovel').style.display === 'none' ? true : { ok: false, obtido: on.length };
});

/* ===== item 17 — 25 testes de aceite ============================================= */
// 1 venda com redutor
t(1, 'Venda com redutor de ajuste', 'venda 900.000; RAJ 400.000; res. novo; 2033', 'base 400.000; IBS 37.400; CBS 18.420; total 55.820', function () {
  set('v-val', 900000); set('v-raj', 400000); set('v-cre', 0); set('v-data', '2033-06-15'); set('v-tipo', 'residencial_novo'); set('v-pag', ''); w.calcVenda();
  var r = w.__RES_T = M.calcular(w.__imobUI.entradaVenda(), w.__imobUI.ctxPara('venda'));
  var h = html_('v-out');
  return r.base === 400000 && r.ibs === 37400 && r.cbs === 18420 && r.total === 55820 && h.indexOf('55.820,00') > 0 && h.indexOf('Resultado da aliena') > 0 ? true : { ok: false, obtido: [r.base, r.ibs, r.cbs, r.total] };
});
// 2 venda sem redutor
t(2, 'Venda sem redutor', 'venda 900.000; RAJ 0; res. novo', 'base 800.000 (só redutor social); total 111.640', function () {
  set('v-raj', 0); w.calcVenda(); var r = M.calcular(w.__imobUI.entradaVenda(), w.__imobUI.ctxPara('venda'));
  return r.base === 800000 && r.total === 111640 && html_('v-out').indexOf('111.640,00') > 0 ? true : { ok: false, obtido: [r.base, r.total] };
});
// 3 venda com créditos
t(3, 'Venda com créditos', 'venda 900.000; RAJ 400.000; créditos 10.000', 'total 45.820; créditos aproveitados 10.000; saldo 0', function () {
  set('v-raj', 400000); set('v-cre', 10000); w.calcVenda(); var r = M.calcular(w.__imobUI.entradaVenda(), w.__imobUI.ctxPara('venda'));
  var h = html_('v-out'); return r.total === 45820 && r.creditos === 10000 && h.indexOf('Créditos efetivamente aproveitados') > 0 && h.indexOf('Saldo de créditos') > 0 ? true : { ok: false, obtido: [r.total, r.creditos] };
});
// 4 venda com créditos maiores que o débito
t(4, 'Venda com créditos maiores que o débito', 'créditos 100.000 > débito 55.820', 'aproveitados 55.820; saldo 44.180; total 0', function () {
  set('v-cre', 100000); w.calcVenda(); var r = M.calcular(w.__imobUI.entradaVenda(), w.__imobUI.ctxPara('venda'));
  var h = html_('v-out'); return r.creditos === 55820 && r.total === 0 && h.indexOf('44.180,00') > 0 ? true : { ok: false, obtido: [r.creditos, r.total] };
});
// 5 memória sem R$ 0,00 na alíquota
t(5, 'Linha "Alíquotas reduzidas" mostra percentuais, não R$ 0,00', 'memória da venda', 'IBS 9,3500% · CBS 4,6050%; sem "0,00" na linha', function () {
  set('v-cre', 0); w.calcVenda();
  var tr = Array.prototype.slice.call(d.querySelectorAll('#v-out table tr')).filter(function (x) { return x.textContent.indexOf('Alíquotas reduzidas') >= 0; })[0];
  var tx = tr ? tr.textContent : '';
  return tx.indexOf('9,3500%') > 0 && tx.indexOf('4,6050%') > 0 && tx.indexOf('18,70%') > 0 && !/R\$\s*0,00|\b0,00\b/.test(tx) ? true : { ok: false, obtido: tx.slice(0, 200) };
});
// 6 premissas no topo
t(6, 'Aviso de simulação e premissas aparecem NO TOPO do resultado', 'v-out', 'primeiro filho .grau com aviso e ruleset', function () {
  var p = $('v-out').firstElementChild, tx = p.textContent;
  return p.classList.contains('grau') && tx.indexOf('Simulação baseada em alíquotas estimadas') > 0 && tx.indexOf(M.RULESET_VERSAO) > 0 && tx.indexOf('CGIBS 14/2026') > 0 && tx.indexOf('estimada') > 0 ? true : { ok: false, obtido: tx.slice(0, 200) };
});
// 7 premissa editada com justificativa e recálculo
t(7, 'Edição de premissa (IBS 20%) com justificativa recalcula e marca original × editado', 'ibs_padrao 20 + justificativa', 'IBS 40.000 (400.000 × 10%); badge "premissa editada"; grau BAIXA', function () {
  w.abrirAba('premissas'); set('pr-ibs_padrao', 20); set('prj-ibs_padrao', 'cenário conservador do cliente'); w.imobPremissaAplicar('ibs_padrao');
  var r = M.calcular(w.__imobUI.entradaVenda(), w.__imobUI.ctxPara('venda')), h = html_('v-out');
  var ok = r.ibs === 40000 && h.indexOf('premissa editada') > 0 && h.indexOf('18,70%') > 0 && h.indexOf('20,00%') > 0 && h.indexOf('n-BAIXA') > 0 && texto('pr-out').indexOf('alterado manualmente') > 0;
  return ok ? true : { ok: false, obtido: [r.ibs, h.indexOf('premissa editada'), h.indexOf('n-BAIXA')] };
});
t('7b', 'Edição sem justificativa é recusada; restaurar volta ao padrão', 'cbs_padrao 10 sem justificativa', 'recusa + IBS volta a 37.400', function () {
  set('pr-cbs_padrao', 10); set('prj-cbs_padrao', ''); w.imobPremissaAplicar('cbs_padrao');
  var rec = texto('pr-msg').indexOf('exige justificativa') > 0;
  w.imobPremissaRestaurar(); var r = M.calcular(w.__imobUI.entradaVenda(), w.__imobUI.ctxPara('venda'));
  return rec && r.ibs === 37400 && !PR.alteradas(PREM).length ? true : { ok: false, obtido: [rec, r.ibs] };
});
// 8 redução manual equivalente
t('7c', 'Redução manual 60% via alíquota equivalente: memória = resultado', 'reducao_venda 60%', 'IBS 400.000×7,48% = 29.920; coerência OK', function () {
  set('pr-reducao_venda', 60); set('prj-reducao_venda', 'teste de sensibilidade da redução'); w.imobPremissaAplicar('reducao_venda');
  var r = M.calcular(w.__imobUI.entradaVenda(), w.__imobUI.ctxPara('venda')), ex = PR.explicar(PREM, 'venda'), co = RL.coerencia(r, ex);
  w.imobPremissaRestaurar();
  return r.ibs === 29920 && ex.ibs_final === 7.48 && co.ok ? true : { ok: false, obtido: [r.ibs, ex.ibs_final, co.checks.filter(function (c) { return !c.ok; })] };
});
// 8 inventário
t(8, 'Inventário sem data fixa: data atual automática e prazo até 31/12/2026', 'aba inventário', 'iv-hoje = hoje; dias = diasAte(hoje, 2026-12-31)', function () {
  w.abrirAba('inventario'); w.imobInventarioExemplo();
  var hoje = new Date(); var iso = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');
  var dias = M.diasAte(iso, '2026-12-31'), tx = texto('iv-out') + texto('iv-prazo');
  return $('iv-hoje').value === iso && $('iv-hoje').readOnly && tx.indexOf(dias + ' dias') > 0 && tx.indexOf('31/12/2026') > 0 && $('iv-base').value === iso ? true : { ok: false, obtido: [$('iv-hoje').value, iso, dias, tx.slice(0, 120)] };
});
t('8b', 'Inventário aceita data-base informada pelo usuário e a exibe', 'iv-base = 2026-09-01', 'texto "01/09/2026" no resultado', function () {
  set('iv-base', '2026-09-01'); w.imobInventario(); return texto('iv-out').indexOf('01/09/2026') > 0 ? true : { ok: false, obtido: texto('iv-out').slice(0, 200) };
});
// 9 locação residencial
t(9, 'Locação residencial', '5.000/mês; 1 mês; encargos 180+850 com prova; 2033', 'base 5.000−1.030−600 = 3.370; IBS 189,06 (5,61%); CBS 93,11 (2,763%); total 282,17', function () {
  w.abrirAba('locacao'); set('l-val', 5000); set('l-fim', 'residencial'); set('l-mes', 1); set('l-prz', ''); set('l-trib', 180); set('l-cond', 850); set('l-foro', 0); set('l-prova', '1'); set('l-dias', ''); set('l-area', ''); set('l-cre', 0); set('l-data', '2033-06-15'); set('l-cmp', '1');
  w.calcLoc(); var r = M.calcular(w.__imobUI.entradaLocacao(), w.__imobUI.ctxPara('locacao')), h = html_('l-out');
  return r.base === 3370 && r.total === r2(r.ibs + r.cbs) && h.indexOf('Residencial × não residencial') > 0 && h.indexOf('Carga efetiva anual') > 0 && Math.abs(r.ibs - 189.06) < 0.01 && Math.abs(r.cbs - 93.11) < 0.01 ? true : { ok: false, obtido: [r.base, r.ibs, r.cbs, r.total] };
});
// 10 locação não residencial
t(10, 'Locação não residencial', 'mesmos dados, finalidade não residencial', 'sem redutor social: base 3.970; comparação mostra diferença 600', function () {
  set('l-fim', 'nao_residencial'); w.calcLoc(); var r = M.calcular(w.__imobUI.entradaLocacao(), w.__imobUI.ctxPara('locacao'));
  var h = html_('l-out'); return r.base === 3970 && r.redutor_social_usado === 0 && h.indexOf('600,00') > 0 ? true : { ok: false, obtido: [r.base, r.redutor_social_usado] };
});
// 11 locação com período parcial
t(11, 'Locação com período parcial (15 dias)', 'dias 15; 1 mês; residencial', 'receita 2.500; redutor social 300', function () {
  set('l-fim', 'residencial'); set('l-dias', 15); w.calcLoc(); var e = w.__imobUI.entradaLocacao(), r = M.calcular(e, w.__imobUI.ctxPara('locacao'));
  set('l-dias', ''); return e.valor_operacao === 2500 && r.redutor_social_usado === 300 ? true : { ok: false, obtido: [e.valor_operacao, r.redutor_social_usado] };
});
// 12 permuta sem torna
t(12, 'Permuta sem torna', 'dado 1.000.000; recebido vazio; contribuinte', 'base 0; total 0; parcela permuta 1.000.000', function () {
  w.abrirAba('permuta'); set('x-val', 1000000); set('x-rec', ''); set('x-nome', 'Construtora Z'); set('x-parte', 'contribuinte'); set('x-tpaga', 0); set('x-trec', 0); set('x-raj', 400000); set('x-cre', 0); set('x-uni', '0'); set('x-nuni', ''); set('x-fr', ''); set('x-data', '2033-06-15'); set('x-din', '0'); set('x-div', '0');
  w.calcPerm(); var h = html_('x-out');
  return h.indexOf('Parcela considerada permuta') > 0 && h.indexOf('1.000.000,00') > 0 && h.indexOf('Construtora Z') > 0 && /Total da opera[^<]*<\/div><div class="v">0,00/.test(h) ? true : { ok: false, obtido: h.slice(0, 300) };
});
// 13 permuta com torna
t(13, 'Permuta com torna recebida 200.000', 'dado 1.000.000; recebido 800.000; torna recebida 200.000', 'base 200.000; IBS 18.700; CBS 9.210; total 27.910', function () {
  set('x-rec', 800000); set('x-trec', 200000); w.calcPerm(); var h = html_('x-out');
  return h.indexOf('27.910,00') > 0 && h.indexOf('18.700,00') > 0 && h.indexOf('200.000,00') > 0 ? true : { ok: false, obtido: h.slice(0, 300) };
});
// 14 permuta por unidades futuras
t(14, 'Permuta por unidades futuras (4 un., fração 0,20)', 'unidades futuras sim; 4; fração 0,20; torna 200.000', 'linha "Resultado por unidade futura (4 un.)" = 6.977,50', function () {
  set('x-uni', '1'); set('x-nuni', 4); set('x-fr', 0.20); w.calcPerm(); var h = html_('x-out');
  return h.indexOf('Resultado por unidade futura (4 un.)') > 0 && h.indexOf('6.977,50') > 0 ? true : { ok: false, obtido: h.slice(0, 300) };
});
// 15 PF não contribuinte
t(15, 'PF não contribuinte', 'receita 100.000; 2 imóveis; 0 alienações; fator 1,15', 'NÃO CONTRIBUINTE + frase padrão', function () {
  w.abrirAba('pf'); set('p-rec', 100000); set('p-recc', 0); set('p-qtd', 2); set('p-ali', 0); set('p-con', 0); set('p-alic', 0); set('p-conc', 0); set('p-fat', 1.15); w.calcPF();
  var tx = texto('p-out'); return tx.indexOf('NÃO CONTRIBUINTE') > 0 && tx.indexOf('não foi identificado enquadramento') > 0 && tx.indexOf('276.000,00') > 0 ? true : { ok: false, obtido: tx.slice(0, 200) };
});
// 16 PF contribuinte
t(16, 'PF contribuinte (receita > limite e > 3 imóveis)', 'receita 300.000; 5 imóveis', 'CONTRIBUINTE; inciso I atingido', function () {
  set('p-rec', 300000); set('p-qtd', 5); w.calcPF(); var tx = texto('p-out');
  return tx.indexOf('CONTRIBUINTE') > 0 && tx.indexOf('NÃO CONTRIBUINTE') < 0 && d.querySelectorAll('#p-out tr.dif').length >= 1 ? true : { ok: false, obtido: tx.slice(0, 200) };
});
// 17 comparativo
t(17, 'Comparativo lado a lado com PIS/COFINS/ISS × IBS/CBS', 'venda 900.000; 3 meses; RAJ 400.000', 'linhas PIS/COFINS, ISS/ICMS, IBS, CBS, Créditos, Total; IBS 37.400 no lado reforma', function () {
  w.abrirAba('comparativo'); set('c-rv', 900000); set('c-rl', 0); set('c-rs', 0); set('c-me', 3); set('c-obj', '1'); set('c-raj', 400000); set('c-tipo', 'residencial_novo'); set('c-iss', 0); w.calcComp();
  var h = html_('c-out'); return ['PIS/COFINS', 'ISS/ICMS', '>IBS<', '>CBS<', 'Créditos', 'Total tributário', 'IRPJ + CSLL', 'Carga efetiva'].every(function (k) { return h.indexOf(k) > 0; }) && h.indexOf('37.400,00') > 0 ? true : { ok: false, obtido: h.slice(0, 200) };
});
// 18 projeção anual
t(18, 'Projeções mensal, anual e 2026-2033 com gráfico', 'mesmo comparativo', 'mensal = total/3; anual = ×12; 8 colunas no gráfico; 2026 = ano-teste', function () {
  var h = html_('c-out'); var cols = d.querySelectorAll('#c-out .grafico .col').length;
  var r = M.calcular({ operacao: 'venda', data_fato_gerador: '2033-06-30', valor_operacao: 900000, imovel: { id: 'CMP', tipo: 'residencial_novo' }, redutor_ajuste_saldo: 400000 }, w.__imobUI.ctxPara('venda'));
  var mensal = RL.money(r.total / 3), anual = RL.money(r.total / 3 * 12);
  return cols === 8 && h.indexOf(mensal) > 0 && h.indexOf(anual) > 0 && h.indexOf('ano-teste') > 0 && h.indexOf('2033') > 0 ? true : { ok: false, obtido: [cols, mensal, anual] };
});
// 19 regime opcional RET
t(19, 'Regime opcional RET 2,08% e comparação com o regime comum', 'RET normal; 1.000.000; 2030; RAJ 600.000', 'total 20.800; tabela opcional × comum; guia comparativa', function () {
  w.abrirAba('opcional'); set('o-reg', 'ret'); w.pintaOpc(); set('o-val', 1000000); set('o-data', '2030-01-15'); set('o-mod', 'normal'); set('o-afe', '1'); set('o-raj', 600000); set('o-cre', 0); w.calcOpc();
  var h = html_('o-out'), g = html_('o-guia'); return h.indexOf('20.800,00') > 0 && h.indexOf('Regime opcional × regime específico comum') > 0 && g.indexOf('3,65%') > 0 && g.indexOf('Prazo para opção') > 0 ? true : { ok: false, obtido: h.slice(0, 200) };
});
// 20 relatórios
t(20, 'Relatórios executivo, técnico e memória são gerados e coerentes', 'venda 900.000 / RAJ 400.000', '3 janelas com HTML; memória mostra 9,3500%; técnico lista premissas', function () {
  w.abrirAba('venda'); set('v-val', 900000); set('v-raj', 400000); set('v-cre', 0); w.calcVenda();
  var out = {};
  ['executivo', 'tecnico', 'memoria'].forEach(function (k) { w.imobRelatorio(k); out[k] = w.__ultimaJanela.document.documentElement.outerHTML; });
  return out.executivo.indexOf('Relatório executivo') > 0 && out.executivo.indexOf('55.820,00') > 0 && out.tecnico.indexOf('Premissas') > 0 && out.tecnico.indexOf('IMOB-ALQ-001') > 0 &&
    out.memoria.indexOf('9,3500%') > 0 && out.memoria.indexOf('Conferência matemática') > 0 && out.memoria.indexOf('✅') > 0 ? true : { ok: false, obtido: Object.keys(out).map(function (k) { return k + ':' + out[k].length; }) };
});
// 21 histórico e comparação
t(21, 'Histórico local com filtros, comparação de duas simulações e CSV', 'simulações registradas nos testes anteriores', 'lista ≥ 2; comparação marca "Total devido" alterado; CSV com cabeçalho', function () {
  w.abrirAba('historico'); set('h-op', 'venda'); set('h-st', 'preliminar'); set('h-emp', ''); set('h-imo', ''); set('h-de', ''); set('h-ate', ''); w.imobHistorico();
  var linhas = d.querySelectorAll('#hi-out tbody tr').length;
  var cb = d.querySelectorAll('.hist-sel'); if (cb.length < 2) return { ok: false, obtido: 'linhas=' + linhas };
  cb[0].checked = true; cb[cb.length - 1].checked = true; w.imobCompararSelecionados();
  var cmp = html_('hi-cmp');
  var csv = RL.exportarCSV(w.__imobUI.sims());
  return linhas >= 2 && cmp.indexOf('Comparação de versões') > 0 && cmp.indexOf('Total devido') > 0 && csv.indexOf('quando;status;empresa') === 1 ? true : { ok: false, obtido: [linhas, cmp.slice(0, 150)] };
});
// 22 cadastro obrigatório/opcional/condicional
t(22, 'Cadastro do imóvel: classificação de campos e validação com correção', 'código vazio + valor negativo', 'badges obrig./opc./cond.; erro no campo certo com orientação', function () {
  w.abrirAba('imovel'); var labs = d.querySelectorAll('#t-imovel label[data-req]'); var tipos = {}; labs.forEach(function (l) { tipos[l.dataset.req] = 1; });
  set('i-cod', ''); set('i-aq', -5); w.calcRaj();
  var v = html_('i-valid'), inval = d.querySelectorAll('#t-imovel .invalido').length;
  set('i-cod', 'AP-1201'); set('i-aq', 300000); w.calcRaj();
  return labs.length >= 20 && tipos.obrigatorio && tipos.opcional && tipos.condicional && v.indexOf('Código interno é obrigatório') > 0 && v.indexOf('não pode ser negativo') > 0 && inval === 2 && html_('raj-out').indexOf('Opções do art. 375') > 0 ? true : { ok: false, obtido: [labs.length, inval, v.slice(0, 200)] };
});
// 23 validação de venda
t(23, 'Validação pré-cálculo na venda (valor zero, data inválida) bloqueia com orientação', 'valor 0; data 2033-02-30', 'nenhum resultado; duas mensagens', function () {
  w.abrirAba('venda'); set('v-val', 0); set('v-data', '2033-02-30'); w.calcVenda(); var v = html_('v-valid'), out = html_('v-out');
  set('v-val', 900000); set('v-data', '2033-06-15'); w.calcVenda();
  return out === '' && v.indexOf('maior que zero') > 0 && v.indexOf('Data do fato gerador') > 0 ? true : { ok: false, obtido: v.slice(0, 200) };
});
// 24 resultado em 12 etapas com fórmula
t(24, 'Resultado da alienação em 12 etapas com fórmula, na ordem do Prompt', 'venda padrão', '12 etapas + carga efetiva 6,2022%', function () {
  var et = d.querySelectorAll('#v-out .seq .et'); var rot = Array.prototype.map.call(et, function (e) { return e.querySelector('.r').textContent; });
  var esperado = ['Valor total da operação', 'Redutor de ajuste disponível', 'Redutor social', 'Base de cálculo (antes dos créditos)', 'IBS calculado', 'CBS calculada', 'Créditos de IBS/CBS informados', 'Créditos efetivamente aproveitados', 'Saldo de créditos não utilizado', 'Total bruto (IBS + CBS)', 'Total líquido a recolher', 'Carga efetiva sobre a operação'];
  var okOrdem = esperado.every(function (x, i) { return rot[i] === x; });
  var formulas = Array.prototype.every.call(et, function (e) { return e.querySelector('.f').textContent.trim().length > 3; });
  return okOrdem && formulas && texto('v-out').indexOf('6,2022%') > 0 ? true : { ok: false, obtido: rot };
});
// 25 navegação preserva dados / erro de aba
t(25, 'Navegação: dados preservados ao trocar de módulo; erro capturado sem quebrar a tela', 'trocar abas; forçar exceção', 'v-val continua 900.000; #imob-erro-aba exibe mensagem', function () {
  set('v-val', 777777); w.abrirAba('pf'); w.abrirAba('regras'); w.abrirAba('venda');
  var preservado = w.__imobUI.parseNum($('v-val').value) === 777777; set('v-val', 900000);
  var orig = w.MotorImob.calcular; w.MotorImob.calcular = function () { throw new Error('falha simulada'); };
  w.calcVenda(); w.MotorImob.calcular = orig;
  var erro = $('imob-erro-aba').style.display !== 'none' && texto('imob-erro-aba').indexOf('falha simulada') > 0;
  w.calcVenda(); var limpo = $('imob-erro-aba').style.display === 'none' && texto('r-out').indexOf('Vigência') > 0;
  return preservado && erro && limpo ? true : { ok: false, obtido: [preservado, erro, limpo] };
});
t('X1', 'Persistência 1.2.0: listarCalculos aceita filtros e devolve entrada/empresa/imóvel/usuário', 'imobRepo.listarCalculos', 'query PostgREST com filtros', function () {
  var q = w.imobRepo.listarCalculos({ escritorio_id: 7, filtros: { operacao: 'venda', de: '2026-01-01', ate: '2026-12-31' } }).caminho;
  return q.indexOf('entrada,empresa_id,imovel_id,calculado_por') > 0 && q.indexOf('entrada->>operacao=eq.venda') > 0 && q.indexOf('calculado_em=gte.2026-01-01') > 0 ? true : { ok: false, obtido: q };
});
t('X2', 'Finalizar sem escritório na sessão não grava e avisa', 'imobFinalizar com APP.escritorioId null', 'aviso "Nada foi gravado"', function () {
  w.imobFinalizar(); return texto('v-out').indexOf('Nada foi gravado') > 0 ? true : { ok: false, obtido: texto('v-out').slice(0, 150) };
});


/* ===== v1.4.0 ===================================================================== */
t('N1', 'Campo de valor vira R$ ao sair e volta a número ao focar', 'v-val = 900000; blur; focus', '"R$ 900.000,00" / "900000" e n() lê os dois', function () {
  w.abrirAba('venda'); var el = $('v-val'); el.value = '900000'; el.dispatchEvent(new w.Event('blur'));
  var fmt = el.value; var lido = w.__imobUI.entradaVenda().valor_operacao;
  el.dispatchEvent(new w.Event('focus')); var foco = el.value; el.dispatchEvent(new w.Event('blur'));
  return fmt === 'R$ 900.000,00' && lido === 900000 && foco === '900000' && w.__imobUI.parseNum('R$ 1.234,56') === 1234.56 && VA.validarVenda({ valor: 'R$ 900.000,00', redutor: 'R$ 0,00', creditos: '', data: '2033-06-15', tipo: 'comercial' }).ok ? true : { ok: false, obtido: [fmt, lido, foco] };
});
t('N2', 'Cadastro PF/PJ: valida CNPJ, salva e avança para o imóvel; PF esconde regime', 'PJ com CNPJ de 14 dígitos', 'passo 1 concluído + aba imóvel; PF oculta cd-regime-box', function () {
  w.abrirAba('cadastro'); set('cd-tipo', 'PJ'); w.imobCadastroTipo(); set('cd-nome', 'Incorporadora Exemplo Ltda'); set('cd-doc', '123'); w.imobSalvarCadastro();
  var erro = html_('cd-valid').indexOf('CNPJ deve ter 14') > 0;
  set('cd-doc', '12345678000199'); set('cd-regime', 'presumido'); set('cd-obj', '1'); w.imobSalvarCadastro();
  var ok = texto('cd-out').indexOf('Passo 1 concluído') > 0 && texto('cd-out').indexOf('12.345.678/0001-99') > 0 && $('t-imovel').style.display === '' && w.__imobUI.pessoa().tipo === 'PJ';
  set('cd-tipo', 'PF'); w.imobCadastroTipo(); var pf = $('cd-regime-box').style.display === 'none'; set('cd-tipo', 'PJ'); w.imobCadastroTipo();
  return erro && ok && pf ? true : { ok: false, obtido: [erro, ok, pf] };
});
t('N3', 'Fluxo guiado: depois do redutor aparecem as opções e "Vender" preenche e calcula', 'calcRaj → imobEscolherOperacao(venda)', 'v-raj = maior opção do art. 375; aba venda calculada', function () {
  w.abrirAba('imovel'); set('i-cod', 'AP-1201'); set('i-tipo', 'residencial_novo'); set('i-sit', 'pronto'); set('i-aq', 300000); set('i-ref', 480000); set('i-fat', 1.4523); w.calcRaj();
  var cards = d.querySelectorAll('#fluxo-out .fluxo .op').length;
  w.imobEscolherOperacao('venda');
  var raj = M.rajValorInicial({ valor_aquisicao: 300000, valor_referencia: 480000, custos_ate_2026: 0, em_construcao_2026: false, adquirido_de_nao_contribuinte_apos_2027: false }, w.__imobUI.ctxPara('venda'));
  var maior = Math.max.apply(null, raj.opcoes.map(function (o) { return o.valor || 0; }));
  return cards >= 5 && w.__imobUI.entradaVenda().redutor_ajuste_saldo === maior && $('t-venda').style.display === '' && html_('v-out').indexOf('Resultado da alienação') > 0 ? true : { ok: false, obtido: [cards, w.__imobUI.entradaVenda().redutor_ajuste_saldo, maior] };
});
t('N4', 'Tabela 2026-2033 em venda, locação e permuta (8 anos; 2033 = resultado de 2033)', 'venda 900.000 / RAJ 400.000 / 2033', '8 linhas; 2033 = 55.820; 2026 ano-teste', function () {
  set('v-val', 900000); set('v-raj', 400000); set('v-cre', 0); set('v-data', '2033-06-15'); w.calcVenda();
  var tv = d.querySelectorAll('#v-out table.anos tbody tr'); var h = html_('v-out');
  w.abrirAba('locacao'); w.calcLoc(); var tl = d.querySelectorAll('#l-out table.anos tbody tr').length;
  w.abrirAba('permuta'); w.calcPerm(); var tp = d.querySelectorAll('#x-out table.anos tbody tr').length;
  return tv.length === 8 && tv[7].textContent.indexOf('55.820,00') > 0 && tv[0].textContent.indexOf('ano-teste') > 0 && h.indexOf('Quanto seria o imposto em cada ano') > 0 && tl === 8 && tp === 8 ? true : { ok: false, obtido: [tv.length, tl, tp] };
});
t('N5', 'Explicações para leigos: ajuda por aba, por campo e "em palavras simples" nas etapas', 'DOM', '≥6 .ajuda, ≥25 .ajuda-campo, 12 .simples na venda', function () {
  var a = d.querySelectorAll('#page-imobiliaria .ajuda').length, c = d.querySelectorAll('#page-imobiliaria .ajuda-campo').length, sp = d.querySelectorAll('#v-out .seq .simples').length;
  return a >= 6 && c >= 25 && sp >= 12 ? true : { ok: false, obtido: [a, c, sp] };
});
t('N6', 'Aba Memória de cálculo mostra o último cálculo com explicação simples e botões de relatório', 'após permuta', 'linha a linha + "Em palavras simples" + 5 botões', function () {
  w.abrirAba('memoria'); var h = html_('mem-out');
  return h.indexOf('Em palavras simples') > 0 && h.indexOf('Permuta de') > 0 && d.querySelectorAll('#mem-out .rel-botoes button').length === 5 && h.indexOf('Resultado passo a passo') > 0 ? true : { ok: false, obtido: h.slice(0, 200) };
});
t('N7', 'Resumo para o cliente e relatórios por operação (locação e permuta)', 'imobRelatorio(simplificado, locacao) etc.', 'HTML com "Resumo para o cliente", nome do cadastro, tabela de anos', function () {
  var out = {};
  w.imobRelatorio('simplificado', 'locacao'); out.s = w.__ultimaJanela.document.documentElement.outerHTML;
  w.imobRelatorio('tecnico', 'permuta'); out.t = w.__ultimaJanela.document.documentElement.outerHTML;
  w.imobRelatorio('executivo', 'venda'); out.e = w.__ultimaJanela.document.documentElement.outerHTML;
  return out.s.indexOf('Resumo para o cliente') > 0 && out.s.indexOf('aluguel') > 0 && out.s.indexOf('Incorporadora Exemplo Ltda') > 0 && out.s.indexOf('12.345.678/0001-99') > 0 && out.s.indexOf('Quanto seria o imposto em cada ano') > 0 &&
    out.t.indexOf('Permuta de bens imóveis') > 0 && out.e.indexOf('Quanto seria o imposto em cada ano') > 0 ? true : { ok: false, obtido: [out.s.length, out.t.length, out.e.length] };
});

t('E1', 'toda classe realmente renderizada tem CSS no módulo ou no índice', 'DOM após os testes', 'nenhuma classe órfã', function () {
  var css = w.ImobEstilo.CSS + fs.readFileSync(path.join(RAIZ, 'imobiliaria.html'), 'utf8');
  var usadas = {}; d.querySelectorAll('#page-imobiliaria [class]').forEach(function (el) { String(el.className).split(/\s+/).forEach(function (c) { if (c) usadas[c] = 1; }); });
  var orf = Object.keys(usadas).filter(function (c) { return css.indexOf('.' + c) < 0; });
  return orf.length ? { ok: false, obtido: orf } : true;
});

/* ===== resultado ================================================================= */
fs.writeFileSync(path.join(__dirname, 'relatorio_imob_v140.json'), JSON.stringify({ versao: w.ModulosInfo.imobiliario.versao, quando: new Date().toISOString(), total: total, falhas: falhas, testes: registro }, null, 1));
console.log('\n' + (total - falhas) + '/' + total + ' testes OK — relatório em tests/relatorio_imob_v140.json');
process.exit(falhas ? 1 : 0);   // o timer diário do inventário manteria o processo vivo
