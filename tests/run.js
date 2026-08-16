#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  Análise Tributária Pro — Suíte de testes (roda local e no GitHub Actions)
//  Uso:  node tests/run.js        (a partir da raiz do repositório)
//  Lê o ../index.html do repositório, executa o motor num sandbox e valida:
//   1. Motor do Simples (decomposição fecha com o DAS em cenários sintéticos)
//   2. Correções v7.1 (Anexo IV, retenções, LP monofásico, proxy de créditos)
//   3. Sensibilidade de parâmetros (edições de alíquotas fluem ao resultado)
//   4. Parecer (3 variantes renderizam sem exceção, com aviso de premissa)
//   5. Regressão dos gabaritos (tests/fixtures/caso1.json e caso2.json)
//   5d. Res. CGSN nº 190/2026 — partilha por vigência, art. 22-A e travas (v7.17.0)
//   5e. v7.18.0 — Tema 69 (LP sem dupla exclusão do mono; LR com exclusão) e FGTS fora dos totais
//  Sai com código ≠ 0 em qualquer falha — o CI bloqueia o push quebrado.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]).join('\n');

// ── sandbox DOM mínimo ──
const mkEl = () => { const el = { innerHTML:'', textContent:'', _v:'', style:{}, classList:{add(){},remove(){},toggle(){}},
  selectedOptions:[{text:'Mensal'}], addEventListener(){}, appendChild(){}, setAttribute(){}, getContext:()=>({}),
  options:[], checked:true, files:[], dataset:{}, querySelector:()=>mkEl(), querySelectorAll:()=>[] };
  Object.defineProperty(el,'value',{ get(){return el._v;}, set(v){el._v=String(v);} }); return el; };
const els = {};
const doc = { getElementById:id=>els[id]||(els[id]=mkEl()), querySelector:()=>mkEl(), querySelectorAll:()=>[],
  createElement:()=>mkEl(), addEventListener(){}, body:mkEl(), head:mkEl() };
const ctx = { document:doc, window:{ addEventListener(){}, print(){} },
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}}, sessionStorage:{getItem:()=>null,setItem(){}},
  fetch:async()=>({ok:true,json:async()=>({}),text:async()=>''}), navigator:{}, console:{...console,log(){},error(){}},
  setTimeout, clearTimeout, alert(){}, confirm:()=>true, URL, atob:s=>s, btoa:s=>s, AbortController, AbortSignal };
ctx.window.document = doc; vm.createContext(ctx);
try { vm.runInContext(js, ctx); } catch(e) { /* init sem DOM real */ }

const g = ctx;
const AD = vm.runInContext('ANEXOS_DEFAULT', ctx), FD = vm.runInContext('FOLHA_PERC_DEFAULT', ctx);
const RT = vm.runInContext('REP_TRIB', ctx), RL = vm.runInContext('RL', ctx);
const clone = o => JSON.parse(JSON.stringify(o));
const z = () => Array(12).fill(0);
const mk = (rec, rbt, cfgx) => ({ cfg: Object.assign({ ano:2025, iss:.05, icmsV:.17, icmsC:.12, ipiV:0, ipiC:0,
    rbt12Direto:0, rbt12Lanc:Array(12).fill(rbt/12), folha12Lanc:Array(12).fill(20000),
    lpBaseServ:.32, lpBaseCom:.08, adicionalIR:'off', sublimite:'auto' }, cfgx||{}),
  receitas: Object.assign(Object.fromEntries(['a1_semst','a1_red','a1_red_pct','a1_mono','a1_mono_pct','a1_comst','a1_comst_mono','a2_semst','a2_red','a2_red_pct','a2_mono','a2_comst','a2_comst_mono','a3_semret','a3_retiss','a3_retissinss','a4','a5r','fin','comtransp'].map(k=>[k,z()])), rec),
  folha:{ prolabore:Array(12).fill(5000), salarios:Array(12).fill(20000), baseFgts:Array(12).fill(20000), prov13:z(), provFerias:z() },
  compras: Object.fromEntries(['semst','baixaSemst','mono','baixaMono','comst','baixaComst','comstMono','baixaComstMono','baseIpiCred'].map(k=>[k,z()])),
  icms:{cred:null,deb:null}, ipi:{cred:null,deb:null}, folha13:{prolabore13:0,salarios13:0,baseFgts13:0},
  despesas: Object.fromEntries(['adm','vendas','fiscais','financeiras','outras','credLR'].map(k=>[k,z()])) });

let OK = 0, FALHAS = [];
const chk = (nome, cond, det) => { if (cond) { OK++; console.log('  ✓', nome, det||''); }
  else { FALHAS.push(nome); console.log('  ✗ FALHA:', nome, det||''); } };
const somaDT = M => Object.values(M.dasTrib).reduce((a,b)=>a+b,0);

// ═══ 1. MOTOR ═══
console.log('\n■ Motor do Simples');
{ const casos = [
    ['Anexo I puro', mk({a1_semst:Array(12).fill(100000)},1200000)],
    ['Anexo III Fator R ≥28%', mk({a3_semret:Array(12).fill(50000)},600000,{folha12Lanc:Array(12).fill(17000)})],
    ['Anexo V Fator R <28%', mk({a5r:Array(12).fill(50000)},600000,{folha12Lanc:Array(12).fill(5000)})],
    ['Misto com ST/mono/retenção/IV', mk({a1_semst:Array(12).fill(80000),a1_comst:Array(12).fill(30000),a1_mono:Array(12).fill(10000),a1_mono_pct:Array(12).fill(1),a3_retiss:Array(12).fill(40000),a4:Array(12).fill(20000)},2400000)],
    ['Sublimite > 3,6 mi', mk({a1_semst:Array(12).fill(200000),a3_semret:Array(12).fill(150000)},4200000)] ];
  let pior = 0, recOk = true;
  for (const [, inp] of casos) { const r = g.calcular(inp, clone(AD), {...FD});
    for (const M of r.meses) pior = Math.max(pior, Math.abs(somaDT(M) - (M.das + M.subIcms + M.subIss)));
    if (Math.abs(r.totais.recCom + r.totais.recServ - r.totais.receita) > 0.01) recOk = false; }
  chk('Σ decomposição = DAS(+trava) nos 60 meses', pior < 0.01, 'Δmax='+pior.toFixed(6));
  chk('recCom + recServ = receita', recOk); }
{ const RX = g.repEfetiva(clone(AD)); let dif = 0, soma100 = true;
  for (const ax of Object.keys(RT)) for (let f=0; f<6; f++) {
    const s = Object.values(RX[ax]).reduce((a,v)=>a+v[f],0);
    if (Math.abs(s-1) > 1e-9) soma100 = false;
    for (const t of Object.keys(RT[ax])) dif = Math.max(dif, Math.abs(RX[ax][t][f]-RT[ax][t][f])); }
  chk('repEfetiva ≡ repartição LC 123 com padrões', dif < 1e-9);
  chk('repEfetiva soma 100% em todas as faixas', soma100); }

// ═══ 2. CORREÇÕES v7.1 ═══
console.log('\n■ Correções da revisão (v7.1)');
{ const r = g.calcular(mk({a4:Array(12).fill(50000)},600000), clone(AD), {...FD}); const M = r.meses[0];
  chk('A1 · CPP do Anexo IV no total do Simples (sem FGTS desde a v7.18.0)', Math.abs(M.simples.total-(M.das+M.inssPatr))<0.01); }
{ const a = g.calcular(mk({a3_semret:Array(12).fill(50000)},600000), clone(AD), {...FD});
  const b = g.calcular(mk({a3_retiss:Array(12).fill(50000)},600000), clone(AD), {...FD});
  chk('A2 (v7.23.0) · com retenção, o total do Simples é MENOR exatamente pelo ISS retido (não recomposto)',
    b.totais.issRetido>1 && Math.abs((a.totais.simples-b.totais.simples)-b.totais.issRetido)<0.5,
    'Δ='+(a.totais.simples-b.totais.simples).toFixed(2)+' · retido='+b.totais.issRetido.toFixed(2)); }
{ const r = g.calcular(mk({a1_mono:Array(12).fill(100000)},1200000), clone(AD), {...FD});
  chk('A3 · LP monofásico: PIS+COFINS = 0', Math.abs(r.meses[0].lp.pis+r.meses[0].lp.cofins)<0.005); }
{ const inp = mk({a1_semst:Array(12).fill(100000)},1200000); inp.compras.semst = Array(12).fill(60000);
  const cen = g.calcCenariosReforma(g.calcular(inp, clone(AD), {...FD}), null);
  chk('A5 · fallback com proxy de créditos', cen.proxyCompras===true && cen.REF.find(l=>l.ano===2033).cred>1000); }

// ═══ 3. SENSIBILIDADE DE PARÂMETROS ═══
console.log('\n■ Parâmetros editados fluem ao cálculo');
{ const inp = mk({a1_semst:Array(12).fill(50000)},600000);
  const b = g.calcular(inp, clone(AD), {...FD});
  let A = clone(AD); A.I.aliq[2] += 0.01;
  chk('alíquota +1pp → DAS +6.000', Math.abs((g.calcular(inp,A,{...FD}).totais.das-b.totais.das)-6000)<1);
  A = clone(AD); A.I.icms = [.30,.30,.30,.30,.30,0];
  const e = g.calcular(inp, A, {...FD});
  chk('parte ICMS editada mantém Σ = DAS', Math.abs(somaDT(e.meses[0])-(e.meses[0].das))<0.01); }
{ const A = clone(AD); A.III.piscof = [.25,.25,.25,.25,.25,.25];
  const r = g.calcular(mk({a3_semret:Array(12).fill(50000)},600000), A, {...FD});
  chk('partes inconsistentes (>100%) ainda fecham', Math.abs(somaDT(r.meses[0])-r.meses[0].das)<0.01); }

// ═══ 4. PARECER (3 variantes) ═══
console.log('\n■ Parecer — variantes');
for (const [esperada, rec, rbt, regime] of [
    ['simples', {a1_semst:Array(12).fill(60000)}, 1200000, 'Simples Nacional'],
    ['acima',   {a1_semst:Array(12).fill(500000)}, 7200000, 'Lucro Real'],
    ['eleg',    {a3_semret:Array(12).fill(150000)}, 1800000, 'Lucro Presumido'] ]) {
  const inp = mk(rec, rbt); inp.compras.semst = Array(12).fill(20000);
  RL.dados = { ano:2025, cnpj:'00000000000000', receitas: inp.receitas };
  RL.res = g.calcular(inp, clone(AD), {...FD}); RL.reforma = null;
  RL.empresa = { razao_social:'TESTE', regime }; RL._ia = null;
  try { const D = g.parecerDados();
    if (D.variante !== esperada) { chk('variante '+esperada, false, '→ '+D.variante); continue; }
    g.rlParecer();
    const out = els['rl-corpo'].innerHTML;
    chk('parecer '+esperada, out.includes('pp-capa') && /Créditos de IBS\/CBS estimados|SEM créditos/.test(out),
        (out.match(/pp-page/g)||[]).length+' páginas');
  } catch(e) { chk('parecer '+esperada, false, e.message); } }

// ═══ 4b. v7.18.0 — TEMA 69 E FGTS ═══
console.log('\n■ v7.18.0 — Tema 69 e FGTS fora dos totais');
{ // LP: monofásico não sofre dupla exclusão — só o destacado das saídas que ficam na base sai
  const r = g.calcular(mk({a1_semst:Array(12).fill(50000), a1_mono:Array(12).fill(50000), a1_mono_pct:Array(12).fill(1)},1200000), clone(AD), {...FD});
  const M = r.meses[0], baseEsp = Math.max(0, 50000 - 50000*.17);   // mono já fora da base; destacado só sobre semst
  chk('Tema 69 · LP sem dupla exclusão do monofásico', Math.abs(M.lp.pis - baseEsp*.0065)<0.01 && Math.abs(M.lp.cofins - baseEsp*.03)<0.01,
      'pis='+M.lp.pis.toFixed(2)+' (base '+baseEsp.toFixed(2)+')'); }
{ // LR: exclusão do ICMS destacado também no não cumulativo
  const r = g.calcular(mk({a1_semst:Array(12).fill(100000)},1200000), clone(AD), {...FD});
  const M = r.meses[0], baseEsp = Math.max(0, 100000 - 100000*.17);
  chk('Tema 69 · LR exclui o ICMS destacado da base', Math.abs(M.lr.pis - baseEsp*.0165)<0.01 && Math.abs(M.lr.cofins - baseEsp*.076)<0.01,
      'pis='+M.lr.pis.toFixed(2)); }
{ // FGTS fora de todos os totais (mas ainda apurado no mês)
  const r = g.calcular(mk({a1_semst:Array(12).fill(100000)},1200000), clone(AD), {...FD});
  const M = r.meses[0];
  const lpSoma = M.lp.pis+M.lp.cofins+M.lp.csll+M.lp.irpj+M.lp.adicional+M.lp.inssPatr+M.lp.icms+M.lp.ipi+M.lp.iss;
  chk('FGTS · fora do total do Simples', M.fgts>1 && Math.abs(M.simples.total - M.das)<0.01, 'fgts do mês='+M.fgts.toFixed(2));
  chk('FGTS · fora dos totais de LP e LR', Math.abs(M.lp.total-lpSoma)<0.005 && Math.abs(M.lr.total-(M.lr.pis+M.lr.cofins+M.lr.csll+M.lr.irpj+M.lr.adicional+M.lr.inssPatr+M.lr.icms+M.lr.ipi+M.lr.iss))<0.005);
  const cen = g.calcCenariosReforma(r, null), L33 = cen.REF.find(l=>l.ano===2033);
  chk('FGTS · fora do cenário híbrido', Math.abs(L33.hib - (L33.dasHib + L33.liquido + L33.is))<0.01); }
{ // ISS retido × sublimite: mesma carga com e sem retenção, sem duplicidade com a trava
  const a = g.calcular(mk({a3_semret:Array(12).fill(350000)},4200000,{folha12Lanc:Array(12).fill(120000)}), clone(AD), {...FD});
  const b = g.calcular(mk({a3_retiss:Array(12).fill(350000)},4200000,{folha12Lanc:Array(12).fill(120000)}), clone(AD), {...FD});
  chk('ISS retido (v7.23.0) · acima do sublimite: total menor pelo retido, sem duplicidade com a trava',
    b.totais.issRetido>1 && Math.abs((a.totais.simples-b.totais.simples)-b.totais.issRetido)<1,
    'Δ='+(a.totais.simples-b.totais.simples).toFixed(2)+' · retido='+b.totais.issRetido.toFixed(2)); }

// ═══ 5. REGRESSÃO DOS GABARITOS ═══
console.log('\n■ Regressão contra os gabaritos da planilha v15');
const FIX = path.join(__dirname, 'fixtures');
const pega = (o,p) => p.split('.').reduce((a,k)=>a?.[k], o);
let TOTG = 0, OKG = 0, DIVERG = [];
for (const i of [1,2]) {
  const arq = path.join(FIX, `caso${i}.json`);
  if (!fs.existsSync(arq)) { console.log('  (fixtures/caso'+i+'.json ausente — regressão pulada)'); continue; }
  const { inp, gab } = JSON.parse(fs.readFileSync(arq, 'utf8'));
  const r = g.calcular(inp, clone(AD), {...FD});
  for (const [nome, vals] of Object.entries(gab)) for (let m=0; m<13; m++) {
    const esperado = vals[m];
    let obtido = m<12
      ? (nome==='das' ? r.meses[m].das : nome==='fgts' ? r.meses[m].fgts : (pega(r.meses[m], nome)||0))
      : (['das','fgts'].includes(nome) ? r.totais[nome] : nome==='simples.total' ? r.totais.simples
         : r.meses.reduce((s,M)=>s+(pega(M,nome)||0),0));
    obtido = obtido||0; TOTG++;
    if (Math.abs(obtido-esperado) <= 0.015) { OKG++; continue; }
    // divergência DOCUMENTADA: a planilha não soma a trava do sublimite no total do Simples
    if (nome==='simples.total') { const sub = m<12 ? (r.meses[m].subIcms+r.meses[m].subIss) : r.totais.sublimite;
      if (Math.abs((obtido-sub)-esperado) <= 0.015) { OKG++; continue; } }
    DIVERG.push(`caso${i} ${nome} m${m<12?m+1:'TOT'}: esperado ${esperado.toFixed(2)} obtido ${obtido.toFixed(2)}`);
  }
}
chk(`gabaritos: ${OKG}/${TOTG} (trava do sublimite documentada)`, TOTG>0 && DIVERG.length===0,
    DIVERG.slice(0,5).join(' | '));

// ═══ 5b. Alíquotas de referência da Reforma (Res. CGIBS nº 14/2026) ═══
console.log('\n■ Alíquotas de referência da Reforma');
{
  const A = vm.runInContext('RF_ALIQ_DEFAULT', ctx);
  const s33 = A[2033].cbs + A[2033].ibse + A[2033].ibsm;
  chk('2033 fecha na referência conjunta de 27,91%', Math.abs(s33 - 27.91) < 0.005, `Σ = ${s33.toFixed(2)}%`);
  const ibs33 = A[2033].ibse + A[2033].ibsm;
  chk('IBS pleno = 18,7% e escada 2029-2032 = 10/20/30/40%',
    Math.abs(ibs33 - 18.70) < 0.02 &&
    [2029,2030,2031,2032].every((a,i) => Math.abs((A[a].ibse + A[a].ibsm) - ibs33*(i+1)/10) < 0.03),
    `IBS 2033 = ${ibs33.toFixed(2)}%`);
  chk('IBS de 2027-2028 mantido em 0,10% (ADCT art. 127)',
    [2027,2028].every(a => Math.abs((A[a].ibse + A[a].ibsm) - 0.10) < 0.001));
}

// ═══ 5c. Alíquotas seguem os Parâmetros; registro antigo da Reforma é completado ═══
console.log('\n■ Reforma: padrão vigente e registro antigo');
{
  // análise salva com a tabela ANTIGA (8,8 / 16 / 2) não pode congelar o cálculo
  const antiga = { 2033:{ cbs:8.8, ibse:16, ibsm:2, is:0, remIcmsIss:0, remPisCof:0 } };
  const inp = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','caso1.json'),'utf8')).inp;
  const usada = vm.runInContext(`(()=>{ const res = calcular(${JSON.stringify(inp)}, PARAMS.anexos, folhaPercDaEmpresa(${JSON.stringify(inp)}.cfg));
    const r = calcCenariosReforma(res, { receita:100000, aliq:${JSON.stringify(antiga)} });
    return r.rfx.aliq[2033]; })()`, ctx);
  const padrao = vm.runInContext('PARAMS.reforma ? PARAMS.reforma[2033] : RF_ALIQ_DEFAULT[2033]', ctx);
  chk('alíquotas vêm dos Parâmetros, não da cópia salva na análise',
    Math.abs(usada.cbs - padrao.cbs) < 1e-9 && Math.abs(usada.ibse - padrao.ibse) < 1e-9,
    `usada CBS ${usada.cbs}% × padrão ${padrao.cbs}%`);

  // registro gravado por versão anterior (sem benefRec/benefCred/contra) não pode quebrar a tela
  const norm = vm.runInContext(`rfNormalizar({ receita: 50000 }, '123', 2026)`, ctx);
  chk('registro antigo da Reforma é completado (rfNormalizar)',
    norm && norm.benefRec && norm.benefCred && norm.contra && norm.aliq
      && Object.values(norm.benefRec).every(v => v === 0) && norm.receita === 50000);
}

// ═══ 5d. Res. CGSN nº 190/2026 — partilha do DAS por vigência ═══
console.log('\n■ Res. CGSN nº 190/2026 — partilha por vigência');
{
  const R190 = vm.runInContext('REP190', ctx);
  const REM = vm.runInContext('REM190', ctx);
  // 5d.1 integridade: toda faixa soma 100% (±0,011) em 5 anexos × 6 vigências
  let soma = true, pior = 0;
  for (const v of Object.keys(R190)) for (const ax of Object.keys(R190[v])) for (let f=0; f<6; f++) {
    const s = Object.values(R190[v][ax]).reduce((a,arr)=>a+(arr[f]||0),0);
    if (Math.abs(s-1) > 0.00011) { soma = false; pior = Math.max(pior, Math.abs(s-1)); }
  }
  chk('REP190: toda faixa soma 100% (5 anexos × 6 vigências)', soma, pior? 'Δmax '+pior : '');
  // 5d.2 identidade com a LC 123 (faixas 1–5): CBS+IBS = PIS/COFINS + ICMS/ISS×(1−rem); ICMS/ISS = atual×rem
  let ident = true, idet = '';
  for (const v of [2027,2029,2030,2031,2032,2033]) for (const ax of Object.keys(RT)) for (let f=0; f<5; f++) {
    const P = R190[v][ax], rem = REM[v];
    const pc = RT[ax].pis[f]+RT[ax].cofins[f], ii = (RT[ax].icms||RT[ax].iss)[f];
    const cbsibs = (P.cbs[f]||0) + ((P.ibs||[])[f]||0);
    const iiV = ((P.icms||P.iss)||[])[f]||0;
    if (Math.abs(cbsibs - (pc + ii*(1-rem))) > 0.00011 || Math.abs(iiV - ii*rem) > 0.00011) { ident = false; idet = `${ax}/${v}/f${f+1}`; }
  }
  chk('REP190 ≡ REP_TRIB com PIS/COFINS→CBS e ICMS/ISS→IBS pelos degraus (F1–F5)', ident, idet);
  // 5d.3 resolvedora
  chk('repTribAno: ≤2026 → REP_TRIB · 2028 → tabela 2027 · 2034 → 2033',
    vm.runInContext('repTribAno(2026)===REP_TRIB && repTribAno(2028)===REP190[2027] && repTribAno(2034)===REP190[2033]', ctx));
  // 5d.4 híbrido = art. 22-A (Anexo I puro, sem sublimite: identidades fechadas)
  const inpA = mk({a1_semst:Array(12).fill(100000)},1200000);
  const rA = g.calcular(inpA, clone(AD), {...FD});
  const CA = g.calcCenariosReforma(rA, null), TA = rA.totais;
  const lde = ano => CA.REF.find(l=>l.ano===ano);
  chk('art. 22-A · 2033: dedução integral (CBS+IBS = todo o consumo do DAS)',
    Math.abs(lde(2033).dasHib - (TA.das - TA.dasPisCof - TA.dasIcmsIss)) < 0.02,
    'DAS_hib33='+lde(2033).dasHib.toFixed(2));
  chk('art. 22-A · 2029: dedução = CBS + 10% do ICMS/ISS migrado ao IBS',
    Math.abs(lde(2029).dasHib - (TA.das - TA.dasPisCof - TA.dasIcmsIss*0.1)) < 0.02);
  const P27 = lde(2027).p190;
  chk('art. 22-A · 2027: IBS simbólico presente e dedução = CBS+IBS da partilha',
    P27 && P27.ibs > 0 && Math.abs(lde(2027).dasHib - (TA.das - P27.cbs - P27.ibs)) < 0.005,
    'IBS27='+(P27?P27.ibs.toFixed(2):'—'));
  chk('≤2026: híbrido inalterado (tudo dentro do DAS)',
    Math.abs(lde(2026).dasHib - (TA.das + (TA.sublimite||0))) < 0.02);
  // 5d.5 trava por vigência (Anexo III acima do sublimite, teto do ISS mordendo)
  const inpS = mk({a3_semret:Array(12).fill(340000)},4080000,{folha12Lanc:Array(12).fill(120000)});
  const rS = g.calcular(inpS, clone(AD), {...FD});
  const CS = g.calcCenariosReforma(rS, null), TS = rS.totais;
  const ps = ano => CS.REF.find(l=>l.ano===ano).p190;
  chk('trava · 2027-28 = trava atual (rem 100%, teto 5%)',
    Math.abs(ps(2027).trava - (TS.sublimite||0)) < 0.02, 'trava='+ps(2027).trava.toFixed(2));
  // manual 2029: ISS por mês = base×min(rawP×0,9; 4,5%) + IBS = base×rawP×0,1 (sem teto)
  let esp29 = 0;
  for (const M of rS.meses) for (const [ax,b,praw] of ((M.trv190&&M.trv190.iss)||[]))
    esp29 += b*Math.min(praw*0.9, 0.045) + b*praw*0.1;
  chk('trava · 2029 = ISS×90% com teto 4,5% + IBS 10% sem teto (fórmula manual)',
    Math.abs(ps(2029).trava - esp29) < 0.02, 'Δ='+(ps(2029).trava-esp29).toFixed(4));
  chk('trava · teto mordendo: total 2029 > total 2027 (IBS sem teto compensa além do corte do ISS)',
    ps(2029).trava > ps(2027).trava + 0.01);
  chk('trava · 2033: ISS zera e o IBS assume integralmente, sem teto',
    ps(2033).icmsIssTrava < 0.01 && Math.abs(ps(2033).ibsTrava - rS.meses.reduce((s,M)=>s+((M.trv190&&M.trv190.iss)||[]).reduce((a,[,b,p])=>a+b*p,0),0)) < 0.02);
  // 5d.6 quadro tributo a tributo renderiza com a abertura ↳ e sem exceção nos 3 cenários
  RL.dados = { ano:2025, cnpj:'00000000000000', receitas: inpA.receitas };
  RL.res = rA; RL.reforma = null; RL.empresa = { razao_social:'TESTE', regime:'Simples Nacional' }; RL._ia = null;
  let okQ = true, temAb = false, det = '';
  for (const cenq of ['dentro','hibrido','fora']) {
    const out = vm.runInContext(`rlRfTribHtml('${cenq}')`, ctx);
    if (!out || out.includes('Não foi possível')) { okQ = false; det = cenq; }
    if (cenq==='dentro' && out.includes('↳ CBS dentro do DAS') && out.includes('↳ IBS dentro do DAS')) temAb = true;
  }
  chk('quadro tributo a tributo renderiza nos 3 cenários, com abertura ↳ no "dentro"', okQ && temAb, det);
  // 5d.7 gabaritos de cenário 2033 (caso1): híbrido e fora INALTERADOS; dentro recomposto = trava (comércio → invariante)
  const fx1 = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','caso1.json'),'utf8')).inp;
  const rG = g.calcular(fx1, clone(AD), {...FD});
  const CG = g.calcCenariosReforma(rG, null);
  const G33 = CG.REF[CG.REF.length-1];
  // v7.18.0: gabaritos recalibrados SEM o FGTS (16.794,50/ano neste caso) — antes: hib 775.348,96 · fora 719.178,18.
  // O caso é de serviços (sem ICMS), então o Tema 69 não altera estes números; a diferença é só o FGTS.
  chk('gabarito de cenários 2033 preservado (v7.18.0, sem FGTS): híbrido 758.554,46 · fora 702.383,68',
    Math.abs(G33.hib - 758554.46) < 0.02 && Math.abs(G33.regular - 702383.68) < 0.02,
    `hib=${G33.hib.toFixed(2)} reg=${G33.regular.toFixed(2)}`);
  chk('gabarito · trava do caso1 (comércio) invariante por vigência: ICMS×rem + IBS×(1−rem)',
    G33.p190 && Math.abs(G33.p190.trava - (rG.totais.sublimite||0)) < 0.02,
    'trava33='+(G33.p190?G33.p190.trava.toFixed(2):'—'));
}

// ═══ 5f. v7.18.3 — Lei 14.592/2023 e importadores substituem (não somam) ═══
console.log('\n■ v7.18.3 — ICMS das compras fora do crédito de PIS/COFINS · importadores idempotentes');
{ // Lei 14.592/2023: compras reduzem a base do LR LÍQUIDAS do ICMS
  const compras = { semst: Array(12).fill(100000) };
  const a = g.calcular(Object.assign(mk({a1_semst:Array(12).fill(300000)},3600000,{icmsC:.12}), {compras: Object.assign(Object.fromEntries(['semst','baixaSemst','mono','baixaMono','comst','baixaComst','comstMono','baixaComstMono','baseIpiCred'].map(k=>[k,z()])), compras)}), clone(AD), {...FD});
  const b = g.calcular(Object.assign(mk({a1_semst:Array(12).fill(300000)},3600000,{icmsC:0}),   {compras: Object.assign(Object.fromEntries(['semst','baixaSemst','mono','baixaMono','comst','baixaComst','comstMono','baixaComstMono','baseIpiCred'].map(k=>[k,z()])), compras)}), clone(AD), {...FD});
  const M0a=a.meses[0], M0b=b.meses[0];
  chk('Lei 14.592: base PIS/COFINS do LR sobe 100.000×12% com ICMS de compras de 12%',
    Math.abs((M0a.lr.basePCbruta - M0b.lr.basePCbruta) - 12000) < 0.01,
    `Δbase=${(M0a.lr.basePCbruta-M0b.lr.basePCbruta).toFixed(2)}`);
  chk('Lei 14.592: PIS +1,65% e COFINS +7,60% sobre o ICMS excluído do crédito',
    Math.abs((M0a.lr.pis-M0b.lr.pis) - 12000*.0165) < 0.01 && Math.abs((M0a.lr.cofins-M0b.lr.cofins) - 12000*.076) < 0.01,
    `ΔPIS=${(M0a.lr.pis-M0b.lr.pis).toFixed(2)} ΔCOFINS=${(M0a.lr.cofins-M0b.lr.cofins).toFixed(2)}`);
  chk('Lei 14.592: icmsComprasPC gravado no mês p/ a conferência', Math.abs((M0a.icmsComprasPC||0)-12000)<0.01 && Math.abs(M0b.icmsComprasPC||0)<0.01);
  chk('Lei 14.592: PIS/COFINS do LP não são afetados (cumulativo não credita compras)',
    Math.abs((M0a.lp.pis+M0a.lp.cofins) - (M0b.lp.pis+M0b.lp.cofins)) < 0.01);
}
{ // balAplicar substitui os meses cobertos (bug da duplicação: 63.732,84 + 15.933,21 = 79.666,05)
  const res = (async () => {
    vm.runInContext('dlg = async()=>true', ctx);   // dlgSimNao resolve "sim" sem UI
    vm.runInContext('garantirEmpresa = async()=>{}', ctx);   // sem Supabase no sandbox
    vm.runInContext('AN = anNovo("24197146000137", 2025)', ctx);
    vm.runInContext('AN.compras.semst[0] = 63732.84', ctx);          // resíduo gravado
    vm.runInContext('BAL = {cnpj:"24197146000137", nome:"TESTE", ano:2025, mesIni:0, mesFim:0, contas:[{destino:"compras.semst", valor:15933.21}]}', ctx);
    ctx.document.getElementById('bal-modo').value = 'rateio';
    ctx.document.getElementById('an-ano').value = '2025';
    try { await vm.runInContext('balAplicar()', ctx); } catch(e){}
    const v1 = vm.runInContext('AN.compras.semst[0]', ctx);
    try { await vm.runInContext('balAplicar()', ctx); } catch(e){}
    const v2 = vm.runInContext('AN.compras.semst[0]', ctx);
    return {v1, v2};
  })();
  var RES_BAL = res;
}
{ // _xmlAplicarBase não duplica ao reimportar o mesmo lote
  const res = (async () => {
    await RES_BAL;                                  // serializa: o contexto (AN) é compartilhado
    vm.runInContext('AN = anNovo("24197146000137", 2025)', ctx);
    vm.runInContext('XN = {notas:[{incluir:true, valor:1000, mes:0, ano:2025, tipo:"NF-e", tomador:"1", ct:"000001"},{incluir:true, valor:500, mes:0, ano:2025, tipo:"NF-e", tomador:"1", ct:"000001"}]}', ctx);
    ctx.document.getElementById('xml-bloco').value = 'a1_semst';
    ctx.document.getElementById('xml-grade').checked = true;
    ctx.document.getElementById('xml-iss').checked = false;
    try { await vm.runInContext('_xmlAplicarBase()', ctx); } catch(e){}
    const v1 = vm.runInContext('AN.receitas.a1_semst[0]', ctx);
    try { await vm.runInContext('_xmlAplicarBase()', ctx); } catch(e){}
    const v2 = vm.runInContext('AN.receitas.a1_semst[0]', ctx);
    return {v1, v2};
  })();
  var RES_XML = res;
}

// ═══ 5g. v7.19.0 — balancete multi-arquivo, mês próprio e prévia ═══
console.log('\n■ v7.19.0 — balancete multi-arquivo, mês próprio e prévia');
{
  const RES = (async () => {
    await RES_XML;                                  // serializa: o contexto (AN) é compartilhado
    vm.runInContext('garantirEmpresa = async()=>{}; dlg = async()=>true;', ctx);
    vm.runInContext('AN = anNovo("24197146000137", 2025)', ctx);
    vm.runInContext(`BAL = {cnpj:"24197146000137", nome:"T", ano:2025, mesIni:0, mesFim:1, lotes:[
      {arquivo:"01-2025.xls", ano:2025, mesIni:0, mesFim:0, contas:[{destino:"compras.semst", valor:15933.21},{destino:"folha.salarios", valor:10000}]},
      {arquivo:"02-2025.xls", ano:2025, mesIni:1, mesFim:1, contas:[{destino:"compras.semst", valor:20000}]}]}`, ctx);
    ctx.document.getElementById('bal-modo').value = 'proprio';
    ctx.document.getElementById('an-ano').value = '2025';
    // matriz: mês próprio de cada lote
    const M = vm.runInContext('balMatriz("proprio")', ctx);
    // prévia gera HTML sem exceção
    let previaOK = true;
    try { vm.runInContext('balPrevia()', ctx); } catch(e){ previaOK = false; }
    const previaHTML = ctx.document.getElementById('bal-previa').innerHTML;
    try { await vm.runInContext('balAplicar()', ctx); } catch(e){}
    const jan = vm.runInContext('AN.compras.semst[0]', ctx), fev = vm.runInContext('AN.compras.semst[1]', ctx),
          sal = vm.runInContext('AN.folha.salarios[0]', ctx);
    try { await vm.runInContext('balAplicar()', ctx); } catch(e){}
    const jan2 = vm.runInContext('AN.compras.semst[0]', ctx), fev2 = vm.runInContext('AN.compras.semst[1]', ctx);
    // modo distribuir com lote anual: 1/12 por mês
    const Md = vm.runInContext('balMatriz.call(null, "distribuir")', ctx);
    vm.runInContext('BAL = {cnpj:"1", nome:"T", ano:2025, mesIni:0, mesFim:11, lotes:[{arquivo:"anual.xls", ano:2025, mesIni:0, mesFim:11, contas:[{destino:"despesas.adm", valor:1200}]}]}', ctx);
    const Ma = vm.runInContext('balMatriz("distribuir")', ctx);
    return {M, previaOK, previaHTML, jan, fev, sal, jan2, fev2, Ma};
  })();
  var RES_BAL2 = RES;
}

// ═══ 5h. v7.20.0 — parecer c/ fornecedores, conferência da Reforma, relatório CNPJ ═══
console.log('\n■ v7.20.0 — dashboard de fornecedores, conferência da Reforma e relatório CNPJ');
{
  // parecer ganha a página de fornecedores quando RL.forn existe
  const inp = mk({a1_semst:Array(12).fill(60000)},1200000); inp.compras.semst = Array(12).fill(20000);
  vm.runInContext('RL.dados = '+JSON.stringify({ano:2025,cnpj:'00000000000000',receitas:inp.receitas}), ctx);
  ctx.__res = g.calcular(inp, clone(AD), {...FD});
  vm.runInContext('RL.res = __res; RL.reforma = null; RL.empresa = {razao_social:"TESTE", regime:"Simples Nacional"}; RL._ia = null;', ctx);
  vm.runInContext(`RL.forn = { revenda: { consultado_em: new Date().toISOString(), dados: { tipo:'revenda', periodo:'01/2025 a 12/2025', stats:{},
    itens: [ {cnpj:'11111111000191', razao:'FORN NORMAL LTDA', classe:'normal', valor:600000},
             {cnpj:'22222222000191', razao:'FORN SIMPLES ME', classe:'simples', valor:300000},
             {cnpj:'33333333000191', razao:'FORN MEI', classe:'mei', valor:100000} ] } } };`, ctx);
  try { g.rlParecer(); const out = els['rl-corpo'].innerHTML;
    chk('parecer · página "Fornecedores e o crédito de IBS/CBS" renderiza com os números',
      out.includes('Fornecedores e o crédito de IBS/CBS') && out.includes('FORN NORMAL LTDA') && /60,0%/.test(out.replace(/\u00a0/g,' ')),
      (out.match(/pp-page/g)||[]).length+' páginas');
  } catch(e){ chk('parecer · página de fornecedores', false, e.message); }
  // sem consulta salva, a página NÃO aparece
  vm.runInContext('RL.forn = null', ctx);
  try { g.rlParecer(); const out2 = els['rl-corpo'].innerHTML;
    chk('parecer · sem consulta de fornecedores, a página não aparece', !out2.includes('Fornecedores e o crédito de IBS/CBS'));
  } catch(e){ chk('parecer · sem fornecedores', false, e.message); }
  // conferência da Reforma ano a ano
  try { const h = vm.runInContext('rlConfReforma()', ctx);
    chk('conferência · bloco Reforma ano a ano com 2026–2033 e art. 22-A',
      /2026/.test(h) && /2033/.test(h) && /22-A/.test(h) && /Débito IBS\/CBS/.test(h));
  } catch(e){ chk('conferência Reforma', false, e.message); }
  // relatório de CNPJ: fetch mockado devolve um cadastro mínimo e o render monta as seções
  var RES_CNPJ = (async () => {
    const fetchOrig = ctx.fetch;
    ctx.fetch = async url => ({ ok:true, json: async () => ({ razao_social:'EMPRESA TESTE LTDA', nome_fantasia:'TESTE',
      descricao_situacao_cadastral:'ATIVA', data_situacao_cadastral:'2020-01-01', data_inicio_atividade:'2019-05-10',
      natureza_juridica:'206-2 - Sociedade Empresária Limitada', porte:'ME', capital_social: 10000,
      opcao_pelo_simples:true, data_opcao_pelo_simples:'2019-05-10', opcao_pelo_mei:false,
      cnae_fiscal:'6201501', cnae_fiscal_descricao:'Desenvolvimento de programas', cnaes_secundarios:[{codigo:'6202300',descricao:'Desenvolvimento e licenciamento'}],
      logradouro:'RUA X', numero:'1', bairro:'CENTRO', municipio:'PALHOCA', uf:'SC', cep:'88130000',
      qsa:[{nome_socio:'FULANO DE TAL', qualificacao_socio:'Sócio-Administrador', data_entrada_sociedade:'2019-05-10'}] }) });
    try { await vm.runInContext('rlCnpjRender("24197146000137")', ctx); } catch(e){}
    ctx.fetch = fetchOrig;
    return els['rl-corpo'].innerHTML;
  })();
}

// ═══ 5i. v7.21.0 — produtos × IBS/CBS fora do parecer e em relatório próprio; fornecedores no CNPJ ═══
console.log('\n■ v7.21.0 — relatório de produtos × IBS/CBS e fornecedores completos no CNPJ');
{
  // o parecer NÃO traz mais a seção de produtos
  try { g.rlParecer(); const out = els['rl-corpo'].innerHTML;
    chk('parecer · seção "Produtos vendidos" e o container pp-notas foram removidos',
      !out.includes('Produtos vendidos no período') && !out.includes('pp-notas') && out.includes('pp-assin'));
  } catch(e){ chk('parecer sem produtos', false, e.message); }
  // relatório novo: caminho sem notas gravadas (supabase vazio) renderiza a orientação
  var RES_PROD = (async () => {
    try { await vm.runInContext('rlProdRender("24197146000137",2025,"EMPRESA TESTE")', ctx); } catch(e){ return 'EXC:'+e.message; }
    return els['rl-corpo'].innerHTML;
  })();
  // v7.22.0: documento "Resumo Estatístico de Fornecedores" no layout do parecer, com paginação
  var RES_FORNCNPJ = (async () => {
    await RES_PROD;                                 // serializa (fetch/els compartilhados)
    vm.runInContext(`RL.forn = { revenda: { consultado_em: new Date().toISOString(), dados: { tipo:'revenda', periodo:'2025', stats:{},
      itens: [ {cnpj:'11111111000191', razao:'FORN NORMAL LTDA', classe:'normal', valor:600000},
               {cnpj:'22222222000191', razao:'FORN SIMPLES ME', classe:'simples', valor:300000},
               {cnpj:'33333333000191', razao:'FORN MEI', classe:'mei', valor:100000},
               ...Array.from({length:57},(_,k)=>({cnpj:'4444444400019'+ (k%10), razao:'FORN '+k, classe:'normal', valor:1000+k})) ] } } };`, ctx);
    const fetchOrig = ctx.fetch;
    ctx.fetch = async url => ({ ok:true, json: async () => ({ razao_social:'EMPRESA TESTE LTDA', nome_fantasia:'TESTE',
      descricao_situacao_cadastral:'ATIVA', data_situacao_cadastral:'2020-01-01', data_inicio_atividade:'2019-05-10',
      natureza_juridica:'206-2 - Sociedade Empresária Limitada', porte:'ME', capital_social: 10000,
      opcao_pelo_simples:true, data_opcao_pelo_simples:'2019-05-10', opcao_pelo_mei:false,
      cnae_fiscal:'6201501', cnae_fiscal_descricao:'Desenvolvimento de programas', cnaes_secundarios:[{codigo:'6202300',descricao:'Dev'}],
      logradouro:'RUA X', numero:'1', bairro:'CENTRO', municipio:'PALHOCA', uf:'SC', cep:'88130000',
      qsa:[{nome_socio:'FULANO DE TAL', qualificacao_socio:'Sócio-Administrador', data_entrada_sociedade:'2019-05-10'}] }) });
    try { await vm.runInContext('rlCnpjRender("24197146000137")', ctx); } catch(e){ ctx.fetch=fetchOrig; return 'EXC:'+e.message; }
    ctx.fetch = fetchOrig;
    return els['rl-corpo'].innerHTML;
  })();
}

// ═══ 5j. v7.23.0 — ISS retido fora dos totais · consistência parecer×conferência · senha ═══
console.log('\n■ v7.23.0 — ISS retido fora dos totais e fontes unificadas');
{ // simetria: ISS do LP/LR também exclui as receitas com retenção
  const a = g.calcular(mk({a3_semret:Array(12).fill(50000)},600000,{iss:.05}), clone(AD), {...FD});
  const b = g.calcular(mk({a3_retiss:Array(12).fill(50000)},600000,{iss:.05}), clone(AD), {...FD});
  chk('v7.23.0 · LP/LR: ISS próprio exclui receitas com retenção (guia menor em 50.000×5%)',
    Math.abs((a.meses[0].iss - b.meses[0].iss) - 2500) < 0.01,
    'Δiss='+(a.meses[0].iss-b.meses[0].iss).toFixed(2));
  // híbrido sem a recomposição: hib = dasHib + cppRetida + cppForaDAS + liquido + IS (sem issRetido)
  const cb = g.calcCenariosReforma(b, null);
  const L33b = cb.REF.find(l=>l.ano===2033);
  chk('v7.23.0 · híbrido sem o termo do ISS retido (identidade das parcelas em 2033)',
    Math.abs(L33b.hib - (L33b.dasHib + (b.totais.cppRetida||0) + (b.totais.cppForaDAS||0) + L33b.liquido + L33b.is)) < 0.01);
}
{ // consistência: parecer, veredito e conferência usam a MESMA fórmula do "por dentro" (cenDentro)
  const inp = mk({a1_semst:Array(12).fill(60000)},1200000);
  ctx.__res2 = g.calcular(inp, clone(AD), {...FD});
  vm.runInContext('RL.dados = {ano:2025,cnpj:"00000000000000",receitas:'+JSON.stringify(inp.receitas)+'}; RL.res = __res2; RL.reforma = null; RL.empresa = {razao_social:"T", regime:"Simples Nacional"}; RL._ia = null; RL.forn = null;', ctx);
  try {
    const D = vm.runInContext('parecerDados()', ctx);
    const dManual = vm.runInContext('cenDentro(RL.res.totais, parecerDados().L33)', ctx);
    chk('v7.23.0 · parecer usa cenDentro: sDentro(2033) === fórmula única',
      Math.abs(D.sDentro[D.sDentro.length-1] - dManual) < 0.01,
      'parecer='+D.sDentro[D.sDentro.length-1].toFixed(2));
    const confH = vm.runInContext('rlConfReforma()', ctx);
    chk('v7.23.0 · conferência exibe a coluna "Por dentro" com o MESMO valor do parecer',
      confH.includes('Por dentro') && confH.includes(vm.runInContext('fmtR(cenDentro(RL.res.totais, parecerDados().REF[parecerDados().REF.length-1]))', ctx)));
  } catch(e){ chk('v7.23.0 · consistência parecer×conferência', false, e.message); }
}
{ // troca de senha: valida atual, exige 8+, confirma, grava via PUT /auth/v1/user
  var RES_SENHA = (async () => {
    await RES_FORNCNPJ;                                    // serializa (fetch compartilhado)
    vm.runInContext('APP.user = {email:"teste@artecon.com.br"}', ctx);
    const doc = ctx.document;
    doc.getElementById('us-sn-atual').value='senha-antiga'; doc.getElementById('us-sn-nova').value='curta';
    doc.getElementById('us-sn-conf').value='curta';
    const chamadas = [];
    const fetchOrig = ctx.fetch;
    ctx.fetch = async (url, opt) => { chamadas.push({url:String(url), method:opt&&opt.method, body:opt&&opt.body});
      return { ok:true, json: async()=>({ access_token:'tok-novo', expires_at: Math.floor(Date.now()/1000)+3600, user:{email:'teste@artecon.com.br'} }) }; };
    await vm.runInContext('usAlterarMinhaSenha()', ctx);   // nova curta → deve barrar SEM chamar a rede
    const bloqueiaCurta = !chamadas.some(c=>/\/auth\//.test(c.url));
    doc.getElementById('us-sn-nova').value='senha-nova-segura'; doc.getElementById('us-sn-conf').value='diferente';
    await vm.runInContext('usAlterarMinhaSenha()', ctx);   // confirmação divergente → barra
    const bloqueiaConf = !chamadas.some(c=>/\/auth\//.test(c.url));
    doc.getElementById('us-sn-conf').value='senha-nova-segura';
    await vm.runInContext('usAlterarMinhaSenha()', ctx);   // agora: revalida + PUT
    ctx.fetch = fetchOrig;
    // rotinas async de blocos anteriores ainda resolvem no mesmo fetch — só as chamadas de auth interessam
    const auth = chamadas.filter(c=>/\/auth\//.test(c.url));
    return { bloqueiaCurta, bloqueiaConf, chamadas: auth };
  })();
}

// ═══ 5k. v7.24.0 — exportação fora da base do IBS/CBS ═══
console.log('\n■ v7.24.0 — exportação imune ao IBS/CBS (LC 214, art. 8º)');
{
  const inpE = mk({a1_semst:Array(12).fill(50000)},1200000);
  inpE.receitas.a1_exp = Array(12).fill(30000);            // 360.000 de exportação no ano
  const rE = g.calcular(inpE, clone(AD), {...FD});
  chk('v7.24.0 · motor expõe T.receitaExp separada (360.000) e T.receita segue total (960.000)',
    Math.abs(rE.totais.receitaExp-360000)<0.01 && Math.abs(rE.totais.receita-960000)<0.01,
    `exp=${rE.totais.receitaExp.toFixed(2)} tot=${rE.totais.receita.toFixed(2)}`);
  const CE = g.calcCenariosReforma(rE, null);              // fallback: aba Reforma vazia
  chk('v7.24.0 · fallback da Reforma usa a receita INTERNA (600.000, não 960.000)',
    Math.abs(CE.rfx.receita-600000)<0.01, `rfx.receita=${CE.rfx.receita.toFixed(2)}`);
  const L33E = CE.REF.find(l=>l.ano===2033);
  chk('v7.24.0 · débito de IBS/CBS 2033 = alíquota × receita interna apenas',
    Math.abs(L33E.deb - 600000*L33E.alq) < 0.01, `deb=${L33E.deb.toFixed(2)} alq=${(L33E.alq*100).toFixed(2)}%`);
  const rS = g.calcular(mk({a1_semst:Array(12).fill(50000)},1200000), clone(AD), {...FD});
  const CS = g.calcCenariosReforma(rS, null);
  chk('v7.24.0 · sem exportação, nada muda (receita da Reforma = 600.000 nos dois casos)',
    Math.abs(CS.rfx.receita-600000)<0.01 && Math.abs((rS.totais.receitaExp||0))<0.01);
}

// ═══ 5l. v7.25.0 — triagens de venda/compra e senha em 2 opções ═══
console.log('\n■ v7.25.0 — triagem de venda/compra (analíticos) e redefinição em 2 opções');
{
  // parser + stats com dados no formato real dos arquivos da Weeedo
  vm.runInContext('EMP_GLOBAL = {cnpj:"24197146000137", razao_social:"WEEEDO"}', ctx);
  const rowsV = [['Data Emissão','Natureza','Empresa','Valor Contábil','CNPJ/CPF/CNO'],
    ['15/01/2025','5102002','356',53000,'02.307.029/0001-46'],
    ['22/01/2025','6502002','356',20000,'01.864.215/0008-90'],        // exportação (fim específico)
    ['14/01/2025','5102002','356',10000,'597.333.142-34'],            // CPF consumidor
    ['23/01/2025','9000008','356',17000,'29.897.180/0001-38']];
  ctx.__rowsV = rowsV;
  const TV = vm.runInContext('triParse(__rowsV, "venda")', ctx);
  chk('v7.25.0 · triagem de venda: consolida 4 parceiros, período e CPF=consumidor',
    TV && TV.itens.length===4 && TV.periodo==='14/01/2025 a 23/01/2025' && TV.itens.some(i=>i.classe==='pf'),
    TV?`${TV.itens.length} parceiros · ${TV.periodo}`:'parse falhou');
  ctx.__TV = TV;
  const SV = vm.runInContext('TRI.venda = __TV; triStats(TRI.venda)', ctx);
  chk('v7.25.0 · stats da venda: total 100.000, B2B 90.000, B2C 10.000, exportação 20.000',
    Math.abs(SV.tot-100000)<0.01 && Math.abs(SV.pj-90000)<0.01 && Math.abs(SV.pf-10000)<0.01 && Math.abs(SV.exp-20000)<0.01,
    `tot=${SV.tot} pj=${SV.pj} exp=${SV.exp}`);
  // compra com movimentação própria (CNPJ da própria Weeedo sai do ranking/total)
  const rowsC = [['Data Entrada','Natureza','Empresa','Valor Contábil','Razão Social','CNPJ/CPF/CNO'],
    ['02/01/2025','1102001','356',50000,'FORN A LTDA','11.111.111/0001-91'],
    ['02/01/2025','1949015','356',999,'WEEEDO GER','24.197.146/0001-37'],
    ['03/01/2025','2102001','356',30000,'FORN B ME','22.222.222/0001-91']];
  ctx.__rowsC = rowsC;
  const TC = vm.runInContext('TRI.compra = triParse(__rowsC, "compra"); TRI.compra', ctx);
  const SC = vm.runInContext('triStats(TRI.compra)', ctx);
  chk('v7.25.0 · triagem de compra: própria empresa separada (total externo 80.000, próprio 999)',
    TC && TC.itens.some(i=>i.classe==='proprio') && Math.abs(SC.tot-80000)<0.01 && Math.abs(SC.proprio-999)<0.01,
    `tot=${SC.tot} proprio=${SC.proprio}`);
  // dashboards renderizam
  try { vm.runInContext('triDash("venda"); triDash("compra")', ctx);
    const hv = els['tri-dash-venda'].innerHTML, hc = els['tri-dash-compra'].innerHTML;
    chk('v7.25.0 · dashboards renderizam (B2B/B2C na venda, exportação destacada, ranking na compra)',
      /B2B/.test(hv) && /exportação/.test(hv) && /FORN A LTDA/.test(hc));
  } catch(e){ chk('v7.25.0 · dashboards', false, e.message); }
  // página do parecer: perfil da clientela quando RL.forn.venda existe
  try {
    vm.runInContext(`RL.forn = { venda: { consultado_em:new Date().toISOString(), dados:{ tipo:'venda', periodo:'01/2025',
      stats:{tot:100000,pj:90000,pf:10000,exp:20000,proprio:0},
      itens: __TV.itens.map(i=>({cnpj:i.cnpj,razao:i.razao,classe:i.classe||'normal',valor:i.valor})) } } };`, ctx);
    g.rlParecer();
    const out = els['rl-corpo'].innerHTML;
    chk('v7.25.0 · parecer ganha "Perfil da clientela" com B2B×B2C quando há triagem de venda',
      out.includes('Perfil da clientela') && /90,0%/.test(out));
    vm.runInContext('RL.forn = null', ctx);
    g.rlParecer();
    chk('v7.25.0 · sem triagem, o parecer não ganha a página', !els['rl-corpo'].innerHTML.includes('Perfil da clientela'));
  } catch(e){ chk('v7.25.0 · página da clientela', false, e.message); }
  // senha 2 opções: "agora" chama a Edge Function admin-senha via supaFn
  var RES_SENHA2 = (async () => {
    await RES_SENHA;
    vm.runInContext('dlg = async()=>"agora"', ctx);
    ctx.prompt = () => 'senha-nova-de-terceiro';
    vm.runInContext('this.prompt = (m)=>"senha-nova-de-terceiro"', ctx);
    const chamadas = [];
    const fetchOrig = ctx.fetch;
    ctx.fetch = async (url, opt) => { chamadas.push({url:String(url), body:opt&&opt.body});
      return { ok:true, json: async()=>({ ok:true }) }; };
    let msgs = 0;
    vm.runInContext('toast = ()=>{ this.__msg=(this.__msg||0)+1 }; alert = ()=>{ this.__msg=(this.__msg||0)+1 };', ctx);
    ctx.fetch = async (url, opt) => { chamadas.push({url:String(url), body:opt&&opt.body});
      return { ok:true, status:200, json: async()=>({ ok:true }) }; };
    try { await vm.runInContext('usSenhaMenu("colega@artecon.com.br")', ctx); } catch(e){ ctx.fetch=fetchOrig; return 'EXC:'+e.message; }
    // resposta de ERRO também tem que gerar mensagem (v7.26.1 — antes silenciava)
    ctx.fetch = async (url, opt) => { chamadas.push({url:String(url), body:opt&&opt.body});
      return { ok:false, status:403, json: async()=>({ ok:false, erro:'fora da lista' }) }; };
    try { await vm.runInContext('usSenhaMenu("colega@artecon.com.br")', ctx); } catch(e){}
    msgs = vm.runInContext('this.__msg||0', ctx);
    ctx.fetch = fetchOrig;
    return { auth: chamadas.filter(c=>/admin-senha/.test(c.url)), msgs };
  })();
}

// ═══ 5m. v7.26.0 — dados de entrada na conferência e trava de análises ═══
console.log('\n■ v7.26.0 — bloco 0 (dados de entrada) e trava de análises fechadas');
{
  // bloco 0: dados de entrada abrem a conferência com receitas/folha/compras/config
  const inp0 = mk({a1_semst:Array(12).fill(50000)},1200000,{iss:.05});
  inp0.receitas.a1_exp = Array(12).fill(10000);
  inp0.compras.semst = Array(12).fill(8000);               // linhas zeradas são (corretamente) omitidas
  ctx.__res0 = g.calcular(inp0, clone(AD), {...FD});
  vm.runInContext('RL.dados = '+JSON.stringify({ano:2025,cnpj:'00000000000000',receitas:inp0.receitas,folha:inp0.folha,compras:inp0.compras,despesas:inp0.despesas,cfg:inp0.cfg,icms:{cred:null,deb:null},ipi:{cred:null,deb:null}})+'; RL.res = __res0; RL.empresa={razao_social:"T"};', ctx);
  try {
    const e0 = vm.runInContext('rlConfEntrada()', ctx);
    chk('v7.26.0 · bloco 0 lista receitas (incl. exportação), folha, compras e configuração',
      /Dados de entrada/.test(e0) && /[Ee]xporta/.test(e0) && /Pró-labore/.test(e0) && /Revenda sem ST/.test(e0) && /Configuração vigente/.test(e0));
    const conf = vm.runInContext('rlConferencia()', ctx);
    chk('v7.26.0 · conferência abre com o bloco 0 em todos os modos',
      conf.indexOf('Dados de entrada') > -1 && conf.indexOf('Dados de entrada') < conf.indexOf('Simples Nacional'));
  } catch(e){ chk('v7.26.0 · bloco 0', false, e.message); }
  // trava: fechada bloqueia salvar e importar; snapshot compara e detecta divergência
  var RES_TRAVA = (async () => {
    await RES_SENHA2;
    vm.runInContext('garantirEmpresa = async()=>{}; dlg = async()=>true; APP.user={email:"t@artecon"}; supa = async()=>[];', ctx);
    vm.runInContext('AN = anNovo("24197146000137", 2025); AN.receitas.a1_semst[0]=100000;', ctx);
    vm.runInContext('AN._res = calcular(AN, PARAMS.anexos, folhaPercDaEmpresa(AN.cfg)); AN_SUJO = false;', ctx);
    const chamadas = [];
    const fetchOrig = ctx.fetch;
    ctx.fetch = async (url, opt) => { chamadas.push({url:String(url), method:opt&&opt.method});
      return { ok:true, json: async()=>([]) }; };
    await vm.runInContext('anFecharAbrir()', ctx);          // fecha (dlg=true, AN_SUJO=false)
    const st1 = vm.runInContext('AN._status', ctx);
    const snap = vm.runInContext('AN._snapshot', ctx);
    const salvou = await vm.runInContext('anSalvar()', ctx); // deve recusar
    // importador bloqueado: balAplicar → anAplicado barra a gravação? (a guarda está no anAplicado)
    vm.runInContext('BAL = {cnpj:"24197146000137", nome:"T", ano:2025, mesIni:0, mesFim:0, lotes:[{arquivo:"x", ano:2025, mesIni:0, mesFim:0, contas:[{destino:"compras.semst", valor:111}]}]}', ctx);
    ctx.document.getElementById('bal-modo').value='proprio';
    try { await vm.runInContext('balAplicar()', ctx); } catch(e){}
    // divergência: simula "atualização que mudou o motor" alterando o recálculo
    vm.runInContext('AN.receitas.a1_semst[0]=120000; AN._res = calcular(AN, PARAMS.anexos, folhaPercDaEmpresa(AN.cfg)); anTravaRender();', ctx);
    const aviso = ctx.document.getElementById('an-trava-aviso').innerHTML;
    ctx.fetch = fetchOrig;
    return { st1, temSnap: !!(snap&&snap.totais), salvou, aviso };
  })();
}

// ═══ 5n. v7.27.0 — analíticos por documento unificados no item 2 + supaFn v7.26.2 ═══
console.log('\n■ v7.27.0 — analítico entra pelo item 2 (card avulso extinto) e supaFn localiza timeout');
{
  chk('v7.27.0 · card avulso da triagem foi removido do HTML (sem tri-arq-*, sem triArquivo)',
    !html.includes('tri-arq-venda') && !html.includes('tri-arq-compra') && !html.includes('triArquivo'));
  chk('v7.27.0 · painéis das triagens vivem DENTRO do card 2 (tri-painel-venda/compra antes da lista de CNPJs)',
    html.includes('id="tri-painel-venda"') && html.includes('id="tri-painel-compra"')
    && html.indexOf('id="tri-painel-venda"') > html.indexOf('2. Informe os CNPJs')
    && html.indexOf('id="tri-painel-venda"') < html.indexOf('Colar lista (um CNPJ por linha'));
  var RES_TRI27 = (async () => {
    await RES_TRAVA;                                       // serializa (contexto compartilhado)
    vm.runInContext('EMP_GLOBAL = {cnpj:"24197146000137", razao_social:"WEEEDO"}; TRI={venda:null,compra:null};', ctx);
    // (a) saídas puras (5xxx/6xxx; 9xxx ignorado) → VENDA sem perguntar
    ctx.__r27v = [['Data Emissão','Natureza','Empresa','Valor Contábil','CNPJ/CPF/CNO'],
      ['15/01/2025','5102002','356',53000,'02.307.029/0001-46'],
      ['22/01/2025','6502002','356',20000,'01.864.215/0008-90'],
      ['23/01/2025','9000008','356',17000,'29.897.180/0001-38']];
    vm.runInContext('dlg = async()=>{ this.__dlg27=(this.__dlg27||0)+1; return null; };', ctx);
    const okV = await vm.runInContext('triReceber(__r27v, "CLIENTES_012025.xls")', ctx);
    const tv27 = vm.runInContext('TRI.venda', ctx);
    const pv = ctx.document.getElementById('tri-painel-venda').style.display;
    // (b) entradas puras (1xxx/2xxx) → COMPRA sem perguntar
    ctx.__r27c = [['Data Entrada','Natureza','Empresa','Valor Contábil','Razão Social','CNPJ/CPF/CNO'],
      ['02/01/2025','1102001','356',50000,'FORN A LTDA','11.111.111/0001-91'],
      ['03/01/2025','2102001','356',30000,'FORN B ME','22.222.222/0001-91']];
    const okC = await vm.runInContext('triReceber(__r27c, "FORNECEDORES_012025.xls")', ctx);
    const tc27 = vm.runInContext('TRI.compra', ctx);
    const semDlg = vm.runInContext('this.__dlg27||0', ctx) === 0;
    // (c) misto (1xxx + 5xxx) → pergunta; dlg responde "compra"
    vm.runInContext('dlg = async()=>{ this.__dlg27=(this.__dlg27||0)+1; return "compra"; }; TRI.compra=null;', ctx);
    ctx.__r27m = [['Data','Natureza','Empresa','Valor Contábil','CNPJ/CPF/CNO'],
      ['02/01/2025','1102001','356',40000,'11.111.111/0001-91'],
      ['05/01/2025','5102002','356',10000,'02.307.029/0001-46']];
    const okM = await vm.runInContext('triReceber(__r27m, "MISTO.xls")', ctx);
    const perguntou = vm.runInContext('this.__dlg27||0', ctx) === 1;
    const tm27 = vm.runInContext('TRI.compra', ctx);
    // (d) planilha de lista de CNPJs (sem cabeçalho do analítico) → false: extração de CNPJs segue viva
    ctx.__r27n = [['Empresa','Documento'],['A','11.111.111/0001-91'],['B','22.222.222/0001-91']];
    const okN = await vm.runInContext('triReceber(__r27n, "lista.xlsx")', ctx);
    // (e) supaFn v7.26.2: função pendurada → erro que LOCALIZA (nome da função + Logs)
    vm.runInContext('APP.token="tok"; APP.tokenExp=Date.now()+3600000; SUPAFN_T.fn=60;', ctx);
    const fetchOrig = ctx.fetch;
    ctx.fetch = (url, opt) => new Promise((res, rej) => {
      if (opt && opt.signal) opt.signal.addEventListener('abort',
        () => rej(Object.assign(new Error('aborted'), { name:'AbortError' })));
    });
    let erroFn = '';
    try { await vm.runInContext('supaFn("admin-senha", {})', ctx); } catch(e){ erroFn = e.message; }
    ctx.fetch = fetchOrig;
    vm.runInContext('SUPAFN_T.fn=12000;', ctx);
    return { okV, tv27, pv, okC, tc27, semDlg, okM, perguntou, tm27, okN, erroFn };
  })();
}

// ═══ 5o. v7.28.0 — Fase B: trilha de origem por campo ═══
console.log('\n■ v7.28.0 — trilha de origem por campo (Fase B)');
{
  var RES_ORIG = (async () => {
    await RES_TRI27;                                       // serializa (AN/stubs compartilhados)
    vm.runInContext('garantirEmpresa = async()=>{}; anPodeSobrescrever = ()=>true; APP.user={email:"t@artecon"};', ctx);
    vm.runInContext('AN = anNovo("24197146000137", 2025); AN_SUJO=false;', ctx);
    ctx.document.getElementById('an-ano').value = '2025';
    // (a) grade: anSet marca D; anRepetir herda a origem de janeiro
    vm.runInContext('anSet("receitas.a3_semret", 0, "1000", ""); anRepetir("receitas.a3_semret");', ctx);
    const ogGrade = vm.runInContext('AN.origem["receitas.a3_semret"]', ctx);
    // (b) PGDAS marca P nos meses do lote, em TODAS as linhas de receitas (inclusive as zeradas)
    vm.runInContext(`PG_DADOS = { cnpj:"24197146000137", nome:"WEEEDO", meses: { "03/2025": {
      atividades:[{bloco:"a1_semst", valor:50000, texto:"revenda"}], receita:50000, das:2000, tributos:{}, rbtAnt:{}, rbtExpAnt:{}, rba:51000 } } };`, ctx);
    try { await vm.runInContext('pgdasAplicar()', ctx); } catch(e){ return 'EXC-pgdas:'+e.message; }
    const ogP  = vm.runInContext('(AN.origem["receitas.a1_semst"]||[])[2]', ctx);
    const ogP2 = vm.runInContext('(AN.origem["receitas.a2_semst"]||[])[2]', ctx);   // zerada pelo lote → também P
    const ogPfora = vm.runInContext('(AN.origem["receitas.a1_semst"]||[])[5]', ctx); // mês fora do lote → intocado
    // (c) balancete marca B só nos pares (destino, mês) da matriz
    vm.runInContext(`BAL = { cnpj:"24197146000137", nome:"WEEEDO", ano:2025, mesIni:0, mesFim:0,
      lotes:[{arquivo:"01-2025.xls", ano:2025, mesIni:0, mesFim:0, contas:[{destino:"compras.semst", valor:15933.21}]}] };`, ctx);
    ctx.document.getElementById('bal-modo').value = 'proprio';
    try { await vm.runInContext('balAplicar()', ctx); } catch(e){ return 'EXC-bal:'+e.message; }
    const ogB = vm.runInContext('AN.origem["compras.semst"]', ctx);
    // (d) rateio de fornecedores marca R
    vm.runInContext('dlg = async()=>"rel";', ctx);
    try { await vm.runInContext('fornRatear("despesas","outras", 1200, "01/01/2025 a 31/12/2025", "Despesas › Outras")', ctx); } catch(e){ return 'EXC-forn:'+e.message; }
    const ogR = vm.runInContext('AN.origem["despesas.outras"]', ctx);
    // (e) persistência: o corpo do anSalvar preserva origem; anNormalizar cria/preserva
    const persiste = vm.runInContext('Object.keys(JSON.parse(JSON.stringify({...AN, _res:undefined, _verEm:undefined})).origem||{}).length', ctx);
    const normNovo  = vm.runInContext('Object.keys(anNormalizar({cnpj:"1",ano:2025}).origem||{}).length === 0 && !Array.isArray(anNormalizar({cnpj:"1",ano:2025}).origem)', ctx);
    const normMantem = vm.runInContext('(anNormalizar(JSON.parse(JSON.stringify(AN))).origem["compras.semst"]||[])[0]', ctx);
    // (f) conferência: bloco 0 com letras + legenda; análise antiga → "não registrada"
    vm.runInContext('RL.dados = JSON.parse(JSON.stringify({...AN, _res:undefined})); RL.empresa={razao_social:"W"};', ctx);
    const h1 = vm.runInContext('rlConfEntrada()', ctx);
    vm.runInContext('RL.dados = anNormalizar({cnpj:"24197146000137", ano:2025, receitas:{a1_semst:[1,0,0,0,0,0,0,0,0,0,0,0]}});', ctx);
    const h0 = vm.runInContext('rlConfEntrada()', ctx);
    return { ogGrade, ogP, ogP2, ogPfora, ogB, ogR, persiste, normNovo, normMantem, h1, h0 };
  })();
}

// ═══ 5p. v7.29.0 — art. 58 (crédito por faixa) e triagem de compra → Reforma/Compras ═══
console.log('\n■ v7.29.0 — art. 58 §§4º-6º (Res. 190) e triagem de compra alimentando Reforma/Compras');
{
  chk('v7.29.0 · fórmula ÚNICA: credSimplesArt58 na definição, na aba Reforma (rfLinhaBase) e no Relatório',
    (html.match(/credSimplesArt58\(/g)||[]).length >= 4);
  var RES_A58 = (async () => {
    await RES_ORIG;                                        // serializa (AN/RF/stubs compartilhados)
    // (a) percentuais por vigência = alíquota 1ª faixa Anexo I × (CBS+IBS da faixa na vigência)
    const esp = a => vm.runInContext(`ANEXOS_DEFAULT.I.aliq[0] * (((repTribAno(${a}).I.cbs||[])[0]||0) + ((repTribAno(${a}).I.ibs||[])[0]||0))`, ctx);
    const c26 = vm.runInContext('credSimplesArt58(2026)', ctx), c27 = vm.runInContext('credSimplesArt58(2027)', ctx),
          c29 = vm.runInContext('credSimplesArt58(2029)', ctx), c33 = vm.runInContext('credSimplesArt58(2033)', ctx);
    // (b) rfLinhaBase: automático com % manual zerado; override quando preenchido
    vm.runInContext('__rfT = { receita:0, baseIS:0, credSimplesPct:0, benefRec:{}, benefCred:{}, contra:{ compras_simples:100000 } };', ctx);
    const credAuto33 = vm.runInContext('rfLinhaBase(__rfT, 2033).cred', ctx);
    const credAuto26 = vm.runInContext('rfLinhaBase(__rfT, 2026).cred', ctx);
    const credManual = vm.runInContext('__rfT.credSimplesPct = 5; rfLinhaBase(__rfT, 2033).cred', ctx);
    // (c) fornAutoAplicar: triagem de COMPRA mais recente vence a revenda e soma com o serviço
    vm.runInContext(`RF = rfNovo('24197146000137', 2025); RF.cnpj='24197146000137';
      supa = async () => ([
        { consultado_em:'2026-08-16T10:00:00Z', dados:{ tipo:'compra', periodo:'01/01/2025 a 31/12/2025', stats:{tot:80999},
          itens:[{classe:'normal',valor:50000,cfops:{}},{classe:'simples',valor:20000,cfops:{}},{classe:'mei',valor:10000,cfops:{}},{classe:'pf',valor:999,cfops:{}},{classe:'proprio',valor:483,cfops:{}}] } },
        { consultado_em:'2026-08-10T10:00:00Z', dados:{ tipo:'revenda', periodo:'01/01/2025 a 31/12/2025', stats:{ grupos:{ normal:{v:11111}, simples:{v:2222}, mei:{v:0}, nid:{v:0}, pf:{v:0} } } } },
        { consultado_em:'2026-08-01T10:00:00Z', dados:{ tipo:'servico', periodo:'01/01/2025 a 31/12/2025', stats:{ grupos:{ normal:{v:1000}, simples:{v:500}, mei:{v:0}, nid:{v:0}, pf:{v:0} } } } } ]);`, ctx);
    try { await vm.runInContext('fornAutoAplicar()', ctx); } catch(e){ return 'EXC-forn:'+e.message; }
    const fLrlp = vm.runInContext('RF.contra.compras_lrlp', ctx), fSimp = vm.runInContext('RF.contra.compras_simples', ctx);
    const fNota = vm.runInContext('fornNotaHtml()', ctx);
    // (d) inverso: revenda mais recente vence a triagem
    vm.runInContext(`RF = rfNovo('24197146000137', 2025); RF.cnpj='24197146000137';
      supa = async () => ([
        { consultado_em:'2026-08-16T10:00:00Z', dados:{ tipo:'revenda', periodo:'01/2025', stats:{ grupos:{ normal:{v:11111}, simples:{v:2222}, mei:{v:0}, nid:{v:0}, pf:{v:0} } } } },
        { consultado_em:'2026-08-10T10:00:00Z', dados:{ tipo:'compra', periodo:'01/2025', stats:{tot:80999}, itens:[{classe:'normal',valor:50000,cfops:{}}] } } ]);`, ctx);
    try { await vm.runInContext('fornAutoAplicar()', ctx); } catch(e){ return 'EXC-forn2:'+e.message; }
    const rLrlp = vm.runInContext('RF.contra.compras_lrlp', ctx);
    // (e) triLancarCompras: rateia o total EXTERNO (com PF, sem movimentação própria) com origem R
    vm.runInContext(`AN = anNovo('24197146000137', 2025); AN_SUJO=false;
      EMP_GLOBAL = {cnpj:'24197146000137', razao_social:'WEEEDO'};
      TRI.compra = { tipo:'compra', cnpjEmpresa:'24197146000137', periodo:'01/01/2025 a 31/01/2025', docs:5, arquivo:'F.xls',
        itens:[{cnpj:'1',razao:'A',classe:'normal',valor:50000,cfops:{},notas:1},{cnpj:'2',razao:'B',classe:'simples',valor:20000,cfops:{},notas:1},
               {cnpj:'3',razao:'C',classe:'mei',valor:10000,cfops:{},notas:1},{cnpj:'4',razao:'D',classe:'pf',valor:999,cfops:{},notas:1},
               {cnpj:'24197146000137',razao:'WEEEDO',classe:'proprio',valor:483,cfops:{},notas:1}] };
      dlg = async () => 'semst';`, ctx);
    try { await vm.runInContext('triLancarCompras()', ctx); } catch(e){ return 'EXC-tri:'+e.message; }
    const lanJan = vm.runInContext('AN.compras.semst[0]', ctx), lanFev = vm.runInContext('AN.compras.semst[1]', ctx);
    const lanOg = vm.runInContext('(AN.origem["compras.semst"]||[])[0]', ctx);
    return { esp27:esp(2027), esp33:esp(2033), c26, c27, c29, c33, credAuto33, credAuto26, credManual, fLrlp, fSimp, fNota, rLrlp, lanJan, lanFev, lanOg };
  })();
}

// ═══ 5q. v7.29.1 — D5: CBS 2027-28 = referência − 0,1 p.p. (LC 214, art. 347) ═══
console.log('\n■ v7.29.1 — D5: CBS do biênio 2027-2028 reduzida em 0,1 p.p.');
{
  var RES_D5 = (async () => {
    await RES_A58;
    const d = vm.runInContext('RF_ALIQ_DEFAULT', ctx);
    const alq27 = vm.runInContext('rfLinhaBase({receita:0,baseIS:0,credSimplesPct:0,benefRec:{},benefCred:{},contra:{}}, 2027).alq', ctx);
    // migração: padrão antigo salvo (9,21 no biênio) corrige; personalizado fica
    vm.runInContext(`__pSnap = PARAMS;
      supa = async () => ([{ valor: { anexos: JSON.parse(JSON.stringify(ANEXOS_DEFAULT)), folha: {...FOLHA_PERC_DEFAULT},
        reforma: { 2027:{cbs:9.21, is:0, ibse:0.05, ibsm:0.05}, 2028:{cbs:8.8, is:0, ibse:0.05, ibsm:0.05} } } }]);`, ctx);
    try { await vm.runInContext('prCarregar()', ctx); } catch(e){ return 'EXC-pr:'+e.message; }
    const mig27 = vm.runInContext('PARAMS.reforma[2027].cbs', ctx);
    const mig28 = vm.runInContext('PARAMS.reforma[2028].cbs', ctx);
    vm.runInContext('PARAMS = __pSnap;', ctx);
    return { d, alq27, mig27, mig28 };
  })();
}

// ═══ 5r. v7.30.0 — Lacre do motor de cálculo ═══
console.log('\n■ v7.30.0 — lacre do motor (selo embutido conferido no app e no CI)');
{
  var RES_LACRE = (async () => {
    await RES_D5;                                          // serializa (PARAMS compartilhado)
    let r; try { r = vm.runInContext('lacreRodar()', ctx); } catch(e){ return 'EXC-lacre:'+e.message; }
    // violação simulada: mexer numa alíquota de fábrica muda o resultado → lacre acusa
    const aliqSnap = vm.runInContext('ANEXOS_DEFAULT.I.aliq[5]', ctx);
    vm.runInContext('ANEXOS_DEFAULT.I.aliq[5] = ANEXOS_DEFAULT.I.aliq[5] + 0.001;', ctx);
    let rV; try { rV = vm.runInContext('lacreRodar()', ctx); } catch(e){ rV = { ok:'EXC:'+e.message }; }
    vm.runInContext('ANEXOS_DEFAULT.I.aliq[5] = '+aliqSnap+';', ctx);
    const rOk2 = vm.runInContext('lacreRodar().ok', ctx);   // restaurado → volta a bater
    let boot; try { vm.runInContext('lacreBoot(true)', ctx); boot = vm.runInContext('LACRE_ST', ctx); } catch(e){ boot = null; }
    return { r, rV, rOk2, boot };
  })();
}

// ═══ 6. Integridade da interface ═══
// Todo elemento que o código acessa por $id() precisa existir no HTML.
// Foi a ausência disso que deixou passar container removido e seletor duplicado.
console.log('\n■ Integridade da interface');
{
  const usados = new Set([...html.matchAll(/\$id\('([^']+)'\)/g)].map(m=>m[1])
                    .filter(id => !id.includes('${')));            // ids montados em runtime
  const declarados = new Set([
    ...[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]),
    ...[...html.matchAll(/id='([^']+)'/g)].map(m=>m[1])
  ]);
  const orfaos = [...usados].filter(id => !declarados.has(id)).sort();
  chk(`todo $id() tem elemento correspondente (${usados.size} referências)`, orfaos.length===0,
      orfaos.length ? 'sem declaração: ' + orfaos.join(', ') : '');
}

// ═══ RESULTADO (aguarda os testes assíncronos dos importadores) ═══
(async () => {
  const bal = await Promise.race([RES_BAL, new Promise(r=>setTimeout(()=>r(null), 8000))]);
  chk('balAplicar SUBSTITUI o mês coberto (resíduo 63.732,84 dá lugar a 15.933,21)',
    bal && Math.abs(bal.v1-15933.21)<0.01, bal?`após 1ª=${(+bal.v1).toFixed(2)}`:'timeout/travou');
  chk('balAplicar idempotente: reimportar o mesmo balancete não duplica',
    bal && Math.abs(bal.v2-15933.21)<0.01, bal?`após 2ª=${(+bal.v2).toFixed(2)}`:'timeout/travou');
  const b2 = await Promise.race([RES_BAL2, new Promise(r=>setTimeout(()=>r(null), 8000))]);
  chk('v7.19.0 · matriz "mês próprio": jan=15.933,21+salários, fev=20.000, nada rateado',
    b2 && Math.abs(b2.M['compras.semst'][0]-15933.21)<0.01 && Math.abs(b2.M['compras.semst'][1]-20000)<0.01 && Math.abs(b2.M['folha.salarios'][0]-10000)<0.01 && b2.M['compras.semst'][2]===undefined,
    b2?'ok':'timeout');
  chk('v7.19.0 · aplicação multi-lote grava nos meses certos e reimportar não duplica',
    b2 && Math.abs(b2.jan-15933.21)<0.01 && Math.abs(b2.fev-20000)<0.01 && Math.abs(b2.sal-10000)<0.01 && Math.abs(b2.jan2-15933.21)<0.01 && Math.abs(b2.fev2-20000)<0.01,
    b2?`jan=${(+b2.jan).toFixed(2)} fev=${(+b2.fev).toFixed(2)} 2ª: jan=${(+b2.jan2).toFixed(2)} fev=${(+b2.fev2).toFixed(2)}`:'timeout');
  chk('v7.19.0 · prévia renderiza a matriz sem exceção (mesma fonte da aplicação)',
    b2 && b2.previaOK && /Prévia/.test(b2.previaHTML) && /15\.933,21|15933/.test(b2.previaHTML));
  chk('v7.19.0 · modo distribuir: lote anual rateia 1.200 em 100/mês',
    b2 && b2.Ma && Math.abs(b2.Ma['despesas.adm'][0]-100)<0.01 && Math.abs(b2.Ma['despesas.adm'][11]-100)<0.01);
  const prodHtml = await Promise.race([RES_PROD, new Promise(r=>setTimeout(()=>r(null), 8000))]);
  chk('v7.22.0 · relatório de produtos no LAYOUT DO PARECER (pp-page) — sem notas, orientação ao RTC',
    typeof prodHtml==='string' && !prodHtml.startsWith('EXC:') && /pp-page/.test(prodHtml||'') && /Classificação|Nenhuma nota|não foi possível/i.test(prodHtml||''),
    prodHtml&&prodHtml.startsWith('EXC:')?prodHtml:'ok');
  const fornCnpj = await Promise.race([RES_FORNCNPJ, new Promise(r=>setTimeout(()=>r(null), 8000))]);
  chk('v7.22.0 · Resumo de fornecedores no LAYOUT DO PARECER (pp-page timbrada) com identificação e QSA',
    typeof fornCnpj==='string' && /Resumo Estatístico de Fornecedores/.test(fornCnpj) && /pp-page/.test(fornCnpj) && /EMPRESA TESTE LTDA/.test(fornCnpj) && /FULANO DE TAL/.test(fornCnpj),
    fornCnpj&&fornCnpj.startsWith&&fornCnpj.startsWith('EXC:')?fornCnpj:'ok');
  chk('v7.22.0 · relação INTEGRAL de fornecedores (3 nomeados + 57 extras) com % em regime normal',
    typeof fornCnpj==='string' && fornCnpj.includes('FORN NORMAL LTDA') && fornCnpj.includes('FORN SIMPLES ME') && fornCnpj.includes('FORN MEI') && fornCnpj.includes('FORN 56'),
    'ok');
  chk('v7.22.0 · paginador: 60 fornecedores geram mais de uma página timbrada, thead repetido',
    typeof fornCnpj==='string' && (fornCnpj.match(/pp-page/g)||[]).length>=3 && (fornCnpj.match(/<thead>/g)||[]).length>=3,
    typeof fornCnpj==='string'?((fornCnpj.match(/pp-page/g)||[]).length+' páginas'):'—');
  const xml = await Promise.race([RES_XML, new Promise(r=>setTimeout(()=>r(null), 8000))]);
  chk('XML: notas do lote somam entre si (1.000 + 500) e reimportar não duplica',
    xml && Math.abs(xml.v1-1500)<0.01 && Math.abs(xml.v2-1500)<0.01,
    xml?`1ª=${(+xml.v1).toFixed(2)} 2ª=${(+xml.v2).toFixed(2)}`:'timeout/travou');
  const sn = await Promise.race([RES_SENHA, new Promise(r=>setTimeout(()=>r(null), 8000))]);
  chk('v7.23.0 · alterar senha: barra nova curta e confirmação divergente sem tocar a rede',
    sn && sn.bloqueiaCurta && sn.bloqueiaConf, sn?'ok':'timeout');
  chk('v7.23.0 · alterar senha: revalida a atual (grant password) e grava via PUT /auth/v1/user',
    sn && sn.chamadas.length===2 && /grant_type=password/.test(sn.chamadas[0].url) && /auth\/v1\/user/.test(sn.chamadas[1].url) && sn.chamadas[1].method==='PUT' && /senha-nova-segura/.test(sn.chamadas[1].body||''),
    sn?sn.chamadas.map(c=>c.method+' '+c.url.split('/auth/')[1]).join(' → '):'—');
  const s2 = await Promise.race([RES_SENHA2, new Promise(r=>setTimeout(()=>r(null), 8000))]);
  chk('v7.25.0 · "Redefinir agora" chama a Edge Function admin-senha com e-mail e nova senha',
    s2 && Array.isArray(s2.auth) && s2.auth.length===2 && /colega@artecon/.test(s2.auth[0].body||'') && /senha-nova-de-terceiro/.test(s2.auth[0].body||''),
    s2&&s2.auth?'ok':'timeout/'+s2);
  chk('v7.26.1 · sucesso E erro sempre geram mensagem (toast/alert) — nunca silêncio',
    s2 && s2.msgs>=2, s2?('mensagens: '+s2.msgs):'—');
  const tv = await Promise.race([RES_TRAVA, new Promise(r=>setTimeout(()=>r(null), 8000))]);
  chk('v7.26.0 · fechar grava snapshot e o status muda para fechada',
    tv && tv.st1==='fechada' && tv.temSnap, tv?tv.st1:'timeout');
  chk('v7.26.0 · análise fechada recusa gravação (anSalvar → false)',
    tv && tv.salvou===false);
  chk('v7.26.0 · divergência pós-atualização detectada e avisada (de → para), sem alterar o snapshot',
    tv && /diverge/.test(tv.aviso||'') && /(Simples|Presumido|Real): R\$/.test(tv.aviso||'') && /→/.test(tv.aviso||''), tv?('aviso['+String(tv.aviso||'').length+']: '+String(tv.aviso||'').replace(/<[^>]*>/g,' ').slice(0,120)):'timeout');
  const t27 = await Promise.race([RES_TRI27, new Promise(r=>setTimeout(()=>r(null), 8000))]);
  chk('v7.27.0 · saídas (5xxx/6xxx) → triagem de VENDA sem perguntar (9xxx ignorado)',
    t27 && t27.okV===true && t27.tv27 && t27.tv27.tipo==='venda' && t27.tv27.itens.length===3 && t27.tv27.arquivo==='CLIENTES_012025.xls',
    t27&&t27.tv27?`${t27.tv27.itens.length} clientes`:'timeout');
  chk('v7.27.0 · painel da venda aparece dentro do card 2 (display=block explícito)',
    t27 && t27.pv==='block', t27?('display='+t27.pv):'—');
  chk('v7.27.0 · entradas (1xxx/2xxx) → triagem de COMPRA sem perguntar',
    t27 && t27.okC===true && t27.tc27 && t27.tc27.tipo==='compra' && t27.tc27.itens.length===2 && t27.semDlg,
    t27&&t27.tc27?`${t27.tc27.itens.length} fornecedores · dlg não chamado`:'timeout');
  chk('v7.27.0 · analítico MISTO pergunta uma vez e respeita a escolha (compra)',
    t27 && t27.okM===true && t27.perguntou && t27.tm27 && t27.tm27.tipo==='compra' && t27.tm27.arquivo==='MISTO.xls');
  chk('v7.27.0 · planilha de lista de CNPJs NÃO é capturada (triReceber → false; extração de CNPJs segue)',
    t27 && t27.okN===false);
  chk('v7.26.2 · supaFn: função pendurada gera erro LOCALIZADO (nome da função + orientação aos Logs)',
    t27 && /admin-senha/.test(t27.erroFn) && /não respondeu/.test(t27.erroFn) && /Logs/.test(t27.erroFn),
    t27?String(t27.erroFn).slice(0,90):'—');
  const og = await Promise.race([RES_ORIG, new Promise(r=>setTimeout(()=>r(null), 8000))]);
  const ogErr = typeof og==='string' ? og : '';
  chk('v7.28.0 · grade: anSet marca D e o ⇉ (repetir janeiro) herda a origem nos 12 meses',
    og && og.ogGrade && og.ogGrade[0]==='D' && og.ogGrade[11]==='D', ogErr || (og&&og.ogGrade?og.ogGrade.join(''):'timeout'));
  chk('v7.28.0 · PGDAS marca P nos meses do lote em TODAS as linhas (inclusive zeradas), sem tocar meses de fora',
    og && og.ogP==='P' && og.ogP2==='P' && og.ogPfora==null, ogErr);
  chk('v7.28.0 · balancete marca B só nos pares (destino, mês) da matriz',
    og && og.ogB && og.ogB[0]==='B' && og.ogB[1]==null, ogErr || (og&&og.ogB?('jan='+og.ogB[0]+' fev='+og.ogB[1]):'—'));
  chk('v7.28.0 · rateio de fornecedores 🚚 marca R nos meses rateados',
    og && og.ogR && og.ogR[0]==='R' && og.ogR[11]==='R', ogErr);
  chk('v7.28.0 · origem PERSISTE no corpo do anSalvar e sobrevive ao anNormalizar (análise antiga ganha {})',
    og && og.persiste>=3 && og.normNovo===true && og.normMantem==='B', ogErr || (og?('paths='+og.persiste+' norm='+og.normMantem):'—'));
  chk('v7.28.0 · bloco 0 mostra a letra da origem ao lado de cada valor, com legenda e contagem por fonte',
    og && /<sup[^>]*>P<\/sup>/.test(og.h1||'') && /<sup[^>]*>B<\/sup>/.test(og.h1||'') && /Origem de cada valor/.test(og.h1||'') && /PGDAS-D \(/.test(og.h1||''), ogErr);
  chk('v7.28.0 · análise gravada antes da v7.28 avisa "origem não registrada" (e nada quebra)',
    og && /não registrada/.test(og.h0||'') && !/<sup/.test(og.h0||''), ogErr);
  const a58 = await Promise.race([RES_A58, new Promise(r=>setTimeout(()=>r(null), 8000))]);
  const aErr = typeof a58==='string' ? a58 : '';
  chk('v7.29.0 · credSimplesArt58 por vigência: 2026=0 · 2027 ≈0,62% · 2029 ≈0,76% · 2033 ≈1,98% (= alíq. 1ª faixa I × CBS+IBS)',
    a58 && a58.c26===0 && Math.abs(a58.c27-a58.esp27)<1e-9 && Math.abs(a58.c33-a58.esp33)<1e-9
      && Math.abs(a58.c27-0.0062)<0.0005 && Math.abs(a58.c29-0.00756)<0.0005 && Math.abs(a58.c33-0.0198)<0.0005,
    aErr || (a58?`27=${(a58.c27*100).toFixed(3)}% 29=${(a58.c29*100).toFixed(3)}% 33=${(a58.c33*100).toFixed(3)}%`:'timeout'));
  chk('v7.29.0 · rfLinhaBase: crédito AUTOMÁTICO nas compras do Simples (100.000 → ≈1.980 em 2033; 0 em 2026)',
    a58 && Math.abs(a58.credAuto33 - 100000*a58.c33) < 0.01 && a58.credAuto26 === 0,
    aErr || (a58?('2033='+(+a58.credAuto33).toFixed(2)):'—'));
  chk('v7.29.0 · % manual preenchido SUBSTITUI o automático (5% → 5.000,00)',
    a58 && Math.abs(a58.credManual - 5000) < 0.01, aErr);
  chk('v7.29.0 · fornAutoAplicar: triagem de compra mais recente VENCE a revenda e soma com o serviço (51.000 normal · 30.500 Simples/MEI)',
    a58 && Math.abs(a58.fLrlp-51000)<0.01 && Math.abs(a58.fSimp-30500)<0.01 && /entradas \(analítico\)/.test(a58.fNota||''),
    aErr || (a58?`lrlp=${a58.fLrlp} simp=${a58.fSimp}`:'—'));
  chk('v7.29.0 · revenda mais recente vence a triagem (compras_lrlp = 11.111)',
    a58 && Math.abs(a58.rLrlp-11111)<0.01, aErr);
  chk('v7.29.0 · "Lançar nas Compras": rateia o total EXTERNO (80.999 — com PF, sem movimentação própria) no mês do período, origem R',
    a58 && Math.abs(a58.lanJan-80999)<0.01 && !(+a58.lanFev) && a58.lanOg==='R',
    aErr || (a58?`jan=${a58.lanJan} origem=${a58.lanOg}`:'—'));
  const d5 = await Promise.race([RES_D5, new Promise(r=>setTimeout(()=>r(null), 8000))]);
  const dErr = typeof d5==='string' ? d5 : '';
  chk('v7.29.1 · D5: CBS 9,11 em 2027-28 (referência − 0,1 p.p., LC 214 art. 347) → combinada 9,21% = referência; 2029-33 seguem 9,21',
    d5 && d5.d[2027].cbs===9.11 && d5.d[2028].cbs===9.11 && Math.abs(d5.d[2027].cbs+d5.d[2027].ibse+d5.d[2027].ibsm-9.21)<1e-9
      && d5.d[2029].cbs===9.21 && d5.d[2033].cbs===9.21 && Math.abs(d5.alq27-0.0921)<1e-9,
    dErr || (d5?`27=${d5.d[2027].cbs} alq=${(d5.alq27*100).toFixed(2)}%`:'timeout'));
  chk('v7.29.1 · migração: parâmetro salvo com o padrão antigo (9,21) vira 9,11; personalizado (8,8) fica intacto',
    d5 && d5.mig27===9.11 && d5.mig28===8.8, dErr || (d5?`27=${d5.mig27} 28=${d5.mig28}`:'—'));
  const lc = await Promise.race([RES_LACRE, new Promise(r=>setTimeout(()=>r(null), 8000))]);
  const lErr = typeof lc==='string' ? lc : '';
  chk('v7.30.0 · LACRE ÍNTEGRO: selo embutido confere com o motor desta entrega (128 números ao centavo) — mudou regra? RE-SELE',
    lc && lc.r && lc.r.ok===true && lc.r.hash===vm.runInContext('LACRE_HASH',ctx) && lc.r.n===128,
    lErr || (lc&&lc.r?`hash=${lc.r.hash} n=${lc.r.n}`:'timeout'));
  chk('v7.30.0 · lacre bate com os gabaritos pinados (caso1: LR 1.169.013,17 · 2033 híbrido 758.554,46 · regular 702.383,68)',
    lc && lc.r && Math.abs(lc.r.resumo[0].lr-1169013.17)<0.01 && Math.abs(lc.r.resumo[0].h33-758554.46)<0.01 && Math.abs(lc.r.resumo[0].r33-702383.68)<0.01, lErr);
  chk('v7.30.0 · violação simulada (alíquota de fábrica alterada) → lacre acusa; restaurada → volta a ÍNTEGRO',
    lc && lc.rV && lc.rV.ok===false && lc.rOk2===true, lErr || (lc&&lc.rV?('violado ok='+lc.rV.ok+' depois='+lc.rOk2):'—'));
  chk('v7.30.0 · lacreBoot grava o estado (versão + selo) e marca íntegro na versão atual',
    lc && lc.boot && lc.boot.ok===true && lc.boot.versao===vm.runInContext('APP_VERSAO',ctx), lErr);
  console.log('\n══════════════════════════════════');
  console.log(FALHAS.length ? `✗ ${FALHAS.length} FALHA(S): ${FALHAS.join(' · ')}` : `✓✓ SUÍTE COMPLETA: ${OK} verificações OK`);
  process.exit(FALHAS.length ? 1 : 0);
})();
