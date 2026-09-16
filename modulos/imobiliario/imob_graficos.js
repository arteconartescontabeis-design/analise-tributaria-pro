/* ============================================================================
 * imob_graficos.js — gráficos de apresentação de valores (SVG puro, sem biblioteca)
 * v1.0.0 · 16/09/2026
 * Funções PURAS que devolvem uma string SVG a partir de números já calculados
 * pelo motor. Não calculam nada: só desenham. Usadas na tela de resultado
 * (aba "Gráficos") e nos relatórios impressos (mesmo desenho nos dois lugares).
 * Cores: IBS #2f7fb3 · CBS #b8730f (par validado para daltonismo) · neutros cinza.
 * ==========================================================================*/
(function (raiz) {
  'use strict';
  var COR = { ibs: '#2f7fb3', cbs: '#b8730f', neutro: '#b9c2cc', destaque: '#1a5276', texto: '#1f2d3d', mudo: '#6b7a8d', grade: '#e3e8ee' };
  function n(v) { v = +v; return isFinite(v) ? v : 0; }
  function money(v) { return n(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function moneyK(v) { v = n(v); return Math.abs(v) >= 1e6 ? (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi' : Math.abs(v) >= 1e3 ? (v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : money(v); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function svg(w, h, corpo, titulo) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" style="max-width:' + w + 'px;font-family:DM Sans,Arial,sans-serif;display:block" role="img" aria-label="' + esc(titulo) + '"><title>' + esc(titulo) + '</title>' + corpo + '</svg>';
  }

  /* 1) IMPOSTO ANO A ANO — barras empilhadas IBS + CBS por ano (2026–2033), total escrito em cima */
  function anoAAno(anos, opc) {
    anos = (anos || []).filter(function (a) { return a && a.ano; });
    if (!anos.length) return '';
    opc = opc || {};
    var W = 640, H = 260, mL = 56, mR = 16, mT = 30, mB = 40, pw = W - mL - mR, ph = H - mT - mB;
    var vals = anos.map(function (a) { return a.valor_total != null ? n(a.valor_total) : n(a.valor_ibs) + n(a.valor_cbs); });
    var max = Math.max.apply(null, vals.concat([1])); var esc_ = ph / (max * 1.15);
    var bw = Math.min(56, (pw / anos.length) * 0.62), passo = pw / anos.length;
    var corpo = '';
    for (var g = 0; g <= 4; g++) { var y = mT + ph - (ph * g / 4); corpo += '<line x1="' + mL + '" y1="' + y + '" x2="' + (W - mR) + '" y2="' + y + '" stroke="' + COR.grade + '"/>' + '<text x="' + (mL - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10" fill="' + COR.mudo + '">' + esc(moneyK(max * 1.15 * g / 4)) + '</text>'; }
    anos.forEach(function (a, i) {
      var ibs = a.valor_ibs != null ? n(a.valor_ibs) : 0, cbs = a.valor_cbs != null ? n(a.valor_cbs) : 0, tot = vals[i];
      if (!ibs && !cbs) { ibs = tot; }
      var x = mL + passo * i + (passo - bw) / 2, base = mT + ph;
      var hI = ibs * esc_, hC = cbs * esc_;
      if (hC > 0) corpo += '<rect x="' + x + '" y="' + (base - hC) + '" width="' + bw + '" height="' + hC + '" fill="' + COR.cbs + '"><title>' + a.ano + ' · CBS ' + money(cbs) + '</title></rect>';
      if (hI > 0) corpo += '<rect x="' + x + '" y="' + (base - hC - hI - (hC > 0 ? 2 : 0)) + '" width="' + bw + '" height="' + hI + '" rx="3" fill="' + COR.ibs + '"><title>' + a.ano + ' · IBS ' + money(ibs) + '</title></rect>';
      corpo += '<text x="' + (x + bw / 2) + '" y="' + (base - hC - hI - 8) + '" text-anchor="middle" font-size="10.5" font-weight="600" fill="' + COR.texto + '">' + esc(moneyK(tot)) + '</text>';
      corpo += '<text x="' + (x + bw / 2) + '" y="' + (base + 16) + '" text-anchor="middle" font-size="11" fill="' + (a.ano === opc.destacar ? COR.destaque : COR.mudo) + '"' + (a.ano === opc.destacar ? ' font-weight="700"' : '') + '>' + a.ano + (a.ano_teste ? '*' : '') + '</text>';
    });
    corpo += '<line x1="' + mL + '" y1="' + (mT + ph) + '" x2="' + (W - mR) + '" y2="' + (mT + ph) + '" stroke="' + COR.mudo + '"/>';
    corpo += '<g font-size="11" fill="' + COR.texto + '"><rect x="' + mL + '" y="8" width="12" height="12" rx="2" fill="' + COR.ibs + '"/><text x="' + (mL + 17) + '" y="18">IBS</text><rect x="' + (mL + 52) + '" y="8" width="12" height="12" rx="2" fill="' + COR.cbs + '"/><text x="' + (mL + 69) + '" y="18">CBS</text>' + (anos.some(function (a) { return a.ano_teste; }) ? '<text x="' + (W - mR) + '" y="18" text-anchor="end" fill="' + COR.mudo + '" font-size="10">* ano-teste</text>' : '') + '</g>';
    return svg(W, H, corpo, 'Imposto na operação em cada ano, 2026 a 2033');
  }

  /* 2) COMPOSIÇÃO DA BASE — barra horizontal: valor da operação = redutor de ajuste + redutor social + base tributável */
  function composicaoBase(d) {
    var valor = n(d.valor_operacao), raj = n(d.redutor_ajuste), rsoc = n(d.redutor_social), ded = n(d.deducoes);
    var base = d.base != null ? n(d.base) : Math.max(valor - raj - rsoc - ded, 0);
    if (!(valor > 0)) return '';
    var W = 640, H = 120, mL = 16, pw = W - 32, y = 34, h = 34;
    var partes = [
      { r: 'Redutor de ajuste', v: raj, c: COR.neutro },
      { r: 'Redutor social', v: rsoc, c: '#d5dce3' },
      { r: 'Deduções', v: ded, c: '#e8edf1' },
      { r: 'Base tributável', v: base, c: COR.destaque, txt: '#fff' }
    ].filter(function (p) { return p.v > 0; });
    var x = mL, corpo = '<text x="' + mL + '" y="18" font-size="11.5" fill="' + COR.mudo + '">Valor da operação <tspan font-weight="700" fill="' + COR.texto + '">' + esc(money(valor)) + '</tspan> — o imposto incide só sobre a parte escura</text>';
    var soma = partes.reduce(function (s, p) { return s + p.v; }, 0) || valor;
    partes.forEach(function (p, i) {
      var w = Math.max(pw * p.v / soma - (i < partes.length - 1 ? 2 : 0), 0);
      corpo += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4" fill="' + p.c + '"><title>' + esc(p.r) + ' ' + money(p.v) + '</title></rect>';
      if (w > 70) corpo += '<text x="' + (x + w / 2) + '" y="' + (y + h / 2 + 4) + '" text-anchor="middle" font-size="11" font-weight="600" fill="' + (p.txt || COR.texto) + '">' + esc(moneyK(p.v)) + '</text>';
      x += w + 2;
    });
    var lx = mL, ly = y + h + 24;
    partes.forEach(function (p) { corpo += '<rect x="' + lx + '" y="' + (ly - 10) + '" width="12" height="12" rx="2" fill="' + p.c + '" stroke="' + COR.grade + '"/><text x="' + (lx + 17) + '" y="' + ly + '" font-size="11" fill="' + COR.texto + '">' + esc(p.r) + ' · ' + esc(Math.round(100 * p.v / soma) + '%') + '</text>'; lx += 16 + 8 + (p.r.length + 6) * 6.6; });
    return svg(W, H, corpo, 'Composição da base de cálculo');
  }

  /* 3) IBS × CBS — duas barras horizontais com valor e participação; total ao lado */
  function ibsCbs(d) {
    var ibs = n(d.ibs), cbs = n(d.cbs), cred = n(d.creditos), tot = ibs + cbs, liq = d.total != null ? n(d.total) : Math.max(tot - cred, 0);
    if (!(tot > 0)) return '';
    var W = 640, H = cred > 0 ? 122 : 92, mL = 120, pw = W - mL - 200, rh = 22, corpo = '';
    var linhas = [{ r: 'IBS', v: ibs, c: COR.ibs }, { r: 'CBS', v: cbs, c: COR.cbs }].concat(cred > 0 ? [{ r: 'Créditos (−)', v: cred, c: COR.neutro }] : []);
    var max = Math.max(ibs, cbs, cred, 1);
    linhas.forEach(function (l, i) {
      var y = 12 + i * (rh + 8), w = Math.max(pw * l.v / max, 2);
      corpo += '<text x="' + (mL - 10) + '" y="' + (y + rh / 2 + 4) + '" text-anchor="end" font-size="12" fill="' + COR.texto + '">' + esc(l.r) + '</text>' +
        '<rect x="' + mL + '" y="' + y + '" width="' + w + '" height="' + rh + '" rx="4" fill="' + l.c + '"><title>' + esc(l.r) + ' ' + money(l.v) + '</title></rect>' +
        '<text x="' + (mL + w + 8) + '" y="' + (y + rh / 2 + 4) + '" font-size="12" font-weight="600" fill="' + COR.texto + '">' + esc(money(l.v)) + '</text>' +
        (i < 2 ? '<text x="' + (W - 8) + '" y="' + (y + rh / 2 + 4) + '" text-anchor="end" font-size="11" fill="' + COR.mudo + '">' + Math.round(100 * l.v / tot) + '% do imposto</text>' : '');
    });
    corpo += '<text x="' + mL + '" y="' + (H - 8) + '" font-size="11.5" fill="' + COR.mudo + '">Total líquido a recolher <tspan font-weight="700" fill="' + COR.destaque + '">' + esc(money(liq)) + '</tspan>' + (d.carga != null ? ' · carga efetiva ' + esc(String(d.carga)) : '') + '</text>';
    return svg(W, H, corpo, 'Imposto por tributo: IBS e CBS');
  }

  /* 4) COMPARATIVO — hoje × Reforma (quando houver) */
  function comparativo(d) {
    var hoje = n(d.hoje), ref = n(d.reforma); if (!(hoje > 0 || ref > 0)) return '';
    var W = 640, H = 96, mL = 205, pw = W - mL - 130, rh = 24, max = Math.max(hoje, ref, 1), corpo = '';
    [{ r: 'Tributação atual', v: hoje, c: COR.neutro }, { r: 'Com a Reforma (IBS+CBS)', v: ref, c: COR.destaque }].forEach(function (l, i) {
      var y = 12 + i * (rh + 10), w = Math.max(pw * l.v / max, 2);
      corpo += '<text x="' + (mL - 10) + '" y="' + (y + rh / 2 + 4) + '" text-anchor="end" font-size="12" fill="' + COR.texto + '">' + esc(l.r) + '</text><rect x="' + mL + '" y="' + y + '" width="' + w + '" height="' + rh + '" rx="4" fill="' + l.c + '"/><text x="' + (mL + w + 8) + '" y="' + (y + rh / 2 + 4) + '" font-size="12" font-weight="600" fill="' + COR.texto + '">' + esc(money(l.v)) + '</text>';
    });
    var dif = ref - hoje;
    corpo += '<text x="' + mL + '" y="' + (H - 8) + '" font-size="11.5" fill="' + COR.mudo + '">' + (dif > 0 ? 'Acréscimo' : 'Economia') + ' estimado(a): <tspan font-weight="700" fill="' + COR.texto + '">' + esc(money(Math.abs(dif))) + '</tspan> — IRPJ e CSLL fora da comparação</text>';
    return svg(W, H, corpo, 'Comparativo: tributação atual e com a Reforma');
  }

  var API = { VERSAO: '1.0.0', COR: COR, anoAAno: anoAAno, composicaoBase: composicaoBase, ibsCbs: ibsCbs, comparativo: comparativo };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  raiz.ImobGraficos = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
