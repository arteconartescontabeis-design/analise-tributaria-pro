#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════════════════
//  Simulação de Incorporação — suíte de testes (roda local e no GitHub Actions)
//  Uso:  node tests/run_incorporacao.js      (a partir da raiz do repositório)
//  Lê ../incorporacao.html E ../index.html e valida:
//   1. o motor copiado é IDÊNTICO ao do index (byte a byte, bloco a bloco) e reproduz o lacre;
//   2. identidade: consolidar UMA empresa devolve a própria empresa, ao centavo;
//   3. neutralidade do zero: [A, vazia] ≡ A;
//   4. progressividade: consolidada de caso1+caso2 ≠ soma das isoladas, com o sinal esperado;
//   5. intragrupo: o abatimento reduz receita do vendedor e compras/despesas do comprador no mesmo
//      valor, nos meses do rateio, e não toca em mais nada;
//   6. premissas da incorporadora: trocar a ordem troca ISS/ICMS e só;
//   7. projeção individual antes da soma;
//   8. prejuízo da incorporada não passa para a consolidada;
//   9. snapshot: o que se grava reexibe o mesmo quadro sem recalcular;
//  10. tela: botões, tabela própria, Edge Function própria, badge e changelog;
//  11. (v1.1.0) relatórios: os 4 relatórios do index rodam sobre a consolidada e as isoladas e batem
//      com os totais do quadro; isolada = o que o index mostraria; snapshot regera pelo motor.
//  Sai com código ≠ 0 em qualquer falha.
// ════════════════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const RAIZ = path.join(__dirname, '..');
const { blocos } = require(path.join(RAIZ, 'tools', 'extrair_blocos.js'));
const htmlIdx = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const htmlInc = fs.readFileSync(path.join(RAIZ, 'incorporacao.html'), 'utf8');
const jsInc = [...htmlInc.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]).join('\n');

let OK = 0, FALHAS = [];
const chk = (nome, cond, det) => { if (cond) { OK++; console.log('  ✓', nome, det||''); } else { FALHAS.push(nome); console.log('  ✗ FALHA:', nome, det||''); } };
const clone = o => JSON.parse(JSON.stringify(o));
const perto = (a, b, tol=0.015) => Math.abs((+a||0) - (+b||0)) <= tol;

// ── sandbox DOM mínimo (o mesmo da run.js) ──
const mkEl = () => { const el = { innerHTML:'', textContent:'', _v:'', style:{}, classList:{add(){},remove(){},toggle(){}}, dataset:{},
  addEventListener(){}, appendChild(){}, setAttribute(){}, getContext:()=>({}), remove(){}, insertAdjacentHTML(){}, focus(){}, scrollIntoView(){},
  querySelector:()=>mkEl(), querySelectorAll:()=>[], options:[], checked:true, disabled:false };
  Object.defineProperty(el,'value',{ get(){return el._v;}, set(v){el._v=String(v);} }); return el; };
const els = {};
const doc = { getElementById:id=>els[id]||(els[id]=mkEl()), querySelector:()=>mkEl(), querySelectorAll:()=>[], createElement:()=>mkEl(), addEventListener(){}, removeEventListener(){}, body:mkEl(), head:mkEl() };
const ctx = { document:doc, window:{ addEventListener(){}, print(){} }, localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  fetch:async()=>({ok:false,status:0,json:async()=>({}),text:async()=>''}), navigator:{}, console:{...console,log(){},error(){}},
  setTimeout, clearTimeout, alert(){}, confirm:()=>true, URL, atob:s=>s, btoa:s=>s, AbortController, AbortSignal, location:{} };
ctx.window.document = doc; vm.createContext(ctx);
try { vm.runInContext(jsInc, ctx); } catch(e) { console.log('ERRO ao carregar o incorporacao.html no sandbox:', e.message); process.exit(1); }
const g = ctx, R = expr => vm.runInContext(expr, ctx);

// ═══ 1. MOTOR IDÊNTICO ═══
console.log('\n■ Motor copiado × motor do index');
{
  const BI = blocos(htmlIdx);
  const chave = k => `// ┌── copiado do index.html: bloco "${k}"`;
  for (const k of ['nucleo','dialogos','motor','params','helpers','normalizar','iniAtiv','folhaPerc','snEleg','prCarregar','reformaDefs','reformaCalc','ppDoc','ppMedir',
                   'mesesRot','triExp','origemRot','pgBlocos','rfConfExp','rlEstado','rlCharts','rlBaseReforma','rlCnpj','rlRfTrib','conferencia','rlRegimes','rlReforma']){   // v1.1.0: relatórios
    const i = jsInc.indexOf(chave(k)); const fim = jsInc.indexOf('\n// ┌── copiado do index.html', i+10);
    const corpo = i >= 0 ? jsInc.slice(jsInc.indexOf('\n', i)+1, fim > 0 ? fim : undefined).trimEnd() : null;
    chk(`bloco "${k}" idêntico ao index`, corpo !== null && corpo === BI[k].trimEnd(), corpo === null ? 'bloco ausente' : `${corpo.length} bytes`);
  }
  const iL = jsInc.indexOf('// ┌── copiado do index.html: bloco "lacre"');
  const lacreInc = jsInc.slice(jsInc.indexOf('\n', iL)+1, jsInc.indexOf('\n// └── fim dos blocos copiados', iL)).trimEnd();
  chk('bloco "lacre" idêntico salvo a chave do localStorage', lacreInc.replace(/'atp_lacre_inc'/g, "'atp_lacre'") === BI.lacre.trimEnd());
  chk('LACRE_HASH copiado = do index', R('LACRE_HASH') === BI.lacreHash, R('LACRE_HASH'));
  const lr = R('lacreRodar()');
  chk('lacre reproduzido pela cópia', lr.ok && lr.hash === BI.lacreHash, `${lr.hash} · ${lr.n} números`);
  chk('a chave do lacre no localStorage é própria (atp_lacre_inc)', /'atp_lacre_inc'/.test(jsInc) && !/'atp_lacre'/.test(jsInc));
  chk('o index de origem está declarado no cabeçalho', new RegExp('a partir do index.html v' + BI.versao.replace(/\./g,'\\.')).test(htmlInc));
}

// ═══ dados de apoio ═══
const CASOS = R('LACRE_CASOS');
const ent = (lista, ano, janela) => ({ ano, janela: janela||'', empresas: lista.map((e,i) => ({ cnpj: e.cnpj, nome: e.nome, regime: e.regime||'', dados: e.dados, atualizadoEm:null, analiticos:{venda:null,compra:null} })) });
const A = { cnpj:'11111111000191', nome:'A', dados: clone(CASOS[0].inp) };   // comércio 6ª faixa
const Bc = { cnpj:'22222222000192', nome:'B', dados: clone(CASOS[1].inp) };  // serviços, Fator R
const C3 = { cnpj:'33333333000193', nome:'C', dados: clone(CASOS[2].inp) };  // estresse
for (const e of [A,Bc,C3]){ e.dados.cnpj = e.cnpj; }
g.__sim = (E, prem) => R('incSimular')(E, prem || { abatimentos:[] });
const totCmp = (T1, T2, rot) => {
  for (const k of ['receita','simples','lp','lr','das','trava']) chk(`${rot} · ${k}`, perto(T1[k], T2[k]), `${(+T1[k]).toFixed(2)} × ${(+T2[k]).toFixed(2)}`);
  for (const a of Object.keys(T1.anos||{})) for (const k of ['dentro','hib','regular']) if (!perto(T1.anos[a][k], T2.anos[a][k])) chk(`${rot} · ${a} ${k}`, false, `${T1.anos[a][k].toFixed(2)} × ${T2.anos[a][k].toFixed(2)}`);
  chk(`${rot} · cenários 2027-2033 nos 3 caminhos`, Object.keys(T1.anos).length >= 7);
};

// ═══ 2. IDENTIDADE ═══
console.log('\n■ Identidade: consolidar uma empresa devolve a própria empresa');
for (const e of [A, Bc, C3]){
  const S = g.__sim(ent([e], e.dados.ano||2026));
  totCmp(S.consolidada.T, S.empresas[0].T, `[${e.nome}]`);
  chk(`[${e.nome}] Δ = 0 nos três regimes`, perto(S.delta.simples.dif,0) && perto(S.delta.lp.dif,0) && perto(S.delta.lr.dif,0));
}
{ // com bloco de Reforma preenchido
  const e = clone(A); e.dados.reforma = R('rfNovo')(e.cnpj, 2025); e.dados.reforma.receita = 3000000; e.dados.reforma.contra.compras_lrlp = 900000; e.dados.reforma.contra.compras_simples = 200000; e.dados.reforma.benefRec.r30 = 100000;
  const S = g.__sim(ent([e], 2025));
  totCmp(S.consolidada.T, S.empresas[0].T, '[A com Reforma]');
  const rfE = S.empresas[0].reforma; chk('[A com Reforma] o bloco de Reforma consolidado é o da própria (projetado pelo mesmo k)', perto(S.consolidada.reforma.receita, rfE.receita) && perto(S.consolidada.reforma.contra.compras_simples, rfE.contra.compras_simples) && perto(S.consolidada.reforma.benefRec.r30, rfE.benefRec.r30) && perto(rfE.receita, 3000000*S.empresas[0].k), `k=${S.empresas[0].k.toFixed(3)}`);
}

// ═══ 3. NEUTRALIDADE DO ZERO ═══
console.log('\n■ Neutralidade do zero: [A, vazia] ≡ A');
{
  const Z = { cnpj:'44444444000194', nome:'Z', dados: R('anNovo')('44444444000194', 2025) };
  Z.dados.cfg.iss = .05;   // alíquota diferente na incorporada NÃO pode vazar (é da incorporadora)
  const S = g.__sim(ent([A, Z], 2025));
  totCmp(S.consolidada.T, S.empresas[0].T, '[A+vazia]');
  chk('[A+vazia] alerta sobre ISS diferente da incorporadora', S.notas.some(n=>/ISS de Z/.test(n)));
}

// ═══ 4. PROGRESSIVIDADE ═══
console.log('\n■ Progressividade: consolidada ≠ soma das isoladas');
{
  const S = g.__sim(ent([A, Bc], 2025));
  const so = S.soma, co = S.consolidada.T;
  chk('soma das isoladas = Σ das colunas', perto(so.simples, S.empresas[0].T.simples + S.empresas[1].T.simples) && perto(so.lp, S.empresas[0].T.lp + S.empresas[1].T.lp));
  chk('receita consolidada = soma das receitas', perto(co.receita, so.receita));
  chk('Simples consolidado ≠ soma (progressividade do RBT12)', !perto(co.simples, so.simples, 1), `Δ = ${S.delta.simples.dif.toFixed(2)}`);
  chk('RBT12 consolidado = soma dos RBT12 lançados', perto(S.consolidada.dados.cfg.rbt12Lanc[0], A.dados.cfg.rbt12Lanc[0] + Bc.dados.cfg.rbt12Lanc[0]));
  chk('folha do Fator R consolidada = soma', perto(S.consolidada.dados.cfg.folha12Lanc[0], A.dados.cfg.folha12Lanc[0] + Bc.dados.cfg.folha12Lanc[0]));
  { const dAd = co.adicionalLP - so.adicionalLP, dIss = co.issLP - so.issLP, dIcms = co.icmsLP - so.icmsLP;
    chk('LP: Δ = Δ adicional de IRPJ + Δ ISS/ICMS (alíquotas ponderadas) — nada mais muda',
      perto(S.delta.lp.dif, dAd + dIss + dIcms, 0.05), `Δ LP ${S.delta.lp.dif.toFixed(2)} = adicional ${dAd.toFixed(2)} + ISS ${dIss.toFixed(2)} + ICMS ${dIcms.toFixed(2)}`);
    chk('adicional de IRPJ da consolidada > soma dos adicionais (lucros somados cruzam o limite)', dAd > 1, dAd.toFixed(2)); }
  chk('alerta do adicional de IRPJ emitido', S.alertas.some(a=>/Adicional de IRPJ/.test(a.t)));
  chk('alerta de faixa/Fator R emitido', S.alertas.some(a=>/faixa|Fator R/.test(a.t)));
  const RA = R('incAlertas'); chk('incAlertas é função pura exposta', typeof RA === 'function');
}

// ═══ 5. INTRAGRUPO ═══
console.log('\n■ Intragrupo: abatimento simétrico e localizado');
{
  const somaSec = (d, sec, keys) => keys.reduce((s,k)=>s+(d[sec][k]||[]).reduce((a,b)=>a+(+b||0),0),0);
  const cons = R('incConsolidar');
  const lista = [ { cnpj:A.cnpj, nome:'A', regime:'Simples Nacional', dados:clone(A.dados), reforma:null, R:null }, { cnpj:Bc.cnpj, nome:'B', regime:'Lucro Presumido', dados:clone(Bc.dados), reforma:null, R:null } ];
  lista[1].dados.compras.semst = Array(12).fill(50000);
  const sem = cons(lista, [], 2025), com = cons(lista, [{ de:A.cnpj, para:Bc.cnpj, natureza:'mercadoria', valor:120000, meses:[0,1,2,3,4,5], aplicar:true }], 2025);
  const KC = R('INC_REC_COM'), KS = R('INC_REC_SERV');
  const dRec = somaSec(sem.dados,'receitas',KC) - somaSec(com.dados,'receitas',KC);
  const dCmp = somaSec(sem.dados,'compras',['semst','comst','mono','comstMono']) - somaSec(com.dados,'compras',['semst','comst','mono','comstMono']);
  chk('receita de comércio consolidada cai exatamente no valor', perto(dRec, 120000, 0.5), dRec.toFixed(2));
  chk('compras consolidadas caem exatamente no valor', perto(dCmp, 120000, 0.5), dCmp.toFixed(2));
  chk('receita de serviços intocada', perto(somaSec(sem.dados,'receitas',KS), somaSec(com.dados,'receitas',KS)));
  chk('folha intocada', perto(somaSec(sem.dados,'folha',['salarios','prolabore']), somaSec(com.dados,'folha',['salarios','prolabore'])));
  chk('só os meses do rateio (jan–jun) mudam', [6,7,8,9,10,11].every(m => KC.every(k => perto(sem.dados.receitas[k][m], com.dados.receitas[k][m]))));
  chk('abatido registrado na memória', com.abatidos.length===1 && perto(com.abatidos[0].abatidoRec,120000,0.5) && perto(com.abatidos[0].abatidoDest,120000,0.5));
  chk('abatimento não aplicado (aplicar:false) não muda nada', perto(somaSec(cons(lista,[{ de:A.cnpj, para:Bc.cnpj, natureza:'mercadoria', valor:120000, meses:[0], aplicar:false }],2025).dados,'receitas',KC), somaSec(sem.dados,'receitas',KC)));
  // serviço: sai de a3/a4/a5 do vendedor e de despesas do comprador
  const lista2 = [ { cnpj:Bc.cnpj, nome:'B', regime:'Simples Nacional', dados:clone(Bc.dados), reforma:null, R:null }, { cnpj:A.cnpj, nome:'A', regime:'Simples Nacional', dados:clone(A.dados), reforma:null, R:null } ];
  lista2[1].dados.despesas.outras = Array(12).fill(20000);
  const s2 = cons(lista2, [], 2026), c2 = cons(lista2, [{ de:Bc.cnpj, para:A.cnpj, natureza:'servico', valor:60000, meses:[...Array(12).keys()], aplicar:true }], 2026);
  chk('serviço: receita de serviço do vendedor cai no valor', perto(somaSec(s2.dados,'receitas',KS) - somaSec(c2.dados,'receitas',KS), 60000, 0.5));
  chk('serviço: despesas do comprador caem no valor', perto(somaSec(s2.dados,'despesas',['outras','adm','vendas']) - somaSec(c2.dados,'despesas',['outras','adm','vendas']), 60000, 0.5));
  // detecção pelo analítico gravado
  const E = ent([A, Bc], 2025);
  E.empresas[0].analiticos.venda = { periodo:'01/01/2025 a 30/06/2025', itens:[ { cnpj:Bc.cnpj, razao:'B', valor:80000, cfops:{'5102':80000} }, { cnpj:'99999999000199', valor:500, cfops:{'5102':500} } ] };
  E.empresas[1].analiticos.compra = { periodo:'01/01/2025 a 30/06/2025', itens:[ { cnpj:A.cnpj, razao:'A', valor:79000, cfops:{'1102':79000} } ] };
  const det = R('incDetectarIntragrupo')(E);
  const ab = det.find(x=>x.origem==='analitico');
  chk('detecta A → B pelo analítico de venda (80.000, mercadoria, jan–jun)', ab && ab.de===A.cnpj && ab.para===Bc.cnpj && ab.natureza==='mercadoria' && perto(ab.valor,80000) && ab.meses.length===6, JSON.stringify(ab&&{v:ab.valor,m:ab.meses}));
  chk('registra o valor do outro lado quando diverge', ab && perto(ab.outroLado, 79000));
  chk('classifica CFOP 8xxx/9xxx/x933 como serviço', R('incNaturezaCfops')({'9000':100,'5933':50,'5102':10}).serv === 150);
  const S = g.__sim(E, { abatimentos: det });
  chk('simulação aplica o abatimento detectado', S.abatidos.length===1 && perto(S.abatidos[0].abatidoRec, 80000, 0.5));
}

// ═══ 6. PREMISSAS DA INCORPORADORA ═══
console.log('\n■ Premissas da incorporadora');
{
  const S1 = g.__sim(ent([A, Bc], 2025)), S2 = g.__sim(ent([Bc, A], 2025));
  chk('ISS consolidado = ponderado pela receita de serviços (só B presta serviço → ISS de B)', perto(S1.consolidada.dados.cfg.iss, Bc.dados.cfg.iss, 1e-9) && perto(S2.consolidada.dados.cfg.iss, Bc.dados.cfg.iss, 1e-9), S1.consolidada.dados.cfg.iss);
  chk('ICMS de venda consolidado = ponderado pelas vendas de mercadoria (só A vende → ICMS de A)', perto(S1.consolidada.dados.cfg.icmsV, A.dados.cfg.icmsV, 1e-9) && perto(S2.consolidada.dados.cfg.icmsV, A.dados.cfg.icmsV, 1e-9));
  chk('[A,B] presunções, período do LR e adicional vêm de A', ['lpBaseServ','lpBaseCom','lrPeriodo','adicionalIR','sublimite'].every(k => S1.consolidada.dados.cfg[k] === S1.empresas[0].dados.cfg[k]));
  chk('[B,A] idem, de B', ['lpBaseServ','lpBaseCom','lrPeriodo','adicionalIR','sublimite'].every(k => S2.consolidada.dados.cfg[k] === S2.empresas[0].dados.cfg[k]));
  chk('receita, folha e Simples consolidados não dependem da ordem', perto(S1.consolidada.T.receita, S2.consolidada.T.receita) && perto(S1.consolidada.T.folha, S2.consolidada.T.folha) && perto(S1.consolidada.T.simples, S2.consolidada.T.simples));
  chk('a premissa das alíquotas é declarada com os percentuais ponderados', S1.premissas.some(p=>/média ponderada/.test(p) && /incorporadora A/.test(p)));
  { const Bi = clone(Bc); Bi.dados.cfg.iss = .05; const S3 = g.__sim(ent([A, Bi], 2025));
    chk('ISS diferente entre as empresas gera nota com o percentual ponderado', S3.notas.some(n=>/ISS de B/.test(n) && /média ponderada/.test(n))); }
}

// ═══ 7. PROJEÇÃO INDIVIDUAL ═══
console.log('\n■ Projeção individual antes da soma');
{
  const P6 = clone(A); P6.cnpj='55555555000195'; P6.dados.cnpj=P6.cnpj;
  for (const k of Object.keys(P6.dados.receitas)) for (let m=6;m<12;m++) P6.dados.receitas[k][m] = 0;
  P6.dados.origem = {}; for (const k of ['receitas.a1_semst']) P6.dados.origem[k] = Array(12).fill(null).map((_,m)=>m<6?'P':null);
  const S = g.__sim(ent([P6, Bc], 2025));
  chk('só a empresa com 6 meses projeta', S.empresas[0].P && !S.empresas[1].P, S.empresas[0].P && `${S.empresas[0].P.nReais} reais / ${S.empresas[0].P.nProj} estimados`);
  chk('a consolidada tem receita nos 12 meses', S.consolidada.R.meses.every(m => m.receita > 0));
  chk('receita consolidada = projetada de A + B', perto(S.consolidada.T.receita, S.empresas[0].T.receita + S.empresas[1].T.receita));
  chk('alerta de projeção emitido', S.alertas.some(a=>/projetado individualmente/.test(a.t)));
  chk('janela forçada na simulação vale para todas', g.__sim(ent([P6, Bc], 2025, '3')).empresas[0].P.janela === '3');
}

// ═══ 8. PREJUÍZO DA INCORPORADA ═══
console.log('\n■ Prejuízo fiscal da incorporada');
{
  const Bp = clone(Bc); Bp.dados.cfg.lrPrejIrpj = 500000; Bp.dados.cfg.lrPrejCsll = 500000;
  const S = g.__sim(ent([A, Bp], 2025));
  chk('saldo da incorporada NÃO entra na consolidada', +S.consolidada.dados.cfg.lrPrejIrpj === 0 && +S.consolidada.dados.cfg.lrPrejCsll === 0);
  chk('e o parecer avisa (DL 2.341/87, art. 33)', S.alertas.some(a=>/2\.341\/87/.test(a.t) && a.n==='err'));
  const S2 = g.__sim(ent([Bp, A], 2025));
  chk('saldo da INCORPORADORA entra', +S2.consolidada.dados.cfg.lrPrejIrpj === 500000);
  chk('e reduz o Lucro Real consolidado', S2.consolidada.T.lr < S.consolidada.T.lr - 1);
}

// ═══ 9. SNAPSHOT ═══
console.log('\n■ Snapshot: reexibir sem recalcular');
{
  R('INC.entradas = null'); const S = g.__sim(ent([A, Bc], 2025)); R('INC').res = S;
  const snap = R('incSnapshot()'), volta = R('incResDoSnapshot')(clone(snap));
  chk('snapshot carrega versão, lacre e data do cálculo', snap.versao === R('INC_VERSAO') && snap.motorLacre === R('LACRE_HASH') && !!snap.calculadoEm);
  chk('quadro dos regimes idêntico ao reexibir', R('incQuadroHtml')(S) === R('incQuadroHtml')(volta));
  chk('quadro da Reforma idêntico ao reexibir', R('incReformaHtml')(S) === R('incReformaHtml')(volta));
  chk('reabertura fica marcada como snapshot', volta._snapshot === true);
  chk('snapshot serializável e enxuto (< 400 KB)', JSON.stringify(snap).length < 400000, (JSON.stringify(snap).length/1024).toFixed(0)+' KB');
}

// ═══ 10. TELA ═══
console.log('\n■ Tela e integração');
{
  chk('botões Importar dados e Recalcular separados', /onclick="incImportar\(\)"/.test(htmlInc) && /id="inc-btn-recalcular"/.test(htmlInc));
  chk('tabela própria atp_incorporacoes; nada gravado em atp_analises', /INC_TABELA = 'atp_incorporacoes'/.test(htmlInc) && !/supa\('(POST|PATCH)','atp_analises'/.test(jsInc.split('// ═══════════════════════════════════════════════════════════════════════════════════════════')[1]||''));
  chk('exclusão por função SECURITY DEFINER (rpc/atp_excluir_incorporacao)', /rpc\/atp_excluir_incorporacao/.test(htmlInc));
  chk('Edge Function própria gerar-parecer-incorporacao', /INC_FN_IA  = 'gerar-parecer-incorporacao'/.test(htmlInc) && !/supaFn\('gerar-parecer'/.test(htmlInc));
  chk('badge e changelog na aba Versões', /id="badge-versao"/.test(htmlInc) && /INC_CHANGELOG = \[/.test(htmlInc) && new RegExp("\\['" + R('INC_VERSAO') + "'").test(htmlInc));
  chk('conferência cruzada do lacre do index', /fetch\('index\.html'/.test(htmlInc));
  chk('parecer usa o papel timbrado e a régua do ATP', /ppDocumento\(B\)/.test(htmlInc) && /ppReguaRender\(\)/.test(htmlInc) && /capa\.jpg/.test(htmlInc));
  chk('menu volta ao Análise Tributária Pro', /location\.href='index\.html'/.test(htmlInc));
  const S = g.__sim(ent([A, Bc], 2025)); R('INC').res = S;
  let erro = null; try { R('incRender()'); R('incParecerRender()'); } catch(e){ erro = e.message; }
  chk('tela e parecer renderizam sem exceção no sandbox', !erro, erro||'');
  const tx = R('incTextosPadrao')(S);
  chk('textos padrão cobrem todos os campos do parecer', ['intro','empresas','premissas','leitura','reforma','parecer1','parecer2','recomendacao'].every(k => tx[k] && tx[k].length > 20));
}

// ═══ 11. RELATÓRIOS (v1.1.0) ═══
console.log('\n■ Relatórios: os mesmos do index, para a consolidada e cada isolada');
{
  const fmtBR = v => (+v).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const S = g.__sim(ent([A, Bc], 2025)); R('INC').res = S; R('INC').entradas = ent([A, Bc], 2025);
  R('APP').page = 'relatorios';
  chk('menu e página de relatórios existem', /data-page="relatorios"/.test(htmlInc) && /id="page-relatorios"/.test(htmlInc) && /id="rl-tipo"/.test(htmlInc) && /id="inc-rl-lado"/.test(htmlInc));
  chk('os 4 relatórios oferecidos', ['conferencia','regimes','reforma','cnpj'].every(v => new RegExp('<option value="' + v + '"').test(htmlInc)));
  chk('rlRender é PRÓPRIO do incorporação (não o do index)', /async function rlRender\(\)\{\s*\n\s*if \(APP\.page !== 'relatorios'\)/.test(jsInc) && !/^function rlRender\(\) \{/m.test(jsInc));
  chk('Chart.js carregado (gráficos do comparativo e da Reforma)', /Chart\.js\/4\.4\.1\/chart\.umd\.min\.js/.test(htmlInc));
  const ents = R('incRlEntidades()');
  chk('entidades: consolidada + 2 isoladas, sem recálculo quando o resultado é vivo', ents && ents.lista.length === 3 && ents.lista[0].consolidada && !ents.recalculado);
  chk('isolada usa a análise gravada e o resultado REAL, não o projetado (o que o index mostraria)', ents.lista[1].dados.cnpj === A.cnpj && ents.lista[1].res === S.empresas[0].Rreal && S.empresas[0].Rreal !== S.empresas[0].R);
  chk('consolidada usa a análise conjunta e o resultado do motor', ents.lista[0].dados === S.consolidada.dados && ents.lista[0].res === S.consolidada.R);
  const corpoHtml = () => R("document.getElementById('rl-corpo').innerHTML");
  const roda = async (tipo, chave, modo) => {
    R("document.getElementById('rl-tipo')").value = tipo; R("document.getElementById('rl-per')").value = '3';
    R("document.getElementById('inc-rl-vista')").value = 'uma'; R("document.getElementById('inc-rl-ent')").value = chave;
    if (modo) R("document.getElementById('rl-conf-modo')").value = modo;
    await R('rlRender')();
    return corpoHtml();
  };
  (async () => {
    let erro = null, h = '';
    try { h = await roda('regimes', 'cons'); } catch(e){ erro = e.message; }
    chk('Comparativo de regimes da consolidada renderiza', !erro && h.length > 2000, erro || (h.length + ' chars'));
    const TC = S.consolidada.T;
    chk('… e traz o total do Simples da consolidada (o mesmo do quadro)', h.includes(fmtBR(TC.simples)), fmtBR(TC.simples));
    chk('… e o total do Lucro Presumido', h.includes(fmtBR(TC.lp)), fmtBR(TC.lp));
    chk('… e o total do Lucro Real', h.includes(fmtBR(TC.lr)), fmtBR(TC.lr));
    chk('… com a memória de INSS patronal / IRPJ / CSLL', /INSS/.test(h) && /IRPJ/.test(h) && /CSLL/.test(h));
    try { h = await roda('regimes', A.cnpj); } catch(e){ erro = e.message; }
    const TA = S.empresas[0].Rreal.totais;   // realizado da isolada (caso1: 459.601,40 = gabarito)
    chk('Comparativo da isolada A = totais REALIZADOS da isolada (não os da consolidada)', !erro && h.includes(fmtBR(TA.simples)) && h.includes(fmtBR(TA.lp)) && !h.includes(fmtBR(TC.simples)), erro || fmtBR(TA.simples));
    erro = null; try { h = await roda('reforma', 'cons'); } catch(e){ erro = e.message; }
    chk('Reforma da consolidada SEM aba Reforma: mesmo aviso e cenários de fallback do index', !erro && /Sem dados da Reforma/.test(h) && /2033/.test(h), erro || (h.length + ' chars'));
    const a33 = TC.anos[2033]; chk('… e o cenário 2033 bate com o quadro da simulação', a33 && (h.includes(fmtBR(a33.regular)) || h.includes(fmtBR(a33.hib)) || h.includes(fmtBR(a33.dentro))), a33 ? fmtBR(a33.regular) : 'sem 2033');
    // com a aba Reforma preenchida numa das empresas, a consolidada tem Reforma e o relatório sai inteiro
    { const A2 = { cnpj:A.cnpj, nome:'A', dados: clone(A.dados) }; A2.dados.reforma = R('rfNovo')(A.cnpj, 2025); A2.dados.reforma.receita = 1000000;
      const E3 = ent([A2, Bc], 2025), S3 = g.__sim(E3); const guardaRes = R('INC').res, guardaEnt = R('INC').entradas; R('INC').res = S3; R('INC').entradas = E3;
      erro = null; try { h = await roda('reforma', 'cons'); } catch(e){ erro = e.message; }
      chk('Reforma da consolidada COM aba Reforma: transição ano a ano e débito × crédito de IBS/CBS', !erro && S3.consolidada.reforma && /Quadro da transição/.test(h) && /IBS/.test(h) && /CBS/.test(h) && /2033/.test(h), erro || (h.length + ' chars'));
      R('INC').res = guardaRes; R('INC').entradas = guardaEnt; }
    erro = null; try { h = await roda('conferencia', 'cons', 'completo'); } catch(e){ erro = e.message; }
    chk('Conferência (12 meses) da consolidada renderiza', !erro && h.length > 5000, erro || (h.length + ' chars'));
    chk('… com bloco 0 de dados de entrada, trava e sublimite', /Dados de entrada/i.test(h) && /sublimite/i.test(h));
    { const M = S.consolidada.R.meses; chk('… e o DAS, LP e LR de jan e dez da consolidada, ao centavo', [M[0], M[11]].every(x => h.includes(fmtBR(x.dasGuia)) && h.includes(fmtBR(x.lp.total)) && h.includes(fmtBR(x.lr.total))), fmtBR(M[0].dasGuia) + ' … ' + fmtBR(M[11].dasGuia)); }
    erro = null; try { h = await roda('conferencia', Bc.cnpj, 'anual'); } catch(e){ erro = e.message; }
    { const TB = S.empresas[1].Rreal.totais, nums = [...h.matchAll(/\d{1,3}(?:\.\d{3})*,\d{2}/g)].map(x => +x[0].replace(/\./g,'').replace(',','.'));
      const tem = v => nums.some(x => Math.abs(x - v) <= 0.12);   // totais anuais = soma dos meses arredondados (somaExib): até 1 centavo por mês
      chk('Conferência (resumo anual) da isolada B = LP e LR realizados de B', !erro && tem(TB.lp) && tem(TB.lr), erro || fmtBR(TB.lr)); }
    erro = null; try { h = await roda('cnpj', 'cons'); } catch(e){ erro = e.message; }
    chk('Resumo Estatístico da consolidada renderiza (sem rede: cadastro indisponível, segue o resumo)', !erro && /Resumo Estat/i.test(h) && /Cadastro do CNPJ indispon/.test(h), erro || '');
    chk('… com a nota da consolidada (intragrupo fora, parceiro repetido = uma linha)', /deixam de existir com a incorpora/.test(jsInc) && /ficha cadastral exibida/.test(jsInc));
    // lado a lado: três colunas, sem exceção
    erro = null; try { R("document.getElementById('inc-rl-vista')").value = 'lado'; R("document.getElementById('rl-tipo')").value = 'regimes'; await R('rlRender')(); } catch(e){ erro = e.message; }
    chk('lado a lado renderiza as 3 entidades sem exceção', !erro, erro || '');
    // analíticos: intragrupo sai da consolidada e o mesmo parceiro vira uma linha
    const E2 = ent([A, Bc], 2025);
    E2.empresas[0].analiticos.compra = { periodo:'01/2025', em:'2025-02-01', itens:[ { cnpj:'99999999000100', razao:'Forn X', classe:'normal', valor:100, cfops:{'1102':100} }, { cnpj: Bc.cnpj, razao:'B', classe:'simples', valor:50, cfops:{'1102':50} } ] };
    E2.empresas[1].analiticos.compra = { periodo:'01/2025', em:'2025-02-02', itens:[ { cnpj:'99999999000100', razao:'Forn X', classe:'normal', valor:30, cfops:{'1102':30} } ] };
    const fc = R('incRlFornConsolidada')(E2);
    chk('Resumo consolidado: lançamento entre as empresas fica de fora', fc.intra.n === 1 && perto(fc.intra.v, 50));
    chk('Resumo consolidado: mesmo fornecedor em duas empresas = uma linha somada', fc.forn.compra.dados.itens.length === 1 && perto(fc.forn.compra.dados.itens[0].valor, 130) && perto(fc.forn.compra.dados.itens[0].cfops['1102'], 130));
    const fi = R('incRlFornIsolada')(E2.empresas[0]);
    chk('Resumo isolado: analítico gravado no formato de atp_fornec', fi && fi.compra && fi.compra.dados.tipo === 'compra' && fi.compra.dados.itens.length === 2);
    // snapshot reaberto: relatórios regeram pelo motor e batem com os totais da época (mesmo motor)
    const volta = R('incResDoSnapshot')(R('incSnapshot')()); R('INC').res = volta;
    const e2 = R('incRlEntidades()');
    chk('snapshot reaberto: entidades regeradas pelo motor (marcado como recalculado)', e2 && e2.recalculado && e2.lista.length === 3);
    chk('… consolidada regerada = totais da época ao centavo', perto(e2.lista[0].res.totais.simples, TC.simples) && perto(e2.lista[0].res.totais.lr, TC.lr));
    chk('… isolada regerada = totais realizados da época ao centavo', perto(e2.lista[1].res.totais.simples, TA.simples) && perto(e2.lista[1].res.totais.lp, TA.lp));
    R('INC').res = S;
    chk('#rl-corpo é um só: parecer e relatórios o movem entre as páginas', (htmlInc.match(/id="rl-corpo"/g)||[]).length === 1 && /incRlCorpoPara\('inc-parecer-dock'\)/.test(jsInc) && /incRlCorpoPara\('inc-rl-dock'\)/.test(jsInc));
    chk('changelog v1.1.0 registra a aba Relatórios', /\['1\.1\.0'/.test(jsInc) && /Aba Relatórios/.test(jsInc));
    console.log(`\n${FALHAS.length ? '✗✗ FALHAS: ' + FALHAS.length : '✓✓ SUÍTE COMPLETA'}: ${OK} verificações OK${FALHAS.length ? ' · ' + FALHAS.join(' | ') : ''}`);
    process.exit(FALHAS.length ? 1 : 0);
  })();
}
/* resumo final movido para dentro do bloco assíncrono 11 (os relatórios são async)
console.log(`\n${FALHAS.length ? '✗✗ FALHAS: ' + FALHAS.length : '✓✓ SUÍTE COMPLETA'}: ${OK} verificações OK${FALHAS.length ? ' · ' + FALHAS.join(' | ') : ''}`);
process.exit(FALHAS.length ? 1 : 0);
*/
