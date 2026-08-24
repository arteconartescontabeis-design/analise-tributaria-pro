/* ============================================================================
 * imob_estilo.js — o CSS PRÓPRIO do módulo Análise Imobiliária
 *
 * POR QUE ESTE ARQUIVO NASCEU EM 24/08
 * A página do módulo usa .tabs, .tab, .aviso, .g4, .mini e .pri, e esse CSS
 * NUNCA foi escrito — nem no índice do Tributário, nem no bundle embutido que
 * eu montei. As abas viravam texto empilhado, sem cursor de mão e sem marcar
 * qual estava ativa: o clique funcionava e não parecia.
 *
 * Nenhuma suíte pegou porque todas testavam FUNÇÃO, nunca APARÊNCIA. O teste
 * que pega isso está no run_index_imob.js: toda classe usada na marcação
 * precisa ter regra de CSS.
 *
 * Usa as variáveis do tema do Tributário (--primary, --border, --card...), que
 * já vêm no :root do índice. Assim o módulo acompanha qualquer mudança de cor
 * do app sem precisar ser reeditado.
 * ==========================================================================*/
(function (raiz) {
  'use strict';
  var CSS = [
    /* --- barra de abas ------------------------------------------------ */
    '#page-imobiliaria .tabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 18px;',
      'padding:6px;background:var(--card);border:1px solid var(--border);',
      'border-radius:var(--radius);box-shadow:var(--shadow)}',
    '#page-imobiliaria .tab{cursor:pointer;user-select:none;padding:9px 14px;',
      'border-radius:8px;font-size:13.5px;font-weight:500;color:var(--muted);',
      'border:1px solid transparent;transition:all .15s;white-space:nowrap}',
    '#page-imobiliaria .tab:hover{background:var(--info-bg);color:var(--primary)}',
    '#page-imobiliaria .tab.on{background:var(--primary);color:#fff;font-weight:600;',
      'box-shadow:0 2px 8px rgba(26,82,118,.25)}',

    /* --- grades ------------------------------------------------------- */
    '#page-imobiliaria .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}',
    '@media(max-width:1100px){#page-imobiliaria .g4{grid-template-columns:repeat(2,1fr)}}',
    '@media(max-width:640px){#page-imobiliaria .g4{grid-template-columns:1fr}}',

    /* --- avisos: o módulo bloqueia e explica, então isto precisa saltar - */
    '#page-imobiliaria .aviso{background:var(--warn-bg);border:1px solid var(--warn);',
      'border-left-width:4px;color:var(--warn);padding:12px 16px;border-radius:8px;',
      'font-size:13.5px;line-height:1.55;margin:12px 0}',
    '#page-imobiliaria .aviso b{color:var(--warn)}',
    '#page-imobiliaria .aviso.err{background:var(--err-bg);border-color:var(--err);color:var(--err)}',
    '#page-imobiliaria .aviso.ok{background:var(--ok-bg);border-color:var(--ok);color:var(--ok)}',

    /* --- texto miúdo e botão de destaque ------------------------------- */
    '#page-imobiliaria .mini{font-size:12px;color:var(--muted);line-height:1.5}',
    '#page-imobiliaria .pri{background:var(--primary);color:#fff;border:none;',
      'padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;',
      'cursor:pointer;transition:background .15s}',
    '#page-imobiliaria .pri:hover{background:var(--primary-dark)}',
    '#page-imobiliaria .pri:disabled{background:var(--muted);cursor:not-allowed}',

    /* --- memória de cálculo: alinhamento de números importa ------------ */
    '#page-imobiliaria table{width:100%;border-collapse:collapse;font-size:13.5px}',
    '#page-imobiliaria th{text-align:left;font-weight:600;color:var(--muted);',
      'border-bottom:2px solid var(--border);padding:8px 10px}',
    '#page-imobiliaria td{border-bottom:1px solid var(--border);padding:8px 10px}',
    '#page-imobiliaria td.num,#page-imobiliaria th.num{text-align:right;',
      'font-variant-numeric:tabular-nums}',
    '#page-imobiliaria code{background:var(--bg);padding:1px 5px;border-radius:4px;',
      'font-size:12px;color:var(--primary)}'
  ].join('');

  function aplicar() {
    var doc = raiz.document;
    if (!doc || !doc.createElement) return false;
    if (doc.getElementById('imob-estilo')) return true;   // idempotente
    var s = doc.createElement('style');
    s.id = 'imob-estilo';
    s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
    return true;
  }

  raiz.ImobEstilo = { CSS: CSS, aplicar: aplicar,
    aplicado: function () {
      return !!(raiz.document && raiz.document.getElementById &&
                raiz.document.getElementById('imob-estilo')); } };
  aplicar();
})(typeof globalThis !== 'undefined' ? globalThis : this);
