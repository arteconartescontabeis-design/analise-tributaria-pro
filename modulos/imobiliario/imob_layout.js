/* ============================================================================
 * imob_layout.js — APRESENTAÇÃO v1.5.0 (16/09/2026): menu lateral, passo 3, resultado em uma tela, gráficos
 *
 * Só reorganiza a área de RESULTADO de cada operação. Menu, formulários,
 * motor, regras, persistência e o HTML gerado pela UI ficam como estão.
 *
 * O que faz com o resultado que a UI já gerou (v-out, l-out, x-out, iv-out…):
 *   1. DESTAQUE — um cabeçalho com o número final (total líquido a recolher),
 *      os componentes (IBS, CBS, carga efetiva) e a base em uma linha;
 *   2. RELATÓRIOS — os botões de relatório sobem para o cabeçalho;
 *   3. ABAS INTERNAS — Resumo · Etapas · Ano a ano · Memória · Premissas e alertas
 *      (os cartões que a UI gera viram o conteúdo de cada aba; nada é apagado).
 * Reversível: ImobLayout.desfazer() devolve o conteúdo à ordem original.
 * ==========================================================================*/
(function (raiz) {
  'use strict';
  var P = '#page-imobiliaria.l2 ';
  var SAIDAS = ['v-out', 'l-out', 'x-out', 'o-out', 'c-out', 'pf-out', 'iv-out'];
  var CSS = [
    /* --- moldura única do resultado --- */
    P + '.res{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);margin:0 0 18px;overflow:hidden}',
    /* --- cabeçalho com o número final --- */
    P + '.res-hero{display:grid;grid-template-columns:auto 1fr auto;gap:14px 26px;align-items:center;padding:18px 22px;background:linear-gradient(135deg,#1a3a5c,#1a5276 60%,#2e86ab);color:#fff}',
    P + '.res-hero>div:first-child{grid-column:1}',
    P + '.res-hero .h-comp{grid-column:2}',
    P + '.res-hero .h-rot{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;opacity:.8}',
    P + '.res-hero .h-num{font-family:var(--display);font-size:38px;font-weight:600;line-height:1.05;margin-top:2px;white-space:nowrap}',
    P + '.res-hero .h-comp{display:grid;grid-template-columns:repeat(2,minmax(150px,1fr));gap:10px;max-width:520px}',
    P + '.res-hero .h-comp>div{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:8px 14px;min-width:120px}',
    P + '.res-hero .h-comp .r{font-size:10.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;opacity:.8;line-height:1.2}',
    P + '.res-hero .h-comp .v{font-size:17px;font-weight:600;margin-top:2px;white-space:nowrap}',
    P + '.res-hero .h-marca{grid-column:3;grid-row:2;justify-self:end;align-self:center;background:#fff;border-radius:6px;padding:3px 8px}',
    P + '.res-hero .h-base{grid-column:1 / span 2;font-size:12.5px;opacity:.9;border-top:1px solid rgba(255,255,255,.18);padding-top:10px}',
    P + '.res-hero .h-base b{font-weight:600}',
    P + '.res-hero .h-acoes{grid-column:3;grid-row:1;display:flex;flex-direction:column;gap:6px;align-self:stretch;justify-content:center;border-left:1px solid rgba(255,255,255,.18);padding-left:20px}',
    P + '.res-hero .h-acoes .rr{font-size:10.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;opacity:.8;margin-bottom:2px}',
    P + '.res-hero .h-acoes .rel-botoes,' + P + '.res-hero .h-acoes .toolbar{margin:0;display:flex;flex-direction:column;gap:6px}',
    P + '.res-hero .h-acoes .btn{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.35);color:#fff;padding:7px 12px;font-size:12.5px;text-align:left}',
    P + '.res-hero .h-acoes .btn.pri{background:#fff;color:var(--primary)}',
    P + '.res-hero .h-acoes .btn:hover{background:rgba(255,255,255,.28)}',
    P + '.res-hero .h-grau{display:inline-flex;align-items:center;gap:8px;font-size:12px;margin-top:8px;background:rgba(0,0,0,.18);padding:4px 10px;border-radius:20px}',
    P + '.res-hero .h-grau .badge{background:rgba(255,255,255,.2);color:#fff}',
    P + '.res-hero .h-grau [class^="n-"]{color:#fff}',
    '@media(max-width:1000px){' + P + '.res-hero{grid-template-columns:1fr}' + P + '.res-hero .h-acoes{grid-row:auto;border-left:0;padding-left:0;border-top:1px solid rgba(255,255,255,.18);padding-top:10px}' + P + '.res-hero .h-base{grid-column:auto}}',
    /* --- abas internas --- */
    P + '.res-abas{display:flex;gap:2px;padding:8px 12px 0;border-bottom:2px solid var(--border);background:var(--bg);flex-wrap:wrap}',
    P + '.res-aba{padding:9px 14px;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;user-select:none;border-radius:8px 8px 0 0;border:1px solid transparent;border-bottom:0;margin-bottom:-2px}',
    P + '.res-aba .q{font-weight:500;opacity:.7;margin-left:4px}',
    P + '.res-aba:hover{color:var(--primary)}',
    P + '.res-aba.on{background:var(--card);color:var(--primary);border-color:var(--border);border-bottom:2px solid var(--card)}',
    P + '.res-pane{display:none;padding:18px 22px}',
    P + '.res-pane.on{display:block}',
    P + '.res-pane>.card{border:0;box-shadow:none;padding:0;margin:0}',
    P + '.res-pane>.card>h2{display:none}',
    P + '.res-pane>.grau{margin:0}',
    /* --- resumo: tabela limpa das etapas --- */
    P + '.res-resumo{width:100%;border-collapse:collapse}',
    P + '.res-resumo td{padding:8px 10px;border-bottom:1px solid var(--border);font-size:13.5px}',
    P + '.res-resumo td.n{width:34px;color:var(--muted);font-size:12px}',
    P + '.res-resumo td.v{text-align:right;white-space:nowrap;font-weight:600}',
    P + '.res-resumo tr.dest td{background:var(--info-bg);font-weight:600}',
    P + '.res-resumo tr.tot td{background:var(--primary);color:#fff;font-size:15px}',
    P + '.res-resumo .f{color:var(--muted);font-size:11.5px;font-weight:400}',
    P + '.res-graficos{display:grid;grid-template-columns:1fr 1fr;gap:18px 28px}',
    P + '.res-graficos .graf:last-of-type{grid-column:1 / -1}',
    P + '.res-graficos .graf .mini{font-weight:600;color:var(--primary);margin-bottom:6px}',
    '@media(max-width:1100px){' + P + '.res-graficos{grid-template-columns:1fr}}',
    /* --- menu lateral: as abas do módulo listadas na barra da esquerda --- */
    '.sidebar{overflow-y:auto}',
    '.sidebar #imob-tabs{display:block;margin:0 10px 8px;padding:0;background:transparent;border:0;box-shadow:none}',
    '.sidebar #imob-tabs .tab{display:flex;align-items:center;gap:8px;padding:8px 12px 8px 26px;margin-bottom:2px;border-radius:8px;font-size:13px;font-weight:500;color:rgba(255,255,255,.8);border:0;white-space:normal;line-height:1.25}',
    '.sidebar #imob-tabs .tab:hover{background:rgba(255,255,255,.09);color:#fff}',
    '.sidebar #imob-tabs .tab.on{background:rgba(255,255,255,.16);color:#fff;font-weight:600;box-shadow:none}',
    '.sidebar #imob-tabs .tab-sep{font-size:9.5px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:rgba(255,255,255,.45);padding:10px 12px 4px 26px}',
    '@media(max-width:960px){.sidebar #imob-tabs .tab{padding-left:12px;font-size:0}.sidebar #imob-tabs .tab-sep{display:none}}'
  ].join('\n');

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tx(el) { return el ? el.innerHTML.replace(/<br\s*\/?>/gi, ' \u00b7 ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim() : ''; }
  function acha(ets, re) { return ets.filter(function (e) { return re.test(tx(e.querySelector('.r'))); })[0] || null; }
  function val(e) { return e ? tx(e.querySelector('.v')) : ''; }

  var ORIG = {};   // id → ordem original dos filhos, para desfazer

  function nomeAba(h2) {
    var t = tx(h2);
    if (/^Resultado/i.test(t)) return 'Etapas do cálculo';
    if (/^Posi/i.test(t)) return 'Alertas da carteira';
    if (/cada ano|2026 a 2033|^Proje/i.test(t)) return 'Ano a ano (2026–2033)';
    if (/Memória/i.test(t)) return 'Memória por linha';
    if (/Residencial/i.test(t)) return 'Residencial × não residencial';
    if (/Sensibilidade/i.test(t)) return 'Sensibilidade';
    if (/cada paga/i.test(t)) return 'Por parcela';
    if (/^Percentuais usados/i.test(t)) return 'Premissas e alertas';   // v1.6.0 — origem de cada percentual
    if (/^Observa/i.test(t)) return 'Etapas do cálculo';
    return t.length > 30 ? t.slice(0, 28) + '…' : t;
  }
  function qtd(card) { var t = card.querySelector('table'); if (t) return t.querySelectorAll('tbody tr').length; return card.querySelectorAll('.et').length || 0; }

  /* números já mostrados na tela → gráficos (ImobGraficos desenha; nada é recalculado) */
  function num(t) { t = String(t || '').replace(/[^\d,.-]/g, ''); if (!t) return 0; t = t.replace(/\./g, '').replace(',', '.'); var v = parseFloat(t); return isFinite(v) ? v : 0; }
  function graficosDaTela(ets, cards, total) {
    var g = raiz.ImobGraficos; if (!g || !ets.length) return null;
    var v = function (re) { var e = acha(ets, re); return e ? num(val(e)) : 0; };
    var box = document.createElement('div'); box.className = 'res-graficos'; var h = '';
    var comp = g.composicaoBase({ valor_operacao: v(/valor total|valor da opera|receita bruta/i), redutor_ajuste: v(/redutor de ajuste/i), redutor_social: v(/redutor social/i), deducoes: v(/dedu/i), base: v(/base de c\u00e1lculo/i) });
    if (comp) h += '<div class="graf"><div class="mini">Composi\u00e7\u00e3o da base de c\u00e1lculo</div>' + comp + '</div>';
    var carga = acha(ets, /carga efetiva/i);
    var ic = g.ibsCbs({ ibs: v(/^IBS/i), cbs: v(/^CBS/i), creditos: v(/cr\u00e9ditos efetivamente|cr\u00e9ditos aproveitados/i), total: total ? num(val(total)) : null, carga: carga ? val(carga) : null });
    if (ic) h += '<div class="graf"><div class="mini">Imposto por tributo</div>' + ic + '</div>';
    var anosCard = cards.filter(function (c) { return /cada ano|2026 a 2033/i.test(tx(c.querySelector('h2'))); })[0];
    if (anosCard) {
      var linhas = Array.prototype.slice.call(anosCard.querySelectorAll('tbody tr')).map(function (tr) { var td = tr.querySelectorAll('td'); if (td.length < 4) return null; var ano = parseInt(tx(td[0]), 10), pi = num(tx(td[1])), pc = num(tx(td[2])), tot = num(tx(td[3])), sm = pi + pc; return ano ? { ano: ano, ano_teste: /teste/i.test(tx(td[0])), valor_total: tot, valor_ibs: sm ? tot * pi / sm : tot, valor_cbs: sm ? tot * pc / sm : 0 } : null; }).filter(Boolean);
      var an = g.anoAAno(linhas, { destacar: 2033 }); if (an) h += '<div class="graf"><div class="mini">Quanto seria o imposto em cada ano (2026 a 2033)</div>' + an + '</div>';
    }
    if (!h) return null;
    box.innerHTML = h + '<div class="mini" style="margin-top:6px">Os mesmos gr\u00e1ficos saem nos relat\u00f3rios (Resumo para o cliente e Relat\u00f3rio executivo).</div>';
    return box;
  }

  function organizar(cont) {
    if (!cont || cont.dataset.l2) return;
    var filhos = Array.prototype.slice.call(cont.children);
    var cards = filhos.filter(function (c) { return c.classList.contains('card'); });
    if (!cards.length) return;
    ORIG[cont.id] = filhos.slice();
    cont.dataset.l2 = '1';

    var grau = filhos.filter(function (c) { return c.classList.contains('grau'); })[0] || null;
    var rel = cards.filter(function (c) { return /^Relat/i.test(tx(c.querySelector('h2'))); })[0] || null;
    var seq = cards[0].querySelector('.seq');
    var ets = seq ? Array.prototype.slice.call(seq.querySelectorAll('.et')) : [];

    var res = document.createElement('div'); res.className = 'res';

    /* ---- 1. cabeçalho com o número final ---- */
    var hero = document.createElement('div'); hero.className = 'res-hero';
    var total = acha(ets, /a recolher|l[ií]quido/i) || (ets.length ? ets[ets.length - 1] : null);
    var comps = [acha(ets, /^IBS/i), acha(ets, /^CBS/i), acha(ets, /carga efetiva/i), acha(ets, /créditos efetivamente/i)].filter(Boolean);
    var base = acha(ets, /base de cálculo/i), valor = acha(ets, /valor total|valor da opera/i), raj = acha(ets, /redutor de ajuste/i), rsoc = acha(ets, /redutor social/i);
    var grauTit = grau ? grau.querySelector('.titulo') : null;
    if (total) {
      hero.innerHTML =
        '<div><div class="h-rot">' + esc(tx(total.querySelector('.r'))) + '</div><div class="h-num">' + esc(val(total)) + '</div>' +
          (grauTit ? '<div class="h-grau">' + grauTit.innerHTML + '</div>' : '') + '</div>' +
        '<div class="h-comp">' + comps.map(function (e) { return '<div><div class="r">' + esc(tx(e.querySelector('.r'))) + '</div><div class="v">' + esc(val(e)) + '</div></div>'; }).join('') + '</div>' +
        (base ? '<div class="h-base">Base de cálculo <b>' + esc(val(base)) + '</b>' + (valor ? ' = valor da operação <b>' + esc(val(valor)) + '</b>' : '') + (raj ? ' − redutor de ajuste <b>' + esc(val(raj)) + '</b>' : '') + (rsoc ? ' − redutor social <b>' + esc(val(rsoc)) + '</b>' : '') + '</div>' : '');
    } else {
      // sem sequência de etapas (inventário, comparativo): os totais do primeiro cartão viram o cabeçalho
      var g4 = cards[0].querySelector('.grid');
      hero.innerHTML = '<div><div class="h-rot">' + esc(tx(cards[0].querySelector('h2'))) + '</div>' +
        (g4 ? '<div class="h-comp" style="margin-top:8px">' + Array.prototype.slice.call(g4.children).map(function (c) { var l = c.querySelector('label'), v = c.querySelector('.tot, .badge'); return '<div><div class="r">' + esc(tx(l)) + '</div><div class="v">' + esc(tx(v)) + '</div></div>'; }).join('') + '</div>' : '') + '</div><div></div>';
      if (g4) { g4.style.display = 'none'; g4.dataset.l2oculto = '1'; }   // os totais já estão no cabeçalho
    }
    if (rel) {
      var botoes = rel.querySelector('.rel-botoes') || rel.querySelector('.toolbar');
      if (botoes) { var ac = document.createElement('div'); ac.className = 'h-acoes'; ac.innerHTML = '<div class="rr">Relatórios</div>'; ac.appendChild(botoes); hero.appendChild(ac); }
      rel.style.display = 'none';
    }
    if (raiz.ImobMarca) { var mk = document.createElement('div'); mk.className = 'h-marca'; mk.innerHTML = raiz.ImobMarca.img(26); hero.appendChild(mk); }
    res.appendChild(hero);

    /* ---- 2. abas internas ---- */
    var barra = document.createElement('div'); barra.className = 'res-abas';
    var panes = [];
    function aba(nome, no, q) {
      var a = document.createElement('div'); a.className = 'res-aba'; a.innerHTML = esc(nome) + (q ? '<span class="q">' + q + '</span>' : '');
      var p = document.createElement('div'); p.className = 'res-pane'; p.appendChild(no);
      a.onclick = function () { barra.querySelectorAll('.res-aba').forEach(function (x) { x.classList.remove('on'); }); res.querySelectorAll(':scope > .res-pane').forEach(function (x) { x.classList.remove('on'); }); a.classList.add('on'); p.classList.add('on'); };
      barra.appendChild(a); panes.push(p);
    }
    if (ets.length) {   // Resumo: tabela limpa das etapas, gerada do que já está na tela
      var t = document.createElement('table'); t.className = 'res-resumo';
      t.innerHTML = '<tbody>' + ets.map(function (e) {
        var r = tx(e.querySelector('.r')), f = tx(e.querySelector('.f'));
        var cls = e === total ? 'tot' : e.classList.contains('destaque') ? 'dest' : '';
        return '<tr class="' + cls + '"><td class="n">' + esc(tx(e.querySelector('.n'))) + '</td><td>' + esc(r) + (f && cls !== 'tot' ? '<div class="f">' + esc(f) + '</div>' : '') + '</td><td class="v">' + esc(val(e)) + '</td></tr>';
      }).join('') + '</tbody>';
      aba('Resumo', t);
    }
    var gr = graficosDaTela(ets, cards, total); if (gr) aba('Gr\u00e1ficos', gr);
    cards.forEach(function (c) { if (c === rel) return; aba(nomeAba(c.querySelector('h2')), c, qtd(c)); });
    if (grau) aba('Premissas e alertas', grau);
    res.appendChild(barra); panes.forEach(function (p) { res.appendChild(p); });
    if (barra.firstChild) barra.firstChild.click();
    filhos.forEach(function (f) { if (f !== grau && cards.indexOf(f) < 0) cont.appendChild(f); });   // avisos avulsos ficam acima
    cont.appendChild(res);
    if (cont.id === 'iv-out') { var pz = $('iv-prazo'); if (pz) pz.style.display = 'none'; }
  }
  function restaurar(cont) {
    if (!cont || !cont.dataset.l2) return;
    var res = cont.querySelector(':scope > .res');
    if (res) {
      var rel = (ORIG[cont.id] || []).filter(function (c) { return c.classList && c.classList.contains('card') && /^Relat/i.test(tx(c.querySelector('h2'))); })[0];
      var bot = res.querySelector('.h-acoes .rel-botoes, .h-acoes .toolbar'); if (rel && bot) { rel.appendChild(bot); rel.style.display = ''; }
      res.remove();
    }
    (ORIG[cont.id] || []).forEach(function (f) { cont.appendChild(f); });
    cont.querySelectorAll('[data-l2oculto]').forEach(function (g) { g.style.display = ''; delete g.dataset.l2oculto; });
    delete cont.dataset.l2; delete ORIG[cont.id];
    if (cont.id === 'iv-out') { var pz = $('iv-prazo'); if (pz) pz.style.display = ''; }
  }

  /* ---- menu lateral: move #imob-tabs para a barra da esquerda, logo abaixo do item do módulo.
     abrirAba() continua achando as abas por '#imob-tabs .tab' — nada muda na UI. ---- */
  var TABS_POS = null;
  var SEPS = [['cadastro', 'Preparar'], ['venda', 'Calcular'], ['inventario', 'Analisar'], ['historico', 'Registros']];
  var ABRIR_ORIG = null;
  function passo3Criar() {
    var tabs = $('imob-tabs'), pg = $('page-imobiliaria'); if (!tabs || !pg || $('t-fluxo')) return;
    var t2 = tabs.querySelector('.tab[data-t="imovel"]');
    var t3 = document.createElement('div'); t3.className = 'tab'; t3.dataset.t = 'fluxo'; t3.setAttribute('role', 'tab'); t3.innerHTML = '&#129517; 3. O que calcular?';
    if (t2 && t2.nextSibling) tabs.insertBefore(t3, t2.nextSibling); else tabs.appendChild(t3);
    var painel = document.createElement('div'); painel.id = 't-fluxo'; painel.style.display = 'none';
    painel.innerHTML = '<div id="fluxo-vazio" class="card" style="display:none"><h2>Passo 3 &mdash; O que voc&ecirc; quer calcular?</h2><div class="info">Antes, calcule as op&ccedil;&otilde;es do art. 375 no <b>Passo 2 &mdash; Im&oacute;vel</b>: as opera&ccedil;&otilde;es abaixo usam o redutor de ajuste do im&oacute;vel.</div><div class="toolbar"><button class="btn pri" onclick="abrirAba(\'imovel\')">Ir para o im&oacute;vel</button></div></div>';
    var fo = $('fluxo-out'); if (fo) painel.appendChild(fo);
    var tImovel = $('t-imovel'); if (tImovel && tImovel.parentNode) tImovel.parentNode.insertBefore(painel, tImovel.nextSibling);
    t3.onclick = function () { raiz.abrirAba('fluxo'); };
    t3.tabIndex = 0; t3.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); raiz.abrirAba('fluxo'); } };
    if (typeof raiz.abrirAba === 'function' && !ABRIR_ORIG) {
      ABRIR_ORIG = raiz.abrirAba;
      raiz.abrirAba = function (k) {
        var painel = $('t-fluxo');
        if (k === 'fluxo') {
          ABRIR_ORIG('imovel');   // esconde os demais painéis e roda o que a UI faz ao abrir o imóvel
          var ti = $('t-imovel'); if (ti) ti.style.display = 'none';
          if (painel) painel.style.display = '';
          document.querySelectorAll('#imob-tabs .tab').forEach(function (x) { x.classList.toggle('on', x.dataset.t === 'fluxo'); });
          var fo = $('fluxo-out'); if (fo && !fo.innerHTML.trim()) { try { if (typeof raiz.calcRaj === 'function') raiz.calcRaj(); } catch (e) {} }
          var vazio = $('fluxo-vazio'); if (vazio) vazio.style.display = (fo && fo.innerHTML.trim()) ? 'none' : '';
          return;
        }
        if (painel) painel.style.display = 'none';
        return ABRIR_ORIG.apply(this, arguments);
      };
    }
  }
  function passo3Desfazer() {
    var painel = $('t-fluxo'), t3 = document.querySelector('#imob-tabs .tab[data-t="fluxo"]');
    if (painel) { var fo = $('fluxo-out'), ti = $('t-imovel'); if (fo && ti) ti.appendChild(fo); painel.remove(); }
    if (t3) t3.remove();
    if (ABRIR_ORIG) { raiz.abrirAba = ABRIR_ORIG; ABRIR_ORIG = null; }
  }
  function menuLateral() {
    var tabs = $('imob-tabs'), side = document.querySelector('.sidebar'); if (!tabs || !side || TABS_POS) return;
    passo3Criar();
    var ancora = side.querySelector('.nav-item[data-p="imob"]') || side.querySelector('.nav-item');
    TABS_POS = { pai: tabs.parentNode, prox: tabs.nextSibling };
    SEPS.forEach(function (sp) { var t = tabs.querySelector('.tab[data-t="' + sp[0] + '"]'); if (t) { var d = document.createElement('div'); d.className = 'tab-sep'; d.textContent = sp[1]; tabs.insertBefore(d, t); } });
    if (ancora && ancora.nextSibling) side.insertBefore(tabs, ancora.nextSibling); else side.appendChild(tabs);
    // clicar numa tela do módulo estando em "Sobre o módulo" volta para a página do módulo
    tabs.addEventListener('click', function () { var d = $('modulo-destino'); if (d && d.style.display === 'none' && typeof raiz.go === 'function') raiz.go('imob'); }, true);
    if (ancora) ancora.onclick = function () { if (typeof raiz.go === 'function') raiz.go('imob'); };
  }
  function menuLateralDesfazer() {
    var tabs = $('imob-tabs'); if (!tabs || !TABS_POS) return;
    tabs.querySelectorAll('.tab-sep').forEach(function (d) { d.remove(); });
    passo3Desfazer();
    TABS_POS.pai.insertBefore(tabs, TABS_POS.prox); TABS_POS = null;
  }

  var OBS = [], LIGADO = false, STYLE = null, OPC = { menuLateral: true };
  function aplicar(opcoes) {
    if (opcoes) for (var k in opcoes) OPC[k] = opcoes[k];
    var pg = $('page-imobiliaria'); if (!pg || LIGADO) return false;
    if (!STYLE) { STYLE = document.createElement('style'); STYLE.id = 'imob-layout-css'; STYLE.textContent = CSS; document.head.appendChild(STYLE); }
    pg.classList.add('l2');
    if (OPC.menuLateral) menuLateral();
    SAIDAS.forEach(function (id) {
      var el = $(id); if (!el) return;
      organizar(el);
      var o = new MutationObserver(function () {
        if (el.dataset.l2 && !el.querySelector(':scope > .res')) { delete el.dataset.l2; delete ORIG[id]; }   // a UI regerou o conteúdo
        if (!el.dataset.l2) organizar(el);
      });
      o.observe(el, { childList: true }); OBS.push(o);
    });
    LIGADO = true; return true;
  }
  function desfazer() {
    var pg = $('page-imobiliaria'); if (!pg || !LIGADO) return false;
    OBS.forEach(function (o) { o.disconnect(); }); OBS = [];
    SAIDAS.forEach(function (id) { restaurar($(id)); });
    menuLateralDesfazer();
    pg.classList.remove('l2'); LIGADO = false; return true;
  }
  raiz.ImobLayout = { VERSAO: '1.5.0', aplicar: aplicar, desfazer: desfazer, ligado: function () { return LIGADO; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
