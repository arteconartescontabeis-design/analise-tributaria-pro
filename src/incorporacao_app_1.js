// ═══════════════════════════════════════════════════════════════════════════════════════════
//  SIMULAÇÃO DE INCORPORAÇÃO — código PRÓPRIO deste arquivo (nada disto existe no index.html)
//  Tudo acima desta linha foi COPIADO do index.html pelo tools/build_incorporacao.js (núcleo,
//  motor lacrado, projeção, Reforma, lacre, papel timbrado). Tudo abaixo é do incorporação.
//  Regra: as análises originais são só LIDAS; o motor é chamado, nunca alterado.
// ═══════════════════════════════════════════════════════════════════════════════════════════
const INC_VERSAO = '1.0.0';
const APP_VERSAO = 'INC ' + INC_VERSAO;             // usado pelo lacreBoot (chave própria no localStorage)
const INC_TABELA = 'atp_incorporacoes';
const INC_FN_IA  = 'gerar-parecer-incorporacao';
const INC_ANOS_REF = [2027,2028,2029,2030,2031,2032,2033];
const INC_CHANGELOG = [
  ['1.0.0','01/09/2026','<b>🏗️ Primeira versão — simulação de incorporação de 2 ou mais empresas.</b> Seleciona a <b>incorporadora</b> (CNPJ que sobrevive) e as <b>incorporadas</b>, importa as análises GRAVADAS do Análise Tributária Pro (só leitura), projeta individualmente cada empresa com ano incompleto e monta uma análise <b>consolidada</b> que passa pelo MESMO motor lacrado: receitas, folha, compras e despesas somadas mês a mês; <b>RBT12 = soma</b> dos RBT12 (decisão de 01/09); ISS e ICMS pela <b>média ponderada</b> das bases de cada empresa (o ISS segue o município e o ICMS a UF do estabelecimento, que vira filial); RAT, Terceiros, presunções, período do LR e opções da incorporadora; anexo, faixa, Fator R, trava da 5ª faixa, sublimite e adicional de IRPJ decididos pelo motor. <b>Operações entre as empresas</b> são detectadas nos analíticos de venda/compra gravados e abatidas só após confirmação, com rateio mensal declarado. Quadro isoladas × soma × consolidada × Δ nos três regimes e na Reforma 2027–2033 (por dentro, híbrido art. 22-A, regime regular), alertas de fronteira (limite, sublimite, faixa, Fator R, adicional, <b>prejuízo fiscal das incorporadas não aproveitável</b> — DL 2.341/87, art. 33), memória de cálculo, gravação em tabela própria <code>atp_incorporacoes</code> com histórico e reabertura por snapshot (sem recálculo), botões <b>Importar dados</b> e <b>Recalcular</b> separados, parecer no papel timbrado com textos de IA pela Edge Function própria <code>gerar-parecer-incorporacao</code> e fallback integral. Motor: cópia fiel do index, mesmo lacre; conferência do lacre do index em produção a cada abertura.'],
];

// ── estado ────────────────────────────────────────────────────────────────────────────────
const INC = {
  sel: { incorporadora:'', incorporadas:[], ano: new Date().getFullYear(), janela:'' },
  entradas: null,      // { ano, janela, importadoEm, empresas:[{cnpj,nome,regime,dados,atualizadoEm,analiticos:{venda,compra}}] }
  prem:     { abatimentos:[], manuais:[] },
  res:      null,      // resultado de incSimular()
  salvo:    null,      // registro gravado (id, criado_em…) quando reaberto/gravado
  _ia:      null, _iaErro:null,
  motorIndex: null,    // { hash, versao } lidos do index.html em produção
};
const incRaiz = c => String(c||'').replace(/\D/g,'').slice(0,8);
const incNome = cnpj => { const e = EMPRESAS.find(x=>x.cnpj===cnpj); return e ? (e.razao_social||e.nome||cnpj) : cnpj; };
const incRegime = cnpj => { const e = EMPRESAS.find(x=>x.cnpj===cnpj); return e ? String(e.regime||'') : ''; };
const incEhSimples = regime => /simples|mei/i.test(String(regime||''));
const clone = o => JSON.parse(JSON.stringify(o));

// ── sessão / navegação (o núcleo copiado chama entrar() depois do login) ─────────────────
async function entrar(){
  prCarregar();
  { const b = $id('badge-versao'); if (b) b.textContent = 'Simulação de Incorporação v' + INC_VERSAO + ' · motor ' + LACRE_HASH; }
  lacreBoot();
  incLacreCruzado();
  try {
    const u = await supa('GET','atp_usuarios',{ params:{ select:'papel,escritorio_id', email:`eq.${APP.user?.email||''}`, limit:'1' } });
    APP.papel = u?.[0]?.papel || 'operador'; APP.escritorioId = u?.[0]?.escritorio_id || null;
  } catch { APP.papel = 'operador'; APP.escritorioId = null; }
  $id('auth-screen').style.display = 'none';
  $id('app').style.display = 'block';
  $id('user-email').textContent = APP.user?.email || '';
  incVersoesRender();
  await empCarregar();
  incRenderSel();
  go('sim');
}
function go(page){
  APP.page = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page===page));
  ['sim','historico','versoes'].forEach(p => { const el = $id('page-'+p); if (el) el.style.display = p===page ? 'block' : 'none'; });
  if (page==='historico') incHistCarregar();
  if (page==='versoes'){ lacreRender(); incMotorBoxRender(); }
}
async function empCarregar(){
  try { EMPRESAS = await supa('GET','atp_empresas',{ params:{ select:'*', analise:'is.true', order:'razao_social.asc', limit:'1000' } }) || []; }
  catch { EMPRESAS = []; }
}

// ── conferência cruzada: o motor deste arquivo × o motor do index em produção ────────────
async function incLacreCruzado(){
  const box = $id('inc-lacre-cruzado'); if (!box) return;
  try {
    const r = await fetch('index.html', { cache:'no-store' });
    if (!r.ok) throw new Error('HTTP '+r.status);
    const t = await r.text();
    const hash = (t.match(/const LACRE_HASH = '([0-9a-f]+)'/)||[])[1] || null;
    const versao = (t.match(/const APP_VERSAO = '([^']+)'/)||[])[1] || null;
    INC.motorIndex = { hash, versao, lidoEm: new Date().toISOString() };
    if (hash && hash !== LACRE_HASH){
      box.style.display = 'block';
      box.innerHTML = `<div style="background:var(--warn-bg);border-left:4px solid var(--warn);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px">
        ⚠️ <b>Motor defasado.</b> O Análise Tributária Pro em produção (v${esc(versao||'?')}) foi re-selado com o lacre <code>${esc(hash)}</code>, e esta cópia usa <code>${LACRE_HASH}</code>.
        As simulações continuam funcionando, mas saem marcadas como calculadas com motor defasado — regere o <code>incorporacao.html</code> com <code>node tools/build_incorporacao.js</code> e publique.</div>`;
    } else box.style.display = 'none';
  } catch(e){ INC.motorIndex = { hash:null, versao:null, erro: e.message }; box.style.display = 'none'; }
  incMotorBoxRender();
}
function incMotorDefasado(){ return !!(INC.motorIndex && INC.motorIndex.hash && INC.motorIndex.hash !== LACRE_HASH); }
function incMotorBoxRender(){
  const el = $id('inc-motor-box'); if (!el) return;
  const M = INC.motorIndex || {};
  const ok = M.hash && M.hash === LACRE_HASH;
  el.innerHTML = `<div class="card" style="border-left:6px solid ${ok?'var(--ok)':(M.hash?'var(--warn)':'var(--muted)')}">
    <h3>Motor copiado do Análise Tributária Pro</h3>
    <div class="hint">Este arquivo usa uma <b>cópia fiel</b> do motor de cálculo do index.html, conferida pelo mesmo lacre (<code>${LACRE_HASH}</code>).
    ${ok ? `✅ O index em produção (v${esc(M.versao||'?')}) tem o mesmo lacre — os dois aplicativos calculam igual.`
         : M.hash ? `⚠️ O index em produção (v${esc(M.versao||'?')}) tem lacre <code>${esc(M.hash)}</code> — o motor foi re-selado lá e esta cópia precisa ser regerada (tools/build_incorporacao.js).`
         : `ℹ️ Não foi possível ler o index.html em produção${M.erro?' ('+esc(M.erro)+')':''} — a conferência cruzada roda quando os dois arquivos estão publicados na mesma pasta.`}</div></div>`;
}

// ── seleção ───────────────────────────────────────────────────────────────────────────────
function incRenderSel(){
  const sel = $id('inc-incorporadora'); if (!sel) return;
  const at = sel.value;
  sel.innerHTML = '<option value="">— selecione —</option>' + EMPRESAS.map(e=>`<option value="${e.cnpj}">${esc(e.razao_social||e.cnpj)} · ${fmtCNPJ(e.cnpj)}</option>`).join('');
  sel.value = at || INC.sel.incorporadora || '';
  const j = $id('inc-janela');
  if (j && j.options.length <= 1) for (const [k,v] of Object.entries(PROJ_JANELAS)) j.insertAdjacentHTML('beforeend', `<option value="${k}">${esc(v)}</option>`);
  $id('inc-ano').value = INC.sel.ano;
  incRenderIncorporadas();
  incSelMudou(true);
}
function incRenderIncorporadas(){
  const box = $id('inc-incorporadas'); if (!box) return;
  const f = ($id('inc-filtro')?.value||'').toLowerCase().replace(/[.\/-]/g,'');
  const inc = $id('inc-incorporadora')?.value || '';
  const lista = EMPRESAS.filter(e => e.cnpj !== inc && (!f || (e.razao_social||'').toLowerCase().includes(f) || e.cnpj.includes(f)));
  box.innerHTML = lista.length ? lista.map(e => `<label style="display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0;font-weight:400;color:var(--text);font-size:13px;margin:2px 0">
    <input type="checkbox" style="width:auto" value="${e.cnpj}" ${INC.sel.incorporadas.includes(e.cnpj)?'checked':''} onchange="incSelMudou()"> ${esc(e.razao_social||e.cnpj)} <span class="hint">${fmtCNPJ(e.cnpj)}${e.regime?' · '+esc(e.regime):''}</span></label>`).join('')
    : '<div class="hint">Nenhuma empresa em análise no cadastro.</div>';
}
function incSelMudou(silencioso){
  INC.sel.incorporadora = $id('inc-incorporadora')?.value || '';
  INC.sel.incorporadas = Array.from(document.querySelectorAll('#inc-incorporadas input:checked')).map(i=>i.value).filter(c=>c!==INC.sel.incorporadora);
  INC.sel.ano = +($id('inc-ano')?.value) || new Date().getFullYear();
  INC.sel.janela = $id('inc-janela')?.value || '';
  incRenderIncorporadas();
  const n = INC.sel.incorporadas.length;
  const h = $id('inc-sel-hint');
  if (h) h.textContent = !INC.sel.incorporadora ? 'Escolha a incorporadora.' : n ? `${incNome(INC.sel.incorporadora)} + ${n} incorporada${n>1?'s':''} · ${INC.sel.ano}` : 'Marque ao menos uma incorporada.';
  const pronto = !!INC.sel.incorporadora && n >= 1;
  $id('inc-btn-importar').disabled = !pronto;
  // mudou a seleção depois de importar → o que está na tela não corresponde mais
  if (!silencioso && INC.entradas && incChaveSel(INC.entradas) !== incChaveSel(INC.sel)){
    $id('inc-btn-calcular').disabled = true; $id('inc-btn-detectar').disabled = true; $id('inc-btn-recalcular').disabled = true;
    const e = $id('inc-entradas'); if (e) e.innerHTML = '<div class="hint" style="color:var(--warn)">A seleção mudou — clique em <b>Importar dados</b> de novo.</div>';
  }
}
function incChaveSel(s){ return [s.incorporadora, ...(s.incorporadas||[]).slice().sort()].join('|') + '#' + s.ano; }
function incCnpjsSel(){ return [INC.sel.incorporadora, ...INC.sel.incorporadas]; }

// ── importação: lê as análises gravadas (só leitura) ──────────────────────────────────────
async function incImportar(){
  if (!INC.sel.incorporadora || !INC.sel.incorporadas.length){ toast('Escolha a incorporadora e ao menos uma incorporada.'); return; }
  if (INC.res && !await dlgSimNao('Importar de novo?', 'A cópia dos dados desta simulação será substituída pelo que está gravado hoje nas análises. O resultado na tela deixa de valer até você clicar em Calcular. Continuar?')) return;
  await comBotao('inc-btn-importar', '⏳ Importando…', async () => {
    const ano = INC.sel.ano, faltam = [], emps = [];
    for (const cnpj of incCnpjsSel()){
      const e = await incLerEmpresa(cnpj, ano);
      if (!e) faltam.push(cnpj); else emps.push(e);
    }
    if (faltam.length){
      alert('Sem análise gravada em ' + ano + ' para:\n\n' + faltam.map(c=>'• '+incNome(c)+' ('+fmtCNPJ(c)+')').join('\n') + '\n\nGrave a análise no Análise Tributária Pro e importe de novo.');
      return;
    }
    const jaTinha = !!INC.entradas;
    INC.entradas = { ano, janela: INC.sel.janela||'', importadoEm: new Date().toISOString(), empresas: emps,
                     chave: incChaveSel(INC.sel), motorLacre: LACRE_HASH };
    INC.res = null; INC._ia = null; INC._iaErro = null; INC.salvo = jaTinha && INC.salvo && INC.salvo._chave===INC.entradas.chave ? INC.salvo : null;
    // abatimentos: detecta de novo; mantém a decisão (aplicar sim/não) de pares já vistos
    const antigos = INC.prem.abatimentos || [];
    INC.prem.abatimentos = incDetectarIntragrupo(INC.entradas).map(a => {
      const ant = antigos.find(x => x.de===a.de && x.para===a.para && x.natureza===a.natureza);
      return ant ? { ...a, aplicar: ant.aplicar } : a;
    });
    incEntradasRender(); incIntraRender();
    $id('inc-btn-detectar').disabled = false; $id('inc-btn-calcular').disabled = false; $id('inc-btn-recalcular').disabled = true;
    $id('inc-resultado').style.display = 'none'; $id('inc-card-parecer').style.display = 'none';
    toast('Dados importados de ' + emps.length + ' empresas. Confira as operações intragrupo e clique em Calcular.');
  });
}
async function incLerEmpresa(cnpj, ano){
  const rows = await supa('GET','atp_analises',{ params:{ select:'*', cnpj:`eq.${cnpj}`, ano:`eq.${ano}`, limit:'1' } }) || [];
  if (!rows.length || !rows[0].dados) return null;
  const r = rows[0];
  const analiticos = { venda:null, compra:null };
  try {
    const fr = await supa('GET','atp_fornec',{ params:{ cnpj:'eq.'+cnpj, order:'consultado_em.desc', select:'*', limit:'40' } }) || [];
    for (const f of fr){ const t = f.dados && f.dados.tipo; if ((t==='venda'||t==='compra') && !analiticos[t]) analiticos[t] = { periodo: f.dados.periodo||'', itens: f.dados.itens||[], em: f.consultado_em||null }; }
  } catch(e){ console.error('analíticos', e); }
  return { cnpj, nome: incNome(cnpj), regime: incRegime(cnpj), dados: anNormalizar(r.dados, cnpj, ano),
           atualizadoEm: r.atualizado_em || r.updated_at || r.criado_em || null, status: r.status||null, analiticos };
}
function incEntradasRender(){
  const el = $id('inc-entradas'); const E = INC.entradas; if (!el || !E) return;
  const lin = E.empresas.map((e,i) => {
    const d = e.dados, ult = ultimoMesCoberto(d), rec = PROJ_KREC.reduce((s,k)=>s+S(d.receitas[k]),0);
    const an = e.analiticos;
    return `<tr><td class="rot">${i===0?'<span class="badge ok">incorporadora</span> ':''}${esc(e.nome)}<br><span class="hint">${fmtCNPJ(e.cnpj)}${e.regime?' · '+esc(e.regime):''}</span></td>
      <td class="num">${fmtR(rec)}</td><td>${ult<0?'—':MESES[0]+'–'+MESES[ult]}${ult>=0&&ult<11?' <span class="hint">(projeta '+(11-ult)+' meses)</span>':''}</td>
      <td>${e.atualizadoEm?new Date(e.atualizadoEm).toLocaleString('pt-BR'):'—'}${e.status==='fechada'?' <span class="badge ok">fechada</span>':''}</td>
      <td>${an.venda?'venda ('+esc(an.venda.periodo)+')':'<span class="hint">sem venda</span>'}<br>${an.compra?'compra ('+esc(an.compra.periodo)+')':'<span class="hint">sem compra</span>'}</td></tr>`; }).join('');
  el.innerHTML = `<div class="hint" style="margin-bottom:6px">Cópia importada em <b>${new Date(E.importadoEm).toLocaleString('pt-BR')}</b> · ano ${E.ano} · janela de projeção: ${E.janela ? esc(PROJ_JANELAS[E.janela]||E.janela) : 'a de cada empresa'}. A simulação trabalha sobre esta cópia; se alguma análise mudar no Análise Tributária Pro, use <b>Importar dados</b>.</div>
    <table class="gtable"><thead><tr><th>Empresa</th><th class="num">Receita lançada</th><th>Meses lançados</th><th>Análise atualizada em</th><th>Analíticos gravados</th></tr></thead><tbody>${lin}</tbody></table>`;
}
// reabertura: as análises mudaram depois da importação?
async function incConferirDefasagem(E){
  const avisos = [];
  for (const e of E.empresas){
    try { const r = await supa('GET','atp_analises',{ params:{ select:'atualizado_em,criado_em', cnpj:`eq.${e.cnpj}`, ano:`eq.${E.ano}`, limit:'1' } }) || [];
      const em = r[0] && (r[0].atualizado_em || r[0].criado_em);
      if (em && e.atualizadoEm && new Date(em) > new Date(e.atualizadoEm)) avisos.push(`${e.nome}: análise alterada em ${new Date(em).toLocaleString('pt-BR')} (cópia de ${new Date(e.atualizadoEm).toLocaleString('pt-BR')})`);
      if (!r.length) avisos.push(`${e.nome}: a análise de ${E.ano} não está mais gravada`);
    } catch(err){ /* sem rede: não bloqueia a reabertura */ }
  }
  return avisos;
}

// ── operações entre as empresas (intragrupo) ─────────────────────────────────────────────
// Lê os analíticos GRAVADOS (atp_fornec, tipo venda/compra) de cada empresa e procura as demais
// empresas do grupo entre as contrapartes. Só há total por parceiro e CFOP, sem abertura mensal:
// o valor é rateado pela receita mensal do vendedor nos meses do período do analítico.
const INC_CFOP_SERV = /^(8|9|[1256]933|[1256]932)/;
function incNaturezaCfops(cfops){
  let serv = 0, merc = 0;
  for (const [c,v] of Object.entries(cfops||{})) if (INC_CFOP_SERV.test(String(c))) serv += +v||0; else merc += +v||0;
  return { serv, merc };
}
function incMesesPeriodo(per, ano){
  const m = String(per||'').match(/(\d{2})\/(\d{2})\/(\d{4})\D+?(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return [...Array(12).keys()];
  const a0=+m[3], m0=+m[2]-1, a1=+m[6], m1=+m[5]-1, out=[];
  for (let a=a0, mm=m0; a<a1 || (a===a1 && mm<=m1); mm++){ if (mm>11){ mm=0; a++; if (a>a1) break; } if (a===+ano) out.push(mm); if (out.length>24) break; }
  return out.length ? [...new Set(out)] : [...Array(12).keys()];
}
function incDetectarIntragrupo(E){
  const out = [];
  const emps = E.empresas;
  const acha = (itens, alvo) => (itens||[]).filter(i => String(i.cnpj||'').replace(/\D/g,'') === alvo.cnpj || (String(i.cnpj||'').replace(/\D/g,'').length===14 && incRaiz(i.cnpj)===incRaiz(alvo.cnpj)));
  for (const X of emps) for (const Y of emps){
    if (X.cnpj === Y.cnpj) continue;
    const vend = X.analiticos?.venda, comp = Y.analiticos?.compra;
    const lv = vend ? acha(vend.itens, Y) : [], lc = comp ? acha(comp.itens, X) : [];
    if (!lv.length && !lc.length) continue;
    const somaN = L => L.reduce((a,i)=>{ const n = incNaturezaCfops(i.cfops); a.serv+=n.serv; a.merc+=n.merc; a.tot+=(+i.valor||0); return a; }, {serv:0,merc:0,tot:0});
    const nv = somaN(lv), nc = somaN(lc);
    // se nem serv nem merc (analítico sem CFOP), cai tudo em mercadoria
    const fonte = lv.length ? 'venda' : 'compra', N = lv.length ? nv : nc, per = lv.length ? vend.periodo : comp.periodo;
    const filial = [...lv, ...lc].some(i => String(i.cnpj||'').replace(/\D/g,'') !== (lv.length?Y:X).cnpj);
    for (const [nat, val] of [['mercadoria', N.merc + (N.serv||N.merc ? 0 : N.tot)], ['servico', N.serv]]){
      if (val <= 0.005) continue;
      out.push({ de:X.cnpj, para:Y.cnpj, natureza:nat, valor:r2(val), periodo:per||'', meses: incMesesPeriodo(per, E.ano),
        fonte: fonte==='venda' ? `analítico de VENDA de ${X.nome}` : `analítico de COMPRA de ${Y.nome}`,
        outroLado: (lv.length && lc.length) ? r2(fonte==='venda' ? nc.tot : nv.tot) : null,
        filial, aplicar:true, origem:'analitico' });
    }
  }
  // sem analítico de nenhum lado: registrar os pares "não verificáveis"
  for (const X of emps) for (const Y of emps){
    if (X.cnpj===Y.cnpj) continue;
    if (!X.analiticos?.venda && !Y.analiticos?.compra && !out.some(o=>o.de===X.cnpj&&o.para===Y.cnpj))
      out.push({ de:X.cnpj, para:Y.cnpj, natureza:null, valor:0, meses:[...Array(12).keys()], fonte:'sem analítico de venda de '+X.nome+' nem de compra de '+Y.nome, aplicar:false, origem:'nao_verificavel' });
  }
  return out;
}
function incDetectarUI(){
  if (!INC.entradas) return;
  const antigos = INC.prem.abatimentos || [];
  INC.prem.abatimentos = incDetectarIntragrupo(INC.entradas).map(a => { const ant = antigos.find(x=>x.de===a.de&&x.para===a.para&&x.natureza===a.natureza); return ant ? {...a, aplicar:ant.aplicar} : a; })
    .concat(antigos.filter(a=>a.origem==='manual'));
  incIntraRender();
  const n = INC.prem.abatimentos.filter(a=>a.origem==='analitico').length;
  toast(n ? n + ' operação(ões) entre as empresas encontrada(s).' : 'Nenhuma operação entre as empresas foi encontrada nos analíticos gravados.');
}
function incIntraRender(){
  const card = $id('inc-card-intra'), el = $id('inc-intra'); if (!card || !el || !INC.entradas) return;
  card.style.display = 'block';
  const A = INC.prem.abatimentos || [];
  const det = A.filter(a=>a.origem!=='nao_verificavel'), nv = A.filter(a=>a.origem==='nao_verificavel');
  let h = '';
  if (det.length){
    h += `<table class="gtable"><thead><tr><th></th><th>Vendeu</th><th>→ Comprou</th><th>Natureza</th><th class="num">Valor no ano</th><th>Meses (rateio)</th><th>Fonte</th></tr></thead><tbody>` +
      det.map((a,i) => `<tr><td><input type="checkbox" style="width:auto" ${a.aplicar?'checked':''} onchange="INC.prem.abatimentos[${A.indexOf(a)}].aplicar=this.checked;incMarcarSujo()"></td>
        <td>${esc(incNome(a.de))}</td><td>${esc(incNome(a.para))}</td><td>${a.natureza==='servico'?'serviço':'mercadoria'}</td>
        <td class="num">${fmtR(a.valor)}${a.outroLado!=null&&Math.abs(a.outroLado-a.valor)>0.5?`<br><span class="hint" title="o analítico do outro lado registra valor diferente">outro lado: ${fmtR(a.outroLado)}</span>`:''}</td>
        <td>${a.meses.length===12?'jan–dez':a.meses.map(m=>MESES[m]).join(', ')}${a.filial?' <span class="hint">(inclui filial)</span>':''}</td>
        <td class="hint">${esc(a.fonte)}${a.origem==='manual'?' · <a href="#" onclick="incAbatRemover('+A.indexOf(a)+');return false">remover</a>':''}</td></tr>`).join('') + '</tbody></table>';
  } else h += '<div class="hint">Nenhuma operação entre as empresas foi encontrada nos analíticos gravados.</div>';
  if (nv.length) h += `<div class="hint" style="margin-top:8px;color:var(--warn)">Sem analítico para verificar: ${nv.map(a=>esc(incNome(a.de))+' → '+esc(incNome(a.para))).join(' · ')}. Se houver operação entre elas, informe abaixo.</div>`;
  h += `<div class="toolbar" style="margin:10px 0 0;gap:8px;align-items:flex-end;flex-wrap:wrap">
    <div style="min-width:200px"><label>Vendeu</label><select id="inc-ab-de">${INC.entradas.empresas.map(e=>`<option value="${e.cnpj}">${esc(e.nome)}</option>`).join('')}</select></div>
    <div style="min-width:200px"><label>Comprou</label><select id="inc-ab-para">${INC.entradas.empresas.map((e,i)=>`<option value="${e.cnpj}" ${i===1?'selected':''}>${esc(e.nome)}</option>`).join('')}</select></div>
    <div style="width:140px"><label>Natureza</label><select id="inc-ab-nat"><option value="mercadoria">mercadoria</option><option value="servico">serviço</option></select></div>
    <div style="width:160px"><label>Valor no ano</label><input id="inc-ab-valor" placeholder="0,00"></div>
    <button class="btn" onclick="incAbatManual()">＋ Informar operação (origem D)</button></div>
    <div class="hint" style="margin-top:6px">Abatimento: a receita do vendedor e as compras (mercadoria) ou despesas (serviço) do comprador são reduzidas no mesmo valor, rateado pelos meses indicados na proporção da receita mensal do vendedor. O RBT12 do ano anterior <b>não</b> é abatido (não há analítico do ano anterior) — premissa declarada no parecer.</div>`;
  el.innerHTML = h;
}
function incAbatManual(){
  const de = $id('inc-ab-de').value, para = $id('inc-ab-para').value, nat = $id('inc-ab-nat').value;
  const v = +String($id('inc-ab-valor').value||'').replace(/\./g,'').replace(',','.') || 0;
  if (de===para){ toast('Vendedor e comprador precisam ser empresas diferentes.'); return; }
  if (!(v>0)){ toast('Informe o valor.'); return; }
  INC.prem.abatimentos = (INC.prem.abatimentos||[]).filter(a => !(a.origem==='nao_verificavel' && a.de===de && a.para===para));
  INC.prem.abatimentos.push({ de, para, natureza:nat, valor:r2(v), periodo:'', meses:[...Array(12).keys()], fonte:'informado na tela (origem D)', aplicar:true, origem:'manual' });
  incIntraRender(); incMarcarSujo();
}
function incAbatRemover(i){ INC.prem.abatimentos.splice(i,1); incIntraRender(); incMarcarSujo(); }
function incMarcarSujo(){ if (INC.res){ const s = $id('inc-res-status'); if (s) s.innerHTML = '<span style="color:var(--warn)">Premissas alteradas — clique em <b>Recalcular</b>.</span>'; $id('inc-btn-recalcular').disabled = false; } }
