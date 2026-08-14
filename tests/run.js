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
  chk('A1 · CPP do Anexo IV no total do Simples (sem FGTS desde a v7.18.0)', Math.abs(M.simples.total-(M.das+M.inssPatr))<0.01); }
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
  chk('ISS retido · sem duplicidade com a trava acima do sublimite', Math.abs(a.totais.simples-b.totais.simples)<1,
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

// ═══ RESULTADO ═══
console.log('\n══════════════════════════════════');
console.log(FALHAS.length ? `✗ ${FALHAS.length} FALHA(S): ${FALHAS.join(' · ')}` : `✓✓ SUÍTE COMPLETA: ${OK} verificações OK`);
process.exit(FALHAS.length ? 1 : 0);
