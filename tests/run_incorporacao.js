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
//  11. (v1.3.0) relatórios: conferência por entidade (bate ao centavo com o quadro); camada de decisão
//      (3 cenários, score explicável, ANÁLISE INCOMPLETA); parecer e apresentação DE INCORPORAÇÃO; snapshot;
//  12. (v1.5.0) modelo único: Σ por tributo = total do regime; IBS+CBS = débito; classificação em 5 categorias;
//      20 seções; 8 relatórios + todos; Excel; apresentações e snapshot lendo o modelo;
//  14. (v1.7.0) limite de colunas por orientação, notas, orientação única por documento, memória de cálculo completa (8 blocos)
//      com conciliação ao centavo, Excel com fórmulas.
//  13. (v1.6.0) redesign: executivo gerencial em 9 páginas (cards, 5 gráficos, interpretações, semáforo, checklist),
//      resumo executivo no parecer, técnicos em paisagem, relatórios pendentes, validações 25.1–25.9.
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
                   'mesesRot','triExp','origemRot','pgBlocos','rfConfExp','rlEstado','rlCharts','rlBaseReforma','rlCnpj','rlRfTrib','conferencia','rlRegimes','rlReforma',
                   'lrQuadro','rlConsolidado','parecerPags','parecer','rlCt','parecerIA','apresentacao','rlRegistros']){   // v1.1.0/v1.2.0: relatórios
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
  { const proprio = jsInc.slice(jsInc.indexOf('// └── fim dos blocos copiados'));   // só o código PRÓPRIO do incorporação
    chk('Edge Function própria gerar-parecer-incorporacao no parecer de incorporação (a gerar-parecer do ATP só no bloco copiado parecerIA)', /INC_FN_IA  = 'gerar-parecer-incorporacao'/.test(htmlInc) && /supaFn\(INC_FN_IA/.test(proprio) && !/supaFn\('gerar-parecer'/.test(proprio)); }
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

// ═══ 11. RELATÓRIOS (v1.3.0) — conferência por entidade; parecer, cenários, score e apresentação DE INCORPORAÇÃO ═══
console.log('\n■ Relatórios: conferência (Consolidada · Incorporadora · Incorporada), parecer e apresentação de incorporação');
{
  const fmtBR = v => (+v).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const E1 = ent([A, Bc], 2025); const S = g.__sim(E1); R('INC').res = S; R('INC').entradas = E1; R('INC')._cen = null;
  R('APP').page = 'relatorios';
  chk('menu e página de relatórios existem', /data-page="relatorios"/.test(htmlInc) && /id="page-relatorios"/.test(htmlInc) && /id="rl-tipo"/.test(htmlInc) && /id="inc-rl-lado"/.test(htmlInc));
  chk('v1.5.0: parecer consolidado, 8 relatórios, todos, conferência e 2 apresentações no seletor (14 opções)', ['parecer_inc','rel_executivo','rel_tributario','rel_reforma','rel_financeira','rel_patrimonial','rel_societaria','rel_memoria','rel_riscos','rel_todos','conferencia','apresentacao_inc_s','apresentacao_inc_c'].every(v => new RegExp('<option value="' + v + '"').test(htmlInc)) && ['regimes','consolidado','registros','"reforma"','cnpj','produtos','apresentacao_s','"parecer"'].every(v => !new RegExp('<option value=' + (v.startsWith('"')?v:'"'+v+'"')).test(htmlInc)));
  chk('rlRender é PRÓPRIO do incorporação (não o do index)', /async function rlRender\(\)\{\s*\n\s*if \(APP\.page !== 'relatorios'\)/.test(jsInc) && !/^function rlRender\(\) \{/m.test(jsInc));
  chk('Chart.js carregado', /Chart\.js\/4\.4\.1\/chart\.umd\.min\.js/.test(htmlInc));
  const ents = R('incRlEntidades()');
  chk('entidades da conferência: consolidada + 2 isoladas, sem recálculo quando o resultado é vivo', ents && ents.lista.length === 3 && ents.lista[0].consolidada && !ents.recalculado);
  chk('isolada usa a análise gravada e o resultado REAL, não o projetado (o que o index mostraria)', ents.lista[1].dados.cnpj === A.cnpj && ents.lista[1].res === S.empresas[0].Rreal && S.empresas[0].Rreal !== S.empresas[0].R);
  const corpoHtml = () => R("document.getElementById('rl-corpo').innerHTML");
  const roda = async (tipo, chave, modo) => {
    R("document.getElementById('rl-tipo')").value = tipo; R("document.getElementById('rl-per')").value = '3';
    R("document.getElementById('inc-rl-ent')").value = chave || 'todas';
    if (modo) R("document.getElementById('rl-conf-modo')").value = modo;
    await R('rlRender')();
    return corpoHtml();
  };
  // ── cenários e score (camada de decisão) ──
  const CE = R('incCenarios()');
  chk('3 cenários: separadas · A incorpora B · B incorpora A', CE && CE.cen.length === 3 && CE.cen[0].sep && CE.cen[1].n === 2 && CE.cen[2].n === 3 && !CE.erro3, CE && CE.erro3);
  chk('cenário 2 é o resultado da simulação (INC.res); cenário 3 tem B como incorporadora', CE.S2 === S && CE.S3 && CE.S3.empresas[0].cnpj === Bc.cnpj && CE.S3.empresas[1].cnpj === A.cnpj);
  chk('cenário 3 = mesma soma de receitas, mesmo motor', perto(CE.S3.consolidada.T.receita, S.consolidada.T.receita) && CE.S3.motorLacre === S.motorLacre);
  chk('separadas = soma dos tributos das isoladas no regime mais barato permitido de cada cenário', perto(CE.cen[0].ind.receita, S.soma.receita) && CE.cen[0].ind.trib > 0 && ['simples','lp','lr'].includes(CE.cen[0].ind.reg));
  chk('consolidada não elegível ao Simples → regimes permitidos só LP e LR', S.consolidada.sn.estado !== 'elegivel' ? (CE.cen[1].ind.perm.length === 2 && !CE.cen[1].ind.perm.includes('simples')) : CE.cen[1].ind.perm.length === 3);
  const sc = CE.cen[1].score;
  chk('score 0–100 = Σ nota × peso (tributário 60 · Reforma 20 · estabilidade 20)', sc && sc.total >= 0 && sc.total <= 100 && perto(sc.total, Object.values(sc.dims).reduce((a,d)=>a+d.nota*d.peso,0)) && perto(Object.values(sc.dims).reduce((a,d)=>a+d.peso,0), 1));
  chk('score explicável: cada dimensão tem nota, peso, fórmula e leitura', Object.values(sc.dims).every(d => typeof d.nota === 'number' && d.formula && d.texto));
  chk('classificação nas faixas do anexo (score) e nas 5 categorias (v1.5.0)', ['altamente favorável','favorável','moderadamente favorável','baixa atratividade','não recomendada'].includes(sc.rot) && (() => { const M = R('incModelo()'); return M && ['FAVORÁVEL','FAVORÁVEL COM RESSALVAS','NEUTRO','DESFAVORÁVEL','ANÁLISE INCOMPLETA'].includes(M.painel.classe.rot); })());
  chk('com alertas de fronteira o status é ANÁLISE INCOMPLETA', S.alertas.length ? sc.incompleta === true : sc.incompleta === false);
  chk('"acréscimo tributário", nunca "economia negativa" (nos textos gerados)', !/economia negativa/i.test(Object.values(sc.dims).map(d=>d.texto).join(' ') + Object.values(R('incTextosDecisao')(CE)).join(' ')) && /^(Economia tributária|Acréscimo tributário|Neutralidade tributária)/.test(sc.dims.tributario.texto));
  chk('ranking ordenado por score (maior primeiro), sem o cenário separadas', CE.rank.length === 2 && CE.rank[0].score.total >= CE.rank[1].score.total && CE.rank.every(c=>!c.sep));
  chk('patrimônio e dívida declarados sem dados nos motivos do score', sc.motivos.some(m => /Patrimônio e endividamento/.test(m)));
  // ── parecer de incorporação (documento do conjunto) ──
  let erro = null, h = '';
  (async () => {
    erro = null; try { h = await roda('parecer_inc'); } catch(e){ erro = e.message; }
    chk('Parecer de Incorporação renderiza (capa + páginas)', !erro && /pp-capa/.test(h) && /pp-page/.test(h) && h.length > 20000, erro || (h.length + ' chars'));
    chk('… com as 20 seções do Parecer Consolidado (v1.5.0)', ['1. Identificação das empresas','2. Objetivo e escopo','3. Contexto e leitura analítica','4. Painel de decisão','5. Comparação das empresas separadas','6. Comparação — empresas separadas × empresa consolidada','7. Comparação tributária por tributo','8. Comparação dos regimes tributários','9. Impacto da Reforma Tributária','10. Ranking dos cenários','11. Operações realizadas entre as empresas','12. Alertas e inconsistências','13. Conclusão tributária','14. Conclusão financeira','15. Conclusão patrimonial','16. Conclusão societária','17. Recomendação final','18. Premissas','19. Limitações','20. Memória resumida de cálculo'].every(t => h.includes(t)));
    chk('… score e classificação (5 categorias) no painel e no ranking', h.includes(String(Math.round(sc.total)) + '<span') && h.includes(R('incModelo()').painel.classe.rot));
    chk('… totais da consolidada e das separadas no comparativo (ao centavo)', h.includes(fmtBR(S.consolidada.T.lp)) && h.includes(fmtBR(S.soma.lp)) && h.includes(fmtBR(S.consolidada.T.lr)));
    chk('… carga por tributo (IRPJ, CSLL, PIS, COFINS) no regime mais barato permitido', /IRPJ/.test(h) && /CSLL/.test(h) && /COFINS/.test(h));
    chk('… patrimônio e societário: "Não avaliada por ausência de dados suficientes."', (h.match(/Não avaliada por ausência de dados suficientes\./g)||[]).length >= 2 && /sem dados de balanço no sistema/.test(h));
    chk('… conclusões em 6 dimensões: tributária, financeira, patrimonial, societária, Reforma, global', /13\. Conclusão tributária/.test(h) && /14\. Conclusão financeira/.test(h) && /15\. Conclusão patrimonial/.test(h) && /16\. Conclusão societária/.test(h) && /Reforma Tributária<\/div>/.test(h) && /Conclusão global<\/div>/.test(h));
    chk('… memória resumida cita lacre do motor, fórmula do score e identificador da análise', h.includes('lacre ' + S.motorLacre) && /score = Σ \(nota da dimensão × peso\)/.test(h) && /Identificador da análise/.test(h));
    chk('… aviso técnico do anexo (apoio à decisão, due diligence)', /due diligence/.test(h));
    chk('parecer da aba Simulação usa o mesmo render (um parecer só)', /incParecerRender\(\);/.test(jsInc) && (jsInc.match(/^function incParecerRender\(\)/gm)||[]).length === 1);
    chk('payload da IA leva o bloco "decisao" (score, cenários, por tributo, Reforma ano a ano, sem dados patrimoniais)', /decisao: \(\(\) => \{ const CE = incCenarios\(\)/.test(jsInc) && /patrimonioEDivida: 'SEM DADOS/.test(jsInc));
    chk('Edge Function aceita as 11 chaves da v1.3.0 e as 3 da v1.5.0', (() => { try { const t = fs.readFileSync(path.join(RAIZ,'supabase','functions','gerar-parecer-incorporacao','index.ts'),'utf8'); return ['executivo','ranking','antesDepois','carga','regimes','reformaDecisao','conclTrib','conclFin','conclPatr','conclReforma','conclGlobal','objetivo','conclSoc','recomendacaoCond'].every(k => t.includes('"'+k+'"')); } catch(e){ return true; } })());
    // ── apresentações ──
    erro = null; try { h = await roda('apresentacao_inc_s'); } catch(e){ erro = e.message; }
    chk('Apresentação simplificada: 7 telas (capa, pergunta, antes × depois, carga, Reforma, ranking, conclusão)', !erro && (h.match(/class="ap-slide"/g)||[]).length === 7 && /Vale a pena incorporar\?/.test(h) && /Ranking dos cenários/.test(h), erro || ((h.match(/class="ap-slide"/g)||[]).length + ' telas'));
    erro = null; try { h = await roda('apresentacao_inc_c'); } catch(e){ erro = e.message; }
    chk('Apresentação completa: 15 telas', !erro && (h.match(/class="ap-slide"/g)||[]).length === 15 && /Como o score foi calculado/.test(h) && /Patrimônio e endividamento/.test(h), erro || ((h.match(/class="ap-slide"/g)||[]).length + ' telas'));
    chk('… rodapé das telas diz "Estudo de Incorporação"', /Estudo de Incorporação/.test(h) && !/Estudo de Impacto da Reforma Tributária · /.test(h.replace(/apTimbrado/g,'')));
    // ── conferência por entidade ──
    erro = null; try { h = await roda('conferencia', 'cons', 'completo'); } catch(e){ erro = e.message; }
    chk('Conferência (12 meses) da consolidada renderiza', !erro && h.length > 5000, erro || (h.length + ' chars'));
    chk('… com bloco 0 de dados de entrada, trava e sublimite', /Dados de entrada/i.test(h) && /sublimite/i.test(h));
    { const M = S.consolidada.R.meses; chk('… e o DAS, LP e LR de jan e dez da consolidada, ao centavo', [M[0], M[11]].every(x => h.includes(fmtBR(x.dasGuia)) && h.includes(fmtBR(x.lp.total)) && h.includes(fmtBR(x.lr.total))), fmtBR(M[0].dasGuia) + ' … ' + fmtBR(M[11].dasGuia)); }
    erro = null; try { h = await roda('conferencia', Bc.cnpj, 'anual'); } catch(e){ erro = e.message; }
    { const TB = S.empresas[1].Rreal.totais, nums = [...h.matchAll(/\d{1,3}(?:\.\d{3})*,\d{2}/g)].map(x => +x[0].replace(/\./g,'').replace(',','.'));
      const tem = v => nums.some(x => Math.abs(x - v) <= 0.12);
      chk('Conferência (resumo anual) da isolada B = LP e LR realizados de B', !erro && tem(TB.lp) && tem(TB.lr), erro || fmtBR(TB.lr)); }
    erro = null; try { await roda('conferencia', 'todas', 'anual'); } catch(e){ erro = e.message; }
    chk('conferência "Todas — lado a lado" (3 colunas) sem exceção', !erro, erro || '');
    // ── analíticos (usados pela entidade consolidada) ──
    const E2 = ent([A, Bc], 2025);
    E2.empresas[0].analiticos.compra = { periodo:'01/2025', em:'2025-02-01', itens:[ { cnpj:'99999999000100', razao:'Forn X', classe:'normal', valor:100, cfops:{'1102':100} }, { cnpj: Bc.cnpj, razao:'B', classe:'simples', valor:50, cfops:{'1102':50} } ] };
    E2.empresas[1].analiticos.compra = { periodo:'01/2025', em:'2025-02-02', itens:[ { cnpj:'99999999000100', razao:'Forn X', classe:'normal', valor:30, cfops:{'1102':30} } ] };
    const fc = R('incRlFornConsolidada')(E2);
    chk('analíticos consolidados: lançamento entre as empresas fica de fora; mesmo parceiro = uma linha somada', fc.intra.n === 1 && perto(fc.intra.v, 50) && fc.forn.compra.dados.itens.length === 1 && perto(fc.forn.compra.dados.itens[0].valor, 130));
    // ── snapshot reaberto ──
    const volta = R('incResDoSnapshot')(R('incSnapshot')()); R('INC').res = volta; R('INC')._cen = null;
    const e2 = R('incRlEntidades()');
    chk('snapshot reaberto: entidades regeradas pelo motor (marcado como recalculado)', e2 && e2.recalculado && e2.lista.length === 3);
    chk('… consolidada regerada = totais da época ao centavo', perto(e2.lista[0].res.totais.simples, S.consolidada.T.simples) && perto(e2.lista[0].res.totais.lr, S.consolidada.T.lr));
    const CEs = R('incCenarios()');
    chk('… cenários e score regerados do snapshot batem com os do resultado vivo', CEs && CEs.cen.length === 3 && perto(CEs.cen[1].score.total, sc.total) && perto(CEs.cen[1].ind.trib, CE.cen[1].ind.trib));
    R('INC').res = S; R('INC')._cen = null;
    chk('#rl-corpo é um só: parecer e relatórios o movem entre as páginas', (htmlInc.match(/id="rl-corpo"/g)||[]).length === 1 && /incRlCorpoPara\('inc-parecer-dock'\)/.test(jsInc) && /incRlCorpoPara\('inc-rl-dock'\)/.test(jsInc));
    chk('changelog v1.3.0 registra o remodelamento', /\['1\.3\.0'/.test(jsInc) && /remodelados para a incorporação/.test(jsInc));

    // ═══ 12. RELATÓRIOS v1.5.0 — modelo único, classificação, 20 seções, 8 relatórios, todos, Excel ═══
    console.log('\n■ v1.5.0: modelo único, classificação em 5 categorias, relatórios separados, geração conjunta e Excel');
    {
      R('INC').res = S; R('INC').entradas = E1; R('INC')._cen = null; R('INC')._modelo = null;
      const M = R('incModelo()');
      chk('incModelo(): totais idênticos ao motor (receita, Simples, LP, LR, Reforma ano a ano)', perto(M.cons.T.receita, S.consolidada.T.receita) && perto(M.cons.T.lp, S.consolidada.T.lp) && perto(M.cons.T.lr, S.consolidada.T.lr) && M.reforma.anos.every(a => perto(a.cons, CE.cen[1].ind.refAnos.find(x=>x.ano===a.ano).v)));
      chk('modelo é cacheado (mesma simulação → mesmo objeto) e invalida ao trocar o resultado', R('incModelo()') === M);
      for (const reg of ['simples','lp','lr']){
        const T = M.tributos[reg], somaC = T.linhas.filter(l=>!l.info).reduce((s,l)=>s+l.cons,0), somaS = T.linhas.filter(l=>!l.info).reduce((s,l)=>s+l.soma,0);
        chk(`por tributo (${reg}): Σ linhas = total do regime, consolidada e separadas, ao centavo`, perto(somaC, S.consolidada.T[reg], 0.02) && perto(somaS, S.soma[reg], 0.02), `${somaC.toFixed(2)} × ${S.consolidada.T[reg].toFixed(2)}`);
        chk(`… (${reg}) cada linha tem base/alíquota/fórmula e Δ = consolidada − soma`, T.linhas.every(l => typeof l.formula === 'string' && l.formula.length > 10 && perto(l.delta, l.cons - l.soma)));
        chk(`… (${reg}) Σ por empresa = T[reg] de cada isolada`, T.total.isos.every((v,i) => perto(v, S.empresas[i].T[reg])) && T.linhas.filter(l=>!l.info).reduce((s,l)=>s+l.isos[0],0).toFixed(2) === (+S.empresas[0].T[reg]).toFixed(2));
      }
      chk('Simples: DAS aberto por tributo (IRPJ, CSLL, PIS, COFINS, CPP, ICMS, ISS, IPI) pela partilha do motor', ['IRPJ','CSLL','PIS','COFINS','CPP','ICMS','ISS','IPI'].every(t => M.tributos.simples.linhas.some(l => l.tributo.startsWith(t) && /parcela do DAS/.test(l.tributo))));
      chk('IBS + CBS = débito de cada ano; líquido = débito − crédito', M.reforma.anos.every(a => perto(a.ibs + a.cbs, a.deb) && perto(a.liq, a.deb - a.cred)));
      chk('Reforma: Δ = consolidada − separadas, acumulado correto, início/inversão coerentes com a série', (() => { let ac = 0; return M.reforma.anos.every(a => { ac += a.delta; return perto(a.delta, a.cons - a.sep) && perto(a.acum, ac); }) && (M.reforma.inicioVantagem ? M.reforma.inicioVantagem.delta < -0.5 : M.reforma.anos.every(a => a.delta >= -0.5)); })());
      chk('Reforma: nota de alíquotas projetadas presente', /alíquotas de IBS\/CBS projetadas/.test(M.reforma.nota));
      chk('regimes: permitido/não permitido com motivo; não permitido nunca é o melhor', M.regimes.cons.linhas.every(l => l.permitido || l.motivo.length > 10) && (M.regimes.cons.menorTrib ? M.regimes.cons.linhas.find(l=>l.k===M.regimes.cons.menorTrib).permitido : true) && (M.regimes.cons.maiorRes ? M.regimes.cons.linhas.find(l=>l.k===M.regimes.cons.maiorRes).permitido : true));
      chk('regimes: resultado após tributos no LR = base IRPJ/CSLL − IRPJ − CSLL − adicional (mesmo número do executivo)', perto(M.regimes.cons.linhas.find(l=>l.k==='lr').resultado, CE.cen[1].ind.resLR, 0.02));
      chk('classificação: 5 categorias, dimensão pendente ⇒ nunca FAVORÁVEL pleno', ['FAVORÁVEL COM RESSALVAS','NEUTRO','DESFAVORÁVEL','ANÁLISE INCOMPLETA'].includes(M.painel.classe.rot) && M.pend.some(p => p.dim === 'patrimonial'));
      { const fake = (total, rel, nAl, incompleta, critico) => R('incClassificar')({ score:{ total, dims:{ tributario:{ rel } }, incompleta, motivos: critico ? ['Dado crítico ausente ou motor defasado: conclusão bloqueada.'] : [] }, alertas: Array(nAl).fill({}) }, [{ dim:'patrimonial' }]);
        chk('classificação sintética: <40 DESFAVORÁVEL · 40–59 NEUTRO · ≥60 com pendência COM RESSALVAS · crítico INCOMPLETA · |econ|<1% NEUTRO', fake(30,-0.05,0,false,false).k==='DES' && fake(50,0.03,0,false,false).k==='NEU' && fake(80,0.08,0,false,false).k==='RES' && fake(80,0.08,0,true,true).k==='INC' && fake(70,0.005,0,false,false).k==='NEU' && R('incClassificar')({ score:{ total:80, dims:{ tributario:{ rel:0.08 } }, incompleta:false, motivos:[] }, alertas:[] }, []).k==='FAV'); }
      chk('nenhum "recomendado" na conclusão global, na recomendação e no painel', !/recomendad[oa]\b/i.test(M.conclusoes.global + ' ' + M.recomendacao) && /Com base exclusivamente nos dados tributários disponíveis|não há base para recomendar/.test(M.recomendacao));
      chk('recomendação é condicionada (depende da validação …)', /depende da validação|não há base/.test(M.recomendacao));
      chk('pendências contadas (patrimonial, financeira, societária) e alertas contados no painel', M.painel.nPend === M.pend.length && M.painel.nAlertas === S.alertas.length && ['patrimonial','financeira','societária'].every(d => M.pend.some(p => p.dim === d)));
      chk('identificador da análise: nº da simulação gravada ou hash provisório', /^(sim-[0-9a-f]{8}|\d+)$/.test(M.ident.id));
      chk('ranking: 1º = melhor score; separadas fora do ranking (referência); justificativa por linha', M.ranking[0].score.total >= (M.ranking[1] ? M.ranking[1].score.total : 0) && M.ranking.every(r => r.just.length > 20 && r.incorporadora && r.regime) && !M.ranking.some(r => /Manter as empresas/.test(r.nome)));
      // renders
      const tipos = ['parecer_inc','rel_executivo','rel_tributario','rel_reforma','rel_financeira','rel_patrimonial','rel_societaria','rel_memoria','rel_riscos','rel_todos'];
      const H = {};
      for (const t of tipos){ let err = null; try { R('incRelatorioRender')(t); H[t] = corpoHtml(); } catch(e){ err = e.message; } chk(`relatório ${t} renderiza sem exceção, sem "undefined"/"NaN"`, !err && H[t] && !/undefined|NaN/.test(H[t]) && /pp-page/.test(H[t]), err || ((H[t]||'').length + ' chars · ' + ((H[t]||'').match(/class="pp-page/g)||[]).length + ' págs')); }
      chk('rel_todos = os 9 documentos em sequência (páginas ≥ soma das partes − capas)', (H.rel_todos.match(/class="pp-page/g)||[]).length >= tipos.slice(0,9).reduce((s,t)=>s+(H[t].match(/class="pp-page/g)||[]).length,0) - 2);
      chk('todo relatório traz o mesmo total do regime mais barato da consolidada (mesmo modelo)', ['parecer_inc','rel_executivo','rel_tributario'].every(t => H[t].includes(fmtBR(CE.cen[1].ind.trib))));
      chk('sinal único: legenda "Δ = consolidada − separadas" em parecer, tributário e Reforma', ['parecer_inc','rel_tributario','rel_reforma'].every(t => /Δ = consolidada − separadas/.test(H[t])));
      chk('Reforma: IBS e CBS separados, ano de início e inversão, aviso de alíquotas projetadas', /<th class="num">IBS<\/th><th class="num">CBS<\/th>/.test(H.rel_reforma) && /ano em que a vantagem começa/.test(H.rel_reforma) && /ano em que o sinal inverte/.test(H.rel_reforma) && /alíquotas de IBS\/CBS projetadas/.test(H.rel_reforma));
      chk('por tributo: base → alíquota → fórmula → A → B → separadas → consolidada → Δ → leitura → motivo', /Base \(cons\.\)<\/th><th class="num">Alíq\. efetiva<\/th>/.test(H.parecer_inc) && /motivo da diferença:/.test(H.parecer_inc) && /fórmula: /.test(H.parecer_inc) && /<th>Leitura<\/th>/.test(H.parecer_inc));
      chk('financeira: frase-padrão quando faltam dados, tabela por regime quando há custos', S.consolidada.R.meses.some(m=>(m.custos||0)+(m.despTotal||0)>0) ? /Resultado por regime — consolidada/.test(H.rel_financeira) : /Análise financeira não concluída por ausência de dados suficientes/.test(H.rel_financeira));
      chk('patrimonial e societária: estrutura + checklist com "Não avaliada por ausência de dados suficientes."', /Não avaliada por ausência de dados suficientes/.test(H.rel_patrimonial) && /Dívida líquida \/ EBITDA/.test(H.rel_patrimonial) && /Não avaliada por ausência de dados suficientes/.test(H.rel_societaria) && /Checklist operacional/.test(H.rel_societaria) && /art\. 1\.116/.test(H.rel_societaria));
      chk('riscos: limite, sublimite, Fator R, prejuízos, operações, validações, documentos', ['Sublimite','Fator R','Prejuízos fiscais','Operações entre as empresas','Validações jurídicas e contábeis','Documentos necessários'].every(t => H.rel_riscos.includes(t)));
      chk('memória: dados de entrada, regras, fórmulas, arredondamento, versão, data/hora, identificador', ['Dados de entrada e origem','Regras da consolidação','Fórmulas','Arredondamento','Identificador da análise','Data e hora da simulação'].every(t => H.rel_memoria.includes(t)));
      chk('parecer da aba Simulação usa o mesmo render (um parecer só)', /incParecerRender\(\);/.test(jsInc) && (jsInc.match(/^function incParecerRender\(\)/gm)||[]).length === 1);
      // Excel
      const abas = R('incExcelAbas')(M, 'rel_todos');
      chk('Excel: uma aba por seção (12 abas no conjunto), nomes ≤ 31 caracteres', abas.length === 12 && abas.every(a => a.nome.length <= 31 && a.aoa.length > 1));
      chk('Excel: números como número — total LP da consolidada na aba Regimes bate ao centavo', (() => { const ab = abas.find(a => a.nome === 'Regimes'); const l = ab.aoa.find(r => r[0] === 'Lucro Presumido'); return l && typeof l[6] === 'number' && perto(l[6], S.consolidada.T.lp); })());
      chk('Excel: aba por tributo soma o total do regime', (() => { const ab = abas.find(a => a.nome === 'Tributos Lucro Presumido'); const tot = ab.aoa.find(r => r[0] === 'Total'); return tot && perto(tot[8], S.consolidada.T.lp, 0.02); })());
      chk('SheetJS carregado; botão Exportar Excel no seletor e na barra do documento', /cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\/0\.18\.5\/xlsx\.full\.min\.js/.test(htmlInc) && /incExcel\(document\.getElementById\('rl-tipo'\)\.value\)/.test(htmlInc) && /onclick="incExcel\('\$\{tipo\}'\)"/.test(jsInc));
      // apresentações leem o modelo
      let e2 = null, hA = ''; try { hA = await roda('apresentacao_inc_c'); } catch(e){ e2 = e.message; }
      chk('apresentação completa (15 telas) lê o modelo: classificação em 5 categorias, pendências, societária e recomendação', !e2 && (hA.match(/class="ap-slide"/g)||[]).length === 15 && hA.includes(M.painel.classe.rot) && /pendência\(s\)/.test(hA) && /Societária/.test(hA) && /Recomendação/.test(hA), e2 || '');
      // snapshot
      const volta2 = R('incResDoSnapshot')(R('incSnapshot')()); R('INC').res = volta2; R('INC')._cen = null; R('INC')._modelo = null;
      let e3 = null; try { R('incRelatorioRender')('parecer_inc'); R('incRelatorioRender')('rel_reforma'); } catch(e){ e3 = e.message; }
      const M2 = R('incModelo()');
      chk('snapshot reaberto: parecer consolidado e Reforma renderizam; classificação e totais iguais aos do resultado vivo', !e3 && M2.painel.classe.rot === M.painel.classe.rot && perto(M2.painel.econ, M.painel.econ) && /reaberta de simulação gravada/.test(M2.painel.situacao), e3 || '');
      R('INC').res = S; R('INC')._cen = null; R('INC')._modelo = null;
      chk('badge v1.7.1 e changelog v1.5.0 + v1.6.0 + v1.7.0 (versão visível + linhas na aba Versões)', /INC_VERSAO = '1\.7\.1'/.test(jsInc) && /\['1\.5\.0','15\/09\/2026'/.test(jsInc) && /\['1\.6\.0','15\/09\/2026'/.test(jsInc) && /\['1\.7\.0','16\/09\/2026'/.test(jsInc) && /\['1\.7\.1','16\/09\/2026'/.test(jsInc) && /Parecer Consolidado de Incorporação/.test(jsInc));
      // ═══ 13. REDESIGN v1.6.0 — camada gerencial (executivo em 9 páginas, resumo executivo do parecer), gráficos, interpretações, semáforo, paisagem ═══
      console.log('\n■ v1.6.0: redesign — executivo gerencial, gráficos, interpretações automáticas, semáforo, relatórios técnicos em paisagem');
      {
        const M = R('incModelo()'), G = R('incGruposTributo')(M), I = R('incInterp')(M), SEM = R('incSemaforo')(M), PT = R('incPontos')(M);
        chk('formato único: -R$ 35.000,00 · R$ 1.234.567,89 · 12,34%', R('incRS')(-35000) === '-R$ 35.000,00' && R('incRS')(1234567.89) === 'R$ 1.234.567,89' && R('incPct')(0.1234) === '12,34%' && R('incSinalRS')(24000) === '+R$ 24.000,00');
        chk('(25.1/25.2) grupos por tributo: Σ antes = carga atual do dashboard, Σ depois = carga após — os mesmos números da tabela técnica', perto(G.totA, CE.cen[0].ind.trib, 0.02) && perto(G.totD, CE.cen[1].ind.trib, 0.02) && perto(G.delta, CE.cen[1].ind.trib - CE.cen[0].ind.trib, 0.02), `${G.totA.toFixed(2)} → ${G.totD.toFixed(2)}`);
        chk('(25.3) percentual da economia recalculado sobre a carga atual', I.antesDepois.includes(fmtBR(Math.abs(CE.cen[1].ind.trib - CE.cen[0].ind.trib))) && I.antesDepois.includes((Math.abs(CE.cen[1].ind.trib - CE.cen[0].ind.trib)/CE.cen[0].ind.trib*100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) + '%'));
        chk('(25.6) interpretação nunca favorável com resultado negativo', CE.cen[1].ind.trib - CE.cen[0].ind.trib > 0.5 ? (/aumento/.test(I.antesDepois) && !/redução/.test(I.antesDepois) && !/economia/i.test(I.conclusao.split('.')[0])) : true);
        chk('(25.4) acumulado 2027–2033 = soma dos anos; "vantajosa em toda a transição" coerente', perto(M.reforma.acumTotal, M.reforma.anos.reduce((s,a)=>s+a.delta,0)) && I.reformaMantem === (M.reforma.anos.every(a=>a.delta<=-0.5) ? 'SIM' : M.reforma.anos.every(a=>a.delta>=-0.5) ? 'NÃO' : 'PARCIALMENTE'));
        chk('(25.5) ranking do executivo = mesmos scores e ordem do motor de decisão', M.ranking.every((r,i) => perto(r.score.total, CE.rank[i].score.total) && r.nome === CE.rank[i].nome));
        chk('(25.7) semáforo: 6 dimensões; "não avaliado" nunca é vermelho; tributária segue o sinal da economia', SEM.length === 6 && SEM.filter(l=>/Não avaliada|Dados insuficientes/.test(l.rot)).every(l=>l.k==='na') && SEM[0].k === (CE.cen[1].ind.trib - CE.cen[0].ind.trib <= -0.5 ? 'ok' : CE.cen[1].ind.trib - CE.cen[0].ind.trib >= 0.5 ? 'err' : 'na'));
        chk('pontos favoráveis/atenção só com dados reais (cada item cita um valor calculado ou um alerta do motor)', PT.at.length >= 1 && [...PT.fav, ...PT.at].every(t => /R\$|regime|Regime|não avaliados|teto|sublimite|inverte|Fator R|alerta|faixa|limite|bloqueado|Adicional/i.test(t)));
        // executivo
        R('incRelatorioRender')('rel_executivo'); const hx = corpoHtml();
        chk('executivo: 9 páginas (capa + 8 assuntos, uma página cada) com 2 empresas', (hx.match(/class="pp-page/g)||[]).length === 9, (hx.match(/class="pp-page/g)||[]).length + ' págs');
        chk('executivo: dashboard "Decisão da incorporação" com 12 cards (conclusão, cenário, regime, score, carga atual, após, economia, Reforma, riscos, pendências…)', /Decisão da incorporação/.test(hx) && ['conclusão','melhor cenário|cenário menos oneroso','regime indicado','score da operação','carga atual','após a incorporação','economia anual|acréscimo anual|diferença anual','2027–2033','riscos / alertas','pendências','regime não permitido','sentido inverso simulado'].every(t => new RegExp(t).test(hx)));
        chk('executivo: 5 gráficos (antes×depois, regimes, cascata, Reforma, ranking) + interpretação após cada um', ['ex-ad-','ex-rg-','ex-wf-','ex-rf-','ex-rk-'].every(id => hx.includes('id="' + id)) && (hx.match(/<b>Leitura:<\/b>/g)||[]).length >= 6);
        chk('(25.8) regime não permitido aparece como "NÃO PERMITIDO" e nunca como ★ melhor', S.consolidada.sn.estado !== 'elegivel' ? (/NÃO PERMITIDO/.test(hx) && !/Simples Nacional ★/.test(hx) && /Simples Nacional<\/td><td style="text-align:left">🔴/.test(hx)) : true);
        chk('executivo: semáforo (🟢🟡🔴⚪ + texto), pontos favoráveis × atenção, checklist de 10 próximos passos, assinatura', /Visão geral da operação/.test(hx) && /Pontos favoráveis/.test(hx) && /Pontos de atenção/.test(hx) && (hx.match(/☐|☑/g)||[]).length >= 10 && /Próximos passos/.test(hx) && /Responsável técnico|CRC/.test(hx));
        chk('executivo: sem tabelas técnicas largas (base/alíquota/fórmula ficam no técnico)', !/Alíq\. efetiva/.test(hx) && !/fórmula: /.test(hx) && !/Base \(cons\.\)/.test(hx));
        chk('executivo: tabela curta por tributo (Antes/Depois/Diferença) com TOTAL = cargas do dashboard', /<th class="num">Antes<\/th><th class="num">Depois<\/th><th class="num">Diferença<\/th>/.test(hx) && hx.includes('TOTAL</td><td class="num">' + fmtBR(G.totA)));
        chk('executivo: "Impacto tributário líquido" e "Impacto acumulado 2027–2033" em destaque', /Impacto tributário líquido: /.test(hx) && /Impacto acumulado 2027–2033: /.test(hx) && /vantajosa durante toda a transição: (SIM|NÃO|PARCIALMENTE)/.test(hx));
        // parecer consolidado: resumo executivo antes da seção 1
        R('incRelatorioRender')('parecer_inc'); const hp = corpoHtml();
        chk('parecer consolidado: resumo executivo (3 páginas com dashboard, gráficos, semáforo) ANTES da seção 1; seção 3 renomeada (sem duplicidade)', hp.indexOf('Resumo executivo') < hp.indexOf('1. Identificação das empresas') && ['pc-ad-','pc-rg-','pc-rf-','pc-rk-'].every(id => hp.includes('id="' + id)) && /3\. Contexto e leitura analítica/.test(hp) && (hp.match(/Resumo executivo/g)||[]).length >= 3);
        // técnicos em paisagem e blocos por tabela
        R('incRelatorioRender')('rel_tributario'); const ht = corpoHtml();
        chk('relatórios técnicos 2, 3 e 7 em A4 paisagem (página nomeada) com cabeçalho e numeração; memória mensal em blocos por tabela', /pp-page pp-land/.test(ht) && /pp-land-cab/.test(ht) && /página 1 de \d+/.test(ht) && /@page paisagem\{size:A4 landscape/.test(htmlInc) && /\.pp-page\.pp-land\{page:paisagem\}/.test(htmlInc) && (() => { R('incRelatorioRender')('rel_memoria'); return /pp-land/.test(corpoHtml()); })() && (() => { R('incRelatorioRender')('rel_reforma'); return /pp-land/.test(corpoHtml()); })());
        chk('CSS de impressão: gráficos e linhas de tabela nunca divididos; título não fica órfão', /\.pp-chart\{page-break-inside:avoid/.test(htmlInc) && /\.pp-sec\{page-break-after:avoid/.test(htmlInc) && /\.pp-tab tr\{page-break-inside:avoid/.test(htmlInc));
        // pendentes (item 12)
        R('incRelatorioRender')('rel_patrimonial'); const hpa = corpoHtml(); R('incRelatorioRender')('rel_societaria'); const hso = corpoHtml(); R('incRelatorioRender')('rel_financeira'); const hfi = corpoHtml();
        chk('relatórios 5 e 6: "Informações … pendentes" — dizem que a análise NÃO foi concluída e listam os documentos necessários', /Informações patrimoniais pendentes/.test(hpa) && /não foi concluída porque não foram fornecidas informações suficientes/.test(hpa) && /Balanço patrimonial/.test(hpa) && /Informações societárias e operacionais pendentes/.test(hso) && /Contratos com clientes/.test(hso));
        chk('relatório 4: título "pendentes" só quando faltam custos; com custos, análise + o que ainda falta', M.temCustos ? (/Análise Financeira/.test(hfi) && /Informações financeiras ainda pendentes/.test(hfi)) : /Informações financeiras pendentes/.test(hfi));
        // 3 empresas
        { const E3 = ent([A, Bc, C3], 2025); const S3_ = g.__sim(E3); R('INC').res = S3_; R('INC').entradas = E3; R('INC')._cen = null; R('INC')._modelo = null;
          let e4 = null, h3 = ''; try { R('incRelatorioRender')('rel_executivo'); h3 = corpoHtml(); R('incRelatorioRender')('rel_todos'); } catch(e){ e4 = e.message; }
          chk('(25.9) executivo e "todos" funcionam com 3 empresas (sem sentido inverso)', !e4 && /3\+ empresas/.test(h3) && (h3.match(/class="pp-page/g)||[]).length >= 9, e4 || '');
          R('INC').res = S; R('INC').entradas = E1; R('INC')._cen = null; R('INC')._modelo = null; }
        chk('changelog v1.6.0 registra o redesign', /\['1\.6\.0','15\/09\/2026'/.test(jsInc) && /Redesign dos relatórios/.test(jsInc));
      }
      // ═══ 14. v1.7.0 — layout que nunca corta (limite de colunas, notas, orientação única) e memória de cálculo completa ═══
      console.log('\n■ v1.7.0: limite de colunas por orientação, notas numeradas, orientação única, memória completa e conciliação');
      {
        R('INC').res = S; R('INC').entradas = E1; R('INC')._cen = null; R('INC')._modelo = null;
        const M = R('incModelo()');
        const strip = h => String(h).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
        const ncols = tr => (tr.match(/<t[dh]\b[^>]*colspan="?(\d+)/g)||[]).reduce((s,x)=>s+(+x.match(/(\d+)$/)[1]),0) + (tr.match(/<t[dh]\b(?![^>]*colspan)/g)||[]).length;
        const maxColsDoc = html => { let mx = 0, cabs = []; for (const t of html.matchAll(/<table class="pp-tab[^>]*>([\s\S]*?)<\/table>/g)){ const trs = t[1].match(/<tr[\s\S]*?<\/tr>/g)||[]; for (const tr of trs){ const n = ncols(tr); if (n > mx) mx = n; } } return mx; };
        const docs = {}; for (const t of ['parecer_inc','rel_executivo','rel_tributario','rel_reforma','rel_memoria','rel_riscos','rel_financeira','rel_patrimonial','rel_societaria']){ R('incRelatorioRender')(t); docs[t] = corpoHtml(); }
        const LIM = R('INC_COLS_MAX');
        chk('limite de colunas: retrato ≤ 7 e paisagem ≤ 11 em TODAS as tabelas de todos os documentos', ['parecer_inc','rel_executivo','rel_riscos','rel_financeira','rel_patrimonial','rel_societaria'].every(t => maxColsDoc(docs[t]) <= LIM.retrato) && ['rel_tributario','rel_reforma','rel_memoria'].every(t => maxColsDoc(docs[t]) <= LIM.paisagem), Object.entries(docs).map(([k,h])=>k+':'+maxColsDoc(h)).join(' '));
        chk('cada documento vai dentro de .inc-doc com a orientação (retrato/paisagem) — nunca as duas no mesmo documento', docs.parecer_inc.includes('class="inc-doc" data-orient="retrato"') && !docs.parecer_inc.includes('pp-land') && docs.rel_tributario.includes('data-orient="paisagem"') && !/<div class="pp-page">/.test(docs.rel_tributario));
        chk('parecer compacto: "Leitura" virou notas numeradas e as colunas por empresa/base/alíquota saíram com aviso apontando os relatórios técnicos', /inc-notas/.test(docs.parecer_inc) && /<sup[^>]*>1<\/sup>/.test(docs.parecer_inc) && /Colunas resumidas neste quadro/.test(docs.parecer_inc) && /Relatório 2 — Comparativo Tributário Completo/.test(docs.parecer_inc));
        chk('relatórios técnicos mantêm as colunas por empresa (abertura completa)', docs.rel_tributario.includes('<th class="num">' + A.nome + '</th>') && docs.rel_reforma.includes('<th class="num">' + Bc.nome + '</th>'));
        chk('tabela de regimes: cabeçalho com o mesmo número de colunas das linhas (Δ % acrescentado)', (() => { const t = docs.rel_tributario.match(/<table class="pp-tab[^>]*style="font-size:11px"><thead>([\s\S]*?)<\/thead><tbody>([\s\S]*?)<\/table>/); if (!t) return false; const cab = ncols(t[1]); const rows = (t[2].match(/<tr[\s\S]*?<\/tr>/g)||[]).filter(r => !/colspan/.test(r)); return rows.length > 0 && rows.every(r => ncols(r) === cab); })());
        chk('linhas de fórmula (colspan) acompanham a largura do quadro depois do ajuste', (() => { const cs = [...docs.parecer_inc.matchAll(/<tr><td colspan="(\d+)"[^>]*>fórmula:/g)].map(m=>+m[1]); return cs.length > 0 && cs.every(n => n <= LIM.retrato); })());
        chk('apPrintCss desligado ao abrir o parecer da aba Simulação e ao renderizar qualquer relatório (orientação por documento via incPrintCss)', /apPrintCss\(false\);\s*\/\/ v1\.7\.0/.test(jsInc) && /function incPrintCss/.test(jsInc) && /incPrintCss\(tipo === 'rel_todos' \? null/.test(jsInc));
        chk('"Todos" oferece dois PDFs (gerencial retrato · técnico paisagem)', (() => { R('incRelatorioRender')('rel_todos'); const h = corpoHtml(); return /incImprimir\('retrato'\)/.test(h) && /incImprimir\('paisagem'\)/.test(h) && (h.match(/class="inc-doc"/g)||[]).length === 9; })());
        chk('empacotador por medida e régua de altura E largura existem e são chamados no render', /function incEmpacotarDoc/.test(jsInc) && /incEmpacotar\(corpo\)/.test(jsInc) && /function incReguaRender/.test(jsInc) && /largura/.test(jsInc.slice(jsInc.indexOf('function incMedirPaginas'), jsInc.indexOf('function incMedirPaginas') + 2000)));
        // memória completa
        const mem = strip(docs.rel_memoria);
        chk('Relatório 7: 8 blocos (7.1 a 7.8) e as fórmulas escritas', ['7.1 Dados de entrada','7.2 Consolidação','7.3 Simples Nacional','7.4 Lucro Presumido','7.5 Lucro Real','7.6 Reforma Tributária','7.7 Δ por tributo e score','7.8 Conciliação'].every(t => mem.includes(t)) && /Parcela a deduzir/.test(mem) && /Efetiva recalculada/.test(mem) && /IRPJ 15 %/.test(mem) && /Adicional 10 %/.test(mem) && /média ponderada pela base/.test(mem));
        chk('Relatório 7: premissas não se repetem (uma vez, na seção 18 do parecer; o relatório só referencia)', (mem.match(/Premissas/g)||[]).length < 4 && !/0\. Premissas/.test(mem));
        const MC = R('incMemoriaCompleta')(M);
        chk('memória recalcula a alíquota efetiva pela fórmula (RBT12 × nominal − dedução) ÷ RBT12 e bate com a do motor em todos os blocos base (fora do sublimite/limite)', (() => { let n = 0, ok = true; for (const e of [...M.ents, M.cons]) for (const m of e.R.meses) for (const b of (m.ins.blocos||[])){ if (!(+b.receita > 0) || !R('INC_BLOCO_BASE')(b.k) || m.impedido || +m.excLimite > 0 || +m.excSublimite > 0) continue; let ax = R('INC_ANEXO_DO_BLOCO')(b.k); if (ax === 'V' && m.fatorR >= 0.28) ax = 'III'; const T = R('ANEXOS_DEFAULT')[ax]; const rec = (m.rbt12 * T.aliq[m.faixa-1] - T.ded[m.faixa-1]) / m.rbt12; n++; if (Math.abs(rec - m.efb[b.k]) > 1e-9) ok = false; } return n > 20 && ok; })());
        chk('conciliação ao centavo: Σ mensal da memória = totais do motor (Simples, LP e LR de cada empresa e da consolidada)', R('incMemoriaConfere')(M).ok, R('incMemoriaConfere')(M).itens.filter(x=>Math.abs(x.mem-x.motor)>0.015).map(x=>x.item).join('; '));
        chk('… e Σ parcelas por bloco = Σ DAS em cada entidade', MC.conciliacao.filter(x=>/parcelas por bloco/.test(x.item)).every(x => Math.abs(x.mem - x.motor) <= 0.015));
        chk('Excel do Relatório 7: uma aba por bloco, com fórmulas de planilha', (() => { const abas = R('incExcelAbas')(M, 'rel_memoria'); const comF = abas.filter(a => a.aoa.some(l => l.some(c => c && typeof c === 'object' && c.f))); return abas.length >= 20 && comF.length >= 8 && new Set(abas.map(a=>a.nome)).size === abas.length; })());
        chk('v1.7.1: snapshot reaberto regera as entidades pelo motor — seção 7 por tributo e memória preenchidas', (() => { const snap = R('incSnapshot()'); const volta = R('incResDoSnapshot')(clone(snap)); R('INC').res = volta; R('INC')._cen = null; R('INC')._modelo = null; const Ms = R('incModelo()'); const T = Ms.tributos[Ms.c2.ind.reg]; const ok = T.linhas.filter(l=>Math.abs(l.soma)+Math.abs(l.cons)>0.005).length >= 5 && R('incMemoriaConfere')(Ms).ok; R('INC').res = S; R('INC')._cen = null; R('INC')._modelo = null; return ok; })());
        chk('v1.7.1: CSS — cabeçalhos numéricos quebram linha, números não, primeira coluna com largura mínima; sem overflow-wrap:anywhere', /\.inc-doc \.pp-tab th\.num\{white-space:normal\}/.test(htmlInc) && /\.inc-doc \.pp-tab td\.num\{white-space:nowrap\}/.test(htmlInc) && /min-width:28mm/.test(htmlInc) && !/overflow-wrap:anywhere/.test(htmlInc));
        chk('v1.7.1: quadro dividido nunca tem parte com 1 coluna (ranking do parecer em partes equilibradas)', !/parte \d+ de \d+ \(colunas ([^…]+) … \1\)/.test(docs.parecer_inc) && /function incEmpacotarDocInterno/.test(jsInc) && /repaginação pulada/.test(jsInc));
        chk('motor intocado: lacre e totais iguais aos do bloco 1', S.motorLacre === R('LACRE_HASH') && perto(S.consolidada.T.lp, R('incSimular')(E1, { abatimentos:[] }).consolidada.T.lp));
      }
      chk('build com app_6 e o parecer antigo removido do app_5', /incorporacao_app_6\.js/.test(fs.readFileSync(path.join(RAIZ,'tools','build_incorporacao.js'),'utf8')) && !/PARECER DE INCORPORAÇÃO \(substitui o incParecerRender da v1\.0\)/.test(jsInc));
    }
    console.log(`\n${FALHAS.length ? '✗✗ FALHAS: ' + FALHAS.length : '✓✓ SUÍTE COMPLETA'}: ${OK} verificações OK${FALHAS.length ? ' · ' + FALHAS.join(' | ') : ''}`);
    process.exit(FALHAS.length ? 1 : 0);
  })();
}
/* resumo final movido para dentro do bloco assíncrono 11 (os relatórios são async)
console.log(`\n${FALHAS.length ? '✗✗ FALHAS: ' + FALHAS.length : '✓✓ SUÍTE COMPLETA'}: ${OK} verificações OK${FALHAS.length ? ' · ' + FALHAS.join(' | ') : ''}`);
process.exit(FALHAS.length ? 1 : 0);
*/
