// ══ CONSOLIDAÇÃO — funções PURAS (sem DOM), cobertas pela suíte tests/run_incorporacao.js ══
const INC_REC_COM  = ['a1_semst','a1_red','a1_mono','a1_comst','a1_comst_mono','a2_semst','a2_red','a2_mono','a2_comst','a2_comst_mono'];
const INC_REC_SERV = ['a3_semret','a3_retiss','a3_retissinss','a4','a4_retiss','a5r'];
const INC_PCT_BASE = { a1_red_pct:'a1_red', a1_mono_pct:'a1_mono', a2_red_pct:'a2_red' };   // percentual × base que o pondera
const INC_CFG_INCORPORADORA = ['iss','icmsV','icmsC','ipiV','ipiC','lpBaseServ','lpBaseCom','lpBaseServCsll','lpBaseComCsll',
  'transpPresuncao','icmsTranspV','transpCredPres','folhaPerc','adicionalIR','sublimite','lrPeriodo','lrPrejIrpj','lrPrejCsll',
  'inicioAtividade','travaNoDas','credLRpct','projJanela','anoRefParecer','snAntAcima'];
const INC_RF_MON = ['receita','compras','baseIS'];

// abate uma operação intragrupo: receita do vendedor (dX) e compras/despesas do comprador (dY)
function incAbater(dX, dY, ab, rfX, rfY, regimeX){
  const serv = ab.natureza === 'servico';
  const kRec = serv ? INC_REC_SERV : INC_REC_COM;
  const dest = serv ? { sec:'despesas', keys:['outras','adm','vendas'], def:'outras' } : { sec:'compras', keys:['semst','comst','mono','comstMono'], def:'semst' };
  const meses = (ab.meses && ab.meses.length ? ab.meses : [...Array(12).keys()]).filter(m => m>=0 && m<12);
  const recMes = m => kRec.reduce((s,k)=> s + (+dX.receitas[k][m]||0), 0);
  let pesos = meses.map(recMes), soma = pesos.reduce((a,b)=>a+b,0);
  if (soma <= 0.005){ pesos = meses.map(()=>1); soma = meses.length; }
  const res = { rec:0, dest:0, naoRec:0, naoDest:0, porMes: Array(12).fill(0) };
  meses.forEach((m,i) => {
    const alvo = ab.valor * pesos[i] / soma;
    // vendedor: reduz os grupos de receita na proporção do que cada um tem no mês
    const disp = recMes(m); let feito = 0;
    if (disp > 0.005){
      const q = Math.min(alvo, disp);
      for (const k of kRec){ const v = +dX.receitas[k][m]||0; if (v>0){ const cut = q*v/disp; dX.receitas[k][m] = r2(v - cut); feito += cut; } }
    }
    res.rec += feito; res.naoRec += (alvo - feito); res.porMes[m] = r2(feito);
    // comprador: reduz compras (mercadoria) ou despesas (serviço)
    const g = dY[dest.sec]; const tot = dest.keys.reduce((s,k)=>s+(+g[k][m]||0),0); let f2 = 0;
    if (tot > 0.005){
      const q = Math.min(alvo, tot);
      for (const k of dest.keys){ const v = +g[k][m]||0; if (v>0){ const cut = q*v/tot; g[k][m] = r2(v - cut); f2 += cut; } }
    }
    res.dest += f2; res.naoDest += (alvo - f2);
  });
  // aba Reforma: receita do vendedor e contraparte/compras do comprador
  if (rfX && +rfX.receita > 0) rfX.receita = r2(Math.max(0, +rfX.receita - res.rec));
  if (rfY){
    const k = incEhSimples(regimeX) ? 'compras_simples' : 'compras_lrlp';
    if (rfY.contra && +rfY.contra[k] > 0) rfY.contra[k] = r2(Math.max(0, +rfY.contra[k] - res.dest));
    if (+rfY.compras > 0) rfY.compras = r2(Math.max(0, +rfY.compras - res.dest));
  }
  return res;
}

// monta a análise consolidada a partir das análises PROJETADAS (12 meses) de cada empresa
// lista[0] = incorporadora. Cada item: { cnpj, nome, regime, dados, reforma (já projetada) ou null, R (isolada) }
function incConsolidar(lista, abatimentos, ano){
  const L = lista.map(e => ({ ...e, dados: anNormalizar(clone(e.dados), e.cnpj, ano), reforma: e.reforma ? clone(e.reforma) : null }));
  const inc = L[0], notas = [], premissas = [], abatidos = [];
  // 1. abatimentos intragrupo (sobre as cópias)
  for (const ab of (abatimentos||[])){
    if (!ab || !ab.aplicar || !(ab.valor>0) || !ab.natureza) continue;
    const X = L.find(e=>e.cnpj===ab.de), Y = L.find(e=>e.cnpj===ab.para); if (!X || !Y || X===Y) continue;
    const r = incAbater(X.dados, Y.dados, ab, X.reforma, Y.reforma, X.regime);
    abatidos.push({ ...ab, abatidoRec:r2(r.rec), abatidoDest:r2(r.dest), naoAbatidoRec:r2(r.naoRec), naoAbatidoDest:r2(r.naoDest), porMes:r.porMes,
      deNome:X.nome, paraNome:Y.nome });
    if (r.naoRec > 0.5 || r.naoDest > 0.5) notas.push(`Abatimento ${X.nome} → ${Y.nome} (${ab.natureza}): ${fmtR(r.naoRec>0.5?r.naoRec:r.naoDest)} não pôde ser abatido — a ${r.naoRec>0.5?'receita do vendedor':'compra/despesa do comprador'} lançada nos meses do rateio é menor que a operação.`);
  }
  // 2. base = nova análise com a cfg da incorporadora
  const C = anNovo(inc.cnpj, ano);
  C.cfg = { ...C.cfg };
  for (const k of INC_CFG_INCORPORADORA) if (inc.dados.cfg[k] !== undefined) C.cfg[k] = clone(inc.dados.cfg[k]);
  // Alíquotas de ISS e ICMS: MÉDIA PONDERADA pela base que cada uma tributa (serviços → ISS; vendas de
  // mercadoria → ICMS de venda; compras → ICMS de compra). O ISS segue o município do estabelecimento
  // e o ICMS a UF: depois da incorporação, o estabelecimento da incorporada vira filial e continua
  // onde está. Se a incorporadora não tem serviços e a incorporada tem, usar o ISS da incorporadora
  // (zero) apagaria o ISS de todo o serviço. Sem base para ponderar, vale a incorporadora.
  const pond = (k, base) => { let sb = 0, sp = 0; for (const e of L){ const b = base(e); sb += b; sp += b * (+e.dados.cfg[k]||0); } return sb > 0.005 ? sp/sb : (+inc.dados.cfg[k]||0); };
  C.cfg.iss   = pond('iss',   e => INC_REC_SERV.reduce((s,k)=>s+S(e.dados.receitas[k]),0));
  C.cfg.icmsV = pond('icmsV', e => INC_REC_COM.reduce((s,k)=>s+S(e.dados.receitas[k]),0));
  C.cfg.icmsC = pond('icmsC', e => ['semst','comst','mono','comstMono'].reduce((s,k)=>s+S(e.dados.compras[k]),0));
  premissas.push(`Alíquotas da consolidada: ISS ${fmtP(C.cfg.iss*100,2)}% (média ponderada pela receita de serviços de cada empresa), ICMS de venda ${fmtP(C.cfg.icmsV*100,2)}% (ponderado pelas vendas de mercadoria) e ICMS de compra ${fmtP(C.cfg.icmsC*100,2)}% (ponderado pelas compras) — o ISS segue o município e o ICMS a UF de cada estabelecimento, que continuam existindo como filiais. IPI, RAT/Terceiros, presunções do Lucro Presumido, período de apuração do Lucro Real e demais opções de configuração: da incorporadora ${inc.nome}.`);
  // 3. somas mês a mês
  const som = (sec, k) => Array.from({length:12}, (_,m) => r2(L.reduce((s,e)=> s + (+((e.dados[sec]||{})[k]||[])[m]||0), 0)));
  for (const sec of ['receitas','folha','compras','despesas']){
    const keys = new Set(L.flatMap(e=>Object.keys(e.dados[sec]||{})));
    for (const k of keys){
      if (/_pct$/.test(k)) continue;
      C[sec][k] = som(sec, k);
    }
    for (const k of keys) if (/_pct$/.test(k)){        // percentual ponderado pela base que ele qualifica
      const bk = INC_PCT_BASE[k] || k.replace(/_pct$/,'');
      C[sec][k] = Array.from({length:12}, (_,m) => {
        let sb = 0, sp = 0; for (const e of L){ const b = +((e.dados[sec]||{})[bk]||[])[m]||0; sb += b; sp += b * (+((e.dados[sec]||{})[k]||[])[m]||0); }
        return sb > 0 ? sp/sb : (+((inc.dados[sec]||{})[k]||[])[m]||0);
      });
    }
  }
  C.folha13 = { prolabore13:0, salarios13:0, baseFgts13:0 };
  for (const e of L) for (const k of Object.keys(C.folha13)) C.folha13[k] = r2(C.folha13[k] + (+(e.dados.folha13||{})[k]||0));
  // 4. janelas de 12 meses: RBT12 = SOMA (decisão de 01/09/2026); folha do Fator R = soma
  C.cfg.rbt12Lanc    = Array.from({length:12}, (_,m) => r2(L.reduce((s,e)=>s+(+e.dados.cfg.rbt12Lanc[m]||0),0)));
  C.cfg.rbt12ExpLanc = Array.from({length:12}, (_,m) => r2(L.reduce((s,e)=>s+(+e.dados.cfg.rbt12ExpLanc[m]||0),0)));
  C.cfg.folha12Lanc  = Array.from({length:12}, (_,m) => r2(L.reduce((s,e)=>s+(+e.dados.cfg.folha12Lanc[m]||0),0)));
  const usaDireto = L.filter(e => +e.dados.cfg.rbt12Direto > 0);
  if (usaDireto.length){
    C.cfg.rbt12Direto = r2(L.reduce((s,e)=> s + (+e.dados.cfg.rbt12Direto > 0 ? +e.dados.cfg.rbt12Direto : S(e.dados.cfg.rbt12Lanc)), 0));
    premissas.push(`RBT12 direto informado em ${usaDireto.map(e=>e.nome).join(', ')}: o RBT12 consolidado direto é a soma dos diretos com a soma dos lançados das demais (${fmtR(C.cfg.rbt12Direto)}).`);
  } else C.cfg.rbt12Direto = 0;
  premissas.push('RBT12 da consolidada = soma dos RBT12 de cada empresa, mês a mês (decisão de 01/09/2026). Operações entre as empresas ocorridas no ANO ANTERIOR não são abatidas do RBT12, por não haver analítico daquele período.');
  // 5. ICMS/IPI informados à mão: null = automático. Todos null → segue automático; misto → soma o manual com o valor que o motor apurou na isolada
  for (const sec of ['icms','ipi']) for (const k of ['cred','deb']){
    const todosNull = L.every(e => (e.dados[sec][k]||[]).every(v => v==null));
    if (todosNull){ C[sec][k] = Array(12).fill(null); continue; }
    const campo = sec==='icms' ? (k==='cred'?'icmsCred':'icmsDeb') : (k==='cred'?'ipiCred':'ipiDeb');
    C[sec][k] = Array.from({length:12}, (_,m) => r2(L.reduce((s,e)=>{ const v = (e.dados[sec][k]||[])[m]; return s + (v==null ? (+((e.R&&e.R.meses[m]||{})[campo])||0) : +v||0); }, 0)));
    const manuais = L.filter(e => (e.dados[sec][k]||[]).some(v=>v!=null)).map(e=>e.nome);
    notas.push(`${sec.toUpperCase()} ${k==='cred'?'crédito':'débito'} informado à mão em ${manuais.join(', ')}: na consolidada, o valor manual foi somado ao que o motor apurou para as demais empresas isoladas (com as alíquotas de cada uma).`);
  }
  // 6. origem: tudo marcado como consolidado (12 meses cobertos — nada a projetar na consolidada)
  C.origem = {};
  // 7. alertas de premissa que a lei impõe e o motor não sabe sozinho
  for (const e of L.slice(1)){
    if (+e.dados.cfg.lrPrejIrpj > 0 || +e.dados.cfg.lrPrejCsll > 0)
      notas.push(`${e.nome} tem saldo de prejuízo fiscal (${fmtR(e.dados.cfg.lrPrejIrpj)}) / base negativa de CSLL (${fmtR(e.dados.cfg.lrPrejCsll)}): NÃO é aproveitado pela incorporadora (DL 2.341/87, art. 33) — a consolidada considera apenas o saldo da incorporadora.`);
    if (String(e.dados.cfg.inicioAtividade||'').trim())
      notas.push(`${e.nome} está em início de atividade (${e.dados.cfg.inicioAtividade}): a proporcionalização de limite/RBT12 é dela e não se transfere à consolidada, que segue a incorporadora.`);
    for (const [k,rot] of [['iss','ISS'],['icmsV','ICMS de venda'],['icmsC','ICMS de compra']])
      if (Math.abs((+e.dados.cfg[k]||0) - (+inc.dados.cfg[k]||0)) > 1e-6)
        notas.push(`${rot} de ${e.nome} (${fmtP(+e.dados.cfg[k]*100,2)}%) difere do da incorporadora (${fmtP(+inc.dados.cfg[k]*100,2)}%): a consolidada usa ${fmtP(C.cfg[k]*100,2)}%, média ponderada pela base — se os estabelecimentos ficarem no mesmo município/UF depois da operação, informe a alíquota única na Configuração da incorporadora.`);
  }
  // 8. Reforma: soma das monetárias (já projetadas); percentuais da incorporadora; ausente → proxy pela análise
  let reforma = null;
  const comRf = L.filter(e=>e.reforma);
  if (comRf.length){
    reforma = rfNovo(inc.cnpj, ano);
    reforma.credSimplesPct = +(inc.reforma && inc.reforma.credSimplesPct) || 0;
    for (const e of L){
      let rf = e.reforma;
      if (!rf){
        const T = e.R ? e.R.totais : { receita:0, receitaExp:0 };
        rf = rfNovo(e.cnpj, ano);
        rf.receita = r2(Math.max(0, (T.receita||0) - (T.receitaExp||0)));
        const compras = ['semst','mono','comst','comstMono'].reduce((s,k)=>s+S(e.dados.compras[k]),0);
        rf.contra.compras_lrlp = r2(compras);
        notas.push(`${e.nome} não tem a aba Reforma preenchida: entrou na consolidada pela receita interna (${fmtR(rf.receita)}) e pelas compras da análise (${fmtR(compras)}, tratadas como de fornecedor do regime regular).`);
      }
      for (const k of INC_RF_MON) reforma[k] = r2(+reforma[k] + (+rf[k]||0));
      for (const g of ['contra','benefRec','benefCred']) for (const k of Object.keys(reforma[g])) reforma[g][k] = r2(+reforma[g][k] + (+(rf[g]||{})[k]||0));
    }
  } else notas.push('Nenhuma das empresas tem a aba Reforma preenchida: os cenários da consolidada usam o fallback do motor (receita e compras da própria análise).');
  return { dados: C, reforma, notas, premissas, abatidos };
}

// simulação completa: isoladas (real e projetada), consolidada, deltas, alertas
function incSimular(E, prem){
  const ano = +E.ano;
  const emps = E.empresas.map((e, i) => {
    const dados = anNormalizar(e.dados, e.cnpj, ano);
    const janela = E.janela || projJanelaEfetiva(dados.cfg).v;
    const Rreal = calcular(dados, PARAMS.anexos, folhaPercDaEmpresa(dados.cfg));
    let P = null; try { P = anProjetarAno(dados, janela); } catch(err){ P = null; }
    const dproj = P ? P.dados : dados;
    const Rproj = P ? calcular(dproj, PARAMS.anexos, folhaPercDaEmpresa(dproj.cfg)) : Rreal;
    const intReal = Math.max(0, (Rreal.totais.receita||0) - (Rreal.totais.receitaExp||0));
    const intProj = Math.max(0, (Rproj.totais.receita||0) - (Rproj.totais.receitaExp||0));
    const k = P && intReal > 0.005 ? intProj/intReal : 1;
    const reforma = dados.reforma ? rfProjetar(dados.reforma, k) : null;
    let cen = null; try { cen = calcCenariosReforma(Rproj, reforma); } catch(err){ cen = null; }
    return { cnpj:e.cnpj, nome:e.nome, regime:e.regime||'', incorporadora:i===0, dados, dproj, P, janela, k, Rreal, R:Rproj, reforma, cen,
             sn: snElegibilidade(Rproj, dproj.cfg), T: incTotais(Rproj, cen) };
  });
  const C = incConsolidar(emps.map(e=>({ cnpj:e.cnpj, nome:e.nome, regime:e.regime, dados:e.dproj, reforma:e.reforma, R:e.R })), prem && prem.abatimentos, ano);
  const Rc = calcular(C.dados, PARAMS.anexos, folhaPercDaEmpresa(C.dados.cfg));
  let cenC = null; try { cenC = calcCenariosReforma(Rc, C.reforma); } catch(err){ cenC = null; }
  const cons = { dados:C.dados, reforma:C.reforma, R:Rc, cen:cenC, sn: snElegibilidade(Rc, C.dados.cfg), T: incTotais(Rc, cenC) };
  const soma = incSomaTotais(emps.map(e=>e.T));
  const delta = incDelta(soma, cons.T);
  const anoRef = parAnoRefEfetivo(emps[0].dados.cfg).v;
  const alertas = incAlertas(emps, cons, C, delta, anoRef);
  return { ano, anoRef, calculadoEm: new Date().toISOString(), motorLacre: LACRE_HASH, motorDefasado: incMotorDefasado(),
           empresas: emps, consolidada: cons, soma, delta, alertas, premissas: C.premissas, notas: C.notas, abatidos: C.abatidos,
           projetadas: emps.filter(e=>e.P).map(e=>({ nome:e.nome, nReais:e.P.nReais, nProj:e.P.nProj, janela:e.P.janela })) };
}
function incTotais(R, cen){
  const T = R.totais, M = R.meses, anos = {};
  for (const L of ((cen&&cen.REF)||[])) if (L.ano>=2027) anos[L.ano] = { dentro: cenDentro(T,L), hib:+L.hib||0, regular:+L.regular||0, lp:+L.regLP||0, lr:+L.regLR||0, regNome:L.regNome||'', snBloqueado:!!L.snBloqueado, snMotivo:L.snMotivo||null, deb:+L.deb||0, cred:+L.cred||0, liquido:+L.liquido||0 };
  return { receita:+T.receita||0, receitaExp:+T.receitaExp||0, recCom:+T.recCom||0, recServ:+T.recServ||0,
           simples:+T.simples||0, lp:+T.lp||0, lr:+T.lr||0, das:+T.das||0, trava:+T.sublimite||0, dasGuia:+T.dasGuia||0,
           adicionalLP: M.reduce((s,x)=>s+(+x.lp.adicional||0),0), adicionalLR: M.reduce((s,x)=>s+(+x.lr.adicional||0),0),
           issLP: M.reduce((s,x)=>s+(+x.lp.iss||0),0), icmsLP: M.reduce((s,x)=>s+(+x.lp.icms||0),0),
           inssPatr: M.reduce((s,x)=>s+(+x.inssPatr||0),0), folha: M.reduce((s,x)=>s+(+x.folhaTotal||0),0),
           rbt12Max: Math.max(0, ...M.map(x=>+x.rbt12||0)), faixaJan: M[0]?.faixa, faixaDez: M[11]?.faixa,
           fatorRMedio: (R.fatorRMensal||[]).length ? R.fatorRMensal.reduce((a,b)=>a+b,0)/R.fatorRMensal.length : (R.fatorR||0),
           anos };
}
function incSomaTotais(Ts){
  const out = { receita:0, receitaExp:0, recCom:0, recServ:0, simples:0, lp:0, lr:0, das:0, trava:0, dasGuia:0, adicionalLP:0, adicionalLR:0, issLP:0, icmsLP:0, inssPatr:0, folha:0, anos:{} };
  for (const T of Ts){ for (const k of Object.keys(out)) if (k!=='anos') out[k] += +T[k]||0;
    for (const [a,v] of Object.entries(T.anos||{})){ const o = out.anos[a] || (out.anos[a] = { dentro:0, hib:0, regular:0, lp:0, lr:0 }); for (const k of Object.keys(o)) o[k] += +v[k]||0; } }
  return out;
}
function incDelta(soma, cons){
  const d = k => ({ soma:+soma[k]||0, cons:+cons[k]||0, dif:(+cons[k]||0)-(+soma[k]||0), pct: soma[k] ? ((+cons[k]||0)-(+soma[k]||0))/soma[k] : 0 });
  const out = { simples:d('simples'), lp:d('lp'), lr:d('lr'), anos:{} };
  for (const a of Object.keys(cons.anos||{})) out.anos[a] = {};
  for (const a of Object.keys(out.anos)) for (const k of ['dentro','hib','regular','lp','lr']){
    const s = +(soma.anos[a]||{})[k]||0, c = +(cons.anos[a]||{})[k]||0;
    out.anos[a][k] = { soma:s, cons:c, dif:c-s, pct: s ? (c-s)/s : 0 };
  }
  return out;
}
function incAlertas(emps, cons, C, delta, anoRef){
  const A = [], T = cons.T, R = cons.R, inc = emps[0];
  const snI = cons.sn;
  if (snI.estado === 'inelegivel') A.push({ n:'err', t:`Consolidada INELEGÍVEL ao Simples Nacional: RBT12 máximo de ${fmtR(snI.rbtMax)} contra o teto de ${fmtR(snI.teto)}${snI.fonte==='declarado'?' (declarado)':''}. A incorporação implica saída do Simples — a coluna "Simples" da consolidada é apenas referência.` });
  else if (snI.estado === 'transicao') A.push({ n:'err', t:`Consolidada ULTRAPASSA o teto do Simples durante o ano (excesso de ${fmtP(snI.excesso*100,1)}%${snI.mesEstouro?', no mês '+MESES[snI.mesEstouro-1]:''}): exclusão ${snI.efeito}. A incorporação tende a levar o grupo para o regime regular.` });
  else {
    const isolAcima = emps.filter(e=>e.sn.estado!=='elegivel').map(e=>e.nome);
    if (isolAcima.length) A.push({ n:'warn', t:`${isolAcima.join(', ')} não seria elegível ao Simples isoladamente, mas a consolidada fica dentro do teto — confira o cadastro e o RBT12 lançado.` });
  }
  if (R.subMon && R.subMon.impedimento) A.push({ n:'warn', t:'Sublimite da consolidada: ' + (typeof subMonTexto==='function' ? String(subMonTexto(R.subMon)).replace(/<[^>]+>/g,'') : (R.subMon.impedimento.motivo||'impedimento ao recolhimento de ICMS/ISS dentro do DAS')) });
  else if (T.trava > 0.5) A.push({ n:'warn', t:`RBT12 consolidado acima do sublimite de R$ 3,6 mi: ICMS/ISS pela trava da 5ª faixa (${fmtR(T.trava)} no ano) — já dentro do DAS da consolidada.` });
  // faixa e anexo
  for (const e of emps){
    if (e.T.faixaDez != null && T.faixaDez != null && +T.faixaDez !== +e.T.faixaDez)
      A.push({ n:'info', t:`${e.nome}: faixa ${e.T.faixaDez} isolada → faixa ${T.faixaDez} na consolidada (dezembro). A alíquota efetiva do Simples sobe com a soma dos RBT12 — é o principal componente do Δ.` });
  }
  // Fator R
  const fr = emps.map(e=>e.T.fatorRMedio||0), frC = T.fatorRMedio||0;
  const temServ = emps.some(e => (e.T.recServ||0) > 0.5);
  if (temServ && (fr.some(f=>f>=0.28) !== (frC>=0.28) || fr.some(f=>(f>=0.28)!==(frC>=0.28))))
    A.push({ n:'warn', t:`Fator R muda com a folha conjunta: ${emps.map(e=>`${e.nome} ${fmtP(e.T.fatorRMedio*100,1)}%`).join(' · ')} → consolidada ${fmtP(frC*100,1)}% (limiar de 28%: Anexo III × V).` });
  // adicional de IRPJ
  const somaAdLP = emps.reduce((s,e)=>s+e.T.adicionalLP,0), somaAdLR = emps.reduce((s,e)=>s+e.T.adicionalLR,0);
  if (T.adicionalLP - somaAdLP > 0.5 || T.adicionalLR - somaAdLR > 0.5)
    A.push({ n:'info', t:`Adicional de IRPJ (10% sobre o lucro acima de R$ 20 mil/mês): Presumido ${fmtR(somaAdLP)} → ${fmtR(T.adicionalLP)}; Real ${fmtR(somaAdLR)} → ${fmtR(T.adicionalLR)}. Somar lucros cruza o limite que cada empresa, sozinha, não cruzava.` });
  // prejuízo e demais notas de premissa
  for (const n of C.notas) A.push({ n: /prejuízo|NÃO é aproveitado/.test(n) ? 'err' : 'info', t:n });
  // projeção
  const proj = emps.filter(e=>e.P);
  if (proj.length) A.push({ n:'info', t:`Ano incompleto projetado individualmente antes da soma: ${proj.map(e=>`${e.nome} (${e.P.nReais} meses lançados, ${e.P.nProj} estimados pela ${PROJ_JANELAS[e.P.janela]||e.P.janela})`).join('; ')}.` });
  // Reforma
  const LR = T.anos[anoRef]; if (LR && LR.snBloqueado) A.push({ n:'warn', t:`Em ${anoRef} o caminho "por dentro" da consolidada está bloqueado: ${LR.snMotivo||'receita acima do limite'}.` });
  return A;
}
function incMelhor(a){ const c = [['dentro',a.dentro],['hib',a.hib],['regular',a.regular]].filter(x=>x[1]>0); c.sort((x,y)=>x[1]-y[1]); return c[0]?c[0][0]:'—'; }
const INC_CAM_ROT = { dentro:'Simples por dentro', hib:'Híbrido (art. 22-A)', regular:'Regime regular' };
