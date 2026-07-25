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
  setTimeout, clearTimeout, alert(){}, confirm:()=>true, URL, atob:s=>s, btoa:s=>s };
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
  chk('A1 · CPP do Anexo IV no total do Simples', Math.abs(M.simples.total-(M.das+M.fgts+M.inssPatr))<0.01); }
{ const a = g.calcular(mk({a3_semret:Array(12).fill(50000)},600000), clone(AD), {...FD});
  const b = g.calcular(mk({a3_retiss:Array(12).fill(50000)},600000), clone(AD), {...FD});
  chk('A2 · carga igual com e sem retenção de ISS', Math.abs(a.totais.simples-b.totais.simples)<0.5, b.totais.issRetido.toFixed(2)+' recompostos'); }
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

// ═══ RESULTADO ═══
console.log('\n══════════════════════════════════');
console.log(FALHAS.length ? `✗ ${FALHAS.length} FALHA(S): ${FALHAS.join(' · ')}` : `✓✓ SUÍTE COMPLETA: ${OK} verificações OK`);
process.exit(FALHAS.length ? 1 : 0);
