/* ============================================================================
 * imob_estilo.js — o CSS PRÓPRIO do módulo Análise Imobiliária. v1.3.0
 *
 * Toda classe usada na marcação ou gerada pela UI precisa ter regra aqui
 * (o teste run_imob_ui.js confere). Usa as variáveis do tema do índice.
 * ==========================================================================*/
(function (raiz) {
  'use strict';
  var P = '#page-imobiliaria ';
  var CSS = [
    /* --- barra de abas ------------------------------------------------ */
    P + '.tabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 18px;padding:6px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow)}',
    P + '.tab{cursor:pointer;user-select:none;padding:9px 14px;border-radius:8px;font-size:13.5px;font-weight:500;color:var(--muted);border:1px solid transparent;transition:all .15s;white-space:nowrap}',
    P + '.tab:hover{background:var(--info-bg);color:var(--primary)}',
    P + '.tab.on{background:var(--primary);color:#fff;font-weight:600;box-shadow:0 2px 8px rgba(26,82,118,.25)}',
    P + '.tab:focus-visible{outline:2px solid var(--primary);outline-offset:1px}',
    P + '.carregando{display:inline-block;margin-left:10px;color:var(--primary);font-weight:600;animation:imobPulse 1s infinite}',
    '@keyframes imobPulse{0%,100%{opacity:1}50%{opacity:.35}}',

    /* --- grades ------------------------------------------------------- */
    P + '.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}',
    P + '.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}',
    P + '.g2{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}',
    '@media(max-width:1100px){' + P + '.g4,' + P + '.g3{grid-template-columns:repeat(2,1fr)}}',
    '@media(max-width:640px){' + P + '.g4,' + P + '.g3,' + P + '.g2{grid-template-columns:1fr}}',
    P + 'h3.sec{font-family:var(--font);font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:var(--primary);margin:16px 0 8px;padding-bottom:4px;border-bottom:1px dashed var(--border)}',
    P + 'label[data-req]::after{margin-left:6px;font-size:9px;padding:1px 6px;border-radius:10px;font-weight:700;letter-spacing:.3px;vertical-align:middle}',
    P + 'label[data-req="obrigatorio"]::after{content:"obrig.";background:var(--err-bg);color:var(--err)}',
    P + 'label[data-req="opcional"]::after{content:"opc.";background:var(--info-bg);color:var(--primary)}',
    P + 'label[data-req="condicional"]::after{content:"cond.";background:var(--warn-bg);color:var(--warn)}',
    P + 'input.invalido,' + P + 'select.invalido{border-color:var(--err)!important;box-shadow:0 0 0 3px rgba(192,57,43,.12)}',

    /* --- avisos e informativos --------------------------------------- */
    P + '.aviso{background:var(--warn-bg);border:1px solid var(--warn);border-left-width:4px;color:var(--warn);padding:12px 16px;border-radius:8px;font-size:13.5px;line-height:1.55;margin:12px 0}',
    P + '.aviso b{color:var(--warn)}',
    P + '.aviso.err{background:var(--err-bg);border-color:var(--err);color:var(--err)}' + P + '.aviso.err b{color:var(--err)}',
    P + '.aviso.ok{background:var(--ok-bg);border-color:var(--ok);color:var(--ok)}' + P + '.aviso.ok b{color:var(--ok)}',
    P + '.info{background:var(--info-bg);border-left:4px solid var(--primary-light);color:var(--text);padding:10px 14px;border-radius:8px;font-size:13px;line-height:1.55;margin:10px 0}',
    P + '.fund{font-size:11.5px;color:var(--muted);line-height:1.5}',
    P + '.mini{font-size:12px;color:var(--muted);line-height:1.5}',
    P + '.tot{font-size:24px;font-weight:700;color:var(--primary);font-variant-numeric:tabular-nums}',
    P + '.selo{display:flex;gap:10px;align-items:center;margin-top:14px;font-size:12px;color:var(--muted)}',
    P + '.valid{margin-top:12px}',

    /* --- badges usados pela UI (b-*) --------------------------------- */
    P + '.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}',
    P + '.badge.b-ok{background:var(--ok-bg);color:var(--ok)}',
    P + '.badge.b-err{background:var(--err-bg);color:var(--err)}',
    P + '.badge.b-warn{background:var(--warn-bg);color:var(--warn)}',
    P + '.badge.b-info{background:var(--info-bg);color:var(--primary)}',
    P + '.badge.b-edit{background:#fdf3e3;color:#b9770e;border:1px dashed #b9770e}',

    /* --- opções do art. 375 ------------------------------------------ */
    P + '.opt{border:2px solid var(--border);border-radius:10px;padding:14px;cursor:pointer;transition:all .15s;background:#fff}',
    P + '.opt:hover{border-color:var(--primary-light)}',
    P + '.opt.sel{border-color:var(--primary);background:var(--info-bg);box-shadow:0 0 0 3px rgba(46,134,171,.15)}',
    P + '.opt.off{opacity:.6;cursor:not-allowed;background:var(--bg)}',
    P + '.opt .v{font-size:22px;font-weight:700;color:var(--primary);margin:6px 0}',

    /* --- botão de destaque ------------------------------------------- */
    P + '.pri{background:var(--primary);color:#fff;border:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s}',
    P + '.pri:hover{background:var(--primary-dark)}' + P + '.pri:disabled{background:var(--muted);cursor:not-allowed}',

    /* --- grau de certeza (no TOPO do resultado) ----------------------- */
    P + '.grau{border-radius:10px;padding:12px 16px;margin:0 0 14px;border:1px solid var(--border);background:var(--card);box-shadow:var(--shadow)}',
    P + '.grau .titulo{display:flex;align-items:center;gap:10px;font-weight:700;color:var(--primary);margin-bottom:6px}',
    P + '.grau .alerta{background:var(--warn-bg);border-left:4px solid var(--warn);padding:8px 12px;border-radius:6px;margin:6px 0;font-size:13px;color:var(--text)}',
    P + '.grau .alerta.edit{background:#fdf3e3;border-left-color:#b9770e}',
    P + '.grau .meta{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--muted);margin-top:8px}',
    P + '.grau .meta b{color:var(--text)}',
    P + '.n-ALTA{color:var(--ok)}' + P + '.n-MEDIA{color:var(--warn)}' + P + '.n-BAIXA{color:var(--err)}',

    /* --- resultado sequencial ---------------------------------------- */
    P + '.seq{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:12px 0}',
    '@media(max-width:1100px){' + P + '.seq{grid-template-columns:repeat(2,1fr)}}',
    P + '.seq .et{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px 14px;position:relative}',
    P + '.seq .et .n{position:absolute;top:8px;right:10px;font-size:10px;color:var(--muted);font-weight:700}',
    P + '.seq .et .r{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;min-height:28px}',
    P + '.seq .et .v{font-size:20px;font-weight:700;color:var(--primary);margin:4px 0;font-variant-numeric:tabular-nums}',
    P + '.seq .et .f{font-size:11px;color:var(--muted);line-height:1.4}',
    P + '.seq .et.destaque{background:var(--info-bg);border-color:var(--primary-light)}',
    P + '.seq .et.principal{background:var(--primary);border-color:var(--primary)}',
    P + '.seq .et.principal .r,' + P + '.seq .et.principal .f,' + P + '.seq .et.principal .n{color:rgba(255,255,255,.8)}',
    P + '.seq .et.principal .v{color:#fff;font-size:24px}',

    /* --- prazo do inventário ----------------------------------------- */
    P + '.prazo{display:flex;gap:16px;flex-wrap:wrap;align-items:center;padding:12px 16px;border-radius:10px;background:var(--info-bg);border:1px solid var(--primary-light)}',
    P + '.prazo .dias{font-size:24px;font-weight:800;color:var(--primary)}',
    P + '.prazo.u-CRITICA,' + P + '.prazo.u-PRAZO_VENCIDO{background:var(--err-bg);border-color:var(--err)}' + P + '.prazo.u-CRITICA .dias,' + P + '.prazo.u-PRAZO_VENCIDO .dias{color:var(--err)}',
    P + '.prazo.u-ALTA,' + P + '.prazo.u-MEDIA{background:var(--warn-bg);border-color:var(--warn)}' + P + '.prazo.u-ALTA .dias,' + P + '.prazo.u-MEDIA .dias{color:var(--warn)}',

    /* --- tabelas ------------------------------------------------------ */
    P + 'table{width:100%;border-collapse:collapse;font-size:13.5px}',
    P + 'th{text-align:left;font-weight:600;color:var(--muted);border-bottom:2px solid var(--border);padding:8px 10px}',
    P + 'td{border-bottom:1px solid var(--border);padding:8px 10px;vertical-align:top}',
    P + 'td.num,' + P + 'th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}',
    P + 'tr.grp td{background:var(--bg);font-weight:700;color:var(--primary);font-family:var(--display);font-size:14px}',
    P + 'tr.dif td{background:#fdf3e3}',
    P + 'code{background:var(--bg);padding:1px 5px;border-radius:4px;font-size:12px;color:var(--primary)}',
    P + 'textarea{font-family:var(--font);font-size:13px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;width:100%;resize:vertical}',
    P + '.bar{display:inline-block;height:14px;background:var(--primary-light);border-radius:3px;vertical-align:middle}',
    P + '.grafico{display:flex;align-items:flex-end;gap:10px;height:170px;padding:10px 6px 0;border-bottom:2px solid var(--border);margin:10px 0 4px}',
    P + '.grafico .col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;font-size:10.5px;color:var(--muted)}',
    P + '.grafico .col .b{width:70%;background:linear-gradient(180deg,var(--primary-light),var(--primary));border-radius:4px 4px 0 0;min-height:2px}',
    P + '.grafico .col .b.est{opacity:.55}',
    P + '.grafico .col .lb{margin-top:4px;font-weight:600}',
    P + '.pr-row.editada td{background:#fdf3e3}',
    P + '.pr-row input{max-width:140px;text-align:right}',
    P + '.hist-sel{width:18px;height:18px;cursor:pointer}',
    P + '.chip{display:inline-block;font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:2px 9px;margin:2px 4px 2px 0;color:var(--text)}'
  ].join('');

  function aplicar() {
    var doc = raiz.document;
    if (!doc || !doc.createElement) return false;
    var s = doc.getElementById('imob-estilo');
    if (!s) { s = doc.createElement('style'); s.id = 'imob-estilo'; (doc.head || doc.documentElement).appendChild(s); }
    s.textContent = CSS;                                  // idempotente e atualizável
    return true;
  }

  raiz.ImobEstilo = { CSS: CSS, aplicar: aplicar,
    aplicado: function () { return !!(raiz.document && raiz.document.getElementById && raiz.document.getElementById('imob-estilo')); } };
  aplicar();
})(typeof globalThis !== 'undefined' ? globalThis : this);
