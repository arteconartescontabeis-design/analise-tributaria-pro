/* --- UI da aba Análise Imobiliária — módulo v1.4.0 (14/09/2026) ---
 * O motorImob (lacre c287341e) é consumido, nunca alterado. Tudo que muda
 * aqui é apresentação, validação, premissas, relatórios e histórico.      */
(function(){
  'use strict';

var M = MotorImob;
var PR = raizGlobal().ImobPremissas, VA = raizGlobal().ImobValidacao, RL = raizGlobal().ImobRelatorios;
function raizGlobal(){ return typeof globalThis !== 'undefined' ? globalThis : window; }

/* ---------- premissas: estado persistido no navegador ---------- */
var PREM = PR.novoEstado();
try { var salvo = localStorage.getItem('atp_imob_premissas'); if (salvo) PREM = JSON.parse(salvo) || {}; } catch (e) {}
function salvarPremissas(){ try { localStorage.setItem('atp_imob_premissas', JSON.stringify(PREM)); } catch (e) {} }
function ctxPara(operacao, extras){ return PR.montarCtx(PREM, operacao, extras); }
var CTX = ctxPara('venda');   // compatibilidade com trechos que leem CTX diretamente

function $(id){ return document.getElementById(id); }
function parseNum(str){
  var t = String(str == null ? '' : str).replace(/R\$|\s/g, '');
  if (t === '') return null;
  if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
  var v = parseFloat(t); return isFinite(v) ? v : NaN;
}
function n(id){ var el = $(id); if (!el) return 0; var v = parseNum(el.value); return v == null || isNaN(v) ? 0 : v; }
function nOuNulo(id){ var el = $(id); if (!el) return null; var v = parseNum(el.value); return v == null || isNaN(v) ? null : v; }
/* campos monetários: mostram R$ 1.234,56 quando o usuário sai do campo e voltam ao número puro ao editar */
function fmtMoneyInput(el){ var v = parseNum(el.value); if (v == null || isNaN(v)) { if (String(el.value).trim() !== '') return; el.value = ''; return; } el.dataset.num = v; el.value = 'R$ ' + money(v); }
function ligarMoney(){
  document.querySelectorAll('#page-imobiliaria input.money').forEach(function(el){
    if (el.dataset.money) { fmtMoneyInput(el); return; } el.dataset.money = '1';
    el.addEventListener('focus', function(){ var v = parseNum(el.value); if (v != null && !isNaN(v)) el.value = String(v).replace('.', ','); el.select && el.select(); });
    el.addEventListener('blur', function(){ fmtMoneyInput(el); });
    fmtMoneyInput(el);
  });
}
function txt(id){ return (($(id)||{}).value || '').trim(); }
var money = RL.money, pct = RL.pct, esc = RL.esc;
function hojeISO(){ var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function versaoApp(){ return (window.ModulosInfo && ModulosInfo.imobiliario && ModulosInfo.imobiliario.versao) || '?'; }
function usuarioAtual(){ return (window.APP && APP.user && APP.user.email) || null; }

/* ---------- carregamento e erros de aba ---------- */
function carregando(on){ var el = $('imob-carregando'); if (el) el.style.display = on ? '' : 'none'; }
function erroAba(msg){
  var el = $('imob-erro-aba'); if (!el) return;
  el.style.display = msg ? '' : 'none';
  el.innerHTML = msg ? '<div class="aviso err"><b>Erro na tela:</b> ' + esc(msg) + ' <span class="mini">Os dados digitados foram preservados; tente novamente ou troque de m&oacute;dulo.</span></div>' : '';
}
/* Executa uma ação de tela com indicador de carregamento e captura de erro. */
function acao(fn){
  carregando(true); erroAba(null);
  try { fn(); } catch (e) { console.error('[imob]', e); erroAba(e && e.message ? e.message : String(e)); }
  finally { carregando(false); }
}

/* ---------- validação ligada à tela ---------- */
function limparInvalidos(){ document.querySelectorAll('#page-imobiliaria .invalido').forEach(function(x){ x.classList.remove('invalido'); }); }
function mostrarValidacao(alvoId, v){
  limparInvalidos();
  var alvo = $(alvoId); if (!alvo) return v.ok;
  var h = '';
  if (v.erros.length) {
    h += '<div class="aviso err valid"><b>O c&aacute;lculo n&atilde;o foi realizado.</b> Corrija:<ul style="margin:6px 0 0 18px">' +
      v.erros.map(function(e){ var el = $(e.campo); if (el) el.classList.add('invalido'); return '<li>' + esc(e.msg) + '</li>'; }).join('') + '</ul></div>';
  }
  if (v.avisos.length) h += '<div class="aviso valid"><b>Aten&ccedil;&atilde;o:</b><ul style="margin:6px 0 0 18px">' + v.avisos.map(function(a){ return '<li>' + esc(a.msg) + '</li>'; }).join('') + '</ul></div>';
  alvo.innerHTML = h;
  return v.ok;
}

/* ---------- abas ---------- */
var ABAS = ['cadastro','memoria','imovel','inventario','venda','locacao','permuta','opcional','comparativo','pf','auditoria','historico','regras','premissas'];
function abrirAba(k){
  document.querySelectorAll('#imob-tabs .tab').forEach(function(x){ x.classList.toggle('on', x.dataset.t === k); });
  ABAS.forEach(function(a){ var p = $('t-'+a); if (p) p.style.display = (a === k) ? '' : 'none'; });
  acao(function(){
    if (k === 'regras') pintaRegras();
    if (k === 'auditoria') rodarAuditoria();
    if (k === 'historico') imobHistorico();
    if (k === 'inventario') { atualizarDatasInventario(); imobInventario(); }
    if (k === 'opcional') { if (!$('o-campos').innerHTML) pintaOpc(); pintaGuiaOpc(); }
    if (k === 'premissas') pintaPremissas();
    if (k === 'memoria') imobMemoriaAba();
    if (k === 'cadastro') imobCadastroTipo();
    if (k === 'opcional' || k === 'venda' || k === 'locacao' || k === 'permuta' || k === 'comparativo') ligarMoney();
  });
}
function ligarAbas(){
  document.querySelectorAll('#imob-tabs .tab').forEach(function(t){
    t.onclick = function(){ abrirAba(t.dataset.t); };
    t.tabIndex = 0; t.onkeydown = function(ev){ if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrirAba(t.dataset.t); } };
  });
}

/* ---------- selo, grau de certeza, memória ---------- */
function imobSelo(){
  var v = M.lacreVerificar();
  return '<div class="selo"><span class="badge ' + (v.integro?'b-ok':'b-err') + '">' + (v.integro ? 'motor íntegro' : 'MOTOR VIOLADO') + '</span>' +
    '<span>motorImob ' + v.motor_versao + ' · ruleset ' + M.RULESET_VERSAO + ' · selo <code>' + v.hash_atual + '</code> · app v' + esc(versaoApp()) + '</span></div>';
}
function imobGrau(res, operacao){
  var g = PR.grauCerteza(PREM, res, M.RULESET_VERSAO), ex = PR.explicar(PREM, operacao);
  var edit = PR.alteradas(PREM);
  return '<div class="grau"><div class="titulo">Grau de certeza: <span class="n-' + g.nivel + '">' + g.nivel + '</span>' +
    '<span class="badge b-info">al&iacute;quotas ' + (edit.length ? 'SIMULA&Ccedil;&Atilde;O' : 'ESTIMADAS') + '</span></div>' +
    g.avisos.map(function(a){ return '<div class="alerta' + (a.tipo === 'editada' ? ' edit' : '') + '">&#9888;&#65039; ' + esc(a.msg) + '</div>'; }).join('') +
    '<div class="meta"><span>Origem da al&iacute;quota: <b>' + esc(PR.CATALOGO.ibs_padrao.origem) + '</b></span>' +
    '<span>Data da premissa: <b>' + esc(PR.CATALOGO.ibs_padrao.data) + '</b></span>' +
    '<span>Status: <b>estimada</b> (IBS/CBS) · <b>ativa</b> (redu&ccedil;&otilde;es e redutores) · <b>pendente</b> (&iacute;ndices)</span>' +
    '<span>Ruleset: <b>' + esc(M.RULESET_VERSAO) + '</b> · motor <b>' + esc(M.MOTOR_IMOB_VERSAO) + '</b></span>' +
    '<span>IBS ' + pct(ex.ibs_padrao,2) + ' → <b>' + pct(ex.ibs_final,4) + '</b> · CBS ' + pct(ex.cbs_padrao,2) + ' → <b>' + pct(ex.cbs_final,4) + '</b> (redu&ccedil;&atilde;o ' + ex.reducao_pct + '%)</span>' +
    (edit.length ? '<span>Editadas: ' + edit.map(function(p){ return '<span class="badge b-edit">' + esc(p.rotulo) + '</span>'; }).join(' ') + ' <a href="#" onclick="abrirAba(\'premissas\');return false">ver premissas</a></span>' : '') +
    '</div></div>';
}
function fmtEntrada(k, v){
  if (typeof v !== 'number') return esc(String(v));
  return /aliquota|padrao|fator|proporcao|fracao|meses/.test(k) ? String(v).replace('.', ',') : money(v);
}
function imobMemoria(res, operacao){
  var ex = PR.explicar(PREM, operacao || 'venda');
  var h = '<div class="card"><h2>Mem&oacute;ria de c&aacute;lculo e fundamenta&ccedil;&atilde;o por linha</h2><table><thead><tr>' +
    '<th style="width:26px">#</th><th>Linha</th><th>F&oacute;rmula</th><th class="num">Valor</th><th style="width:30%">Fundamento</th></tr></thead><tbody>';
  res.linhas.forEach(function(l){
    var st = l.regra_status === 'homologada' ? 'b-ok' : 'b-warn';
    var ehAlq = l.ibs_reduzida != null;
    var valorCel, entradaTxt;
    if (ehAlq) {
      // v1.3.0: linha de alíquota mostra PERCENTUAIS, nunca R$ 0,00
      valorCel = '<div>IBS <b>' + pct(l.ibs_reduzida,4) + '</b></div><div>CBS <b>' + pct(l.cbs_reduzida,4) + '</b></div>';
      entradaTxt = 'IBS padr&atilde;o ' + pct(ex.ibs_padrao,2) + ' · CBS padr&atilde;o ' + pct(ex.cbs_padrao,2) + ' · redu&ccedil;&atilde;o ' + ex.reducao_pct + '%' +
        (ex.editadas.length && ex.reducao_pct !== l.ibs_reduzida ? '' : '') +
        (PR.alteradas(PREM).some(function(p){ return /reducao|padrao/.test(p.chave); }) ? ' <span class="badge b-edit">premissa editada — original: ' + pct(PR.CATALOGO.ibs_padrao.valor,2) + ' / ' + pct(PR.CATALOGO.cbs_padrao.valor,2) + ' com ' + (operacao === 'locacao' ? 70 : 50) + '%</span>' : '') +
        ' · classifica&ccedil;&atilde;o ' + esc(l.classificacao);
    } else {
      valorCel = '<b>' + money(l.valor) + '</b>';
      entradaTxt = l.entrada ? Object.keys(l.entrada).map(function(k){ return k.replace(/_/g,' ') + ': ' + fmtEntrada(k, l.entrada[k]); }).join(' · ') : '';
    }
    h += '<tr><td class="mini">' + l.ordem + '</td><td><b>' + esc(l.descricao) + '</b>' + (entradaTxt ? '<div class="mini">' + entradaTxt + '</div>' : '') +
      '</td><td class="mini">' + esc(l.formula||'') + '</td><td class="num">' + valorCel + '</td>' +
      '<td class="fund">' + (l.fundamentos||[]).map(esc).join('<br>') +
      '<div style="margin-top:4px"><span class="badge ' + st + '">' + esc(l.regra_id) + ' v' + esc(l.regra_versao) + ' · ' + esc(l.regra_status) + '</span></div></td></tr>';
  });
  h += '</tbody></table>';
  if (res.notas && res.notas.length) h += '<div style="margin-top:14px">' + res.notas.map(function(x){ return '<div class="info">' + esc(x) + '</div>'; }).join('') + '</div>';
  var co = RL.coerencia(res, ex);
  h += '<div class="' + (co.ok ? 'aviso ok' : 'aviso err') + '" style="margin-top:12px"><b>' + (co.ok ? '&#10004; Confer&ecirc;ncia matem&aacute;tica: ' : '&#10008; DIVERG&Ecirc;NCIA: ') + '</b>' +
    co.checks.length + ' verifica&ccedil;&otilde;es entre mem&oacute;ria, al&iacute;quotas, bases e resultado — ' + (co.ok ? 'todas coerentes.' : co.checks.filter(function(c){ return !c.ok; }).map(function(c){ return esc(c.item); }).join('; ')) + '</div>';
  h += imobSelo() + '</div>';
  return h;
}
function imobBloqueio(res){
  return '<div class="card"><h2>C&aacute;lculo bloqueado</h2><div class="aviso err">' + esc(res.mensagem) + '</div>' +
    '<table><thead><tr><th style="width:70px">C&oacute;digo</th><th>Motivo</th></tr></thead><tbody>' +
    res.bloqueios.map(function(b){ return '<tr><td><span class="badge b-err">' + esc(b.codigo) + '</span></td><td>' + esc(b.msg) + '</td></tr>'; }).join('') +
    '</tbody></table><div class="mini" style="margin-top:10px">Nenhuma estimativa foi produzida &mdash; o motor n&atilde;o preenche lacuna sozinho.</div>' + imobSelo() + '</div>';
}
function imobSequencial(titulo, etapas){
  return '<div class="card"><h2>' + titulo + '</h2><div class="seq">' + etapas.map(function(x){
    return '<div class="et' + (x.principal ? ' principal' : x.destaque ? ' destaque' : '') + '"><div class="n">' + x.n + '</div><div class="r">' + esc(x.rotulo) + '</div>' +
      '<div class="v">' + (x.texto != null ? esc(x.texto) : money(x.valor)) + '</div><div class="f">' + esc(x.formula || '') + (x.extra ? '<br>' + esc(x.extra) : '') + '</div>' + (x.simples ? '<div class="simples">' + esc(x.simples) + '</div>' : '') + '</div>'; }).join('') + '</div></div>';
}

/* ---------- cadastro do imóvel ---------- */
var IMOVEL = {};
function lerImovel(){
  IMOVEL = { codigo_interno: txt('i-cod'), empresa: txt('i-emp'), matricula: txt('i-mat'), endereco: txt('i-end'), municipio: txt('i-mun'),
    uf: txt('i-uf').toUpperCase(), tipo: txt('i-tipo'), lote_unidade_bloco: txt('i-lote'),
    area_total: nOuNulo('i-atot'), area_construida: nOuNulo('i-acon'), fracao_ideal: nOuNulo('i-frac'),
    situacao: txt('i-sit'), data_aquisicao: txt('i-daq') || null, data_conclusao: txt('i-dcon') || null,
    valor_aquisicao: nOuNulo('i-aq'), custos_construcao: nOuNulo('i-cst'), valor_referencia: nOuNulo('i-ref'),
    valor_referencia_origem: txt('i-reforig') || null, valor_referencia_data: txt('i-refdata') || null,
    fator_ate_2026: nOuNulo('i-fat'), documentos: txt('i-doc'), observacoes: txt('i-obs') };
  try { localStorage.setItem('atp_imob_imovel', JSON.stringify(IMOVEL)); } catch (e) {}
  return IMOVEL;
}
function imovelParaEntrada(){
  var im = IMOVEL.codigo_interno ? IMOVEL : lerImovel();
  return { id: im.codigo_interno || 'IM-1', codigo_interno: im.codigo_interno, tipo: txt('v-tipo') || im.tipo, matricula: im.matricula || undefined,
           municipio: im.municipio || undefined, uf: im.uf || undefined, empresa: im.empresa || undefined, area_total: im.area_total || undefined };
}
function imobLimparImovel(){
  ['i-cod','i-emp','i-mat','i-end','i-mun','i-uf','i-lote','i-atot','i-acon','i-frac','i-daq','i-dcon','i-aq','i-cst','i-ref','i-refdata','i-doc','i-obs'].forEach(function(id){ var el = $(id); if (el) el.value = ''; });
  $('i-fat').value = PR.valorVigente(PREM, 'fator_ate_2026'); $('i-reforig').value = ''; $('i-valid').innerHTML = ''; $('raj-out').innerHTML = ''; limparInvalidos();
  IMOVEL = {}; IMOB_IMOVEL_ID = null; try { localStorage.removeItem('atp_imob_imovel'); } catch (e) {}
}

var RAJ = null, RAJ_ESCOLHA = null;
function calcRaj(){ acao(function(){
  var im = lerImovel();
  var v = VA.validarImovel({ codigo: im.codigo_interno, tipo: im.tipo, situacao: im.situacao, valor_aquisicao: im.valor_aquisicao, valor_referencia: im.valor_referencia,
    custos: im.custos_construcao, area_total: im.area_total, area_construida: im.area_construida, fracao_ideal: im.fracao_ideal, fator: im.fator_ate_2026,
    data_aquisicao: im.data_aquisicao, data_conclusao: im.data_conclusao, ref_origem: im.valor_referencia_origem, ref_data: im.valor_referencia_data, uf: im.uf });
  if (!mostrarValidacao('i-valid', v)) { $('raj-out').innerHTML = ''; return; }
  var sit = im.situacao;
  var e = { valor_aquisicao: im.valor_aquisicao, valor_referencia: im.valor_referencia > 0 ? im.valor_referencia : undefined,
            custos_ate_2026: im.custos_construcao || 0, em_construcao_2026: sit === 'construcao',
            adquirido_de_nao_contribuinte_apos_2027: sit === 'pos2027', data_aquisicao: im.data_aquisicao || undefined };
  var c = ctxPara('venda'); c.indices.fator_ate_2026 = im.fator_ate_2026 || c.indices.fator_ate_2026;
  RAJ = M.rajValorInicial(e, c); RAJ_ESCOLHA = null;
  var h = '<div class="card"><h2>Op&ccedil;&otilde;es do art. 375 &mdash; hip&oacute;tese ' + esc(RAJ.hipotese) + '</h2>';
  if (RAJ.bloqueios.length) h += RAJ.bloqueios.map(function(b){ return '<div class="aviso err"><b>' + esc(b.codigo) + '</b> ' + esc(b.msg) + '</div>'; }).join('');
  h += '<div class="grid g2">' + RAJ.opcoes.map(function(o,i){
    if (o.valor === null) return '<div class="opt off"><b>' + esc(o.rotulo) + '</b><div class="v">indispon&iacute;vel</div><div class="mini">' + esc(o.nota||'') + '</div><div class="fund" style="margin-top:6px">' + esc(o.fundamento) + '</div></div>';
    return '<div class="opt" id="opt' + i + '" onclick="escolher(' + i + ')"><b>' + esc(o.rotulo) + '</b><div class="v">' + money(o.valor) + '</div>' +
      (o.detalhe ? '<div class="mini">' + Object.keys(o.detalhe).map(function(k){ return k.replace(/_/g,' ') + ': ' + fmtEntrada(k, o.detalhe[k]); }).join(' · ') + '</div>' : '') +
      '<div class="fund" style="margin-top:6px">' + esc(o.fundamento) + '</div></div>'; }).join('') + '</div>';
  h += '<div class="info" style="margin-top:14px">' + esc(RAJ.recomendacao_neutra || '') + ' Constitui&ccedil;&atilde;o em <b>' + esc(RAJ.data_constituicao || '—') + '</b>.</div>';
  h += '<div id="just" style="display:none;margin-top:14px"><label>Justificativa da escolha (obrigat&oacute;ria e definitiva)</label>' +
       '<input id="just-txt" placeholder="por que esta op&ccedil;&atilde;o foi escolhida"> ' +
       '<button class="btn pri" style="margin-top:10px" onclick="gravarEscolha()">Gravar escolha</button> <button class="btn" style="margin-top:10px" onclick="imobSalvarImovel()">Salvar im&oacute;vel no banco</button></div>';
  h += '<div id="just-ok"></div>' + imobSelo() + '</div>';
  $('raj-out').innerHTML = h;
  if (!RAJ.bloqueios.length) pintaFluxo(); else $('fluxo-out').innerHTML = '';
}); }
function escolher(i){
  RAJ_ESCOLHA = i; pintaFluxo();
  RAJ.opcoes.forEach(function(_,k){ var el = $('opt'+k); if (el) el.classList.toggle('sel', k === i); });
  $('just').style.display = '';
}
function gravarEscolha(){
  var alvo = $('just-ok'), j = txt('just-txt');
  if (!j) { alvo.innerHTML = '<div class="aviso">A escolha do art. 375 exige justificativa gravada.</div>'; return; }
  if (RAJ_ESCOLHA === null || !RAJ || !RAJ.opcoes) { alvo.innerHTML = '<div class="aviso">Escolha uma das op&ccedil;&otilde;es antes de gravar.</div>'; return; }
  var o = RAJ.opcoes[RAJ_ESCOLHA];
  var sem = imobSemBanco(); if (sem) { alvo.innerHTML = sem; return; }
  if (!IMOB_IMOVEL_ID) {
    alvo.innerHTML = '<div class="aviso"><b>Im&oacute;vel ainda n&atilde;o gravado.</b> A escolha do art. 375 se prende a um im&oacute;vel: clique em <b>Salvar im&oacute;vel no banco</b> primeiro e depois grave a escolha. <b>Nada foi gravado agora.</b></div>';
    return;
  }
  alvo.innerHTML = '<div class="info">Gravando a escolha&hellip;</div>';
  imobDB.exercerOpcao258(IMOB_IMOVEL_ID, o.chave, j, imobCtxDB({ saldo_inicial: o.valor }))
    .then(function(){
      $('v-raj').value = o.valor;
      alvo.innerHTML = '<div class="card" style="margin-top:14px;border-color:var(--primary)"><span class="badge b-ok">op&ccedil;&atilde;o exercida e GRAVADA</span> <b>' + esc(o.rotulo) + '</b> &mdash; ' + money(o.valor) +
        '<div class="mini" style="margin-top:6px">Justificativa: ' + esc(j) + '</div><div class="mini">Constitui&ccedil;&atilde;o: ' + esc(RAJ.data_constituicao) + ' · saldo inicial do redutor: ' + money(o.valor) + '</div>' +
        '<div class="mini">Im&oacute;vel <code>' + esc(IMOB_IMOVEL_ID) + '</code> em <code>atp_imob_imoveis</code>.</div>' +
        '<div class="aviso" style="margin-top:10px">A trigger <code>atp_imob_trava_opcao_raj</code> passa a impedir troca desta op&ccedil;&atilde;o sem retifica&ccedil;&atilde;o formal.</div></div>';
    })
    .catch(function(e){ alvo.innerHTML = imobAvisoDB('<b>N&atilde;o gravado</b> &mdash; ' + esc(e.erro || e.message || e) + ' <code>' + esc(e.codigo || '') + '</code>'); });
}

/* ---------- histórico local de simulações ---------- */
var SIMS = [];
function chaveSims(){ return 'atp_imob_sims:' + (IMOB_CTX_DB.escritorio_id || 'local'); }
function carregarSims(){ try { SIMS = JSON.parse(localStorage.getItem(chaveSims()) || '[]') || []; } catch (e) { SIMS = []; } }
function gravarSims(){ try { localStorage.setItem(chaveSims(), JSON.stringify(SIMS.slice(0, 200))); } catch (e) {} }
function registrarSimulacao(e, res, operacaoRotulo, extra){
  if (!res || res.status !== 'CALCULADO') return null;
  var lAlq = (res.linhas||[]).filter(function(l){ return l.ibs_reduzida != null; })[0] || {};
  var s = { id: 'sim-' + Date.now() + '-' + Math.random().toString(16).slice(2,6), quando: new Date().toISOString(), status: 'preliminar',
    usuario: usuarioAtual(), empresa: (PESSOA.nome || IMOVEL.empresa || (window.EMP_GLOBAL && EMP_GLOBAL.nome) || null),
    imovel: (e.imovel && (e.imovel.codigo_interno || e.imovel.id)) || null, operacao: e.operacao, rotulo: operacaoRotulo,
    entrada: e, resultado: { base: res.base, ibs: res.ibs, cbs: res.cbs, creditos: res.creditos, debito: res.debito, total: res.total,
      aliquota_efetiva_sobre_operacao: res.aliquota_efetiva_sobre_operacao, redutor_ajuste_usado: res.redutor_ajuste_usado,
      redutor_social_usado: res.redutor_social_usado, redutor_ajuste_recebido: res.redutor_ajuste_recebido,
      confianca: res.confianca, carimbo: res.carimbo, linhas: lAlq.ibs_reduzida != null ? [{ descricao: lAlq.descricao, ibs_reduzida: lAlq.ibs_reduzida, cbs_reduzida: lAlq.cbs_reduzida, valor: 0 }] : [] },
    premissas: PR.alteradas(PREM).length ? PR.alteradas(PREM).map(function(p){ return { chave: p.chave, valor: p.valor_vigente, original: p.valor_automatico, justificativa: p.justificativa }; }) : null,
    extra: extra || null };
  carregarSims(); SIMS.unshift(s); gravarSims();
  return s;
}
var ULTIMO = { venda: null, locacao: null, permuta: null };


/* ---------- cadastro da pessoa (PF ou PJ) ---------- */
var PESSOA = {};
try { var pz = localStorage.getItem('atp_imob_pessoa'); if (pz) PESSOA = JSON.parse(pz) || {}; } catch (e) {}
function imobCadastroTipo(){
  var pf = txt('cd-tipo') === 'PF';
  if ($('cd-regime-box')) $('cd-regime-box').style.display = pf ? 'none' : '';
  if ($('cd-obj-box')) $('cd-obj-box').style.display = pf ? 'none' : '';
}
function lerPessoa(){
  PESSOA = { tipo: txt('cd-tipo'), nome: txt('cd-nome'), documento: txt('cd-doc').replace(/\D/g, ''), regime: txt('cd-tipo') === 'PF' ? null : txt('cd-regime'),
             atividade_imobiliaria_no_objeto: txt('cd-tipo') === 'PF' ? null : txt('cd-obj') === '1', email: txt('cd-email'), telefone: txt('cd-fone'), municipio: txt('cd-mun') };
  try { localStorage.setItem('atp_imob_pessoa', JSON.stringify(PESSOA)); } catch (e) {}
  return PESSOA;
}
function docFormatado(d){ d = String(d || '').replace(/\D/g, ''); if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'); return d; }
function imobSalvarCadastro(){ acao(function(){
  var p = lerPessoa(), erros = [];
  if (!p.nome) erros.push({ campo: 'cd-nome', msg: 'Informe o nome (pessoa física) ou a razão social (empresa).' });
  if (p.tipo === 'PF' && p.documento.length !== 11) erros.push({ campo: 'cd-doc', msg: 'CPF deve ter 11 números.' });
  if (p.tipo === 'PJ' && p.documento.length !== 14) erros.push({ campo: 'cd-doc', msg: 'CNPJ deve ter 14 números.' });
  if (!mostrarValidacao('cd-valid', { ok: !erros.length, erros: erros, avisos: [] })) return;
  if ($('i-emp') && !txt('i-emp')) $('i-emp').value = p.nome;
  if ($('c-obj') && p.tipo === 'PJ') $('c-obj').value = p.atividade_imobiliaria_no_objeto ? '1' : '0';
  $('cd-out').innerHTML = '<div class="card"><span class="passo-ok">&#10004; Passo 1 conclu&iacute;do</span> <b>' + esc(p.nome) + '</b> · ' + esc(docFormatado(p.documento)) + ' · ' + (p.tipo === 'PF' ? 'pessoa f&iacute;sica' : 'empresa no ' + esc({ presumido: 'Lucro Presumido', real: 'Lucro Real', simples: 'Simples Nacional' }[p.regime] || p.regime)) +
    (p.tipo === 'PF' ? '<div class="ajuda" style="margin-top:10px">Pessoa f&iacute;sica: antes de calcular venda ou aluguel, confira na aba <b>Pessoa f&iacute;sica</b> se voc&ecirc; realmente &eacute; contribuinte. Na maioria dos casos, n&atilde;o &eacute; &mdash; e ent&atilde;o n&atilde;o h&aacute; IBS/CBS a pagar.</div>' : '') + '</div>';
  abrirAba('imovel');
}); }
function imobLimparCadastro(){ ['cd-nome','cd-doc','cd-email','cd-fone','cd-mun'].forEach(function(id){ $(id).value = ''; }); $('cd-valid').innerHTML = ''; $('cd-out').innerHTML = ''; PESSOA = {}; try { localStorage.removeItem('atp_imob_pessoa'); } catch (e) {} }

/* ---------- fluxo guiado: depois do imóvel, o que calcular? ---------- */
var FLUXO_OPS = [
  { op: 'venda', ic: '&#128176;', t: 'Vender o im&oacute;vel', d: 'IBS/CBS sobre o pre&ccedil;o menos os redutores, com 50% de desconto na al&iacute;quota.' },
  { op: 'locacao', ic: '&#128273;', t: 'Alugar o im&oacute;vel', d: 'Imposto sobre o aluguel, com 70% de desconto e R$ 600/m&ecirc;s a menos no residencial.' },
  { op: 'permuta', ic: '&#128260;', t: 'Trocar por outro im&oacute;vel', d: 'A troca n&atilde;o paga; s&oacute; a torna (dinheiro que iguala os valores).' },
  { op: 'opcional', ic: '&#9878;&#65039;', t: 'Regimes opcionais', d: 'RET, loteamento e contratos antigos: percentual fixo sobre a receita.' },
  { op: 'comparativo', ic: '&#128202;', t: 'Comparar hoje &times; Reforma', d: 'Quanto muda em rela&ccedil;&atilde;o a PIS/COFINS/ISS, ano a ano at&eacute; 2033.' },
  { op: 'pf', ic: '&#128100;', t: 'Sou pessoa f&iacute;sica: preciso pagar?', d: 'Verifica os limites de aluguel e de vendas do art. 251.' }
];
function pintaFluxo(){
  var alvo = $('fluxo-out'); if (!alvo) return;
  var raj = rajEscolhido();
  alvo.innerHTML = '<div class="card"><h2>Passo 3 &mdash; O que voc&ecirc; quer calcular com este im&oacute;vel?</h2>' +
    '<div class="mini">Redutor de ajuste que ser&aacute; usado: <b>' + money(raj.valor) + '</b> (' + esc(raj.rotulo) + '). Os dados do im&oacute;vel j&aacute; v&atilde;o preenchidos; ao calcular, os relat&oacute;rios ficam dispon&iacute;veis.</div>' +
    '<div class="fluxo">' + FLUXO_OPS.filter(function(o){ return o.op !== 'pf' || (PESSOA.tipo === 'PF'); }).map(function(o){ return '<div class="op" onclick="imobEscolherOperacao(\'' + o.op + '\')"><div class="ic">' + o.ic + '</div><b>' + o.t + '</b><div class="d">' + o.d + '</div></div>'; }).join('') + '</div></div>';
}
function rajEscolhido(){
  if (!RAJ || !RAJ.opcoes) return { valor: n('v-raj'), rotulo: 'informado' };
  if (RAJ_ESCOLHA !== null && RAJ.opcoes[RAJ_ESCOLHA] && RAJ.opcoes[RAJ_ESCOLHA].valor != null) return RAJ.opcoes[RAJ_ESCOLHA];
  var disp = RAJ.opcoes.filter(function(o){ return o.valor != null; }).sort(function(a,b){ return b.valor - a.valor; });
  return disp[0] ? { valor: disp[0].valor, rotulo: disp[0].rotulo + ' (maior op&ccedil;&atilde;o dispon&iacute;vel)' } : { valor: 0, rotulo: 'nenhuma op&ccedil;&atilde;o dispon&iacute;vel' };
}
function imobEscolherOperacao(op){ acao(function(){
  var raj = rajEscolhido(), tipo = txt('i-tipo');
  if (op === 'venda') { $('v-raj').value = raj.valor; $('v-tipo').value = tipo; if (!(n('v-val') > 0)) $('v-val').value = nOuNulo('i-ref') || nOuNulo('i-aq') || 0; }
  if (op === 'permuta') { $('x-raj').value = raj.valor; if (!(n('x-val') > 0)) $('x-val').value = nOuNulo('i-ref') || nOuNulo('i-aq') || 0; }
  if (op === 'comparativo') { $('c-raj').value = raj.valor; $('c-tipo').value = tipo === 'terreno' ? 'comercial' : tipo; if (PESSOA.tipo === 'PJ') $('c-obj').value = PESSOA.atividade_imobiliaria_no_objeto ? '1' : '0'; }
  abrirAba(op); ligarMoney();
  var f = { venda: calcVenda, locacao: calcLoc, permuta: calcPerm, comparativo: calcComp, pf: calcPF }[op];
  if (f) f();
  var t = $('t-' + op); if (t && t.scrollIntoView) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
}); }

/* ---------- valor do imposto em cada ano 2026-2033 ---------- */
function calcularAnos(e, ctx){
  var c = {}; for (var k in ctx) c[k] = ctx[k]; c.transicao = TRANSICAO;
  var pr = M.projetarTransicao(e, c);
  if (pr.status !== 'CALCULADO') return null;
  return pr.anos.map(function(a){ return { ano: a.ano, ibs: TRANSICAO[a.ano].ibs, cbs: TRANSICAO[a.ano].cbs, classificacao: TRANSICAO[a.ano].classificacao, total: a.total, ano_teste: a.ano === 2026 }; });
}
function imobAnosHTML(anos, e){
  if (!anos) return '';
  var max = Math.max.apply(null, anos.map(function(a){ return a.total; }));
  return '<div class="card"><h2>Quanto seria o imposto em cada ano (2026 a 2033)</h2><div class="ajuda">A Reforma entra em vigor aos poucos: 2026 &eacute; ano-teste (al&iacute;quota simb&oacute;lica de 1%), em 2027 entra a CBS e o IBS sobe todo ano at&eacute; 2033. Esta tabela mostra <b>a mesma opera&ccedil;&atilde;o</b> (' + money(e.valor_operacao) + ') feita em cada ano. O ano que voc&ecirc; informou define o valor do resultado acima.</div>' +
    '<table class="anos"><thead><tr><th>Ano</th><th class="num">Al&iacute;quota IBS</th><th class="num">Al&iacute;quota CBS</th><th class="num">Imposto na opera&ccedil;&atilde;o</th><th>Situa&ccedil;&atilde;o da al&iacute;quota</th></tr></thead><tbody>' +
    anos.map(function(a){ return '<tr' + (String(a.ano) === String(e.data_fato_gerador||'').slice(0,4) ? ' style="background:var(--info-bg)"' : '') + '><td>' + a.ano + (a.ano_teste ? ' <span class="badge b-info">ano-teste</span>' : '') + '</td><td class="num">' + pct(a.ibs,2) + '</td><td class="num">' + pct(a.cbs,2) + '</td><td class="num' + (a.total === max ? ' max' : '') + '"><b>' + money(a.total) + '</b></td><td><span class="badge ' + (a.classificacao === 'LEGAL' ? 'b-ok' : 'b-warn') + '">' + (a.classificacao === 'LEGAL' ? 'fixada em lei' : 'estimada') + '</span></td></tr>'; }).join('') +
    '</tbody></table></div>';
}
function botoesRelatorio(op){
  return '<div class="card"><h2>Relat&oacute;rios desta opera&ccedil;&atilde;o</h2><div class="mini">Cada bot&atilde;o abre o documento pronto para imprimir ou salvar em PDF.</div><div class="rel-botoes">' +
    '<button class="btn pri" onclick="imobRelatorio(\'simplificado\',\'' + op + '\')">&#128203; Resumo para o cliente</button>' +
    '<button class="btn" onclick="imobRelatorio(\'executivo\',\'' + op + '\')">&#128196; Relat&oacute;rio executivo</button>' +
    '<button class="btn" onclick="imobRelatorio(\'tecnico\',\'' + op + '\')">&#128295; Relat&oacute;rio t&eacute;cnico</button>' +
    '<button class="btn" onclick="imobRelatorio(\'memoria\',\'' + op + '\')">&#129518; Mem&oacute;ria de c&aacute;lculo</button>' +
    '<button class="btn" onclick="abrirAba(\'memoria\')">Ver mem&oacute;ria na tela</button></div></div>';
}

/* ---------- aba memória de cálculo (com explicação para leigo) ---------- */
var EXPLICA_LINHA = {
  'Valor da operação': 'O preço combinado. Tudo parte daqui.',
  'Redutor de ajuste': 'Desconto que representa o valor que o imóvel já tinha antes da Reforma (art. 375). Evita tributar o que foi construído no sistema antigo.',
  'Redutor social': 'Desconto adicional para moradia (R$ 100 mil no residencial novo; R$ 30 mil no lote; R$ 600/mês no aluguel residencial).',
  'Base de cálculo tributável': 'Valor sobre o qual o imposto incide: preço menos os descontos.',
  'Encargos do locatário excluídos da base': 'IPTU, taxas e condomínio pagos pelo inquilino não são receita do locador.',
  'Créditos de IBS/CBS apropriados': 'Imposto pago nas compras que pode ser abatido, até o limite do imposto devido.',
  'Torna tributável': 'Na permuta, só a diferença em dinheiro paga imposto.'
};
var ULTIMA_OP = null;
function imobMemoriaAba(){ acao(function(){
  var u = ULTIMA_OP && ULTIMO[ULTIMA_OP];
  if (!u) { $('mem-out').innerHTML = '<div class="card"><div class="info">Ainda n&atilde;o h&aacute; c&aacute;lculo nesta sess&atilde;o. Cadastre a pessoa e o im&oacute;vel e escolha uma opera&ccedil;&atilde;o &mdash; a mem&oacute;ria aparece aqui automaticamente.</div></div>'; return; }
  var res = u.res, e = u.e, opRot = { venda: 'Venda', locacao: 'Loca&ccedil;&atilde;o', permuta: 'Permuta' }[ULTIMA_OP] || ULTIMA_OP;
  var h = '<div class="card"><h2>' + opRot + ' de ' + money(e.valor_operacao) + ' em ' + RL.dataBR(e.data_fato_gerador) + '</h2>' +
    '<div class="mini">' + (PESSOA.nome ? '<b>' + esc(PESSOA.nome) + '</b> · ' : '') + 'im&oacute;vel <b>' + esc((e.imovel||{}).codigo_interno || (e.imovel||{}).id || '—') + '</b> · calculado em ' + esc(new Date().toLocaleString('pt-BR')) + '</div>' +
    '<table style="margin-top:10px"><thead><tr><th>#</th><th>Passo</th><th>Em palavras simples</th><th>F&oacute;rmula</th><th class="num">Valor</th></tr></thead><tbody>' +
    res.linhas.map(function(l){ var ehAlq = l.ibs_reduzida != null;
      var simples = ehAlq ? 'A al&iacute;quota cheia (' + pct(l.entrada.ibs_padrao,2) + ' + ' + pct(l.entrada.cbs_padrao,2) + ') tem desconto de ' + (ULTIMA_OP === 'locacao' ? '70' : '50') + '% para im&oacute;veis.' : /^IBS/.test(l.descricao) ? 'Base × al&iacute;quota reduzida do IBS.' : /^CBS/.test(l.descricao) ? 'Base × al&iacute;quota reduzida da CBS.' : /^Total/.test(l.descricao) ? 'IBS + CBS menos os cr&eacute;ditos: o que sai do caixa.' : /Ano-teste/.test(l.descricao) ? 'Em 2026 vale s&oacute; 1% de teste; se der at&eacute; R$ 0,00 &eacute; dispensado.' : (EXPLICA_LINHA[l.descricao] || '');
      return '<tr><td class="mini">' + l.ordem + '</td><td><b>' + esc(l.descricao) + '</b><div class="fund">' + (l.fundamentos||[]).slice(0,2).map(esc).join('<br>') + '</div></td><td class="mini">' + simples + '</td><td class="mini">' + esc(l.formula||'') + '</td><td class="num">' + (ehAlq ? 'IBS <b>' + pct(l.ibs_reduzida,4) + '</b><br>CBS <b>' + pct(l.cbs_reduzida,4) + '</b>' : '<b>' + money(l.valor) + '</b>') + '</td></tr>'; }).join('') +
    '</tbody></table></div>';
  $('mem-out').innerHTML = h + imobSequencial('Resultado passo a passo', u.etapas) + (u.anos ? imobAnosHTML(u.anos, e) : '') + imobMemoria(res, ULTIMA_OP === 'locacao' ? 'locacao' : 'venda') + botoesRelatorio(ULTIMA_OP);
}); }

/* ---------- venda ---------- */
function entradaVenda(){
  var e = { operacao:'venda', data_fato_gerador: txt('v-data'), valor_operacao: n('v-val'),
            imovel: imovelParaEntrada(), redutor_ajuste_saldo: n('v-raj'), creditos: n('v-cre'),
            redutor_social_ja_utilizado: txt('v-rsu') === '1' };
  var pg = txt('v-pag');
  if (pg) e.pagamentos = pg.split(';').map(function(x){ return parseFloat(x.trim().replace(',','.')); }).filter(function(x){ return isFinite(x); });
  return e;
}
function calcVenda(){ acao(function(){
  var v = VA.validarVenda({ valor: txt('v-val'), redutor: txt('v-raj'), creditos: txt('v-cre'), data: txt('v-data'), tipo: txt('v-tipo'), pagamentos: txt('v-pag') });
  if (!mostrarValidacao('v-valid', v)) { $('v-out').innerHTML = ''; return; }
  var e = entradaVenda(), ctx = ctxPara('venda'), res = M.calcular(e, ctx);
  if (res.status === 'BLOQUEADO') { $('v-out').innerHTML = imobBloqueio(res); return; }
  var ex = PR.explicar(PREM, 'venda');
  var et = RL.resultadoVenda(res, e, ex);
  var h = imobGrau(res, 'venda') + imobSequencial('Resultado da aliena&ccedil;&atilde;o', et);
  if (res.parcelas && typeof res.parcelas[0] === 'object') {
    h += '<div class="card"><h2>IBS/CBS devidos em cada pagamento &mdash; art. 380</h2><table><thead><tr>' +
      '<th>#</th><th class="num">Pagamento</th><th class="num">Propor&ccedil;&atilde;o</th><th class="num">Redutor aplicado</th><th class="num">Base</th><th class="num">IBS</th><th class="num">CBS</th><th class="num">Devido</th></tr></thead><tbody>' +
      res.parcelas.map(function(p){ return '<tr><td>' + p.ordem + '</td><td class="num">' + money(p.pagamento) + '</td><td class="num">' + pct(p.proporcao,4) + '</td><td class="num">' + money(p.redutor_aplicado) +
        '</td><td class="num">' + money(p.base) + '</td><td class="num">' + money(p.ibs) + '</td><td class="num">' + money(p.cbs) + '</td><td class="num"><b>' + money(p.total) + '</b></td></tr>'; }).join('') + '</tbody></table></div>';
  }
  var anos = calcularAnos(e, ctx);
  $('v-out').innerHTML = h + imobAnosHTML(anos, e) + imobMemoria(res, 'venda') + botoesRelatorio('venda');
  ULTIMO.venda = { e: e, res: res, ctx: ctx, etapas: et, anos: anos }; ULTIMA_OP = 'venda';
  registrarSimulacao(e, res, 'Venda');
}); }

/* ---------- locação ---------- */
function entradaLocacao(finalidade){
  var meses = Math.max(1, Math.floor(n('l-mes') || 1)), mensal = n('l-val');
  var propDias = n('l-dias') > 0 && n('l-dias') < 30 ? n('l-dias') / 30 : 1;
  var loc = { finalidade: finalidade || txt('l-fim'), meses: meses, valor_mensal: mensal,
    encargos_locatario: { prova_pagamento: txt('l-prova') === '1', tributos_emolumentos: n('l-trib') * meses, condominio: n('l-cond') * meses, foro_taxa_ocupacao: n('l-foro') * meses } };
  if (n('l-prz') > 0) loc.prazo_dias = n('l-prz');
  if (n('l-dias') > 0) loc.dias_no_mes = n('l-dias');
  if (n('l-area') > 0) loc.fracao_area_residencial = n('l-area');
  return { operacao:'locacao', data_fato_gerador: txt('l-data'), valor_operacao: Math.round(mensal * meses * propDias * 100) / 100, locacao: loc, creditos: n('l-cre'), imovel: imovelParaEntrada() };
}
function calcLoc(){ acao(function(){
  var v = VA.validarLocacao({ valor: txt('l-val'), finalidade: txt('l-fim'), meses: txt('l-mes'), prazo_dias: txt('l-prz'), dias_no_mes: txt('l-dias'), fracao_area: txt('l-area'),
    tributos: txt('l-trib'), condominio: txt('l-cond'), foro: txt('l-foro'), creditos: txt('l-cre'), data: txt('l-data') });
  if (!mostrarValidacao('l-valid', v)) { $('l-out').innerHTML = ''; return; }
  var e = entradaLocacao(), ctx = ctxPara('locacao'), res = M.calcular(e, ctx);
  if (res.status === 'BLOQUEADO') { $('l-out').innerHTML = imobBloqueio(res); return; }
  var ex = PR.explicar(PREM, 'locacao'), et = RL.resultadoLocacao(res, e, ex);
  var h = imobGrau(res, 'locacao') + imobSequencial('Resultado da loca&ccedil;&atilde;o', et);
  if (txt('l-cmp') === '1') {
    var outra = txt('l-fim') === 'residencial' ? 'nao_residencial' : 'residencial';
    var e2 = entradaLocacao(outra), r2 = M.calcular(e2, ctx);
    if (r2.status === 'CALCULADO') {
      var a = txt('l-fim') === 'residencial' ? res : r2, b = txt('l-fim') === 'residencial' ? r2 : res;
      h += '<div class="card"><h2>Residencial &times; n&atilde;o residencial (mesmos valores)</h2><table><thead><tr><th>Item</th><th class="num">Residencial</th><th class="num">N&atilde;o residencial</th><th class="num">Diferen&ccedil;a</th></tr></thead><tbody>' +
        [['Receita bruta', e.valor_operacao, e.valor_operacao], ['Redutor social', a.redutor_social_usado||0, b.redutor_social_usado||0], ['Base de c&aacute;lculo', a.base, b.base], ['IBS', a.ibs, b.ibs], ['CBS', b.cbs != null ? a.cbs : a.cbs, b.cbs], ['Total', a.total, b.total]].map(function(l){
          return '<tr><td>' + l[0] + '</td><td class="num">' + money(l[1]) + '</td><td class="num">' + money(l[2]) + '</td><td class="num"><b>' + money((l[2]||0) - (l[1]||0)) + '</b></td></tr>'; }).join('') +
        '<tr><td>Carga efetiva</td><td class="num">' + pct(a.aliquota_efetiva_sobre_operacao,4) + '</td><td class="num">' + pct(b.aliquota_efetiva_sobre_operacao,4) + '</td><td class="num"><b>' + pct(b.aliquota_efetiva_sobre_operacao - a.aliquota_efetiva_sobre_operacao,4) + '</b></td></tr></tbody></table>' +
        '<div class="mini" style="margin-top:8px">A diferen&ccedil;a vem do redutor social de R$ 600/m&ecirc;s, exclusivo da loca&ccedil;&atilde;o residencial (art. 260). A redu&ccedil;&atilde;o de 70% vale para as duas.</div></div>';
    } else {
      h += '<div class="card"><div class="aviso">Compara&ccedil;&atilde;o n&atilde;o realizada: o cen&aacute;rio ' + esc(outra) + ' foi bloqueado pelo motor (' + esc(r2.mensagem) + ').</div></div>';
    }
  }
  var anos = calcularAnos(e, ctx);
  $('l-out').innerHTML = h + imobAnosHTML(anos, e) + imobMemoria(res, 'locacao') + botoesRelatorio('locacao');
  ULTIMO.locacao = { e: e, res: res, ctx: ctx, etapas: et, anos: anos }; ULTIMA_OP = 'locacao';
  registrarSimulacao(e, res, 'Loca&ccedil;&atilde;o');
}); }

/* ---------- permuta ---------- */
function calcPerm(){ acao(function(){
  var v = VA.validarPermuta({ valor_dado: txt('x-val'), valor_recebido: txt('x-rec'), torna_paga: txt('x-tpaga'), torna_recebida: txt('x-trec'), contraparte: txt('x-parte'),
    redutor: txt('x-raj'), creditos: txt('x-cre'), unidades: txt('x-nuni'), fracao_ideal: txt('x-fr'), unidades_futuras: txt('x-uni') === '1', data: txt('x-data') });
  if (!mostrarValidacao('x-valid', v)) { $('x-out').innerHTML = ''; return; }
  var tp = n('x-tpaga'), tr = n('x-trec');
  var torna = tp > 0 ? tp : tr, quem = tp > 0 ? 'contribuinte' : tr > 0 ? 'nao_contribuinte' : 'nenhum';
  var pm = { contraparte: txt('x-parte'), torna: torna, torna_paga_por: quem, redutor_ajuste_dado: n('x-raj'),
             unidades_a_construir: txt('x-uni') === '1', contraprestacao_diversa: txt('x-div') === '1',
             contraparte_identificacao: txt('x-nome') || undefined, valor_imovel_recebido: nOuNulo('x-rec') || undefined,
             contraprestacao_dinheiro_alem_torna: txt('x-din') === '1', unidades_futuras: nOuNulo('x-nuni') || undefined };
  if (n('x-fr') > 0) pm.fracao_ideal = n('x-fr');
  var e = { operacao:'permuta', data_fato_gerador: txt('x-data'), valor_operacao: n('x-val'), permuta: pm, creditos: n('x-cre'), imovel: imovelParaEntrada() };
  var ctx = ctxPara('venda'), res = M.calcular(e, ctx);
  if (res.status === 'BLOQUEADO') { $('x-out').innerHTML = imobBloqueio(res); return; }
  var ex = PR.explicar(PREM, 'venda');
  var et = RL.resultadoPermuta(res, e, ex, { valor_recebido: nOuNulo('x-rec'), unidades: txt('x-uni') === '1' ? n('x-nuni') : 0 });
  var h = imobGrau(res, 'venda') + imobSequencial('Resultado da permuta', et);
  if (txt('x-din') === '1') h += '<div class="card"><div class="aviso">Contrapresta&ccedil;&atilde;o em dinheiro al&eacute;m da torna: trate o valor como torna (art. 360, &sect;3&ordm;, I) &mdash; informe-o nos campos de torna para que seja tributado.</div></div>';
  if (n('x-cre') > 0) h += '<div class="card"><div class="info">Cr&eacute;ditos informados (' + money(n('x-cre')) + ') n&atilde;o foram abatidos: o motor n&atilde;o compensa cr&eacute;ditos na permuta &mdash; o aproveitamento se d&aacute; na apura&ccedil;&atilde;o peri&oacute;dica (arts. 47 a 57).</div></div>';
  if (txt('x-nome')) h += '<div class="card"><div class="mini">Contraparte: <b>' + esc(txt('x-nome')) + '</b> (' + esc(txt('x-parte')) + ')</div></div>';
  var anos = calcularAnos(e, ctx);
  $('x-out').innerHTML = h + imobAnosHTML(anos, e) + imobMemoria(res, 'venda') + botoesRelatorio('permuta');
  ULTIMO.permuta = { e: e, res: res, ctx: ctx, etapas: et, anos: anos }; ULTIMA_OP = 'permuta';
  registrarSimulacao(e, res, 'Permuta');
}); }

/* ---------- pessoa física ---------- */
function calcPF(){ acao(function(){
  var v = VA.validarPF({ 'p-rec': txt('p-rec'), 'p-recc': txt('p-recc'), 'p-qtd': txt('p-qtd'), 'p-ali': txt('p-ali'), 'p-con': txt('p-con'), 'p-alic': txt('p-alic'), 'p-conc': txt('p-conc'), 'p-fat': txt('p-fat') });
  if (!mostrarValidacao('p-valid', v)) { $('p-out').innerHTML = ''; return; }
  var c = ctxPara('venda'); c.indices.ipca_fator = n('p-fat') || 1;
  var d = { receita_locacao_ano_anterior: n('p-rec'), receita_locacao_ano_corrente: n('p-recc'), imoveis_locados_distintos: n('p-qtd'),
    alienacoes_ano_anterior: n('p-ali'), alienacoes_construidos_proprio_ano_anterior: n('p-con'),
    alienacoes_ano_corrente: n('p-alic'), alienacoes_construidos_proprio_ano_corrente: n('p-conc') };
  var r = M.pfEnquadramento(d, c);
  var pend = [];
  if (!(n('p-rec') > 0) && !(n('p-recc') > 0)) pend.push('Receita de loca&ccedil;&atilde;o n&atilde;o informada (ano anterior e corrente).');
  if (!(n('p-fat') > 0)) pend.push('Fator IPCA do limite n&atilde;o informado.');
  var conf = pend.length ? 'BAIXA' : (n('p-fat') === 1 ? 'MEDIA' : 'MEDIA');
  var criterios = [
    ['I', 'Receita de loca&ccedil;&atilde;o do ano anterior acima do limite atualizado E mais de 3 im&oacute;veis distintos', money(n('p-rec')) + ' × ' + n('p-qtd') + ' im&oacute;veis', 'limite ' + money(r.limite_atualizado), n('p-rec') > r.limite_atualizado && n('p-qtd') > 3],
    ['II', 'Mais de 3 im&oacute;veis distintos alienados no ano anterior', n('p-ali') + ' aliena&ccedil;&otilde;es', '> 3', n('p-ali') > 3],
    ['III', 'Mais de 1 im&oacute;vel constru&iacute;do pelo pr&oacute;prio alienado no ano anterior', n('p-con'), '> 1', n('p-con') > 1],
    ['&sect;1&ordm;, I', 'A partir da 4&ordf; aliena&ccedil;&atilde;o no pr&oacute;prio ano', n('p-alic'), '&ge; 4', n('p-alic') >= 4],
    ['&sect;1&ordm;, II', 'A partir da 2&ordf; aliena&ccedil;&atilde;o de im&oacute;vel constru&iacute;do pelo pr&oacute;prio no ano', n('p-conc'), '&ge; 2', n('p-conc') >= 2],
    ['&sect;1&ordm;, III', 'Receita do ano corrente excede o limite em 20% com mais de 3 im&oacute;veis', money(n('p-recc')) + ' × ' + n('p-qtd'), 'limite ' + money(r.limite_mais_20), n('p-recc') > r.limite_mais_20 && n('p-qtd') > 3]
  ];
  var h = '<div class="card"><h2>Resultado do enquadramento</h2>' +
    '<div class="seq"><div class="et principal"><div class="r">Enquadramento identificado</div><div class="v" style="font-size:20px">' + (r.contribuinte ? 'CONTRIBUINTE' : 'N&Atilde;O CONTRIBUINTE') + '</div><div class="f">art. 382 RIBS/RCBS · art. 251 LC 214</div></div>' +
    '<div class="et"><div class="r">Limite aplic&aacute;vel</div><div class="v">' + money(r.limite_atualizado) + '</div><div class="f">' + money(r.limite_original) + ' × fator ' + String(r.fator_ipca).replace('.',',') + ' (&sect;4&ordm;) · +20%: ' + money(r.limite_mais_20) + '</div></div>' +
    '<div class="et"><div class="r">Receitas consideradas</div><div class="v" style="font-size:16px">' + money(n('p-rec')) + '</div><div class="f">ano anterior · corrente ' + money(n('p-recc')) + '</div></div>' +
    '<div class="et"><div class="r">Im&oacute;veis · aliena&ccedil;&otilde;es · constru&iacute;dos</div><div class="v" style="font-size:16px">' + n('p-qtd') + ' · ' + (n('p-ali') + n('p-alic')) + ' · ' + (n('p-con') + n('p-conc')) + '</div><div class="f">locados distintos · anterior+corrente · anterior+corrente</div></div></div>' +
    '<h3 class="sec">Crit&eacute;rios utilizados</h3><table><thead><tr><th>Inciso</th><th>Crit&eacute;rio</th><th>Dado informado</th><th>Limite</th><th>Atingido?</th></tr></thead><tbody>' +
    criterios.map(function(c){ return '<tr' + (c[4] ? ' class="dif"' : '') + '><td><b>' + c[0] + '</b></td><td>' + c[1] + '</td><td class="num">' + c[2] + '</td><td class="num">' + c[3] + '</td><td><span class="badge ' + (c[4] ? 'b-err' : 'b-ok') + '">' + (c[4] ? 'SIM' : 'n&atilde;o') + '</span></td></tr>'; }).join('') + '</tbody></table>' +
    '<h3 class="sec">Justificativa</h3>' + (r.motivos.length ? r.motivos.map(function(m){ return '<div class="aviso"><b>' + esc(m.inciso) + '</b> — ' + esc(m.motivo) + '</div>'; }).join('')
      : '<div class="aviso ok">Com os dados informados, n&atilde;o foi identificado enquadramento no regime espec&iacute;fico. A pessoa f&iacute;sica n&atilde;o &eacute; contribuinte de IBS/CBS por essas opera&ccedil;&otilde;es (art. 251, &sect;1&ordm;, a contrario sensu).</div>') +
    '<h3 class="sec">Pend&ecirc;ncias e grau de confian&ccedil;a</h3>' + (pend.length ? pend.map(function(p){ return '<div class="aviso">' + p + '</div>'; }).join('') : '<div class="info">Sem pend&ecirc;ncias de dados.</div>') +
    '<div class="mini">Grau de confian&ccedil;a: <b class="n-' + conf + '">' + conf + '</b> — o fator IPCA do limite depende de &iacute;ndice ainda n&atilde;o publicado e a contagem de im&oacute;veis do &sect;2&ordm; (menos de 5 anos no patrim&ocirc;nio) n&atilde;o &eacute; verificada automaticamente.</div>' +
    '<div class="info" style="margin-top:14px">' + esc(r.nota_prazo) + '</div><div class="aviso">' + esc(r.nota_temporada) + '</div>' +
    '<div class="fund">' + (r.fundamentos||[]).map(esc).join(' &middot; ') + '</div>' + imobSelo() + '</div>';
  $('p-out').innerHTML = h;
}); }

/* ---------- regras e fontes ---------- */
var ASSUNTOS = [
  ['Venda', ['IMOB-BASE-001','IMOB-ALQ-001','IMOB-PAR-001','IMOB-2026-001','IMOB-TRA-001']],
  ['Locação', ['IMOB-BASE-002','IMOB-RSO-002','IMOB-RSO-003','IMOB-ALQ-002','IMOB-TEM-001','IMOB-LOC-TR1']],
  ['Permuta', ['IMOB-PER-001','IMOB-PER-002']],
  ['Redutor de ajuste', ['IMOB-RAJ-001','IMOB-RAJ-002']],
  ['Redutor social', ['IMOB-RSO-001','IMOB-RSO-002','IMOB-RSO-003']],
  ['Créditos', ['IMOB-CRE-001','IMOB-CRE-002','IMOB-CRE-003']],
  ['Pessoa física', ['IMOB-PF-001']],
  ['Regimes opcionais', ['IMOB-RET-001','IMOB-RET-002','IMOB-RET-003','IMOB-LOT-001','IMOB-LOC-TR1']],
  ['Tributação atual (comparativo)', ['IMOB-LP-001','IMOB-LP-002','IMOB-LP-003','IMOB-LP-004','IMOB-LR-001']]
];
var VIGENCIA = {
  'IMOB-2026-001': ['01/01/2026 a 31/12/2026', 'ano-teste'], 'IMOB-RET-001': ['a partir de 01/01/2027 (memorial registrado at&eacute; 31/12/2028)', 'transi&ccedil;&atilde;o'],
  'IMOB-RET-002': ['a partir de 01/01/2027 (memorial registrado at&eacute; 31/12/2028)', 'transi&ccedil;&atilde;o'], 'IMOB-RET-003': ['enquanto durar a op&ccedil;&atilde;o', 'transi&ccedil;&atilde;o'],
  'IMOB-LOT-001': ['a partir de 01/01/2027 (registro at&eacute; 31/12/2028)', 'transi&ccedil;&atilde;o'], 'IMOB-LOC-TR1': ['a partir de 01/01/2027 (contratos at&eacute; 16/01/2025)', 'transi&ccedil;&atilde;o'],
  'IMOB-TRA-001': ['2026 a 2033', 'escada de transi&ccedil;&atilde;o'], 'IMOB-LP-001': ['vigente hoje', 'regime atual'], 'IMOB-LP-002': ['vigente hoje', 'regime atual'],
  'IMOB-LP-003': ['vigente at&eacute; a extin&ccedil;&atilde;o do PIS/COFINS (2027)', 'regime atual'], 'IMOB-LP-004': ['vigente hoje', 'regime atual'], 'IMOB-LR-001': ['indicativa', 'premissa em staging']
};
var IMPACTO = {
  'IMOB-BASE-001': 'define a base (valor − redutores)', 'IMOB-RAJ-001': 'deduz o saldo do redutor de ajuste da base', 'IMOB-RSO-001': 'deduz R$ 100 mil / R$ 30 mil da base',
  'IMOB-RSO-002': 'deduz R$ 600/m&ecirc;s da base da loca&ccedil;&atilde;o residencial', 'IMOB-ALQ-001': 'reduz as al&iacute;quotas em 50%', 'IMOB-ALQ-002': 'reduz as al&iacute;quotas em 70%',
  'IMOB-TEM-001': 'bloqueia o c&aacute;lculo (temporada &eacute; hotelaria)', 'IMOB-RET-001': 'substitui tudo por 2,08% da receita', 'IMOB-RET-002': 'substitui tudo por 0,53% da receita',
  'IMOB-RET-003': 'zera cr&eacute;ditos e redutores no RET', 'IMOB-PAR-001': 'rateia os redutores entre os pagamentos', 'IMOB-BASE-002': 'exclui encargos do locat&aacute;rio da base',
  'IMOB-RAJ-002': 'fixa o valor inicial do redutor (op&ccedil;&otilde;es)', 'IMOB-RSO-003': 'proporcionaliza o redutor social', 'IMOB-CRE-001': 'limita os cr&eacute;ditos ao d&eacute;bito',
  'IMOB-CRE-002': 'veda cr&eacute;dito em opera&ccedil;&otilde;es sem incid&ecirc;ncia', 'IMOB-CRE-003': 'ordem e prazo de 5 anos dos cr&eacute;ditos', 'IMOB-2026-001': 'substitui o c&aacute;lculo por 0,1% + 0,9% em 2026',
  'IMOB-PF-001': 'decide se a PF &eacute; contribuinte', 'IMOB-PER-001': 'afasta a incid&ecirc;ncia, exceto sobre a torna', 'IMOB-PER-002': 'transfere/rateia o redutor na permuta',
  'IMOB-LOT-001': 'substitui tudo por 3,65% da receita', 'IMOB-LOC-TR1': 'substitui tudo por 3,65% da receita', 'IMOB-LP-001': 'IRPJ/CSLL presumidos na venda', 'IMOB-LP-002': 'IRPJ/CSLL presumidos na loca&ccedil;&atilde;o',
  'IMOB-LP-003': 'PIS/COFINS cumulativos (substitu&iacute;dos)', 'IMOB-LP-004': 'ganho de capital fora do objeto', 'IMOB-LR-001': 'cen&aacute;rio indicativo de Lucro Real', 'IMOB-TRA-001': 'aplica a al&iacute;quota de cada ano'
};
function pintaRegras(){
  var R = M.REGRAS, info = (window.ModulosInfo || {}).imobiliario || {};
  var h = '<div class="mini" style="margin-bottom:10px">Ruleset <b>' + esc(M.RULESET_VERSAO) + '</b> · motor ' + esc(M.MOTOR_IMOB_VERSAO) + ' · &uacute;ltima atualiza&ccedil;&atilde;o do m&oacute;dulo <b>' + esc(info.data || '—') + '</b> · lacre <code>' + esc(M.LACRE_IMOB_HASH) + '</code></div>' +
    '<table><thead><tr><th>Regra</th><th>Descri&ccedil;&atilde;o resumida</th><th>Fundamento legal / artigo</th><th>Vig&ecirc;ncia</th><th>Status</th><th>Impacto no c&aacute;lculo</th></tr></thead><tbody>';
  ASSUNTOS.forEach(function(a){
    h += '<tr class="grp"><td colspan="6">' + esc(a[0]) + '</td></tr>';
    a[1].forEach(function(k){ var r = R[k]; if (!r) return; var vg = VIGENCIA[k] || ['a partir de 01/01/2027 (2026: ano-teste)', 'regime espec&iacute;fico'];
      h += '<tr><td><code>' + k + '</code><div class="mini">v' + r.versao + ' · ' + esc(r.nivel) + '</div></td><td>' + esc(r.nome) + '</td><td class="fund">' + r.fontes.map(esc).join('<br>') + '</td>' +
        '<td class="mini">' + vg[0] + '<div>' + vg[1] + '</div></td><td><span class="badge ' + (r.status === 'homologada' ? 'b-ok' : 'b-warn') + '">' + esc(r.status) + '</span></td><td class="mini">' + (IMPACTO[k] || '—') + '</td></tr>'; });
  });
  h += '</tbody></table><div class="info" style="margin-top:14px">Nenhuma regra vai a <b>ativa</b> antes da dupla aprova&ccedil;&atilde;o do Passo 6. A regra em <b>staging</b> (Lucro Real) &eacute; premissa declarada e sai rotulada como simula&ccedil;&atilde;o indicativa.</div>' + imobSelo();
  $('r-out').innerHTML = h;
}

/* ---------- regimes opcionais ---------- */
function pintaOpc(){
  var r = txt('o-reg'), html = '';
  if (r === 'ret') {
    html = '<div class="grid g4"><div><label>Modalidade</label><select id="o-mod"><option value="normal">Normal &mdash; 2,08%</option><option value="social">Interesse social &mdash; 0,53%</option></select></div>' +
      '<div><label>Patrim&ocirc;nio de afeta&ccedil;&atilde;o comprovado?</label><select id="o-afe"><option value="1">Sim</option><option value="0">N&atilde;o</option></select></div>' +
      '<div><label>Redutor de ajuste dispon&iacute;vel</label><input id="o-raj" type="number" min="0" value="600000"></div><div><label>Cr&eacute;ditos no regime comum</label><input id="o-cre" type="number" min="0" value="0"></div></div>';
  } else if (r === 'loteamento') {
    html = '<div class="grid g4"><div><label>Registro efetivado antes de 2029?</label><select id="o-reg28"><option value="1">Sim</option><option value="0">N&atilde;o</option></select></div>' +
      '<div><label>Redutor de ajuste dispon&iacute;vel</label><input id="o-raj" type="number" min="0" value="200000"></div><div><label>Cr&eacute;ditos no regime comum</label><input id="o-cre" type="number" min="0" value="0"></div></div>';
  } else {
    html = '<div class="grid g4"><div><label>Finalidade</label><select id="o-fim"><option value="nao_residencial">N&atilde;o residencial</option><option value="residencial">Residencial</option></select></div>' +
      '<div><label>Firmado at&eacute; 16/01/2025?</label><select id="o-fir"><option value="1">Sim</option><option value="0">N&atilde;o</option></select></div>' +
      '<div><label>Data comprovada?</label><select id="o-dc"><option value="1">Sim</option><option value="0">N&atilde;o</option></select></div>' +
      '<div><label>Registrado em cart&oacute;rio at&eacute; 2025?</label><select id="o-rc"><option value="1">Sim</option><option value="0">N&atilde;o</option></select></div></div>' +
      '<div class="mini" style="margin-top:8px">Contrato n&atilde;o residencial exige tamb&eacute;m prazo determinado &mdash; considerado sim nesta pr&eacute;via.</div>';
  }
  $('o-campos').innerHTML = html;
}
var GUIA_OPC = [
  { reg: 'RET de transi&ccedil;&atilde;o (incorpora&ccedil;&atilde;o)', base: 'LC 214, art. 485 · RIBS/RCBS art. 461', hip: 'Incorpora&ccedil;&otilde;es submetidas ao RET (Lei 10.931/2004) com patrim&ocirc;nio de afeta&ccedil;&atilde;o, memorial registrado at&eacute; 31/12/2028',
    prazo: 'Op&ccedil;&atilde;o formalizada na forma do regulamento; alcan&ccedil;a toda a incorpora&ccedil;&atilde;o', definitiva: 'Sim &mdash; irretrat&aacute;vel', efeitos: 'IBS+CBS = 2,08% da receita (0,53% no interesse social), no lugar da apura&ccedil;&atilde;o comum',
    vant: 'Simplicidade; carga baixa e previs&iacute;vel sobre a receita', desv: 'Sem cr&eacute;ditos e sem redutores (&sect;&sect; 1&ordm; e 6&ordm;); pode perder para o regime comum quando o redutor de ajuste &eacute; alto',
    docs: 'Registro do memorial, termo de afeta&ccedil;&atilde;o, op&ccedil;&atilde;o pelo RET federal, escritura&ccedil;&atilde;o segregada', raj: 'Redutor de ajuste N&Atilde;O &eacute; dedu&ccedil;&atilde;o (vedado) &mdash; o saldo fica sem uso enquanto durar a op&ccedil;&atilde;o' },
  { reg: 'Parcelamento do solo (loteamento)', base: 'LC 214, art. 486 · RIBS/RCBS art. 462', hip: 'Loteamentos e desmembramentos com registro efetivado at&eacute; 31/12/2028',
    prazo: 'Op&ccedil;&atilde;o por parcelamento, na forma do regulamento', definitiva: 'Sim &mdash; irretrat&aacute;vel', efeitos: 'IBS+CBS = 3,65% da receita bruta recebida; afasta qualquer outra incid&ecirc;ncia (&sect;2&ordm;)',
    vant: 'Al&iacute;quota fixa sobre o caixa recebido; simplifica&ccedil;&atilde;o', desv: 'Sem cr&eacute;ditos (&sect;3&ordm;), sem redutor de ajuste e social (&sect;4&ordm;); adquirente n&atilde;o se credita (&sect;5&ordm;)',
    docs: 'Registro do parcelamento, contratos de venda dos lotes, controle de receita por loteamento', raj: 'Redutor de ajuste e social vedados na aliena&ccedil;&atilde;o dos lotes (&sect;4&ordm;)' },
  { reg: 'Loca&ccedil;&atilde;o &mdash; contratos antigos', base: 'LC 214, art. 487 · RIBS/RCBS art. 463', hip: 'Contratos firmados at&eacute; 16/01/2025: n&atilde;o residencial com prazo determinado, data comprovada e registro/disponibiliza&ccedil;&atilde;o; residencial at&eacute; 31/12/2028 ou fim do prazo',
    prazo: 'Enquanto vigorar o prazo original do contrato (residencial: at&eacute; 31/12/2028)', definitiva: 'Sim; pagamento definitivo, sem restitui&ccedil;&atilde;o nem compensa&ccedil;&atilde;o (&sect;7&ordm;)', efeitos: 'IBS+CBS = 3,65% da receita bruta (inclui receitas financeiras e varia&ccedil;&otilde;es monet&aacute;rias, &sect;6&ordm;)',
    vant: 'Carga menor que a do regime comum na maioria dos contratos n&atilde;o residenciais', desv: 'Sem redutor social (&sect;5&ordm;), sem cr&eacute;ditos (&sect;4&ordm;); exige prova documental da data',
    docs: 'Contrato com firma reconhecida ou assinatura eletr&ocirc;nica, registro em cart&oacute;rio ou disponibiliza&ccedil;&atilde;o &agrave; RFB/CGIBS, comprovantes de pagamento', raj: 'N&atilde;o h&aacute; aliena&ccedil;&atilde;o; o redutor de ajuste do im&oacute;vel n&atilde;o &eacute; afetado' },
  { reg: 'Regime espec&iacute;fico comum (refer&ecirc;ncia)', base: 'LC 214, arts. 251-270 · RIBS/RCBS 359-390', hip: 'Qualquer opera&ccedil;&atilde;o com bem im&oacute;vel por contribuinte do regime regular',
    prazo: '&mdash; (n&atilde;o &eacute; op&ccedil;&atilde;o)', definitiva: '&mdash;', efeitos: 'Base − redutores; al&iacute;quotas reduzidas em 50% (70% na loca&ccedil;&atilde;o); cr&eacute;ditos permitidos',
    vant: 'Aproveita redutor de ajuste, redutor social e cr&eacute;ditos', desv: 'Apura&ccedil;&atilde;o mais complexa; depende da op&ccedil;&atilde;o do art. 375 at&eacute; 31/12/2026', docs: 'Cadastro do im&oacute;vel, valor de refer&ecirc;ncia, escritura&ccedil;&atilde;o dos redutores', raj: 'Redutor de ajuste deduzido integralmente na aliena&ccedil;&atilde;o' }
];
function pintaGuiaOpc(){
  var alvo = $('o-guia'); if (!alvo || alvo.innerHTML) return;
  var linhas = [['Hip&oacute;teses de aplica&ccedil;&atilde;o','hip'],['Prazo para op&ccedil;&atilde;o','prazo'],['Op&ccedil;&atilde;o definitiva?','definitiva'],['Efeitos tribut&aacute;rios','efeitos'],['Vantagens','vant'],['Desvantagens','desv'],['Documentos necess&aacute;rios','docs'],['Impacto no redutor de ajuste','raj'],['Base legal','base']];
  alvo.innerHTML = '<div class="card"><h2>Guia dos regimes &mdash; tabela comparativa</h2><div style="overflow:auto"><table><thead><tr><th style="width:150px">Item</th>' +
    GUIA_OPC.map(function(g){ return '<th>' + g.reg + '</th>'; }).join('') + '</tr></thead><tbody>' +
    linhas.map(function(l){ return '<tr><td><b>' + l[0] + '</b></td>' + GUIA_OPC.map(function(g){ return '<td class="mini">' + g[l[1]] + '</td>'; }).join('') + '</tr>'; }).join('') +
    '</tbody></table></div><div class="aviso" style="margin-top:10px">Os prazos procedimentais da op&ccedil;&atilde;o (forma e momento de formaliza&ccedil;&atilde;o) dependem de ato do regulamento: confirmar antes de orientar o cliente. A escolha n&atilde;o deve ser feita pela al&iacute;quota nominal &mdash; use o comparador abaixo.</div></div>';
}
function calcOpc(){ acao(function(){
  var r = txt('o-reg'), e = { operacao: r, data_fato_gerador: txt('o-data'), valor_operacao: n('o-val') };
  var vv = { ok: true, erros: [], avisos: [] };
  if (!(n('o-val') > 0)) vv.erros.push({ campo: 'o-val', msg: 'Receita da opera&ccedil;&atilde;o deve ser maior que zero.' });
  if (!VA.dataValida(txt('o-data'))) vv.erros.push({ campo: 'o-data', msg: 'Data do fato gerador inv&aacute;lida.' });
  vv.ok = !vv.erros.length;
  var alvoV = $('o-out'); if (!vv.ok) { alvoV.innerHTML = '<div class="card">' + vv.erros.map(function(x){ return '<div class="aviso err">' + x.msg + '</div>'; }).join('') + '</div>'; return; }
  if (r === 'ret') { e.ret = { modalidade: txt('o-mod'), patrimonio_afetacao: txt('o-afe') === '1' }; e.redutor_ajuste_saldo = n('o-raj'); e.creditos = n('o-cre'); e.imovel = { id:'CMP', tipo:'residencial_novo' }; }
  else if (r === 'loteamento') { e.loteamento = { registro_ate_2028: txt('o-reg28') === '1' }; e.redutor_ajuste_saldo = n('o-raj'); e.creditos = n('o-cre'); e.imovel = { id:'CMP', tipo:'lote_residencial' }; }
  else { e.contrato = { finalidade: txt('o-fim'), firmado_ate_16_01_2025: txt('o-fir')==='1', prazo_determinado: true, data_comprovada: txt('o-dc')==='1', registrado_ate_2025: txt('o-rc')==='1' }; }
  var ctx = ctxPara('venda'), res = M.calcular(e, ctx);
  if (res.status === 'BLOQUEADO') { $('o-out').innerHTML = imobBloqueio(res); return; }
  var h = imobGrau(res, 'venda') + '<div class="card"><h2>Resultado do regime opcional</h2><div class="seq">' +
    '<div class="et"><div class="r">Base</div><div class="v">' + money(res.base) + '</div></div><div class="et"><div class="r">Al&iacute;quota</div><div class="v">' + pct(res.aliquota_efetiva_sobre_operacao,2) + '</div></div>' +
    '<div class="et principal"><div class="r">Total devido</div><div class="v">' + money(res.total) + '</div></div><div class="et"><div class="r">Confian&ccedil;a</div><div class="v" style="font-size:16px">' + esc(res.confianca.nivel) + '</div></div></div></div>';
  if (r !== 'locacao_transitoria') {
    var c = M.compararRegimes(e, ctx);
    if (c.status === 'CALCULADO') {
      h += '<div class="card"><h2>Regime opcional &times; regime espec&iacute;fico comum</h2><table><thead><tr><th>Cen&aacute;rio</th><th class="num">Carga</th><th class="num">Total devido</th></tr></thead><tbody>' +
        '<tr><td>' + esc(c.opcional.rotulo) + '</td><td class="num">' + pct(c.opcional.aliquota,4) + '</td><td class="num"><b>' + money(c.opcional.total) + '</b></td></tr>' +
        '<tr><td>' + esc(c.regular.rotulo) + '<div class="mini">redutor de ajuste ' + money(c.regular.redutor_usado) + ' · redutor social ' + money(c.regular.redutor_social) + ' · cr&eacute;ditos ' + money(c.regular.creditos) + '</div></td><td class="num">' + pct(c.regular.aliquota,4) + '</td><td class="num"><b>' + money(c.regular.total) + '</b></td></tr>' +
        '</tbody></table><div class="info" style="margin-top:12px">Diferen&ccedil;a: <b>' + money(Math.abs(c.diferenca)) + '</b> a favor do <b>' + (c.menor === 'opcional' ? 'regime opcional' : c.menor === 'regular' ? 'regime comum' : 'empate') + '</b>.</div>' +
        '<div class="aviso"><b>O que se renuncia ao optar:</b> ' + c.renuncias.map(esc).join(' · ') + '</div><div class="aviso">' + esc(c.ressalva) + '</div></div>';
    }
  }
  $('o-out').innerHTML = h + imobMemoria(res, 'venda');
}); }

/* ---------- comparativo e projeção ---------- */
var TRANSICAO = { 2026:{ibs:0.1,cbs:0.9,classificacao:'LEGAL'}, 2027:{ibs:0.05,cbs:9.11,classificacao:'LEGAL'},
 2028:{ibs:0.05,cbs:9.11,classificacao:'LEGAL'}, 2029:{ibs:1.87,cbs:9.21,classificacao:'ESTIMADA'},
 2030:{ibs:3.74,cbs:9.21,classificacao:'ESTIMADA'}, 2031:{ibs:5.61,cbs:9.21,classificacao:'ESTIMADA'},
 2032:{ibs:7.48,cbs:9.21,classificacao:'ESTIMADA'}, 2033:{ibs:18.70,cbs:9.21,classificacao:'ESTIMADA'} };
function calcComp(){ acao(function(){
  var v = VA.validarComparativo({ receita_venda: txt('c-rv'), receita_locacao: txt('c-rl'), receita_servicos: txt('c-rs'), meses: txt('c-me'), redutor: txt('c-raj'), iss: txt('c-iss') });
  if (!mostrarValidacao('c-valid', v)) { $('c-out').innerHTML = ''; return; }
  var rv = n('c-rv'), rl = n('c-rl'), rs = n('c-rs'), meses = n('c-me') || 3;
  var c = ctxPara('venda', { transicao: TRANSICAO }); c.parametros.iss = n('c-iss');
  var cl = ctxPara('locacao');
  var atual = M.calcLucroPresumido({ receita_venda: rv, receita_locacao: rl, receita_servicos: rs, atividade_imobiliaria_no_objeto: txt('c-obj')==='1', meses_periodo: meses }, c);
  if (atual.status === 'BLOQUEADO') { $('c-out').innerHTML = '<div class="card">' + atual.bloqueios.map(function(b){ return '<div class="aviso err">' + esc(b.msg) + '</div>'; }).join('') + '</div>'; return; }
  var opV = rv > 0 ? { operacao:'venda', data_fato_gerador:'2033-06-30', valor_operacao: rv, imovel:{ id:'CMP', tipo: txt('c-tipo') }, redutor_ajuste_saldo: n('c-raj') } : null;
  var opL = rl > 0 ? { operacao:'locacao', data_fato_gerador:'2033-06-30', valor_operacao: rl, locacao:{ finalidade:'nao_residencial', meses: meses } } : null;
  var rV = opV ? M.calcular(opV, c) : null, rL = opL ? M.calcular(opL, cl) : null;
  if ((rV && rV.status === 'BLOQUEADO') || (rL && rL.status === 'BLOQUEADO')) { $('c-out').innerHTML = '<div class="card"><div class="aviso err">Cen&aacute;rio da Reforma bloqueado pelo motor: ' + esc((rV && rV.mensagem) || (rL && rL.mensagem)) + '</div></div>'; return; }
  // serviços de administração/intermediação: dentro do regime específico, redução de 50% (art. 261, caput) — premissa declarada
  var exV = PR.explicar(PREM, 'venda'), servIbs = rs * exV.ibs_final / 100, servCbs = rs * exV.cbs_final / 100;
  var ibsR = (rV ? rV.ibs : 0) + (rL ? rL.ibs : 0) + servIbs, cbsR = (rV ? rV.cbs : 0) + (rL ? rL.cbs : 0) + servCbs;
  var credR = (rV ? rV.creditos : 0) + (rL ? rL.creditos : 0);
  var totR = Math.round((ibsR + cbsR - credR) * 100) / 100, totA = atual.tributos_substituidos;
  var receita = rv + rl + rs;
  var linhas = [
    ['Receita de venda', rv, rv], ['Receita de loca&ccedil;&atilde;o', rl, rl], ['Receita de servi&ccedil;os', rs, rs],
    ['PIS/COFINS', atual.pis + atual.cofins, 0], ['ISS/ICMS', atual.iss, 0], ['IBS', 0, ibsR], ['CBS', 0, cbsR], ['Cr&eacute;ditos', 0, -credR],
    ['Total tribut&aacute;rio (substitu&iacute;veis)', totA, totR, true], ['IRPJ + CSLL (permanecem nos dois)', atual.tributos_permanentes, atual.tributos_permanentes],
    ['Total geral', atual.total, Math.round((totR + atual.tributos_permanentes) * 100) / 100, true]
  ];
  var cargaA = receita > 0 ? totA / receita * 100 : 0, cargaR = receita > 0 ? totR / receita * 100 : 0;
  var cmpMotor = opV ? M.comparativoAtualXReforma({ atual: { receita_venda: rv, receita_locacao: rl, receita_servicos: rs, atividade_imobiliaria_no_objeto: txt('c-obj')==='1', meses_periodo: meses }, reforma: opV }, c) : null;
  var h = imobGrau(rV || rL || { confianca: { nivel: 'MEDIA' } }, 'venda') +
    '<div class="card"><h2>Comparativo lado a lado</h2><table><thead><tr><th>Item</th><th class="num">Regime atual (Lucro Presumido)</th><th class="num">Regime espec&iacute;fico (IBS/CBS)</th><th class="num">Diferen&ccedil;a</th></tr></thead><tbody>' +
    linhas.map(function(l){ return '<tr' + (l[3] ? ' class="grp"' : '') + '><td>' + l[0] + '</td><td class="num">' + money(l[1]) + '</td><td class="num">' + money(l[2]) + '</td><td class="num"><b>' + money(l[2] - l[1]) + '</b></td></tr>'; }).join('') +
    '<tr><td>Carga efetiva (substitu&iacute;veis ÷ receita)</td><td class="num">' + pct(cargaA,4) + '</td><td class="num">' + pct(cargaR,4) + '</td><td class="num"><b>' + pct(cargaR - cargaA,4) + '</b></td></tr></tbody></table>' +
    '<div class="' + (totR > totA ? 'aviso' : 'aviso ok') + '" style="margin-top:12px">Varia&ccedil;&atilde;o nos tributos substitu&iacute;veis: <b>' + money(Math.abs(totR - totA)) + '</b> (' + pct(totA > 0 ? Math.abs(totR - totA) / totA * 100 : 0, 2) + ') ' + (totR > totA ? 'a MAIS' : 'a MENOS') + ' no regime espec&iacute;fico.</div>' +
    '<div class="info">IRPJ e CSLL permanecem nos dois cen&aacute;rios e foram computados dos dois lados. ' + (rs > 0 ? 'Servi&ccedil;os (administra&ccedil;&atilde;o/intermedia&ccedil;&atilde;o) tributados com a redu&ccedil;&atilde;o de 50% do art. 261, caput &mdash; premissa a confirmar caso a caso. ' : '') +
    (rl > 0 ? 'Loca&ccedil;&atilde;o considerada n&atilde;o residencial (sem redutor social) neste comparativo. ' : '') + '</div>' + (cmpMotor && cmpMotor.status === 'CALCULADO' ? '<div class="aviso">' + esc(cmpMotor.ressalva) + '</div>' : '') + '</div>';

  // projeções: mensal, anual e 2026-2033
  var totMes = totR / meses, anoTot = [];
  var prjV = opV ? M.projetarTransicao(opV, c) : null, prjL = opL ? M.projetarTransicao(opL, cl) : null;
  for (var a = 2026; a <= 2033; a++) {
    var av = prjV && prjV.anos.filter(function(x){ return x.ano === a; })[0], al = prjL && prjL.anos.filter(function(x){ return x.ano === a; })[0];
    var tr = TRANSICAO[a], serv = rs * (tr.ibs + tr.cbs) * 0.5 / 100;
    var tot = (av ? av.total : 0) + (al ? al.total : 0) + serv;
    anoTot.push({ ano: a, ibs: tr.ibs, cbs: tr.cbs, classificacao: tr.classificacao, periodo: Math.round(tot * 100) / 100, mensal: Math.round(tot / meses * 100) / 100, anual: Math.round(tot / meses * 12 * 100) / 100, ano_teste: a === 2026 });
  }
  var maxV = Math.max.apply(null, anoTot.map(function(x){ return x.anual; }).concat([totA / meses * 12, 1]));
  h += '<div class="card"><h2>Proje&ccedil;&otilde;es</h2><div class="seq">' +
    '<div class="et"><div class="r">Per&iacute;odo informado (' + meses + ' meses)</div><div class="v">' + money(totR) + '</div><div class="f">IBS/CBS l&iacute;quidos no regime espec&iacute;fico</div></div>' +
    '<div class="et destaque"><div class="r">Mensal</div><div class="v">' + money(totMes) + '</div><div class="f">' + money(totR) + ' ÷ ' + meses + '</div></div>' +
    '<div class="et destaque"><div class="r">Anual (12 meses)</div><div class="v">' + money(totMes * 12) + '</div><div class="f">mensal × 12 · hoje: ' + money(totA / meses * 12) + '</div></div>' +
    '<div class="et"><div class="r">Carga efetiva anual</div><div class="v">' + pct(cargaR,4) + '</div><div class="f">hoje: ' + pct(cargaA,4) + '</div></div></div>' +
    '<h3 class="sec">Evolu&ccedil;&atilde;o 2026-2033 (base anualizada)</h3><div class="grafico">' +
    anoTot.map(function(x){ return '<div class="col"><span class="mini">' + money(x.anual) + '</span><div class="b' + (x.classificacao === 'LEGAL' ? '' : ' est') + '" style="height:' + Math.max(2, Math.round(x.anual / maxV * 130)) + 'px" title="' + x.ano + ': ' + money(x.anual) + '"></div><span class="lb">' + x.ano + '</span></div>'; }).join('') +
    '</div><div class="mini">Barras claras = al&iacute;quota estimada. Linha de refer&ecirc;ncia da tributa&ccedil;&atilde;o atual (PIS/COFINS/ISS anualizados): ' + money(totA / meses * 12) + '.</div>' +
    '<table style="margin-top:10px"><thead><tr><th>Ano</th><th class="num">IBS</th><th class="num">CBS</th><th class="num">Per&iacute;odo</th><th class="num">Mensal</th><th class="num">Anual</th><th>Al&iacute;quota</th></tr></thead><tbody>' +
    anoTot.map(function(x){ return '<tr><td>' + x.ano + (x.ano_teste ? ' <span class="badge b-info">ano-teste</span>' : '') + '</td><td class="num">' + pct(x.ibs,2) + '</td><td class="num">' + pct(x.cbs,2) + '</td><td class="num">' + money(x.periodo) + '</td><td class="num">' + money(x.mensal) + '</td><td class="num"><b>' + money(x.anual) + '</b></td><td><span class="badge ' + (x.classificacao === 'LEGAL' ? 'b-ok' : 'b-warn') + '">' + x.classificacao + '</span></td></tr>'; }).join('') +
    '</tbody></table><div class="info" style="margin-top:12px">' + esc((prjV || prjL || {}).nota || '') + '</div></div>';

  if (opV) {
    var sn = M.sensibilidade(opV, c, [-20,-10,0,10,20]);
    h += '<div class="card"><h2>Sensibilidade &agrave; al&iacute;quota de refer&ecirc;ncia (venda, 2033)</h2><table><thead><tr><th>Cen&aacute;rio</th><th class="num">Combinada</th><th class="num">Devido</th></tr></thead><tbody>' +
      sn.map(function(x){ return '<tr' + (x.variacao_pct===0?' style="background:var(--info-bg)"':'') + '><td>' + (x.variacao_pct>0?'+':'') + x.variacao_pct + '%</td><td class="num">' + pct(x.combinada,2) + '</td><td class="num"><b>' + money(x.total) + '</b></td></tr>'; }).join('') +
      '</tbody></table><div class="aviso" style="margin-top:12px">Todos os cen&aacute;rios desta tabela s&atilde;o <b>SIMULA&Ccedil;&Atilde;O</b>. A al&iacute;quota de refer&ecirc;ncia ainda n&atilde;o foi fixada em norma.</div>' + imobSelo() + '</div>';
  }
  $('c-out').innerHTML = h;
  ULTIMO.comparativo = { atual: atual, reforma: rV, cmp: cmpMotor, projecao: prjV, linhas: linhas };
}); }

/* ---------- inventário tributário de 31/12/2026 ---------- */
var IMOB_CARTEIRA = null, IV_TIMER = null;
var URG_COR = { PRAZO_VENCIDO:'b-err', CRITICA:'b-err', ALTA:'b-warn', MEDIA:'b-warn', NORMAL:'b-ok', DESCONHECIDA:'b-info' };
var ST_ROTULO = { exercida:['b-ok','op&ccedil;&atilde;o exercida'], pronto_para_escolher:['b-warn','pronto para escolher'], faltam_dados:['b-err','faltam dados'], fora_do_inventario:['b-info','fora do invent&aacute;rio'] };
function atualizarDatasInventario(){
  var hoje = hojeISO();
  if ($('iv-hoje')) $('iv-hoje').value = hoje;
  if ($('iv-base') && !$('iv-base').value) $('iv-base').value = hoje;
  var dias = M.diasAte(hoje, M.DATA_CORTE_INVENTARIO);
  var urg = dias == null ? 'DESCONHECIDA' : dias < 0 ? 'PRAZO_VENCIDO' : dias <= 30 ? 'CRITICA' : dias <= 90 ? 'ALTA' : dias <= 180 ? 'MEDIA' : 'NORMAL';
  var el = $('iv-prazo');
  if (el) { el.className = 'prazo u-' + urg;
    el.innerHTML = '<div><div class="mini">Prazo restante</div><div class="dias">' + (dias < 0 ? 'vencido h&aacute; ' + Math.abs(dias) + ' dias' : dias + ' dias') + '</div></div>' +
      '<div class="mini">at&eacute; <b>31/12/2026</b> · data atual <b>' + RL.dataBR(hoje) + '</b> · data do invent&aacute;rio <b>' + RL.dataBR(txt('iv-base')) + '</b> · urg&ecirc;ncia <span class="badge ' + URG_COR[urg] + '">' + urg.replace('_',' ') + '</span></div>' +
      '<div class="mini">O prazo &eacute; recalculado automaticamente todo dia; n&atilde;o depende de recarregar a carteira.</div>'; }
  if (!IV_TIMER) IV_TIMER = setInterval(function(){ if ($('iv-hoje') && $('iv-hoje').value !== hojeISO()) { atualizarDatasInventario(); if (IMOB_CARTEIRA) imobInventario(); } }, 60000);
  return { hoje: hoje, dias: dias, urgencia: urg };
}
function imobInventarioExemplo(){
  IMOB_CARTEIRA = [
    { id:'1', codigo_interno:'AP-101', empresa_id:'Incorporadora A', tipo:'residencial_novo', valor_aquisicao:300000, valor_referencia:480000 },
    { id:'2', codigo_interno:'AP-102', empresa_id:'Incorporadora A', tipo:'comercial', valor_aquisicao:200000, raj_opcao_escolhida:'aquisicao', raj_justificativa:'Aquisição atualizada supera a referência.', raj_saldo:290460 },
    { id:'3', codigo_interno:'LT-01', empresa_id:'Loteadora B', tipo:'lote_residencial' },
    { id:'4', codigo_interno:'SL-09', empresa_id:'Loteadora B', tipo:'comercial', valor_aquisicao:900000, valor_referencia:820000 },
    { id:'5', codigo_interno:'GL-22', empresa_id:'Holding C', tipo:'residencial_novo', valor_aquisicao:1200000, valor_referencia:1650000 }
  ];
  imobInventario();
}
function imobInventario(){ acao(function(){
  var d = atualizarDatasInventario();
  var c = ctxPara('venda'); c.indices.fator_ate_2026 = n('iv-fator') || c.indices.fator_ate_2026; c.hoje = d.hoje;   // prazo: SEMPRE a data atual do sistema
  function pintar(carteira){
    var inv = M.inventario2026(carteira, c), porEmp = M.inventarioPorEmpresa(carteira, c), t = inv.totais;
    var h = '<div class="card"><h2>Posi&ccedil;&atilde;o da carteira</h2><div class="grid g4">' +
      '<div><label>Prazo restante</label><div class="tot">' + (inv.dias_restantes >= 0 ? inv.dias_restantes + ' dias' : 'vencido') + '</div><div class="mini">at&eacute; 31/12/2026 (data atual ' + RL.dataBR(inv.hoje) + ')</div></div>' +
      '<div><label>Urg&ecirc;ncia</label><div style="margin-top:6px"><span class="badge ' + URG_COR[inv.urgencia] + '" style="font-size:14px;padding:6px 14px">' + inv.urgencia.replace('_',' ') + '</span></div></div>' +
      '<div><label>Redutor j&aacute; constitu&iacute;do</label><div class="tot" style="font-size:19px">' + money(t.redutor_constituido) + '</div></div>' +
      '<div><label>Im&oacute;veis em risco</label><div class="tot" style="font-size:19px;color:' + (t.em_risco ? 'var(--err)' : 'var(--ok)') + '">' + t.em_risco + ' de ' + t.total + '</div></div></div>' +
      '<div class="mini" style="margin-top:8px">Data do invent&aacute;rio (data-base dos valores): <b>' + RL.dataBR(txt('iv-base')) + '</b> · data limite <b>31/12/2026</b>.</div>' +
      (inv.diferenca_em_jogo > 0 ? '<div class="aviso" style="margin-top:14px">Entre escolher uma op&ccedil;&atilde;o ou outra nos im&oacute;veis ainda pendentes, a diferen&ccedil;a de base de redutor &eacute; de <b>' + money(inv.diferenca_em_jogo) + '</b>.</div>' : '') +
      inv.alertas.map(function(a){ return '<div class="' + (a.nivel === 'critico' ? 'aviso err' : 'info') + '">' + esc(a.msg) + '</div>'; }).join('') +
      '<div class="mini" style="margin-top:10px">' + esc(inv.nota) + '</div><div class="fund">' + (inv.fundamentos||[]).map(esc).join(' &middot; ') + '</div></div>';
    h += '<div class="card"><h2>Por empresa</h2><table><thead><tr><th>Empresa</th><th class="num">Im&oacute;veis</th><th class="num">Decididos</th><th class="num">Em risco</th><th class="num">Redutor constitu&iacute;do</th><th class="num">Potencial pendente</th></tr></thead><tbody>' +
      porEmp.empresas.map(function(e){ return '<tr><td><b>' + esc(e.empresa_id) + '</b></td><td class="num">' + e.total + '</td><td class="num">' + e.exercidos + '</td><td class="num">' + (e.em_risco ? '<span class="badge b-err">' + e.em_risco + '</span>' : '0') + '</td><td class="num">' + money(e.redutor_constituido) + '</td><td class="num">' + money(e.potencial_maximo) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<div class="card"><h2>Im&oacute;vel a im&oacute;vel</h2><table><thead><tr><th>C&oacute;digo</th><th>Empresa</th><th>Situa&ccedil;&atilde;o</th><th>Op&ccedil;&otilde;es do art. 375</th><th class="num">Em jogo</th></tr></thead><tbody>' +
      inv.itens.map(function(i){
        var st = ST_ROTULO[i.status] || ['b-info', i.status];
        var ops = i.status === 'exercida' ? '<b>' + esc(i.escolha) + '</b> &mdash; ' + money(i.valor) + (i.justificativa ? '<div class="mini">' + esc(i.justificativa) + '</div>' : '')
          : (i.opcoes||[]).map(function(o){ return o.valor == null ? '<span class="mini">' + esc(o.rotulo) + ': indispon&iacute;vel</span>' : esc(o.rotulo) + ': <b>' + money(o.valor) + '</b>'; }).join('<br>');
        return '<tr><td><b>' + esc(i.codigo) + '</b><div class="mini">hip&oacute;tese ' + esc(i.hipotese) + '</div></td><td>' + esc(i.empresa_id||'—') + '</td><td><span class="badge ' + st[0] + '">' + st[1] + '</span>' +
          (i.pendencias.length ? '<div class="mini">' + i.pendencias.map(function(p){ return esc(p.msg); }).join('<br>') + '</div>' : '') + (i.observacao ? '<div class="mini">' + esc(i.observacao) + '</div>' : '') + '</td>' +
          '<td class="mini">' + (ops || '—') + '</td><td class="num">' + (i.diferenca_entre_opcoes ? '<b>' + money(i.diferenca_entre_opcoes) + '</b>' : '—') + '</td></tr>'; }).join('') + '</tbody></table>' + imobSelo() + '</div>';
    $('iv-out').innerHTML = h;
  }
  if (IMOB_CARTEIRA) { pintar(IMOB_CARTEIRA); return; }
  var sem = imobSemBanco();
  if (sem) { $('iv-out').innerHTML = '<div class="card">' + sem + '<div class="mini" style="margin-top:8px">Use "carteira de exemplo" para ver a tela funcionando.</div></div>'; return; }
  $('iv-out').innerHTML = '<div class="card"><div class="info">&#8987; Carregando a carteira&hellip;</div></div>';
  imobDB.listarImoveis(imobCtxDB()).then(function(rows){ IMOB_CARTEIRA = rows || []; pintar(IMOB_CARTEIRA); })
    .catch(function(e){ $('iv-out').innerHTML = '<div class="card">' + imobAvisoDB('Falha ao ler a carteira — ' + esc(e.erro||e)) + '</div>'; });
}); }

/* ---------- persistência ligada à tela ---------- */
var IMOB_CTX_DB = { escritorio_id: null, empresa_id: null, usuario_id: null, usuario_uuid: null };
var IMOB_IMOVEL_ID = null;
function imobCtxDB(extra){
  var c = { escritorio_id: IMOB_CTX_DB.escritorio_id, empresa_id: IMOB_CTX_DB.empresa_id, usuario_id: IMOB_CTX_DB.usuario_id, usuario_uuid: IMOB_CTX_DB.usuario_uuid, quando: new Date().toISOString() };
  if (extra) for (var k in extra) c[k] = extra[k];
  return c;
}
function imobAvisoDB(msg, tipo){ return '<div class="' + (tipo === 'ok' ? 'info' : 'aviso') + '">' + msg + '</div>'; }
function imobSemBanco(){
  if (IMOB_CTX_DB.escritorio_id) return null;
  return imobAvisoDB('<b>Sem escrit&oacute;rio na sess&atilde;o.</b> A grava&ccedil;&atilde;o usa o isolamento por escrit&oacute;rio (RLS), e sem ele nenhuma requisi&ccedil;&atilde;o &eacute; montada &agrave;s cegas. Saia e entre novamente; se persistir, confira se o seu usu&aacute;rio tem <code>escritorio_id</code> em <code>atp_usuarios</code>. <b>Nada foi gravado.</b>');
}
function imobSalvarImovel(){
  var alvo = $('just-ok') || $('raj-out');
  var sem = imobSemBanco(); if (sem) { alvo.innerHTML = sem; return; }
  var im = lerImovel();
  var reg = { codigo_interno: im.codigo_interno, tipo: im.tipo, matricula: im.matricula || null, endereco: im.endereco || null, municipio: im.municipio || null, uf: im.uf || null,
              data_aquisicao: im.data_aquisicao || null, valor_aquisicao: im.valor_aquisicao, valor_referencia: im.valor_referencia || null, em_construcao_2026: im.situacao === 'construcao' };
  if (window.ModulosInfo && ModulosInfo.imobiliario && ModulosInfo.imobiliario.cadastro_ampliado_no_banco) {
    reg.lote_unidade_bloco = im.lote_unidade_bloco || null; reg.area_total = im.area_total; reg.area_construida = im.area_construida; reg.fracao_ideal = im.fracao_ideal;
    reg.data_conclusao = im.data_conclusao || null; reg.custos_construcao = im.custos_construcao; reg.valor_referencia_origem = im.valor_referencia_origem;
    reg.valor_referencia_data = im.valor_referencia_data; reg.situacao = im.situacao; reg.documentos = im.documentos || null; reg.observacoes = im.observacoes || null;
  }
  if (RAJ && RAJ.opcoes) {
    var a = RAJ.opcoes.filter(function(o){ return o.chave === 'aquisicao'; })[0], b = RAJ.opcoes.filter(function(o){ return o.chave === 'referencia'; })[0];
    reg.raj_opcao_aquisicao = a ? a.valor : null; reg.raj_opcao_referencia = b ? b.valor : null;
  }
  if (IMOB_IMOVEL_ID) reg.id = IMOB_IMOVEL_ID;
  alvo.innerHTML = '<div class="info">&#8987; Gravando o im&oacute;vel&hellip;</div>';
  imobDB.salvarImovel(reg, imobCtxDB())
    .then(function(r){ if (r && r[0] && r[0].id) IMOB_IMOVEL_ID = r[0].id; alvo.innerHTML = imobAvisoDB('Im&oacute;vel gravado. Id: <code>' + esc(IMOB_IMOVEL_ID||'?') + '</code>' + (!(window.ModulosInfo && ModulosInfo.imobiliario.cadastro_ampliado_no_banco) ? ' <span class="mini">(campos ampliados guardados no snapshot de cada c&aacute;lculo; para grav&aacute;-los na tabela rode sql/setup_imob_v130.sql e ative <code>cadastro_ampliado_no_banco</code> no manifesto)</span>' : ''), 'ok'); })
    .catch(function(e){ alvo.innerHTML = imobAvisoDB('N&atilde;o gravado &mdash; ' + esc(e.erro || e) + ' <code>' + esc(e.codigo||'') + '</code>'); });
}
function imobFinalizar(){
  var alvo = $('v-out');
  var sem = imobSemBanco();
  var e = entradaVenda(), ctx = ctxPara('venda'), res = M.calcular(e, ctx);
  if (sem) { alvo.insertAdjacentHTML('afterbegin', sem); return; }
  if (res.status === 'BLOQUEADO') { alvo.insertAdjacentHTML('afterbegin', imobAvisoDB('C&aacute;lculo bloqueado n&atilde;o &eacute; finalizado.')); return; }
  var chave = 'imob-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8);
  e.premissas_editadas = PR.alteradas(PREM).map(function(p){ return { chave: p.chave, valor: p.valor_vigente, original: p.valor_automatico, justificativa: p.justificativa, quando: p.quando }; });
  e.cadastro_imovel = IMOVEL.codigo_interno ? IMOVEL : undefined;
  alvo.insertAdjacentHTML('afterbegin', '<div id="fin-status" class="info">&#8987; Finalizando e gravando&hellip;</div>');
  imobDB.finalizarCalculo(e, res, ctx, imobCtxDB({ request_id: chave, imovel_id: IMOB_IMOVEL_ID,
      engine_build_id: (window.APP_VERSAO || 'imob-' + versaoApp()) }))
    .then(function(r){
      var s = registrarSimulacao(e, res, 'Venda'); if (s) { s.status = 'final'; s.hash = r.hash_snapshot; gravarSims(); }
      var el = $('fin-status'); if (el) el.remove();
      alvo.insertAdjacentHTML('afterbegin', imobAvisoDB('C&aacute;lculo finalizado e gravado. Hash <code>' + esc(r.hash_snapshot) + '</code> · confian&ccedil;a <b>' + esc(r.nivel_confianca) + '</b>. Reenviar a mesma requisi&ccedil;&atilde;o n&atilde;o cria segundo snapshot.', 'ok'));
    })
    .catch(function(x){ var el = $('fin-status'); if (el) el.remove(); alvo.insertAdjacentHTML('afterbegin', imobAvisoDB('N&atilde;o finalizado &mdash; ' + esc(x.erro||x))); });
}

/* ---------- histórico: pesquisa, comparação, duplicação, exportação ---------- */
var HIST_LISTA = [];
function filtrosHist(){ return { empresa: txt('h-emp'), imovel: txt('h-imo'), operacao: txt('h-op'), status: txt('h-st'), de: txt('h-de'), ate: txt('h-ate') }; }
function pintarHistorico(lista){
  HIST_LISTA = lista;
  var h = '<div class="card"><h2>' + lista.length + ' registro(s)</h2>' +
    (lista.length ? '<div class="toolbar"><button class="btn pri" onclick="imobCompararSelecionados()">Comparar selecionados</button></div>' +
    '<div style="overflow:auto"><table><thead><tr><th></th><th>Quando</th><th>Status</th><th>Empresa</th><th>Im&oacute;vel</th><th>Opera&ccedil;&atilde;o</th><th class="num">Valor</th><th class="num">Total</th><th>Confian&ccedil;a</th><th>Usu&aacute;rio</th><th>Premissas</th><th>Motor / ruleset</th><th>Hash</th><th></th></tr></thead><tbody>' +
    lista.map(function(s, i){ return '<tr><td><input type="checkbox" class="hist-sel" data-i="' + i + '"></td><td class="mini">' + esc(String(s.quando).slice(0,16).replace('T',' ')) + '</td>' +
      '<td><span class="badge ' + (s.status === 'final' ? 'b-ok' : 'b-warn') + '">' + esc(s.status) + '</span></td><td>' + esc(s.empresa||'—') + '</td><td>' + esc(s.imovel||'—') + '</td><td>' + esc(s.operacao||'—') + '</td>' +
      '<td class="num">' + money(s.valor_operacao) + '</td><td class="num"><b>' + money(s.total) + '</b></td><td><span class="badge ' + (s.confianca==='ALTA'?'b-ok':s.confianca==='BAIXA'?'b-err':'b-warn') + '">' + esc(s.confianca||'—') + '</span></td>' +
      '<td class="mini">' + esc(s.usuario||'—') + '</td><td class="mini">' + (s.premissas ? '<span class="badge b-edit">editadas</span> ' + (Array.isArray(s.premissas) ? s.premissas.map(function(p){ return esc(p.chave) + '=' + esc(p.valor); }).join(', ') : '') : 'autom&aacute;ticas') + '</td>' +
      '<td class="mini">' + esc(s.motor||'—') + ' · ' + esc(s.ruleset||'—') + '</td><td class="mini"><code>' + esc(String(s.hash||'—').slice(0,12)) + '</code></td>' +
      '<td><button class="btn" style="padding:4px 8px" onclick="imobDuplicar(' + i + ')">duplicar</button> <button class="btn" style="padding:4px 8px" onclick="imobVerSim(' + i + ')">ver</button></td></tr>'; }).join('') +
    '</tbody></table></div>' : '<div class="info">Nenhum registro para os filtros informados.</div>') + '</div><div id="hi-cmp"></div>';
  $('hi-out').innerHTML = h;
}
function imobHistorico(){ acao(function(){
  carregarSims();
  var f = filtrosHist(), local = RL.filtrarHistorico(SIMS, f);
  var sem = imobSemBanco();
  if (sem || f.status === 'preliminar') { pintarHistorico(local); if (sem && !SIMS.length) $('hi-out').innerHTML = '<div class="card">' + sem + '</div>'; return; }
  $('hi-out').innerHTML = '<div class="card"><div class="info">&#8987; Lendo os c&aacute;lculos gravados&hellip;</div></div>';
  imobDB.listarCalculos(imobCtxDB({ limite: 100, filtros: { operacao: f.operacao, de: f.de, ate: f.ate } }))
    .then(function(rows){
      var db = (rows || []).map(function(r){ return { id: r.id, quando: r.calculado_em, status: 'final', usuario: r.calculado_por, empresa: r.empresa_id, imovel: (r.entrada && r.entrada.imovel && (r.entrada.imovel.codigo_interno || r.entrada.imovel.id)) || r.imovel_id, entrada: r.entrada || {}, resultado: r.resultado || {}, nivel_confianca: r.nivel_confianca, hash_snapshot: r.hash_snapshot, motor_versao: r.motor_versao, ruleset_versao: r.ruleset_versao, premissas: r.entrada && r.entrada.premissas_editadas && r.entrada.premissas_editadas.length ? r.entrada.premissas_editadas : null }; });
      var locais = local.filter(function(s){ return s.status !== 'final' || !db.some(function(d){ return d.hash_snapshot === s.hash; }); });
      pintarHistorico(RL.filtrarHistorico(db, f).concat(locais).sort(function(a,b){ return a.quando < b.quando ? 1 : -1; }));
    })
    .catch(function(e){ pintarHistorico(local); $('hi-out').insertAdjacentHTML('afterbegin', '<div class="card">' + imobAvisoDB('Falha ao ler o banco &mdash; ' + esc(e.erro||e) + '. Mostrando s&oacute; as simula&ccedil;&otilde;es locais.') + '</div>'); });
}); }
function imobCompararSelecionados(){
  var sel = Array.prototype.slice.call(document.querySelectorAll('.hist-sel:checked')).map(function(c){ return +c.dataset.i; });
  if (sel.length !== 2) { $('hi-cmp').innerHTML = '<div class="card"><div class="aviso">Marque exatamente duas linhas para comparar.</div></div>'; return; }
  var a = HIST_LISTA[Math.max(sel[0], sel[1])], b = HIST_LISTA[Math.min(sel[0], sel[1])];   // anterior = mais antiga
  var c = RL.compararSimulacoes(a, b);
  $('hi-cmp').innerHTML = '<div class="card"><h2>Compara&ccedil;&atilde;o de vers&otilde;es</h2><div class="mini">Anterior: ' + esc(String(c.anterior.quando).slice(0,16).replace('T',' ')) + ' (' + esc(c.anterior.status) + ') · Atual: ' + esc(String(c.atual.quando).slice(0,16).replace('T',' ')) + ' (' + esc(c.atual.status) + ')</div>' +
    '<table style="margin-top:10px"><thead><tr><th>Item</th><th class="num">Vers&atilde;o anterior</th><th class="num">Vers&atilde;o atual</th><th class="num">Altera&ccedil;&atilde;o</th></tr></thead><tbody>' +
    c.itens.map(function(i){ var f = i.tipo === 'pct' ? function(v){ return pct(v,4); } : money; return '<tr' + (i.mudou ? ' class="dif"' : '') + '><td>' + esc(i.item) + '</td><td class="num">' + f(i.anterior) + '</td><td class="num">' + f(i.atual) + '</td><td class="num"><b>' + (i.alteracao == null ? (i.mudou ? 'alterado' : '—') : f(i.alteracao)) + '</b></td></tr>'; }).join('') + '</tbody></table>' +
    (c.campos_alterados.length ? '<div class="aviso" style="margin-top:10px"><b>Outras altera&ccedil;&otilde;es:</b> ' + c.campos_alterados.map(function(x){ return esc(x.campo) + ': ' + esc(x.anterior||'—') + ' → ' + esc(x.atual||'—'); }).join(' · ') + '</div>' : '') +
    (c.identicas ? '<div class="aviso ok" style="margin-top:10px">As duas vers&otilde;es s&atilde;o id&ecirc;nticas nos itens comparados.</div>' : '') + '</div>';
}
function imobDuplicar(i){
  var s = HIST_LISTA[i]; if (!s) return;
  var e = s.entrada || {};
  if (e.operacao === 'venda') { $('v-val').value = e.valor_operacao; $('v-raj').value = e.redutor_ajuste_saldo || 0; $('v-cre').value = e.creditos || 0; $('v-data').value = e.data_fato_gerador || ''; if (e.imovel && e.imovel.tipo) $('v-tipo').value = e.imovel.tipo; $('v-pag').value = (e.pagamentos||[]).join(';'); $('v-rsu').value = e.redutor_social_ja_utilizado ? '1' : '0'; abrirAba('venda'); calcVenda(); }
  else if (e.operacao === 'locacao') { var l = e.locacao || {}; $('l-val').value = l.valor_mensal || e.valor_operacao; $('l-fim').value = l.finalidade || 'residencial'; $('l-mes').value = l.meses || 1; $('l-data').value = e.data_fato_gerador || ''; $('l-cre').value = e.creditos || 0; abrirAba('locacao'); calcLoc(); }
  else if (e.operacao === 'permuta') { var p = e.permuta || {}; $('x-val').value = e.valor_operacao; $('x-parte').value = p.contraparte || 'contribuinte'; $('x-tpaga').value = p.torna_paga_por === 'contribuinte' ? p.torna : 0; $('x-trec').value = p.torna_paga_por === 'nao_contribuinte' ? p.torna : 0; $('x-raj').value = p.redutor_ajuste_dado || 0; $('x-data').value = e.data_fato_gerador || ''; abrirAba('permuta'); calcPerm(); }
  else { $('hi-cmp').innerHTML = '<div class="card"><div class="aviso">Duplica&ccedil;&atilde;o dispon&iacute;vel para venda, loca&ccedil;&atilde;o e permuta. Use a aba Regimes opcionais para refazer o c&aacute;lculo de ' + esc(e.operacao||'?') + '.</div></div>'; }
}
function imobVerSim(i){
  var s = HIST_LISTA[i]; if (!s) return;
  $('hi-cmp').innerHTML = '<div class="card"><h2>Registro ' + esc(String(s.quando).slice(0,16).replace('T',' ')) + '</h2><div class="mini">Premissas utilizadas: ' + (s.premissas ? '<span class="badge b-edit">editadas</span>' : 'autom&aacute;ticas (padr&atilde;o do m&oacute;dulo)') + ' · usu&aacute;rio ' + esc(s.usuario||'—') + ' · ' + esc(s.status) + '</div>' +
    '<pre style="white-space:pre-wrap;font-size:11px;max-height:320px;overflow:auto;background:var(--bg);padding:12px;border-radius:8px;margin-top:8px">' + esc(JSON.stringify({ entrada: s.entrada, resultado: { base: s.base, ibs: s.ibs, cbs: s.cbs, creditos: s.creditos, total: s.total }, premissas: s.premissas }, null, 1)) + '</pre></div>';
}
function imobExportarHistorico(){
  carregarSims();
  var lista = HIST_LISTA.length ? HIST_LISTA : RL.filtrarHistorico(SIMS, filtrosHist());
  var csv = RL.exportarCSV(lista);
  var a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'analise_imobiliaria_historico_' + hojeISO() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
}
function imobListarImoveis(){
  var sem = imobSemBanco(); if (sem) { $('hi-out').innerHTML = '<div class="card">' + sem + '</div>'; return; }
  $('hi-out').innerHTML = '<div class="card"><div class="info">&#8987; Lendo os im&oacute;veis&hellip;</div></div>';
  imobDB.listarImoveis(imobCtxDB()).then(function(rows){ rows = rows || [];
      var f = txt('h-imo').toLowerCase(); if (f) rows = rows.filter(function(r){ return String(r.codigo_interno||'').toLowerCase().indexOf(f) >= 0; });
      $('hi-out').innerHTML = '<div class="card"><h2>' + rows.length + ' im&oacute;vel(is)</h2>' + (rows.length ? '<table><thead><tr><th>C&oacute;digo</th><th>Tipo</th><th>Matr&iacute;cula</th><th>Munic&iacute;pio</th><th>Op&ccedil;&atilde;o do art. 375</th><th class="num">Saldo do redutor</th></tr></thead><tbody>' +
        rows.map(function(r){ return '<tr><td><b>' + esc(r.codigo_interno) + '</b></td><td>' + esc(r.tipo) + '</td><td>' + esc(r.matricula||'—') + '</td><td>' + esc(r.municipio||'—') + (r.uf ? '/' + esc(r.uf) : '') + '</td><td>' + (r.raj_opcao_escolhida ? '<span class="badge b-ok">' + esc(r.raj_opcao_escolhida) + '</span><div class="mini">' + esc(r.raj_justificativa||'') + '</div>' : '<span class="badge b-warn">não exercida</span>') + '</td><td class="num">' + money(r.raj_saldo||0) + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="info">Nenhum im&oacute;vel cadastrado.</div>') + '</div>'; })
    .catch(function(e){ $('hi-out').innerHTML = '<div class="card">' + imobAvisoDB('Falha ao ler &mdash; ' + esc(e.erro||e)) + '</div>'; });
}

/* ---------- premissas: tela ---------- */
function pintaPremissas(){
  var lista = PR.listar(PREM);
  var h = '<table><thead><tr><th>Premissa</th><th class="num">Valor autom&aacute;tico</th><th class="num">Valor em uso</th><th>Origem · data · status</th><th>Justificativa</th><th></th></tr></thead><tbody>' +
    lista.map(function(p){ var fmt = function(v){ return p.unidade === 'R$' ? money(v) : p.unidade === '%' ? pct(v,2) : String(v).replace('.',','); };
      return '<tr class="pr-row' + (p.editada ? ' editada' : '') + '"><td><b>' + esc(p.rotulo) + '</b><div class="mini">' + esc(p.fundamento) + '</div></td><td class="num">' + fmt(p.valor_automatico) + '</td>' +
        '<td class="num"><input id="pr-' + p.chave + '" type="number" step="any" min="0" value="' + p.valor_vigente + '">' + (p.editada ? '<div><span class="badge b-edit">alterado manualmente</span></div>' : '') + '</td>' +
        '<td class="mini">' + esc(p.origem) + '<br>' + esc(p.data_premissa) + ' · <span class="badge ' + (p.status === 'ativa' ? 'b-ok' : p.status === 'estimada' ? 'b-warn' : 'b-info') + '">' + esc(p.status) + '</span></td>' +
        '<td><input id="prj-' + p.chave + '" placeholder="obrigat&oacute;ria para alterar" value="' + esc(p.justificativa||'') + '"></td>' +
        '<td><button class="btn" style="padding:5px 9px" onclick="imobPremissaAplicar(\'' + p.chave + '\')">Aplicar</button> ' + (p.editada ? '<button class="btn" style="padding:5px 9px" onclick="imobPremissaRestaurar(\'' + p.chave + '\')">Restaurar</button>' : '') + '</td></tr>'; }).join('') +
    '</tbody></table><div class="toolbar" style="margin-top:12px"><button class="btn" onclick="imobPremissaRestaurar()">Restaurar todas ao padr&atilde;o</button><span class="mini">Ao aplicar, o resultado das abas Venda, Loca&ccedil;&atilde;o e Permuta &eacute; recalculado imediatamente.</span></div><div id="pr-msg"></div>';
  $('pr-out').innerHTML = h;
}
function recalcularAbertos(){
  if ($('v-out').innerHTML) calcVenda();
  if ($('l-out').innerHTML) calcLoc();
  if ($('x-out').innerHTML) calcPerm();
  if ($('o-out').innerHTML) calcOpc();
  if ($('c-out').innerHTML) calcComp();
  CTX = ctxPara('venda');
}
function imobPremissaAplicar(chave){
  var r = PR.editar(PREM, chave, txt('pr-' + chave), txt('prj-' + chave), usuarioAtual());
  var msg = $('pr-msg');
  if (!r.ok) { msg.innerHTML = '<div class="aviso err">' + esc(r.msg) + '</div>'; return; }
  salvarPremissas(); pintaPremissas();
  $('pr-msg').innerHTML = '<div class="aviso ok">' + (r.restaurada ? 'Valor igual ao padr&atilde;o: a premissa volta a ser autom&aacute;tica.' : 'Premissa alterada e justificada. Os resultados foram recalculados.') + '</div>';
  recalcularAbertos();
}
function imobPremissaRestaurar(chave){
  if (chave) PR.restaurar(PREM, chave); else PR.restaurarTodas(PREM);
  salvarPremissas(); pintaPremissas(); $('pr-msg').innerHTML = '<div class="aviso ok">Premissa(s) restaurada(s) ao valor autom&aacute;tico.</div>'; recalcularAbertos();
}

/* ---------- auditoria, memória navegável, snapshot e relatórios ---------- */
var SEVCOR = { impeditivo:'b-err', alto:'b-err', medio:'b-warn', baixo:'b-info' };
function rodarAuditoria(){ acao(function(){
  var e = entradaVenda(), ctx = ctxPara('venda'), res = M.calcular(e, ctx);
  if (res.status === 'BLOQUEADO') { $('au-out').innerHTML = imobBloqueio(res); return; }
  var au = M.auditar(e, res, ctx);
  var h = '<div class="card"><h2>Resultado da auditoria</h2><div class="tot" style="font-size:22px">Confian&ccedil;a <span class="n-' + au.nivel_confianca + '">' + au.nivel_confianca + '</span></div>' +
    '<div class="' + (au.permite_conclusao_definitiva ? 'info' : 'aviso') + '" style="margin-top:10px">' + esc(au.mensagem) + '</div>' +
    (au.total ? '<table style="margin-top:8px"><thead><tr><th style="width:64px">C&oacute;digo</th><th style="width:96px">Severidade</th><th>Achado</th><th style="width:30%">Fonte</th></tr></thead><tbody>' +
      au.achados.map(function(x){ return '<tr><td><code>' + esc(x.codigo) + '</code></td><td><span class="badge ' + SEVCOR[x.severidade] + '">' + esc(x.severidade) + '</span></td><td><b>' + esc(x.titulo) + '</b><div class="mini">' + esc(x.detalhe) + '</div></td><td class="fund">' + esc(x.fonte || '—') + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="info">Nenhum achado.</div>') + imobSelo() + '</div>';
  h += '<div class="card"><h2>Por que este valor?</h2><div class="mini">Clique numa linha para abrir a trilha.</div><table style="margin-top:10px"><thead><tr><th>Linha</th><th class="num">Valor</th><th>Regra</th></tr></thead><tbody>' +
    res.linhas.map(function(l,i){ return '<tr style="cursor:pointer" onclick="trilha(' + i + ')"><td>' + esc(l.descricao) + '</td><td class="num">' + (l.ibs_reduzida != null ? 'IBS ' + pct(l.ibs_reduzida,4) + ' · CBS ' + pct(l.cbs_reduzida,4) : money(l.valor)) + '</td><td><code>' + esc(l.regra_id) + '</code></td></tr>'; }).join('') + '</tbody></table><div id="trilha-out"></div></div>';
  var extras = {};
  if (ULTIMO.comparativo && ULTIMO.comparativo.cmp && ULTIMO.comparativo.cmp.status === 'CALCULADO') { extras.comparativo = ULTIMO.comparativo.cmp; extras.projecao = ULTIMO.comparativo.projecao; }
  var pac = M.pacoteParecer(e, res, ctx, extras);
  h += '<div class="card"><h2>Pacote do parecer</h2><div class="grid g3"><div><label>Blocos</label><div class="tot" style="font-size:19px">13</div></div>' +
    '<div><label>N&uacute;meros autorizados</label><div class="tot" style="font-size:19px">' + pac.numeros_autorizados.length + '</div></div>' +
    '<div><label>Conclus&atilde;o</label><div class="tot" style="font-size:19px">' + esc(pac.bloco_11_conclusao.tipo.toUpperCase()) + '</div></div></div>' +
    '<div class="' + (pac.bloco_11_conclusao.permitida ? 'info' : 'aviso') + '" style="margin-top:12px">' + esc(pac.bloco_11_conclusao.instrucao) + '</div>' +
    '<div style="margin-top:12px"><label>Origem de cada linha</label><table><thead><tr><th>Linha</th><th>Origem</th></tr></thead><tbody>' +
      pac.bloco_06_memoria_de_calculo.map(function(l){ return '<tr><td>' + esc(l.descricao) + '</td><td><span class="badge b-info">' + esc(l.origem) + '</span></td></tr>'; }).join('') + '</tbody></table></div>' +
    (pac.bloco_13_limitacoes_e_premissas.length ? '<div style="margin-top:12px"><label>Limita&ccedil;&otilde;es e premissas</label>' + pac.bloco_13_limitacoes_e_premissas.map(function(x){ return '<div class="aviso">' + esc(x) + '</div>'; }).join('') + '</div>' : '') +
    '<div class="toolbar" style="margin-top:12px"><button class="btn" onclick="verPrompt()">Ver o prompt travado</button><button class="btn" onclick="testarGuarda()">Testar a guarda anti-alucina&ccedil;&atilde;o</button><button class="btn pri" onclick="imobGerarParecer()">Gerar parecer com IA</button></div><div id="prompt-out"></div></div>';
  var sn = M.montarSnapshot(e, res, ctx, { request_id: 'previa-' + txt('v-data'), empresa_id: 'previa' });
  var rep = M.reprocessar(sn);
  h += '<div class="card"><h2>Snapshot forense</h2><table><tbody><tr><td>Hash do snapshot</td><td class="num"><code>' + esc(sn.hash_snapshot) + '</code></td></tr>' +
    '<tr><td>Motor / ruleset</td><td class="num">' + esc(sn.corpo.versoes.motor) + ' &middot; ' + esc(sn.corpo.versoes.ruleset) + '</td></tr><tr><td>Lacre do motor</td><td class="num"><code>' + esc(sn.corpo.versoes.lacre_imob) + '</code></td></tr>' +
    '<tr><td>Reprocessamento</td><td class="num"><span class="badge ' + (rep.reproduzido ? 'b-ok' : 'b-err') + '">' + (rep.reproduzido ? 'idêntico' : 'divergente') + '</span></td></tr></tbody></table><div class="mini" style="margin-top:10px">' + esc(sn.nota_reprodutibilidade) + '</div></div>';
  window.__PAC = pac; window.__RES = res; window.__E = e; window.__AU = au; window.__CTX = ctx;
  $('au-out').innerHTML = h;
}); }
function pacoteRelatorio(op){
  op = op || 'venda';
  var u = ULTIMO[op], opCtx = op === 'locacao' ? 'locacao' : 'venda';
  var e, ctx, res, etapas, anos;
  if (u) { e = u.e; ctx = u.ctx; res = u.res; etapas = u.etapas; anos = u.anos; }
  else { e = entradaVenda(); ctx = ctxPara('venda'); res = M.calcular(e, ctx); }
  if (res.status === 'BLOQUEADO') return { erro: res };
  var ex = PR.explicar(PREM, opCtx);
  if (!etapas) etapas = RL.resultadoVenda(res, e, ex);
  if (anos === undefined) anos = calcularAnos(e, ctx);
  var au = M.auditar(e, res, ctx);
  var pessoa = PESSOA.nome ? PESSOA : {};
  return { titulo_operacao: { venda: 'Alienação de bem imóvel', locacao: 'Locação de bem imóvel', permuta: 'Permuta de bens imóveis' }[op] || op, entrada: e, res: res, etapas: etapas, anos: anos, expl: ex,
    grau: PR.grauCerteza(PREM, res, M.RULESET_VERSAO), premissas: PR.listar(PREM), coerencia: RL.coerencia(res, ex), auditoria: au,
    comparativo: ULTIMO.comparativo && ULTIMO.comparativo.cmp && ULTIMO.comparativo.cmp.status === 'CALCULADO' ? ULTIMO.comparativo.cmp : null,
    regras: M.REGRAS, ruleset: M.RULESET_VERSAO, motor: M.MOTOR_IMOB_VERSAO, lacre: M.LACRE_IMOB_HASH, app_versao: versaoApp(),
    empresa: { nome: pessoa.nome || IMOVEL.empresa || (window.EMP_GLOBAL && EMP_GLOBAL.nome) || '', cnpj: pessoa.documento ? docFormatado(pessoa.documento) : ((window.EMP_GLOBAL && EMP_GLOBAL.cnpj) || ''), tipo: pessoa.tipo || null, regime: pessoa.regime || null },
    imovel: IMOVEL.codigo_interno ? IMOVEL : e.imovel, calculado_em: new Date().toISOString(),
    ressalvas: ['A alíquota de referência de IBS/CBS (Res. CGIBS 14/2026) é estimativa não vinculante.', 'IRPJ e CSLL permanecem devidos nos dois cenários e não integram os valores de IBS/CBS.', 'A opção do art. 375 é definitiva por imóvel e deve ser exercida até 31/12/2026.'] };
}
function imobRelatorio(tipo, op){ acao(function(){
  var p = pacoteRelatorio(op);
  var alvo = $(op === 'locacao' ? 'l-out' : op === 'permuta' ? 'x-out' : op === 'venda' ? 'v-out' : 'au-out') || $('au-out');
  if (p.erro) { alvo.innerHTML = imobBloqueio(p.erro); return; }
  if (!p.coerencia.ok) { alvo.insertAdjacentHTML('afterbegin', '<div class="card"><div class="aviso err"><b>Relat&oacute;rio n&atilde;o emitido:</b> a confer&ecirc;ncia matem&aacute;tica apontou diverg&ecirc;ncia entre mem&oacute;ria e resultado.</div></div>'); return; }
  var html = tipo === 'executivo' ? RL.montarExecutivo(p) : tipo === 'tecnico' ? RL.montarTecnico(p) : tipo === 'simplificado' ? RL.montarSimplificado(p) : RL.montarMemoria(p);
  var w = window.open('', '_blank');
  if (!w) { alvo.insertAdjacentHTML('afterbegin', '<div class="card"><div class="aviso">O navegador bloqueou a janela do relat&oacute;rio. Permita pop-ups para este site e tente de novo.</div></div>'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(function(){ try { w.focus(); w.print(); } catch (e) {} }, 400);
}); }
function trilha(i){
  var l = window.__RES.linhas[i], pq = M.porQueEsteValor(l), pr = M.porQueEstaRegra(l.regra_id, window.__E, window.__CTX || CTX);
  $('trilha-out').innerHTML = '<div class="card" style="margin-top:14px;border-color:var(--primary)"><h2>' + esc(l.descricao) + '</h2><table><tbody>' +
    '<tr><td style="width:180px">Valor</td><td class="num"><b>' + (l.ibs_reduzida != null ? 'IBS ' + pct(l.ibs_reduzida,4) + ' · CBS ' + pct(l.cbs_reduzida,4) : money(pq.valor)) + '</b></td></tr><tr><td>F&oacute;rmula</td><td>' + esc(pq.formula) + '</td></tr>' +
    '<tr><td>Regra</td><td><code>' + esc(pq.regra.id) + '</code> v' + esc(pq.regra.versao) + ' <span class="badge ' + (pq.regra.status==='homologada'?'b-ok':'b-warn') + '">' + esc(pq.regra.status) + '</span></td></tr>' +
    '<tr><td>Condi&ccedil;&otilde;es</td><td>' + (pq.condicoes_satisfeitas.length ? pq.condicoes_satisfeitas.map(function(c){ return esc(c.campo) + ': ' + fmtEntrada(c.campo, c.valor); }).join('<br>') : '—') + '</td></tr>' +
    '<tr><td>Fontes</td><td class="fund">' + pq.fontes.map(esc).join('<br>') + '</td></tr></tbody></table><h2 style="margin-top:18px">Por que esta regra?</h2><table><tbody><tr><td style="width:180px">Preced&ecirc;ncia</td><td class="fund">' +
    pr.precedencia_normativa.map(function(f,ix){ return (ix+1) + '. ' + esc(f); }).join('<br>') + '</td></tr></tbody></table><div class="info" style="margin-top:12px">' + esc(pr.criterio_precedencia) + '</div></div>';
}
function verPrompt(){
  $('prompt-out').innerHTML = '<div class="card" style="margin-top:14px"><h2>Prompt travado</h2><pre style="white-space:pre-wrap;font-size:11px;max-height:340px;overflow:auto;background:#f7f9fb;padding:12px;border-radius:8px">' + esc(M.promptParecer(window.__PAC).slice(0,1600)) + '\n\n[...pacote JSON completo...]</pre></div>';
}
function testarGuarda(){
  var bomTxt = 'O tributo devido é de ' + money(window.__RES.total) + '. Portanto, incide o regime específico [vigencia_futura].';
  var ruim = 'Conclui-se que o valor é 99.999,99 e o regime é mais vantajoso.';
  var v1 = M.validarParecerIA(bomTxt, window.__PAC), v2 = M.validarParecerIA(ruim, window.__PAC);
  $('prompt-out').innerHTML = '<div class="card" style="margin-top:14px"><h2>Guarda anti-alucina&ccedil;&atilde;o</h2><table><thead><tr><th>Texto simulado</th><th style="width:110px">Veredito</th><th>Problemas</th></tr></thead><tbody>' +
    '<tr><td class="mini">' + esc(bomTxt) + '</td><td><span class="badge ' + (v1.aprovado?'b-ok':'b-err') + '">' + (v1.aprovado?'aprovado':'reprovado') + '</span></td><td class="mini">—</td></tr>' +
    '<tr><td class="mini">' + esc(ruim) + '</td><td><span class="badge b-err">reprovado</span></td><td class="mini">' + v2.problemas.map(function(p){ return '<b>' + esc(p.tipo) + '</b>: ' + p.itens.map(esc).join('; '); }).join('<br>') + '</td></tr></tbody></table>' +
    '<div class="info" style="margin-top:12px">A guarda confere cada n&uacute;mero contra os ' + window.__PAC.numeros_autorizados.length + ' valores autorizados, exige a marca de origem em toda frase conclusiva e bloqueia conclus&atilde;o definitiva quando a confian&ccedil;a &eacute; BAIXA.</div></div>';
}
function imobGerarParecer(){
  var alvo = $('prompt-out');
  if (typeof window.supaFn !== 'function') { alvo.innerHTML = '<div class="card" style="margin-top:14px"><div class="aviso">Sem a sess&atilde;o do aplicativo: o parecer usa a Edge Function <code>gerar-parecer-imobiliario</code>, com renova&ccedil;&atilde;o de token e limite de 150 s.</div></div>'; return; }
  alvo.innerHTML = '<div class="card" style="margin-top:14px"><div class="info">&#8987; Gerando e conferindo…</div></div>';
  ParecerImobIA.gerarParecerImob(window.__PAC, { nome: (window.EMP_GLOBAL && EMP_GLOBAL.nome) || IMOVEL.empresa || '', cnpj: (window.EMP_GLOBAL && EMP_GLOBAL.cnpj) || '' })
    .then(function(r){ var res = r.resultado;
      if (!r.ok) { alvo.innerHTML = '<div class="card" style="margin-top:14px"><h2>Texto descartado pela guarda</h2><div class="aviso">' + esc(res.mensagem) + '</div><table style="margin-top:8px"><thead><tr><th>Bloco</th><th>Problema</th></tr></thead><tbody>' +
          res.problemas.map(function(p){ return '<tr><td><b>' + esc(p.bloco) + '</b></td><td class="mini">' + p.problemas.map(function(x){ return esc(x.tipo) + ': ' + x.itens.map(esc).join('; '); }).join('<br>') + '</td></tr>'; }).join('') + '</tbody></table><div class="info" style="margin-top:12px">' + esc(r.orientacao) + '</div><div class="mini" style="margin-top:8px">Tentativas: ' + r.tentativas + '</div></div>'; return; }
      alvo.innerHTML = '<div class="card" style="margin-top:14px"><h2>Parecer gerado e conferido</h2><div class="info">' + esc(res.mensagem) + ' Tentativas: ' + r.tentativas + ' · ' + res.numeros_conferidos + ' n&uacute;mero(s) conferido(s) · ' + res.frases_conclusivas + ' frase(s) conclusiva(s).</div>' +
        ParecerImobIA.BLOCOS_TEXTO.map(function(b){ return res.blocos[b] ? '<div style="margin-top:14px"><label>' + esc(b) + '</label><div>' + esc(res.blocos[b]) + '</div></div>' : ''; }).join('') + '</div>'; })
    .catch(function(e){ alvo.innerHTML = '<div class="card" style="margin-top:14px"><div class="aviso">' + esc(e.erro || e) + ' <code>' + esc(e.codigo||'') + '</code></div></div>'; });
}

/* ---------- exports ---------- */
  window.abrirAba = abrirAba;
  window.calcRaj = calcRaj; window.escolher = escolher; window.gravarEscolha = gravarEscolha; window.imobLimparImovel = imobLimparImovel;
  window.calcVenda = calcVenda; window.calcLoc = calcLoc; window.calcPF = calcPF; window.calcPerm = calcPerm;
  window.pintaOpc = pintaOpc; window.calcOpc = calcOpc; window.calcComp = calcComp; window.pintaRegras = pintaRegras;
  window.rodarAuditoria = rodarAuditoria; window.trilha = trilha; window.verPrompt = verPrompt; window.testarGuarda = testarGuarda;
  window.imobSalvarImovel = imobSalvarImovel; window.imobFinalizar = imobFinalizar; window.imobHistorico = imobHistorico;
  window.imobListarImoveis = imobListarImoveis; window.imobGerarParecer = imobGerarParecer; window.imobRelatorio = imobRelatorio;
  window.imobInventario = imobInventario; window.imobInventarioExemplo = imobInventarioExemplo;
  window.imobCompararSelecionados = imobCompararSelecionados; window.imobDuplicar = imobDuplicar; window.imobVerSim = imobVerSim; window.imobExportarHistorico = imobExportarHistorico;
  window.imobSalvarCadastro = imobSalvarCadastro; window.imobLimparCadastro = imobLimparCadastro; window.imobCadastroTipo = imobCadastroTipo;
  window.imobEscolherOperacao = imobEscolherOperacao; window.imobMemoriaAba = imobMemoriaAba;
  window.imobPremissaAplicar = imobPremissaAplicar; window.imobPremissaRestaurar = imobPremissaRestaurar;
  window.__imobUI = { PREM: function(){ return PREM; }, ctxPara: ctxPara, entradaVenda: entradaVenda, entradaLocacao: entradaLocacao, registrarSimulacao: registrarSimulacao, parseNum: parseNum, pessoa: function(){ return PESSOA; }, sims: function(){ carregarSims(); return SIMS; } };

  window.imobEntrar = function(){
    try {
      IMOB_CTX_DB.escritorio_id = (window.APP && APP.escritorioId) || null;
      IMOB_CTX_DB.usuario_uuid  = (window.APP && APP.user && APP.user.id) || null;
      IMOB_CTX_DB.usuario_id    = (window.APP && APP.usuarioId != null) ? APP.usuarioId : null;
      IMOB_CTX_DB.empresa_id    = (window.EMP_GLOBAL && EMP_GLOBAL.id) || null;
    } catch (e) { console.warn('[imob] contexto:', e); }
    if (!window.__imobIniciado) {
      window.__imobIniciado = true;
      try { ligarAbas(); } catch (e) { console.warn('[imob] abas:', e); }
      try { var im = localStorage.getItem('atp_imob_imovel'); if (im) { im = JSON.parse(im); var mapa = { 'i-cod':'codigo_interno','i-emp':'empresa','i-mat':'matricula','i-end':'endereco','i-mun':'municipio','i-uf':'uf','i-tipo':'tipo','i-lote':'lote_unidade_bloco','i-atot':'area_total','i-acon':'area_construida','i-frac':'fracao_ideal','i-sit':'situacao','i-daq':'data_aquisicao','i-dcon':'data_conclusao','i-aq':'valor_aquisicao','i-cst':'custos_construcao','i-ref':'valor_referencia','i-reforig':'valor_referencia_origem','i-refdata':'valor_referencia_data','i-fat':'fator_ate_2026','i-doc':'documentos','i-obs':'observacoes' };
        Object.keys(mapa).forEach(function(id){ var el = $(id); if (el && im[mapa[id]] != null) el.value = im[mapa[id]]; }); } } catch (e) {}
      try { var mp = { 'cd-tipo':'tipo','cd-nome':'nome','cd-doc':'documento','cd-regime':'regime','cd-email':'email','cd-fone':'telefone','cd-mun':'municipio' };
        Object.keys(mp).forEach(function(id){ var el = $(id); if (el && PESSOA[mp[id]] != null && PESSOA[mp[id]] !== '') el.value = PESSOA[mp[id]]; });
        if ($('cd-obj') && PESSOA.atividade_imobiliaria_no_objeto != null) $('cd-obj').value = PESSOA.atividade_imobiliaria_no_objeto ? '1' : '0';
        imobCadastroTipo(); } catch (e) { console.warn('[imob] cadastro:', e); }
      try { pintaOpc(); } catch (e) { console.warn('[imob] opcionais:', e); }
      try { atualizarDatasInventario(); } catch (e) { console.warn('[imob] inventário:', e); }
      try { ligarMoney(); } catch (e) { console.warn('[imob] money:', e); }
      try { calcRaj(); } catch (e) { console.warn('[imob] redutor:', e); }
    }
  };
})();
