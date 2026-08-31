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
//   5u. v7.39.0 — projeção do ano (janelas, não-mutação, progressividade do RBT12)
//   5v. v7.41.6 — empresa de destino declarada na Consulta de CNPJ e trava de dono na gravação
//   5w. v7.41.7 — ano de referência do parecer, premissa do crédito e memória da projeção
//  NÃO cobertos aqui: os blocos de PAGINAÇÃO do parecer (T40–T46), que exigem jsdom — vivem nos
//  arquivos testes_T40_T46_paginacao.js e rodam à parte enquanto a dependência não entra no CI.
//  Sai com código ≠ 0 em qualquer falha — o CI bloqueia o push quebrado.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]).join('\n');

// ── sandbox DOM mínimo ──
const mkEl = () => { const el = { innerHTML:'', textContent:'', _v:'', style:{}, classList:{add(){},remove(){},toggle(){}},
  selectedOptions:[{text:'Mensal'}], addEventListener(){}, appendChild(){}, setAttribute(){}, getContext:()=>({}),
  remove(){}, removeAttribute(){}, removeChild(){}, insertAdjacentHTML(){}, focus(){}, click(){}, closest:()=>null,
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
  // sem fixtures a suíte inteira morria aqui (as demais seções já pulavam com aviso)
  const _fx1 = path.join(__dirname,'fixtures','caso1.json');
  const inp = fs.existsSync(_fx1) ? JSON.parse(fs.readFileSync(_fx1,'utf8')).inp : null;
  if (!inp) console.log('  (fixtures/caso1.json ausente — bloco das alíquotas pulado)');
  if (inp) {
  const usada = vm.runInContext(`(()=>{ const res = calcular(${JSON.stringify(inp)}, PARAMS.anexos, folhaPercDaEmpresa(${JSON.stringify(inp)}.cfg));
    const r = calcCenariosReforma(res, { receita:100000, aliq:${JSON.stringify(antiga)} });
    return r.rfx.aliq[2033]; })()`, ctx);
  const padrao = vm.runInContext('PARAMS.reforma ? PARAMS.reforma[2033] : RF_ALIQ_DEFAULT[2033]', ctx);
  chk('alíquotas vêm dos Parâmetros, não da cópia salva na análise',
    Math.abs(usada.cbs - padrao.cbs) < 1e-9 && Math.abs(usada.ibse - padrao.ibse) < 1e-9,
    `usada CBS ${usada.cbs}% × padrão ${padrao.cbs}%`);

  // registro gravado por versão anterior (sem benefRec/benefCred/contra) não pode quebrar a tela
  }
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
  // v7.61.0: sem esta guarda a suíte inteira MORRIA quando a fixture faltava — as demais
  // seções já pulavam com aviso, e o bloco 5c ganhou a guarda na v7.41.8; este ficou de fora.
  const _fxA = path.join(__dirname,'fixtures','caso1.json');
  const fx1 = fs.existsSync(_fxA) ? JSON.parse(fs.readFileSync(_fxA,'utf8')).inp : null;
  if (!fx1) console.log('  (fixtures/caso1.json ausente — gabaritos de cenário 2033 pulados)');
  if (fx1) {
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
    chk('parecer · página única "Clientes e fornecedores — a decisão do crédito" (v7.34.0) com os números da compra',
      out.includes('Clientes e fornecedores') && out.includes('FORN NORMAL LTDA') && /60,0%/.test(out.replace(/\u00a0/g,' '))
      && /Regime normal — crédito pleno/.test(out) && /5 maiores fornecedores/.test(out),
      (out.match(/pp-page/g)||[]).length+' páginas');
  } catch(e){ chk('parecer · página de fornecedores', false, e.message); }
  // sem consulta salva, a página NÃO aparece
  vm.runInContext('RL.forn = null', ctx);
  try { g.rlParecer(); const out2 = els['rl-corpo'].innerHTML;
    chk('parecer · sem consulta de fornecedores, a página não aparece', !out2.includes('Clientes e fornecedores — a decisão do crédito'));
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
    chk('v7.25.0→v7.34.0 · com triagem de venda, a página única traz "Vendas e clientes" com B2B×B2C (90,0%) e os 5 maiores clientes',
      out.includes('Vendas e clientes') && /B2B \(CNPJ\)/.test(out) && /90,0%/.test(out) && /5 maiores clientes/.test(out));
    vm.runInContext('RL.forn = null', ctx);
    g.rlParecer();
    chk('v7.25.0→v7.34.0 · sem triagem, o parecer não ganha a página', !els['rl-corpo'].innerHTML.includes('Clientes e fornecedores — a decisão do crédito'));
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
    // v7.57.0 (C1): redefinir senha de terceiro passou a exigir papel de admin. O cenário simula
    // o administrador — é ele quem faz essa operação. A guarda em si tem teste próprio adiante.
    vm.runInContext("APP.papel = 'admin';", ctx);
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

// ═══ 5n. v7.30.1 — card da triagem restaurado (layout v7.26) + supaFn v7.26.2 ═══
console.log('\n■ v7.30.1 — Consulta CNPJ no layout v7.26 (card próprio) e supaFn localiza timeout');
{
  chk('v7.33.0 · card avulso EXCLUÍDO (sem <h3> próprio): inputs tri-arq-* e dashboards vivem DENTRO do item 2',
    !html.includes('Triagem de venda × compra — analíticos por documento</h3>')
    && html.includes('id="tri-arq-venda"') && html.includes('id="tri-arq-compra"') && html.includes('function triArquivo')
    && html.indexOf('id="tri-arq-venda"') > html.indexOf('2. Informe os CNPJs')
    && html.indexOf('id="tri-dash-compra"') > html.indexOf('id="fo-painel"'));
  chk('v7.33.0 · botão de importar do painel roteia por aba (analítico de FORNECEDORES/CLIENTES via tri-arq-*)',
    html.includes("'tri-arq-' + tipo") && html.includes("Importar analítico de "));
  var RES_TRI27 = (async () => {
    await RES_TRAVA;                                       // serializa (contexto compartilhado)
    vm.runInContext('EMP_GLOBAL = {cnpj:"24197146000137", razao_social:"WEEEDO"}; TRI={venda:null,compra:null};', ctx);
    // triParse com tipo EXPLÍCITO (vem do botão do card, como na v7.26)
    ctx.__r27v = [['Data Emissão','Natureza','Empresa','Valor Contábil','CNPJ/CPF/CNO'],
      ['15/01/2025','5102002','356',53000,'02.307.029/0001-46'],
      ['22/01/2025','6502002','356',20000,'01.864.215/0008-90'],
      ['23/01/2025','9000008','356',17000,'29.897.180/0001-38']];
    const tv27 = vm.runInContext('triParse(__r27v, "venda")', ctx);
    ctx.__r27c = [['Data Entrada','Natureza','Empresa','Valor Contábil','Razão Social','CNPJ/CPF/CNO'],
      ['02/01/2025','1102001','356',50000,'FORN A LTDA','11.111.111/0001-91'],
      ['03/01/2025','2102001','356',30000,'FORN B ME','22.222.222/0001-91']];
    const tc27 = vm.runInContext('triParse(__r27c, "compra")', ctx);
    ctx.__r27n = [['Empresa','Documento'],['A','11.111.111/0001-91'],['B','22.222.222/0001-91']];
    const tn27 = vm.runInContext('triParse(__r27n, "venda")', ctx);
    // v7.29 preservada no card restaurado: dashboard da COMPRA com o botão de lançar nas Compras
    vm.runInContext('TRI.compra = Object.assign(triParse(__r27c, "compra"), {arquivo:"F.xls", _salvo:true}); TRI.compra.itens.forEach(i=>i.classe="normal"); triDash("compra");', ctx);
    const dashC = ctx.document.getElementById('tri-dash-compra').innerHTML;
    // (e) supaFn v7.26.2: função pendurada → erro que LOCALIZA (nome da função + Logs)
    vm.runInContext('APP.token="tok"; APP.tokenExp=Date.now()+3600000; SUPAFN_T.fn=60;', ctx);
    const fetchOrig = ctx.fetch;
    ctx.fetch = (url, opt) => new Promise((res, rej) => {
      if (opt && opt.signal) opt.signal.addEventListener('abort',
        () => rej(Object.assign(new Error('aborted'), { name:'AbortError' })));
    });
    let erroFn = '';
    try { await vm.runInContext('supaFn("admin-senha", {})', ctx); } catch(e){ erroFn = e.message; }
    // v7.33.1: gerar-parecer usa o limite PRÓPRIO (150s de fábrica); encurtado no teste p/ simular
    const limParecer = vm.runInContext("SUPAFN_T.porFn['gerar-parecer']", ctx);
    vm.runInContext("SUPAFN_T.porFn['gerar-parecer']=70;", ctx);
    let erroIA = '';
    try { await vm.runInContext('supaFn("gerar-parecer", {})', ctx); } catch(e){ erroIA = e.message; }
    vm.runInContext("SUPAFN_T.porFn['gerar-parecer']=150000;", ctx);
    ctx.fetch = fetchOrig;
    vm.runInContext('SUPAFN_T.fn=12000;', ctx);
    return { tv27, tc27, tn27, dashC, erroFn, limParecer, erroIA };
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

// ═══ 5s. v7.31.0 — esteira completa do item 2 na triagem ═══
console.log('\n■ v7.31.0 — consulta automática, serviços tomados, venda→Reforma e Resumo renomeado');
{
  chk('v7.31.0 · consulta automática ligada no código: triArquivo chama triConsultar(tipo, true) e a pergunta de quantidade saiu',
    html.includes('triConsultar(tipo, true)') && !html.includes('Consultar na Receita?'));
  chk('v7.34.0 · relatório renomeado para "Resumo Estatístico" nos 3 pontos (opção, cabeçalho ppDocCab e rl-titulo)',
    html.includes('<option value="cnpj">Resumo Estatístico</option>')
    && html.includes("ppDocCab('Resumo Estatístico'")
    && html.includes("$id('rl-titulo').textContent = 'Resumo Estatístico'"));
  var RES_T31 = (async () => {
    await RES_LACRE;                                       // serializa (contexto compartilhado)
    // (a) consulta SEMPRE DIRETO: 5 CNPJs novos, nenhum dlg, consultarUm 5x, classes preenchidas
    vm.runInContext(`EMP_GLOBAL = {cnpj:"24197146000137", razao_social:"WEEEDO"};
      supa = async () => []; __nDlg=0; __nCons=0;
      dlg = async () => { __nDlg++; return true; };
      consultarUm = async (c) => { __nCons++; return { simples: (__nCons%2)===0, simei:false, razao_social:'F'+__nCons, situacao:'ATIVA' }; };
      TRI = { venda:null, compra:null };
      TRI.venda = { tipo:'venda', cnpjEmpresa:'24197146000137', periodo:'01/2025', docs:5, arquivo:'C.xls',
        itens: [1,2,3,4,5].map(n=>({cnpj:'0000000000019'+n, razao:'', classe:null, valor:1000*n, cfops:{'5102001':1000*n}, notas:1})) };`, ctx);
    try { await vm.runInContext('triConsultar("venda")', ctx); } catch(e){ return 'EXC-cons:'+e.message; }
    const consultados = vm.runInContext('TRI.venda.itens.filter(i=>i.classe).length', ctx);
    const nDlg = vm.runInContext('__nDlg', ctx), nCons = vm.runInContext('__nCons', ctx);
    let autoSil = true;
    try { await vm.runInContext('triConsultar("venda", true)', ctx); } catch(e){ autoSil = 'EXC:'+e.message; }
    // (b) lançar nas Compras separando serviços tomados (sim → Despesas › Outras)
    vm.runInContext(`AN = anNovo('24197146000137', 2025); AN_SUJO=false;
      garantirEmpresa = async()=>{}; anPodeSobrescrever = ()=>true;
      TRI.compra = { tipo:'compra', cnpjEmpresa:'24197146000137', periodo:'01/01/2025 a 31/01/2025', docs:4, arquivo:'F.xls',
        itens:[{cnpj:'1',razao:'A',classe:'normal',valor:45000,cfops:{'1102001':45000},notas:1},
               {cnpj:'2',razao:'B',classe:'simples',valor:5000,cfops:{'1933001':5000},notas:1}] };
      dlg = async (t) => /Serviços tomados/.test(t) ? true : 'semst';`, ctx);
    try { await vm.runInContext('triLancarCompras()', ctx); } catch(e){ return 'EXC-lan:'+e.message; }
    const dOut = vm.runInContext('AN.despesas.outras[0]', ctx), cSem = vm.runInContext('AN.compras.semst[0]', ctx);
    const ogD = vm.runInContext('(AN.origem["despesas.outras"]||[])[0]', ctx), ogC = vm.runInContext('(AN.origem["compras.semst"]||[])[0]', ctx);
    // (c) recusa: serviços ficam de fora — só mercadorias vão
    vm.runInContext(`AN = anNovo('24197146000137', 2025);
      dlg = async (t) => /Serviços tomados/.test(t) ? false : 'semst';`, ctx);
    try { await vm.runInContext('triLancarCompras()', ctx); } catch(e){ return 'EXC-lan2:'+e.message; }
    const dOut2 = vm.runInContext('AN.despesas.outras[0]', ctx), cSem2 = vm.runInContext('AN.compras.semst[0]', ctx);
    // (d) dashboard da compra com o crédito estimado
    vm.runInContext('triDash("compra")', ctx);
    const dashCred = ctx.document.getElementById('tri-dash-compra').innerHTML;
    // (e) venda informa a Reforma (vendas_pf/simples/lrlp) sem sobrescrever
    vm.runInContext(`RF = rfNovo('24197146000137', 2025); RF.cnpj='24197146000137';
      supa = async () => ([{ consultado_em:'2026-08-16T10:00:00Z', dados:{ tipo:'venda', periodo:'01/01/2025 a 31/12/2025',
        itens:[{classe:'pf',valor:30000},{classe:'simples',valor:8000},{classe:'mei',valor:2000},{classe:'normal',valor:60000},{classe:'proprio',valor:500}] } }]);`, ctx);
    try { await vm.runInContext('fornAutoAplicar()', ctx); } catch(e){ return 'EXC-vend:'+e.message; }
    const vpf = vm.runInContext('RF.contra.vendas_pf', ctx), vsim = vm.runInContext('RF.contra.vendas_simples', ctx), vlr = vm.runInContext('RF.contra.vendas_lrlp', ctx);
    const notaV = vm.runInContext('fornNotaVendasHtml()', ctx);
    vm.runInContext('RF.contra.vendas_pf = 1;', ctx);
    try { await vm.runInContext('fornAutoAplicar()', ctx); } catch(e){ return 'EXC-vend2:'+e.message; }
    const vpf2 = vm.runInContext('RF.contra.vendas_pf', ctx), aplic2 = vm.runInContext('RF._vend && RF._vend.aplicado', ctx);
    return { consultados, nDlg, nCons, autoSil, dOut, cSem, ogD, ogC, dOut2, cSem2, dashCred, vpf, vsim, vlr, notaV, vpf2, aplic2 };
  })();
}

// ═══ 5t. v7.32.0 — analíticos como abas do painel do item 2 ═══
console.log('\n■ v7.32.0 — analíticos rodam todo o processo do item 2 (abas do painel 🚚)');
{
  // v7.41.3 (decisão dele): os 4 botões de importação SAÍRAM da tela — a importação passa a ser só
  // pelo campo "Importar arquivo (CSV/Excel)". Eles seguem no DOM porque fornTrocarAba/fo-btn-imp são
  // o roteador do painel 🚚. O teste antigo exigia justamente o contrário e foi reescrito.
  chk('v7.41.3 · abas de compra/venda seguem no DOM como roteador do painel 🚚, mas ocultas na tela',
    html.includes('id="fo-aba-compra"') && html.includes('id="fo-aba-venda"')
    && /id="fo-aba-compra"[^>]*style="display:none"/.test(html)
    && /id="fo-aba-venda"[^>]*style="display:none"/.test(html));
  chk('v7.41.3 · a importação da Consulta CNPJ passa pelo campo único de arquivo',
    /Importar arquivo \(CSV \/ Excel\)|Importar arquivo \(CSV\/Excel\)/.test(html));
  var RES_T32 = (async () => {
    await RES_T31;                                         // serializa (FOT/TRI/stubs compartilhados)
    vm.runInContext(`EMP_GLOBAL = {cnpj:'24197146000137', razao_social:'WEEEDO'};
      FOT = { servico:null, revenda:null, compra:null, venda:null }; FO=null; FO_TIPO='servico';
      TRI.compra = { tipo:'compra', cnpjEmpresa:'24197146000137', periodo:'01/01/2025 a 31/01/2025', docs:4, arquivo:'F.xls', _salvo:'2026-08-16T20:00:00Z',
        itens:[{cnpj:'1',razao:'A',classe:'normal',valor:45000,cfops:{'1102001':45000},notas:1},
               {cnpj:'2',razao:'B',classe:'simples',valor:5000,cfops:{'1933001':5000},notas:1},
               {cnpj:'24197146000137',razao:'WEEEDO',classe:'proprio',valor:483,cfops:{},notas:1}] };
      triIntegrarItem2('compra');`, ctx);
    const dsC = vm.runInContext('FOT.compra', ctx);
    const tipoAtivo = vm.runInContext('FO_TIPO', ctx);
    const painel = ctx.document.getElementById('fo-painel').style.display;
    const emp = ctx.document.getElementById('fo-emp').textContent || '';
    // itens COMPARTILHADOS: mudar a classe na triagem reflete na aba do item 2
    vm.runInContext('TRI.compra.itens[0].classe = "mei";', ctx);
    const compartilhado = vm.runInContext('FOT.compra.itens[0].classe', ctx);
    vm.runInContext('TRI.compra.itens[0].classe = "normal";', ctx);
    // ações da aba compra: salvar via triSalvar + lançar via triLancarCompras; venda sem lançamento
    vm.runInContext('fornAcoes()', ctx);
    const acoesC = ctx.document.getElementById('fo-acoes').innerHTML;
    vm.runInContext(`TRI.venda = { tipo:'venda', cnpjEmpresa:'24197146000137', periodo:'01/2025', docs:3, arquivo:'C.xls', _salvo:null,
      itens:[{cnpj:'3',razao:'PJ1',classe:'normal',valor:60000,cfops:{'5102001':60000},notas:1},
             {cnpj:'4',razao:'PF',classe:'pf',valor:30000,cfops:{'5102001':30000},notas:1},
             {cnpj:'24197146000137',razao:'WEEEDO',classe:'proprio',valor:100,cfops:{},notas:1}] };
      triIntegrarItem2('venda'); fornAcoes();`, ctx);
    const dsV = vm.runInContext('FOT.venda', ctx);
    const dsVLen = vm.runInContext('FOT.venda.itens.length', ctx);   // capturado ANTES do push do teste seguinte (referência viva)
    const acoesV = ctx.document.getElementById('fo-acoes').innerHTML;
    // fornConsultar na aba analítica roteia para triConsultar (classes nulas são consultadas)
    vm.runInContext(`TRI.venda.itens.push({cnpj:'5',razao:'',classe:null,valor:1,cfops:{},notas:1});
      FOT.venda.itens.push(TRI.venda.itens[TRI.venda.itens.length-1]);
      __nCons2=0; consultarUm = async()=>{ __nCons2++; return {simples:true, simei:false, razao_social:'X', situacao:'ATIVA'}; };
      supa = async()=>[];`, ctx);
    try { await vm.runInContext('fornConsultar()', ctx); } catch(e){ return 'EXC-fc:'+e.message; }
    const nCons2 = vm.runInContext('__nCons2', ctx);
    const classeNova = vm.runInContext('TRI.venda.itens[TRI.venda.itens.length-1].classe', ctx);
    return { dsC, tipoAtivo, painel, emp, compartilhado, acoesC, dsV, dsVLen, acoesV, nCons2, classeNova };
  })();
}

// ═══ 5u. v7.36.0 — trava da 5ª faixa com o RBT12 efetivo, DAS da guia e monitor de limites ═══
console.log('\n■ v7.36.0 — trava (RBT12 efetivo), trava no DAS e limite/sublimite segregados');
{
  const jan = v => { const a = z(); a[0] = v; return a; };
  // T1: limite EXCLUSIVO — RBT12 exatamente em 3.600.000,00 ainda é 5ª faixa, sem trava
  const t1 = g.calcular(mk({a1_semst:jan(100000)},3600000,{icmsV:.12}), clone(AD), {...FD});
  chk('T1 · RBT12 = 3.600.000,00 → 5ª faixa, SEM trava', t1.meses[0].faixa===5 && t1.meses[0].subIcms===0 && t1.meses[0].subIss===0,
    `faixa=${t1.meses[0].faixa} sub=${(t1.meses[0].subIcms+t1.meses[0].subIss).toFixed(2)}`);
  // T2: um centavo acima → 6ª faixa; alíquota no piso = efetiva máxima da 5ª (continuidade)
  const t2 = g.calcular(mk({a1_semst:jan(100000)},3600000.01,{icmsV:.12}), clone(AD), {...FD});
  chk('T2 · RBT12 = 3.600.000,01 → trava ≈ 3.978,13 (efetiva máxima da 5ª: continuidade, sem salto)',
    t2.meses[0].faixa===6 && Math.abs(t2.meses[0].subIcms-3978.13)<0.02, 'sub='+t2.meses[0].subIcms.toFixed(2));
  // T3/T4: WEEEDO mai e jun/2026 — os números homologados no parecer (RBT12 efetivo do mês)
  const t3 = g.calcular(mk({a1_semst:jan(92589.28)},3636122.34,{icmsV:.12}), clone(AD), {...FD});
  chk('T3 · Weeedo mai/26: RBT12 3.636.122,34 × base 92.589,28 → 3.690,79',
    Math.abs(t3.meses[0].subIcms-3690.79)<0.01, 'sub='+t3.meses[0].subIcms.toFixed(2));
  const t4 = g.calcular(mk({a1_semst:jan(163276.92)},3911784.92,{icmsV:.12}), clone(AD), {...FD});
  chk('T4 · Weeedo jun/26: RBT12 3.911.784,92 × base 163.276,92 → 6.601,08',
    Math.abs(t4.meses[0].subIcms-6601.08)<0.01, 'sub='+t4.meses[0].subIcms.toFixed(2));
  // T5: topo da faixa — o modelo antigo (teto fixo) daria 3.978,13; o correto é 4.181,22 (+5,1%)
  const t5 = g.calcular(mk({a1_semst:jan(100000)},4800000,{icmsV:.12}), clone(AD), {...FD});
  chk('T5 · RBT12 = 4.800.000 → trava 4.181,22 (o modelo antigo congelava em 3.978,13)',
    Math.abs(t5.meses[0].subIcms-4181.22)<0.02, 'sub='+t5.meses[0].subIcms.toFixed(2));
  // T6: Anexo III — o ISS da trava continua no teto de 5% (a correção não move os anexos de serviço)
  const t6 = g.calcular(mk({a3_semret:jan(100000)},3911784.92), clone(AD), {...FD});
  chk('T6 · Anexo III: ISS da trava capado em 5% (5.000,00 por 100.000)',
    Math.abs(t6.meses[0].subIss-5000)<0.01, 'subIss='+t6.meses[0].subIss.toFixed(2));
  // T8/T9: exportação e receitas com ST ficam FORA da base da trava
  const t8 = g.calcular(mk({a1_exp:jan(100000)},3700000,{icmsV:.12}), clone(AD), {...FD});
  chk('T8 · exportação em mês de 6ª faixa: trava = 0 (imune, sublimite próprio)',
    t8.meses[0].subIcms===0 && t8.meses[0].subIss===0);
  const t9 = g.calcular(mk({a1_comst:jan(100000)},3700000,{icmsV:.12}), clone(AD), {...FD});
  chk('T9 · receita com ST em mês de 6ª faixa: trava = 0 (ICMS-ST recolhido antes)',
    t9.meses[0].subIcms===0 && t9.meses[0].subIss===0);
  // T11: DAS DA GUIA — a trava integra o dasGuia; com travaNoDas=false, reproduz o legado
  chk('T11 · dasGuia = das + trava (mês e total) — a guia é o que o PGDAS-D emite',
    Math.abs(t3.meses[0].dasGuia-(t3.meses[0].das+t3.meses[0].subIcms))<0.005
      && Math.abs(t3.totais.dasGuia-(t3.totais.das+t3.totais.sublimite))<0.005,
    'guia='+t3.meses[0].dasGuia.toFixed(2));
  const t11b = g.calcular(mk({a1_semst:jan(92589.28)},3636122.34,{icmsV:.12,travaNoDas:false}), clone(AD), {...FD});
  chk('T11b · cfg.travaNoDas=false (legado): dasGuia = das, trava segue somada só no total do Simples',
    Math.abs(t11b.meses[0].dasGuia-t11b.meses[0].das)<0.005 && t11b.meses[0].subIcms>0);
  chk('T11c · sem dupla contagem: simples.total = das + trava + retenções (a trava não entra duas vezes)',
    Math.abs(t3.meses[0].simples.total-(t3.meses[0].das+t3.meses[0].subIcms+t3.meses[0].subIss))<0.005);
  // T12: monitor de limite/sublimite — mercado interno e exportação NUNCA se somam
  const t12 = g.calcular(mk({a1_semst:Array(12).fill(0).map((_,i)=>i<6?400000:0),
                             a1_exp:  Array(12).fill(0).map((_,i)=>i<6?300000:0)},1200000,{icmsV:.12}), clone(AD), {...FD});
  chk('T12 · subMon: projeção por bloco — interno cruza o sublimite em OUT e NÃO alcança 4,8 mi; somado com exportação alcançaria',
    t12.subMon && t12.subMon.marco.sublimite===9 && t12.subMon.marco.limite===-1
      && Math.abs(t12.subMon.projInt[11]-4800000)<1 && Math.abs(t12.subMon.projExp[11]-3600000)<1,
    t12.subMon?`sub=${t12.subMon.marco.sublimite} lim=${t12.subMon.marco.limite} dezInt=${t12.subMon.projInt[11].toFixed(0)}`:'subMon ausente');
  chk('T12b · subMon classifica o efeito: a projeção cruza os +20% (4,32 mi) em NOV → ICMS/ISS fora do DAS a partir do mês seguinte',
    t12.subMon && t12.subMon.impedimento && t12.subMon.impedimento.quando==='mes-seguinte' && t12.subMon.marco.sublimite20===10,
    t12.subMon&&t12.subMon.impedimento?`quando=${t12.subMon.impedimento.quando} m20=${t12.subMon.marco.sublimite20}`:'—');
  // T12c: mesmo desenho SEM os +20% — ritmo menor cai no efeito de 1º/01 do ano seguinte
  const t12c = g.calcular(mk({a1_semst:Array(12).fill(0).map((_,i)=>i<6?330000:0)},1200000,{icmsV:.12}), clone(AD), {...FD});
  chk('T12c · excesso projetado ≤20% → efeito a partir de 1º/01 do ano seguinte',
    t12c.subMon && t12c.subMon.impedimento && t12c.subMon.impedimento.quando==='ano-seguinte'
      && t12c.subMon.marco.sublimite>=0 && t12c.subMon.marco.sublimite20===-1,
    t12c.subMon&&t12c.subMon.impedimento?`quando=${t12c.subMon.impedimento.quando}`:'—');
  // T13: política de arredondamento — a soma exibida fecha com os meses arredondados
  const _r2 = v=>Math.round(v*100)/100;
  chk('T13 · somaExib: total = Σ meses arredondados (sem diferença de centavo na tabela)',
    Math.abs(vm.runInContext(`somaExib(${JSON.stringify(t3.meses.map(x=>x.dasGuia))})`, ctx)
      - t3.meses.reduce((s,x)=>s+_r2(x.dasGuia),0)) < 1e-9);
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
    ...[...html.matchAll(/id='([^']+)'/g)].map(m=>m[1]),
    // criados em runtime: bx.id = 'imp-prog' (createElement + id). Sem isto o varredor
    // acusa órfão o que na verdade nasce em JS — foi o caso da barra de progresso da v7.43.0.
    ...[...html.matchAll(/\.id\s*=\s*'([\w-]+)'/g)].map(m=>m[1]),
    ...[...html.matchAll(/\.id\s*=\s*"([\w-]+)"/g)].map(m=>m[1])
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
    typeof fornCnpj==='string' && /Resumo Estatístico/.test(fornCnpj) && /pp-page/.test(fornCnpj) && /EMPRESA TESTE LTDA/.test(fornCnpj) && /FULANO DE TAL/.test(fornCnpj),
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
  chk('v7.30.1 · triParse com tipo explícito do botão: venda 3 parceiros · compra 2 fornecedores (soma 80.000)',
    t27 && t27.tv27 && t27.tv27.tipo==='venda' && t27.tv27.itens.length===3
      && t27.tc27 && t27.tc27.tipo==='compra' && t27.tc27.itens.length===2
      && Math.abs(t27.tc27.itens.reduce((s,i)=>s+i.valor,0)-80000)<0.01,
    t27&&t27.tv27?`v=${t27.tv27.itens.length} c=${t27.tc27?t27.tc27.itens.length:'—'}`:'timeout');
  chk('v7.30.1 · planilha de lista de CNPJs NÃO é analítico (triParse → null; fluxo do item 2 preservado)',
    t27 && t27.tn27===null);
  chk('v7.33.0 · triDash sem botões próprios (gravar/lançar moram no fo-acoes do painel), mantendo o aviso da Reforma',
    t27 && !/Lançar total/.test(t27.dashC||'') && !/Gravar triagem/.test(t27.dashC||'') && /alimenta os campos de compras/.test(t27.dashC||''));
  chk('v7.26.2 · supaFn: função pendurada gera erro LOCALIZADO (nome da função + orientação aos Logs)',
    t27 && /admin-senha/.test(t27.erroFn) && /não respondeu/.test(t27.erroFn) && /Logs/.test(t27.erroFn),
    t27?String(t27.erroFn).slice(0,90):'—');
  chk('v7.33.1 · gerar-parecer tem limite PRÓPRIO de 150s (a IA demora) e a mensagem usa o limite certo',
    t27 && t27.limParecer===150000 && /gerar-parecer/.test(t27.erroIA||'') && /não respondeu/.test(t27.erroIA||''),
    t27?('lim='+t27.limParecer):'—');
  const og = await Promise.race([RES_ORIG, new Promise(r=>setTimeout(()=>r(null), 8000))]);
  const ogErr = typeof og==='string' ? og : '';
  // REESCRITO na v7.51.0 (item E · decisão 8.1): o ⇉ NÃO herda mais a origem de janeiro. Herdando
  // 'P', meses nunca declarados entravam em ORIG_IMPORTACAO e o ultimoMesCoberto desligava a
  // projeção. Agora a cópia marca 'C'. Janeiro continua 'D' porque foi digitado.
  chk('v7.51.0 · grade: anSet marca D em janeiro e o ⇉ marca C (cópia) nos demais meses',
    og && og.ogGrade && og.ogGrade[0]==='D' && og.ogGrade[11]==='C', ogErr || (og&&og.ogGrade?og.ogGrade.join(''):'timeout'));
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
  const t31 = await Promise.race([RES_T31, new Promise(r=>setTimeout(()=>r(null), 8000))]);
  const tErr = typeof t31==='string' ? t31 : '';
  chk('v7.31.0 · consulta SEMPRE DIRETO: 5 CNPJs consultados sem nenhuma pergunta (dlg=0) e classes preenchidas; modo auto silencioso',
    t31 && t31.consultados===5 && t31.nDlg===0 && t31.nCons===5 && t31.autoSil===true,
    tErr || (t31?`cons=${t31.consultados} dlg=${t31.nDlg}`:'timeout'));
  chk('v7.31.0 · serviços tomados (1933) separados com "sim": 5.000 em Despesas › Outras + 45.000 nas Compras, ambos origem R',
    t31 && Math.abs(t31.dOut-5000)<0.01 && Math.abs(t31.cSem-45000)<0.01 && t31.ogD==='R' && t31.ogC==='R',
    tErr || (t31?`desp=${t31.dOut} comp=${t31.cSem}`:'—'));
  chk('v7.31.0 · com "não", os serviços ficam DE FORA: Despesas zeradas e só as mercadorias (45.000) nas Compras',
    t31 && !(+t31.dOut2) && Math.abs(t31.cSem2-45000)<0.01, tErr);
  chk('v7.31.0 · dashboard da compra exibe o crédito de IBS/CBS estimado (2033: normal cheio + Simples art. 58)',
    t31 && /Crédito de IBS\/CBS estimado/.test(t31.dashCred||''), tErr);
  chk('v7.31.0 · triagem de venda INFORMA a Reforma: PF 30.000 · Simples/MEI 10.000 · LR/LP 60.000 (próprio fora), com nota explicativa',
    t31 && t31.vpf===30000 && t31.vsim===10000 && t31.vlr===60000 && /Vendas preenchidas automaticamente/.test(t31.notaV||''),
    tErr || (t31?`pf=${t31.vpf} sim=${t31.vsim} lr=${t31.vlr}`:'—'));
  chk('v7.31.0 · campos de vendas já preenchidos NÃO são sobrescritos (informa sem aplicar)',
    t31 && t31.vpf2===1 && t31.aplic2===false, tErr);
  const t32 = await Promise.race([RES_T32, new Promise(r=>setTimeout(()=>r(null), 8000))]);
  const t32e = typeof t32==='string' ? t32 : '';
  chk('v7.32.0→v7.34.0 · analítico de compra vira ABA do painel 🚚 (painel aberto, aba ativa, rótulo ARQUIVO DE COMPRA, próprio fora, total 50.000)',
    t32 && t32.dsC && t32.dsC.analitico===true && t32.tipoAtivo==='compra' && t32.painel==='block'
      && /ARQUIVO DE COMPRA \(FORNECEDOR\)/.test(t32.emp) && t32.dsC.itens.length===2 && Math.abs(t32.dsC.totalRelatorio-50000)<0.01,
    t32e || (t32?`itens=${t32.dsC?t32.dsC.itens.length:'—'} painel=${t32.painel}`:'timeout'));
  chk('v7.32.0 · itens COMPARTILHADOS com a triagem (classe mudada na triagem reflete na aba do item 2)',
    t32 && t32.compartilhado==='mei', t32e);
  chk('v7.32.0→v7.34.0 · ações da aba de compra: salvar via triSalvar + "📥 Lançar total na análise" via foLancar POR CFOP (selo "gravada")',
    t32 && /triSalvar\('compra'\)/.test(t32.acoesC||'') && /foLancar\(\)/.test(t32.acoesC||'') && /por CFOP|CFOP/.test(t32.acoesC||'') && /gravada/.test(t32.acoesC||''), t32e);
  chk('v7.32.0 · aba de clientes: só PJ (PF e próprio fora), SEM botão de lançamento, com a nota informativa',
    t32 && t32.dsV && t32.dsVLen===1 && !/Lançar total/.test(t32.acoesV||'') && /não geram lançamento/.test(t32.acoesV||''), t32e);
  chk('v7.32.0 · "Reconsultar" do painel nas abas analíticas roteia para a consulta da triagem (CNPJ nulo consultado)',
    t32 && t32.nCons2===1 && t32.classeNova==='simples', t32e || (t32?`cons=${t32.nCons2}`:'—'));

  // ═══ 5u. v7.39.0 — projeção do ano (o parecer fala do ANO, não do pedaço lançado) ═══
  console.log('\n■ v7.39.0 — projeção dos meses não lançados');
  {
    const jn = (j,n) => vm.runInContext(`projJanelaN(${JSON.stringify(j)}, ${n})`, ctx);
    chk('janela "todos" usa os meses lançados; 2/3/6 usam a janela móvel',
      jn('todos',6)===6 && jn('3',6)===3 && jn('2',6)===2 && jn('6',6)===6);
    chk('janela maior que o lançado se limita ao que existe', jn('6',3)===3);
    chk('valor inválido cai no padrão', vm.runInContext("projJanelaNorm('xpto')", ctx)==='todos');

    // 6 meses de 100.000 + 6 vazios → projeção completa o ano com a média
    // rbt12Lanc = 0 de propósito: assim o RBT12 cresce com a própria receita do ano e a projeção
    // atravessa faixas — é justamente onde a regra de três erraria.
    const base = mk({ a1_semst: [300000,300000,300000,300000,300000,300000,0,0,0,0,0,0] }, 0);
    const P = vm.runInContext(`anProjetarAno(${JSON.stringify(base)}, 'todos')`, ctx);
    chk('projeta os 6 meses que faltam pela média dos 6 lançados',
      P && P.nReais===6 && P.nProj===6 && Math.abs(P.dados.receitas.a1_semst[11]-300000)<0.01,
      P?`reais=${P.nReais} proj=${P.nProj} dez=${P.dados.receitas.a1_semst[11]}`:'null');
    chk('a análise original NÃO é mutada', Math.abs(base.receitas.a1_semst[11])<0.01);

    const cheio = vm.runInContext(`(()=>{ const d = ${JSON.stringify(base)};
      for (let m=0;m<12;m++) d.receitas.a1_semst[m] = 100000; return anProjetarAno(d,'todos'); })()`, ctx);
    chk('ano com 12 meses lançados não gera projeção (não-regressão)', cheio===null);

    // progressividade: o motor precisa rodar sobre o ano projetado — regra de três erraria
    const prog = vm.runInContext(`(()=>{
      const d6 = ${JSON.stringify(base)};
      const r6 = calcular(d6, PARAMS.anexos, folhaPercDaEmpresa(d6.cfg));
      const P = anProjetarAno(d6,'todos');
      const r12 = calcular(P.dados, PARAMS.anexos, folhaPercDaEmpresa(P.dados.cfg));
      return { rec: r12.totais.receita/r6.totais.receita, das: r12.totais.simples/r6.totais.simples }; })()`, ctx);
    chk('receita dobra mas o Simples MAIS que dobra (progressividade do RBT12)',
      prog && Math.abs(prog.rec-2)<0.01 && prog.das > 2.0,
      prog?`receita ${prog.rec.toFixed(2)}× · Simples ${prog.das.toFixed(2)}×`:'—');
  }

  // ═══ 5v. v7.41.6 — empresa de destino na Consulta de CNPJ ═══
  console.log('\n■ v7.41.6 — empresa de destino declarada na importação');
  {
    vm.runInContext(`EMPRESAS = [{cnpj:'24197146000137',razao_social:'WEEEDO LTDA'},{cnpj:'00718661000157',razao_social:'OUTRA SA'}]`, ctx);
    chk('nome da empresa vem do cadastro, com ou sem pontuação',
      vm.runInContext("empNomeDe('24197146000137')", ctx)==='WEEEDO LTDA'
      && vm.runInContext("empNomeDe('24.197.146/0001-37')", ctx)==='WEEEDO LTDA');

    vm.runInContext("EMP_GLOBAL = {cnpj:'24197146000137', ano:2026}", ctx);
    const cab = vm.runInContext('empDestinoCabec()', ctx);
    chk('o diálogo de importação abre nomeando a empresa de destino',
      /WEEEDO LTDA/.test(cab) && /24\.197\.146\/0001-37/.test(cab) && /não diz de quem/.test(cab));
    vm.runInContext("EMP_GLOBAL = {cnpj:'', ano:null}", ctx);
    chk('sem empresa selecionada, o diálogo avisa em vez de seguir calado',
      /NENHUMA EMPRESA SELECIONADA/.test(vm.runInContext('empDestinoCabec()', ctx)));

    // o cnpjEmpresa é carimbado na IMPORTAÇÃO: gravar depois de trocar escreveria no CNPJ antigo
    vm.runInContext("EMP_GLOBAL = {cnpj:'00718661000157', ano:2026}", ctx);
    chk('gravar analítico em empresa diferente da importada é BLOQUEADO',
      vm.runInContext("triDonoConfere({cnpjEmpresa:'24197146000137'}, true)", ctx)===false);
    chk('mesma empresa (mesmo com formatação diferente) grava normalmente',
      vm.runInContext("triDonoConfere({cnpjEmpresa:'00.718.661/0001-57'}, true)", ctx)===true);

    vm.runInContext("FOT = {servico:null,revenda:null,compra:null,venda:null}; TRI = {compra:null,venda:null}", ctx);
    chk('tela vazia não acusa pendência', vm.runInContext('fornPendente()', ctx)===false);
    vm.runInContext("TRI.compra = {cnpjEmpresa:'24197146000137', _salvo:null}", ctx);
    chk('analítico não gravado acusa pendência e identifica o dono',
      vm.runInContext('fornPendente()', ctx)===true && vm.runInContext('fornDono()', ctx)==='24197146000137');
    vm.runInContext("FOT = {servico:null,revenda:null,compra:null,venda:null}; TRI = {compra:null,venda:null}", ctx);

    chk('trocar a empresa na página cnpj recarrega a análise e limpa a tela',
      /else if \(p==='cnpj'\) await fornTrocarEmpresa\(\)/.test(html)
      && /async function fornTrocarEmpresa\(\)\{[\s\S]{0,120}await anTrocarEmpresa\(\)/.test(html)
      && /fornZerar\(\);/.test(html));
    chk('faixa de destino fica fixa na tela da Consulta de CNPJ', html.includes('id="fo-destino"'));
  }

  // ═══ 5w. v7.41.7 — ano de referência, premissa do crédito e memória da projeção ═══
  console.log('\n■ v7.41.7 — ano de referência do parecer e premissa do crédito');
  {
    vm.runInContext('PAR_ANO_REF_DOC = null', ctx);
    chk('padrão do ano de referência é 2027 (primeiro ano da transição)',
      vm.runInContext('parAnoRefEfetivo({}).v', ctx)===2027);
    chk('configuração da empresa vence o padrão',
      vm.runInContext('parAnoRefEfetivo({anoRefParecer:2033}).v', ctx)===2033);
    vm.runInContext('PAR_ANO_REF_DOC = 2031', ctx);
    chk('escolha do documento vence a da empresa',
      vm.runInContext('parAnoRefEfetivo({anoRefParecer:2033}).v', ctx)===2031
      && vm.runInContext('parAnoRefEfetivo({}).origem', ctx)==='documento');
    vm.runInContext('PAR_ANO_REF_DOC = null', ctx);
    chk('ano fora da lista é rejeitado e cai no padrão',
      vm.runInContext('parAnoRefNorm(2050)', ctx)===2027 && vm.runInContext("parAnoRefNorm('abc')", ctx)===2027);
    chk('"modelo pleno" só é dito de 2033',
      vm.runInContext('parAnoRefRotulo(2033)', ctx)==='modelo pleno'
      && vm.runInContext('parAnoRefRotulo(2027)', ctx)==='transição');

    chk('o parecer não fixa mais 2033: cenário e "por dentro" seguem o ano escolhido',
      /REF\.find\(l=>l\.ano===anoRef\)/.test(html) && /anos\.findIndex\(l=>l\.ano===anoRef\)/.test(html)
      && !/D\.sDentro\[D\.sDentro\.length-1\]/.test(html));
    chk('o ano escolhido é IMPRESSO no documento (título, quadro, jornada e alíquota)',
      /três caminhos do Simples em '\+D\.anoRef/.test(html) && /Cenário em \$\{D\.anoRef\}/.test(html)
      && /pp-jet">\$\{D\.anoRef\}/.test(html) && /Alíquota de referência \(\$\{D\.anoRef\}\)/.test(html));
    chk('payload da IA leva anoReferencia e mantém a chave antiga da Edge Function',
      /anoReferencia: D\.anoRef/.test(html) && /cenarios2033:/.test(html));

    // premissa do crédito: ausência de DADO não é ausência de DIREITO
    vm.runInContext('RL.forn = null', ctx);
    const semNada = vm.runInContext("premissaCreditoIBS({anoRef:2027, cen:{semCreditos:true, rfx:{contra:{}}}})", ctx);
    chk('sem compras informadas, a premissa não afirma inexistência de direito a crédito',
      /não por inexistência de direito/.test(semNada) && /art\. 58/.test(semNada));
    const comSM = vm.runInContext("premissaCreditoIBS({anoRef:2027, cen:{semCreditos:false, rfx:{contra:{compras_simples:100000}}}})", ctx);
    chk('com compras do Simples/MEI, declara o crédito simplificado e o quantifica (0,62% em 2027)',
      /crédito simplificado/.test(comSM) && /R\$ 620,00/.test(comSM) && !/sem crédito/i.test(comSM));
    const manual = vm.runInContext("premissaCreditoIBS({anoRef:2033, cen:{semCreditos:false, rfx:{contra:{compras_simples:100000}, credSimplesPct:27.91}}})", ctx);
    chk('percentual manual (fornecedor no regime regular) prevalece sobre o art. 58',
      /percentual informado/.test(manual) && /R\$ 27\.910,00/.test(manual));

    vm.runInContext(`RL.forn = { compra: { consultado_em:'2026-08-01T12:00:00Z', dados:{ itens:[
      {classe:'mei', valor:50000}, {classe:'simples', valor:30000},
      {classe:'normal', valor:20000}, {classe:'proprio', valor:9999} ] } } }`, ctx);
    const fx = vm.runInContext('fornComprasSimplesMEI()', ctx);
    chk('a consulta de fornecedores soma MEI+Simples e exclui movimentação própria',
      fx && Math.abs(fx.soma-80000)<0.01 && Math.abs(fx.mei-50000)<0.01 && Math.abs(fx.tot-100000)<0.01,
      fx?`soma=${fx.soma} mei=${fx.mei}`:'null');
    const alerta = vm.runInContext("premissaCreditoIBS({anoRef:2027, cen:{semCreditos:true, rfx:{contra:{}}}})", ctx);
    chk('havendo fornecedores MEI/Simples conhecidos, a premissa quantifica e manda aplicar na Reforma',
      /R\$ 80\.000,00/.test(alerta) && /MEI R\$ 50\.000,00/.test(alerta) && /Aplique a consulta na aba Reforma/.test(alerta));
    vm.runInContext('RL.forn = null', ctx);

    chk('memória de cálculo da projeção entra na conferência (modo anual e modo mês)',
      /rlConfSublimite\(\) \+ rlConfProjecao\(\)/.test(html) && /return h \+ rlConfProjecao\(\)/.test(html));
    chk('sem análise carregada, a memória da projeção não quebra a tela',
      vm.runInContext("(()=>{ const s = RL.dados; RL.dados = null; const r = rlConfProjecao(); RL.dados = s; return r; })()", ctx)==='');
  }


  // ═══ 5x. v7.41.8 — a folha da TELA tem de ter a largura do PAPEL ═══
  // Esta é a regressão mais cara da história do parecer: o empacotador mede na tela, e enquanto a
  // .pp-page não tinha largura fixa (ocupava o .main, ~313mm) o texto quebrava em ~1,6× menos
  // linhas do que no papel (174mm úteis). A altura impressa era subestimada e o conteúdo saía
  // CORTADO pelo overflow:hidden, sem aviso. Voltou três vezes tratando sintoma. Guarda aqui.
  console.log('\n■ v7.41.8 — medição do parecer só vale com a folha na largura do papel');
  {
    const cssTela = (html.match(/\.pp-page\{[^}]*\}/) || [''])[0];
    chk('v7.41.8 · .pp-page tem largura fixa de 210mm também NA TELA (sem isso a medição mente)',
      /width:210mm/.test(cssTela) && /box-sizing:border-box/.test(cssTela),
      cssTela ? cssTela.slice(0, 90) + '…' : 'regra .pp-page não encontrada');
    chk('v7.41.8 · a impressão segue forçando 210mm (a regra antiga continua)',
      /\.pp-page\{[^}]*width:210mm/.test(html.slice(html.indexOf('@media print'))));
    const reserva = vm.runInContext('typeof PP_RESERVA_MM !== "undefined" ? PP_RESERVA_MM : 0', ctx);
    chk('v7.41.8 · reserva de folha em pelo menos 10mm', reserva >= 10, 'reserva = ' + reserva + 'mm');
    chk('v7.41.8 · a régua vigia a própria premissa (ppLarguraFolha) e avisa quando a largura foge',
      /function ppLarguraFolha\(/.test(html) && /Medição não confiável/.test(html));
    chk('v7.41.8 · o empacotador continua rodando DEPOIS dos gráficos (lição da v7.40.2)',
      html.indexOf('ppEmpacotarDOM($id(\'rl-corpo\'))') > html.indexOf("rlChart('pc-acum'"));
  }

  // ═══ 5x · v7.44.0 — a Configuração nunca mais abre em branco ═══
  console.log('\n■ v7.44.0 — guarda do AN na tela de Configuração');
  {
    const iGuarda = html.indexOf("if (page==='importar' || page==='config') { if (!AN) AN = anNovo(");
    const iRender = html.indexOf("if (page==='config') anRenderConfig();");
    chk('v7.44.0 · no go(), a guarda do AN nulo vem ANTES do anRenderConfig (era depois — Configuração em branco)',
      iGuarda > -1 && iRender > -1 && iGuarda < iRender);
    chk('v7.44.0 · o próprio anRenderConfig cria a análise se ela faltar (guarda defensiva na entrada)',
      /function anRenderConfig\(\) \{\s*\n\s*if \(!AN\) AN = anNovo\(/.test(html));
    chk('v7.44.0 · anTrocarEmpresa redesenha a Configuração após a carga do banco (3 saídas cobertas)',
      (html.match(/if \(APP\.page==='config'\) anRenderConfig\(\);/g) || []).length >= 3);
    chk('v7.44.0 · versão e changelog registrados (badge sai do APP_VERSAO desde a v7.43.2)',
      html.includes('<b>v7.44.0</b>') && html.includes('setup_v7440.sql') && html.includes('setup_v7450.sql'));
  }

  // ═══ 5z. v7.44.1 — limpeza dos resíduos achados pela varredura estática ═══
  // Cada um destes elementos existia no HTML sem nenhum código que o alcançasse.
  // O teste é de AUSÊNCIA: se voltarem, é regressão.
  console.log('\n■ v7.44.1 — resíduos removidos (e os que NÃO podem sumir)');
  {
    chk('v7.44.1 · fornLancarDespesas removida (o lançamento é do foLancar, por CFOP)',
      !/function fornLancarDespesas/.test(html) && !/fornLancarDespesas\(\)/.test(html));
    chk('v7.44.1 · o botão fo-desp, que nunca era exibido, saiu do HTML',
      !/id="fo-desp"/.test(html));
    chk('v7.44.1 · a div vazia rf-forn-nota saiu (a nota do art. 58 é montada em outro ponto)',
      !/id="rf-forn-nota"/.test(html) && /art\. 58/.test(html));
    // Guarda contra excesso de zelo. Estes PARECEM órfãos numa busca por texto literal,
    // mas NÃO são: tri-dash-* e tri-prog-* são acessados por id montado em runtime
    // ($id('tri-dash-'+t)); fo-aba-* idem; e tri-arq-compra/venda estão sob o teste
    // deliberado da v7.33.0, que exige a presença deles DENTRO do item 2 — foram
    // avaliados na v7.44.1 e MANTIDOS por essa razão. Apagar qualquer um é regressão.
    for (const id of ['tri-dash-compra','tri-dash-venda','tri-prog-compra','tri-prog-venda',
                      'fo-aba-compra','fo-aba-venda','fo-aba-totais','fo-abas',
                      'tri-arq-compra','tri-arq-venda'])
      chk(`v7.44.1 · ${id} PERMANECE (não é resíduo — runtime ou guard da v7.33.0)`,
        new RegExp('id="' + id + '"').test(html));
    chk('v7.44.1 · changelog registrado', html.includes('<b>v7.44.1</b>'));

    // ═══ v7.45.0 — os 6 itens da especificação do recomeço ═══
    // (1) limpar preserva config
    chk('v7.45.0 · item 1 — limpar dados PRESERVA a configuração (regrava cfg)',
      /_cfgPreserv/.test(html) && /AN\.cfg = _cfgPreserv/.test(html) && /PRESERVA a CONFIGURA/.test(html));
    // (2) dedução do ISS da configuração — prova funcional
    {
      const anNovo=vm.runInContext('anNovo',ctx), calcular=vm.runInContext('calcular',ctx),
            calcCen=vm.runInContext('calcCenariosReforma',ctx), P=vm.runInContext('PARAMS',ctx);
      const inp=anNovo('55339991000123',2026);
      for(let m=0;m<12;m++) inp.receitas.a3_semret[m]=10000;
      inp.cfg.iss=.05;                                  // ISS 5% na CONFIGURAÇÃO
      const res=calcular(inp,P.anexos,P.folha), C=calcCen(res,null);
      const issAno=res.meses.reduce((s,M)=>s+(+M.lp.iss||0),0);
      const L27=C.REF.find(l=>l.ano===2027), L26=C.REF.find(l=>l.ano===2026), L33=C.REF.find(l=>l.ano===2033);
      chk('v7.45.0 · item 2 — ISS da configuração apurado (120.000 × 5% = 6.000/ano)',
        Math.abs(issAno-6000)<0.01);
      chk('v7.45.0 · item 2 — 2027: dedução = ISS da config × 100% remanescente, e o débito cai',
        Math.abs((L27.ded||0)-6000)<0.01 && Math.abs(L27.deb - (120000-6000)*L27.alq)<0.01);
      chk('v7.45.0 · item 2 — 2026 sem dedução (a regra vale de 2027 em diante)',
        Math.abs(L26.ded||0)<0.01);
      chk('v7.45.0 · item 2 — 2033: ISS extinto, dedução ZERO e débito volta ao cheio',
        Math.abs(L33.ded||0)<0.01 && Math.abs(L33.deb - 120000*L33.alq)<0.01);
      // (5) crédito único aba = cenários
      const rfCE=vm.runInContext('rfContraEfetivo',ctx);
      const ce=rfCE({contra:{}}, res.totais);
      chk('v7.45.0 · item 5 — rfContraEfetivo é a base de crédito ÚNICA (proxy A5 compartilhado)',
        typeof rfCE==='function' && ce && typeof ce.proxy==='boolean');
      chk('v7.45.0 · item 5 — a aba usa a mesma função (RFX = RF com contra efetivo)',
        /const _ce = rfContraEfetivo\(RF, _T\)/.test(html) && /rfLinhaBase\(RFX, a, _dedIss \+ _dedIcms\)/.test(html));
    }
    // (3) cancelamento nos importadores
    for (const fn of ['pgdasLer','demLer','folhaLerRelacao','fatLer','balLer']){
      const i = html.indexOf('function ' + fn + '(');
      chk(`v7.45.0 · item 3 — ${fn} tem faixa de progresso com Cancelar`,
        i > 0 && /IMP_CANCELAR/.test(html.slice(i, i + 2600)) && /impProgresso\(/.test(html.slice(i, i + 2600)));
    }
    chk('v7.45.0 · item 3 — xmlLer e triConsultar seguem cobertos (v7.43.0 não regrediu)',
      (html.match(/IMP_CANCELAR/g) || []).length >= 16);
    // (4) o rótulo REAL da declaração da WENDEL classifica certo
    {
      const pb=vm.runInContext('pgdasBloco',ctx);
      const rotWendel='Prestação de Serviços, exceto para o exterior - Não sujeitos ao fator “r” e tributados pelo Anexo III, sem retenção/substituição tributária de ISS, com ISS devido a outro(s) Município(s)';
      chk('v7.45.0 · item 4 — rótulo da WENDEL: Anexo III SEM retenção → a3_semret (era a3_retiss)',
        pb(rotWendel)==='a3_semret');
      chk('v7.45.0 · item 4 — "NÃO sujeitos ao fator r" não cai no Anexo V',
        pb(rotWendel)!=='a5r');
      chk('v7.45.0 · item 4 — COM retenção continua indo para a3_retiss',
        pb('Prestação de serviços, exceto para o exterior - Com retenção/substituição tributária de ISS')==='a3_retiss');
      chk('v7.45.0 · item 4 — revenda interna sem ST segue em a1_semst',
        pb('Revenda de mercadorias, exceto para o exterior - Sem substituição tributária/tributação monofásica/antecipação com encerramento de tributação (o substituto tributário do ICMS deve utilizar essa opção)')==='a1_semst');
      chk('v7.45.0 · item 4 — rótulo desconhecido devolve null e o Aplicar BLOQUEIA',
        pb('Atividade inventada que não existe')===null && /IMPORTAÇÃO BLOQUEADA/.test(html));
    }
    // (6) relatórios = sistema
    chk('v7.45.0 · item 6 — relatório Reforma lê calcCenariosReforma (fim da fórmula paralela)',
      /FIM DA FÓRMULA PARALELA/.test(html) && !/let deb = recCheia\*alq/.test(html));
    chk('v7.45.0 · item 6 — memória imprime "(−) ISS que não integra a base" e fecha (base − ded) × alíquota',
      /ISS que não integra a base/.test(html));
    chk('v7.45.0 · changelog registrado', html.includes('<b>v7.45.0</b>'));

    // ═══ v7.46.0 — BASE ÚNICA da Reforma: parecer = conferência = relatório, ao centavo ═══
    {
      const anNovo=vm.runInContext('anNovo',ctx), calcular=vm.runInContext('calcular',ctx),
            calcCen=vm.runInContext('calcCenariosReforma',ctx), P=vm.runInContext('PARAMS',ctx),
            rlBase=vm.runInContext('rlBaseReforma',ctx), RLg=vm.runInContext('RL',ctx);
      const _bk = { dados:RLg.dados, res:RLg.res, reforma:RLg.reforma };
      // ano PARCIAL: 6 meses de 10.000 → projeção dobra (k = 2)
      const inp=anNovo('11222333000181',2026);
      for(let m=0;m<6;m++) inp.receitas.a3_semret[m]=10000;
      inp.cfg.iss=.04; inp.cfg.projJanela='todos';
      const res=calcular(inp,P.anexos,P.folha);
      RLg.dados=inp; RLg.res=res;
      RLg.reforma={ receita:60000, baseIS:0, credSimplesPct:0, benefRec:{}, benefCred:{}, contra:{ compras_lrlp:12000 } };
      const B=rlBase();
      chk('v7.46.0 · rlBaseReforma projeta a ANÁLISE (6 meses de 10.000 → ano de 120.000, k = 2)',
        B.proj && Math.abs(B.k-2)<0.001 && Math.abs(B.res.totais.receita-120000)<0.01);
      chk('v7.46.0 · rlBaseReforma projeta a ABA REFORMA JUNTO (receita 60.000→120.000, crédito 12.000→24.000)',
        Math.abs((+B.reforma.receita)-120000)<0.01 && Math.abs((+B.reforma.contra.compras_lrlp)-24000)<0.01);
      const C1=calcCen(B.res,B.reforma), C0=calcCen(res,RLg.reforma);
      const c27=C1.REF.find(l=>l.ano===2027), s27=C0.REF.find(l=>l.ano===2027);
      chk('v7.46.0 · a divergência que existia é REAL e mensurável (aba crua daria metade do crédito)',
        Math.abs(c27.cred - 2*s27.cred) < 0.02 && c27.deb > s27.deb);
      // ano COMPLETO: 12 meses → realizado puro, nada se move
      const inp2=anNovo('11222333000181',2026);
      for(let m=0;m<12;m++) inp2.receitas.a3_semret[m]=10000;
      const res2=calcular(inp2,P.anexos,P.folha);
      RLg.dados=inp2; RLg.res=res2;
      const B2=rlBase();
      chk('v7.46.0 · ano COMPLETO: base única devolve o realizado puro (k = 1, sem projeção)',
        !B2.proj && Math.abs(B2.k-1)<1e-9 && B2.res===res2 && B2.reforma===RLg.reforma);
      RLg.dados=_bk.dados; RLg.res=_bk.res; RLg.reforma=_bk.reforma;   // restaura o estado da suíte
    }
    chk('v7.46.0 · parecer, conferência e relatório Reforma leem a BASE ÚNICA (3 consumidores)',
      (html.match(/rlBaseReforma\(\)/g)||[]).length >= 4 && /const _B = rlBaseReforma\(\)/.test(html) && /calcCenariosReforma\(_B2\.res, _B2\.reforma\)/.test(html) && /calcCenariosReforma\(R, _B\.reforma\)/.test(html));
    chk('v7.46.0 · a memória da conferência DECLARA o fator k na abertura do quadro',
      /entra PROJETADA pelo fator k =/.test(html));
    chk('v7.46.0 · a conferência contra o DAS declarado segue no REALIZADO (decisão 5.3)',
      !/rlConfDivergencias[\s\S]{0,400}rlBaseReforma/.test(html));
    // v7.56.3 · o relatório parte da análise GRAVADA; a tela pode estar à frente e isso era mudo.
    chk('v7.56.3 · rlCarregar compara a análise gravada com a aberta na tela',
      /RL\.defasado = null;/.test(html) && /chave\(dados\) !== chave\(AN\)/.test(html));
    chk('v7.56.3 · a faixa de defasagem entra no topo de TODOS os relatórios',
      (html.match(/rlAvisoDefasado\(\)/g) || []).length >= 3
      && /function rlSalvarERecarregar\(\)/.test(html));
    // v7.56.4 · type="month" em pt-BR desenha mm/aaaa; digitar "2025-06" grava fevereiro/2025.
    {
      const ipe = vm.runInContext('iniPorExtenso', ctx);
      chk('v7.56.4 · o campo devolve o mês por extenso',
        /junho de 2025/.test(ipe('2025-06')) && /fevereiro de 2025/.test(ipe('2025-02')));
      chk('v7.56.4 · valor vazio ou inválido não imprime nada',
        ipe('') === '' && ipe('lixo') === '' && ipe('2025-13') === '');
      const jan = vm.runInContext('rlConfJanelas', ctx)({ cfg:{ ano:2026, inicioAtividade:'2025-06',
        rbt12Lanc:[0,0,0,0,0,11931.14,18357.3,18357.3,18357.3,18357.3,18357.3,18357.32], folha12Lanc:Array(12).fill(0) } });
      chk('v7.56.4 · o quadro das janelas nomeia o mês declarado', /junho de 2025/.test(jan), '—');
    }
    // v7.56.5 · auditoria externa: a fórmula EXIBIDA da RBT12p tem de reproduzir o resultado.
    {
      const anNovo = vm.runInContext('anNovo', ctx), calcular = vm.runInContext('calcular', ctx);
      const ANX2 = vm.runInContext('ANEXOS_DEFAULT', ctx), FP2 = vm.runInContext('FOLHA_PERC_DEFAULT', ctx);
      const calc = i => calcular(JSON.parse(JSON.stringify(i)), JSON.parse(JSON.stringify(ANX2)), Object.assign({}, FP2));
      const perto = (x, y) => Math.abs((+x||0) - (+y||0)) <= 0.02;
      const iK = anNovo('61106836000160', 2026); iK.cfg.iss = .05; iK.cfg.inicioAtividade = '2025-06';
      const jK = 11931.14, r6 = (122074.96 - jK) / 6;
      iK.cfg.rbt12Lanc = [0,0,0,0,0,jK,r6,r6,r6,r6,r6,r6];
      for (const k of Object.keys(iK.receitas)) iK.receitas[k] = Array(12).fill(0);
      iK.receitas.a4 = [18535.50,19285.21,1800,23600,13048,9338,0,0,0,0,0,0];
      const rK = calc(iK);
      chk('v7.56.5 · o numerador exibido é a soma dos meses ANTERIORES, sem o mês apurado',
        perto(rK.meses[0].somaAntProp, 122074.96) && rK.meses[0].nAntProp === 7,
        'numerador=' + (rK.meses[0].somaAntProp||0).toFixed(2));
      const reproduz = rK.meses.slice(0,5).every(M => !M.rbt12Prop
        || Math.abs(M.somaAntProp / M.nAntProp * 12 - M.rbt12) < 0.005);
      chk('v7.56.5 · a fórmula exibida REPRODUZ o RBT12 impresso, em todos os meses', reproduz);
    }
    // ── v7.56.7 · campo de uma tela não pode reescrever a configuração inteira ──
    chk('v7.56.7 · o campo de início de atividade grava só o próprio campo',
      /onchange="anSetInicioAtividade\(this\.value\)"/.test(html)
      && /function anSetInicioAtividade\(v\)\{/.test(html)
      && !/id="cf-inicio"[^>]*anAplicarConfig/.test(html));
    {
      // com um cf-iss REMANESCENTE e vazio no DOM, a alíquota não pode ser derrubada
      const anSet = vm.runInContext('anSetInicioAtividade', ctx);
      vm.runInContext("AN = anNovo('61106836000160', 2026); AN.cfg.iss = .05;", ctx);
      ctx.document.getElementById('cf-iss')._v = '';        // campo velho, vazio
      try { anSet('2025-06'); } catch(e) {}
      chk('v7.56.7 · e não derruba a alíquota de ISS mesmo com campo velho no DOM',
        Math.abs(vm.runInContext('AN.cfg.iss', ctx) - .05) < 1e-9
        && vm.runInContext('AN.cfg.inicioAtividade', ctx) === '2025-06',
        'iss=' + vm.runInContext('AN.cfg.iss', ctx));
    }
    // ── v7.56.8 · alteração de campo não redesenha a tela em que o campo vive ──
    {   // o corpo da função, delimitado pela próxima declaração, não pode redesenhar a grade
      const i0 = html.indexOf('function anSetInicioAtividade(v){');
      const corpo = html.slice(i0, html.indexOf('\nfunction ', i0 + 10))
        .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');   // comentários explicam o defeito; não são código
      chk('v7.56.8 · anSetInicioAtividade não redesenha a grade',
        i0 > 0 && !/anRenderGrid\(\)/.test(corpo) && corpo.includes('anRecalcular()'));
    }
    chk('v7.56.8 · e atualiza o texto de apoio no lugar, por id próprio',
      /id="cf-inicio-ext"/.test(html) && /id="cf-inicio-aviso"/.test(html)
      && /\$id\('cf-inicio-ext'\)/.test(html) && /\$id\('cf-inicio-aviso'\)/.test(html));
    {
      vm.runInContext("AN = anNovo('61106836000160', 2026); AN.cfg.iss = .05;", ctx);
      const antes = ctx.document.getElementById('cf-inicio');
      vm.runInContext('anSetInicioAtividade', ctx)('2025-06');
      chk('v7.56.8 · o campo sobrevive ao evento (mesmo elemento, valor e ISS preservados)',
        ctx.document.getElementById('cf-inicio') === antes
        && vm.runInContext('AN.cfg.inicioAtividade', ctx) === '2025-06'
        && Math.abs(vm.runInContext('AN.cfg.iss', ctx) - .05) < 1e-9);
    }
    // ── v7.56.9 · ano parcial do type="month" não pode ser gravado ──
    {
      vm.runInContext("AN = anNovo('61106836000160', 2026); AN.cfg.iss = .05; AN.cfg.inicioAtividade='';", ctx);
      const set = vm.runInContext('anSetInicioAtividade', ctx);
      set('0020-05');
      chk('v7.56.9 · ano pela metade (0020) NÃO é gravado', vm.runInContext('AN.cfg.inicioAtividade', ctx) === '');
      set('0202-05');
      chk('v7.56.9 · nem um ano implausível (0202)', vm.runInContext('AN.cfg.inicioAtividade', ctx) === '');
      set('2025-05');
      chk('v7.56.9 · e o ano completo é aceito', vm.runInContext('AN.cfg.inicioAtividade', ctx) === '2025-05');
      chk('v7.56.9 · a alíquota de ISS segue intacta em todo o percurso',
        Math.abs(vm.runInContext('AN.cfg.iss', ctx) - .05) < 1e-9);
    }
    {   // gravação de rede não pode estar no caminho da tecla, e o recálculo tem de existir
      const i1 = html.indexOf('function anSetInicioAtividade(v){');
      const c1 = html.slice(i1, html.indexOf('\nfunction ', i1 + 10))
        .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
      chk('v7.56.9 · o campo não dispara gravação no banco a cada evento', !/anSalvarAuto\(\)/.test(c1));
      chk('v7.56.9 · e chama anRecalcular(), que existe — anCalcular() nunca existiu',
        c1.includes('anRecalcular()') && !c1.replace(/anRecalcular\(\)/g, '').includes('anCalcular()')
        && /function anRecalcular\s*\(/.test(html) && !/function anCalcular\s*\(/.test(html));
    }
    // ── v7.56.10 · data GRAVADA inválida é denunciada, não ignorada em silêncio ──
    {
      const av = vm.runInContext('iniAvisoInvalido', ctx);
      const val = vm.runInContext('iniAtividadeValido', ctx);
      chk('v7.56.10 · ano fora de faixa é reconhecido como inválido',
        val('0020-05', 2026).ok === false && val('0202-05', 2026).ok === false
        && val('2025-06', 2026).ok === true && val('', 2026).ok === false);
      chk('v7.56.10 · e a tela denuncia o valor gravado, nomeando-o',
        /0020-05/.test(av({ inicioAtividade:'0020-05' }, 2026))
        && /não está sendo proporcionalizado/.test(av({ inicioAtividade:'0020-05' }, 2026)));
      chk('v7.56.10 · data válida ou campo vazio não geram alarme',
        av({ inicioAtividade:'2025-06' }, 2026) === '' && av({ inicioAtividade:'' }, 2026) === '');
      chk('v7.56.10 · o alarme aparece na aba RBT12 e no bloco 0 da conferência',
        (html.match(/iniAvisoInvalido\(/g) || []).length >= 4);
      // percurso REAL do usuário: renderiza a aba, dispara o evento, confere o resultado
      vm.runInContext("AN = anNovo('61106836000160', 2026); AN.cfg.iss = .05; AN.cfg.inicioAtividade='';", ctx);
      const setI = vm.runInContext('anSetInicioAtividade', ctx);
      setI('0020-05'); setI('0202-05'); setI('2025-06');
      chk('v7.56.10 · percurso completo de digitação termina com a data certa e o ISS intacto',
        vm.runInContext('AN.cfg.inicioAtividade', ctx) === '2025-06'
        && Math.abs(vm.runInContext('AN.cfg.iss', ctx) - .05) < 1e-9);
    }
    // ── v7.56.11 · os alarmes têm de chegar ao Resultado mês a mês, e o card tem de aparecer ──
    {
      const av = vm.runInContext('anAvisoConfig', ctx);
      const el = ctx.document.getElementById('an-cfg-aviso');
      vm.runInContext("AN = anNovo('61106836000160', 2026); AN.cfg.iss = .05; AN.cfg.inicioAtividade = '0020-05'; RL = { dados:null };", ctx);
      av();
      chk('v7.56.11 · o alarme da data inválida aparece no Resultado mês a mês',
        /0020-05/.test(el.innerHTML) && el.style.display === 'block');
      vm.runInContext("AN.cfg.inicioAtividade = '2025-06'; RL = { dados: JSON.parse(JSON.stringify(AN)) }; RL.dados.cfg.iss = .02;", ctx);
      av();
      chk('v7.56.11 · e a tela declara quando difere da análise gravada',
        /análises diferentes/.test(el.innerHTML) && /cfg/.test(el.innerHTML));
      vm.runInContext("RL = { dados: JSON.parse(JSON.stringify(AN)) };", ctx);
      av();
      chk('v7.56.11 · sem divergência e com dados completos, o card fica oculto',
        el.style.display === 'none' || !/análises diferentes|0020-05/.test(el.innerHTML));
    }
    // ── v7.56.12 · guarda ESTRUTURAL: a memória mensal não lê a análise crua ──
    {
      const i2 = html.indexOf('  for (const m of meses){');
      const b2 = html.slice(i2, html.indexOf('function lrLinhasConfMes', i2));
      const sobrou = (b2.match(/\bD\.(receitas|folha|compras|despesas|icms|ipi|folha13)\b/g) || []);
      chk('v7.56.12 · nenhuma leitura por mês na memória sai da análise crua (D)',
        sobrou.length === 0, sobrou.join(' · '));
      chk('v7.56.12 · e as que existem saem de Dm (a análise que produziu o resultado)',
        /Dm\.receitas\.fin/.test(b2) && /Dm\.compras\.semst/.test(b2)
        && /Dm\.despesas\.credLR/.test(b2) && /Dm\.folha\.salarios/.test(b2));
    }
    // ── v7.56.13 · trava de 5% do ISS (LC 123, art. 18, § 16) ──
    {
      const anNovo = vm.runInContext('anNovo', ctx), calcular = vm.runInContext('calcular', ctx);
      const AX3 = vm.runInContext('ANEXOS_DEFAULT', ctx), FP3 = vm.runInContext('FOLHA_PERC_DEFAULT', ctx);
      const calc = i => calcular(JSON.parse(JSON.stringify(i)), JSON.parse(JSON.stringify(AX3)), Object.assign({}, FP3));
      const mk = (rbt, rec) => { const i = anNovo('07894691000163', 2026); i.cfg.iss = .03;
        i.cfg.rbt12Lanc = Array(12).fill(rbt/12);
        for (const k of Object.keys(i.receitas)) i.receitas[k] = Array(12).fill(0);
        i.receitas.a3_semret = [rec,0,0,0,0,0,0,0,0,0,0,0];
        return calc(i).meses[0]; };
      const alta = mk(2226781.38, 44771.73), baixa = mk(900000, 44771.73);
      chk('v7.56.13 · acima de 14,92537% de efetiva o ISS é travado em 5% da receita',
        Math.abs(alta.dasTrib.iss - 44771.73*0.05) < 0.02,
        'ISS=' + alta.dasTrib.iss.toFixed(2) + ' teto=' + (44771.73*0.05).toFixed(2));
      chk('v7.56.13 · e o DAS total NÃO muda — só a repartição',
        Math.abs(Object.values(alta.dasTrib).reduce((a,b)=>a+b,0) - alta.das) < 0.02);
      chk('v7.56.13 · abaixo do ponto de corte a trava não incide',
        alta.dasTrib.iss/44771.73 <= 0.0500001 && baixa.dasTrib.iss/44771.73 < 0.05 - 1e-6,
        'faixa4 = ' + (baixa.dasTrib.iss/44771.73*100).toFixed(4) + '%');
      chk('v7.56.13 · a trava é aplicada DEPOIS da renormalização de icms/iss',
        html.indexOf('TRAVA DE 5% NA PARCELA DE ISS') > html.indexOf('const _resto = (das + subIcms + subIss)'));
      chk('v7.56.13 · e consta das divergências declaradas',
        /Trava de 5% do ISS/.test(vm.runInContext('rlConfDivergencias', ctx)()));
    }
    // ── M1 · v7.57.0 · segurança C1: guarda de papel nas ações destrutivas ──
    {
      const AC = vm.runInContext('ACOES_ADMIN', ctx);
      const alvos = ['usCriar','usEditar','usExcluir','usTrocarPapel','usSenhaMenu','empExcluir','anLimparDados'];
      chk('v7.57.0 · as sete ações destrutivas estão declaradas como privativas de admin',
        alvos.every(f => !!AC[f]), Object.keys(AC).join(' · '));
      chk('v7.57.0 · e cada uma chama exigirAdmin() na primeira linha',
        alvos.every(f => new RegExp('function ' + f + '\\([^)]*\\)\\s*\\{\\s*\\n\\s*if \\(!exigirAdmin\\(.' + f + '.\\)\\) return;').test(html)));
      const ex = vm.runInContext('exigirAdmin', ctx);
      vm.runInContext("APP.papel = 'operador';", ctx);
      chk('v7.57.0 · operador é barrado', ex('usExcluir') === false);
      vm.runInContext("APP.papel = 'admin';", ctx);
      chk('v7.57.0 · admin passa', ex('usExcluir') === true);
      vm.runInContext("APP.papel = null;", ctx);
      chk('v7.57.0 · papel ausente é tratado como operador (falha para o lado restritivo)',
        ex('empExcluir') === false);
      vm.runInContext("APP.papel = 'admin';", ctx);
    }
    // ── M2 · v7.58.0 · impedimento por ultrapassagem do sublimite ──
    {
      const anNovo2 = vm.runInContext('anNovo', ctx), calcular2 = vm.runInContext('calcular', ctx);
      const AX4 = vm.runInContext('ANEXOS_DEFAULT', ctx), FP4 = vm.runInContext('FOLHA_PERC_DEFAULT', ctx);
      const c4 = i => calcular2(JSON.parse(JSON.stringify(i)), JSON.parse(JSON.stringify(AX4)), Object.assign({}, FP4));
      const mkI = mensal => { const i = anNovo2('11222333000181', 2026);
        i.cfg.iss = .02; i.cfg.icmsV = .12; i.cfg.icmsC = .12; i.cfg.rbt12Lanc = Array(12).fill(300000);
        for (const k of Object.keys(i.receitas)) i.receitas[k] = Array(12).fill(0);
        i.receitas.a1_semst = Array(12).fill(mensal); return c4(i); };
      const alto = mkI(700000);   // 8,4 mi/ano — cruza 3,6 × 1,2 = 4,32 mi
      const baixo = mkI(200000);  // 2,4 mi/ano — nunca cruza
      chk('v7.58.0 · M2 · impedimento começa no mês SEGUINTE ao da ultrapassagem de 20%',
        alto.impedimento && alto.impedimento.desde === 7 && alto.meses[6].impedido === false
        && alto.meses[7].impedido === true, alto.impedimento && ('desde=' + alto.impedimento.desde));
      chk('v7.58.0 · M2 · a base é o REALIZADO (decisão 8.20)',
        alto.impedimento && alto.impedimento.base === 'realizado');
      chk('v7.58.0 · M2 · no mês impedido a trava do sublimite deixa de existir',
        (alto.meses[6].subIcms + alto.meses[6].subIss) > 0
        && (alto.meses[7].subIcms + alto.meses[7].subIss) === 0);
      chk('v7.58.0 · M2 · ICMS e ISS passam a ser apurados fora, e entram no custo do regime',
        alto.meses[7].impIcms > 0
        && Math.abs(alto.meses[7].simples.total - (alto.meses[7].das + alto.meses[7].impIcms + alto.meses[7].impIss + alto.meses[7].simples.cppRetida + alto.meses[7].simples.inssPatrForaDAS)) < 0.02);
      chk('v7.58.0 · M2 · quem não cruza o sublimite não é afetado em nada',
        baixo.impedimento === null && baixo.meses.every(M => !M.impedido && M.impIcms === 0));
      // M3 · v7.58.0 escreveu a regra e a deixou sem UI; a v7.62.0 deu-lhe onde ser ligada,
      // POR EMPRESA e com o padrão desligado. O teste antigo exigia a ausência de
      // `arredondaPorTributo:` no arquivo, o que a leitura da Configuração passou a violar
      // legitimamente — reescrito para o que continua valendo: a regra existe atrás da chave,
      // e nada no aplicativo a liga sozinho (as ocorrências são a leitura da tela e o
      // apagamento da chave quando desmarcada, nunca uma atribuição de `true`).
      chk('v7.62.0 · M3 · a regra existe atrás da chave e nada a liga sozinho',
        /if \(cfg\.arredondaPorTributo\)/.test(html)
        && !/arredondaPorTributo\s*[:=]\s*true/.test(html.replace(/i\.cfg\.arredondaPorTributo = true/g,'')));
      const semChave = mkI(200000), comChave = (()=>{ const i = anNovo2('11222333000181', 2026);
        i.cfg.iss = .02; i.cfg.arredondaPorTributo = true; i.cfg.rbt12Lanc = Array(12).fill(300000);
        for (const k of Object.keys(i.receitas)) i.receitas[k] = Array(12).fill(0);
        i.receitas.a1_semst = Array(12).fill(200000); return c4(i); })();
      chk('v7.58.0 · M3 · com a chave ligada o DAS é a soma das parcelas arredondadas',
        comChave.meses.every(M => Math.abs(M.das - Object.values(M.dasTrib).reduce((a,b)=>a+Math.round(b*100)/100, 0)) < 0.005)
        && Math.abs(comChave.meses[0].das - semChave.meses[0].das) < 0.05);
    }
    // ── M6 · v7.59.0 · analítico em vários arquivos ──
    {
      chk('v7.59.0 · M6 · os dois inputs do analítico aceitam seleção múltipla',
        (html.match(/id="tri-arq-(compra|venda)"[^>]*multiple/g) || []).length === 2);
      chk('v7.59.0 · M6 · arquivo único segue pelo caminho antigo, sem diálogo novo',
        /if \(arqs\.length === 1\)\{/.test(html));
      // v7.59.1 · um arquivo = um MÊS. Mesclar rateava o total do período entre os meses.
      const iT = html.indexOf('async function triArquivo(input, tipo){');
      const bT = html.slice(iT, html.indexOf('\n// v7.34.3: o processamento do analítico', iT));
      chk('v7.59.1 · M6 · os arquivos são processados EM SEQUÊNCIA, um por competência',
        /for \(const a of lidos\)\{[\s\S]{0,200}triProcessarWorkbook\(a\.wb/.test(bT));
      chk('v7.59.1 · M6 · e NÃO são mesclados numa planilha só',
        !/book_append_sheet/.test(bT) && !/Analítico mesclado/.test(html));
      chk('v7.59.1 · M6 · a duplicidade passa a ser do ARQUIVO inteiro, não da linha',
        /assinaturas\.has\(sig\)/.test(bT) && !/triChaveLinha/.test(html));
      chk('v7.59.1 · M6 · a tela declara competência, linhas e total de cada arquivo antes de importar',
        /a\.comp \+ ' · ' \+ a\.n \+ ' linha\(s\) · R\$ ' \+ fmt\(a\.total\)/.test(bT)
        && /não é rateado para os outros/.test(bT));
    }
    // ── M4 · v7.60.0 · o motor devolve os insumos do mês ──
    {
      const anNovo5 = vm.runInContext('anNovo', ctx), calcular5 = vm.runInContext('calcular', ctx);
      const AX5 = vm.runInContext('ANEXOS_DEFAULT', ctx), FP5 = vm.runInContext('FOLHA_PERC_DEFAULT', ctx);
      const i5 = anNovo5('1', 2026); i5.cfg.iss = .03; i5.cfg.rbt12Lanc = Array(12).fill(50000);
      for (const k of Object.keys(i5.receitas)) i5.receitas[k] = Array(12).fill(0);
      i5.receitas.a3_semret = Array(12).fill(30000); i5.receitas.fin = Array(12).fill(500);
      i5.compras.semst = Array(12).fill(1000); i5.folha.prolabore = Array(12).fill(2000);
      i5.despesas.adm = Array(12).fill(700);
      const R5 = calcular5(i5, JSON.parse(JSON.stringify(AX5)), Object.assign({}, FP5));
      const I5 = R5.meses[0].ins;
      chk('v7.60.0 · M4 · cada mês devolve os insumos usados', !!I5 && Array.isArray(I5.blocos));
      chk('v7.60.0 · M4 · o ANEXO vem do motor, não é deduzido dos blocos',
        JSON.stringify(I5.anexos) === JSON.stringify(['III']), JSON.stringify(I5.anexos));
      chk('v7.60.0 · M4 · a alíquota do insumo é a MESMA que o motor aplicou',
        Math.abs(I5.blocos[0].efetiva - R5.meses[0].efb.a3_semret) < 1e-12);
      chk('v7.60.0 · M4 · folha, compras, despesas e financeiras acompanham',
        I5.folha.prolabore === 2000 && I5.compras.semst === 1000
        && I5.despesas.adm === 700 && I5.financeiras === 500);
      chk('v7.60.0 · M4 · insumo é DADO — nada de fórmula ou texto no motor',
        !/ins: \{[\s\S]{0,900}?(CF\.lin|fmtR\(|`)/.test(html.slice(html.indexOf('ins: {'))));
      // M5 · onde configurar o crédito de PIS/COFINS
      const setCR = vm.runInContext('cfgCredLRSet', ctx);
      vm.runInContext("AN = anNovo('1', 2026);", ctx);
      setCR('adm', '30');
      chk('v7.60.0 · M5 · o percentual por grupo é gravado em cfg.credLRpct',
        Math.abs(vm.runInContext('AN.cfg.credLRpct.adm', ctx) - .30) < 1e-9);
      setCR('vendas', '250');
      chk('v7.60.0 · M5 · e é limitado a 100%', vm.runInContext('AN.cfg.credLRpct.vendas', ctx) === 1);
      setCR('adm', '');
      chk('v7.60.0 · M5 · campo em branco APAGA a chave (não informado ≠ informado como zero)',
        !('adm' in vm.runInContext('AN.cfg.credLRpct', ctx)));
      chk('v7.60.0 · M5 · o quadro existe na Configuração, com o padrão zero declarado',
        /Crédito de PIS\/COFINS sobre despesas/.test(html) && /é <b>taxativa<\/b>/.test(html));
    }
    chk('v7.56.5 · aviso de ISS zerado com receita de serviços (risco alto da auditoria)',
      /há ' \+ fmtR\(svc\) \+ ' de receita de serviços e o ISS está em 0%/.test(html));
    // ── v7.56.6 · a memória lê o conjunto PROJETADO, não a análise crua ──
    chk('v7.56.6 · a conferência define Dm = análise que produziu o resultado exibido',
      /const Dm = _PR \? _PR\.P\.dados : D;/.test(html));
    // v7.60.0 (M4) · a memória passou a CONSUMIR os insumos do motor; o caminho por Dm virou
    // apenas o fallback de análise antiga, sem `ins`. As duas coisas devem coexistir.
    chk('v7.56.6/v7.60.0 · a memória lê M.ins, com Dm como fallback — e nunca a análise crua',
      /M\.ins \? M\.ins\.blocos\.map/.test(html)
      && /M\.ins \? M\.ins\.folha\.salarios : \(\+\(\(Dm\.folha\.salarios/.test(html)
      && !/\$\{fmtR\(D\.receitas\[k\]\[m\]\)\}/.test(html));
    chk('v7.56.6 · sem bloco de receita no mês NÃO se inventa Anexo I',
      /for \(const ax of _axUsados\)\{/.test(html) && !/_axUsados\.length \? _axUsados : \['I'\]/.test(html));
    chk('v7.56.6 · o fechamento trimestral do LR recebe o resultado exibido',
      /function lrLinhasConfMes\(m, LR, Rx\)\{/.test(html)
      && /lrLinhasConfMes\(m, LR, R\)/.test(html)
      && /const base = RR\.meses\.slice/.test(html));
    chk('v7.56.5 · nota de precisão integral consta das divergências declaradas',
      /os cálculos correm em <b>precisão integral<\/b>/.test(vm.runInContext('rlConfDivergencias', ctx)()));
    chk('v7.64.2 · versão e changelog registrados (badge sai do APP_VERSAO)',
      /const APP_VERSAO = '7\.64\.2';/.test(html) && html.includes('<b>v7.64.2</b>')
      && html.includes('<b>v7.63.0</b>') && html.includes('<b>v7.50.0</b>'));
    // v7.56.2 · as nove versões novas entraram ABAIXO da v7.50.0 e a aba abria na versão errada.
    {
      const corpo = html.slice(html.indexOf('<table id="tbl-versoes"'));
      const vs = [...corpo.matchAll(/<tr><td><b>v([0-9.]+)<\/b>/g)].map(m => m[1]);
      const num = v => { const p2 = v.split('.').map(Number); return (p2[0]||0)*1e6 + (p2[1]||0)*1e3 + (p2[2]||0); };
      chk('v7.56.2 · a PRIMEIRA linha do changelog é a versão em uso',
        vs[0] === vm.runInContext('APP_VERSAO', ctx), 'primeira=' + vs[0]);
      const fora = vs.findIndex((v, i) => i > 0 && num(vs[i-1]) < num(v));
      chk('v7.56.2 · o changelog está em ordem decrescente de versão (169 linhas)',
        fora === -1, fora === -1 ? vs.length + ' linhas' : ('quebra em ' + vs[fora-1] + ' → ' + vs[fora]));
    }
    // v7.56.1 · o selo "atual" ficou congelado na v7.50.0 por oito versões porque era literal.
    // o único lugar onde a string pode aparecer é DENTRO do insertAdjacentHTML que a injeta;
    // qualquer outra ocorrência é selo literal numa linha do changelog — que foi o defeito.
    chk('v7.56.1 · o selo "atual" NÃO está escrito à mão em nenhuma linha do changelog',
      (html.match(/<span class="badge ok">atual<\/span>/g) || []).length === 1
      && /insertAdjacentHTML\('afterend', ' <span class="badge ok">atual<\/span>'\)/.test(html));
    chk('v7.56.1 · e é derivado do APP_VERSAO na inicialização',
      /_b\.textContent\.trim\(\) === 'v' \+ APP_VERSAO/.test(html) && /id="tbl-versoes"/.test(html));

    // ═══ v7.50.0 — Anexo IV com ISS retido (decisões 2.1 a 2.4) ═══
    {
      const anNovo=vm.runInContext('anNovo',ctx), calcular=vm.runInContext('calcular',ctx),
            calcCen=vm.runInContext('calcCenariosReforma',ctx), P=vm.runInContext('PARAMS',ctx),
            pb=vm.runInContext('pgdasBloco',ctx), aliq=vm.runInContext('RF_ALIQ_DEFAULT',ctx);
      const base=()=>{ const i=anNovo('11222333000181',2026); i.cfg.iss=.05; return i; };
      const iSem=base(), iCom=base();
      for(let m=0;m<12;m++){ iSem.receitas.a4[m]=50000; iCom.receitas.a4_retiss[m]=50000; }
      const rSem=calcular(iSem,P.anexos,P.folha), rCom=calcular(iCom,P.anexos,P.folha);

      chk('v7.50.0 · o bloco novo existe na análise, na grade e no modelo',
        /a4_retiss/.test(html) && /Anexo IV · Serviços com ISS retido/.test(html)
        && /"receitas\.a4_retiss"/.test(html));
      chk('v7.50.0 · com ISS retido o DAS é MENOR (a parcela de ISS sai da guia)',
        rCom.totais.das < rSem.totais.das - 1,
        'sem '+rSem.totais.das.toFixed(2)+' × com '+rCom.totais.das.toFixed(2));
      // identidade: o que saiu da guia é exatamente o ISS recomposto pela parcela do Anexo IV
      chk('v7.50.0 · o que sai do DAS é exatamente a parcela de ISS do Anexo IV (identidade mês a mês)',
        rSem.meses.every((x,i)=>Math.abs((x.das - rCom.meses[i].das) - (rCom.meses[i].simples.issRetido||0))<0.02),
        'ano: Δ DAS '+(rSem.totais.das-rCom.totais.das).toFixed(2)+' × ISS retido '+(rCom.totais.issRetido||0).toFixed(2));
      const issG=r=>r.meses.reduce((s,x)=>s+x.lp.iss,0), issR=r=>r.meses.reduce((s,x)=>s+(x.issRetLPLR||0),0);
      chk('v7.50.0 · no Presumido/Real o ISS sai da guia própria e vira ISS retido (600.000 × 5%)',
        Math.abs(issG(rSem)-30000)<0.01 && Math.abs(issG(rCom))<0.005 && Math.abs(issR(rCom)-30000)<0.01);
      chk('v7.50.0 · (2.1) o retido do Anexo IV é recomposto pela parcela do PRÓPRIO anexo',
        /R\.a4_retiss\[m\] \* _pIssRet4/.test(html) && /anexos\.IV\.iss/.test(html));
      {
        // a mesma receita no Anexo III retido recompõe MENOS: a parcela de ISS do III é menor
        const iIII=base(); for(let m=0;m<12;m++) iIII.receitas.a3_retiss[m]=50000;
        const rIII=calcular(iIII,P.anexos,P.folha);
        chk('v7.50.0 · (2.1) o Anexo IV usa o parâmetro do PRÓPRIO anexo (valor difere do que o III daria)',
          Math.abs((rCom.totais.issRetido||0) - (rIII.totais.issRetido||0)) > 1,
          'IV '+(rCom.totais.issRetido||0).toFixed(2)+' × III '+(rIII.totais.issRetido||0).toFixed(2));
      }
      chk('v7.50.0 · (2.3) não existe bloco de ISS+INSS retidos no Anexo IV',
        !/a4_retissinss/.test(html));
      chk('v7.50.0 · (2.2) a retenção previdenciária de 11% ficou declarada nas divergências',
        /Retenção previdenciária de 11% não é modelada/.test(html));
      chk('v7.50.0 · a trava do sublimite não conta a receita com ISS retido',
        /subIss = R\.a3_semret\[m\]\*pIss3 \+ R\.a4\[m\]\*pIss4/.test(html)
        && !/a4_retiss\[m\]\*pIss4/.test(html));

      // (2.4) o ISS retido sai da base do IBS/CBS
      {
        const rf={receita:600000,baseIS:0,credSimplesPct:0,benefRec:{},benefCred:{},contra:{},aliq};
        const LSem=calcCen(rSem,rf).REF.find(l=>l.ano===2027);
        const LCom=calcCen(rCom,rf).REF.find(l=>l.ano===2027);
        // REESCRITO na v7.54.0 (item L · decisão 8.9): a decisão 2.4 da v7.50.0 foi REVERTIDA.
        // O ISS retido pelo tomador NÃO reduz a base do IBS/CBS — a dedução é o lp.iss puro,
        // exatamente o ISS do Presumido exibido no Consolidado analítico. A leitura literal do
        // art. 12, §2º, V, admitiria o contrário; a escolha é pela coerência com a v7.23.0 e
        // consta das divergências declaradas.
        chk('v7.54.0 · (8.9) a dedução da base é o lp.iss puro — o ISS retido fica de fora',
          Math.abs(LCom.dedIss - rCom.meses.reduce((s,x)=>s+x.lp.iss,0) * (+aliq[2027].remIcmsIss||0)) < 0.02,
          'dedIss=' + LCom.dedIss.toFixed(2));
        chk('v7.54.0 · (8.9) empresa 100% com ISS retido tem dedução ZERO — e isso é o esperado agora',
          Math.abs(LCom.dedIss) < 0.005 && LSem.dedIss > 1,
          'com=' + LCom.dedIss.toFixed(2) + ' sem=' + LSem.dedIss.toFixed(2));
        chk('v7.50.0 · (2.4) o débito de 2027 cai pela dedução, e fecha com (base − ISS) × alíquota',
          Math.abs(LCom.deb-(600000-LCom.ded)*LCom.alq)<0.02);
      }
      // PGDAS pelo rótulo declarado
      chk('v7.50.0 · PGDAS: Anexo IV COM retenção de ISS cai no bloco novo',
        pb('Prestação de serviços tributados pelo Anexo IV da LC 123/2006 - Com retenção de ISS')==='a4_retiss');
      chk('v7.50.0 · PGDAS: a NEGAÇÃO vence a menção (Anexo IV sem retenção segue no bloco antigo)',
        pb('Prestação de serviços tributados pelo Anexo IV da LC 123/2006 - Sem retenção de ISS')==='a4'
        && pb('Prestação de serviços de vigilância, limpeza e conservação')==='a4');
      // não-regressão
      {
        const iZ=base(); for(let m=0;m<12;m++) iZ.receitas.a3_semret[m]=50000;
        const rZ=calcular(iZ,P.anexos,P.folha);
        const iZ2=anNovo('11222333000181',2026); iZ2.cfg.iss=.05;
        for(let m=0;m<12;m++) iZ2.receitas.a3_semret[m]=50000;
        delete iZ2.receitas.a4_retiss;                     // análise antiga, gravada antes do campo
        const rZ2=calcular(iZ2,P.anexos,P.folha);
        chk('v7.50.0 · análise gravada ANTES do campo novo calcula igual (chave ausente = zero)',
          Math.abs(rZ.totais.das-rZ2.totais.das)<0.005 && Math.abs(rZ.totais.lp-rZ2.totais.lp)<0.005);
      }
    }

    // ═══ v7.49.1 — campo ausente não pode derrubar a gravação da configuração ═══
    // A varredura de $id() órfão não enxerga id montado por template (o helper pc() escreve
    // id="${id}"), então a Configuração ficou sem rede. Esta é a rede: renderiza SÓ o painel da
    // Configuração — como acontece quando a seção RBT12 da grade nunca foi aberta — e exige que a
    // gravação atribua o que foi digitado, sem exceção.
    {
      const _AN = vm.runInContext('AN', ctx);
      // DOM limpo: só o painel da Configuração é renderizado
      for (const k of Object.keys(ctx.__els || {})) {}
      vm.runInContext("AN = anNovo('11222333000181',2026);", ctx);
      const idsDaConfig = (() => {
        vm.runInContext('anRenderConfig();', ctx);
        const painel = ctx.document.getElementById('an-config-box').innerHTML || '';
        return new Set([...painel.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));
      })();
      const fonte = vm.runInContext('anAplicarConfig.toString()', ctx);
      const semGuarda = [...fonte.matchAll(/\$id\('([^']+)'\)\.value/g)].map(m => m[1]);
      const forasteiros = semGuarda.filter(id => !idsDaConfig.has(id));
      chk('v7.49.1 · nenhum campo é lido sem guarda na gravação da configuração',
        forasteiros.length === 0, forasteiros.join(', '));

      // prova de comportamento: campo de outra tela ausente, digitação do ISS tem de valer
      vm.runInContext(`
        AN = anNovo('11222333000181',2026); AN.cfg.rbt12Direto = 500000; anRenderConfig();
        __antes = AN.cfg.rbt12Direto;
      `, ctx);
      ctx.document.getElementById('cf-iss').value = '3';
      ctx.document.getElementById('cf-icmsv').value = '17';
      // no navegador o elemento de OUTRA tela simplesmente não existe; aqui o stub cria tudo sob
      // demanda, então a ausência precisa ser simulada — é ela que derrubava a função inteira.
      const _gebi = ctx.document.getElementById;
      ctx.document.getElementById = id => id === 'cf-rbtd' ? null : _gebi.call(ctx.document, id);
      let erro = null;
      try { vm.runInContext('anAplicarConfig(true)', ctx); } catch(e){ erro = e; }
      ctx.document.getElementById = _gebi;
      chk('v7.49.1 · gravar a configuração sem a seção RBT12 na tela NÃO estoura',
        !erro, erro ? String(erro.message) : '');
      chk('v7.49.1 · o ISS digitado chega ao cfg (era aqui que ele se perdia)',
        Math.abs(vm.runInContext('AN.cfg.iss', ctx) - 0.03) < 1e-9,
        'iss=' + vm.runInContext('AN.cfg.iss', ctx));
      chk('v7.49.1 · e o campo que estava fora da tela é PRESERVADO, não zerado',
        +vm.runInContext('AN.cfg.rbt12Direto', ctx) === 500000);
      chk('v7.49.1 · a alteração marca a análise como pendente de gravação',
        vm.runInContext('AN_SUJO', ctx) === true);
      ctx.__ret2 = _AN; vm.runInContext('AN = __ret2;', ctx);
    }

    // ═══ v7.49.0 — a Configuração gravava no ANO errado; e as alíquotas passam a ser herdadas ═══
    {
      chk('v7.49.0 · go(config/importar) compara empresa E ano (era só o CNPJ)',
        /AN\?\.cnpj !== EMP_GLOBAL\.cnpj \|\| \(EMP_GLOBAL\.ano && \+AN\?\.ano !== \+EMP_GLOBAL\.ano\)/.test(html));
      chk('v7.49.0 · o gravador com atraso da Configuração fica preso à empresa/ano do clique',
        /const _alvo = AN\.cnpj \+ '\|' \+ AN\.ano;/.test(html)
        && /\(AN\.cnpj \+ '\|' \+ AN\.ano\) === _alvo/.test(html));

      const _supa = vm.runInContext('supa', ctx), _AN = vm.runInContext('AN', ctx),
            _EG = JSON.parse(JSON.stringify(vm.runInContext('EMP_GLOBAL', ctx)));
      let corpo = null;
      ctx.__capt = b => { corpo = JSON.parse(JSON.stringify(b)); };

      // (1) rede de segurança do anSalvar: tela e análise em anos diferentes → NÃO grava
      vm.runInContext(`
        supa = async (m, rec, o) => { if (m==='POST' && /atp_analises\\?/.test(rec)) { __capt(o.body[0]); } return []; };
        AN = anNovo('11222333000181', 2025); AN._res = { totais:{} };
        EMP_GLOBAL.cnpj = '11222333000181'; EMP_GLOBAL.ano = 2026;
      `, ctx);
      await vm.runInContext('anSalvar()', ctx);
      chk('v7.49.0 · anSalvar RECUSA gravar quando a tela mostra outro ano (era aí que a alíquota sumia)',
        corpo === null, corpo ? ('gravou ano '+corpo.ano) : '');
      // mesmo ano → grava normalmente
      corpo = null;
      vm.runInContext("EMP_GLOBAL.ano = 2025; AN.cfg.iss = 0.03;", ctx);
      await vm.runInContext('anSalvar()', ctx);
      chk('v7.49.0 · com empresa e ano batendo, grava normalmente (ISS 3% na linha certa)',
        !!corpo && corpo.ano===2025 && Math.abs((corpo.dados.cfg.iss||0)-0.03)<1e-9);

      // (2) herança das alíquotas ao abrir um ano sem linha
      vm.runInContext(`
        __ANT = anNovo('11222333000181', 2026);
        __ANT.cfg.iss = 0.03; __ANT.cfg.icmsV = 0.17; __ANT.cfg.icmsTranspV = 0.07;
        __ANT.cfg.transpPresuncao = 'passageiros'; __ANT.cfg.folhaPerc = { rat: 0.03 };
        __ANT.cfg.rbt12Direto = 999999; __ANT.cfg.lrPrejIrpj = 12345;
        supa = async (m, rec, o) => {
          if (m==='GET' && /atp_analises/.test(rec) && o && o.params && /lt\\./.test(o.params.ano||''))
            return [{ ano:2026, dados: JSON.parse(JSON.stringify(__ANT)) }];
          return [];
        };
        __NOVA = anNovo('11222333000181', 2027);
      `, ctx);
      const de = await vm.runInContext("cfgHerdar(__NOVA,'11222333000181',2027)", ctx);
      chk('v7.49.0 · ano novo herda as alíquotas do ano mais recente da empresa',
        de===2026
        && Math.abs(vm.runInContext('__NOVA.cfg.iss',ctx)-0.03)<1e-9
        && Math.abs(vm.runInContext('__NOVA.cfg.icmsV',ctx)-0.17)<1e-9
        && Math.abs(vm.runInContext('__NOVA.cfg.icmsTranspV',ctx)-0.07)<1e-9
        && vm.runInContext("__NOVA.cfg.transpPresuncao",ctx)==='passageiros');
      chk('v7.49.0 · herda os percentuais de folha por CÓPIA (não por referência)',
        Math.abs(vm.runInContext('__NOVA.cfg.folhaPerc.rat',ctx)-0.03)<1e-9
        && vm.runInContext('__NOVA.cfg.folhaPerc !== __ANT.cfg.folhaPerc',ctx)===true);
      chk('v7.49.0 · NÃO herda o que é apuração do ano (RBT12 e prejuízos ficam zerados)',
        +vm.runInContext('__NOVA.cfg.rbt12Direto',ctx)===0 && +vm.runInContext('__NOVA.cfg.lrPrejIrpj',ctx)===0);
      chk('v7.49.0 · a tela declara de qual ano a configuração veio',
        vm.runInContext('__NOVA._cfgHerdadaDe',ctx)===2026 && /Configuração herdada de \$\{AN\._cfgHerdadaDe\}/.test(html));
      vm.runInContext("supa = async () => [];", ctx);   // banco sem nenhum ano anterior
      chk('v7.49.0 · empresa sem ano anterior: nada é herdado e nada quebra',
        (await vm.runInContext("cfgHerdar(anNovo('99999999000191',2027),'99999999000191',2027)", ctx))===null);
      chk('v7.49.0 · a marca de herança sai no primeiro Salvar',
        /if \(AN\._cfgHerdadaDe\) delete AN\._cfgHerdadaDe;/.test(html));

      ctx.__ret = { s:_supa, a:_AN, g:_EG };
      vm.runInContext('supa = __ret.s; AN = __ret.a; EMP_GLOBAL.cnpj = __ret.g.cnpj; EMP_GLOBAL.ano = __ret.g.ano;', ctx);
    }

    // ═══ v7.48.3 — o 💾 Salvar da Reforma não pode apagar a análise gravada ═══
    {
      const _supa = vm.runInContext('supa', ctx), _AN = vm.runInContext('AN', ctx), _RF = vm.runInContext('RF', ctx);
      let corpo = null;
      ctx.__capt = b => { corpo = JSON.parse(JSON.stringify(b)); };
      vm.runInContext(`
        __BANCO = { dados:null };
        supa = async (m, rec, o) => {
          if (m==='GET'  && /atp_analises/.test(rec)) return __BANCO.dados ? [{ dados:__BANCO.dados, resumo:{receita:1} }] : [];
          if (m==='POST' && /atp_analises/.test(rec)) { __capt(o.body[0]); return []; }
          return [];
        };
        __sal = anNovo('11222333000181',2026); __sal.cfg.iss = 0.05; __sal.receitas.a3_semret[0] = 100000;
        __BANCO.dados = JSON.parse(JSON.stringify(__sal));
        AN = anNovo('11222333000181', 2025);          // AN de OUTRO ANO — era o gatilho do apagamento
        RF = rfNovo('11222333000181', 2026); RF.receita = 100000;
      `, ctx);
      await vm.runInContext('rfSalvar()', ctx);
      chk('v7.48.3 · Salvar da Reforma com AN de outro ano PRESERVA a configuração gravada (ISS 5%)',
        !!corpo && corpo.ano===2026 && Math.abs((corpo.dados.cfg.iss||0)-0.05)<1e-9,
        corpo ? 'cfg.iss='+corpo.dados.cfg.iss : 'não gravou');
      chk('v7.48.3 · e preserva os DADOS do ano (receita de janeiro intacta)',
        !!corpo && corpo.dados.receitas.a3_semret[0]===100000);
      chk('v7.48.3 · o bloco reforma do ano é o que foi de fato substituído',
        !!corpo && +corpo.dados.reforma.receita===100000);
      // sem linha no banco: aí sim pode criar do zero
      corpo = null;
      vm.runInContext("__BANCO.dados = null; RF.receita = 100000;", ctx);   // rfCalcular relê a receita do campo da tela
      await vm.runInContext('rfSalvar()', ctx);
      chk('v7.48.3 · ano SEM linha no banco: cria a análise nova (não há o que perder)',
        !!corpo && corpo.ano===2026 && +corpo.dados.reforma.receita===100000,
        corpo ? ('ano='+corpo.ano+' rec='+(corpo.dados.reforma||{}).receita) : 'não gravou');
      // leitura prévia falhando: não grava nada
      corpo = null;
      vm.runInContext("supa = async (m, rec, o) => { if (m==='GET') throw new Error('rede'); if (m==='POST') { __capt(o.body[0]); } return []; };", ctx);
      await vm.runInContext('rfSalvar()', ctx);
      chk('v7.48.3 · se a leitura prévia falhar, NADA é gravado (não sobrescreve às cegas)', corpo===null);
      chk('v7.48.3 · a comparação passou a incluir o ANO, não só o CNPJ',
        /AN\.cnpj === RF\.cnpj && \+AN\.ano === \+RF\.ano/.test(html) && !/\(AN && AN\.cnpj===RF\.cnpj\) \? \{\.\.\.AN, _res:undefined, reforma/.test(html));
      ctx.__ret = { s:_supa, a:_AN, r:_RF };
      vm.runInContext('supa = __ret.s; AN = __ret.a; RF = __ret.r;', ctx);
    }
    chk('v7.48.2 · o payload da IA leva base do IBS/CBS, crédito das compras e transporte',
      /baseIbsCbs: D\.L33/.test(html) && /creditoSobreCompras:/.test(html) && /transporte: \(D\.T\.recTransp/.test(html)
      && /A base do IBS\/CBS NÃO é a receita cheia/.test(html)
      && /Nunca afirme que não há crédito de IBS\/CBS/.test(html));

    // ═══ v7.48.0 — cancelar importação · ICMS fora da base · transporte ═══
    console.log('\n■ v7.48.0 — cancelar, ICMS fora da base e transporte');
    {
      // ── (1) CANCELAR a importação pendente ──
      chk('v7.48.0 · 1 — os 5 importadores têm Cancelar ao lado do Aplicar',
        ['pgdas','fat','bal','dem','xml'].every(q => html.includes("impBtnCancelar('"+q+"')"))
        && /function impPendenteCancelar/.test(html));
      {
        const IP = vm.runInContext('IMP_PENDENTES', ctx);
        const faltando = Object.values(IP).filter(a => !html.includes('id="'+a.rev+'"') || !html.includes('id="'+a.file+'"'));
        chk('v7.48.0 · 1 — cada Cancelar aponta para uma revisão e um campo de arquivo que existem',
          faltando.length===0, faltando.map(a=>a.rev).join(', '));
        ctx.document.getElementById('imp-pgdas-review').innerHTML = 'pendente';
        ctx.document.getElementById('imp-pgdas-files')._v = 'x.pdf';
        vm.runInContext("PG_DADOS = {meses:[1]}; impPendenteCancelar('pgdas');", ctx);
        chk('v7.48.0 · 1 — cancelar zera o lido, limpa a revisão e libera o campo',
          vm.runInContext('PG_DADOS', ctx)===null
          && ctx.document.getElementById('imp-pgdas-review').innerHTML===''
          && ctx.document.getElementById('imp-pgdas-files').value==='');
      }
      chk('v7.48.0 · 1 — o cancelamento DURANTE a leitura (v7.43.0) continua existindo, separado',
        /IMP_CANCELAR/.test(html) && /function impCancelar/.test(html));

      // ── (2) ICMS fora da base do IBS/CBS ──
      {
        const anNovo=vm.runInContext('anNovo',ctx), calcular=vm.runInContext('calcular',ctx),
              calcCen=vm.runInContext('calcCenariosReforma',ctx), P=vm.runInContext('PARAMS',ctx),
              aliq=vm.runInContext('RF_ALIQ_DEFAULT',ctx);
        const inp=anNovo('11222333000181',2026);
        for(let m=0;m<12;m++) inp.receitas.a1_semst[m]=100000;
        inp.cfg.icmsV=.18; inp.cfg.icmsC=.12; inp.cfg.iss=0;
        const res=calcular(inp,P.anexos,P.folha);
        const icmsDebAno=res.meses.reduce((a,x)=>a+x.icmsDeb,0);
        chk('v7.48.0 · 2 — ICMS destacado do ano = receita × alíquota de venda (1.200.000 × 18%)',
          Math.abs(icmsDebAno-216000)<0.01, 'icmsDeb='+icmsDebAno.toFixed(2));
        const C=calcCen(res,{receita:1200000,baseIS:0,credSimplesPct:0,benefRec:{},benefCred:{},contra:{},aliq});
        const L27=C.REF.find(l=>l.ano===2027), L26=C.REF.find(l=>l.ano===2026), L33=C.REF.find(l=>l.ano===2033);
        const rem27=+aliq[2027].remIcmsIss;
        chk('v7.48.0 · 2 — dedução de 2027 = ICMS destacado × remanescente do ano',
          Math.abs(L27.dedIcms-icmsDebAno*rem27)<0.02 && Math.abs(L27.dedIss)<0.005);
        chk('v7.48.0 · 2 — o débito fecha: (base − ISS − ICMS) × alíquota',
          Math.abs(L27.deb-(1200000-L27.ded)*L27.alq)<0.02);
        chk('v7.48.0 · 2 — 2026 (ano-teste) sem dedução e 2033 sem dedução (ICMS e ISS extintos)',
          Math.abs(L26.dedIcms)<0.005 && Math.abs(L33.dedIcms)<0.005);
        chk('v7.48.0 · 2 — mercadoria com ST fica fora da dedução (não tem destaque próprio)',
          !/a1_comst\[m\]\+R\.a2_comst\[m\][^;]*\*cfg\.icmsV/.test(html)
          && /R\.a2_mono\[m\]\)\*cfg\.icmsV \+ R\.comtransp\[m\]\*icmsVTransp/.test(html));
        chk('v7.48.0 · 2 — a dedução aparece nos três documentos (aba, memória e parecer)',
          /\(−\) ICMS fora da base/.test(html) && /ICMS que não integra a base/.test(html)
          && /function ppBaseIbsCbs/.test(html) && /\$\{ppBaseIbsCbs\(D\)\}/.test(html));
      }

      // ── (3) TRANSPORTE ──
      {
        const anNovo=vm.runInContext('anNovo',ctx), calcular=vm.runInContext('calcular',ctx),
              P=vm.runInContext('PARAMS',ctx), pb=vm.runInContext('pgdasBloco',ctx);
        chk('v7.48.0 · 3 — o bloco novo existe na análise, na grade e no modelo',
          /comtransp_st/.test(html) && /Com\. \/ Transporte — com retenção ICMS/.test(html)
          && /"receitas\.comtransp_st"/.test(html));
        const base=()=>{ const i=anNovo('11222333000181',2026); i.cfg.icmsV=.12; i.cfg.icmsC=.12; i.cfg.iss=.03; return i; };
        const iT=base(); for(let m=0;m<12;m++) iT.receitas.comtransp[m]=50000;
        const iS=base(); for(let m=0;m<12;m++) iS.receitas.comtransp_st[m]=50000;
        const rT=calcular(iT,P.anexos,P.folha), rS=calcular(iS,P.anexos,P.folha);
        chk('v7.48.0 · 3 — com retenção o DAS é MENOR (a parcela de ICMS sai da guia)',
          rS.totais.das < rT.totais.das - 1,
          'sem ret. '+rT.totais.das.toFixed(2)+' × com ret. '+rS.totais.das.toFixed(2));
        chk('v7.48.0 · 3 — o bloco com retenção fica FORA da trava do sublimite (subIcms)',
          !/comtransp_st\[m\]\)\*pIcms1/.test(html) && /R\.comtransp\[m\]\)\*pIcms1/.test(html));
        const dT=rT.meses.reduce((a,x)=>a+x.icmsDeb,0), dS=rS.meses.reduce((a,x)=>a+x.icmsDeb,0);
        chk('v7.48.0 · 3 — transporte gera débito de ICMS no LP/LR (600.000 × 12% = 72.000)',
          Math.abs(dT-72000)<0.01, 'débito='+dT.toFixed(2));
        chk('v7.48.0 · 3 — o bloco com retenção NÃO gera débito (quem recolhe é o substituto)',
          Math.abs(dS)<0.005);
        // crédito sobre compras sem ST
        const iC=base(); for(let m=0;m<12;m++){ iC.receitas.comtransp[m]=50000; iC.compras.semst[m]=20000; }
        const rC=calcular(iC,P.anexos,P.folha);
        const credC=rC.meses.reduce((a,x)=>a+x.icmsCred,0), pagarC=rC.meses.reduce((a,x)=>a+x.icmsPagar,0);
        chk('v7.48.0 · 3 — crédito das compras sem ST desce do débito (72.000 − 28.800)',
          Math.abs(credC-28800)<0.01 && Math.abs(pagarC-43200)<0.01);
        // presunção cargas × passageiros
        const iP=base(); for(let m=0;m<12;m++) iP.receitas.comtransp[m]=50000; iP.cfg.transpPresuncao='passageiros';
        const rP=calcular(iP,P.anexos,P.folha);
        const irC=rT.meses.reduce((a,x)=>a+x.lp.irpj,0), irP=rP.meses.reduce((a,x)=>a+x.lp.irpj,0);
        chk('v7.48.0 · 3 — passageiros presume 16% no IRPJ (cargas 8%): 600.000 × 8 p.p. × 15%',
          Math.abs((irP-irC)-600000*0.08*0.15)<0.02, 'Δ IRPJ='+(irP-irC).toFixed(2));
        const csC=rT.meses.reduce((a,x)=>a+x.lp.csll,0), csP=rP.meses.reduce((a,x)=>a+x.lp.csll,0);
        chk('v7.48.0 · 3 — a CSLL é 12% nos dois casos (não se move com o seletor)',
          Math.abs(csP-csC)<0.005);
        // rótulo do PGDAS
        chk('v7.48.0 · 3 — PGDAS: transporte COM retenção de ICMS cai no bloco novo',
          pb('Prestação de serviços de transporte intermunicipal e interestadual - Com substituição tributária de ICMS')==='comtransp_st');
        chk('v7.48.0 · 3 — PGDAS: a NEGAÇÃO vence a menção (lição da v7.45.0)',
          pb('Prestação de serviços de transporte intermunicipal e interestadual - Sem substituição tributária de ICMS')==='comtransp'
          && pb('Prestação de serviços de comunicação - Sem retenção de ICMS')==='comtransp');
        // regressão: empresa SEM transporte não muda um centavo
        const iZ=base(); for(let m=0;m<12;m++) iZ.receitas.a3_semret[m]=50000;
        const rZ=calcular(iZ,P.anexos,P.folha);
        chk('v7.48.0 · 3 — empresa SEM transporte: ICMS segue zerado (não-regressão)',
          Math.abs(rZ.meses.reduce((a,x)=>a+x.icmsDeb,0))<0.005);
      }
      chk('v7.48.0 · as duas aproximações ficaram DECLARADAS nas divergências da conferência',
        /Dedução de ICMS\/ISS da base do IBS\/CBS por estimativa/.test(html)
        && /Crédito presumido do transporte, quando informado/.test(html)
        && /Alíquota do transporte \(v7\.48\.1\)/.test(html));
      // ── v7.48.1 · alíquota própria do transporte e crédito presumido (decisões 3.1 e 3.2) ──
      {
        const anNovo=vm.runInContext('anNovo',ctx), calcular=vm.runInContext('calcular',ctx),
              P=vm.runInContext('PARAMS',ctx);
        const base=()=>{ const i=anNovo('11222333000181',2026); i.cfg.icmsV=.12; i.cfg.icmsC=.12; i.cfg.iss=.03;
          for(let m=0;m<12;m++) i.receitas.comtransp[m]=50000; return i; };
        const r0=calcular(base(),P.anexos,P.folha);
        chk('v7.48.1 · 3.1 — campo em branco mantém a alíquota de vendas (não-regressão da v7.48.0)',
          Math.abs(r0.meses.reduce((a,x)=>a+x.icmsDeb,0)-72000)<0.01);
        const iA=base(); iA.cfg.icmsTranspV=.07;
        const rA=calcular(iA,P.anexos,P.folha);
        chk('v7.48.1 · 3.1 — alíquota própria vale só para o transporte (600.000 × 7% = 42.000)',
          Math.abs(rA.meses.reduce((a,x)=>a+x.icmsDeb,0)-42000)<0.01);
        const iM=base(); iM.cfg.icmsTranspV=.07; for(let m=0;m<12;m++) iM.receitas.a1_semst[m]=10000;
        const rM=calcular(iM,P.anexos,P.folha);
        chk('v7.48.1 · 3.1 — empresa mista: mercadoria a 12% e transporte a 7% no mesmo débito',
          Math.abs(rM.meses.reduce((a,x)=>a+x.icmsDeb,0)-(42000+120000*.12))<0.01);
        const iC=base(); iC.cfg.transpCredPres=.20; iC.cfg.icmsC=0;
        const rC=calcular(iC,P.anexos,P.folha);
        chk('v7.48.1 · 3.2 — crédito presumido = % sobre o débito da prestação (20% de 72.000)',
          Math.abs(rC.meses.reduce((a,x)=>a+x.icmsCred,0)-14400)<0.01
          && Math.abs(rC.meses.reduce((a,x)=>a+x.icmsPagar,0)-57600)<0.01);
        chk('v7.48.1 · 3.2 — zero = não aplica (padrão de fábrica, nada muda)',
          Math.abs(r0.meses.reduce((a,x)=>a+x.icmsCred,0))<0.005);
        chk('v7.48.1 · 3.2 — o crédito presumido NÃO mexe na dedução da base do IBS/CBS (é o destacado)',
          Math.abs(rC.meses.reduce((a,x)=>a+x.icmsDeb,0)-72000)<0.01);
        chk('v7.48.1 · os dois campos nascem zerados na configuração',
          /icmsTranspV:0, transpCredPres:0/.test(html));
      }
      chk('v7.48.0 · lacre RE-SELADO e registrado no changelog (mudança deliberada de regra)',
        /const LACRE_HASH = '47f3f10b';/.test(html) && /LACRE RE-SELADO/.test(html) && /e1a25234/.test(html));
    }

    // ═══ v7.47.1 — o crédito das compras chega ao parecer e à memória de cálculo ═══
    // (A) o relatório Reforma quebrava com ReferenceError; (B) a aba e a análise eram duas cópias
    // e o que a tela mostrava não ia ao banco; (C) parecer e memória passam a INFORMAR o crédito.
    // NÃO há alteração de layout em relatório nenhum — a v7.47.0 tinha, e foi revertida.
    console.log('\n■ v7.47.1 — crédito das compras no parecer e na memória');
    {
      // A1 · as declarações que o comentário da v7.46.0 engoliu estão FORA dele
      chk('v7.47.1 · A — emp/regime declarados em linha própria dentro do rlReforma',
        !/\/\/ v7\.46\.0: carga atual na MESMA base projetada const emp/.test(html)
        && /const emp = RL\.empresa; const regime = emp\?\.regime\|\|'Lucro Presumido';/.test(html));

      // A2 · guarda GERAL do padrão que causou o defeito: comentário que engole declaração
      {
        const suspeitas = [];
        js.split('\n').forEach((ln,i) => {
          const m = ln.match(/\/\/[^'"`]*?\b(const|let|var)\s+[A-Za-z_$][\w$]*\s*=/);
          if (m && !/https?:/.test(ln)) suspeitas.push((i+1)+': '+ln.trim().slice(0,90));
        });
        chk('v7.47.1 · A — nenhuma linha tem // seguido de declaração (o padrão do defeito)',
          suspeitas.length===0, suspeitas.length ? suspeitas.join(' | ') : '');
      }

      // A3 · o relatório Reforma RENDERIZA — e continua sendo o da v7.46.0, sem enfeite novo
      {
        const anNovo=vm.runInContext('anNovo',ctx), calcular=vm.runInContext('calcular',ctx),
              P=vm.runInContext('PARAMS',ctx), RLg=vm.runInContext('RL',ctx),
              rlRef=vm.runInContext('rlReforma',ctx), aliq=vm.runInContext('RF_ALIQ_DEFAULT',ctx);
        const _bk = { dados:RLg.dados, res:RLg.res, reforma:RLg.reforma, empresa:RLg.empresa };
        const inp=anNovo('11222333000181',2026);
        for(let m=0;m<12;m++) inp.receitas.a3_semret[m]=10000;
        inp.cfg.iss=.04;
        RLg.dados=inp; RLg.res=calcular(inp,P.anexos,P.folha);
        RLg.empresa={ cnpj:'11222333000181', razao_social:'TESTE', regime:'Simples Nacional' };
        RLg.reforma={ receita:120000, baseIS:0, credSimplesPct:0, benefRec:{}, benefCred:{},
                      contra:{ compras_lrlp:50000, compras_simples:0 }, aliq:JSON.parse(JSON.stringify(aliq)) };
        let erro=null; try { rlRef(); } catch(e){ erro=e; }
        const corpo = ctx.document.getElementById('rl-corpo').innerHTML || '';
        chk('v7.47.1 · A — rlReforma() renderiza sem exceção (era ReferenceError: regime)',
          !erro, erro ? String(erro.message) : '');
        chk('v7.47.1 · A — o corpo é o quadro da v7.46.0, com Débito e Crédito',
          /Quadro da transição/.test(corpo) && /<th class="num">Crédito<\/th>/.test(corpo)
          && /Cenários do Simples na transição/.test(corpo));
        const cred27 = 50000*((aliq[2027].cbs+aliq[2027].ibse+aliq[2027].ibsm)/100);
        const alvo = cred27.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
        chk('v7.47.1 · A — o crédito das compras aparece no quadro (2027 = '+alvo+')', corpo.includes(alvo));
        RLg.dados=_bk.dados; RLg.res=_bk.res; RLg.reforma=_bk.reforma; RLg.empresa=_bk.empresa;
      }

      // A4 · NENHUMA alteração de layout sobreviveu da v7.47.0
      chk('v7.47.1 · A — as alterações de relatório da v7.47.0 foram revertidas',
        !/rlBaseRfTexto/.test(html) && !/rlCredAvisoCurto/.test(html)
        && /refCenCard\(window\.__refCen, RL\.res\.totais\)/.test(html));

      // B · a aba e a análise deixam de ser duas cópias
      {
        const rfNovo=vm.runInContext('rfNovo',ctx), anNovo=vm.runInContext('anNovo',ctx);
        const _rf=vm.runInContext('RF',ctx), _an=vm.runInContext('AN',ctx), _mc=vm.runInContext('RF_MARCO',ctx);
        ctx.__rf = rfNovo('11222333000181',2026); ctx.__an = anNovo('11222333000181',2026);
        vm.runInContext('RF = __rf; AN = __an; RF_MARCO = rfMarco(RF);',ctx);
        chk('v7.47.1 · B — recém-carregada, a aba não acusa pendência',
          vm.runInContext('rfPendente()',ctx)===false);
        vm.runInContext("RF.contra.compras_lrlp = 50000; rfCalcular();",ctx);
        chk('v7.47.1 · B — o que a aba mostra passa a viver dentro de AN.reforma (espelho)',
          vm.runInContext('(AN.reforma&&AN.reforma.contra&&AN.reforma.contra.compras_lrlp)||0',ctx)===50000);
        chk('v7.47.1 · B — alteração não gravada acusa pendência e a faixa âmbar aparece',
          vm.runInContext('rfPendente()',ctx)===true
          && /Alterações da Reforma ainda não gravadas/.test(ctx.document.getElementById('rf-avisos').innerHTML||''));
        chk('v7.47.1 · B — o espelho é limpo (sem _res/_forn/_vend no que vai ao banco)',
          vm.runInContext("JSON.stringify(rfLimpo(RF)).indexOf('_res')<0 && JSON.stringify(rfLimpo(RF)).indexOf('_forn')<0",ctx));
        vm.runInContext('RF_MARCO = rfMarco(RF); rfCalcular();',ctx);
        chk('v7.47.1 · B — depois de gravar, a pendência sai e a faixa some',
          vm.runInContext('rfPendente()',ctx)===false
          && !/Alterações da Reforma ainda não gravadas/.test(ctx.document.getElementById('rf-avisos').innerHTML||''));
        chk('v7.47.1 · B — anSalvar grava {...AN}: é o espelho que impede a reversão',
          /dados:\{\.\.\.AN, _res:undefined, _verEm:undefined\}/.test(html)
          && /AN\.reforma = rfLimpo\(RF\)/.test(html));
        chk('v7.47.1 · B — a nota das análises de fornecedores voltou à tela (inalcançável desde a v7.44.1)',
          /_av\.innerHTML = [\s\S]{0,900}fornNotaHtml\(\)/.test(html) && /id="rf-avisos"/.test(html));
        ctx.__rfBk=_rf; ctx.__anBk=_an;
        vm.runInContext('RF = __rfBk; AN = __anBk; RF_MARCO = '+JSON.stringify(_mc)+';',ctx);
      }

      // C · o crédito das compras é INFORMADO no parecer e na memória de cálculo
      {
        const anNovo=vm.runInContext('anNovo',ctx), calcular=vm.runInContext('calcular',ctx),
              calcCen=vm.runInContext('calcCenariosReforma',ctx), P=vm.runInContext('PARAMS',ctx),
              ppCred=vm.runInContext('ppCredCompras',ctx), mem=vm.runInContext('rlConfRefMemAno',ctx),
              aliq=vm.runInContext('RF_ALIQ_DEFAULT',ctx), cr58=vm.runInContext('credSimplesArt58',ctx);
        const inp=anNovo('11222333000181',2026);
        for(let m=0;m<12;m++) inp.receitas.a3_semret[m]=10000;
        inp.cfg.iss=.04;
        const res=calcular(inp,P.anexos,P.folha);
        const rf={ receita:120000, baseIS:0, credSimplesPct:0, benefRec:{}, benefCred:{},
                   contra:{ compras_lrlp:50000, compras_simples:20000 }, aliq:JSON.parse(JSON.stringify(aliq)) };
        const C=calcCen(res,rf), L27=C.REF.find(l=>l.ano===2027);
        const alqPc=(aliq[2027].cbs+aliq[2027].ibse+aliq[2027].ibsm);
        const credLR=50000*alqPc/100, credSN=20000*cr58(2027);
        chk('v7.47.1 · C — o crédito bate com as duas classes (regular '+alqPc.toFixed(2)+'% + Simples art. 58)',
          Math.abs(L27.cred-(credLR+credSN))<0.02);
        const txt = ppCred({ cen:C, L33:L27, anoRef:2027 });
        const vLR = credLR.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
        const vSN = credSN.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
        chk('v7.47.1 · C — PARECER informa o crédito das compras por classe de fornecedor',
          /Crédito de IBS\/CBS sobre as compras/.test(txt) && txt.includes(vLR) && txt.includes(vSN)
          && /art\. 58/.test(txt), txt ? '' : 'bloco vazio');
        chk('v7.47.1 · C — o bloco do crédito está montado na página dos caminhos do parecer',
          /\$\{ppCredCompras\(D\)\}/.test(html));
        chk('v7.47.1 · C — sem compras informadas o parecer DIZ que não há crédito (não fica calado)',
          /nenhuma compra informada/.test(ppCred({ cen:calcCen(res,{receita:120000,baseIS:0,credSimplesPct:0,benefRec:{},benefCred:{},contra:{},aliq:aliq}),
            L33:calcCen(res,{receita:120000,baseIS:0,credSimplesPct:0,benefRec:{},benefCred:{},contra:{},aliq:aliq}).REF.find(l=>l.ano===2027), anoRef:2027 })));
        const m27 = mem(C, L27, res);
        chk('v7.47.1 · C — MEMÓRIA abre o crédito com a base das compras (70.000,00, por classe)',
          /Compras que geram crédito \(base do ano\)/.test(m27) && m27.includes('70.000,00')
          && /regime regular/.test(m27) && /Simples\/MEI/.test(m27));
      }
    }
  }

  // ═══ 5y. v7.42.5 · v7.43.0 · v7.43.1 — projeção pela importação, média da janela,
  //        INSS pelo cadastro da empresa e exclusão por RPC ═══
  console.log('\n■ v7.42.5/v7.43.0/v7.43.1 — período coberto, média da janela e ciclo de exclusão');
  {
    const proj = (d, j) => vm.runInContext('anProjetarAno', ctx)(d, j);
    const ultCob = d => vm.runInContext('ultimoMesCoberto', ctx)(d);

    // (a) v7.43.1 — o período coberto vem da IMPORTAÇÃO, não do último mês com receita.
    // Caso real do usuário: PGDAS-D de jan a jun, receita só em jan, fev e abr.
    const base = () => { const d = mk({ a1_semst: z() }, 0); d.receitas.a1_semst = z(); return d; };
    const dImp = base();
    dImp.receitas.a1_semst[0] = 10000; dImp.receitas.a1_semst[1] = 20000; dImp.receitas.a1_semst[3] = 30000;
    dImp.origem = { 'receitas.a1_semst': ['P','P','P','P','P','P',null,null,null,null,null,null] };
    chk('v7.43.1 · o período coberto vai até o último mês IMPORTADO (jun), não até o último com receita (abr)',
      ultCob(dImp) === 5, `último coberto = m${ultCob(dImp)+1}`);

    const rImp = proj(dImp, 'todos');
    const mediaImp = rImp && rImp.dados.receitas.a1_semst[6];
    chk('v7.42.5 · a média divide pelo nº de meses da JANELA (60.000 ÷ 6 = 10.000), não pelos meses com movimento',
      rImp && Math.abs(mediaImp - 10000) < 0.01, `projetado = ${mediaImp}`);
    chk('v7.42.5 · os meses parados do período coberto são nomeados na memória (mar, mai, jun)',
      rImp && rImp.semReceita.join(',') === '2,4,5', rImp ? 'semReceita=' + rImp.semReceita.join(',') : 'sem projeção');
    chk('v7.43.1 · ano projetado = média × 12 (60.000 ÷ 6 × 12 = 120.000)',
      rImp && Math.abs(rImp.dados.receitas.a1_semst.reduce((s, x) => s + x, 0) - 120000) < 0.02);

    // (b) v7.43.1 — digitar na grade NÃO estende o período. Digitar zero não é apurar zero.
    const dDig = base();
    dDig.receitas.a1_semst[0] = 10000; dDig.receitas.a1_semst[1] = 20000; dDig.receitas.a1_semst[3] = 30000;
    dDig.origem = { 'receitas.a1_semst': ['D','D','D','D','D','D', null, null, null, null, null, null] };
    chk('v7.43.1 · origem "D" (digitado) não estende o período coberto — para em abr',
      ultCob(dDig) === 3, `último coberto = m${ultCob(dDig)+1}`);

    // (c) não-regressão: 12 meses cobertos não geram projeção alguma
    const dCheio = base(); for (let m = 0; m < 12; m++) dCheio.receitas.a1_semst[m] = 10000;
    chk('v7.43.1 · ano completo não produz projeção (não-regressão)', proj(dCheio, 'todos') === null);

    // (d) v7.43.0 — o INSS patronal sai do cadastro da empresa, não de percentual escrito à mão.
    // O bug era um pc(0.2896) literal na memória anual enquanto o motor usava 28,596% de fábrica.
    const fpe = vm.runInContext('folhaPercDaEmpresa', ctx);
    const padrao = fpe({}), somaPadrao = (padrao.patronalSalarios + padrao.rat + padrao.terceiros) * 100;
    chk('v7.43.0 · percentual de fábrica é 28,596% (20 + 5,80 + 2,796) — o 28,96% do relatório era literal',
      Math.abs(somaPadrao - 28.596) < 0.001, somaPadrao.toFixed(3) + '%');
    const proprio = fpe({ folhaPerc: { rat: 0.02 } });
    chk('v7.43.0 · percentual configurado na empresa vence o de fábrica',
      Math.abs(proprio.rat - 0.02) < 1e-9 && Math.abs(proprio.patronalSalarios - padrao.patronalSalarios) < 1e-9);
    chk('v7.43.0 · a memória anual lê folhaPercDaEmpresa e não traz mais o percentual literal',
      !/pc\(0\.2896\)/.test(html) && /folhaPercDaEmpresa/.test(html));

    // (e) v7.43.0 — cancelamento cooperativo da importação
    chk('v7.43.0 · a barra de progresso tem botão de cancelar e bandeira cooperativa',
      /let IMP_CANCELAR = false;/.test(html) && /function impCancelar\(\)/.test(html)
      && /id="imp-cancelar"/.test(html));
    chk('v7.43.0 · o cancelamento é conferido dentro dos laços de importação (nota a nota / CNPJ a CNPJ)',
      (html.match(/IMP_CANCELAR/g) || []).length >= 5);

    // (f) ciclo de vida — a exclusão foi para RPC SECURITY DEFINER na v7.41.1 e as três
    // continuam lá. Um PATCH de volta reintroduz o 42501 corrigido pelos setups v7440/v7450.
    for (const rpc of ['atp_excluir_dados', 'atp_excluir_empresa', 'atp_excluir_usuario'])
      chk(`ciclo de vida · a exclusão passa por rpc/${rpc} (nunca PATCH — RLS recusa)`,
        new RegExp("supa\\('POST','rpc/" + rpc + "'").test(html));
    chk('ciclo de vida · a chamada de RPC vai com semPrefer (Prefer de upsert quebra a função)',
      (html.match(/semPrefer:\s*true/g) || []).length >= 3);
    chk('ciclo de vida · supa() só manda Prefer de merge-duplicates quando NÃO é RPC',
      /method==='POST' && !semPrefer\) headers\['Prefer'\] = 'resolution=merge-duplicates'/.test(html));
  }

  // ═══ 5x. v7.51.0 → v7.55.3 — pacote dos achados A–Q ═══════════════════════════════════════
  // Portado do harness jsdom (tests_run_v7_55_3.js). Aqui vai o que roda em vm puro; a leitura de
  // XML de NFS-e usa fixtures embutidas, para não depender de arquivo externo no CI.
  console.log('\n■ v7.51.0–v7.55.3 · pacote A–Q');
  {
    const anNovo = vm.runInContext('anNovo', ctx), calcular = vm.runInContext('calcular', ctx);
    const ANX = vm.runInContext('ANEXOS_DEFAULT', ctx), FP = vm.runInContext('FOLHA_PERC_DEFAULT', ctx);
    const calc = i => calcular(JSON.parse(JSON.stringify(i)), JSON.parse(JSON.stringify(ANX)), Object.assign({}, FP));
    const perto = (a, b, t) => Math.abs((+a||0) - (+b||0)) <= (t == null ? 0.02 : t);
    const zerar = i => { for (const k of Object.keys(i.receitas)) i.receitas[k] = Array(12).fill(0);
      i.folha.prolabore = Array(12).fill(0); i.folha.salarios = Array(12).fill(0); i.folha.baseFgts = Array(12).fill(0);
      i.cfg.rbt12Lanc = Array(12).fill(0); i.cfg.folha12Lanc = Array(12).fill(0); return i; };

    chk('v7.56.1 · pacote A–Q · changelog das nove versões registrado',
      html.includes('<b>v7.56.1</b>') && html.includes('<b>v7.56.0</b>')
      && html.includes('<b>v7.55.4</b>') && html.includes('<b>v7.51.0</b>'));
    // ── v7.56.0 · o payload do parecer leva o que o pacote mudou ──
    for (const [rot, re] of [
      ['inicioAtividade (limites proporcionais e RBT12p)', /inicioAtividade: \(function\(\)\{/],
      ['reducoesIbsCbs (abertura por parcela)', /reducoesIbsCbs: \(D\.L33 && Array\.isArray\(D\.L33\.dedParcelas\)/],
      ['pontosDeAtencaoDoSistema (ressalvas de dado)', /pontosDeAtencaoDoSistema: \(function\(\)\{/],
    ]) chk('v7.56.0 · payload do parecer leva ' + rot, re.test(html));
    chk('v7.56.0 · as regras de texto novas acompanham o payload',
      /o teto e o sublimite do ano NÃO são R\$ 4,8 mi/.test(html)
      && /a redução do regime diferenciado incide sobre a ALÍQUOTA/.test(html)
      && /O ISS RETIDO na fonte não reduz a base do IBS\/CBS/.test(html));

    // ── N · RBT12 proporcionalizado (Res. CGSN 140/2018, art. 22, §§ 2º e 3º) ──
    const ref = zerar(anNovo('11222333000181', 2026));
    ref.cfg.inicioAtividade = '2026-01';
    ref.receitas.a3_semret = [20000,40000,60000,50000,0,0,0,0,0,0,0,0];
    const rRef = calc(ref);
    chk('v7.52.0 · RBT12p: 1º mês = receita do próprio mês × 12', perto(rRef.meses[0].rbt12, 240000));
    chk('v7.52.0 · RBT12p: 2º mês = receita do 1º × 12', perto(rRef.meses[1].rbt12, 240000));
    chk('v7.52.0 · RBT12p: 3º e 4º meses = média dos anteriores × 12',
      perto(rRef.meses[2].rbt12, 360000) && perto(rRef.meses[3].rbt12, 480000));
    chk('v7.52.0 · RBT12p: a receita do mês apurado NÃO entra na janela',
      perto(rRef.meses[3].rbt12, 480000) && rRef.meses[3].recInt === 50000);
    chk('v7.52.0 · DAS de abril no Anexo III = 4.912,50 (efetiva 9,825%)',
      perto(rRef.meses[3].das, 4912.50), rRef.meses[3].das.toFixed(2));

    // Caso A — Kleyton, início jun/2025: a regra reproduz os seis DAS declarados
    const jun25 = 11931.14, resto = (122074.96 - jun25) / 6;
    const mkA = comData => { const i = zerar(anNovo('61106836000160', 2026));
      i.cfg.iss = .05; if (comData) i.cfg.inicioAtividade = '2025-06';
      i.cfg.rbt12Lanc = [0,0,0,0,0, jun25, resto,resto,resto,resto,resto,resto];
      i.receitas.a4 = [18535.50,19285.21,1800,23600,13048,9338,0,0,0,0,0,0];
      i.folha.prolabore = [0,1621,1621,6800,1621,1621,0,0,0,0,0,0]; return i; };
    const rA = calc(mkA(true)), rAs = calc(mkA(false));
    const declarado = [950.77, 995.05, 93.62, 1138.83, 651.47, 459.08];
    declarado.forEach((d, i) => chk(`v7.52.0 · Caso A ${['jan','fev','mar','abr','mai','jun'][i]} reproduz o PGDAS-D declarado`,
      perto(rA.meses[i].das, d), rA.meses[i].das.toFixed(2) + ' × ' + d.toFixed(2)));
    chk('v7.52.0 · Caso A · jun é o 13º mês e sai da proporcionalização',
      rA.meses[5].rbt12Prop === false && rA.meses[5].mesAtividade === 13);
    chk('v7.52.0 · Caso A · jan cai na 2ª faixa do Anexo IV (RBT12p 209.271,36)',
      rA.meses[0].faixa === 2 && perto(rA.meses[0].rbt12, 209271.36));
    chk('v7.52.0 · SEM data de início o comportamento da v7.50.0 é preservado ao centavo',
      perto(rAs.meses[0].das, 834.10) && rAs.meses[0].rbt12Prop === false);
    const zm = zerar(anNovo('11222333000181', 2026));
    zm.cfg.inicioAtividade = '2026-01'; zm.receitas.a3_semret = [30000,0,30000,0,0,0,0,0,0,0,0,0];
    chk('v7.52.0 · mês sem receita entra no divisor da média (decisão 8.14)',
      perto(calc(zm).meses[2].rbt12, 30000/2*12));

    // ── limite e sublimite proporcionais (LC 123, art. 3º, §§ 2º e 3º) ──
    const pa = vm.runInContext('propAtividade', ctx);
    chk('v7.55.0 · sem data de início nada é proporcionalizado',
      pa({ ano:2026 }).proporcional === false && pa({ ano:2026 }).fator === 1);
    chk('v7.55.0 · início em jun do PRÓPRIO ano → 7 meses',
      pa({ ano:2025, inicioAtividade:'2025-06' }).meses === 7);
    chk('v7.55.0 · no ano SEGUINTE o limite volta a ser integral (Kleyton em 2026)',
      pa({ ano:2026, inicioAtividade:'2025-06' }).proporcional === false);
    chk('v7.55.0 · fração de mês conta como mês inteiro (início em dez → 1 mês)',
      pa({ ano:2026, inicioAtividade:'2026-12' }).meses === 1);
    const ini = zerar(anNovo('11222333000181', 2026));
    ini.cfg.inicioAtividade = '2026-07';
    ini.receitas.a1_semst = [0,0,0,0,0,0, 700000,700000,700000,700000,700000,700000];
    const rIni = calc(ini);
    const mon = vm.runInContext('monitorSublimite', ctx)(rIni, ini.cfg);
    const ele = vm.runInContext('snElegibilidade', ctx)(rIni, ini.cfg);
    chk('v7.55.0 · sublimite e limite proporcionais a 6 meses',
      perto(mon.subLim, 1800000, 0.01) && perto(mon.limite, 2400000, 0.01));
    chk('v7.55.0 · teto da elegibilidade também proporcional', perto(ele.teto, 2400000, 0.01));
    chk('v7.55.0 · os TRÊS quadros leem a mesma fonte de meses (propAtividade)',
      mon.propAtividade.meses === ele.propAtividade.meses && rIni.propAtividade.meses === 6);

    // ── J · ordem das operações na parcela com redução de IBS/CBS ──
    const RFRED = vm.runInContext('RF_REDUCOES', ctx);
    const rl = vm.runInContext('rfLinhaBase', ctx);
    const q33 = vm.runInContext('Object.assign({}, RF_ALIQ_DEFAULT[2033], (PARAMS.reforma||{})[2033]||{})', ctx);
    const alq33 = (q33.cbs + q33.ibse + q33.ibsm) / 100;
    const p60 = RFRED.find(x => Math.abs(x[2] - .60) < 1e-9) || RFRED[0];
    const vazio = { benefCred:{}, contra:{}, baseIS:0, credSimplesPct:0 };
    const LJ = rl(Object.assign({ receita:1000000, benefRec:{ [p60[0]]:1000000 } }, vazio), 2033, 30000);
    chk('v7.54.0 · J · a dedução alcança a parcela reduzida: (1.000.000 − 30.000) × alíq × (1 − red)',
      perto(LJ.deb, (1000000 - 30000) * alq33 * (1 - p60[2])), LJ.deb.toFixed(2));
    chk('v7.54.0 · J · e nunca o resultado sem dedução na parcela reduzida',
      Math.abs(LJ.deb - 1000000 * alq33 * (1 - p60[2])) > 1);
    const LM = rl(Object.assign({ receita:1000000, benefRec:{ [p60[0]]:400000 } }, vazio), 2033, 30000);
    chk('v7.54.0 · J · rateio proporcional à base em empresa mista (decisão 8.7)',
      perto(LM.deb, (600000 - 18000) * alq33 + (400000 - 12000) * alq33 * (1 - p60[2])));
    chk('v7.54.0 · J · o rateio não perde nem duplica a dedução',
      perto((LM.dedParcelas||[]).reduce((a,x)=>a+x.ded, 0), 30000));
    chk('v7.54.0 · J · o rateio é exibível por parcela (decisão 8.8)',
      Array.isArray(LM.dedParcelas) && LM.dedParcelas.length === 2);
    chk('v7.54.0 · J · sem parcela reduzida reproduz a v7.53.0 ao centavo',
      perto(rl(Object.assign({ receita:1000000, benefRec:{} }, vazio), 2033, 30000).deb,
            (1000000 - 30000) * alq33, 0.005));

    // ── K · projeção integral da aba Reforma ──
    const rfP = vm.runInContext('rfProjetar', ctx);
    const aba = { receita:600000, compras:100000, baseIS:0, credSimplesPct:8,
                  benefRec:{ [p60[0]]:240000 }, benefCred:{ [p60[0]]:40000 }, contra:{ compras_lrlp:100000 } };
    const P2 = rfP(aba, 2);
    chk('v7.54.0 · K · o fator k alcança receita, parcela reduzida E crédito beneficiado',
      perto(P2.receita, 1200000) && perto(P2.benefRec[p60[0]], 480000) && perto(P2.benefCred[p60[0]], 80000));
    chk('v7.54.0 · K · percentuais NÃO são multiplicados pelo k', P2.credSimplesPct === 8);
    chk('v7.54.0 · K · invariância: a composição percentual não muda com o k',
      Math.abs(P2.benefRec[p60[0]]/P2.receita - aba.benefRec[p60[0]]/aba.receita) < 1e-9);

    // ── L · o ISS retido não reduz a base do IBS/CBS (decisão 8.9) ──
    chk('v7.54.0 · L · a dedução usa o lp.iss puro, sem somar o ISS retido',
      /const dedIss = a >= 2027 \? lpIss \* \(\+_q0\.remIcmsIss\|\|0\) : 0;/.test(html));
    const cr = zerar(anNovo('11222333000181', 2026));
    cr.cfg.iss = .05; cr.cfg.rbt12Lanc = Array(12).fill(50000);
    cr.receitas.a3_semret = Array(12).fill(30000); cr.receitas.a3_retiss = Array(12).fill(20000);
    const rCr = calc(cr);
    const cen = vm.runInContext('calcCenariosReforma', ctx)(rCr,
      { receita:600000, benefRec:{}, benefCred:{}, contra:{}, baseIS:0, credSimplesPct:0 });
    const issLP = rCr.meses.reduce((a,m)=>a+m.lp.iss, 0);
    const issRet = rCr.meses.reduce((a,m)=>a+(m.issRetLPLR||0), 0);
    const L27 = cen.REF.find(x => x.ano === 2027);
    chk('v7.54.0 · L · dedIss é o ISS do Presumido, e o retido fica de fora',
      perto(L27.dedIss, issLP) && issRet > 1000 && Math.abs(L27.dedIss - (issLP + issRet)) > 1);

    // ── M · exportação de serviços com Fator R ──
    const mkExp = folhaMes => { const i = zerar(anNovo('11222333000181', 2026));
      i.cfg.iss = .05; i.cfg.rbt12Lanc = Array(12).fill(40000); i.cfg.rbt12ExpLanc = Array(12).fill(40000);
      i.cfg.folha12Lanc = Array(12).fill(folhaMes); i.receitas.a5r_exp = Array(12).fill(30000);
      i.folha.prolabore = Array(12).fill(folhaMes); return i; };
    const rBaixo = calc(mkExp(1000)), rAlto = calc(mkExp(40000));
    chk('v7.54.0 · M · Fator R abaixo de 28% na exportação → Anexo V; acima → Anexo III',
      rBaixo.meses[0].fatorR < .28 && rAlto.meses[0].fatorR >= .28 && rBaixo.meses[0].das > rAlto.meses[0].das + 1);
    const fxE = rBaixo.meses[0].faixaExp - 1, rbtE = rBaixo.meses[0].rbt12Exp;
    const efE5 = (rbtE * ANX.V.aliq[fxE] - ANX.V.ded[fxE]) / rbtE;
    chk('v7.54.0 · M · alíquota do a5r_exp: faixa do RBT12 EXTERNO, sem ISS e sem PIS/COFINS',
      Math.abs(rBaixo.meses[0].efb.a5r_exp - efE5 * Math.max(0, 1 - ANX.V.iss[fxE] - ANX.V.piscof[fxE])) < 1e-9);
    chk('v7.54.0 · M · o a5r_exp parte para o anexo resultante do Fator R',
      (rBaixo.meses[0].dasAx.V||0) > 0 && (rAlto.meses[0].dasAx.III||0) > 0);
    chk('decisão 8.11 · o ISS do LP e do LR já não incidia sobre serviço exportado',
      perto(rBaixo.meses[0].lp.iss, 0, 0.005) && perto(rBaixo.meses[0].lr.iss, 0, 0.005));
    // v7.55.3 · o a5r_exp COMPÕE a presunção de IRPJ/CSLL — bug achado pela varredura
    const mkPres = bloco => { const i = zerar(anNovo('11222333000181', 2026));
      i.cfg.iss = .05; i.cfg.lpBaseServ = .32;
      i.cfg.rbt12Lanc = Array(12).fill(40000); i.cfg.rbt12ExpLanc = Array(12).fill(40000);
      i.receitas[bloco] = Array(12).fill(30000); return i; };
    const rPresFR = calc(mkPres('a5r_exp')), rPresLei = calc(mkPres('a3_exp'));
    chk('v7.55.3 · o a5r_exp entra na presunção de IRPJ do Presumido (servIR)',
      perto(rPresFR.meses[0].lp.irpj, 30000 * .32 * .15));
    chk('v7.55.3 · e produz a MESMA presunção do a3_exp — os dois são exportação de serviço',
      perto(rPresFR.meses[0].lp.irpj, rPresLei.meses[0].lp.irpj, 0.005));

    // ── v7.55.3 · fim da fórmula paralela na estimativa do trimestre em aberto ──
    const trib = vm.runInContext('lrTribDoPeriodo', ctx);
    chk('v7.55.3 · lrTribDoPeriodo: IRPJ 15% + CSLL 9% e adicional sobre o excesso do período',
      perto(trib(100000,3).irpj + trib(100000,3).csll, 24000, 0.005)
      && perto(trib(100000,3).adicional, 4000, 0.005) && perto(trib(50000,3).adicional, 0, 0.005));
    chk('v7.55.3 · a estimativa do trimestre em aberto usa a regra única, não números literais',
      /lrTribDoPeriodo\(base, nm\)\.total/.test(html) && !/base\*\.15 \+ base\*\.09/.test(html));

    // ── A e B · reconstrutor da faixa e classificador com guarda ──
    const rec = vm.runInContext('pgdasRbt12Implicito', ctx);
    const impOk = rec(950.77/18535.50, ANX.IV);
    chk('v7.51.0 · A · o reconstrutor devolve a 2ª faixa do Anexo IV e o RBT12 implícito',
      impOk.estado === 'ok' && impOk.faixa === 2 && perto(impOk.X, 209272.82, 1.0));
    chk('v7.51.0 · A · a 1ª faixa (PD = 0) devolve indeterminado, nunca um número',
      rec(ANX.IV.aliq[0], ANX.IV).estado === 'indeterminado');
    chk('v7.51.0 · A · efetiva impossível não produz faixa candidata', rec(0.9, ANX.IV).estado === 'sem-faixa');
    const cls = vm.runInContext('pgdasClassificar', ctx);
    const cSemData = cls(mkA(false), rAs.meses[0], 950.77);
    chk('v7.51.0 · B · sem data de início o classificador diz que NÃO SABE',
      cSemData && cSemData.tipo === 'sem-data' && !/faltam/i.test(cSemData.txt));
    chk('v7.51.0 · B · com a data preenchida e já proporcionalizado, não acusa lacuna',
      (cls(mkA(true), rA.meses[0], 950.77)||{}).tipo === 'prop-ok');
    const cNova = cls(mkA(true), rAs.meses[0], 950.77);
    chk('v7.51.0 · B · empresa nova sem proporcionalizar → hipótese é a RBT12p, com o mês de atividade',
      cNova && cNova.tipo === 'prop-faltando' && /8º mês de atividade/.test(cNova.txt));

    // ── C, D, E, F, G, H, I · exibição e avisos ──
    const jan = vm.runInContext('rlConfJanelas', ctx);
    const qNova = jan({ cfg:{ ano:2026, inicioAtividade:'2025-06',
      rbt12Lanc:[0,0,0,0,0,jun25,resto,resto,resto,resto,resto,resto], folha12Lanc:Array(12).fill(0) } });
    const qVelha = jan({ cfg:{ ano:2026,
      rbt12Lanc:[100,100,100,0,100,100,100,100,100,100,100,100], folha12Lanc:Array(12).fill(10) } });
    chk('v7.55.1 · C · o quadro das janelas distingue empresa nova de lacuna',
      /início de atividade/.test(qNova) && /não são lacuna/.test(qNova)
      && /Janela do RBT12 incompleta/.test(qVelha) && /11 de 12/.test(qVelha));
    chk('v7.55.1 · C · e imprime a conta da RBT12p com os valores substituídos', /÷ 7 × 12/.test(qNova));
    chk('v7.55.2 · D · o aviso de configuração pede a data de início em vez de supor lacuna',
      /nRbt > 0 && nRbt < 12 && paCfg == null/.test(html));
    chk('v7.51.0 · E · a repetição ⇉ marca origem C e C fica fora de ORIG_IMPORTACAO',
      /anOrigemMarcar\(path, \[1,2,3,4,5,6,7,8,9,10,11\], 'C'\)/.test(html)
      && vm.runInContext("ORIG_IMPORTACAO.indexOf('C')", ctx) === -1
      && !!vm.runInContext('ORIGEM_ROT.C', ctx));
    chk('v7.51.0 · F · selo de custo zero com compras lançadas', /Custo da mercadoria não lançado/.test(html));
    chk('v7.51.0 · G · adicional do LP com os valores substituídos',
      /base do período de apuração/.test(html));
    chk('v7.51.0 · H · a linha do ICMS das aquisições perdeu o sinal de soma',
      !/\(\+\) ICMS das aquisições fora do crédito/.test(html) && /já refletido na linha acima/.test(html));
    chk('v7.51.0 · I · aviso de despesas sem crédito de PIS/COFINS no LR',
      /Nenhum crédito de PIS\/COFINS sobre despesas/.test(html));
    const gc = zerar(anNovo('11222333000181', 2026));
    gc.cfg.iss = .03; gc.receitas.a3_semret = Array(12).fill(120000);
    const rG = calc(gc);
    chk('v7.51.0 · G · o motor expõe base e limite do período do adicional',
      rG.meses[2].lp.baseAdicPer > 0 && rG.meses[2].lp.limAdicPer === 60000
      && perto(rG.meses[2].lp.adicional, Math.max(0, rG.meses[2].lp.baseAdicPer - 60000) * .10));

    // ── O · NFS-e (fixtures embutidas: os dois layouts da mesma remessa) ──
    const xp = vm.runInContext('xmlParseNota', ctx);
    const xmlA = '<?xml version="1.0"?>\r\n<Notas><xml><DATA_EMISSAO>02/01/2026</DATA_EMISSAO>'
      + '<N_DA_NFSE>76</N_DA_NFSE><VALOR_DOS_SERVICOS>41850</VALOR_DOS_SERVICOS>'
      + '<ALIQUOTA_ISS>3,0674</ALIQUOTA_ISS><CODIGO_SERVICO>1720</CODIGO_SERVICO>'
      + '<CPFCNPJ_PRESTADOR>34686135000174</CPFCNPJ_PRESTADOR><ESTADO_PRESTADOR>34686135000174</ESTADO_PRESTADOR>'
      + '<CODIGO_MUNIC_FEDERAL_PRESTADOR>8233</CODIGO_MUNIC_FEDERAL_PRESTADOR>'
      + '<CPFCNPJ_TOMADOR>12345678000199</CPFCNPJ_TOMADOR></xml></Notas>';
    const xmlB = '<?xml version="1.0" encoding="ISO-8859-1"?>\n<nfse><nf><numero_nfse>77</numero_nfse>'
      + '<serie_nfse>1</serie_nfse><data_nfse>02/02/2026</data_nfse><data_fato>02/02/2026</data_fato>'
      + '<situacao_codigo_nfse>1</situacao_codigo_nfse><valor_total>41.850,00</valor_total>'
      + '<valor_tributavel>41.850,00</valor_tributavel><valor_deducao>0,00</valor_deducao>'
      + '<valor_issrf>0,00</valor_issrf><valor_ir>0,00</valor_ir><valor_inss>0,00</valor_inss>'
      + '<valor_contribuicao_social>0,00</valor_contribuicao_social><valor_pis>0,00</valor_pis><valor_cofins>0,00</valor_cofins>'
      + '<chave_acesso_nfse_nacional>42119001234686135000174000000000007726020000000003</chave_acesso_nfse_nacional></nf>'
      + '<prestador><cpfcnpj>34686135000174</cpfcnpj><cidade>8233</cidade></prestador>'
      + '<tomador><cpfcnpj>12345678000199</cpfcnpj></tomador>'
      + '<itens><lista><codigo_item_lista_servico>172001</codigo_item_lista_servico>'
      + '<aliquota_item_lista_servico>3,1834</aliquota_item_lista_servico></lista></itens></nfse>';
    const nA = xp(xmlA, 'NFSE_76'), nB = xp(xmlB, 'NFSE_77');
    chk('v7.53.0 · O · os DOIS layouts são reconhecidos pela raiz do XML',
      nA.tipo === 'NFS-e' && nB.tipo === 'NFS-e' && nA.layout !== nB.layout, nA.layout + ' | ' + nB.layout);
    chk('v7.53.0 · O · valores e competências corretos nos dois',
      perto(nA.valor, 41850) && perto(nB.valor, 41850) && nA.mes === 0 && nB.mes === 1);
    chk('v7.53.0 · O · o layout simplificado DECLARA cancelamento e retenção não verificáveis',
      nA.cancelamentoIndeterminado === true && nA.retencaoIndeterminada === true
      && nB.cancelamentoIndeterminado !== true);
    chk('v7.53.0 · O · valor sem separador é sinalizado (regra dos decimais ainda em aberto)',
      nA.valorSemSeparador === true);
    chk('v7.53.0 · O · ESTADO_PRESTADOR com CNPJ não vira UF', !nA.uf && !nA.estado);
    chk('v7.53.0 · O · chave nacional no layout B e chave DERIVADA no layout A (decisão 8.19)',
      /^42119001/.test(nB.chave || '') && /^DER:8233-34686135000174-0*76-2601$/.test(nA.chaveDerivada || ''),
      nA.chaveDerivada);
    chk('v7.53.0 · O · item da lista normalizado entre os dois layouts', nA.item === nB.item, nA.item + ' × ' + nB.item);
    chk('v7.53.0 · O · base do ISS guardada à parte do valor_total (decisão 8.17)',
      perto(nB.baseIss, 41850) && perto(nB.valor, 41850));
    const avisos = vm.runInContext('nfseAvisosLote', ctx)([nA, nB]);
    chk('v7.53.0 · O · o lote avisa dos dois layouts e do cancelamento não verificável',
      /layouts diferentes/.test(avisos) && /cancelamento não é verificável/.test(avisos));
    chk('v7.53.0 · O · a alíquota da nota varia e o lote diz que ela NÃO configura a empresa (decisão 8.18)',
      /alimenta a Configuração/.test(avisos));
    chk('v7.53.0 · O · a alíquota da nota nunca é escrita em cfg.iss',
      !/AN\.cfg\.iss\s*=\s*aliqIssMax/.test(html));

    // ── P · a data de início na planilha modelo, lida como texto ──
    chk('v7.55.1 · P · a data de início entrou no modelo e é lida como texto, não como número',
      /\['cfg\.inicioAtividade','Início de atividade/.test(html)
      && /path === 'cfg\.inicioAtividade'/.test(html) && /serial de data do Excel/.test(html));

    // ── divergências declaradas ──
    const div = vm.runInContext('rlConfDivergencias', ctx)();
    for (const [rot, re] of [
      ['RBT12 proporcionalizado', /RBT12 proporcionalizado/],
      ['mês sem receita no divisor', /Mês sem receita entra no divisor/],
      ['limite proporcional só no ano de início', /apenas no ano-calendário de início/],
      ['ISS retido fora da dedução', /ISS retido fora da dedução/],
      ['ordem das operações na redução', /ordem das operações/],
      ['alíquota da NFS-e não configura', /não configura a empresa/],
      ['Excel não reimplementa regra tributária', /não<\/b> reimplementa regra tributária/],
    ]) chk('papel de trabalho · ' + rot + ' consta das divergências declaradas', re.test(div));

    // ── Q · a planilha em Excel e o teste de IDENTIDADE (decisão 8.12) ──
    // O SheetJS entra por <script src> no navegador; no sandbox do CI ele não existe. Injetamos a
    // única função usada pelo gerador — aoa_to_sheet — para que a identidade seja conferida aqui.
    if (typeof ctx.XLSX === 'undefined') {
      const colName = n => { let s2 = ''; n++; while (n > 0) { const r = (n - 1) % 26; s2 = String.fromCharCode(65 + r) + s2; n = (n - 1 - r) / 26; } return s2; };
      ctx.XLSX = { utils: { aoa_to_sheet(aoa){ const ws = {};
        aoa.forEach((linha, i) => (linha || []).forEach((cel, j) => {
          if (cel == null || cel === '') return;
          ws[colName(j) + (i + 1)] = (typeof cel === 'object') ? cel
            : (typeof cel === 'number' ? { t:'n', v:cel } : { t:'s', v:String(cel) });
        })); return ws; } } };
      vm.runInContext('this.XLSX = XLSX;', ctx);
    }
    const dQ = mkA(false), rQ = calc(dQ);
    const wb = vm.runInContext('qxWb', ctx)(dQ, rQ);
    chk('v7.55.0 · Q · a pasta traz as sete abas, com Entradas e Parâmetros isoladas',
      wb.SheetNames.length === 7 && wb.SheetNames.includes('Entradas') && wb.SheetNames.includes('Parâmetros'),
      wb.SheetNames.join(' · '));
    // avaliador do subconjunto de fórmulas que o gerador produz
    const val = (sh, ref) => { const c = wb.Sheets[sh][ref]; if (!c) return 0;
      return c.f ? calcF(sh, c.f) : (+c.v || 0); };
    const rng = (sh, a, b) => { const A = a.match(/([A-Z]+)(\d+)/), B = b.match(/([A-Z]+)(\d+)/), o = [];
      for (let c = A[1].charCodeAt(0); c <= B[1].charCodeAt(0); c++)
        for (let r = +A[2]; r <= +B[2]; r++) o.push(val(sh, String.fromCharCode(c) + r));
      return o; };
    function calcF(sh, f){ let e = f;
      e = e.replace(/SUM\(([A-Z]+\d+):([A-Z]+\d+)\)/g, (_,a,b) => '(' + rng(sh,a,b).reduce((x,y)=>x+y,0) + ')');
      e = e.replace(/MAX\(ABS\(([A-Z]+\d+):([A-Z]+\d+)\)\)/g, (_,a,b) => '(' + Math.max(0, ...rng(sh,a,b).map(Math.abs)) + ')');
      e = e.replace(/MAX\(0,([^)]+)\)/g, (_,x) => '(Math.max(0,' + x + '))');
      e = e.replace(/'([^']+)'!([A-Z]+\d+)/g, (_,s2,r) => '(' + val(s2, r) + ')');
      e = e.replace(/([A-Za-zÀ-ú]+)!([A-Z]+\d+)/g, (_,s2,r) => '(' + val(s2, r) + ')');
      e = e.replace(/(^|[^A-Za-z0-9_.])([A-Z]+\d+)/g, (m,p2,r) => p2 + '(' + val(sh, r) + ')');
      return Function('Math', 'return ' + e)(Math); }
    const acha = (sh, rot) => { for (let r = 1; r < 400; r++)
      if (wb.Sheets[sh]['A'+r] && String(wb.Sheets[sh]['A'+r].v).indexOf(rot) === 0) return r; return -1; };
    const rSN = acha('Simples','TOTAL DO SIMPLES'), rLP = acha('Lucro Presumido','TOTAL DO LUCRO PRESUMIDO'),
          rLR = acha('Lucro Real','TOTAL DO LUCRO REAL');
    chk('v7.55.0 · Q · IDENTIDADE · Simples: a fórmula anual reproduz o motor ao centavo',
      perto(calcF('Simples', wb.Sheets['Simples']['N'+rSN].f), rQ.totais.simples, 0.005));
    chk('v7.55.0 · Q · IDENTIDADE · Lucro Presumido',
      perto(calcF('Lucro Presumido', wb.Sheets['Lucro Presumido']['N'+rLP].f), rQ.totais.lp, 0.005));
    chk('v7.55.0 · Q · IDENTIDADE · Lucro Real',
      perto(calcF('Lucro Real', wb.Sheets['Lucro Real']['N'+rLR].f), rQ.totais.lr, 0.005));
    let piorRF = 0;
    for (let r = 2; r < 20; r++){ const c = wb.Sheets['Reforma']['D'+r]; if (!c || !c.f) continue;
      piorRF = Math.max(piorRF, Math.abs(calcF('Reforma', c.f) - (+c.v||0))); }
    chk('v7.55.0 · Q · IDENTIDADE · Reforma ano a ano (2026 é ano-teste: líquido zero por lei)',
      piorRF <= 0.005, piorRF.toFixed(4));
    let piorMes = 0;
    for (let i = 0; i < 12; i++){ const col = String.fromCharCode(66+i);
      piorMes = Math.max(piorMes, Math.abs(calcF('Simples', wb.Sheets['Simples'][col+rSN].f) - rQ.meses[i].simples.total)); }
    chk('v7.55.0 · Q · IDENTIDADE · Simples mês a mês', piorMes <= 0.005, piorMes.toFixed(4));
    chk('v7.55.0 · Q · a aba Conferência fecha em ZERO — é o teste que quebra o CI',
      perto(calcF('Conferência', wb.Sheets['Conferência']['B'+acha('Conferência','MAIOR DIFERENÇA')].f), 0, 0.005));
    chk('v7.55.0 · Q · as parcelas e os totais são fórmulas vivas, não valores colados',
      !!(wb.Sheets['Simples']['B'+acha('Simples','DAS do mês')]||{}).f
      && !!(wb.Sheets['Simples']['B'+rSN]||{}).f && !!(wb.Sheets['Simples']['N'+rSN]||{}).f);
  }

  // ═══ 5y. v7.61.0 · REMEDIAÇÃO DO ISS HERDADO DE NFS-e ═══
  // O que se testa aqui é o CRITÉRIO (quem entra na lista) e as travas da correção.
  // O que NÃO se testa: a ida ao banco — ela é do PostgREST, não do motor.
  {
    console.log('\n■ v7.61.0 — remediação do ISS herdado de NFS-e');
    const sus = vm.runInContext('issSuspeito', ctx);
    chk('v7.61.0 · a alíquota do Simples das notas reais é apontada (3,0674% · 3,1834% · 3,0886%)',
      sus(0.030674) && sus(0.031834) && sus(0.030886));
    chk('v7.61.0 · alíquota de município NÃO é apontada (2% · 2,5% · 3% · 5% · 3,25%)',
      !sus(0.02) && !sus(0.025) && !sus(0.03) && !sus(0.05) && !sus(0.0325));
    chk('v7.61.0 · zero e vazio ficam fora da lista (empresa sem ISS não é achado)',
      !sus(0) && !sus(null) && !sus(undefined) && !sus(''));
    chk('v7.61.0 · o critério é a 3ª casa do PERCENTUAL, não da fração',
      sus(0.030001) && !sus(0.0300), 'limite: 3,0001% entra · 3,0000% não');

    // a varredura é somente leitura: nenhuma escrita no caminho do diagnóstico
    const fonte = html.slice(html.indexOf('async function issVarrer'),
                             html.indexOf('function issRender'));
    chk('v7.61.0 · a varredura só LÊ (nenhum POST/PATCH/DELETE em issVarrer)',
      !/supa\('(POST|PATCH|DELETE)'/.test(fonte) && /supa\('GET'/.test(fonte));
    chk('v7.61.0 · a varredura pede só a configuração, não a análise inteira',
      /select:'cnpj,ano,status,atualizado_em,cfg:dados->cfg'/.test(fonte));
    chk('v7.61.0 · e tem plano B se o servidor não aceitar o seletor de campo do JSON',
      /catch\(e\)\{[\s\S]*select:'cnpj,ano,status,atualizado_em,dados'/.test(fonte));

    const corr = html.slice(html.indexOf('async function issCorrigir'),
                            html.indexOf('// ═══════════ v7.61.0'.replace('v7.61.0','PARÂMETROS')) > 0
                            ? html.indexOf('// ═══════════ PARÂMETROS ═══════════')
                            : html.length);
    chk('v7.61.0 · corrigir exige papel de administrador', /exigirAdmin\('issCorrigir'\)/.test(corr));
    chk('v7.61.0 · análise FECHADA é recusada, não contornada',
      /status\|\|''\)\.toLowerCase\(\)==='fechada'/.test(corr) && /reabra/i.test(corr));
    chk('v7.61.0 · a gravação passa pelo histórico da análise (anHistGravar)',
      /anHistGravar\(body\[0\]\)/.test(corr));
    chk('v7.61.0 · o efeito é mostrado ANTES de gravar, e o motor é quem calcula',
      corr.indexOf('calcular(dNovo') < corr.indexOf('dlgSimNao') &&
      corr.indexOf('dlgSimNao') < corr.indexOf("supa('POST'"));
    chk('v7.61.0 · não existe correção em lote (a alíquota certa varia por município)',
      !/for *\([^)]*ISS_ACHADOS/.test(corr) && !/forEach\([^)]*issCorrigir/.test(html));
    chk('v7.61.0 · a alíquota informada é validada como percentual de 0 a 100',
      /pc >= 0 && pc <= 100/.test(corr));

    // PROVA DE MOTOR: trocar cfg.iss move LP e LR e NÃO move o Simples
    const _fxISS = path.join(__dirname,'fixtures','caso1.json');
    const fxISS = fs.existsSync(_fxISS) ? JSON.parse(fs.readFileSync(_fxISS,'utf8')).inp : null;
    if (fxISS) {
      const base = JSON.parse(JSON.stringify(fxISS));
      base.cfg.iss = 0.030674;                     // o valor herdado da nota
      base.receitas.a3_semret = base.receitas.a3_semret.map(()=>50000);   // garante serviço
      const r1 = g.calcular(base, clone(AD), {...FD});
      const b2 = JSON.parse(JSON.stringify(base)); b2.cfg.iss = 0.03;     // o do município
      const r2 = g.calcular(b2, clone(AD), {...FD});
      chk('v7.61.0 · o ISS herdado realmente distorce o Presumido e o Real',
        Math.abs(r1.totais.lp - r2.totais.lp) > 0.01 && Math.abs(r1.totais.lr - r2.totais.lr) > 0.01,
        'ΔLP ' + (r1.totais.lp - r2.totais.lp).toFixed(2) + ' · ΔLR ' + (r1.totais.lr - r2.totais.lr).toFixed(2));
      chk('v7.61.0 · e NÃO move o Simples (nele o ISS vem da partilha do anexo)',
        Math.abs(r1.totais.simples - r2.totais.simples) <= 0.005,
        'Δ ' + (r1.totais.simples - r2.totais.simples).toFixed(4));
    } else console.log('  (fixtures ausentes — prova de motor do ISS pulada)');
  }

  // ═══ 5z. v7.62.0 · M3 · ARREDONDAMENTO POR TRIBUTO, LIGÁVEL POR EMPRESA ═══
  // O que faz esta opção ser segura é ela NÃO existir por padrão. Os testes abaixo
  // guardam exatamente isso: a chave ausente mantém o motor idêntico, e o lacre e os
  // 754 gabaritos ficam fora do alcance de quem ligar a opção numa empresa.
  {
    console.log('\n■ v7.62.0 — M3 · arredondamento por tributo (opção por empresa)');
    const _fxM = path.join(__dirname,'fixtures','caso2.json');
    const fxM = fs.existsSync(_fxM) ? JSON.parse(fs.readFileSync(_fxM,'utf8')) : null;

    chk('v7.62.0 · M3 · o seletor existe na Configuração da empresa',
      /id="cf-arredtrib"/.test(html) && /Por tributo, como a guia/.test(html));
    chk('v7.62.0 · M3 · o padrão da tela é o total do mês (opção "nao" pré-selecionada)',
      /<option value="nao" \$\{c\.arredondaPorTributo\?'':'selected'\}/.test(html));
    chk('v7.62.0 · M3 · a configuração é lida e gravada pelo funil único',
      /arredondaPorTributo: \(vRaw\('cf-arredtrib'/.test(html));
    chk('v7.62.0 · M3 · desligar APAGA a chave (ausente ≠ false)',
      /if \(AN\.cfg\.arredondaPorTributo !== true\) delete AN\.cfg\.arredondaPorTributo/.test(html));

    // anNovo não pode semear a chave, senão toda análise nova entraria no regime da guia
    const novo = vm.runInContext("anNovo('00000000000000', 2026)", ctx);
    chk('v7.62.0 · M3 · análise nova NÃO nasce com a chave',
      !('arredondaPorTributo' in (novo.cfg||{})));
    const norm = vm.runInContext("anNormalizar({cfg:{}}, '00000000000000', 2026)", ctx);
    chk('v7.62.0 · M3 · o normalizador também não a cria em análise antiga',
      !('arredondaPorTributo' in (norm.cfg||{})));

    if (fxM) {
      const semK = JSON.parse(JSON.stringify(fxM.inp));
      const comK = JSON.parse(JSON.stringify(fxM.inp)); comK.cfg.arredondaPorTributo = true;
      const rSem = g.calcular(semK, clone(AD), {...FD}), rCom = g.calcular(comK, clone(AD), {...FD});
      chk('v7.62.0 · M3 · LIGADA, a opção muda o DAS (senão não estaria ligada a nada)',
        Math.abs(rSem.totais.das - rCom.totais.das) > 0.005,
        'Δ ano R$ ' + (rCom.totais.das - rSem.totais.das).toFixed(4));
      chk('v7.62.0 · M3 · e o efeito é de CENTAVOS: nenhum mês desvia mais de R$ 0,10',
        rSem.meses.every((m,i) => Math.abs(m.das - rCom.meses[i].das) <= 0.10),
        'maior desvio mensal R$ ' + Math.max(...rSem.meses.map((m,i)=>Math.abs(m.das-rCom.meses[i].das))).toFixed(4));
      chk('v7.62.0 · M3 · o Presumido e o Real NÃO se movem (a opção só toca o DAS)',
        Math.abs(rSem.totais.lp - rCom.totais.lp) < 0.005 && Math.abs(rSem.totais.lr - rCom.totais.lr) < 0.005);
      chk('v7.62.0 · M3 · DESLIGADA, o resultado é idêntico ao de antes da opção existir',
        Math.abs(rSem.totais.das - fxM.gab.das[12]) < 0.015 &&
        Math.abs(rSem.totais.simples - fxM.gab['simples.total'][12]) < 0.015);
    } else console.log('  (fixtures/caso2.json ausente — provas de motor do M3 puladas)');

    // A PROVA QUE SUSTENTA A DECISÃO: os casos do lacre não têm a chave, então
    // ligar a opção numa empresa não move o selo nem os gabaritos.
    const lac = vm.runInContext('lacreRodar()', ctx);
    chk('v7.62.0 · M3 · o lacre 47f3f10b segue íntegro com a opção disponível',
      lac && lac.ok === true && lac.hash === '47f3f10b', 'hash=' + (lac && lac.hash));
    const casosLimpos = vm.runInContext('LACRE_CASOS', ctx)
      .every(c => !('arredondaPorTributo' in (c.inp.cfg||{})));
    chk('v7.62.0 · M3 · e os casos-gabarito seguem SEM a chave — é isso que os protege',
      casosLimpos);

    // o papel de trabalho tem de declarar em qual regime a empresa está, nos DOIS sentidos
    chk('v7.62.0 · M3 · as divergências declaradas cobrem os dois estados',
      /Arredondamento do DAS \(v7\.62\.0\)/.test(html)
      && /arredondar <b>tributo a tributo<\/b>/.test(html)
      && /arredondado <b>uma vez, no total do mês<\/b>/.test(html));
  }

  // ═══ 6a. v7.63.0 · CORREÇÕES DA AUDITORIA (achados A01 a A11) ═══
  // Cada teste aqui existe porque o defeito EXISTIU e passou por 510 verificações sem ser visto.
  // Os testes antigos provam que o cálculo certo continua certo; estes alimentam o motor com
  // dado impossível, que era exatamente o vão por onde os 11 achados entraram.
  {
    console.log('\n■ v7.63.0 — correções da auditoria');
    const z12 = () => Array(12).fill(0);
    const anNovo3 = vm.runInContext('anNovo', ctx);
    const baseNova = (rec) => { const i = anNovo3('11222333000181', 2026);
      for (const k of Object.keys(i.receitas)) i.receitas[k] = z12();
      i.receitas.a3_semret = Array(12).fill(rec); i.cfg.iss = .02;
      i.cfg.rbt12Lanc = z12(); i.cfg.inicioAtividade = ''; return i; };

    // ── A01 · RBT12 zero com receita não pode dar DAS zero ──
    const rA = g.calcular(baseNova(100000), clone(AD), {...FD});
    chk('A01 · mês com receita e RBT12 zero NÃO apura DAS zero',
      rA.meses[0].das > 0, 'DAS jan = ' + rA.meses[0].das.toFixed(2));
    chk('A01 · a presunção é a do 1º mês de atividade (receita × 12)',
      Math.abs(rA.meses[0].rbt12 - 1200000) < 0.01 && rA.meses[0].rbt12Presumido === true,
      'RBT12 jan = ' + rA.meses[0].rbt12);
    chk('A01 · e ela vale para o mês, não para o ano: fevereiro volta ao dado real',
      rA.meses[1].rbt12Presumido === false && Math.abs(rA.meses[1].rbt12 - 100000) < 0.01);
    const semRec = baseNova(0);
    const rA0 = g.calcular(semRec, clone(AD), {...FD});
    chk('A01 · mês SEM receita não presume nada (a regra não inventa base)',
      rA0.meses[0].rbt12Presumido === false && rA0.meses[0].das === 0);
    chk('A01 · a presunção é DECLARADA nas divergências do papel de trabalho',
      /RBT12 presumida \(v7\.63\.0\)/.test(html) && /art\. 22, § 2º/.test(html));

    // ── A02/A03/A04 · faixa de validação ──
    const fx2 = vm.runInContext('faixaAplicar', ctx);
    chk('A02 · alíquota de ISS negativa é corrigida para zero, com aviso',
      fx2('cfg.iss', -0.05).v === 0 && /negativ/i.test(fx2('cfg.iss', -0.05).aviso || ''));
    chk('A02 · 1200% (erro de digitação de 12) não passa',
      fx2('cfg.iss', 12).v === 1 && !!fx2('cfg.iss', 12).aviso);
    chk('A02 · ISS acima de 5% AVISA mas OBEDECE (sociedade uniprofissional existe)',
      fx2('cfg.iss', 0.06).v === 0.06 && /incomum/i.test(fx2('cfg.iss', 0.06).aviso || ''));
    chk('A02 · alíquota normal não gera ruído', fx2('cfg.iss', 0.03).aviso === null);
    chk('A03 · redução acima de 100% é limitada a 100%', fx2('red_pct', 5).v === 1);
    chk('A04 · receita negativa é zerada, com a razão dita ao usuário',
      fx2('receita', -50000).v === 0 && /devolução de venda/i.test(fx2('receita', -50000).aviso || ''));
    chk('A02/A03/A04 · a validação está no funil único da grade e da Configuração',
      /faixaDoPath\(path\)/.test(html) && /gFx\('cf-iss'/.test(html));

    // efeito no motor: o que a faixa impede
    const neg = baseNova(100000); neg.cfg.iss = -0.05;
    const rNeg = g.calcular(neg, clone(AD), {...FD});
    chk('A02 · sem a faixa, o ISS negativo chegaria ao Presumido — o motor não muda, a entrada é que passa a barrar',
      rNeg.meses.reduce((s,M)=>s+M.lp.iss,0) < 0,
      'prova de que a barreira é na ENTRADA, não no motor (por decisão: o motor não corrige dado)');

    // ── A02/A03/A04 (2ª varredura) · o que vem de ARQUIVO também passa pela faixa ──
    // A primeira correção cobria só a digitação; os importadores gravavam direto nos arrays.
    const san = vm.runInContext('anSanear', ctx);
    const sujo = { receitas:{ a3_semret:[-50000,100000,0,0,0,0,0,0,0,0,0,0],
                              a1_red_pct:[5,0,0,0,0,0,0,0,0,0,0,0] },
                   folha:{ salarios:[-2000,0,0,0,0,0,0,0,0,0,0,0] }, compras:{}, despesas:{} };
    const aj = san(sujo);
    chk('A02-04 · o saneamento pega valor impossível vindo de arquivo',
      aj.length === 3 && sujo.receitas.a3_semret[0] === 0
      && sujo.receitas.a1_red_pct[0] === 1 && sujo.folha.salarios[0] === 0,
      aj.length + ' ajuste(s)');
    chk('A02-04 · e NOMEIA cada ajuste (não corrige em silêncio)',
      aj.every(t => /de \w+:/.test(t) && /→/.test(t)), aj[0] || '');
    const limpo = { receitas:{ a3_semret:Array(12).fill(100000) }, folha:{}, compras:{}, despesas:{} };
    chk('A02-04 · análise sadia não sofre ajuste nenhum', san(limpo).length === 0);
    chk('A02-04 · o saneamento está no FUNIL de toda importação (anAplicado)',
      /function anAplicado\(\)\{[\s\S]{0,400}anSanear\(AN\)/.test(html));
    chk('A02-04 · e o verificador acusa o que já estava gravado fora de faixa',
      /valor\(es\) fora de faixa<\/b>` \+ ` já gravados|valor\(es\) fora de faixa/.test(html));

    // ── A05 · importadores com rede de proteção ──
    for (const fn of ['pgdasAplicar','balAplicar','fatAplicar','demAplicar','anHistRestaurar'])
      chk('A05 · ' + fn + ' passa por comBotao (trava o botão e mostra o erro)',
        html.includes("comBotao(this,'Aplicando',()=>" + fn + "(")
        || html.includes("comBotao(this,'Restaurando',()=>" + fn + "("),
        'chamadas diretas restantes: ' + (html.split('onclick="' + fn + '(').length - 1));

    // ── A06 · a trava não fecha com prova muda ──
    chk('A06 · o snapshot da trava carrega a falha do cálculo dos cenários',
      /cen2033Erro: cenErro/.test(html) && /catch\(e\)\{ cenErro =/.test(html));
    chk('A06 · e o catch daquele ponto deixou de ser vazio',
      !/const L33 = C\.REF\[C\.REF\.length-1\];\s*\n\s*cen = \{ dentro: cenDentro\(T, L33\), hib: L33\.hib, regular: L33\.regular \}; \} catch\(e\)\{\}/.test(html));

    // ── A07 · relatório não omite a Reforma em silêncio ──
    chk('A07 · há tarja declarando que a Reforma não pôde ser calculada',
      /A projeção da Reforma não pôde ser calculada/.test(html)
      && /não consta deste documento/.test(html));
    chk('A07 · e ela é emitida ANTES do resumo sintético',
      html.indexOf('let h = tarjaReforma') > 0);

    // ── A08 · bloqueio otimista falha para o lado seguro ──
    chk('A08 · não conseguindo verificar a versão, o app PERGUNTA antes de gravar',
      /Não foi possível verificar se esta análise foi gravada por outra pessoa/.test(html));

    // ── A09 · saldo credor de PIS/COFINS declarado na memória ──
    const cred = JSON.parse(JSON.stringify(JSON.parse(
      fs.readFileSync(path.join(__dirname,'fixtures','caso2.json'),'utf8')).inp));
    cred.compras.semst = Array(12).fill(500000);
    const rC = g.calcular(cred, clone(AD), {...FD});
    chk('A09 · o motor JÁ estava certo: base tributável zero, nunca negativa',
      rC.meses[0].lr.basePC === 0 && rC.meses[0].lr.pis === 0 && rC.meses[0].lr.cofins === 0);
    chk('A09 · e o excesso vira saldo credor transportado ao mês seguinte',
      rC.meses[0].lr.saldoCredorFim > 0
      && Math.abs(rC.meses[1].lr.saldoCredorAnt - rC.meses[0].lr.saldoCredorFim) < 0.01,
      'saldo jan → fev: ' + rC.meses[0].lr.saldoCredorFim.toFixed(2));
    chk('A09 · o que faltava era a memória DIZER isso',
      /Saldo credor a transportar/.test(html) && /a base é ZERO/.test(html));

    // ── A10 · silêncio proposital fica marcado ──
    const vazios = (html.match(/catch\s*\([^)]*\)\s*\{\s*\}/g) || []).length;
    chk('A10 · os catch propositais foram marcados e os indevidos, corrigidos',
      vazios <= 9, 'catch vazios sem marca restantes: ' + vazios);

    // ── A11 · guardas de divisão ──
    chk('A11 · a alíquota da 5ª faixa não divide por zero',
      /const ef5 = A => rbt12 > 0 \?/.test(html));
    chk('A11 · os dashboards não exibem NaN% com carteira vazia',
      !/\/tot\*100\)\.toFixed\(1\)/.test(html) && /\/\(tot\|\|1\)\*100\)\.toFixed\(1\)/.test(html));

    // ── A rede continua de pé ──
    const lacA = vm.runInContext('lacreRodar()', ctx);
    chk('auditoria · nenhuma das 11 correções moveu o lacre',
      lacA && lacA.ok === true && lacA.hash === '47f3f10b', 'hash=' + (lacA && lacA.hash));
  }

  // ═══ 6b. v7.64.0 · CONFRONTO COM O VERIFICADOR INDEPENDENTE ═══
  // Resposta ao achado 3.4 do parecer externo: a conferência anterior reutilizava as tabelas do
  // próprio aplicativo, e por isso não conseguiria pegar tabela errada nem escolha errada de anexo.
  // tests/verificador_independente.js digita os Anexos I a V da LC 123/2006 e a repartição por
  // tributo, decide sozinho o anexo pelo Fator R, e só então compara.
  {
    console.log('\n■ v7.64.0 — confronto com o verificador independente');
    let V = null;
    try { V = require('./verificador_independente'); }
    catch(e){ console.log('  (tests/verificador_independente.js ausente — confronto pulado)'); }
    if (V) {
      const z12 = () => Array(12).fill(0);
      const nova = (cnpj) => { const a = vm.runInContext('anNovo', ctx)(cnpj, 2026);
        for (const k of Object.keys(a.receitas)) a.receitas[k] = z12(); return a; };
      const casos = [];
      { const a = nova('11111111000191'); a.cfg.rbt12Lanc = Array(12).fill(35000);
        a.receitas.a1_semst = Array(12).fill(40000); a.folha.salarios = Array(12).fill(6000);
        a.folha.baseFgts = Array(12).fill(6000); casos.push(['comércio Anexo I', a]); }
      { const a = nova('22222222000172'); a.cfg.rbt12Lanc = Array(12).fill(100000);
        a.cfg.folha12Lanc = Array(12).fill(24000); a.receitas.a5r = Array(12).fill(100000);
        a.folha.salarios = Array(12).fill(24000); a.cfg.iss = .03;
        casos.push(['Fator R abaixo de 28% → Anexo V', a]); }
      { const a = nova('22222222000173'); a.cfg.rbt12Lanc = Array(12).fill(100000);
        a.cfg.folha12Lanc = Array(12).fill(30000); a.receitas.a5r = Array(12).fill(100000);
        a.folha.salarios = Array(12).fill(30000); a.cfg.iss = .03;
        casos.push(['Fator R acima de 28% → Anexo III', a]); }
      { const a = nova('33333333000153'); a.cfg.rbt12Lanc = Array(12).fill(60000);
        a.receitas.a1_semst = Array(12).fill(30000); a.receitas.a1_comst = Array(12).fill(20000);
        a.receitas.a1_mono = Array(12).fill(10000); a.folha.salarios = Array(12).fill(8000);
        a.folha.baseFgts = Array(12).fill(8000); casos.push(['ST e monofásico', a]); }
      { const a = nova('44444444000144'); a.cfg.rbt12Lanc = Array(12).fill(80000);
        a.receitas.a3_semret = Array(12).fill(50000); a.receitas.a3_retiss = Array(12).fill(30000);
        a.folha.salarios = Array(12).fill(20000); a.cfg.iss = .05;
        casos.push(['ISS retido', a]); }
      // achado 5.3 do 2º parecer: retenção de ISS junto com Fator R ABAIXO de 28% — o cenário
      // anterior tinha Fator R de 40% e escondia o comportamento.
      { const a = nova('88888888000188'); a.cfg.rbt12Lanc = Array(12).fill(100000);
        a.cfg.folha12Lanc = Array(12).fill(15000);           // Fator R ~15%, bem abaixo de 28%
        a.receitas.a5r = Array(12).fill(70000); a.receitas.a3_retiss = Array(12).fill(30000);
        a.folha.salarios = Array(12).fill(15000); a.cfg.iss = .04;
        casos.push(['a5r no Anexo V + ISS retido no Anexo III', a]); }
      { const a = nova('55555555000155'); a.cfg.rbt12Lanc = Array(12).fill(330000);
        a.receitas.a1_semst = Array(12).fill(340000); a.folha.salarios = Array(12).fill(40000);
        a.folha.baseFgts = Array(12).fill(40000); casos.push(['6ª faixa com trava da 5ª', a]); }
      for (const teto of [180000, 360000, 720000, 1800000, 3600000])
        for (const [rot, rbt] of [['no teto', teto], ['acima', teto+1]]) {
          const a = nova('7777777' + teto + rbt); a.cfg.rbt12Lanc = Array(12).fill(rbt/12);
          a.receitas.a1_semst = Array(12).fill(20000); a.folha.salarios = Array(12).fill(3000);
          a.folha.baseFgts = Array(12).fill(3000);
          casos.push([`faixa · RBT12 ${rot} de ${teto}`, a]); }

      let coincidem = 0; const diverg = [];
      for (const [nome, ent] of casos) {
        const app = g.calcular(clone(ent), clone(AD), {...FD});
        const ind = V.apurar(clone(ent));
        const cmp = (item, a, b, tol) => { if (Math.abs(a-b) <= tol) coincidem++;
          else diverg.push(`${nome} · ${item}: independente ${(+a).toFixed(4)} × app ${(+b).toFixed(4)}`); };
        for (let m = 0; m < 12; m++) {
          cmp(`RBT12 m${m+1}`, ind.meses[m].rbt12, app.meses[m].rbt12, 0.02);
          cmp(`faixa m${m+1}`, ind.meses[m].faixa, app.meses[m].faixa, 0);
          cmp(`Fator R m${m+1}`, ind.meses[m].fatorR, app.meses[m].fatorR, 0.0005);
          cmp(`DAS m${m+1}`, ind.meses[m].das, app.meses[m].das, 0.02);
          const axI = [...new Set(Object.values(ind.meses[m].porBloco).map(b=>b.ax))].sort().join(',');
          const axA = [...new Set((app.meses[m].ins.blocos||[]).map(b=>{ const k=b.k;
            return /^a1|comtransp/.test(k)?'I':/^a2/.test(k)?'II':/^a4/.test(k)?'IV'
              :k==='a5r'?(app.meses[m].fatorR>=.28?'III':'V'):'III'; }))].sort().join(',');
          if (axI === axA) coincidem++; else diverg.push(`${nome} · anexo m${m+1}: ${axI} × ${axA}`);
        }
        cmp('DAS do ano', ind.totais.das, app.totais.das, 0.05);
        cmp('trava do ano', ind.totais.trava, app.totais.sublimite||0, 0.05);
      }
      chk(`v7.64.0 · motor × verificador INDEPENDENTE: ${coincidem} conferências em ${casos.length} casos`,
        diverg.length === 0, diverg.slice(0,3).join(' | '));
      chk('v7.64.0 · o verificador decide o anexo sozinho e acerta a fronteira dos 28%',
        diverg.length === 0 && casos.length >= 16);
      chk('v7.64.0 · as tabelas digitadas somam 100% em todas as faixas (achado do 2º parecer)',
        typeof V.conferirTabelas === 'function' && V.conferirTabelas().length === 0,
        (V.conferirTabelas ? V.conferirTabelas() : ['sem autoverificação']).join(' · '));
      chk('v7.64.0 · e ele NÃO importa nada do aplicativo',
        !fs.readFileSync(path.join(__dirname,'verificador_independente.js'),'utf8')
          .match(/require\(|index\.html/));
    }
  }

  console.log(FALHAS.length ? `✗ ${FALHAS.length} FALHA(S): ${FALHAS.join(' · ')}` : `✓✓ SUÍTE COMPLETA: ${OK} verificações OK`);
  process.exit(FALHAS.length ? 1 : 0);
})();
