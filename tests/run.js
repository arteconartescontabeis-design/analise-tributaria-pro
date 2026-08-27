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
    chk('v7.49.0 · versão e changelog registrados (badge sai do APP_VERSAO)',
      /const APP_VERSAO = '7\.49\.0';/.test(html) && html.includes('<b>v7.49.0</b>') && html.includes('<b>v7.48.3</b>'));

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
  console.log(FALHAS.length ? `✗ ${FALHAS.length} FALHA(S): ${FALHAS.join(' · ')}` : `✓✓ SUÍTE COMPLETA: ${OK} verificações OK`);
  process.exit(FALHAS.length ? 1 : 0);
})();
