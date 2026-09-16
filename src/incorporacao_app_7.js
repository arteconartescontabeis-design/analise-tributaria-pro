// ═══════════════════════════════════════════════════════════════════════════════════════════
// ══ v1.7.0 · LAYOUT QUE NUNCA CORTA + MEMÓRIA DE CÁLCULO COMPLETA (Demonstrativo de 15/09/2026) ══
// ══ Nada do motor, do modelo (incModelo), das fórmulas de Δ, da classificação ou do score muda. ══
// ══ (A) incTabAjustar — limite de colunas por orientação: "Leitura" vira notas numeradas, colunas ══
// ══     de detalhe saem para os relatórios técnicos e, se ainda faltar espaço, a tabela é dividida ══
// ══     em partes (nunca cortada). (B) incEmpacotar — paginador por MEDIÇÃO REAL no navegador,     ══
// ══     retrato e paisagem, quebrando tabelas por linha com o cabeçalho repetido. (C) incRegua —   ══
// ══     mede altura E largura de cada folha. (D) incPrintCss — orientação única por documento     ══
// ══     (funciona em Firefox/Safari) e "Todos" em dois PDFs. (E) incMemoriaCompleta — 8 blocos.    ══
// ═══════════════════════════════════════════════════════════════════════════════════════════

// ── (A) LIMITE DE COLUNAS ──────────────────────────────────────────────────────────────────
const INC_COLS_MAX = { retrato:7, paisagem:11 };
const INC_COL_NOTA = /^(leitura|explica|por qu|como foi|observa|motivo|justificativa)/i;
const incTxt = h => String(h||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
// células de uma linha/cabeçalho: [{tag, attrs, inner, span}] — as tabelas do módulo não aninham tabelas
function incCelulas(html){
  const out = []; const re = /<t([dh])\b([^>]*)>([\s\S]*?)<\/t\1>/g; let m;
  while ((m = re.exec(html))){ const sp = +((m[2].match(/colspan="?(\d+)/)||[])[1]) || 1; out.push({ tag:m[1], attrs:m[2], inner:m[3], span:sp }); }
  return out;
}
const incCelHtml = c => `<t${c.tag}${c.attrs}>${c.inner}</t${c.tag}>`;
const incRowHtml = cels => `<tr>${cels.map(incCelHtml).join('')}</tr>`;
const INC_SUP = n => `<sup style="font-weight:600;color:#8c2f39">${n}</sup>`;
// devolve uma lista de blocos (tabelas + notas) que cabem na orientação; ctx.n = contador de notas do documento
function incTabAjustar(b, orient, ctx, opts){
  if (!b || !b.linhas) return [b];
  const MAX = (opts && opts.maxCols) || INC_COLS_MAX[orient] || INC_COLS_MAX.retrato;
  const ths = incCelulas(b.thead); const nCols = ths.reduce((s,c)=>s+c.span,0);
  if (!ths.length || nCols <= MAX) return [b];
  ctx = ctx || { n:0 };
  // cada "linha" do bloco pode trazer mais de um <tr> (ex.: linha de valores + linha de fórmula com colspan)
  let cab = ths.map(c => ({ ...c }));
  const rows = b.linhas.map(L => ({ L, segs: (String(L.html).match(/<tr[\s\S]*?<\/tr>/g) || [L.html]).map(seg => { const cs = incCelulas(seg); const n = cs.reduce((s,c)=>s+c.span,0); return { cs, span: n !== cab.length || cs.some(c=>c.span>1) }; }) }));
  const notas = []; const omitidas = [];
  const ajustaSpan = (c, delta) => { c.span = Math.max(1, c.span + delta); c.attrs = c.attrs.replace(/colspan="?\d+"?/, `colspan="${c.span}"`); };
  const remover = idx => { cab.splice(idx, 1); for (const r of rows) for (const sg of r.segs){ if (sg.span){ const c = sg.cs.find(x=>x.span>1); if (c) ajustaSpan(c, -1); continue; } sg.cs.splice(idx, 1); } };
  // 1) "Leitura" e afins viram notas numeradas abaixo da tabela
  for (let i = cab.length - 1; i >= 0; i--){
    if (!INC_COL_NOTA.test(incTxt(cab[i].inner))) continue;
    for (const r of rows){ const sg = r.segs.find(x=>!x.span); if (!sg) continue; const t = incTxt(sg.cs[i].inner); if (t && t !== '—' && t !== '-'){ ctx.n++; notas.push({ n:ctx.n, t: sg.cs[i].inner }); sg.cs[0].inner += ' ' + INC_SUP(ctx.n); } }
    remover(i);
  }
  // 2) colunas de detalhe que este documento dispensa (as completas ficam nos relatórios técnicos)
  const desc = (opts && opts.descartar) || [];
  for (const re of desc){ if (cab.length <= MAX) break; for (let i = cab.length - 1; i >= 1 && cab.length > MAX; i--){ if (re.test(incTxt(cab[i].inner))){ omitidas.push(incTxt(cab[i].inner)); remover(i); } } }
  // 3) ainda larga → divide em partes, repetindo a primeira coluna (rótulo)
  const partes = []; if (cab.length <= MAX) partes.push(cab.map((_,i)=>i)); else { const nDados = cab.length - 1, nPartes = Math.ceil(nDados / (MAX - 1)), por = Math.ceil(nDados / nPartes); for (let i = 1; i < cab.length; i += por) partes.push([0, ...cab.slice(i, i+por).map((_,j)=>i+j)]); }   // partes equilibradas (nunca uma parte com 1 coluna)
  const out = [];
  partes.forEach((idx, p) => {
    const thead = incRowHtml(idx.map(i => cab[i]));
    const linhas = rows.map(r => { const html = r.segs.map(sg => { if (sg.span){ if (p > 0) return ''; const cs = sg.cs.map(c => ({ ...c })); const c = cs.find(x=>x.span>1); if (c) ajustaSpan(c, idx.length - cab.length); return incRowHtml(cs); } return incRowHtml(idx.map(i => sg.cs[i])); }).join(''); return html ? { html, custo: r.L.custo||1 } : null; }).filter(Boolean);
    const fixo = p === 0 ? (b.htmlFixo||'') : `<div class="hint" style="margin:6px 0 -4px">continuação do quadro — parte ${p+1} de ${partes.length} (colunas ${incTxt(cab[idx[1]].inner)} … ${incTxt(cab[idx[idx.length-1]].inner)})</div>`;
    out.push({ thead, linhas, custoFixo: p === 0 ? (b.custoFixo||0) : 1, htmlFixo: fixo, estilo: b.estilo });
  });
  if (omitidas.length) out.push({ html:`<div class="hint" style="margin:-2px 0 6px">Colunas resumidas neste quadro (${esc([...new Set(omitidas)].join(', '))}): a abertura completa está nos relatórios técnicos (Relatório 2 — Comparativo Tributário Completo, Relatório 3 — Reforma e Relatório 7 — Memória de Cálculo).</div>`, custo:2 });
  if (notas.length) out.push({ html:`<div class="hint inc-notas" style="margin:-2px 0 8px;line-height:1.5">${notas.map(n => `${INC_SUP(n.n)} ${n.t}`).join('<br>')}</div>`, custo: Math.max(2, Math.ceil(notas.reduce((s,n)=>s+incTxt(n.t).length,0)/(orient==='paisagem'?170:110))) });
  return out;
}
const INC_DESCARTAR_PARECER = M => [...M.ents.map(e => new RegExp('^' + e.nome.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '$')), /^Base \(cons/i, /^Alíq/i, /^Margem$/i, /^Carga$/i, /^Acumul/i, /^Débito/i, /^Crédito$/i, /^IBS$/i, /^CBS$/i, /^Permitido/i, /^Estab/i, /^Resultado após/i, /^Tributos\/ano$/i, /^Reforma acum/i];

// ── (B) PAGINADOR POR MEDIÇÃO REAL ────────────────────────────────────────────────────────
// Roda sobre o DOM já montado (antes de os gráficos serem desenhados — os canvas têm tamanho fixo).
// Redistribui os blocos de cada documento (.inc-doc) entre folhas novas da mesma orientação,
// quebrando tabelas por linha (cabeçalho repetido) e nunca deixando cabeçalho de seção órfão.
// Sem layout (ambiente de teste, aba oculta) não faz nada: a paginação por custo já colocada vale.
const INC_FOLHA_MM = { retrato: 296, paisagem: 209 };
function incEmpacotarDoc(doc){
  const original = doc.innerHTML;                 // qualquer erro no meio do caminho restaura as folhas por custo
  try { return incEmpacotarDocInterno(doc); } catch(e){ console.error('incEmpacotarDoc', e); doc.innerHTML = original; return 0; }
}
function incEmpacotarDocInterno(doc){
  const pais = doc.dataset.orient === 'paisagem';
  const pgs = Array.from(doc.querySelectorAll('.pp-page')).filter(p => !p.classList.contains('pp-capa'));
  if (!pgs.length) return 0;
  const mm = ppMm2px(), LIM = (INC_FOLHA_MM[pais?'paisagem':'retrato'] - PP_RESERVA_MM) * mm;
  const primeira = pgs[0]; if (!primeira.offsetHeight) return 0;               // sem layout: nada a medir
  // v1.7.1: só mede se a folha na tela tiver a largura do papel — noutra largura o texto quebra diferente e a medida sai errada
  { const larg = primeira.getBoundingClientRect().width / mm, alvo = pais ? 297 : 210; if (larg > 0 && Math.abs(larg - alvo) > 3){ console.warn('incEmpacotar: folha com ' + larg.toFixed(0) + ' mm na tela (papel ' + alvo + ' mm) — repaginação pulada'); return 0; } }
  const blocos = [];
  for (const pg of pgs){ const mi = pg.querySelector('.pp-miolo'); if (!mi) continue; let primeiro = pg.classList.contains('pp-fixa'); while (mi.firstChild){ const b = mi.removeChild(mi.firstChild); if (primeiro && b.nodeType === 1){ b.__quebra = true; primeiro = false; } blocos.push(b); } }
  const modeloBg = primeira.querySelector('.pp-bg'), modeloCab = primeira.querySelector('.pp-land-cab');
  const folhas = [];
  const novaFolha = () => {
    const pg = document.createElement('div'); pg.className = pais ? 'pp-page pp-land' : 'pp-page';
    if (pais){ const cab = modeloCab ? modeloCab.cloneNode(true) : document.createElement('div'); cab.className = 'pp-land-cab'; pg.appendChild(cab); }
    else { let img; if (modeloBg){ img = modeloBg.cloneNode(true); img.style.display = ''; } else { img = document.createElement('img'); img.className = 'pp-bg'; img.src = 'timbrado.jpg'; img.onerror = function(){ this.style.display = 'none'; }; } pg.appendChild(img); }
    const mi = document.createElement('div'); mi.className = 'pp-miolo'; pg.appendChild(mi);
    primeira.parentNode.insertBefore(pg, primeira); folhas.push(pg); return mi;
  };
  const altura = mi => mi.offsetHeight;
  let mi = novaFolha();
  const fecharEAbrir = () => { const arrasta = []; while (mi.childNodes.length > 1 && ppEhEncabecamento(mi.lastElementChild, mi)) arrasta.unshift(mi.removeChild(mi.lastElementChild)); mi = novaFolha(); for (const a of arrasta) mi.appendChild(a); };
  for (const b of blocos){
    if (b.__quebra && mi.childNodes.length) mi = novaFolha();      // página forçada (uma por assunto): sempre começa folha nova
    if (b.__quebra) mi.parentNode.classList.add('pp-fixa');
    const ehTabela = b.nodeType === 1 && b.tagName === 'TABLE' && b.tBodies && b.tBodies[0];
    if (ehTabela && b.tBodies[0].rows.length > 1){
      // tabela quebrável: linha a linha, cabeçalho repetido em cada folha
      const thead = b.tHead ? b.tHead.cloneNode(true) : null, linhas = Array.from(b.tBodies[0].rows), cls = b.className, estilo = b.getAttribute('style');
      const novaTabela = () => { const t = document.createElement('table'); t.className = cls; if (estilo) t.setAttribute('style', estilo); if (thead) t.appendChild(thead.cloneNode(true)); const tb = document.createElement('tbody'); t.appendChild(tb); mi.appendChild(t); return tb; };
      let tb = novaTabela(), nesta = 0;
      if (altura(mi) > LIM && mi.childNodes.length > 1){ tb.parentNode.remove(); fecharEAbrir(); tb = novaTabela(); }
      for (const tr of linhas){
        tb.appendChild(tr);
        if (altura(mi) > LIM && (nesta > 0 || mi.childNodes.length > 1)){
          tb.removeChild(tr); if (nesta === 0) tb.parentNode.remove();
          fecharEAbrir(); tb = novaTabela(); nesta = 0; tb.appendChild(tr);
        }
        nesta++;
      }
      continue;
    }
    mi.appendChild(b);
    if (altura(mi) > LIM && mi.childNodes.length > 1){ mi.removeChild(b); fecharEAbrir(); mi.appendChild(b); }
  }
  for (const pg of pgs) pg.remove();
  // numeração das folhas paisagem (o cabeçalho traz "página i de n")
  if (pais) folhas.forEach((pg, i) => { const c = pg.querySelector('.pp-land-cab'); if (c) c.innerHTML = `<span>Artecon Artes Contábeis · Simulação de Incorporação</span><span>página ${i+1} de ${folhas.length}</span>`; });
  return folhas.length;
}
function incEmpacotar(corpo){
  let n = 0; corpo.querySelectorAll('.inc-doc').forEach(d => { n += incEmpacotarDoc(d) || 0; });
  return n;
}

// ── (C) RÉGUA: altura E largura, nas duas orientações ──────────────────────────────────────
function incMedirPaginas(corpo){
  const mm = ppMm2px(), out = []; let n = 0;
  corpo.querySelectorAll('.pp-page').forEach(pg => {
    n++; const mi = pg.querySelector('.pp-miolo'); const pais = pg.classList.contains('pp-land');
    if (!mi){ out.push({ n, capa:true, mm:0, excesso:0, largura:0 }); return; }
    const folha = INC_FOLHA_MM[pais?'paisagem':'retrato'];
    const alt = mi.offsetHeight / mm; let largura = 0;
    mi.querySelectorAll('table, .pp-chart, div').forEach(el => { const w = el.scrollWidth || 0; if (w > mi.clientWidth + 2) largura = Math.max(largura, (w - mi.clientWidth) / mm); });
    if (mi.scrollWidth > mi.clientWidth + 2) largura = Math.max(largura, (mi.scrollWidth - mi.clientWidth) / mm);
    const sec = mi.querySelector('.pp-sec');
    out.push({ n, pais, titulo: sec ? sec.textContent.trim().slice(0,52) : '(continuação)', mm: alt, excesso: alt - folha, largura });
  });
  return out;
}
function incReguaRender(){
  const alvo = $id('pp-regua'), corpo = $id('rl-corpo'); if (!alvo || !corpo) return;
  const med = incMedirPaginas(corpo); if (!med.length || !med.some(x=>x.mm>0)){ alvo.innerHTML = ''; return; }
  const altura = med.filter(x => x.excesso > 0), larg = med.filter(x => x.largura > 0.5);
  const detalhe = `<details style="margin-top:6px"><summary class="hint" style="cursor:pointer">ver a medida das ${med.length} folhas</summary><div class="hint" style="margin-top:4px;line-height:1.7">${med.map(x => x.capa ? `<b>pág. ${x.n}</b> Capa` : `<b>pág. ${x.n}</b> ${x.pais?'paisagem':'retrato'} · ${esc(x.titulo)} — ${x.mm.toFixed(0)} mm ${x.excesso>0?`<b style="color:#8c2f39">+${x.excesso.toFixed(0)} mm além</b>`:`(folga ${(-x.excesso).toFixed(0)} mm)`}${x.largura>0.5?` · <b style="color:#8c2f39">${x.largura.toFixed(0)} mm além da margem direita</b>`:''}`).join('<br>')}</div></details>`;
  if (!altura.length && !larg.length) alvo.innerHTML = `<div class="hint" style="margin-top:6px">✅ <b>${med.length} folhas</b> medidas no navegador: todas dentro da área útil (altura e largura). ${detalhe}</div>`;
  else alvo.innerHTML = `<div class="pp-alerta" style="margin:8px 0 0"><b>⚠️ ${altura.length + larg.length} folha(s) fora da área útil</b> — ${altura.map(x=>`pág. ${x.n} (+${x.excesso.toFixed(0)} mm de altura)`).concat(larg.map(x=>`pág. ${x.n} (${x.largura.toFixed(0)} mm além da largura)`)).join(', ')}. O conteúdo excedente sairia cortado no PDF: recalcule ou avise o desenvolvedor.${detalhe}</div>`;
}

// ── (D) ORIENTAÇÃO DE IMPRESSÃO POR DOCUMENTO ─────────────────────────────────────────────
// Uma regra @page global por documento (retrato ou paisagem): vale em Chrome, Edge, Firefox e Safari.
// "Todos" mostra tudo na tela e imprime em dois PDFs (gerencial retrato · técnico paisagem).
function incPrintCss(orient){
  let st = document.getElementById('inc-print-css'); if (st) st.remove();
  if (typeof apPrintCss === 'function') apPrintCss(false);
  if (!orient) return;
  st = document.createElement('style'); st.id = 'inc-print-css';
  st.textContent = `@media print{ @page{size:A4 ${orient==='paisagem'?'landscape':'portrait'};margin:0} ${orient==='paisagem'?'#rl-corpo{width:297mm!important}':'#rl-corpo{width:210mm!important}'} }`;
  document.head.appendChild(st);
}
function incImprimir(grupo){
  const corpo = $id('rl-corpo'); if (!corpo) return;
  let st = document.getElementById('inc-print-grupo'); if (st) st.remove();
  if (grupo){
    incPrintCss(grupo);
    st = document.createElement('style'); st.id = 'inc-print-grupo';
    st.textContent = `@media print{ .inc-doc:not([data-orient="${grupo}"]){display:none!important} }`;
    document.head.appendChild(st);
    const limpar = () => { const s = document.getElementById('inc-print-grupo'); if (s) s.remove(); window.removeEventListener('afterprint', limpar); };
    window.addEventListener('afterprint', limpar); setTimeout(limpar, 60000);
  }
  window.print();
}

// ── (E) MEMÓRIA DE CÁLCULO COMPLETA ───────────────────────────────────────────────────────
// Só LÊ os intermediários que o motor já devolve (R.meses[].rbt12, faixa, efb, ins.blocos, dasTrib,
// lp.*, lr.*, lrApur, T.anos, cen.REF/rfx) e apresenta base → alíquota → fórmula → resultado.
// Tabelas nascem de um modelo de dados (incMT) que alimenta o HTML e o Excel (com fórmulas de planilha).
const INC_MEM_MESES = () => (typeof MESES !== 'undefined' ? MESES : ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']);
const INC_ANEXO_DO_BLOCO = k => /^a1/.test(k) ? 'I' : /^a2/.test(k) ? 'II' : /^a3/.test(k) ? 'III' : /^a4/.test(k) ? 'IV' : /^a5r/.test(k) ? 'V' : null;
const INC_BLOCO_BASE = k => ['a1_semst','a2_semst','a3_semret','a4','a5r','a1_exp','a2_exp','a3_exp','a5r_exp'].includes(k);
const incRotBloco = k => { const p = (typeof PG_BLOCOS !== 'undefined' ? PG_BLOCOS : []).find(x => x[0] === k); return p ? p[1] : k; };
const incPctS = (v, d=2) => (v == null || isNaN(v)) ? '—' : fmtP(v*100, d) + '%';
// modelo de tabela: cab = ['Mês', ...]; linhas = [[cel, cel…]] onde cel = número | string | {v, f} (f = fórmula com {r} = nº da linha na planilha)
function incMT(titulo, cab, linhas, opts){
  const o = opts || {}; const numCols = o.num || cab.map((_,i) => i > 0);
  const cel = (c, i) => { const v = (c && typeof c === 'object' && 'v' in c) ? c.v : c; if (typeof v === 'number') return `<td class="num">${isNaN(v) ? '—' : (o.pct && o.pct[i] != null ? incPctS(v, o.pct[i] === true ? 2 : o.pct[i]) : fmt(v))}</td>`; return `<td${numCols[i]?' class="num"':''}>${v == null ? '—' : v}</td>`; };
  const thead = `<tr>${cab.map((c,i) => `<th${numCols[i]?' class="num"':''}>${c}</th>`).join('')}</tr>`;
  const rows = linhas.map(l => ({ html:`<tr>${l.map((c,i) => i === 0 ? `<td class="rot">${(c && typeof c === 'object' && 'v' in c) ? c.v : c}</td>` : cel(c, i)).join('')}</tr>`, custo:1 }));
  const bl = [];
  if (titulo) bl.push({ html:`<div class="hint" style="margin:10px 0 2px"><b>${titulo}</b></div>`, custo:1 });
  if (o.antes) bl.push({ html:`<div class="hint" style="margin:0 0 4px">${o.antes}</div>`, custo: Math.max(1, Math.ceil(incTxt(o.antes).length/170)) });
  bl.push({ thead, linhas: rows, custoFixo:0 });
  if (o.depois) bl.push({ html:`<div class="hint" style="margin:-2px 0 8px">${o.depois}</div>`, custo: Math.max(1, Math.ceil(incTxt(o.depois).length/170)) });
  // planilha: números como números, {v,f} vira fórmula
  const aoa = [cab.map(c => incTxt(c)), ...linhas.map((l, r) => l.map(c => { if (c && typeof c === 'object' && 'v' in c){ if (c.f) return { t:'n', v: +c.v || 0, f: c.f.replace(/\{r\}/g, r + 2).replace(/^=/, '') }; return c.v; } return (typeof c === 'number' && isNaN(c)) ? '' : c; }))];
  return { blocos: bl, aba: { titulo: incTxt(titulo), aoa } };
}
const incColL = i => String.fromCharCode(65 + i);   // 0 → A
function incMemoriaCompleta(M){
  const R = M.R, ents = M.ents, cons = M.cons, todos = [...ents, cons], MES = INC_MEM_MESES(), S = (arr, f) => arr.reduce((s,x)=>s+(+f(x)||0),0);
  const B = [], ABAS = [], conc = [];
  const add = t => { B.push(...t.blocos); ABAS.push(t.aba); };
  const sec = (n, t) => B.push({ html:`<h3 class="pp-sec">${n} ${t}</h3>`, custo:2 });
  const par = t => B.push({ html:`<p class="pp-p" style="font-size:12px">${t}</p>`, custo: Math.max(1, Math.ceil(incTxt(t).length/220)) });
  const nomeEnt = e => e === cons ? 'Consolidada' : e.nome;
  const origem = (e, i) => e.P ? (i <= e.P.ultimo ? 'lançado' : 'projetado') : 'lançado';

  // 7.1 ENTRADAS
  sec('7.1', 'Dados de entrada por empresa e mês (origem de cada valor)');
  par('Cada linha traz o que entrou no motor para o mês: receita interna e de exportação, folha (salários + pró-labore), compras e despesas, com a alíquota de ISS/ICMS configurada. "projetado" = mês estimado pela projeção individual do ano incompleto, antes da soma.');
  for (const e of todos){
    const Mm = e.R.meses;
    add(incMT(`Entradas — ${esc(nomeEnt(e))}`, ['Mês','Receita interna','Receita export.','Comércio','Serviços','Folha (sal.+pró-lab.)','Compras','Despesas','ISS cfg','ICMS venda cfg','Origem'],
      Mm.map((m,i) => [MES[i], +m.recInt||0, +m.recExp||0, +m.recCom||0, +m.recServ||0, (+((m.ins&&m.ins.folha)||{}).salarios||0) + (+((m.ins&&m.ins.folha)||{}).prolabore||0), S(Object.values((m.ins&&m.ins.compras)||{}), v=>v), +m.despTotal||0, { v: +((m.ins||{}).issCfg)||0 }, { v: +((m.ins||{}).icmsCfg)||0 }, e === cons ? 'soma' : origem(e, i)])
        .concat([['Total', S(Mm,m=>m.recInt), S(Mm,m=>m.recExp), S(Mm,m=>m.recCom), S(Mm,m=>m.recServ), S(Mm,m=>(+((m.ins&&m.ins.folha)||{}).salarios||0)+(+((m.ins&&m.ins.folha)||{}).prolabore||0)), S(Mm,m=>S(Object.values((m.ins&&m.ins.compras)||{}),v=>v)), S(Mm,m=>m.despTotal), '', '', '']]),
      { pct:{ 8:true, 9:true }, num:[false,true,true,true,true,true,true,true,true,true,false] }));
  }

  // 7.2 CONSOLIDAÇÃO
  sec('7.2', 'Consolidação — soma mês a mês, abatimentos e ponderação de ISS/ICMS');
  par(`Consolidada = ${ents.map(e=>esc(e.nome)).join(' + ')} − operações entre as empresas abatidas, mês a mês. O RBT12 consolidado é a soma dos RBT12 (decisão de 01/09/2026). As colunas "Σ" e "Consolidada" devem coincidir quando não há abatimento no mês.`);
  const somaMes = (f, i) => S(ents, e => f(e.R.meses[i]));
    add(incMT('Receita interna: soma das empresas × consolidada', ['Mês', ...ents.map(e=>esc(e.nome)), 'Σ empresas', 'Consolidada (motor)', 'Abatido (Σ − consolidada)'],
    cons.R.meses.map((m,i) => { const s = somaMes(x=>x.recInt, i), c = +m.recInt||0; return [MES[i], ...ents.map(e=>+e.R.meses[i].recInt||0), { v:s, f:`=SUM(B{r}:${incColL(ents.length)}{r})` }, c, { v: s - c, f:`=${incColL(ents.length+1)}{r}-${incColL(ents.length+2)}{r}` }]; })
      .concat([['Total', ...ents.map(e=>S(e.R.meses,x=>x.recInt)), S(cons.R.meses,(m)=>somaMes(x=>x.recInt, cons.R.meses.indexOf(m))), S(cons.R.meses,m=>m.recInt), S(cons.R.meses,(m)=>somaMes(x=>x.recInt, cons.R.meses.indexOf(m)) - (+m.recInt||0))]]),
    { depois: (R.abatidos||[]).length ? `Operações abatidas: ${R.abatidos.map(a => `${esc(a.vendeu||a.de||'')} → ${esc(a.comprou||a.para||'')} ${fmtR(+a.abatReceita||+a.valor||0)}`).join('; ')}.` : 'Nenhuma operação entre as empresas foi abatida nesta simulação (coluna "Abatido" = 0).' }));
  add(incMT('RBT12: soma dos RBT12 das empresas × RBT12 da consolidada', ['Mês', ...ents.map(e=>esc(e.nome)), 'Σ RBT12', 'RBT12 consolidada (motor)', 'Faixa', 'Diferença'],
    cons.R.meses.map((m,i) => { const s = S(ents, e=>e.R.meses[i].rbt12); return [MES[i], ...ents.map(e=>+e.R.meses[i].rbt12||0), { v:s, f:`=SUM(B{r}:${incColL(ents.length)}{r})` }, +m.rbt12||0, m.faixa != null ? String(m.faixa) : '—', { v: s - (+m.rbt12||0), f:`=${incColL(ents.length+1)}{r}-${incColL(ents.length+2)}{r}` }]; }),
    { depois: 'Diferença ≠ 0 só quando há abatimento de receita intragrupo no período de 12 meses ou quando a incorporadora informou o RBT12 diretamente na Configuração.' }));
  const pondera = (rot, chave, baseF, cfgKey) => { const linhas = ents.map(e => { const a = +(e.cfg||{})[cfgKey]||0, b = S(e.R.meses, baseF); return [esc(e.nome), { v:a }, b, { v:a*b, f:`=B{r}*C{r}` }]; }); const sb = S(linhas, l=>l[2]), sp = S(linhas, l=>l[3].v); const res = sb > 0 ? sp/sb : 0; const usado = +(cons.cfg||{})[cfgKey]||0;
    return incMT(`${rot} da consolidada — média ponderada pela base`, ['Empresa', 'Alíquota', 'Base do ano (' + chave + ')', 'Alíquota × base'], linhas.concat([['Σ', '', sb, sp], ['Resultado = Σ(alíquota × base) ÷ Σ base', { v:res }, '', ''], ['Alíquota usada pelo motor na consolidada', { v:usado }, '', Math.abs(usado - res) < 0.00005 ? 'confere' : 'informada na Configuração da incorporadora (prevalece sobre a média)']]), { pct:{ 1:true }, num:[false,true,true,true] }); };
  add(pondera('ISS', 'receita de serviços', m=>m.recServ, 'iss'));
  add(pondera('ICMS de venda', 'receita de comércio', m=>m.recCom, 'icmsV'));
  add(pondera('ICMS de compra', 'compras', m=>S(Object.values((m.ins&&m.ins.compras)||{}),v=>v), 'icmsC'));

  // 7.3 SIMPLES
  sec('7.3', 'Simples Nacional — alíquota efetiva por bloco, DAS e partilha por tributo');
  par('Para cada mês e bloco de receita: alíquota nominal e parcela a deduzir da faixa (LC 123/2006, Anexos I a V), alíquota efetiva = (RBT12 × nominal − parcela a deduzir) ÷ RBT12 e parcela do DAS = receita do bloco × efetiva. Blocos com variante (ST, monofásico, retenção de ISS/INSS, comunicação/transporte) usam a efetiva que o motor aplica ao bloco; o mesmo vale para os meses marcados "(sublimite/limite)", em que o RBT12 é limitado ao teto e o ICMS/ISS sai da guia (LC 123, arts. 3º § 9º-A e 13-A; Res. CGSN 140, art. 24). Nesses casos a coluna "Efetiva recalculada" fica vazia e a conferência é feita pela parcela do DAS. Anexo V passa a III quando o Fator R ≥ 28 %.');
  const AX = (typeof ANEXOS_DEFAULT !== 'undefined') ? ANEXOS_DEFAULT : {};
  for (const e of todos){
    const Mm = e.R.meses, L = []; let somaParc = 0, somaDas = 0;
    Mm.forEach((m,i) => {
      const bl = ((m.ins&&m.ins.blocos)||[]).concat((m.ins&&m.ins.blocosExp)||[]).filter(b => +b.receita > 0);
      const fx = m.faixa, rb = +m.rbt12||0;
      for (const b of bl){
        let ax = INC_ANEXO_DO_BLOCO(b.k); if (ax === 'V' && m.fatorR != null && m.fatorR >= 0.28) ax = 'III';
        const t = ax && AX[ax] && fx ? { nom: AX[ax].aliq[fx-1], ded: AX[ax].ded[fx-1] } : null;
        const ef = +((m.efb||{})[b.k] ?? b.efetiva) || 0, parc = (+b.receita||0) * ef; somaParc += parc;
        // acima do sublimite/limite (mês impedido) o motor limita o RBT12 ao teto e tira o ICMS/ISS da guia — a fórmula simples não se aplica
        const simples = !m.impedido && !(+m.excLimite > 0) && !(+m.excSublimite > 0);
        const recalc = (t && rb > 0 && INC_BLOCO_BASE(b.k) && simples) ? (rb * t.nom - t.ded) / rb : null;
        L.push([`${MES[i]} · ${incRotBloco(b.k)}${simples ? '' : ' <span class="hint">(sublimite/limite)</span>'}`, rb, fx != null ? String(fx) : '—', m.fatorR != null ? { v:m.fatorR } : '—', ax || '—', +b.receita||0, t ? { v:t.nom } : '—', t ? t.ded : '—', recalc != null ? { v:recalc, f:`=IF(B{r}>0,(B{r}*G{r}-H{r})/B{r},0)` } : '', { v:ef }, { v:parc, f:`=F{r}*J{r}` }]);
      }
      somaDas += +m.das||0;
      L.push([`<i>${MES[i]} — DAS do mês (motor)</i>`, '', '', '', '', +m.receita||0, '', '', '', '', +m.das||0]);
    });
    conc.push({ item:`Simples — Σ parcelas por bloco × Σ DAS (${nomeEnt(e)})`, mem:somaParc, motor:somaDas });
    add(incMT(`Simples — ${esc(nomeEnt(e))}: alíquota efetiva e DAS por bloco`, ['Mês · bloco','RBT12','Faixa','Fator R','Anexo','Receita do bloco','Nominal','Parcela a deduzir','Efetiva recalculada','Efetiva (motor)','Parcela do DAS'], L,
      { pct:{ 3:1, 6:2, 8:4, 9:4 }, num:[false,true,true,true,false,true,true,true,true,true,true], depois:`Σ parcelas por bloco = ${fmtR(somaParc)} · Σ DAS do motor = ${fmtR(somaDas)} · diferença ${fmtR(somaParc - somaDas)} (ISS/ICMS fora da guia por sublimite, trava da 5ª faixa e retenções são somados à parte, abaixo).` }));
    add(incMT(`Simples — ${esc(nomeEnt(e))}: partilha do DAS por tributo e parcelas fora da guia`, ['Mês','PIS','COFINS','IRPJ','CSLL','CPP','ICMS','ISS','IPI','Σ partilha','DAS','ICMS/ISS fora (sublimite)','Simples total'],
      Mm.map((m,i) => { const d = m.dasTrib||{}; const sp = S(['pis','cofins','irpj','csll','cpp','icms','iss','ipi'], k=>d[k]); return [MES[i], +d.pis||0, +d.cofins||0, +d.irpj||0, +d.csll||0, +d.cpp||0, +d.icms||0, +d.iss||0, +d.ipi||0, { v:sp, f:`=SUM(B{r}:I{r})` }, +m.das||0, (+m.subIcms||0)+(+m.subIss||0)+(+m.impIcms||0)+(+m.impIss||0), +((m.simples||{}).total)||0]; })
        .concat([['Total', ...['pis','cofins','irpj','csll','cpp','icms','iss','ipi'].map(k=>S(Mm,m=>(m.dasTrib||{})[k])), S(Mm,m=>S(['pis','cofins','irpj','csll','cpp','icms','iss','ipi'],k=>(m.dasTrib||{})[k])), S(Mm,m=>m.das), S(Mm,m=>(+m.subIcms||0)+(+m.subIss||0)+(+m.impIcms||0)+(+m.impIss||0)), S(Mm,m=>(m.simples||{}).total)]]),
      { depois:'Partilha pelos percentuais do Anexo e da faixa (LC 123, Anexos I–V; Res. CGSN 190/2026 a partir de 2027). "Simples total" = DAS + ICMS/ISS apurados fora da guia (sublimite/impedimento) + INSS patronal fora do DAS (Anexo IV) + FGTS não entra.' }));
    conc.push({ item:`Simples — Σ "Simples total" mensal × total anual do motor (${nomeEnt(e)})`, mem:S(Mm,m=>(m.simples||{}).total), motor:+e.T.simples||0 });
  }

  // 7.4 LUCRO PRESUMIDO
  sec('7.4', 'Lucro Presumido — presunção, IRPJ/CSLL, adicional, PIS/COFINS cumulativos e INSS patronal');
  par('Base do IRPJ = receita de serviços × 32 % + receita de comércio/indústria × 8 % (transporte e receitas financeiras pelas presunções próprias); IRPJ = 15 % da base; adicional = 10 % da parte da base acumulada no período de apuração que exceder R$ 20.000 por mês (R$ 60.000 no trimestre); CSLL = 9 % sobre a base presumida de 12 %/32 %; PIS 0,65 % e COFINS 3 % sobre a receita bruta; INSS patronal = 20 % + RAT ajustado + terceiros sobre a folha, configurados na incorporadora.');
  for (const e of todos){
    const Mm = e.R.meses, lp = m => m.lp||{}, bc = m => (m.lp&&m.lp.baseComp)||{};
    add(incMT(`Lucro Presumido — ${esc(nomeEnt(e))}: IRPJ e CSLL`, ['Mês','Receita','Serviços × 32 %','Comércio × 8 %','Base IRPJ','IRPJ 15 %','Base acum. período','Limite do período','Adicional 10 %','CSLL 9 %'],
      Mm.map((m,i) => [MES[i], +m.receita||0, +bc(m).base32||0, +bc(m).base8||0, { v:+lp(m).baseAdic||0 }, { v:+lp(m).irpj||0, f:`=E{r}*0.15` }, +lp(m).baseAdicPer||0, +lp(m).limAdicPer||0, +lp(m).adicional||0, +lp(m).csll||0])
        .concat([['Total', S(Mm,m=>m.receita), S(Mm,m=>bc(m).base32), S(Mm,m=>bc(m).base8), S(Mm,m=>lp(m).baseAdic), S(Mm,m=>lp(m).irpj), '', '', S(Mm,m=>lp(m).adicional), S(Mm,m=>lp(m).csll)]]),
      { depois:'Base IRPJ inclui transporte/financeiras quando houver (por isso pode diferir da soma das duas colunas de presunção). Adicional = 10 % × (base acumulada do período − limite), lançado no mês de fechamento do período.' }));
    add(incMT(`Lucro Presumido — ${esc(nomeEnt(e))}: demais tributos e total`, ['Mês','PIS 0,65 %','COFINS 3 %','INSS patronal','ICMS','IPI','ISS','FGTS (informativo)','Total LP'],
      Mm.map((m,i) => [MES[i], { v:+lp(m).pis||0 }, { v:+lp(m).cofins||0 }, +lp(m).inssPatr||0, +lp(m).icms||0, +lp(m).ipi||0, +lp(m).iss||0, +lp(m).fgts||0, +lp(m).total||0])
        .concat([['Total', S(Mm,m=>lp(m).pis), S(Mm,m=>lp(m).cofins), S(Mm,m=>lp(m).inssPatr), S(Mm,m=>lp(m).icms), S(Mm,m=>lp(m).ipi), S(Mm,m=>lp(m).iss), S(Mm,m=>lp(m).fgts), S(Mm,m=>lp(m).total)]]),
      { depois:'Total LP = IRPJ + adicional + CSLL + PIS + COFINS + INSS patronal + ICMS + IPI + ISS (o FGTS é encargo da folha em qualquer regime e não entra na comparação).' }));
    conc.push({ item:`Lucro Presumido — Σ mensal × total anual do motor (${nomeEnt(e)})`, mem:S(Mm,m=>lp(m).total), motor:+e.T.lp||0 });
  }

  // 7.5 LUCRO REAL
  sec('7.5', 'Lucro Real — resultado, apuração por período, PIS/COFINS não cumulativos');
  par('Base do IRPJ/CSLL = receita − custos − despesas dedutíveis − folha e encargos, apurada no período configurado (trimestral ou anual com estimativa), com compensação de prejuízo limitada a 30 %; IRPJ 15 % + adicional 10 % sobre o que exceder o limite do período; CSLL 9 %; PIS 1,65 % e COFINS 7,6 % sobre a receita, com créditos sobre os itens autorizados (insumos, energia, aluguéis PJ, depreciação etc.). Prejuízo fiscal das incorporadas não é aproveitado pela incorporadora (DL 2.341/87, art. 33).');
  for (const e of todos){
    const Mm = e.R.meses, lr = m => m.lr||{};
    add(incMT(`Lucro Real — ${esc(nomeEnt(e))}: resultado mensal e PIS/COFINS`, ['Mês','Receita','Custos','Despesas','Folha total','Base IRPJ/CSLL do mês','PIS 1,65 %','COFINS 7,6 %','Créditos PIS/COFINS','INSS patronal','Total LR'],
      Mm.map((m,i) => [MES[i], +m.receita||0, +m.custos||0, +m.despTotal||0, +m.folhaTotal||0, +lr(m).baseIRCS||0, +lr(m).pis||0, +lr(m).cofins||0, (+lr(m).credDesp||0), +lr(m).inssPatr||0, +lr(m).total||0])
        .concat([['Total', S(Mm,m=>m.receita), S(Mm,m=>m.custos), S(Mm,m=>m.despTotal), S(Mm,m=>m.folhaTotal), S(Mm,m=>lr(m).baseIRCS), S(Mm,m=>lr(m).pis), S(Mm,m=>lr(m).cofins), S(Mm,m=>lr(m).credDesp), S(Mm,m=>lr(m).inssPatr), S(Mm,m=>lr(m).total)]]),
      { depois:'PIS/COFINS já líquidos dos créditos do mês; saldo credor, quando houver, é transportado (colunas saldoCredorAnt/Fim do motor).' }));
    const ap = (e.R.lrApur && e.R.lrApur.linhas) || [];
    if (ap.length) add(incMT(`Lucro Real — ${esc(nomeEnt(e))}: apuração ${esc(e.R.lrApur.periodo||'')} do IRPJ/CSLL`, ['Período','Base do período','Prejuízo compensado (IRPJ)','Base IRPJ','IRPJ 15 %','Limite do adicional','Adicional 10 %','Base CSLL','CSLL 9 %','Total do período'],
      ap.map(l => [esc(l.rot), +l.base||0, +l.usadoIrpj||0, { v:+l.baseIrpj||0 }, { v:+l.irpj||0, f:`=D{r}*0.15` }, +l.limAd||0, { v:+l.adicional||0, f:`=MAX(0,D{r}-F{r})*0.1` }, +l.baseCsll||0, { v:+l.csll||0, f:`=H{r}*0.09` }, +l.total||0])
        .concat([['Total', S(ap,l=>l.base), S(ap,l=>l.usadoIrpj), S(ap,l=>l.baseIrpj), S(ap,l=>l.irpj), '', S(ap,l=>l.adicional), S(ap,l=>l.baseCsll), S(ap,l=>l.csll), S(ap,l=>l.total)]]),
      { depois:'Base negativa no período = prejuízo do período (IRPJ e CSLL zerados), compensável nos períodos seguintes até 30 % da base.' }));
    conc.push({ item:`Lucro Real — Σ mensal × total anual do motor (${nomeEnt(e)})`, mem:S(Mm,m=>lr(m).total), motor:+e.T.lr||0 });
  }

  // 7.6 REFORMA
  sec('7.6', 'Reforma Tributária 2027–2033 — alíquotas de teste, débito, crédito e caminhos');
  par('Para cada ano da transição: alíquota de CBS e de IBS (estadual e municipal) do ano, fração remanescente de PIS/COFINS e de ICMS/ISS, débito = base de receita × alíquota, crédito = compras/insumos com direito a crédito × alíquota, líquido = débito − crédito. Os três caminhos: "dentro" (Simples com IBS/CBS por dentro do DAS), "híbrido" (Simples com IBS/CBS por fora) e "regular" (Lucro Presumido ou Real, o mais barato).');
  for (const e of todos){
    const cen = e.R && e.cen ? e.cen : (e === cons ? R.consolidada.cen : (R.empresas.find(x=>x.cnpj===e.cnpj)||{}).cen);
    const REF = (cen && cen.REF) || [], alq = (cen && cen.rfx && cen.rfx.aliq) || {};
    if (!REF.length) continue;
    add(incMT(`Reforma — ${esc(nomeEnt(e))}: alíquotas do ano`, ['Ano','CBS %','IBS estadual %','IBS municipal %','IS %','PIS/COFINS remanescente','ICMS/ISS remanescente','Alíquota aplicada (motor)'],
      REF.map(r => { const a = alq[r.ano]||{}; return [String(r.ano), +a.cbs||0, +a.ibse||0, +a.ibsm||0, +a.is||0, { v:+a.remPisCof||0 }, { v:+a.remIcmsIss||0 }, { v:+r.alq||0 }]; }), { pct:{ 5:0, 6:0, 7:2 } }));
    add(incMT(`Reforma — ${esc(nomeEnt(e))}: débito, crédito e carga por caminho`, ['Ano','Base (receita)','Débito IBS/CBS','Crédito','Líquido','Caminho dentro','Caminho híbrido','Caminho regular','Regime do regular','Simples bloqueado?'],
      REF.map(r => [String(r.ano), +(cen.rfx&&cen.rfx.receita)||0, +r.deb||0, +r.cred||0, { v:+r.liquido||0, f:`=C{r}-D{r}` }, +r.dentro||0, +r.hib||0, +r.regular||0, esc(r.regNome||'—'), (e.T.anos&&e.T.anos[r.ano]&&e.T.anos[r.ano].snBloqueado) ? 'sim' : 'não']),
      { num:[false,true,true,true,true,true,true,true,false,false], depois:'Base e crédito vêm da aba Reforma da análise gravada; sem essa aba o motor usa o fallback (receita e compras da própria análise) e marca o parecer como tal.' }));
  }

  // 7.7 Δ E SCORE
  sec('7.7', 'Δ por tributo e score — com os números aplicados');
  const regs = ['simples','lp','lr'].filter(k => M.tributos[k]);
  for (const reg of regs){
    const T = M.tributos[reg];
    add(incMT(`Δ por tributo — ${INC_REGIME_NOME[reg]} (Δ = consolidada − Σ separadas)`, ['Tributo', ...ents.map(e=>esc(e.nome)), 'Σ separadas', 'Consolidada', 'Δ R$', 'Δ %'],
      T.linhas.filter(l=>!l.info).map(l => [esc(l.tributo), ...l.isos.map(v=>+v||0), { v:+l.soma||0, f:`=SUM(B{r}:${incColL(ents.length)}{r})` }, +l.cons||0, { v:+l.delta||0, f:`=${incColL(ents.length+2)}{r}-${incColL(ents.length+1)}{r}` }, { v:+l.pct||0 }])
        .concat([['Total', ...T.total.isos, T.total.soma, T.total.cons, T.total.cons - T.total.soma, { v: Math.abs(T.total.soma) > 0.005 ? (T.total.cons - T.total.soma)/Math.abs(T.total.soma) : 0 }]]), { pct:{ [ents.length+4]:2 } }));
  }
  const sc = M.melhor && M.melhor.score;
  if (sc) add(incMT('Score do melhor cenário — nota × peso', ['Dimensão','Nota (0–100)','Peso','Nota × peso','Fórmula','Leitura'],
    Object.entries(sc.dims).map(([k,d]) => [esc(k), { v:+d.nota||0 }, { v:+d.peso||0 }, { v:(+d.nota||0)*(+d.peso||0), f:`=B{r}*C{r}` }, esc(d.formula||''), esc(d.texto||'')]).concat([['Total', '', '', { v:+sc.total||0 }, 'Σ nota × peso', esc(M.painel.classe.rot)]]), { pct:{ 2:0 }, num:[false,true,true,true,false,false] }));

  // 7.8 CONCILIAÇÃO
  sec('7.8', 'Conciliação — memória × totais do parecer, ao centavo');
  const concL = conc.map(c => [c.item, c.mem, c.motor, { v:c.mem - c.motor, f:`=B{r}-C{r}` }, Math.abs(c.mem - c.motor) <= 0.015 ? 'confere' : (/parcelas por bloco/.test(c.item) ? 'diferença = parcelas fora da guia (ver 7.3)' : 'DIVERGE — verificar')]);
  add(incMT('Conciliação', ['Item','Σ memória','Total do motor (parecer)','Diferença','Situação'], concL, { num:[false,true,true,true,false] }));
  return { blocos:B, abas:ABAS, conciliacao:conc };
}
// verificação usada pela suíte: todas as somas mensais fecham com os totais do motor
function incMemoriaConfere(M){ const c = incMemoriaCompleta(M).conciliacao.filter(x => !/parcelas por bloco/.test(x.item)); return { ok: c.every(x => Math.abs(x.mem - x.motor) <= 0.015), itens: c }; }
