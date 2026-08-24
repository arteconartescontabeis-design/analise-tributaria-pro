
/* --- UI da aba Análise Imobiliária (v7.42.0) --- */
(function(){
  'use strict';


var M = MotorImob;
var CTX = {
  aliquotas: { ibs: 18.70, cbs: 9.21, classificacao: 'ESTIMADA', fonte: 'Res. CGIBS 14/2026' },
  parametros: { redutor_social_residencial_novo: 100000, redutor_social_lote_residencial: 30000,
                redutor_social_locacao_mes: 600, limite_pf_locacao: 240000 },
  indices: { ipca_fator: 1, competencia: '2026-01' }
};
function $(id){ return document.getElementById(id); }
function n($id){ var v = parseFloat(($($id)||{}).value); return isFinite(v) ? v : 0; }
function txt($id){ return (($($id)||{}).value || '').trim(); }
function money(v){ return v==null ? '—' : v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }

document.querySelectorAll('.tab').forEach(function(t){
  t.onclick = function(){
    document.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('on'); });
    t.classList.add('on');
    ['imovel','inventario','venda','locacao','permuta','opcional','comparativo','pf','auditoria','historico','regras'].forEach(function(k){
      $('t-'+k).style.display = (k === t.dataset.t) ? '' : 'none';
    });
    if (t.dataset.t === 'regras') pintaRegras();
    if (t.dataset.t === 'auditoria') rodarAuditoria();
    if (t.dataset.t === 'historico') imobHistorico();
    if (t.dataset.t === 'inventario') imobInventario();
  };
});

/* ---------- selo do motor ---------- */
function imobSelo(){
  var v = M.lacreVerificar();
  return '<div class="selo"><span class="badge ' + (v.integro?'b-ok':'b-err') + '">' +
    (v.integro ? 'motor íntegro' : 'MOTOR VIOLADO') + '</span>' +
    '<span>motorImob ' + v.motor_versao + ' · ruleset ' + M.RULESET_VERSAO +
    ' · selo <code>' + v.hash_atual + '</code></span></div>';
}

/* ---------- memória de cálculo ---------- */
function imobMemoria(res){
  var h = '<div class="card"><h2>Mem&oacute;ria de c&aacute;lculo e fundamenta&ccedil;&atilde;o por linha</h2><table><thead><tr>' +
    '<th style="width:26px">#</th><th>Linha</th><th>F&oacute;rmula</th><th class="num">Valor</th><th style="width:32%">Fundamento</th></tr></thead><tbody>';
  res.linhas.forEach(function(l){
    var st = l.regra_status === 'homologada' ? 'b-ok' : 'b-warn';
    h += '<tr><td class="mini">' + l.ordem + '</td><td><b>' + l.descricao + '</b>' +
      (l.entrada ? '<div class="mini">' + Object.keys(l.entrada).map(function(k){
         var vv = l.entrada[k]; return k.replace(/_/g,' ') + ': ' + (typeof vv === 'number' ? money(vv) : vv); }).join(' · ') + '</div>' : '') +
      '</td><td class="mini">' + (l.formula||'') + '</td><td class="num"><b>' + money(l.valor) + '</b></td>' +
      '<td class="fund">' + (l.fundamentos||[]).join('<br>') +
      '<div style="margin-top:4px"><span class="badge ' + st + '">' + l.regra_id + ' v' + l.regra_versao + ' · ' + l.regra_status + '</span></div></td></tr>';
  });
  h += '</tbody></table>';
  if (res.notas && res.notas.length) {
    h += '<div style="margin-top:14px">' + res.notas.map(function(x){ return '<div class="info">' + x + '</div>'; }).join('') + '</div>';
  }
  h += imobSelo() + '</div>';
  return h;
}
function imobBloqueio(res){
  return '<div class="card"><h2>C&aacute;lculo bloqueado</h2><div class="aviso">' + res.mensagem + '</div>' +
    '<table><thead><tr><th style="width:70px">C&oacute;digo</th><th>Motivo</th></tr></thead><tbody>' +
    res.bloqueios.map(function(b){ return '<tr><td><span class="badge b-err">' + b.codigo + '</span></td><td>' + b.msg + '</td></tr>'; }).join('') +
    '</tbody></table><div class="mini" style="margin-top:10px">Nenhuma estimativa foi produzida &mdash; o motor n&atilde;o preenche lacuna sozinho.</div>' + imobSelo() + '</div>';
}
function imobResumo(res, titulo){
  return '<div class="card"><h2>' + titulo + '</h2><div class="grid g4">' +
    '<div><label>Base de c&aacute;lculo</label><div class="tot" style="font-size:19px">' + money(res.base) + '</div></div>' +
    '<div><label>IBS</label><div class="tot" style="font-size:19px">' + money(res.ibs) + '</div></div>' +
    '<div><label>CBS</label><div class="tot" style="font-size:19px">' + money(res.cbs) + '</div></div>' +
    '<div><label>Total devido</label><div class="tot">' + money(res.total) + '</div>' +
      '<div class="mini">carga efetiva ' + res.aliquota_efetiva_sobre_operacao + '% sobre a opera&ccedil;&atilde;o</div></div>' +
    '</div><div style="margin-top:12px"><span class="badge b-info">confian&ccedil;a ' + res.confianca.nivel + '</span> ' +
    '<span class="mini">' + (res.confianca.motivos.join(' · ') || 'sem ressalvas') + '</span></div></div>';
}

/* ---------- redutor de ajuste ---------- */
var RAJ = null, RAJ_ESCOLHA = null;
function calcRaj(){
  var sit = txt('i-sit');
  var im = { valor_aquisicao: n('i-aq'),
             valor_referencia: n('i-ref') > 0 ? n('i-ref') : undefined,
             custos_ate_2026: n('i-cst'),
             em_construcao_2026: sit === 'construcao',
             adquirido_de_nao_contribuinte_apos_2027: sit === 'pos2027',
             data_aquisicao: '2028-04-10' };
  var c = JSON.parse(JSON.stringify(CTX)); c.indices.fator_ate_2026 = n('i-fat');
  RAJ = M.rajValorInicial(im, c); RAJ_ESCOLHA = null;
  var h = '<div class="card"><h2>Op&ccedil;&otilde;es do art. 375 &mdash; hip&oacute;tese ' + RAJ.hipotese + '</h2>';
  if (RAJ.bloqueios.length) {
    h += RAJ.bloqueios.map(function(b){ return '<div class="aviso"><b>' + b.codigo + '</b> ' + b.msg + '</div>'; }).join('');
  }
  h += '<div class="grid g2">' + RAJ.opcoes.map(function(o,i){
    if (o.valor === null) {
      return '<div class="opt off"><b>' + o.rotulo + '</b><div class="v">indispon&iacute;vel</div>' +
             '<div class="mini">' + o.nota + '</div><div class="fund" style="margin-top:6px">' + o.fundamento + '</div></div>';
    }
    return '<div class="opt" id="opt' + i + '" onclick="escolher(' + i + ')"><b>' + o.rotulo + '</b>' +
      '<div class="v">' + money(o.valor) + '</div>' +
      (o.detalhe ? '<div class="mini">' + Object.keys(o.detalhe).map(function(k){
        var vv = o.detalhe[k]; return k.replace(/_/g,' ') + ': ' + (typeof vv === 'number' ? money(vv) : vv); }).join(' · ') + '</div>' : '') +
      '<div class="fund" style="margin-top:6px">' + o.fundamento + '</div></div>';
  }).join('') + '</div>';
  h += '<div class="info" style="margin-top:14px">' + RAJ.recomendacao_neutra +
       ' Constitui&ccedil;&atilde;o em <b>' + RAJ.data_constituicao + '</b>.</div>';
  h += '<div id="just" style="display:none;margin-top:14px"><label>Justificativa da escolha (obrigat&oacute;ria e definitiva)</label>' +
       '<input id="just-txt" placeholder="por que esta op&ccedil;&atilde;o foi escolhida"> ' +
       '<button class="btn pri" style="margin-top:10px" onclick="gravarEscolha()">Gravar escolha</button> <button class="btn" style="margin-top:10px" onclick="imobSalvarImovel()">Salvar im&oacute;vel no banco</button></div>';
  h += '<div id="just-ok"></div>' + imobSelo() + '</div>';
  $('raj-out').innerHTML = h;
}
function escolher(i){
  RAJ_ESCOLHA = i;
  RAJ.opcoes.forEach(function(_,k){ var el = $('opt'+k); if (el) el.classList.toggle('sel', k === i); });
  $('just').style.display = '';
}
function gravarEscolha(){
  var j = txt('just-txt');
  if (!j) { $('just-ok').innerHTML = '<div class="aviso">A escolha do art. 375 exige justificativa gravada.</div>'; return; }
  var o = RAJ.opcoes[RAJ_ESCOLHA];
  $('just-ok').innerHTML = '<div class="card" style="margin-top:14px;border-color:var(--primary)">' +
    '<span class="badge b-ok">op&ccedil;&atilde;o exercida</span> <b>' + o.rotulo + '</b> &mdash; ' + money(o.valor) +
    '<div class="mini" style="margin-top:6px">Justificativa: ' + j + '</div>' +
    '<div class="mini">Constitui&ccedil;&atilde;o: ' + RAJ.data_constituicao + ' · saldo inicial do redutor: ' + money(o.valor) + '</div>' +
    '<div class="aviso" style="margin-top:10px">No app, esta escolha ser&aacute; gravada em <code>atp_imob_imoveis</code> e a trigger ' +
    '<code>atp_imob_trava_opcao_raj</code> impedir&aacute; troca posterior sem retifica&ccedil;&atilde;o formal.</div></div>';
  $('v-raj').value = o.valor;
}

/* ---------- venda ---------- */
function calcVenda(){
  var e = { operacao:'venda', data_fato_gerador: txt('v-data'), valor_operacao: n('v-val'),
            imovel: { id: txt('i-cod') || 'IM-1', tipo: txt('v-tipo') },
            redutor_ajuste_saldo: n('v-raj'), creditos: n('v-cre'),
            redutor_social_ja_utilizado: txt('v-rsu') === '1' };
  var pg = txt('v-pag');
  if (pg) e.pagamentos = pg.split(';').map(function(x){ return parseFloat(x.replace(',','.')); }).filter(function(x){ return isFinite(x); });
  var res = M.calcular(e, CTX);
  if (res.status === 'BLOQUEADO') { $('v-out').innerHTML = imobBloqueio(res); return; }
  var h = imobResumo(res, 'Resultado da aliena&ccedil;&atilde;o');
  if (res.parcelas && typeof res.parcelas[0] === 'object') {
    h += '<div class="card"><h2>IBS/CBS devidos em cada pagamento &mdash; art. 380</h2><table><thead><tr>' +
      '<th>#</th><th class="num">Pagamento</th><th class="num">Propor&ccedil;&atilde;o</th><th class="num">Redutor aplicado</th>' +
      '<th class="num">Base</th><th class="num">IBS</th><th class="num">CBS</th><th class="num">Devido</th></tr></thead><tbody>' +
      res.parcelas.map(function(p){ return '<tr><td>' + p.ordem + '</td><td class="num">' + money(p.pagamento) +
        '</td><td class="num">' + p.proporcao + '%</td><td class="num">' + money(p.redutor_aplicado) +
        '</td><td class="num">' + money(p.base) + '</td><td class="num">' + money(p.ibs) + '</td><td class="num">' +
        money(p.cbs) + '</td><td class="num"><b>' + money(p.total) + '</b></td></tr>'; }).join('') +
      '</tbody></table></div>';
  }
  $('v-out').innerHTML = h + imobMemoria(res);
}

/* ---------- locação ---------- */
function calcLoc(){
  var loc = { finalidade: txt('l-fim'), meses: n('l-mes') || 1,
    encargos_locatario: { prova_pagamento: txt('l-prova') === '1',
      tributos_emolumentos: n('l-trib'), condominio: n('l-cond'), foro_taxa_ocupacao: n('l-foro') } };
  if (n('l-prz') > 0) loc.prazo_dias = n('l-prz');
  if (n('l-dias') > 0) loc.dias_no_mes = n('l-dias');
  if (n('l-area') > 0) loc.fracao_area_residencial = n('l-area');
  var res = M.calcular({ operacao:'locacao', data_fato_gerador: txt('l-data'), valor_operacao: n('l-val'), locacao: loc }, CTX);
  $('l-out').innerHTML = res.status === 'BLOQUEADO' ? imobBloqueio(res)
    : imobResumo(res, 'Resultado da loca&ccedil;&atilde;o') + imobMemoria(res);
}

/* ---------- pessoa física ---------- */
function calcPF(){
  var c = JSON.parse(JSON.stringify(CTX)); c.indices.ipca_fator = n('p-fat') || 1;
  var r = M.pfEnquadramento({ receita_locacao_ano_anterior: n('p-rec'), imoveis_locados_distintos: n('p-qtd'),
    alienacoes_ano_anterior: n('p-ali'), alienacoes_construidos_proprio_ano_anterior: n('p-con'),
    alienacoes_ano_corrente: n('p-alic'), alienacoes_construidos_proprio_ano_corrente: n('p-conc') }, c);
  $('p-out').innerHTML = '<div class="card"><h2>Resultado do enquadramento</h2>' +
    '<div class="tot">' + (r.contribuinte ? 'CONTRIBUINTE' : 'N&Atilde;O CONTRIBUINTE') + '</div>' +
    (r.motivos.length ? '<table style="margin-top:14px"><thead><tr><th style="width:90px">Dispositivo</th><th>Motivo</th></tr></thead><tbody>' +
      r.motivos.map(function(m){ return '<tr><td><span class="badge b-warn">' + m.inciso + '</span></td><td>' + m.motivo + '</td></tr>'; }).join('') +
      '</tbody></table>' : '<div class="info" style="margin-top:14px">Nenhuma hip&oacute;tese do art. 382 foi atingida.</div>') +
    '<div class="grid g3" style="margin-top:16px">' +
      '<div><label>Limite original</label><div><b>' + money(r.limite_original) + '</b></div></div>' +
      '<div><label>Limite atualizado (&sect;4&ordm;)</label><div><b>' + money(r.limite_atualizado) + '</b></div></div>' +
      '<div><label>Limite + 20% (&sect;1&ordm;, III)</label><div><b>' + money(r.limite_mais_20) + '</b></div></div></div>' +
    '<div class="info" style="margin-top:14px">' + r.nota_prazo + '</div>' +
    '<div class="aviso">' + r.nota_temporada + '</div>' +
    '<div class="fund">' + r.fundamentos.join(' &middot; ') + '</div>' + imobSelo() + '</div>';
}

/* ---------- regras ---------- */
function pintaRegras(){
  var R = M.REGRAS;
  $('r-out').innerHTML = '<table><thead><tr><th>Regra</th><th>Nome</th><th>v</th><th>Status</th><th>Fontes legais</th></tr></thead><tbody>' +
    Object.keys(R).map(function(k){ var r = R[k];
      return '<tr><td><code>' + k + '</code></td><td>' + r.nome + '</td><td>' + r.versao + '</td>' +
        '<td><span class="badge ' + (r.status === 'homologada' ? 'b-ok' : 'b-warn') + '">' + r.status + '</span></td>' +
        '<td class="fund">' + r.fontes.join('<br>') + '</td></tr>'; }).join('') +
    '</tbody></table><div class="info" style="margin-top:14px">Nenhuma regra vai a <b>ativa</b> antes da dupla ' +
    'aprova&ccedil;&atilde;o do Passo 6. As duas em <b>staging</b> dependem da coleta da LC 214/2025 (arts. 47-56 e 343/346/348).</div>' + imobSelo();
}

/* ---------- permuta ---------- */
function calcPerm(){
  var pm = { contraparte: txt('x-parte'), torna: n('x-torna'), torna_paga_por: txt('x-quem'),
             redutor_ajuste_dado: n('x-raj'), unidades_a_construir: txt('x-uni')==='1',
             contraprestacao_diversa: txt('x-div')==='1' };
  if (n('x-fr') > 0) pm.fracao_ideal = n('x-fr');
  var res = M.calcular({ operacao:'permuta', data_fato_gerador:'2033-06-15', valor_operacao: n('x-val'), permuta: pm }, CTX);
  if (res.status === 'BLOQUEADO') { $('x-out').innerHTML = imobBloqueio(res); return; }
  var h = '<div class="card"><h2>Resultado da permuta</h2><div class="grid g3">' +
    '<div><label>Base tribut&aacute;vel (s&oacute; a torna)</label><div class="tot" style="font-size:19px">' + money(res.base) + '</div></div>' +
    '<div><label>Total devido</label><div class="tot">' + money(res.total) + '</div></div>' +
    '<div><label>Redutor de ajuste do im&oacute;vel recebido</label><div class="tot" style="font-size:19px">' +
      (res.redutor_ajuste_recebido == null ? 'n&atilde;o apurado' : money(res.redutor_ajuste_recebido)) + '</div></div></div></div>';
  $('x-out').innerHTML = h + imobMemoria(res);
}

/* ---------- regimes opcionais ---------- */
function pintaOpc(){
  var r = txt('o-reg');
  var html = '';
  if (r === 'ret') {
    html = '<div class="grid g4"><div><label>Modalidade</label><select id="o-mod">' +
      '<option value="normal">Normal &mdash; 2,08%</option><option value="social">Interesse social &mdash; 0,53%</option></select></div>' +
      '<div><label>Patrim&ocirc;nio de afeta&ccedil;&atilde;o comprovado?</label><select id="o-afe"><option value="1">Sim</option><option value="0">N&atilde;o</option></select></div>' +
      '<div><label>Redutor de ajuste dispon&iacute;vel</label><input id="o-raj" type="number" value="600000"></div>' +
      '<div><label>Cr&eacute;ditos no regime comum</label><input id="o-cre" type="number" value="0"></div></div>';
  } else if (r === 'loteamento') {
    html = '<div class="grid g4"><div><label>Registro efetivado antes de 2029?</label><select id="o-reg28"><option value="1">Sim</option><option value="0">N&atilde;o</option></select></div>' +
      '<div><label>Redutor de ajuste dispon&iacute;vel</label><input id="o-raj" type="number" value="200000"></div>' +
      '<div><label>Cr&eacute;ditos no regime comum</label><input id="o-cre" type="number" value="0"></div></div>';
  } else {
    html = '<div class="grid g4"><div><label>Finalidade</label><select id="o-fim">' +
      '<option value="nao_residencial">N&atilde;o residencial</option><option value="residencial">Residencial</option></select></div>' +
      '<div><label>Firmado at&eacute; 16/01/2025?</label><select id="o-fir"><option value="1">Sim</option><option value="0">N&atilde;o</option></select></div>' +
      '<div><label>Data comprovada?</label><select id="o-dc"><option value="1">Sim</option><option value="0">N&atilde;o</option></select></div>' +
      '<div><label>Registrado em cart&oacute;rio at&eacute; 2025?</label><select id="o-rc"><option value="1">Sim</option><option value="0">N&atilde;o</option></select></div></div>' +
      '<div class="mini" style="margin-top:8px">Contrato n&atilde;o residencial exige tamb&eacute;m prazo determinado &mdash; considerado sim nesta pr&eacute;via.</div>';
  }
  $('o-campos').innerHTML = html;
}
function calcOpc(){
  var r = txt('o-reg'), e = { operacao: r, data_fato_gerador: txt('o-data'), valor_operacao: n('o-val') };
  if (r === 'ret') {
    e.ret = { modalidade: txt('o-mod'), patrimonio_afetacao: txt('o-afe') === '1' };
    e.redutor_ajuste_saldo = n('o-raj'); e.creditos = n('o-cre');
    e.imovel = { id:'CMP', tipo:'residencial_novo' };
  } else if (r === 'loteamento') {
    e.loteamento = { registro_ate_2028: txt('o-reg28') === '1' };
    e.redutor_ajuste_saldo = n('o-raj'); e.creditos = n('o-cre');
    e.imovel = { id:'CMP', tipo:'lote_residencial' };
  } else {
    e.contrato = { finalidade: txt('o-fim'), firmado_ate_16_01_2025: txt('o-fir')==='1',
                   prazo_determinado: true, data_comprovada: txt('o-dc')==='1',
                   registrado_ate_2025: txt('o-rc')==='1' };
  }
  var res = M.calcular(e, CTX);
  if (res.status === 'BLOQUEADO') { $('o-out').innerHTML = imobBloqueio(res); return; }
  var h = imobResumoOpc(res);
  if (r !== 'locacao_transitoria') {
    var c = M.compararRegimes(e, CTX);
    if (c.status === 'CALCULADO') {
      h += '<div class="card"><h2>Regime opcional &times; regime espec&iacute;fico comum</h2>' +
        '<table><thead><tr><th>Cen&aacute;rio</th><th class="num">Carga</th><th class="num">Total devido</th></tr></thead><tbody>' +
        '<tr><td>' + c.opcional.rotulo + '</td><td class="num">' + c.opcional.aliquota + '%</td><td class="num"><b>' + money(c.opcional.total) + '</b></td></tr>' +
        '<tr><td>' + c.regular.rotulo + '<div class="mini">redutor de ajuste ' + money(c.regular.redutor_usado) +
          ' · redutor social ' + money(c.regular.redutor_social) + ' · cr&eacute;ditos ' + money(c.regular.creditos) + '</div></td>' +
        '<td class="num">' + c.regular.aliquota + '%</td><td class="num"><b>' + money(c.regular.total) + '</b></td></tr>' +
        '</tbody></table><div class="info" style="margin-top:12px">Diferen&ccedil;a: <b>' + money(Math.abs(c.diferenca)) +
        '</b> a favor do <b>' + (c.menor === 'opcional' ? 'regime opcional' : c.menor === 'regular' ? 'regime comum' : 'empate') + '</b>.</div>' +
        '<div class="aviso"><b>O que se renuncia ao optar:</b> ' + c.renuncias.join(' · ') + '</div>' +
        '<div class="aviso">' + c.ressalva + '</div></div>';
    }
  }
  $('o-out').innerHTML = h + imobMemoria(res);
}
function imobResumoOpc(res){
  return '<div class="card"><h2>Resultado do regime opcional</h2><div class="grid g3">' +
    '<div><label>Base</label><div class="tot" style="font-size:19px">' + money(res.base) + '</div></div>' +
    '<div><label>Al&iacute;quota</label><div class="tot" style="font-size:19px">' + res.aliquota_efetiva_sobre_operacao + '%</div></div>' +
    '<div><label>Total devido</label><div class="tot">' + money(res.total) + '</div></div></div>' +
    '<div style="margin-top:12px"><span class="badge b-info">confian&ccedil;a ' + res.confianca.nivel + '</span></div></div>';
}


/* ---------- comparativo e projeção ---------- */
var TRANSICAO = { 2026:{ibs:0.1,cbs:0.9,classificacao:'LEGAL'}, 2027:{ibs:0.05,cbs:9.11,classificacao:'LEGAL'},
 2028:{ibs:0.05,cbs:9.11,classificacao:'LEGAL'}, 2029:{ibs:1.87,cbs:9.21,classificacao:'ESTIMADA'},
 2030:{ibs:3.74,cbs:9.21,classificacao:'ESTIMADA'}, 2031:{ibs:5.61,cbs:9.21,classificacao:'ESTIMADA'},
 2032:{ibs:7.48,cbs:9.21,classificacao:'ESTIMADA'}, 2033:{ibs:18.70,cbs:9.21,classificacao:'ESTIMADA'} };

function calcComp(){
  var c = JSON.parse(JSON.stringify(CTX)); c.transicao = TRANSICAO;
  var op = { operacao:'venda', data_fato_gerador:'2033-06-30', valor_operacao: n('c-rv') || n('c-rl'),
             imovel:{ id:'CMP', tipo: txt('c-tipo') }, redutor_ajuste_saldo: n('c-raj') };
  var cmp = M.comparativoAtualXReforma({
    atual: { receita_venda: n('c-rv'), receita_locacao: n('c-rl'), receita_servicos: n('c-rs'),
             atividade_imobiliaria_no_objeto: txt('c-obj')==='1', meses_periodo: n('c-me') || 3 },
    reforma: op }, c);
  if (cmp.status === 'BLOQUEADO') { $('c-out').innerHTML = '<div class="card"><div class="aviso">' + cmp.mensagem + '</div></div>'; return; }

  var h = '<div class="card"><h2>Comparativo</h2><table><thead><tr><th>Cen&aacute;rio</th>' +
    '<th class="num">Substitu&iacute;veis<div class="mini">PIS/COFINS/ISS &rarr; IBS/CBS</div></th>' +
    '<th class="num">Permanentes<div class="mini">IRPJ + CSLL</div></th><th class="num">Total</th></tr></thead><tbody>' +
    cmp.linhas.map(function(l){ return '<tr><td>' + l.cenario + (l.indicativo ? ' <span class="badge b-warn">indicativo</span>' : '') +
      '</td><td class="num">' + money(l.substituiveis) + '</td><td class="num">' + money(l.permanentes) +
      '</td><td class="num"><b>' + money(l.total) + '</b></td></tr>'; }).join('') +
    '</tbody></table><div class="' + (cmp.variacao > 0 ? 'aviso' : 'info') + '" style="margin-top:12px">Varia&ccedil;&atilde;o: <b>' +
    money(Math.abs(cmp.variacao)) + '</b> (' + cmp.variacao_pct + '%) ' +
    (cmp.variacao > 0 ? 'a MAIS' : 'a MENOS') + ' no regime espec&iacute;fico.</div>' +
    '<div class="info">' + cmp.premissa + '</div><div class="aviso">' + cmp.ressalva + '</div></div>';

  var prj = M.projetarTransicao(op, c);
  if (prj.status === 'CALCULADO') {
    h += '<div class="card"><h2>Proje&ccedil;&atilde;o 2026-2033</h2><table><thead><tr><th>Ano</th>' +
      '<th class="num">IBS</th><th class="num">CBS</th><th class="num">Base</th><th class="num">Devido</th><th>Al&iacute;quota</th></tr></thead><tbody>' +
      prj.anos.map(function(a){ return '<tr><td>' + a.ano + (a.ano_teste ? ' <span class="badge b-info">ano-teste</span>' : '') +
        '</td><td class="num">' + a.ibs_aliquota + '%</td><td class="num">' + a.cbs_aliquota + '%</td>' +
        '<td class="num">' + money(a.base) + '</td><td class="num"><b>' + money(a.total) + '</b></td>' +
        '<td><span class="badge ' + (a.classificacao === 'LEGAL' ? 'b-ok' : 'b-warn') + '">' + a.classificacao + '</span></td></tr>'; }).join('') +
      '</tbody></table><div class="info" style="margin-top:12px">' + prj.nota + '</div>' +
      '<div class="fund">' + prj.fundamentos.join(' &middot; ') + '</div></div>';
  }

  var sn = M.sensibilidade(op, c, [-20,-10,0,10,20]);
  h += '<div class="card"><h2>Sensibilidade &agrave; al&iacute;quota de refer&ecirc;ncia</h2><table><thead><tr>' +
    '<th>Cen&aacute;rio</th><th class="num">Combinada</th><th class="num">Devido em 2033</th></tr></thead><tbody>' +
    sn.map(function(x){ return '<tr' + (x.variacao_pct===0?' style="background:var(--info-bg)"':'') + '><td>' +
      (x.variacao_pct>0?'+':'') + x.variacao_pct + '%</td><td class="num">' + x.combinada + '%</td>' +
      '<td class="num"><b>' + money(x.total) + '</b></td></tr>'; }).join('') +
    '</tbody></table><div class="aviso" style="margin-top:12px">Todos os cen&aacute;rios desta tabela s&atilde;o ' +
    '<b>SIMULA&Ccedil;&Atilde;O</b>. A al&iacute;quota de refer&ecirc;ncia ainda n&atilde;o foi fixada em norma.</div>' + imobSelo() + '</div>';

  $('c-out').innerHTML = h;
}

/* ---------- persistência ligada à tela ---------- */
var IMOB_CTX_DB = { escritorio_id: null, empresa_id: null, usuario_id: null, usuario_uuid: null };
var IMOB_IMOVEL_ID = null;

function imobCtxDB(extra){
  var c = { escritorio_id: IMOB_CTX_DB.escritorio_id, empresa_id: IMOB_CTX_DB.empresa_id,
            usuario_id: IMOB_CTX_DB.usuario_id, usuario_uuid: IMOB_CTX_DB.usuario_uuid,
            quando: new Date().toISOString() };
  if (extra) for (var k in extra) c[k] = extra[k];
  return c;
}
function imobAvisoDB(msg, tipo){
  return '<div class="' + (tipo === 'ok' ? 'info' : 'aviso') + '">' + msg + '</div>';
}
function imobSemBanco(){
  if (IMOB_CTX_DB.escritorio_id) return null;
  return imobAvisoDB('Sem sess&atilde;o do Análise Tributário Pro: a grava&ccedil;&atilde;o usa a mesma camada '
    + '<code>supa()</code> do app e o isolamento por escrit&oacute;rio. Nesta pr&eacute;via fora do aplicativo '
    + 'os bot&otilde;es de banco ficam inertes de prop&oacute;sito &mdash; nenhuma requisi&ccedil;&atilde;o &eacute; montada às cegas.');
}

function imobSalvarImovel(){
  var alvo = $('just-ok') || $('raj-out');
  var sem = imobSemBanco(); if (sem) { alvo.innerHTML = sem; return; }
  var im = { codigo_interno: txt('i-cod'), tipo: txt('v-tipo'),
             valor_aquisicao: n('i-aq'), valor_referencia: n('i-ref') || null,
             em_construcao_2026: txt('i-sit') === 'construcao' };
  if (RAJ && RAJ.opcoes) {
    var a = RAJ.opcoes.filter(function(o){ return o.chave === 'aquisicao'; })[0];
    var b = RAJ.opcoes.filter(function(o){ return o.chave === 'referencia'; })[0];
    im.raj_opcao_aquisicao = a ? a.valor : null;
    im.raj_opcao_referencia = b ? b.valor : null;
  }
  if (IMOB_IMOVEL_ID) im.id = IMOB_IMOVEL_ID;
  imobDB.salvarImovel(im, imobCtxDB())
    .then(function(r){
      if (r && r[0] && r[0].id) IMOB_IMOVEL_ID = r[0].id;
      alvo.innerHTML = imobAvisoDB('Im&oacute;vel gravado. Id: <code>' + (IMOB_IMOVEL_ID||'?') + '</code>', 'ok');
    })
    .catch(function(e){ alvo.innerHTML = imobAvisoDB('N&atilde;o gravado &mdash; ' + (e.erro || e) + ' <code>' + (e.codigo||'') + '</code>'); });
}

function imobFinalizar(){
  var alvo = $('v-out');
  var sem = imobSemBanco();
  var e = entradaVenda(), res = M.calcular(e, CTX);
  if (sem) { alvo.insertAdjacentHTML('afterbegin', sem); return; }
  var chave = 'imob-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8);
  imobDB.finalizarCalculo(e, res, CTX, imobCtxDB({
      request_id: chave, imovel_id: IMOB_IMOVEL_ID,
      engine_build_id: (window.APP_VERSAO || 'previa') }))
    .then(function(r){
      alvo.insertAdjacentHTML('afterbegin', imobAvisoDB('C&aacute;lculo finalizado e gravado. '
        + 'Hash <code>' + r.hash_snapshot + '</code> · confian&ccedil;a <b>' + r.nivel_confianca + '</b>. '
        + 'Reenviar a mesma requisi&ccedil;&atilde;o n&atilde;o cria segundo snapshot.', 'ok'));
    })
    .catch(function(x){ alvo.insertAdjacentHTML('afterbegin', imobAvisoDB('N&atilde;o finalizado &mdash; ' + (x.erro||x))); });
}

function imobHistorico(){
  var sem = imobSemBanco(); if (sem) { $('hi-out').innerHTML = '<div class="card">' + sem + '</div>'; return; }
  imobDB.listarCalculos(imobCtxDB({ limite: 50 }))
    .then(function(rows){
      rows = rows || [];
      $('hi-out').innerHTML = '<div class="card"><h2>' + rows.length + ' c&aacute;lculo(s)</h2>' +
        (rows.length ? '<table><thead><tr><th>Quando</th><th class="num">Total</th><th>Confian&ccedil;a</th>' +
          '<th>Motor / ruleset</th><th>Hash</th></tr></thead><tbody>' +
          rows.map(function(r){ return '<tr><td>' + (r.calculado_em||'').slice(0,16).replace('T',' ') +
            '</td><td class="num">' + money((r.resultado&&r.resultado.total)||0) + '</td>' +
            '<td><span class="badge ' + (r.nivel_confianca==='ALTA'?'b-ok':r.nivel_confianca==='BAIXA'?'b-err':'b-warn') +
            '">' + r.nivel_confianca + '</span></td><td class="mini">' + r.motor_versao + ' · ' + r.ruleset_versao +
            '</td><td class="mini"><code>' + String(r.hash_snapshot||'').slice(0,12) + '…</code></td></tr>'; }).join('') +
          '</tbody></table>' : '<div class="info">Nenhum c&aacute;lculo gravado ainda.</div>') + '</div>';
    })
    .catch(function(e){ $('hi-out').innerHTML = '<div class="card">' + imobAvisoDB('Falha ao ler &mdash; ' + (e.erro||e)) + '</div>'; });
}

function imobListarImoveis(){
  var sem = imobSemBanco(); if (sem) { $('hi-out').innerHTML = '<div class="card">' + sem + '</div>'; return; }
  imobDB.listarImoveis(imobCtxDB())
    .then(function(rows){
      rows = rows || [];
      $('hi-out').innerHTML = '<div class="card"><h2>' + rows.length + ' im&oacute;vel(is)</h2>' +
        (rows.length ? '<table><thead><tr><th>C&oacute;digo</th><th>Tipo</th><th>Op&ccedil;&atilde;o do art. 375</th>' +
          '<th class="num">Saldo do redutor</th></tr></thead><tbody>' +
          rows.map(function(r){ return '<tr><td><b>' + r.codigo_interno + '</b></td><td>' + r.tipo + '</td>' +
            '<td>' + (r.raj_opcao_escolhida ? '<span class="badge b-ok">' + r.raj_opcao_escolhida + '</span>' +
              '<div class="mini">' + (r.raj_justificativa||'') + '</div>' : '<span class="badge b-warn">não exercida</span>') +
            '</td><td class="num">' + money(r.raj_saldo||0) + '</td></tr>'; }).join('') +
          '</tbody></table>' : '<div class="info">Nenhum im&oacute;vel cadastrado.</div>') + '</div>';
    })
    .catch(function(e){ $('hi-out').innerHTML = '<div class="card">' + imobAvisoDB('Falha ao ler &mdash; ' + (e.erro||e)) + '</div>'; });
}



/* ---------- auditoria, memória navegável e snapshot ---------- */
function entradaVenda(){
  var e = { operacao:'venda', data_fato_gerador: txt('v-data'), valor_operacao: n('v-val'),
            imovel:{ id: txt('i-cod')||'IM-1', tipo: txt('v-tipo') },
            redutor_ajuste_saldo: n('v-raj'), creditos: n('v-cre'),
            redutor_social_ja_utilizado: txt('v-rsu')==='1' };
  var pg = txt('v-pag');
  if (pg) e.pagamentos = pg.split(';').map(function(x){ return parseFloat(x.replace(',','.')); }).filter(function(x){ return isFinite(x); });
  return e;
}
var SEVCOR = { impeditivo:'b-err', alto:'b-err', medio:'b-warn', baixo:'b-info' };

function rodarAuditoria(){
  var e = entradaVenda(), res = M.calcular(e, CTX);
  var au = M.auditar(e, res, CTX);
  var h = '<div class="card"><h2>Resultado da auditoria</h2>' +
    '<div class="tot" style="font-size:22px">Confian&ccedil;a ' + au.nivel_confianca + '</div>' +
    '<div class="' + (au.permite_conclusao_definitiva ? 'info' : 'aviso') + '" style="margin-top:10px">' + au.mensagem + '</div>' +
    (au.total ? '<table style="margin-top:8px"><thead><tr><th style="width:64px">C&oacute;digo</th><th style="width:96px">Severidade</th>' +
      '<th>Achado</th><th style="width:30%">Fonte</th></tr></thead><tbody>' +
      au.achados.map(function(x){ return '<tr><td><code>' + x.codigo + '</code></td>' +
        '<td><span class="badge ' + SEVCOR[x.severidade] + '">' + x.severidade + '</span></td>' +
        '<td><b>' + x.titulo + '</b><div class="mini">' + x.detalhe + '</div></td>' +
        '<td class="fund">' + (x.fonte || '—') + '</td></tr>'; }).join('') + '</tbody></table>'
      : '<div class="info">Nenhum achado.</div>') + imobSelo() + '</div>';

  h += '<div class="card"><h2>Por que este valor?</h2><div class="mini">Clique numa linha para abrir a trilha.</div>' +
    '<table style="margin-top:10px"><thead><tr><th>Linha</th><th class="num">Valor</th><th>Regra</th></tr></thead><tbody>' +
    res.linhas.map(function(l,i){ return '<tr style="cursor:pointer" onclick="trilha(' + i + ')"><td>' + l.descricao +
      '</td><td class="num">' + money(l.valor) + '</td><td><code>' + l.regra_id + '</code></td></tr>'; }).join('') +
    '</tbody></table><div id="trilha-out"></div></div>';

  var pac = M.pacoteParecer(e, res, CTX, {});
  h += '<div class="card"><h2>Pacote do parecer</h2><div class="grid g3">' +
    '<div><label>Blocos</label><div class="tot" style="font-size:19px">13</div></div>' +
    '<div><label>N&uacute;meros autorizados</label><div class="tot" style="font-size:19px">' + pac.numeros_autorizados.length + '</div></div>' +
    '<div><label>Conclus&atilde;o</label><div class="tot" style="font-size:19px">' + pac.bloco_11_conclusao.tipo.toUpperCase() + '</div></div></div>' +
    '<div class="' + (pac.bloco_11_conclusao.permitida ? 'info' : 'aviso') + '" style="margin-top:12px">' + pac.bloco_11_conclusao.instrucao + '</div>' +
    '<div style="margin-top:12px"><label>Origem de cada linha</label><table><thead><tr><th>Linha</th><th>Origem</th></tr></thead><tbody>' +
      pac.bloco_06_memoria_de_calculo.map(function(l){ return '<tr><td>' + l.descricao + '</td><td><span class="badge b-info">' + l.origem + '</span></td></tr>'; }).join('') +
      '</tbody></table></div>' +
    (pac.bloco_13_limitacoes_e_premissas.length ? '<div style="margin-top:12px"><label>Limita&ccedil;&otilde;es e premissas</label>' +
      pac.bloco_13_limitacoes_e_premissas.map(function(x){ return '<div class="aviso">' + x + '</div>'; }).join('') + '</div>' : '') +
    '<div style="margin-top:12px"><button class="btn" onclick="verPrompt()">Ver o prompt travado</button> ' +
    '<button class="btn" onclick="testarGuarda()">Testar a guarda anti-alucina&ccedil;&atilde;o</button> ' +
    '<button class="btn pri" onclick="imobGerarParecer()">Gerar parecer com IA</button></div>' +
    '<div id="prompt-out"></div></div>';

  var sn = M.montarSnapshot(e, res, CTX, { request_id: 'previa-' + txt('v-data'), empresa_id: 'previa' });
  var rep = M.reprocessar(sn);
  h += '<div class="card"><h2>Snapshot forense</h2><table><tbody>' +
    '<tr><td>Hash do snapshot</td><td class="num"><code>' + sn.hash_snapshot + '</code></td></tr>' +
    '<tr><td>Motor / ruleset</td><td class="num">' + sn.corpo.versoes.motor + ' &middot; ' + sn.corpo.versoes.ruleset + '</td></tr>' +
    '<tr><td>Lacre do motor</td><td class="num"><code>' + sn.corpo.versoes.lacre_imob + '</code></td></tr>' +
    '<tr><td>Reprocessamento</td><td class="num"><span class="badge ' + (rep.reproduzido ? 'b-ok' : 'b-err') + '">' +
      (rep.reproduzido ? 'idêntico' : 'divergente') + '</span></td></tr></tbody></table>' +
    '<div class="mini" style="margin-top:10px">' + sn.nota_reprodutibilidade + '</div></div>';

  window.__PAC = pac; window.__RES = res; window.__E = e;
  $('au-out').innerHTML = h;
}

function trilha(i){
  var l = window.__RES.linhas[i];
  var pq = M.porQueEsteValor(l), pr = M.porQueEstaRegra(l.regra_id, window.__E, CTX);
  $('trilha-out').innerHTML = '<div class="card" style="margin-top:14px;border-color:var(--primary)">' +
    '<h2>' + l.descricao + '</h2><table><tbody>' +
    '<tr><td style="width:180px">Valor</td><td class="num"><b>' + money(pq.valor) + '</b></td></tr>' +
    '<tr><td>F&oacute;rmula</td><td>' + pq.formula + '</td></tr>' +
    '<tr><td>Regra</td><td><code>' + pq.regra.id + '</code> v' + pq.regra.versao +
      ' <span class="badge ' + (pq.regra.status==='homologada'?'b-ok':'b-warn') + '">' + pq.regra.status + '</span></td></tr>' +
    '<tr><td>Condi&ccedil;&otilde;es</td><td>' + (pq.condicoes_satisfeitas.length
      ? pq.condicoes_satisfeitas.map(function(c){ return c.campo + ': ' + (typeof c.valor==='number'?money(c.valor):c.valor); }).join('<br>') : '—') + '</td></tr>' +
    '<tr><td>Fontes</td><td class="fund">' + pq.fontes.join('<br>') + '</td></tr></tbody></table>' +
    '<h2 style="margin-top:18px">Por que esta regra?</h2><table><tbody>' +
    '<tr><td style="width:180px">Preced&ecirc;ncia</td><td class="fund">' +
      pr.precedencia_normativa.map(function(f,ix){ return (ix+1) + '. ' + f; }).join('<br>') + '</td></tr></tbody></table>' +
    '<div class="info" style="margin-top:12px">' + pr.criterio_precedencia + '</div></div>';
}

function verPrompt(){
  $('prompt-out').innerHTML = '<div class="card" style="margin-top:14px"><h2>Prompt travado</h2>' +
    '<pre style="white-space:pre-wrap;font-size:11px;max-height:340px;overflow:auto;background:#f7f9fb;padding:12px;border-radius:8px">' +
    M.promptParecer(window.__PAC).slice(0,1600).replace(/</g,'&lt;') + '\n\n[...pacote JSON completo...]</pre></div>';
}

function testarGuarda(){
  var bomTxt = 'O tributo devido é de ' + money(window.__RES.total) + '. Portanto, incide o regime específico [vigencia_futura].';
  var ruim = 'Conclui-se que o valor é 99.999,99 e o regime é mais vantajoso.';
  var v1 = M.validarParecerIA(bomTxt, window.__PAC), v2 = M.validarParecerIA(ruim, window.__PAC);
  $('prompt-out').innerHTML = '<div class="card" style="margin-top:14px"><h2>Guarda anti-alucina&ccedil;&atilde;o</h2>' +
    '<table><thead><tr><th>Texto simulado</th><th style="width:110px">Veredito</th><th>Problemas</th></tr></thead><tbody>' +
    '<tr><td class="mini">' + bomTxt + '</td><td><span class="badge ' + (v1.aprovado?'b-ok':'b-err') + '">' + (v1.aprovado?'aprovado':'reprovado') + '</span></td><td class="mini">—</td></tr>' +
    '<tr><td class="mini">' + ruim + '</td><td><span class="badge b-err">reprovado</span></td><td class="mini">' +
      v2.problemas.map(function(p){ return '<b>' + p.tipo + '</b>: ' + p.itens.join('; '); }).join('<br>') + '</td></tr>' +
    '</tbody></table><div class="info" style="margin-top:12px">A guarda confere cada n&uacute;mero contra os ' +
    window.__PAC.numeros_autorizados.length + ' valores autorizados, exige a marca de origem em toda frase conclusiva ' +
    'e bloqueia conclus&atilde;o definitiva quando a confian&ccedil;a &eacute; BAIXA.</div></div>';
}

/* ---------- parecer com IA ---------- */
function imobGerarParecer(){
  var alvo = $('prompt-out');
  if (typeof window.supaFn !== 'function') {
    alvo.innerHTML = '<div class="card" style="margin-top:14px"><div class="aviso">' +
      'Sem a sess&atilde;o do Análise Tributário Pro: o parecer usa a mesma Edge Function ' +
      '<code>gerar-parecer</code> do app, com renova&ccedil;&atilde;o de token e limite de 150 s. ' +
      'Nesta pr&eacute;via fora do aplicativo o bot&atilde;o fica inerte de prop&oacute;sito.</div>' +
      '<div class="mini" style="margin-top:8px">O pacote, o payload e a guarda j&aacute; est&atilde;o prontos e ' +
      'testados &mdash; falta publicar o ramo <code>imobiliario</code> na function ' +
      '(ver EDGE_gerar_parecer_imobiliario.md).</div></div>';
    return;
  }
  alvo.innerHTML = '<div class="card" style="margin-top:14px"><div class="info">⏳ Gerando e conferindo…</div></div>';
  ParecerImobIA.gerarParecerImob(window.__PAC, {
      nome: (window.EMP_GLOBAL && EMP_GLOBAL.nome) || '', cnpj: (window.EMP_GLOBAL && EMP_GLOBAL.cnpj) || '' })
    .then(function(r){
      var res = r.resultado;
      if (!r.ok) {
        alvo.innerHTML = '<div class="card" style="margin-top:14px"><h2>Texto descartado pela guarda</h2>' +
          '<div class="aviso">' + res.mensagem + '</div>' +
          '<table style="margin-top:8px"><thead><tr><th>Bloco</th><th>Problema</th></tr></thead><tbody>' +
          res.problemas.map(function(p){ return '<tr><td><b>' + p.bloco + '</b></td><td class="mini">' +
            p.problemas.map(function(x){ return x.tipo + ': ' + x.itens.join('; '); }).join('<br>') + '</td></tr>'; }).join('') +
          '</tbody></table><div class="info" style="margin-top:12px">' + r.orientacao + '</div>' +
          '<div class="mini" style="margin-top:8px">Tentativas: ' + r.tentativas + '</div></div>';
        return;
      }
      alvo.innerHTML = '<div class="card" style="margin-top:14px"><h2>Parecer gerado e conferido</h2>' +
        '<div class="info">' + res.mensagem + ' Tentativas: ' + r.tentativas + ' · ' +
        res.numeros_conferidos + ' n&uacute;mero(s) conferido(s) · ' + res.frases_conclusivas + ' frase(s) conclusiva(s).</div>' +
        ParecerImobIA.BLOCOS_TEXTO.map(function(b){
          return res.blocos[b] ? '<div style="margin-top:14px"><label>' + b + '</label><div>' + res.blocos[b] + '</div></div>' : ''; }).join('') +
        '</div>';
    })
    .catch(function(e){
      alvo.innerHTML = '<div class="card" style="margin-top:14px"><div class="aviso">' +
        (e.erro || e) + ' <code>' + (e.codigo||'') + '</code></div></div>';
    });
}


/* ---------- inventário tributário de 31/12/2026 ---------- */
var IMOB_CARTEIRA = null;
var URG_COR = { PRAZO_VENCIDO:'b-err', CRITICA:'b-err', ALTA:'b-warn', MEDIA:'b-warn', NORMAL:'b-ok', DESCONHECIDA:'b-info' };
var ST_ROTULO = { exercida:['b-ok','op&ccedil;&atilde;o exercida'], pronto_para_escolher:['b-warn','pronto para escolher'],
                  faltam_dados:['b-err','faltam dados'], fora_do_inventario:['b-info','fora do invent&aacute;rio'] };

function imobInventarioExemplo(){
  IMOB_CARTEIRA = [
    { id:'1', codigo_interno:'AP-101', empresa_id:'Incorporadora A', tipo:'residencial_novo', valor_aquisicao:300000, valor_referencia:480000 },
    { id:'2', codigo_interno:'AP-102', empresa_id:'Incorporadora A', tipo:'comercial', valor_aquisicao:200000,
      raj_opcao_escolhida:'aquisicao', raj_justificativa:'Aquisi&ccedil;&atilde;o atualizada supera a refer&ecirc;ncia.', raj_saldo:290460 },
    { id:'3', codigo_interno:'LT-01', empresa_id:'Loteadora B', tipo:'lote_residencial' },
    { id:'4', codigo_interno:'SL-09', empresa_id:'Loteadora B', tipo:'comercial', valor_aquisicao:900000, valor_referencia:820000 },
    { id:'5', codigo_interno:'GL-22', empresa_id:'Holding C', tipo:'residencial_novo', valor_aquisicao:1200000, valor_referencia:1650000 }
  ];
  imobInventario();
}

function imobInventario(){
  var c = JSON.parse(JSON.stringify(CTX));
  c.indices = c.indices || {}; c.indices.fator_ate_2026 = n('iv-fator');
  c.hoje = txt('iv-hoje');

  function pintar(carteira){
    var inv = M.inventario2026(carteira, c);
    var porEmp = M.inventarioPorEmpresa(carteira, c);
    var t = inv.totais;
    var h = '<div class="card"><h2>Posi&ccedil;&atilde;o da carteira</h2>' +
      '<div class="grid g4">' +
      '<div><label>Prazo</label><div class="tot">' + (inv.dias_restantes >= 0 ? inv.dias_restantes + ' dias' : 'vencido') + '</div>' +
        '<div class="mini">at&eacute; ' + inv.data_corte + '</div></div>' +
      '<div><label>Urg&ecirc;ncia</label><div style="margin-top:6px"><span class="badge ' + URG_COR[inv.urgencia] + '" style="font-size:14px;padding:6px 14px">' + inv.urgencia.replace('_',' ') + '</span></div></div>' +
      '<div><label>Redutor j&aacute; constitu&iacute;do</label><div class="tot" style="font-size:19px">' + money(t.redutor_constituido) + '</div></div>' +
      '<div><label>Im&oacute;veis em risco</label><div class="tot" style="font-size:19px;color:' + (t.em_risco ? 'var(--err)' : 'var(--ok)') + '">' + t.em_risco + ' de ' + t.total + '</div></div>' +
      '</div>' +
      (inv.diferenca_em_jogo > 0 ? '<div class="aviso" style="margin-top:14px">Entre escolher uma op&ccedil;&atilde;o ou outra nos im&oacute;veis ainda pendentes, ' +
        'a diferen&ccedil;a de base de redutor &eacute; de <b>' + money(inv.diferenca_em_jogo) + '</b>.</div>' : '') +
      inv.alertas.map(function(a){ return '<div class="' + (a.nivel === 'critico' ? 'aviso' : 'info') + '">' + a.msg + '</div>'; }).join('') +
      '<div class="mini" style="margin-top:10px">' + inv.nota + '</div>' +
      '<div class="fund">' + (inv.fundamentos||[]).join(' &middot; ') + '</div></div>';

    h += '<div class="card"><h2>Por empresa</h2><table><thead><tr><th>Empresa</th><th class="num">Im&oacute;veis</th>' +
      '<th class="num">Decididos</th><th class="num">Em risco</th><th class="num">Redutor constitu&iacute;do</th>' +
      '<th class="num">Potencial pendente</th></tr></thead><tbody>' +
      porEmp.empresas.map(function(e){ return '<tr><td><b>' + e.empresa_id + '</b></td>' +
        '<td class="num">' + e.total + '</td><td class="num">' + e.exercidos + '</td>' +
        '<td class="num">' + (e.em_risco ? '<span class="badge b-err">' + e.em_risco + '</span>' : '0') + '</td>' +
        '<td class="num">' + money(e.redutor_constituido) + '</td><td class="num">' + money(e.potencial_maximo) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';

    h += '<div class="card"><h2>Im&oacute;vel a im&oacute;vel</h2><table><thead><tr><th>C&oacute;digo</th><th>Empresa</th>' +
      '<th>Situa&ccedil;&atilde;o</th><th>Op&ccedil;&otilde;es do art. 375</th><th class="num">Em jogo</th></tr></thead><tbody>' +
      inv.itens.map(function(i){
        var st = ST_ROTULO[i.status] || ['b-info', i.status];
        var ops = i.status === 'exercida'
          ? '<b>' + i.escolha + '</b> &mdash; ' + money(i.valor) + (i.justificativa ? '<div class="mini">' + i.justificativa + '</div>' : '')
          : (i.opcoes||[]).map(function(o){ return o.valor == null
              ? '<span class="mini">' + o.rotulo + ': indispon&iacute;vel</span>'
              : o.rotulo + ': <b>' + money(o.valor) + '</b>'; }).join('<br>');
        return '<tr><td><b>' + i.codigo + '</b><div class="mini">hip&oacute;tese ' + i.hipotese + '</div></td>' +
          '<td>' + (i.empresa_id||'—') + '</td>' +
          '<td><span class="badge ' + st[0] + '">' + st[1] + '</span>' +
            (i.pendencias.length ? '<div class="mini">' + i.pendencias.map(function(p){ return p.msg; }).join('<br>') + '</div>' : '') +
            (i.observacao ? '<div class="mini">' + i.observacao + '</div>' : '') + '</td>' +
          '<td class="mini">' + (ops || '—') + '</td>' +
          '<td class="num">' + (i.diferenca_entre_opcoes ? '<b>' + money(i.diferenca_entre_opcoes) + '</b>' : '—') + '</td></tr>';
      }).join('') + '</tbody></table>' + imobSelo() + '</div>';
    $('iv-out').innerHTML = h;
  }

  if (IMOB_CARTEIRA) { pintar(IMOB_CARTEIRA); return; }
  var sem = imobSemBanco();
  if (sem) { $('iv-out').innerHTML = '<div class="card">' + sem +
    '<div class="mini" style="margin-top:8px">Use "carteira de exemplo" para ver a tela funcionando.</div></div>'; return; }
  imobDB.listarImoveis(imobCtxDB())
    .then(function(rows){ IMOB_CARTEIRA = rows || []; pintar(IMOB_CARTEIRA); })
    .catch(function(e){ $('iv-out').innerHTML = '<div class="card">' + imobAvisoDB('Falha ao ler a carteira — ' + (e.erro||e)) + '</div>'; });
}

// nada é executado no carregamento: se algo falhasse aqui, as atribuições em
// window.* abaixo nunca aconteceriam e TODA a aba (inclusive imobEntrar) ficaria
// indefinida — quebrando o go() do app ao tentar abrir a aba.



  window.calcRaj = calcRaj; window.escolher = escolher; window.gravarEscolha = gravarEscolha;
  window.calcVenda = calcVenda; window.calcLoc = calcLoc; window.calcPF = calcPF;
  window.calcPerm = calcPerm; window.pintaOpc = pintaOpc; window.calcOpc = calcOpc;
  window.calcComp = calcComp; window.pintaRegras = pintaRegras; window.rodarAuditoria = rodarAuditoria;
  window.trilha = trilha; window.verPrompt = verPrompt; window.testarGuarda = testarGuarda;
  window.imobSalvarImovel = imobSalvarImovel; window.imobFinalizar = imobFinalizar;
  window.imobHistorico = imobHistorico; window.imobListarImoveis = imobListarImoveis;
  window.imobGerarParecer = imobGerarParecer;
  window.imobInventario = imobInventario; window.imobInventarioExemplo = imobInventarioExemplo;
  window.rodarAuditoria = rodarAuditoria; window.trilha = trilha;
  window.verPrompt = verPrompt; window.testarGuarda = testarGuarda;
  window.imobFinalizar = imobFinalizar; window.imobHistorico = imobHistorico;
  window.imobListarImoveis = imobListarImoveis; window.calcComp = calcComp;


  window.imobEntrar = function(){
    // contexto de banco vem do app: escritório, empresa e usuário logados
    try {
      IMOB_CTX_DB.escritorio_id = (window.APP && APP.escritorioId) || null;
      IMOB_CTX_DB.usuario_id    = (window.APP && APP.user && APP.user.id) || null;
      IMOB_CTX_DB.empresa_id    = (window.EMP_GLOBAL && EMP_GLOBAL.id) || null;
      if (window.RF_ALIQ_DEFAULT && typeof RF_ALIQ_DEFAULT.ibs === 'number') {
        CTX.aliquotas.ibs = RF_ALIQ_DEFAULT.ibs;
        CTX.aliquotas.cbs = RF_ALIQ_DEFAULT.cbs;
        CTX.aliquotas.fonte = 'RF_ALIQ_DEFAULT do Análise Tributária Pro';
      }
    } catch (e) { console.warn('[imob] contexto:', e); }
    // primeira entrada monta as telas; qualquer falha fica contida aqui dentro
    if (!window.__imobIniciado) {
      window.__imobIniciado = true;
      try { pintaOpc(); } catch (e) { console.warn('[imob] opcionais:', e); }
      try { calcRaj(); }  catch (e) { console.warn('[imob] redutor:', e); }
    }
  };
})();
