// ══ v1.5.0 · RELATÓRIOS REMODELADOS — modelo único (incModelo), classificação em 5 categorias, ══════════
// ══ Parecer Consolidado de Incorporação (20 seções), 8 relatórios separados, geração conjunta e Excel ══
//  Regras (prompt de 14/09/2026):
//   • NENHUM número novo: tudo sai de INC.res (motor lacrado) e de incCenarios()/incScore(); este bloco só
//     agrega e apresenta. O que exigiria dado que o sistema não recebe (balanço, dívidas, contratos…) fica
//     declarado como "Não avaliada por ausência de dados suficientes." e contado em `pendencias`.
//   • Convenção ÚNICA de sinal (decisão D1): Δ = consolidada − separadas. Positivo = ACRÉSCIMO (vermelho),
//     negativo = ECONOMIA (verde), |Δ| < R$ 0,50 = neutro. Toda tabela com Δ traz a coluna "Leitura".
//   • Classificação (decisão D2): ANÁLISE INCOMPLETA · DESFAVORÁVEL (< 40) · NEUTRO (40–59 ou |economia| < 1%) ·
//     FAVORÁVEL COM RESSALVAS (≥ 60 com alerta de fronteira ou dimensão pendente) · FAVORÁVEL (≥ 60, sem ressalva).
//     A palavra "recomendado" não é usada quando há dimensão pendente (patrimonial/financeira/societária).
//   • Cenário inelegível nunca é "melhor cenário" (incRegimesPermitidos já o exclui); aqui ele aparece como
//     "Não permitido — motivo" em toda tabela de regimes.
//   • Todos os relatórios (principal, separados, conjunto, apresentações e Excel) leem o MESMO modelo.

const INC_CLASSES = { FAV:'FAVORÁVEL', RES:'FAVORÁVEL COM RESSALVAS', NEU:'NEUTRO', DES:'DESFAVORÁVEL', INC:'ANÁLISE INCOMPLETA' };
const INC_CLASSE_CLS = { FAV:'ok', RES:'warn', NEU:'neutro', DES:'err', INC:'err' };
const INC_CLASSE_COR = { ok:'var(--ok)', warn:'var(--warn)', neutro:'var(--muted)', err:'var(--err)' };
const INC_DIMENSOES = ['tributária','financeira','patrimonial','societária','Reforma Tributária'];
const INC_NAO_AVALIADA = 'Não avaliada por ausência de dados suficientes.';
const INC_FIN_NAO_CONCLUIDA = 'Análise financeira não concluída por ausência de dados suficientes.';

// ── sinal único ──
const incLeit = (d, trib=true) => d > 0.5 ? (trib ? 'acréscimo' : 'aumento') : d < -0.5 ? (trib ? 'economia' : 'redução') : 'neutro';
const incCorD = d => d > 0.5 ? 'var(--err)' : d < -0.5 ? 'var(--ok)' : 'var(--muted)';
const incZero = v => Math.abs(+v||0) < 0.005 ? 0 : +v;
function incDelta3(antes, depois, moeda=true, trib=true){
  const d = incZero((+depois||0) - (+antes||0)), p = Math.abs(antes) > 0.005 ? d/Math.abs(antes) : 0;
  // moeda=false: os valores já vêm em pontos percentuais (ex.: carga × 100) — a diferença é em p.p.
  return `<td class="num" style="color:${incCorD(d)}">${moeda ? fmt(d) : fmtP(d,2)+' p.p.'}</td><td class="num" style="color:${incCorD(d)}">${fmtP(p*100,1)}%</td><td style="color:${incCorD(d)};white-space:nowrap">${incLeit(d, trib)}</td>`;
}
const INC_LEG_SINAL = 'Δ = consolidada − separadas · <span style="color:var(--err)">positivo = acréscimo</span> · <span style="color:var(--ok)">negativo = economia</span> · neutro = diferença inferior a R$ 0,50.';

// ── classificação em 5 categorias (sobre o score já existente — fórmulas intocadas) ──
function incClassificar(c, pend){
  const sc = c.score, dT = sc.dims.tributario || { rel:0 };
  const pendDim = (pend||[]).filter(p => /patrimonial|financeira|societária/.test(p.dim)).length;
  const nAl = (c.alertas||[]).length, motivos = [];
  let k;
  if (sc.incompleta && sc.motivos.some(m => /Dado crítico|motor defasado/.test(m))) { k = 'INC'; motivos.push('dado crítico ausente ou motor defasado'); }
  else if (sc.total < 40) { k = 'DES'; motivos.push(`score ${Math.round(sc.total)} < 40`); }
  else if (sc.total < 60 || Math.abs(dT.rel||0) < 0.01) { k = 'NEU'; motivos.push(sc.total < 60 ? `score ${Math.round(sc.total)} entre 40 e 59` : 'diferença tributária inferior a 1% da carga'); }
  else if (nAl || pendDim) { k = 'RES'; if (nAl) motivos.push(`${nAl} alerta(s) de fronteira`); if (pendDim) motivos.push('dimensões patrimonial, financeira e/ou societária não avaliadas'); }
  else k = 'FAV';
  return { k, rot: INC_CLASSES[k], cls: INC_CLASSE_CLS[k], cor: INC_CLASSE_COR[INC_CLASSE_CLS[k]], motivos };
}
const incBadgeClasse = cl => `<span class="badge ${cl.cls==='neutro'?'':cl.cls}" style="${cl.cls==='neutro'?'background:#eee;color:#555;':''}font-weight:700">${esc(cl.rot)}</span>`;

// ── pendências (dados que o sistema não recebe ou que faltam nesta simulação) ──
function incPendencias(R, CE){
  const P = [], E = R.empresas;
  const add = (dim, item, texto) => P.push({ dim, item, texto });
  add('patrimonial','Balanço patrimonial','Ativo, passivo, patrimônio líquido e caixa de cada empresa (o sistema não recebe balanço).');
  add('patrimonial','Endividamento','Empréstimos, financiamentos, dívidas fiscais e trabalhistas, contingências — liquidez, dívida líquida e dívida/EBITDA não calculados.');
  const temCustos = incTemCustos(R.consolidada.R);
  if (!temCustos) add('financeira','Custos e despesas','Não há custos e despesas lançados nas análises: lucro, margem e resultado por regime não puderam ser medidos.');
  add('financeira','Ponto de equilíbrio','Exige a separação de custos fixos × variáveis — não lançada.');
  add('financeira','Capacidade de pagamento','Exige geração de caixa e serviço da dívida — sem dados.');
  add('societária','Sucessão de direitos e obrigações','Contratos, licenças, funcionários, clientes, fornecedores, imóveis, veículos, marcas e sistemas não são cadastrados no sistema (CC, art. 1.116; CTN, art. 132).');
  add('societária','Validação jurídica e contábil','Protocolo, laudo de avaliação (CC, art. 1.117; Lei 6.404, art. 227), atos societários e baixa do CNPJ incorporado.');
  for (const e of E) if (e.P) add('dados', `Projeção — ${e.nome}`, `Ano incompleto: ${e.P.nReais} meses lançados e ${e.P.nProj} estimados (janela de projeção: ${(typeof PROJ_JANELAS!=='undefined' && PROJ_JANELAS[e.P.janela])||e.P.janela}) — confira a projeção antes de decidir.`);
  const an = (INC.entradas && INC.entradas.empresas) || [];
  if (an.length && !an.some(e => e.analiticos && ((e.analiticos.venda&&e.analiticos.venda.itens&&e.analiticos.venda.itens.length) || (e.analiticos.compra&&e.analiticos.compra.itens&&e.analiticos.compra.itens.length))))
    add('dados','Operações entre as empresas','Sem analíticos de venda/compra gravados: as operações intragrupo não foram verificadas — se existirem, receita e crédito consolidados estão superestimados.');
  if (R.motorDefasado) add('dados','Motor defasado', `A simulação foi calculada com o lacre ${R.motorLacre}, diferente do motor em produção — recalcule antes de decidir.`);
  if (CE && !CE.S3 && E.length > 2) add('dados','Sentido inverso','Com 3 ou mais empresas o cenário de incorporação em sentido inverso não é simulado; só a incorporadora escolhida foi avaliada.');
  return P;
}
const incSnEstadoRot = sn => !sn ? '—' : sn.estado === 'elegivel' ? 'sim' : sn.estado === 'inelegivel' ? 'não — inelegível (RBT12 acima do teto)' : sn.estado === 'transicao' ? 'não — ultrapassa o teto durante o ano' : 'não — ' + String(sn.estado||'');
const incTemCustos = R => R && R.meses && R.meses.reduce((s,m)=>s+(+m.custos||0)+(+m.despTotal||0),0) > 0.005;

// ── detalhe por tributo (base → alíquota → fórmula → valor) para UMA entidade e UM regime ──
const incSM = (R, f) => (R && R.meses ? R.meses : []).reduce((s,m)=>s+(+f(m)||0),0);
function incTributosDetalhe(R, reg, cfg){
  const s = f => incSM(R, f), cfg_ = cfg || {};
  const rec = s(m=>m.receita), folha = s(m=>m.folhaTotal), recServ = s(m=>m.recServ), recCom = s(m=>m.recCom);
  const row = (tributo, base, valor, formula, nominal) => ({ tributo, base, aliq: (base != null && Math.abs(base) > 0.005) ? valor/base : null, nominal: nominal||'', formula, valor });
  if (reg === 'simples'){
    const das = s(m=>m.das), part = k => s(m=>(m.dasTrib||{})[k]);
    const nomes = [['irpj','IRPJ — parcela do DAS'],['csll','CSLL — parcela do DAS'],['pis','PIS — parcela do DAS'],['cofins','COFINS — parcela do DAS'],['cpp','CPP (INSS patronal) — parcela do DAS'],['icms','ICMS — parcela do DAS'],['iss','ISS — parcela do DAS'],['ipi','IPI — parcela do DAS']];
    const linhas = nomes.map(([k,n]) => row(n, rec, part(k), 'receita do mês × alíquota efetiva da faixa (RBT12) × percentual de repartição do anexo — LC 123/2006, art. 18 e Anexos I a V', 'partilha do anexo'));
    linhas.push(row('ICMS impedido no DAS — recolhido à UF (sublimite)', null, s(m=>(m.simples||{}).impIcms), 'receita do mês × alíquota de ICMS da UF, nos meses em que o recolhimento no DAS está impedido — LC 123/2006, art. 20, § 1º', 'ICMS da configuração'));
    linhas.push(row('ISS impedido no DAS — recolhido ao município (sublimite)', null, s(m=>(m.simples||{}).impIss), 'receita de serviços do mês × alíquota de ISS do município, nos meses de impedimento — LC 123/2006, art. 20, § 1º', 'ISS da configuração'));
    linhas.push(row('CPP fora do DAS (Anexo IV)', folha, s(m=>(m.simples||{}).inssPatrForaDAS), 'folha × (20% + RAT + terceiros) — Anexo IV recolhe a CPP em GPS, fora do DAS', '20% + RAT + terceiros'));
    linhas.push(Object.assign(row('(incluído acima) trava da 5ª faixa — ICMS/ISS por fora da partilha', null, s(m=>(m.subIcms||0)+(m.subIss||0)), 'receita acima do sublimite × alíquota de ICMS/ISS da incorporadora — LC 123/2006, art. 13-A; já contido nas parcelas de ICMS e ISS acima', 'ICMS/ISS da configuração'), { info:true }));
    linhas.push(row('CPP retida na fonte (cessão de mão de obra, 11%)', null, s(m=>(m.simples||{}).cppRetida), 'receitas com retenção previdenciária × 11% — Lei 8.212/91, art. 31', '11%'));
    const issNaCarga = cfg_.issRetidoNaCarga === true;
    linhas.push(Object.assign(row((issNaCarga ? '' : '(informativo) ') + 'ISS retido na fonte pelo tomador', null, s(m=>(m.simples||{}).issRetido), 'receitas com retenção × alíquota do ISS do município — recolhido pelo tomador' + (issNaCarga ? '; a empresa optou por contá-lo na carga' : ', não compõe o total do regime (opção padrão)'), ''), { info: !issNaCarga }));
    linhas.push(Object.assign(row('(informativo) FGTS', folha, s(m=>(m.simples||{}).fgts||m.fgts), 'folha × 8% — encargo trabalhista, igual em todos os regimes; não compõe o total do regime', '8%'), { info:true }));
    return { reg, linhas, total: s(m=>(m.simples||{}).total), dasGuia: s(m=>m.dasGuia), das, receita: rec };
  }
  const g = f => s(m=>(m[reg]||{})[f]);
  const basePC = g('basePC'), baseIR = reg === 'lp' ? g('baseAdic') : g('baseIRCS');
  const nMeses = (R.meses||[]).filter(m=>(+m.receita||0)>0.005).length || 12;
  const linhas = [];
  if (reg === 'lp'){
    const bc = (R.meses||[]).map(m=>(m.lp||{}).baseComp||{});
    const bServ = bc.reduce((a,b)=>a+(+b.serv||0),0), bCom = bc.reduce((a,b)=>a+(+b.com||0),0);
    const pS = +cfg_.lpBaseServCsll || 0.32, pC = +cfg_.lpBaseComCsll || 0.12;
    const baseCsll = (bServ*pS + bCom*pC) > 0.005 ? bServ*pS + bCom*pC : (g('csll') > 0.005 ? g('csll')/0.09 : null);
    linhas.push(row('IRPJ', baseIR, g('irpj'), `lucro presumido (serviços × ${fmtP((+cfg_.lpBaseServ||0.32)*100,0)}% + comércio × ${fmtP((+cfg_.lpBaseComm||+cfg_.lpBaseCom||0.08)*100,0)}%) × 15% — Lei 9.249/95, art. 15; RIR/2018, art. 591`, '15%'));
    linhas.push(row('Adicional de IRPJ', null, g('adicional'), 'parcela do lucro presumido que excede R$ 20.000 × meses do período de apuração × 10% — Lei 9.249/95, art. 3º, § 1º', '10%'));
    linhas.push(row('CSLL', baseCsll, g('csll'), `base de cálculo (serviços × ${fmtP(pS*100,0)}% + comércio × ${fmtP(pC*100,0)}%) × 9% — Lei 9.249/95, art. 20`, '9%'));
    linhas.push(row('PIS', basePC, g('pis'), 'receita bruta (menos exclusões) × 0,65% — cumulativo, Lei 9.718/98', '0,65%'));
    linhas.push(row('COFINS', basePC, g('cofins'), 'receita bruta (menos exclusões) × 3% — cumulativo, Lei 9.718/98', '3%'));
  } else {
    linhas.push(row('IRPJ', baseIR, g('irpj'), 'lucro real (receita − custos − folha − despesas − tributos dedutíveis, ajustado pelos prejuízos compensáveis) × 15% — RIR/2018, art. 623', '15%'));
    linhas.push(row('Adicional de IRPJ', null, g('adicional'), 'lucro real que excede R$ 20.000 × meses do período de apuração × 10% — Lei 9.249/95, art. 3º, § 1º', '10%'));
    linhas.push(row('CSLL', baseIR, g('csll'), 'base ajustada × 9% — Lei 7.689/88; compensação de base negativa limitada a 30%', '9%'));
    linhas.push(row('PIS', basePC, g('pis'), 'receita bruta × 1,65% menos créditos sobre insumos e despesas admitidas — Lei 10.637/02', '1,65%'));
    linhas.push(row('COFINS', basePC, g('cofins'), 'receita bruta × 7,6% menos créditos — Lei 10.833/03', '7,6%'));
  }
  const deb = s(m=>m.icmsDeb), cred = s(m=>m.icmsCred);
  linhas.push(Object.assign(row('ICMS', deb, g('icms'), `débito das saídas (${fmtR(deb)}) − crédito das entradas (${fmtR(cred)}) — alíquotas da UF da incorporadora`, 'ICMS venda/compra da configuração'), { aliq:null }));
  linhas.push(row('IPI', null, g('ipi'), 'débito − crédito de IPI, conforme lançado', ''));
  linhas.push(row('ISS', recServ, g('iss'), 'receita de serviços (sem as retidas) × alíquota do município da incorporadora', cfg_.iss != null ? fmtP(+cfg_.iss,2)+'%' : ''));
  linhas.push(row('INSS patronal', folha, g('inssPatr'), 'folha × (20% + RAT + terceiros) — Lei 8.212/91, art. 22', '20% + RAT + terceiros'));
  linhas.push(Object.assign(row('(informativo) FGTS', folha, g('fgts'), 'folha × 8% — encargo trabalhista, igual em todos os regimes; não compõe o total do regime', '8%'), { info:true }));
  return { reg, linhas, total: g('total'), receita: rec, nMeses };
}
// motivo por que a diferença aparece (texto por tributo, a partir do que o motor decidiu)
function incMotivoTributo(tributo, reg, R, sepIsos, cons){
  const t = tributo.toLowerCase();
  if (reg === 'simples'){
    if (/parcela do das/.test(t)) return `alíquota efetiva sobe com a soma dos RBT12 (faixa ${sepIsos.map(e=>e.T.faixaDez??'—').join('/')} → ${cons.T.faixaDez??'—'})${/cpp|iss|irpj|csll/.test(t) && sepIsos.some(e=>(e.T.recServ||0)>0.5) ? '; Fator R da folha conjunta pode trocar o anexo' : ''}`;
    if (/trava|sublimite/.test(t)) return 'RBT12 consolidado acima do sublimite de R$ 3,6 mi: ICMS/ISS saem do DAS';
    if (/cpp fora/.test(t)) return 'folha somada no Anexo IV';
    return 'proporcional à soma das bases';
  }
  if (/adicional/.test(t)) return 'somar lucros cruza o limite de R$ 20 mil/mês que cada empresa, sozinha, não cruzava (ou cruzava menos)';
  if (/irpj|csll/.test(t)) return reg === 'lr' ? 'base = lucro real da soma; prejuízo fiscal das incorporadas não é aproveitado (DL 2.341/87, art. 33)' : 'presunção da incorporadora aplicada à receita somada (serviços × comércio)';
  if (/icms/.test(t)) return 'alíquotas da UF da incorporadora aplicadas às bases somadas (média ponderada na configuração)';
  if (/iss/.test(t)) return 'alíquota do município da incorporadora sobre os serviços somados';
  if (/pis|cofins/.test(t)) return reg === 'lr' ? 'créditos das duas empresas somados à base' : 'proporcional à receita somada';
  if (/inss|fgts/.test(t)) return 'proporcional à folha somada (RAT e terceiros da incorporadora)';
  return 'proporcional à soma das bases';
}

// ── regimes da consolidada: permitido?, motivo, tributos, carga, resultado após tributos e margem ──
function incRegimesDetalhe(ent){
  const R = ent.R, T = ent.T, sn = ent.sn || {}, s = f => incSM(R, f);
  // lucro antes dos tributos do regime = receita + financeiras − custos − folha − despesas (reconstruído da base do LR, do motor)
  const LAT = R && R.meses ? s(m => (m.lr.baseIRCS||0) + (m.lr.inssPatr||0) + (m.lr.pis||0) + (m.lr.cofins||0) + (m.lr.icms||0) + (m.lr.ipi||0) + (m.lr.iss||0)) : null;
  const temCustos = incTemCustos(R);
  const perm = incRegimesPermitidos(sn);
  const motivoSn = sn.estado === 'inelegivel' ? `RBT12 de ${fmtR(sn.rbtMax)} acima do teto de ${fmtR(sn.teto)} (LC 123/2006, art. 3º, II)`
    : sn.estado === 'transicao' ? `receita ultrapassa o teto durante o ano (excesso de ${fmtP((sn.excesso||0)*100,1)}%${sn.mesEstouro?', no mês '+MESES[sn.mesEstouro-1]:''}) — exclusão ${sn.efeito||''} (LC 123/2006, art. 3º, § 9º)` : '';
  const lrInc = !!(R && R.totais && R.totais.lrIncompleto);
  const linhas = ['simples','lp','lr'].map(k => {
    const trib = +T[k]||0, fgts = R && R.meses ? s(m => k==='simples' ? ((m.simples||{}).fgts||m.fgts||0) : ((m[k]||{}).fgts||0)) : 0;
    const permitido = perm.includes(k);
    const res = (temCustos && LAT != null) ? LAT - trib : null;   // os totais do motor já excluem o FGTS (v7.18.0) — no LR reproduz exatamente baseIRCS − IRPJ − CSLL − adicional
    return { k, nome: INC_REGIME_NOME[k], permitido, motivo: permitido ? (k==='lr' && lrInc ? 'permitido — apuração do Lucro Real incompleta: ' + esc(R.totais.lrIncompletoMotivo||'faltam custos/despesas') : '') : motivoSn,
             trib, carga: T.receita > 0.005 ? trib/T.receita : 0, resultado: res, margem: (res != null && T.receita > 0.005) ? res/T.receita : null, fgts };
  });
  const permL = linhas.filter(l=>l.permitido);
  const menorTrib = permL.slice().sort((a,b)=>a.trib-b.trib)[0];
  const maiorRes = temCustos ? permL.filter(l=>l.resultado!=null).sort((a,b)=>b.resultado-a.resultado)[0] : null;
  return { linhas, LAT, temCustos, menorTrib: menorTrib ? menorTrib.k : null, maiorRes: maiorRes ? maiorRes.k : null, motivoSn };
}

// ── Reforma ano a ano: A, B, separadas, consolidada, IBS, CBS, débito, crédito, líquido, Δ, %, acumulado, início/inversão ──
function incReformaDetalhe(CE, R){
  const c2 = CE.cen[1], sep = CE.cen[0], iso = CE.iso;
  const ref = (typeof PARAMS !== 'undefined' && PARAMS.reforma) || RF_ALIQ_DEFAULT;
  const cen = R.consolidada && R.consolidada.cen && R.consolidada.cen.REF ? R.consolidada.cen.REF : null;
  const anos = c2.ind.refAnos.map((x,i) => {
    const q = Object.assign({}, RF_ALIQ_DEFAULT[x.ano]||{}, (ref[x.ano]||{}));
    const alq = (+q.cbs||0) + (+q.ibse||0) + (+q.ibsm||0), shCbs = alq > 0 ? (+q.cbs||0)/alq : 0;
    const L = cen ? cen.find(l => l.ano === x.ano) : null;
    const s = (sep.ind.refAnos[i]||{}).v || 0, d = x.v - s;
    const yA = R.consolidada.T.anos[x.ano] || {};
    return { ano: x.ano, cam: x.cam, camRot: x.cam==='dentro'?'Simples por dentro':x.cam==='hib'?'híbrido (art. 22-A)':'regime regular',
             isos: iso.map(e => ({ nome: e.nome, v: (e.ind.refAnos[i]||{}).v || 0, cam: (e.ind.refAnos[i]||{}).cam })),
             sep: s, cons: x.v, delta: d, pct: Math.abs(s) > 0.005 ? d/Math.abs(s) : 0,
             deb: +x.deb||0, cred: +x.cred||0, liq: (+x.deb||0) - (+x.cred||0), cbs: (+x.deb||0)*shCbs, ibs: (+x.deb||0)*(1-shCbs),
             aliqCbs: +q.cbs||0, aliqIbs: (+q.ibse||0)+(+q.ibsm||0), alq,
             snBloqueado: !!yA.snBloqueado, snMotivo: yA.snMotivo||null, p190: L && L.p190 ? L.p190 : null, sens: L && L.sens ? L.sens : null, projetada: true };
  });
  let ac = 0; for (const a of anos){ ac += a.delta; a.acum = ac; }
  const sinais = anos.map(a => a.delta < -0.5 ? -1 : a.delta > 0.5 ? 1 : 0);
  const inicioVantagem = anos.find((a,i) => sinais[i] === -1);
  let inversao = null, ult = 0;
  for (let i = 0; i < anos.length; i++){ if (sinais[i] === 0) continue; if (ult !== 0 && sinais[i] !== ult){ inversao = anos[i]; break; } ult = sinais[i]; }
  const acumTotal = anos.length ? anos[anos.length-1].acum : 0;
  return { anos, inicioVantagem, inversao, acumTotal, nota: 'Valores de 2027 a 2033 calculados com as alíquotas de IBS/CBS projetadas para cada ano (parâmetros do aplicativo: CBS ' + anos.map(a=>a.ano+' '+fmtP(a.aliqCbs,2)+'%').join(', ') + '; IBS estadual + municipal em degraus) e com as premissas de crédito configuradas — são estimativas, não apuração.' };
}

// ── MODELO ÚNICO ──
function incModelo(){
  const R = INC.res; if (!R || !R.consolidada) return null;
  const CE = incCenarios(); if (!CE) return null;
  const chaveIA = INC._ia ? INC._ia.quando : '';
  if (INC._modelo && INC._modelo.base === R && INC._modelo.cen === CE && INC._modelo.chaveIA === chaveIA) return INC._modelo;
  const E = R.empresas, sep = CE.cen[0], c2 = CE.cen[1], melhor = CE.rank[0];
  const pend = incPendencias(R, CE);
  CE.cen.forEach(c => { if (!c.sep) c.classe = incClassificar(c, pend); });
  sep.classe = { k:'REF', rot:'referência — situação atual', cls:'neutro', cor:'var(--muted)', motivos:[] };
  const TX = Object.assign(incTextosPadrao(R), incTextosDecisao(CE), (INC._ia && INC._ia.textos) || {});
  const ents = E.map((e,i) => ({ chave:e.cnpj, nome:e.nome, rot: i===0?'Incorporadora':'Incorporada', cnpj:e.cnpj, regime:e.regime, R:e.R, T:e.T, sn:e.sn, cfg:(e.dados&&e.dados.cfg)||{}, P:e.P, ind: CE.iso[i].ind }));
  const cons = { chave:'cons', nome:'CONSOLIDADA — ' + E.map(e=>e.nome).join(' + '), rot:'Consolidada', cnpj:E[0].cnpj, R:R.consolidada.R, T:R.consolidada.T, sn:R.consolidada.sn, cfg:(R.consolidada.dados&&R.consolidada.dados.cfg)||{}, ind:c2.ind };
  // por tributo — nos três regimes, cada entidade
  const tributos = {};
  for (const reg of ['simples','lp','lr']){
    const isoD = ents.map(e => incTributosDetalhe(e.R, reg, e.cfg)), consD = incTributosDetalhe(cons.R, reg, cons.cfg);
    tributos[reg] = { linhas: consD.linhas.map((l,i) => { const isos = isoD.map(d => d.linhas[i].valor), soma = isos.reduce((a,b)=>a+b,0);
        return { tributo:l.tributo, info:!!l.info, base:{ isos: isoD.map(d=>d.linhas[i].base), soma: isoD.every(d=>d.linhas[i].base!=null) ? isoD.reduce((a,d)=>a+d.linhas[i].base,0) : null, cons: l.base }, aliq:{ isos: isoD.map(d=>d.linhas[i].aliq), cons: l.aliq }, nominal:l.nominal, formula:l.formula,
                 isos, soma, cons:l.valor, delta:l.valor-soma, pct: Math.abs(soma)>0.005 ? (l.valor-soma)/Math.abs(soma) : 0, motivo: Math.abs(l.valor-soma) > 0.5 ? incMotivoTributo(l.tributo, reg, R, ents, cons) : '' }; }),
      total: { isos: ents.map(e=>+e.T[reg]||0), soma: +R.soma[reg]||0, cons: +R.consolidada.T[reg]||0 }, permitido: c2.ind.perm.includes(reg) };
  }
  const regimes = { cons: incRegimesDetalhe(cons), isos: ents.map(e => incRegimesDetalhe(e)) };
  const resAt = (d, k) => { const l = d.linhas.find(x=>x.k===k); return l && l.resultado != null ? l.resultado : null; };
  regimes.resIsos = ents.map((e,i) => resAt(regimes.isos[i], e.ind.reg));
  regimes.resSep = regimes.resIsos.every(v => v != null) ? regimes.resIsos.reduce((a,b)=>a+b,0) : null;
  regimes.resCons = resAt(regimes.cons, c2.ind.reg);
  CE.cen.forEach(c => { if (!c.sep && c.classe) c.score.classe5 = c.classe; });
  const reforma = incReformaDetalhe(CE, R);
  const ranking = [melhor, ...CE.rank.filter(c=>c!==melhor)].map((c,i) => ({ pos:i+1, nome:c.nome, incorporadora: c.res ? c.res.empresas[0].nome : '—', incorporadas: c.res ? c.res.empresas.slice(1).map(e=>e.nome).join(', ') : '—', regime:c.ind.regNome,
    trib:c.ind.trib, carga:c.ind.carga, resultado: c.res ? incRegimesDetalhe({ R:c.res.consolidada.R, T:c.res.consolidada.T, sn:c.res.consolidada.sn }).linhas.find(l=>l.k===c.ind.reg) : null,
    refAcum:c.ind.refAcum, refDelta: c.ind.refAcum - sep.ind.refAcum, tribDelta: c.ind.trib - sep.ind.trib, estab: Math.round(c.score.dims.estabilidade.nota), score:c.score, classe:c.classe, nAl:(c.alertas||[]).length,
    just: `${incLeit(c.ind.trib - sep.ind.trib)} de ${fmtR(Math.abs(c.ind.trib - sep.ind.trib))}/ano em ${c.ind.regNome}; ${incLeit(c.ind.refAcum - sep.ind.refAcum)} acumulad${c.ind.refAcum - sep.ind.refAcum > 0.5 ? 'o' : 'a'} de ${fmtR(Math.abs(c.ind.refAcum - sep.ind.refAcum))} na transição; estabilidade ${Math.round(c.score.dims.estabilidade.nota)}/100${(c.alertas||[]).length ? ' com ' + c.alertas.length + ' alerta(s)' : ''}${i > 0 ? ' — ' + (Math.abs(melhor.ind.trib - c.ind.trib) > 0.5 ? 'paga ' + fmtR(Math.abs(c.ind.trib - melhor.ind.trib)) + ' a mais por ano que o 1º' : 'empata na carga com o 1º; a ordem vem da Reforma e da estabilidade') : ''}.` }));
  const econ = melhor.ind.trib - sep.ind.trib, refD = melhor.ind.refAcum - sep.ind.refAcum;
  const situacao = R.motorDefasado ? 'motor defasado — recalcular' : R._snapshot ? 'reaberta de simulação gravada (sem recálculo)' : INC.salvo ? `gravada (nº ${INC.salvo.id})` : 'simulação calculada, ainda não gravada';
  const ident = { ano:R.ano, anoRef:R.anoRef, versao:INC_VERSAO, lacre:R.motorLacre, defasado:!!R.motorDefasado, calculadoEm:R.calculadoEm, id: INC.salvo ? String(INC.salvo.id) : ('sim-' + incHashCurto(JSON.stringify([E.map(e=>e.cnpj), R.ano, R.calculadoEm]))), gravada: !!INC.salvo,
    empresas: E.map((e,i) => ({ nome:e.nome, cnpj:e.cnpj, rot: i===0?'Incorporadora':'Incorporada', regime: e.regime || (incEhSimples(e.regime)?'Simples Nacional':'') || '—', uf: (e.dados&&e.dados.uf)||'', municipio: (e.dados&&e.dados.municipio)||'', janela: e.P ? `${e.P.nReais} meses lançados + ${e.P.nProj} projetados` : '12 meses lançados', iss: e.dados&&e.dados.cfg ? e.dados.cfg.iss : null })) };
  const painel = { melhor: melhor.nome, melhorCurto: melhor.curto, incorporadora: melhor.res ? melhor.res.empresas[0].nome : E[0].nome, incorporadas: melhor.res ? melhor.res.empresas.slice(1).map(e=>e.nome).join(', ') : E.slice(1).map(e=>e.nome).join(', '),
    score: melhor.score.total, classe: melhor.classe, econ, refD, regime: melhor.ind.regNome, regimeTodos: regimes.cons, situacao, nAlertas: R.alertas.length, nPend: pend.length, sep, melhorC: melhor };
  const conclusoes = {
    tributaria: TX.conclTrib, financeira: regimes.cons.temCustos ? TX.conclFin : INC_FIN_NAO_CONCLUIDA + ' ' + INC_NAO_AVALIADA, patrimonial: INC_NAO_AVALIADA + ' O sistema não recebe balanço (ativo, passivo, patrimônio líquido, dívidas).',
    societaria: (INC._ia && INC._ia.textos && INC._ia.textos.conclSoc) || (INC_NAO_AVALIADA + ' Sucessão de direitos e obrigações, contratos, licenças, funcionários, imóveis, veículos, marcas e sistemas devem ser levantados antes da incorporação.'),
    reforma: TX.conclReforma, global: TX.conclGlobal };
  const recomendacao = (INC._ia && INC._ia.textos && INC._ia.textos.recomendacaoCond) || incRecomendacaoCond(painel, pend);
  INC._modelo = { base:R, cen:CE, chaveIA, R, CE, E, ents, cons, sep, c2, melhor, TX, pend, tributos, regimes, reforma, ranking, ident, painel, conclusoes, recomendacao, alertas:R.alertas, temCustos: regimes.cons.temCustos };
  return INC._modelo;
}
function incHashCurto(s){ let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16).padStart(8,'0'); }
function incRecomendacaoCond(painel, pend){
  const cl = painel.classe, dims = [...new Set(pend.filter(p=>/patrimonial|financeira|societária/.test(p.dim)).map(p=>p.dim))];
  const depende = `depende da validação ${dims.length ? dims.join(', ') + ', ' : ''}jurídica e da conferência dos dados utilizados`;
  if (cl.k === 'INC') return `A análise está INCOMPLETA (${cl.motivos.join('; ')}): não há base para recomendar a incorporação ou a manutenção das empresas separadas até que a simulação seja refeita com dados e motor atualizados.`;
  if (cl.k === 'DES') return `Com base exclusivamente nos dados tributários disponíveis, a incorporação (${painel.melhor}) gera acréscimo tributário de ${fmtR(Math.abs(painel.econ))} ao ano; a conclusão é DESFAVORÁVEL no que o sistema mede e só se justifica por ganhos operacionais, societários ou patrimoniais que este estudo não avalia. A conclusão ${depende}.`;
  if (cl.k === 'NEU') return `Com base exclusivamente nos dados tributários disponíveis, a incorporação (${painel.melhor}) é tributariamente NEUTRA (${incLeit(painel.econ)} de ${fmtR(Math.abs(painel.econ))} ao ano); a decisão deve se apoiar nos aspectos operacionais, societários e patrimoniais, não avaliados aqui. A conclusão ${depende}.`;
  return `Com base exclusivamente nos dados tributários disponíveis, o cenário mais favorável é ${painel.melhor} (${painel.regime}), com economia de ${fmtR(Math.abs(painel.econ))} ao ano e ${incLeit(painel.refD)} acumulad${painel.refD > 0.5 ? 'o' : 'a'} de ${fmtR(Math.abs(painel.refD))} na transição da Reforma. A conclusão é ${cl.rot}${cl.k === 'RES' ? ` (${cl.motivos.join('; ')})` : ''} e ${depende}.`;
}

// ═══ BLOCOS DE SEÇÃO (compartilhados pelo parecer consolidado, pelos relatórios separados e pelas apresentações) ═══
const incSec = (n, t) => ({ html:`<h3 class="pp-sec">${n ? n + '. ' : ''}${t}</h3>`, custo:2 });
const incPar = t => ({ html:`<p class="pp-p">${t}</p>`, custo: Math.max(2, Math.ceil(String(t).replace(/<[^>]+>/g,'').length/420)) });
const incHint = t => ({ html:`<div class="hint" style="margin:-4px 0 8px">${t}</div>`, custo:1 });
const incTab = (thead, linhas, custoFixo=0, estilo) => ({ thead, linhas: linhas.filter(Boolean), custoFixo, estilo });
const incTr = (rot, cels, custo=1) => ({ html:`<tr><td class="rot">${rot}</td>${cels}</tr>`, custo });
const incTd = v => `<td class="num">${fmt(v)}</td>`;
const incFmtPct = v => v == null ? '—' : fmtP(v*100,2) + '%';
const incAvisoSemDados = t => ({ html:`<div class="pp-alerta"><b>Sem dados.</b> ${t}</div>`, custo:5 });

const INC_SECOES = {
  // 1 — capa (fora das páginas do timbrado)
  capa(M, titulo, sub){
    const inc = M.E[0], hoje = new Date().toLocaleDateString('pt-BR');
    return `<div class="pp-page pp-capa"><img class="pp-bg" src="capa.jpg" onerror="this.style.display='none';this.parentNode.classList.add('pp-semarte')">
      <div class="pp-capa-cliente"><div class="pp-capa-lbl">${esc(titulo||'Parecer Consolidado de Incorporação')}</div>
        <div class="pp-capa-nome">${esc(inc.nome)}</div>
        <div class="pp-capa-cnpj">CNPJ ${fmtCNPJ(inc.cnpj)} · incorporação de ${M.E.slice(1).map(e=>esc(e.nome)+' (CNPJ '+fmtCNPJ(e.cnpj)+')').join(', ')}</div>
        <div class="pp-capa-data">${sub ? esc(sub)+' · ' : ''}Ano-base ${M.ident.ano} · referência ${M.ident.anoRef} · ${hoje} · análise ${esc(M.ident.id)}</div></div></div>`;
  },
  identificacao(M){
    return [incSec(1,'Identificação das empresas e da simulação'), incTab(`<tr><th>Empresa</th><th>Papel</th><th>CNPJ</th><th>Regime na análise gravada</th><th>Janela do ano-base</th><th class="num">Receita bruta</th><th class="num">Folha</th></tr>`,
      M.ents.map((e,i) => incTr(esc(e.nome), `<td>${e.rot}</td><td>${fmtCNPJ(e.cnpj)}</td><td>${esc(M.ident.empresas[i].regime)}</td><td>${esc(M.ident.empresas[i].janela)}</td>${incTd(e.T.receita)}${incTd(e.T.folha)}`))),
      { html:`<div class="hint">Simulação ${esc(M.ident.id)}${M.ident.gravada ? ' (gravada)' : ' (identificador provisório — grave a simulação para fixá-lo)'} · calculada em ${new Date(M.ident.calculadoEm).toLocaleString('pt-BR')} · Simulação de Incorporação v${M.ident.versao} · motor do Análise Tributária Pro lacre ${esc(M.ident.lacre)}${M.ident.defasado ? ' <b style="color:var(--err)">(DEFASADO em relação ao index — recalcule)</b>' : ' (igual ao do index em produção)'} · situação: ${esc(M.painel.situacao)}.</div>`, custo:3 }];
  },
  objetivo(M){
    return [incSec(2,'Objetivo e escopo da análise'), incPar(M.TX.objetivo || `Este parecer mede o efeito tributário da incorporação de ${esc(M.E.slice(1).map(e=>e.nome).join(', '))} por ${esc(M.E[0].nome)}, no ano-base ${M.ident.ano}, comparando cada empresa separada, a soma das separadas e uma única empresa consolidada que reúna receitas, folha, compras e despesas de todas, nos três regimes (Simples Nacional, Lucro Presumido e Lucro Real) e na transição da Reforma Tributária (2027–2033). Também simula, quando há duas empresas, o sentido inverso da incorporação. <b>Escopo:</b> tributos federais, ICMS e ISS apurados pelo motor do Análise Tributária Pro; IBS/CBS com as alíquotas projetadas de cada ano. <b>Fora do escopo</b> (sem dados no sistema): balanço patrimonial, endividamento, caixa, contratos, funcionários, imóveis e demais aspectos societários e operacionais — as conclusões dessas dimensões aparecem como "${INC_NAO_AVALIADA}"`)];
  },
  resumo(M){ return [incSec(3,'Resumo executivo'), incHint(INC._ia ? 'Textos analíticos gerados com apoio de IA sobre os números calculados pelo sistema.' : 'Textos padrão do sistema — a redação analítica pode ser gerada com IA.'), incPar(M.TX.intro), incPar(M.TX.executivo)]; },
  painel(M){
    const p = M.painel, cl = p.classe, cor = cl.cor;
    const card = (v, rot, c) => `<td style="width:25%;vertical-align:top;padding:6px"><div style="border:1px solid #d5dbe1;border-radius:8px;padding:8px 10px;background:#fafbfc;min-height:52px"><div style="font-family:var(--display);font-size:${String(v).replace(/<[^>]+>/g,'').length > 22 ? 12 : 17}px;font-weight:700;color:${c||'var(--primary)'};line-height:1.2">${v}</div><div class="hint">${rot}</div></div></td>`;
    const grade = `<table style="width:100%;border-collapse:collapse;margin:4px 0 8px"><tr>${card(esc(p.melhorCurto), 'melhor cenário (no que o sistema mede)')}${card(esc(p.incorporadora), 'empresa incorporadora')}${card(esc(p.incorporadas), 'empresa(s) incorporada(s)')}${card(Math.round(p.score)+' / 100', 'score geral', cor)}</tr>
      <tr>${card((p.econ <= -0.5 ? 'economia ' : p.econ >= 0.5 ? 'acréscimo ' : 'neutro ') + fmtR(Math.abs(p.econ)), 'tributos anuais — consolidada × separadas', incCorD(p.econ))}${card((p.refD <= -0.5 ? 'economia ' : p.refD >= 0.5 ? 'acréscimo ' : 'neutro ') + fmtR(Math.abs(p.refD)), 'acumulado 2027–2033 (Reforma)', incCorD(p.refD))}${card(esc(p.regime), 'melhor regime da consolidada (menor tributo)')}${card(esc(p.situacao), 'situação da simulação')}</tr>
      <tr>${card(String(p.nAlertas), 'alertas de fronteira', p.nAlertas ? 'var(--warn)' : 'var(--ok)')}${card(String(p.nPend), 'dados pendentes de validação', p.nPend ? 'var(--warn)' : 'var(--ok)')}${card(incBadgeClasse(cl), 'classificação')}${card(M.CE.S3 ? 'sim' : (M.E.length > 2 ? 'não (3+ empresas)' : 'não'), 'sentido inverso simulado?')}</tr></table>`;
    return [incSec(4,'Painel de decisão'), { html: grade, custo: 11 }, { html:`<div class="hint"><b>${esc(cl.rot)}</b>${cl.motivos.length ? ' — ' + esc(cl.motivos.join('; ')) : ''}. Classificações possíveis: FAVORÁVEL · FAVORÁVEL COM RESSALVAS · NEUTRO · DESFAVORÁVEL · ANÁLISE INCOMPLETA. Enquanto houver dimensão patrimonial, financeira ou societária pendente, a classificação máxima é "FAVORÁVEL COM RESSALVAS". ${INC_LEG_SINAL}</div>`, custo:3 }];
  },
  separadas(M){
    const th = `<tr><th>Indicador</th>${M.ents.map(e=>`<th class="num">${esc(e.nome)}</th>`).join('')}<th class="num">Soma (separadas)</th></tr>`;
    const l = (rot, f, fmtF=fmt, somaF) => incTr(rot, `${M.ents.map(e=>`<td class="num">${fmtF(f(e))}</td>`).join('')}<td class="num"><b>${somaF ? somaF() : fmtF(M.ents.reduce((s,e)=>s+(+f(e)||0),0))}</b></td>`);
    return [incSec(5,'Comparação das empresas separadas'), incHint('Cada empresa no ano-base, pelo regime mais barato permitido a ela; soma = situação de partida.'), incTab(th, [
      l('Receita bruta', e=>e.T.receita), l('Receita de exportação', e=>e.T.receitaExp), l('Receita de comércio', e=>e.T.recCom), l('Receita de serviços', e=>e.T.recServ), l('Folha (salários + pró-labore)', e=>e.T.folha),
      l('Regime mais barato permitido', e=>e.ind.regNome, v=>esc(v), ()=>esc(M.sep.ind.regNome)), l('Tributos anuais nesse regime', e=>e.ind.trib, fmt, ()=>fmt(M.sep.ind.trib)), l('Carga tributária efetiva', e=>e.ind.carga, incFmtPct, ()=>incFmtPct(M.sep.ind.carga)),
      l('Simples Nacional (DAS + trava + CPP fora)', e=>e.T.simples), l('Lucro Presumido', e=>e.T.lp), l('Lucro Real', e=>e.T.lr),
      l('RBT12 máximo do ano', e=>e.T.rbt12Max, fmt, ()=>'—'), l('Faixa do Simples (dezembro)', e=>e.T.faixaDez??'—', v=>v, ()=>'—'), l('Fator R médio', e=>e.T.fatorRMedio, incFmtPct, ()=>'—'), l('Elegível ao Simples?', e=>incSnEstadoRot(e.sn), v=>esc(v), ()=>'—') ]), incPar(M.TX.empresas)];
  },
  antesDepois(M){
    const R = M.R, C = M.cons.T, th = `<tr><th>Indicador</th>${M.ents.map(e=>`<th class="num">${esc(e.nome)}</th>`).join('')}<th class="num">Separadas</th><th class="num">Consolidada</th><th class="num">Δ R$</th><th class="num">Δ %</th><th>Leitura</th></tr>`;
    const l = (rot, f, s, c, trib=true) => c == null ? incTr(rot, `<td colspan="${M.ents.length+5}"><span class="hint">sem dados</span></td>`) : incTr(rot, `${M.ents.map(e=>incTd(f(e)||0)).join('')}${incTd(s)}<td class="num"><b>${fmt(c)}</b></td>${incDelta3(s, c, true, trib)}`);
    const resSep = M.ents.reduce((s,e)=>s+(e.ind.resLR||0),0);
    return [incSec(6,'Comparação — empresas separadas × empresa consolidada'), incHint(INC_LEG_SINAL), incTab(th, [
      l('Receita bruta', e=>e.T.receita, R.soma.receita, C.receita, false), l('Receita de exportação', e=>e.T.receitaExp, R.soma.receitaExp, C.receitaExp, false), l('Folha', e=>e.T.folha, R.soma.folha, C.folha, false),
      l('INSS patronal (LP/LR)', e=>e.T.inssPatr, R.soma.inssPatr, C.inssPatr), l('Simples Nacional', e=>e.T.simples, R.soma.simples, C.simples), l('Lucro Presumido', e=>e.T.lp, R.soma.lp, C.lp), l('Lucro Real', e=>e.T.lr, R.soma.lr, C.lr),
      incTr('Tributos — regime mais barato permitido', `${M.ents.map(e=>`<td class="num">${fmt(e.ind.trib)}<br><span class="hint">${e.ind.regNome}</span></td>`).join('')}<td class="num">${fmt(M.sep.ind.trib)}<br><span class="hint">${M.sep.ind.regNome}</span></td><td class="num"><b>${fmt(M.c2.ind.trib)}</b><br><span class="hint">${M.c2.ind.regNome}</span></td>${incDelta3(M.sep.ind.trib, M.c2.ind.trib)}`, 2),
      incTr('Carga tributária efetiva', `${M.ents.map(e=>`<td class="num">${incFmtPct(e.ind.carga)}</td>`).join('')}<td class="num">${incFmtPct(M.sep.ind.carga)}</td><td class="num"><b>${incFmtPct(M.c2.ind.carga)}</b></td>${incDelta3(M.sep.ind.carga*100, M.c2.ind.carga*100, false)}`),
      l('Lucro tributável (base do Lucro Real)', e=>e.ind.baseLR, M.ents.reduce((s,e)=>s+(e.ind.baseLR||0),0), M.c2.ind.baseLR, false),
      M.regimes.resCons != null && M.regimes.resSep != null ? l('Resultado após tributos — regime mais barato de cada uma', (e)=>M.regimes.resIsos[M.ents.indexOf(e)], M.regimes.resSep, M.regimes.resCons, false) : incTr('Resultado após tributos', `<td colspan="${M.ents.length+5}"><span class="hint">sem custos/despesas lançados — não calculado</span></td>`),
      M.c2.ind.resLR != null ? l('Resultado após tributos no Lucro Real', e=>e.ind.resLR, resSep, M.c2.ind.resLR, false) : null,
      l('Reforma — acumulado 2027–2033 (melhor caminho de cada ano)', e=>e.ind.refAcum, M.sep.ind.refAcum, M.c2.ind.refAcum),
      incTr('Patrimônio líquido · Endividamento · Caixa', `<td colspan="${M.ents.length+5}"><span class="hint">sem dados de balanço no sistema — não comparados</span></td>`) ]), incPar(M.TX.antesDepois)];
  },
  tributos(M, regs, completo){
    const B = [], regsL = regs || [M.c2.ind.reg];
    B.push(incSec(7,'Comparação tributária por tributo'), incHint(`Sequência: tributo → base de cálculo → alíquota → fórmula → ${M.ents.map(e=>esc(e.nome)).join(' → ')} → separadas → consolidada → Δ → leitura → motivo. ${INC_LEG_SINAL} Alíquota exibida = valor ÷ base (efetiva); a nominal está na fórmula.`));
    for (const reg of regsL){
      const T = M.tributos[reg];
      B.push({ html:`<div style="font-weight:700;color:var(--primary);margin:8px 0 4px">${INC_REGIME_NOME[reg]}${T.permitido ? '' : ' — <span style="color:var(--err)">Não permitido à consolidada (' + esc(M.regimes.cons.motivoSn) + ') — valores apenas para referência</span>'}${reg === M.c2.ind.reg ? ' · <span class="badge ok">regime mais barato da consolidada</span>' : ''}</div>`, custo:2 });
      const th = `<tr><th>Tributo</th><th class="num">Base (cons.)</th><th class="num">Alíq. efetiva</th>${M.ents.map(e=>`<th class="num">${esc(e.nome)}</th>`).join('')}<th class="num">Separadas</th><th class="num">Consolidada</th><th class="num">Δ R$</th><th class="num">Δ %</th><th>Leitura</th></tr>`;
      const nCol = M.ents.length + 8;
      const linhas = T.linhas.filter(l => Math.abs(l.soma) + Math.abs(l.cons) > 0.005).map(l => ({ html:`<tr${l.info?' style="color:#777;font-style:italic"':''}><td class="rot">${esc(l.tributo)}</td><td class="num">${l.base.cons != null ? fmt(l.base.cons) : '—'}</td><td class="num">${l.aliq.cons != null ? fmtP(l.aliq.cons*100,2)+'%' : (l.nominal ? esc(l.nominal) : '—')}</td>${l.isos.map(v=>incTd(v)).join('')}${incTd(l.soma)}<td class="num"><b>${fmt(l.cons)}</b></td>${incDelta3(l.soma, l.cons)}</tr><tr><td colspan="${nCol}" style="font-size:9.5px;color:#666;padding:0 6px 5px 14px;border-top:0">fórmula: ${esc(l.formula)}${l.motivo ? ' · <b>motivo da diferença:</b> ' + esc(l.motivo) : ''}</td></tr>`, custo: 2 }));
      linhas.push({ html:`<tr style="font-weight:700"><td class="rot">Total do regime</td><td></td><td class="num">${incFmtPct(M.cons.T.receita > 0.005 ? T.total.cons/M.cons.T.receita : null)}</td>${T.total.isos.map(v=>incTd(v)).join('')}${incTd(T.total.soma)}<td class="num">${fmt(T.total.cons)}</td>${incDelta3(T.total.soma, T.total.cons)}</tr>`, custo:1 });
      B.push(incTab(th, linhas, 0, 'font-size:10.5px'));
    }
    B.push(incHint('As linhas "(incluído acima)" e "(informativo)" não somam no total do regime; as demais somam exatamente o total (conferido pela suíte de testes).'), incPar(M.TX.carga));
    if (M.reforma.anos.length){ const y = M.reforma.anos.find(a=>a.ano===M.ident.anoRef) || M.reforma.anos[0];
      B.push({ html:`<div class="hint" style="margin-top:4px"><b>IBS/CBS (${y.ano}, ${y.camRot} da consolidada):</b> débito ${fmtR(y.deb)} (CBS ${fmtR(y.cbs)} · IBS ${fmtR(y.ibs)}, abertura proporcional às alíquotas do ano), crédito ${fmtR(y.cred)}, líquido ${fmtR(y.liq)} — detalhado na seção 9 e no Relatório 3.</div>`, custo:2 }); }
    return B;
  },
  regimes(M){
    const D = M.regimes.cons, th = `<tr><th>Regime</th><th>Permitido?</th>${M.ents.map(e=>`<th class="num">${esc(e.nome)}</th>`).join('')}<th class="num">Separadas</th><th class="num">Consolidada</th><th class="num">Carga</th><th class="num">Resultado após tributos</th><th class="num">Margem</th><th class="num">Δ R$</th><th>Leitura</th></tr>`;
    const linhas = D.linhas.map(l => ({ html:`<tr${l.k===D.menorTrib?' style="background:#eaf2f8"':''}><td class="rot">${l.nome}${l.k===D.menorTrib?' <span class="badge ok">menor tributo</span>':''}${l.k===D.maiorRes?' <span class="badge ok">maior resultado</span>':''}</td><td>${l.permitido ? 'sim' + (l.motivo ? '<div class="hint">' + l.motivo + '</div>' : '') : '<b style="color:var(--err)">Não permitido</b><div class="hint">' + esc(l.motivo) + '</div>'}</td>${M.ents.map(e=>incTd(e.T[l.k])).join('')}${incTd(M.R.soma[l.k])}<td class="num"><b>${fmt(l.trib)}</b></td><td class="num">${incFmtPct(l.carga)}</td><td class="num">${l.resultado != null ? fmt(l.resultado) : '<span class="hint">não medido</span>'}</td><td class="num">${l.margem != null ? incFmtPct(l.margem) : '—'}</td>${incDelta3(M.R.soma[l.k], l.trib)}</tr>`, custo:2 }));
    return [incSec(8,'Comparação dos regimes tributários — consolidada'), incHint(`Regimes permitidos: ${D.linhas.filter(l=>l.permitido).map(l=>l.nome).join(', ')}${D.linhas.some(l=>!l.permitido) ? ' · não permitidos: ' + D.linhas.filter(l=>!l.permitido).map(l=>l.nome).join(', ') : ''}. Melhor pelo menor tributo: <b>${D.menorTrib ? INC_REGIME_NOME[D.menorTrib] : '—'}</b> · melhor pelo maior resultado econômico: <b>${D.maiorRes ? INC_REGIME_NOME[D.maiorRes] : 'não medido (sem custos e despesas lançados)'}</b>. Resultado após tributos = receita + financeiras − custos − folha − despesas − tributos do regime (INSS patronal incluído; FGTS fora do total, como no motor). Cenário não permitido nunca é classificado como melhor. ${INC_LEG_SINAL}`),
      incTab(th, linhas, 0, 'font-size:11px'), incPar(M.TX.regimes), incPar(M.TX.leitura)];
  },
  reforma(M, completo){
    const RF = M.reforma; if (!RF.anos.length) return [incSec(9,'Impacto da Reforma Tributária'), incPar('Sem cenários da Reforma na análise.')];
    const mostraIsos = M.ents.length <= 2;   // com 3+ empresas as colunas por empresa ficam só no Excel (largura da página)
    const th = `<tr><th>Ano</th>${mostraIsos ? M.ents.map(e=>`<th class="num">${esc(e.nome)}</th>`).join('') : ''}<th class="num">Separadas</th><th class="num">Consolidada<br><span class="hint">caminho</span></th><th class="num">IBS</th><th class="num">CBS</th><th class="num">Débito IBS/CBS</th><th class="num">Crédito</th><th class="num">Líquido</th><th class="num">Δ R$</th><th class="num">Δ %</th><th>Leitura</th><th class="num">Acumulado</th></tr>`;
    const linhas = RF.anos.map(a => ({ html:`<tr${a.ano===M.ident.anoRef?' style="background:#eaf2f8"':''}><td class="rot">${a.ano}${a.ano===M.ident.anoRef?' ◀':''}${a.snBloqueado?' <span title="'+esc(a.snMotivo||'')+'">🚫</span>':''}</td>${mostraIsos ? a.isos.map(x=>incTd(x.v)).join('') : ''}${incTd(a.sep)}<td class="num"><b>${fmt(a.cons)}</b><br><span class="hint">${a.camRot}</span></td>${incTd(a.ibs)}${incTd(a.cbs)}${incTd(a.deb)}${incTd(a.cred)}${incTd(a.liq)}${incDelta3(a.sep, a.cons)}<td class="num" style="color:${incCorD(a.acum)}">${fmt(a.acum)}</td></tr>`, custo:2 }));
    const B = [incSec(9,'Impacto da Reforma Tributária — transição 2027–2033, ano a ano'), incHint(`${INC_LEG_SINAL} IBS/CBS, débito e crédito referem-se à apuração por fora (híbrido ou regime regular) da consolidada; no caminho "Simples por dentro" o IBS/CBS está na guia.${mostraIsos ? '' : ' Os valores por empresa (' + M.ents.length + ' empresas) estão na planilha Excel.'} <b>${esc(RF.nota)}</b>`),
      incTab(th, linhas, 0, 'font-size:9px'),
      { html:`<div class="hint" style="margin-top:6px"><b>Acumulado 2027–2033:</b> <span style="color:${incCorD(RF.acumTotal)}">${incLeit(RF.acumTotal)} de ${fmtR(Math.abs(RF.acumTotal))}</span> · <b>ano em que a vantagem começa:</b> ${RF.inicioVantagem ? RF.inicioVantagem.ano : 'nenhum — a consolidada não fica mais barata em ano algum da transição'} · <b>ano em que o sinal inverte:</b> ${RF.inversao ? RF.inversao.ano + ' (' + incLeit(RF.inversao.delta) + ' de ' + fmtR(Math.abs(RF.inversao.delta)) + ')' : 'não inverte — o sinal se mantém em toda a transição'}.</div>`, custo:3 },
      incPar(M.TX.reforma), incPar(M.TX.reformaDecisao)];
    if (completo){
      B.push({ html:`<div style="height:230px;margin:6px 0"><canvas id="inc-pp-ref-${M.ident.id}"></canvas></div>`, custo:9, apos: () => rlChart('inc-pp-ref-'+M.ident.id, { type:'line', data:{ labels:RF.anos.map(a=>a.ano), datasets:[{ label:'Separadas', data:RF.anos.map(a=>a.sep), borderColor:'#1e8449', tension:.25 }, { label:'Consolidada', data:RF.anos.map(a=>a.cons), borderColor:'#2e86ab', tension:.25 }] }, options:{ responsive:true, maintainAspectRatio:false, animation:false, plugins:{ legend:{ position:'bottom' }, title:{ display:true, text:'Carga anual — separadas × consolidada (melhor caminho de cada ano)' } } } }) });
      const sens = RF.anos.filter(a=>a.sens);
      if (sens.length) B.push({ html:`<div style="font-weight:700;color:var(--primary);margin:8px 0 4px">Sensibilidade do crédito de IBS/CBS (consolidada)</div>`, custo:2 }, incTab(`<tr><th>Ano</th><th class="num">Crédito — limite inferior</th><th class="num">Crédito — base</th><th class="num">Crédito — limite superior</th><th class="num">Híbrido (inf · base · sup)</th><th class="num">Regular LP (inf · base · sup)</th></tr>`,
        sens.map(a => incTr(String(a.ano), `${incTd(a.sens.inf.cred)}${incTd(a.sens.base.cred)}${incTd(a.sens.sup.cred)}<td class="num">${fmt(a.sens.inf.hib)} · ${fmt(a.sens.base.hib)} · ${fmt(a.sens.sup.hib)}</td><td class="num">${fmt(a.sens.inf.regLP)} · ${fmt(a.sens.base.regLP)} · ${fmt(a.sens.sup.regLP)}</td>`)), 0, 'font-size:10.5px'),
        incHint('Limites inferior/superior = composição de fornecedores classificada automaticamente pelo motor (v7.91.0); a base é a premissa usada em todo o parecer.'));
      const cenF = RF.anos.filter(a=>a.delta<-0.5).map(a=>a.ano), cenD = RF.anos.filter(a=>a.delta>0.5).map(a=>a.ano);
      B.push(incPar(`<b>Anos favoráveis à consolidada:</b> ${cenF.length ? cenF.join(', ') : 'nenhum'}. <b>Anos desfavoráveis:</b> ${cenD.length ? cenD.join(', ') : 'nenhum'}. ${RF.inversao ? 'Ponto de inversão da vantagem: ' + RF.inversao.ano + '.' : 'Sem ponto de inversão.'}`));
    }
    return B;
  },
  ranking(M){
    const th = `<tr><th>#</th><th>Cenário</th><th>Incorporadora</th><th>Incorporada(s)</th><th>Regime</th><th class="num">Tributos/ano</th><th class="num">Resultado após tributos</th><th class="num">Reforma acum.</th><th class="num">Estab.</th><th class="num">Score</th><th>Classificação</th></tr>`;
    const linhas = M.ranking.map(r => ({ html:`<tr${r.pos===1?' style="background:#eaf2f8"':''}><td class="rot">${r.pos}</td><td>${esc(r.nome)}</td><td>${esc(r.incorporadora)}</td><td>${esc(r.incorporadas)}</td><td>${esc(r.regime)}</td><td class="num">${fmt(r.trib)}<br><span class="hint" style="color:${incCorD(r.tribDelta)}">${incLeit(r.tribDelta)} ${fmt(Math.abs(r.tribDelta))}</span></td><td class="num">${r.resultado && r.resultado.resultado != null ? fmt(r.resultado.resultado) : '<span class="hint">não medido</span>'}</td><td class="num">${fmt(r.refAcum)}<br><span class="hint" style="color:${incCorD(r.refDelta)}">${incLeit(r.refDelta)} ${fmt(Math.abs(r.refDelta))}</span></td><td class="num">${r.estab}</td><td class="num"><b>${Math.round(r.score.total)}</b></td><td>${incBadgeClasse(r.classe)}</td></tr><tr><td colspan="11" style="font-size:9.5px;color:#666;padding:0 6px 5px 14px;border-top:0">justificativa: ${esc(r.just)}</td></tr>`, custo:3 }));
    linhas.push({ html:`<tr><td class="rot">ref.</td><td>${esc(M.sep.nome)}</td><td>—</td><td>—</td><td>${esc(M.sep.ind.regNome)}</td><td class="num">${fmt(M.sep.ind.trib)}</td><td class="num">${M.regimes.resSep != null ? fmt(M.regimes.resSep) : '<span class="hint">não medido</span>'}</td><td class="num">${fmt(M.sep.ind.refAcum)}</td><td class="num">—</td><td class="num">—</td><td>referência</td></tr><tr><td colspan="11" style="font-size:9.5px;color:#666;padding:0 6px 5px 14px;border-top:0">Situação de partida: os demais cenários são medidos contra ela — não recebe score.</td></tr>`, custo:2 });
    const sc = M.melhor.score;
    return [incSec(10,'Ranking dos cenários'), incHint('Todos os cenários simulados, do melhor para o pior; cenários com regime não permitido são avaliados só nos regimes permitidos. Estab. = nota de estabilidade (0–100).'), incTab(th, linhas, 0, 'font-size:10.5px'), incPar(M.TX.ranking), ...(M.CE.erro3 ? [incPar(`O cenário de sentido inverso não pôde ser simulado: ${esc(M.CE.erro3)}.`)] : []),
      { html:`<div style="font-weight:700;color:var(--primary);margin:8px 0 4px">Como o score do 1º colocado foi calculado</div>` + incScoreHtml(sc, false) + `<div class="hint" style="margin-top:4px"><b>Fórmula:</b> score = Σ (nota da dimensão × peso) = ${Object.entries(sc.dims).map(([k,d])=>`${k} ${Math.round(d.nota)} × ${Math.round(d.peso*100)}%`).join(' + ')} = <b>${Math.round(sc.total)}</b>. <b>Limitações:</b> ${esc(sc.motivos.join(' '))}</div>`, custo: 12 }];
  },
  operacoes(M){
    const R = M.R;
    if (R.abatidos.length) return [incSec(11,'Operações realizadas entre as empresas'), incTab(`<tr><th>Vendeu → comprou</th><th>Natureza</th><th class="num">Valor informado</th><th class="num">Abatido da receita</th><th class="num">Abatido de compras/despesas</th><th>Fonte</th></tr>`, R.abatidos.map(a=>({ html:`<tr><td class="rot">${esc(a.deNome)} → ${esc(a.paraNome)}</td><td>${esc(a.natureza)}</td>${incTd(a.valor)}${incTd(a.abatidoRec)}${incTd(a.abatidoDest)}<td>${esc(a.fonte||'')}</td></tr>`, custo:1 }))), incPar('Depois da incorporação estas operações deixam de existir; foram abatidas da receita do vendedor e das compras/despesas do comprador nos meses do rateio declarado — sem o abatimento, receita, RBT12 e crédito da consolidada ficariam inflados.')];
    return [incSec(11,'Operações realizadas entre as empresas'), incPar('Nenhuma operação entre as empresas foi abatida. Se houver vendas ou serviços entre elas, o resultado consolidado está superestimado na receita, no RBT12 e no crédito — confira nos analíticos de venda/compra gravados no Análise Tributária Pro e use "Detectar operações entre as empresas".')];
  },
  alertas(M){
    const A = M.alertas, P = M.pend.filter(p=>p.dim==='dados');
    const B = [incSec(12,'Alertas e inconsistências')];
    if (A.length) B.push({ html:`<div class="pp-alerta"><b>${A.length} alerta(s) de fronteira</b><ul style="margin:6px 0 0 18px">${A.map(a=>`<li><span class="badge ${a.n==='err'?'err':a.n==='warn'?'warn':''}">${a.n==='err'?'crítico':a.n==='warn'?'atenção':'informação'}</span> ${esc(a.t)}</li>`).join('')}</ul></div>`, custo: 2 + A.length*2 });
    else B.push(incPar('Nenhum alerta de fronteira (limite, sublimite, faixa, Fator R, adicional de IRPJ, prejuízo fiscal).'));
    if (P.length) B.push({ html:`<div class="pp-alerta" style="margin-top:6px"><b>Inconsistências e dados a validar (${P.length})</b><ul style="margin:6px 0 0 18px">${P.map(p=>`<li><b>${esc(p.item)}:</b> ${esc(p.texto)}</li>`).join('')}</ul></div>`, custo: 2 + P.length*2 });
    return B;
  },
  conclusoes(M){
    const C = M.conclusoes;
    return [incSec(13,'Conclusão tributária'), incPar(C.tributaria), incSec(14,'Conclusão financeira'), incPar(C.financeira), incSec(15,'Conclusão patrimonial'), incPar(C.patrimonial), incSec(16,'Conclusão societária'), incPar(C.societaria),
      { html:`<div style="font-weight:700;color:var(--primary);margin:8px 0 4px">Reforma Tributária</div>`, custo:2 }, incPar(C.reforma), { html:`<div style="font-weight:700;color:var(--primary);margin:8px 0 4px">Conclusão global</div>`, custo:2 }, incPar(`<b>${C.global}</b>`)];
  },
  recomendacao(M){ return [incSec(17,'Recomendação final'), incPar(M.TX.parecer1), incPar(M.TX.parecer2), { html:`<div class="pp-final"><b>Recomendação (${esc(M.painel.classe.rot)}):</b> ${M.recomendacao}</div>`, custo:6 }]; },
  premissas(M){ return [incSec(18,'Premissas'), { html:`<ul class="pp-p" style="margin-left:18px">${M.R.premissas.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`, custo: 2 + M.R.premissas.length }, incPar(M.TX.premissas)]; },
  limitacoes(M){
    const its = [...M.R.notas, ...M.melhor.score.motivos, M.reforma.nota, 'Cenários de sentido inverso só com exatamente duas empresas.', 'Ferramenta de apoio à decisão econômica, contábil, financeira e tributária, com base nos dados e premissas informados; a efetivação de reorganizações societárias deve ser precedida das validações jurídicas, societárias, contábeis, fiscais e de due diligence aplicáveis. Não substitui a apuração oficial.'];
    return [incSec(19,'Limitações'), { html:`<ul class="pp-p" style="margin-left:18px">${its.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`, custo: 2 + its.length*2 }, { html:`<div style="font-weight:700;color:var(--primary);margin:8px 0 4px">Dados pendentes de validação (${M.pend.length})</div>`, custo:2 },
      incTab(`<tr><th>Dimensão</th><th>Item</th><th>O que falta</th></tr>`, M.pend.map(p=>incTr(esc(p.dim), `<td>${esc(p.item)}</td><td>${esc(p.texto)}</td>`, 2)), 0, 'font-size:11px')];
  },
  memoria(M){
    const sc = M.melhor.score;
    return [incSec(20,'Memória resumida de cálculo'), incTab(`<tr><th>Item</th><th>Registro</th></tr>`, [
      incTr('Identificador da análise', `<td>${esc(M.ident.id)}${M.ident.gravada ? '' : ' (provisório)'}</td>`), incTr('Data e hora da simulação', `<td>${new Date(M.ident.calculadoEm).toLocaleString('pt-BR')}</td>`), incTr('Versão', `<td>Simulação de Incorporação v${M.ident.versao} · motor do Análise Tributária Pro lacre ${esc(M.ident.lacre)} (${M.ident.defasado ? 'DEFASADO' : 'igual ao index em produção'})</td>`),
      incTr('Dados de entrada e origem', `<td>${M.ents.map(e=>`${esc(e.nome)}: análise gravada no Análise Tributária Pro (CNPJ ${fmtCNPJ(e.cnpj)}), ${esc(M.ident.empresas[M.ents.indexOf(e)].janela)}`).join('; ')}. Consolidada: soma mês a mês das entradas das empresas (menos as operações intragrupo abatidas), configuração da incorporadora.</td>`, 3),
      incTr('Regras da consolidação', `<td>RBT12 consolidado = soma dos RBT12; ISS e ICMS pela média ponderada das bases (ISS segue o município, ICMS a UF da incorporadora); RAT, terceiros, presunções, período do Lucro Real e opções = incorporadora; anexo, faixa, Fator R, trava da 5ª faixa, sublimite e adicional de IRPJ decididos pelo motor; prejuízo fiscal das incorporadas não aproveitado (DL 2.341/87, art. 33).</td>`, 3),
      incTr('Fórmulas', `<td>Por tributo: seção 7 (e Relatório 2). Score = Σ nota × peso: ${Object.entries(sc.dims).map(([k,d])=>`${k} ${Math.round(d.nota)} × ${Math.round(d.peso*100)}%`).join(' + ')} = ${Math.round(sc.total)}. Notas: ${Object.values(sc.dims).map(d=>esc(d.formula)).join(' · ')}.</td>`, 4),
      incTr('Resultados intermediários', `<td>Mês a mês (RBT12, faixa, Fator R, DAS, trava, LP, LR, IBS/CBS por ano) no relatório "Conferência de cálculos" (Consolidada · Incorporadora · Incorporada) e no Relatório 7 — Memória de Cálculo.</td>`, 2),
      incTr('Arredondamento', `<td>O motor calcula com precisão plena; os valores são arredondados a 2 casas só na exibição (somaExib) — a soma de parcelas exibidas pode diferir do total em centavos.</td>`, 2),
      incTr('Convenção de sinal', `<td>${INC_LEG_SINAL}</td>`) ], 0, 'font-size:11px'),
      { html:`<div class="hint" style="margin-top:8px">Simulação de Incorporação v${M.ident.versao} · lacre ${esc(M.ident.lacre)} · ${new Date(M.ident.calculadoEm).toLocaleString('pt-BR')} · análise ${esc(M.ident.id)}.</div>${incAssinatura()}`, custo:8 }];
  },
};
function incAssinatura(){ const e = (typeof PARAMS !== 'undefined' && PARAMS.escritorio) || {}; return `<div style="margin-top:28px;border-top:1px solid #999;width:280px;padding-top:6px;font-size:12px">${esc(e.respNome||'Responsável técnico')}<br>${esc(e.respQualif||'Contador')}${e.respCRC?' · CRC '+esc(e.respCRC):''}<br>Artecon Artes Contábeis</div>`; }

// ═══ DOCUMENTOS ═══
// monta um documento paginado (capa opcional + páginas timbradas); devolve { html, apos[] }
function incDocumento(M, opts){
  const B = opts.blocos.filter(Boolean), apos = B.filter(b=>b.apos).map(b=>b.apos);
  let h = opts.capa ? INC_SECOES.capa(M, opts.titulo, opts.sub) : '';
  if (!opts.capa) B.unshift({ html:`<h3 class="pp-sec" style="margin-top:0">${esc(opts.titulo)}</h3><div class="hint" style="margin-bottom:10px"><b>${esc(M.E[0].nome)}</b> · incorporação de ${esc(M.E.slice(1).map(e=>e.nome).join(', '))} · ano-base ${M.ident.ano} · análise ${esc(M.ident.id)} · ${new Date().toLocaleDateString('pt-BR')} · Artecon Artes Contábeis</div>`, custo:5 });
  h += ppDocumento(B);
  return { html: h, apos };
}
const INC_DOCS = {
  parecer_inc:   { titulo:'Parecer Consolidado de Incorporação', capa:true, ia:true, blocos: M => [...INC_SECOES.identificacao(M), ...INC_SECOES.objetivo(M), ...INC_SECOES.resumo(M), ...INC_SECOES.painel(M), ...INC_SECOES.separadas(M), ...INC_SECOES.antesDepois(M), ...INC_SECOES.tributos(M), ...INC_SECOES.regimes(M), ...INC_SECOES.reforma(M), ...INC_SECOES.ranking(M), ...INC_SECOES.operacoes(M), ...INC_SECOES.alertas(M), ...INC_SECOES.conclusoes(M), ...INC_SECOES.recomendacao(M), ...INC_SECOES.premissas(M), ...INC_SECOES.limitacoes(M), ...INC_SECOES.memoria(M)] },
  rel_executivo: { titulo:'Relatório 1 — Parecer Executivo', sub:'para o empresário e os sócios', capa:true, blocos: M => [...INC_SECOES.resumo(M), ...INC_SECOES.painel(M), incSec(5,'Ranking dos cenários'), ...INC_SECOES.ranking(M).slice(1,4), incSec(6,'Vantagens e riscos'), { html:`<table class="pp-tabela"><thead><tr><th>Vantagens (no que o sistema mede)</th><th>Riscos e ressalvas</th></tr></thead><tbody><tr><td style="vertical-align:top">${incVantagens(M)}</td><td style="vertical-align:top">${incRiscos(M)}</td></tr></tbody></table>`, custo:10 }, incSec(7,'Conclusões'), incTab(`<tr><th>Dimensão</th><th>Conclusão</th></tr>`, [['Tributária',M.conclusoes.tributaria],['Financeira',M.conclusoes.financeira],['Patrimonial',M.conclusoes.patrimonial],['Societária',M.conclusoes.societaria],['Reforma Tributária',M.conclusoes.reforma],['<b>Global</b>','<b>'+M.conclusoes.global+'</b>']].map(([d,t])=>incTr(d, `<td>${t}</td>`, 3))), ...INC_SECOES.recomendacao(M).map((b,i)=> i===0 ? incSec(8,'Recomendação final') : b), { html: incAssinatura(), custo:6 }] },
  rel_tributario:{ titulo:'Relatório 2 — Comparativo Tributário Completo', sub:'para o contador e o setor fiscal', capa:false, blocos: M => [...INC_SECOES.separadas(M), ...INC_SECOES.antesDepois(M), ...INC_SECOES.tributos(M, ['simples','lp','lr'], true), ...INC_SECOES.regimes(M), incSec(9,'Memória mensal da consolidada'), { html: incMemoriaHtml(M.R).replace(/<h3[^>]*>Memória de cálculo<\/h3>/,''), custo:24 }, ...INC_SECOES.memoria(M)] },
  rel_reforma:   { titulo:'Relatório 3 — Reforma Tributária', sub:'transição 2027–2033', capa:false, blocos: M => [...INC_SECOES.reforma(M, true), incSec(10,'Abertura de IBS/CBS por tributo e por ente — consolidada'), { html: incRfTribConsolidada(M), custo:22 }, ...INC_SECOES.limitacoes(M).slice(0,2)] },
  rel_financeira:{ titulo:'Relatório 4 — Análise Financeira', capa:false, blocos: M => incRelFinanceiraBlocos(M) },
  rel_patrimonial:{ titulo:'Relatório 5 — Análise Patrimonial e de Endividamento', capa:false, blocos: M => incRelPatrimonialBlocos(M) },
  rel_societaria:{ titulo:'Relatório 6 — Análise Societária e Operacional', capa:false, blocos: M => incRelSocietariaBlocos(M) },
  rel_memoria:   { titulo:'Relatório 7 — Memória de Cálculo', capa:false, blocos: M => [...INC_SECOES.memoria(M), ...INC_SECOES.premissas(M), ...INC_SECOES.operacoes(M), incSec(21,'Memória mensal da consolidada'), { html: incMemoriaHtml(M.R).replace(/<h3[^>]*>Memória de cálculo<\/h3>/,''), custo:24 }, incPar('A memória mês a mês de cada empresa isolada (RBT12, faixa, Fator R, DAS, LP, LR, demonstrativo da Reforma) está no relatório "Conferência de cálculos", com trilha de origem de cada dado de entrada.')] },
  rel_riscos:    { titulo:'Relatório 8 — Riscos, Pendências e Checklist', capa:false, blocos: M => incRelRiscosBlocos(M) },
};
function incVantagens(M){
  const p = M.painel, its = [];
  if (p.econ <= -0.5) its.push(`economia tributária de ${fmtR(Math.abs(p.econ))} ao ano (${INC_REGIME_NOME[M.melhor.ind.reg]})`);
  if (p.refD <= -0.5) its.push(`economia acumulada de ${fmtR(Math.abs(p.refD))} na transição da Reforma (2027–2033)`);
  if (M.R.abatidos.length) its.push('operações entre as empresas deixam de existir (receita e crédito ajustados)');
  if (M.melhor.score.dims.estabilidade.nota >= 75) its.push('resultado estável ao longo da transição');
  if (!its.length) its.push('nenhuma vantagem tributária medida — a decisão depende de ganhos operacionais e societários');
  return `<ul style="margin:0 0 0 16px">${its.map(i=>`<li>${i}</li>`).join('')}</ul>`;
}
function incRiscos(M){
  const p = M.painel, its = [];
  if (p.econ >= 0.5) its.push(`acréscimo tributário de ${fmtR(p.econ)} ao ano`);
  if (p.refD >= 0.5) its.push(`acréscimo acumulado de ${fmtR(p.refD)} na Reforma`);
  if (M.reforma.inversao) its.push(`a vantagem inverte em ${M.reforma.inversao.ano}`);
  M.alertas.slice(0,4).forEach(a => its.push(esc(a.t)));
  its.push('patrimônio, endividamento, financeiro e societário não avaliados — validar antes de decidir');
  return `<ul style="margin:0 0 0 16px">${its.map(i=>`<li>${i}</li>`).join('')}</ul>`;
}
function incRfTribConsolidada(M){
  try { if (typeof rlRfTribHtml !== 'function' || !M.R.consolidada.cen) return '<div class="hint">Abertura por tributo indisponível para simulação reaberta de snapshot (recalcule).</div>';
    const ents = incRlEntidades(); if (!ents) return ''; incRlSelecionar(ents.lista[0]); return rlRfTribHtml(M.R.consolidada.cen) || '';
  } catch(e){ console.error('incRfTribConsolidada', e); return '<div class="hint">Abertura por tributo indisponível: ' + esc(e.message) + '</div>'; }
}
function incRelFinanceiraBlocos(M){
  const D = M.regimes.cons, B = [];
  if (!D.temCustos){
    B.push({ html:`<div class="pp-alerta"><b>${INC_FIN_NAO_CONCLUIDA}</b> As análises gravadas não trazem custos e despesas; sem eles não é possível medir lucro, margem, resultado por regime, geração de caixa, ponto de equilíbrio e capacidade de pagamento.</div>`, custo:6 });
    B.push(incSec(1,'O que o sistema já tem'), incTab(`<tr><th>Indicador</th>${M.ents.map(e=>`<th class="num">${esc(e.nome)}</th>`).join('')}<th class="num">Separadas</th><th class="num">Consolidada</th></tr>`, [
      incTr('Receita bruta', `${M.ents.map(e=>incTd(e.T.receita)).join('')}${incTd(M.R.soma.receita)}${incTd(M.cons.T.receita)}`), incTr('Folha', `${M.ents.map(e=>incTd(e.T.folha)).join('')}${incTd(M.R.soma.folha)}${incTd(M.cons.T.folha)}`),
      incTr('Tributos (regime mais barato)', `${M.ents.map(e=>incTd(e.ind.trib)).join('')}${incTd(M.sep.ind.trib)}${incTd(M.c2.ind.trib)}`) ]));
    B.push(incSec(2,'O que falta'), incTab(`<tr><th>Item</th><th>O que informar</th></tr>`, M.pend.filter(p=>p.dim==='financeira').map(p=>incTr(esc(p.item), `<td>${esc(p.texto)}</td>`, 2))));
    return B;
  }
  const s = (R,f) => incSM(R, f), ents = [...M.ents, M.cons];
  const lin = (rot, f, fmtF=fmt) => incTr(rot, ents.map(e=>`<td class="num">${fmtF(f(e))}</td>`).join(''));
  const custos = e => s(e.R, m=>m.custos), desp = e => s(e.R, m=>m.despTotal), lat = e => incRegimesDetalhe(e).LAT;
  B.push(incSec(1,'Resultado antes e depois da incorporação'), incHint('Receita, custos, despesas e folha vêm das análises gravadas (consolidada = soma menos operações intragrupo); os tributos são os do regime mais barato permitido a cada entidade.'),
    incTab(`<tr><th>Indicador</th>${ents.map(e=>`<th class="num">${esc(e.rot||'')}${e.rot?'<br>':''}${esc(e.nome)}</th>`).join('')}</tr>`, [
      lin('Receita bruta', e=>e.T.receita), lin('Custos (baixa de estoque)', custos), lin('Despesas operacionais', desp), lin('Folha + INSS patronal', e=>e.T.folha + e.T.inssPatr), lin('Lucro antes dos tributos do regime (LAT)', lat),
      lin('Tributos — regime mais barato', e=>e.ind.trib), lin('Regime', e=>e.ind.regNome, esc), lin('Resultado após tributos', e=>{ const d = incRegimesDetalhe(e); const l = d.linhas.find(x=>x.k===e.ind.reg); return l ? l.resultado : null; }),
      lin('Margem líquida', e=>{ const d = incRegimesDetalhe(e); const l = d.linhas.find(x=>x.k===e.ind.reg); return l ? l.margem : null; }, incFmtPct) ], 0, 'font-size:11px'));
  B.push(incSec(2,'Resultado por regime — consolidada'), incTab(`<tr><th>Regime</th><th>Permitido?</th><th class="num">Tributos</th><th class="num">Carga</th><th class="num">Resultado após tributos</th><th class="num">Margem</th></tr>`,
    D.linhas.map(l => incTr(l.nome, `<td>${l.permitido?'sim':'<b style="color:var(--err)">Não permitido</b>'}</td>${incTd(l.trib)}<td class="num">${incFmtPct(l.carga)}</td>${incTd(l.resultado)}<td class="num">${incFmtPct(l.margem)}</td>`))));
  B.push(incSec(3,'Não concluído'), { html:`<div class="pp-alerta">Geração de caixa, ponto de equilíbrio e capacidade de pagamento: <b>${INC_FIN_NAO_CONCLUIDA}</b> (exigem custos fixos × variáveis, serviço da dívida e caixa, que o sistema não recebe).</div>`, custo:5 }, incPar(M.conclusoes.financeira));
  return B;
}
function incRelPatrimonialBlocos(M){
  const th = `<tr><th>Conta / indicador</th>${M.ents.map(e=>`<th class="num">${esc(e.nome)}</th>`).join('')}<th class="num">Separadas</th><th class="num">Consolidada (antes)</th><th class="num">Consolidada (depois)</th></tr>`;
  const its = ['Ativo total','Ativo circulante','Passivo total','Passivo circulante','Patrimônio líquido','Caixa e equivalentes','Empréstimos e financiamentos','Dívidas fiscais (parceladas e vencidas)','Dívidas trabalhistas','Contingências (provisões)','Liquidez corrente','Dívida líquida','Dívida líquida / EBITDA'];
  return [{ html:`<div class="pp-alerta"><b>${INC_NAO_AVALIADA}</b> O sistema não recebe balanço, dívidas nem contingências. A estrutura abaixo indica o que deve ser levantado e comparado antes da incorporação; a partir da v1.6.0 estes dados poderão ser informados na simulação.</div>`, custo:6 },
    incSec(1,'Estrutura patrimonial — a preencher'), incTab(th, its.map(i => incTr(i, `${M.ents.map(()=>'<td class="num">—</td>').join('')}<td class="num">—</td><td class="num">—</td><td class="num">—</td>`)), 0, 'font-size:11px'),
    incSec(2,'Pontos de atenção patrimoniais na incorporação'), { html:`<ul class="pp-p" style="margin-left:18px"><li>A incorporadora sucede a incorporada em todos os direitos e obrigações (CC, art. 1.116; Lei 6.404/76, art. 227) — inclusive dívidas fiscais (CTN, art. 132) e trabalhistas (CLT, arts. 10 e 448).</li><li>Laudo de avaliação do patrimônio líquido da incorporada (CC, art. 1.117; Lei 6.404/76, art. 227, § 1º) — valor contábil ou de mercado.</li><li>Prejuízo fiscal e base negativa de CSLL da incorporada não se transferem (DL 2.341/87, art. 33) — já refletido no motor.</li><li>Ágio/deságio, se houver aquisição prévia de participação (Lei 12.973/14, arts. 20 a 22).</li><li>Contingências não provisionadas passam integralmente à incorporadora.</li></ul>`, custo:12 }, incPar(M.conclusoes.patrimonial)];
}
function incRelSocietariaBlocos(M){
  const inc = M.E[0], incs = M.E.slice(1);
  const chk = its => `<table class="pp-tabela" style="font-size:11px"><thead><tr><th>Item</th><th>Situação</th><th>Providência</th></tr></thead><tbody>${its.map(([i,p])=>`<tr><td class="rot">${i}</td><td>☐ não informado</td><td>${p}</td></tr>`).join('')}</tbody></table>`;
  return [{ html:`<div class="pp-alerta"><b>${INC_NAO_AVALIADA}</b> Contratos, licenças, funcionários, clientes, fornecedores, imóveis, veículos, marcas e sistemas não são cadastrados no sistema. Abaixo, a estrutura e o checklist de providências.</div>`, custo:6 },
    incSec(1,'Empresas'), incTab(`<tr><th>Papel</th><th>Empresa</th><th>CNPJ</th><th>Efeito</th></tr>`, [incTr('Incorporadora', `<td>${esc(inc.nome)}</td><td>${fmtCNPJ(inc.cnpj)}</td><td>sobrevive — define ISS, ICMS, RAT, terceiros e configuração</td>`), ...incs.map(e => incTr('Incorporada', `<td>${esc(e.nome)}</td><td>${fmtCNPJ(e.cnpj)}</td><td>extingue-se; CNPJ baixado após a averbação (IN RFB 2.119/22)</td>`))]),
    incSec(2,'Sucessão de direitos e obrigações'), incPar('A incorporadora sucede a incorporada em todos os direitos e obrigações (CC, art. 1.116; Lei 6.404/76, art. 227): tributos devidos até a data do ato (CTN, art. 132), contratos de trabalho (CLT, arts. 10 e 448), contratos civis e comerciais (salvo cláusula de vencimento antecipado ou anuência), licenças e alvarás (verificar transferibilidade).'),
    incSec(3,'Checklist operacional'), { html: chk([['Contratos com clientes','levantar cláusulas de mudança de controle/cessão; comunicar e aditar'],['Contratos com fornecedores','idem; renegociar condições no CNPJ sobrevivente'],['Licenças, alvarás e inscrições','alvará, vigilância sanitária, ambiental, inscrição estadual/municipal — transferir ou reemitir'],['Funcionários','sucessão trabalhista; eSocial (transferência S-2299/S-2200), CCT aplicável da incorporadora'],['Clientes e fornecedores nos analíticos', M.R.abatidos.length ? `${M.R.abatidos.length} operação(ões) intragrupo abatida(s)` : 'sem operações intragrupo abatidas — conferir'],['Imóveis','averbação da incorporação na matrícula; ITBI (imunidade do art. 156, § 2º, I, CF, salvo atividade preponderante imobiliária)'],['Veículos','transferência no DETRAN'],['Marcas e patentes','anotação de transferência no INPI'],['Sistemas, contratos de software e domínios','transferir titularidade e licenças'],['Estabelecimento da incorporada','vira filial — inscrição estadual/municipal própria (ISS pelo município, ICMS pela UF)']]), custo:24 },
    incSec(4,'Documentos e providências societárias'), { html:`<ul class="pp-p" style="margin-left:18px"><li>Protocolo e justificação de incorporação (CC, art. 1.117; Lei 6.404/76, arts. 224 e 225).</li><li>Laudo de avaliação do patrimônio líquido da incorporada (CC, art. 1.117; Lei 6.404/76, art. 227).</li><li>Atas/alterações contratuais aprovando a incorporação, o laudo e o aumento de capital da incorporadora.</li><li>Balanço de incorporação na data-base (RIR/2018, art. 235; IN RFB 1.700/17) e ECF/ECD de encerramento da incorporada.</li><li>Registro na Junta Comercial; baixa do CNPJ; comunicação a Receita, Sefaz e Prefeitura; opção pelo regime no CNPJ sobrevivente.</li><li>Due diligence tributária, trabalhista, contratual e ambiental da incorporada.</li></ul>`, custo:14 }, incPar(M.conclusoes.societaria)];
}
function incRelRiscosBlocos(M){
  const A = M.alertas, P = M.pend, R = M.R, C = M.cons;
  const lim = [];
  lim.push(['Limite do Simples (R$ 4,8 mi)', C.sn.estado === 'elegivel' ? `dentro — RBT12 máx. ${fmtR(C.sn.rbtMax||0)}` : `<b style="color:var(--err)">${C.sn.estado === 'inelegivel' ? 'inelegível' : 'ultrapassa no ano'}</b> — RBT12 máx. ${fmtR(C.sn.rbtMax||0)} × teto ${fmtR(C.sn.teto||4800000)}`]);
  lim.push(['Sublimite (R$ 3,6 mi — ICMS/ISS)', C.T.trava > 0.5 ? `<b style="color:var(--warn)">acima</b> — ICMS/ISS por fora: ${fmtR(C.T.trava)} no ano` : 'dentro']);
  lim.push(['Fator R (28%)', `${M.ents.map(e=>esc(e.nome)+' '+fmtP((e.T.fatorRMedio||0)*100,1)+'%').join(' · ')} → consolidada ${fmtP((C.T.fatorRMedio||0)*100,1)}%`]);
  lim.push(['Faixa do Simples (dezembro)', `${M.ents.map(e=>esc(e.nome)+' '+(e.T.faixaDez??'—')).join(' · ')} → consolidada ${C.T.faixaDez??'—'}`]);
  lim.push(['Adicional de IRPJ', `Presumido ${fmtR(M.ents.reduce((s,e)=>s+e.T.adicionalLP,0))} → ${fmtR(C.T.adicionalLP)} · Real ${fmtR(M.ents.reduce((s,e)=>s+e.T.adicionalLR,0))} → ${fmtR(C.T.adicionalLR)}`]);
  lim.push(['Prejuízos fiscais das incorporadas', R.notas.find(n=>/prejuízo/i.test(n)) ? esc(R.notas.find(n=>/prejuízo/i.test(n))) : 'nenhum prejuízo fiscal informado nas incorporadas']);
  lim.push(['Operações entre as empresas', R.abatidos.length ? `${R.abatidos.length} abatida(s), ${fmtR(R.abatidos.reduce((s,a)=>s+a.valor,0))}` : 'nenhuma abatida — verificar']);
  return [incSec(1,'Alertas de limite, sublimite, Fator R e prejuízos'), incTab(`<tr><th>Ponto</th><th>Situação na consolidada</th></tr>`, lim.map(([a,b])=>incTr(a, `<td>${b}</td>`, 2))),
    ...INC_SECOES.alertas(M).map((b,i)=> i===0 ? incSec(2,'Alertas de fronteira e inconsistências') : b),
    incSec(3,'Dados faltantes e pendências'), incTab(`<tr><th>Dimensão</th><th>Item</th><th>O que falta</th></tr>`, P.map(p=>incTr(esc(p.dim), `<td>${esc(p.item)}</td><td>${esc(p.texto)}</td>`, 2)), 0, 'font-size:11px'),
    incSec(4,'Riscos tributários da operação'), { html:`<ul class="pp-p" style="margin-left:18px"><li>Perda do Simples Nacional pela consolidada (limite/sublimite) — efeitos a partir do mês seguinte ao excesso (LC 123/2006, art. 3º, § 9º).</li><li>Mudança de anexo pelo Fator R da folha conjunta (Anexo III × V).</li><li>Adicional de IRPJ pela soma dos lucros (Lei 9.249/95, art. 3º, § 1º).</li><li>Prejuízo fiscal e base negativa da incorporada não aproveitáveis (DL 2.341/87, art. 33).</li><li>Responsabilidade por tributos da incorporada (CTN, art. 132) e por multas (STJ, REsp 923.012).</li><li>Reforma Tributária: transição 2027–2033 com alíquotas projetadas — ${M.reforma.inversao ? 'a vantagem inverte em ' + M.reforma.inversao.ano : 'sinal estável na simulação'}; sensibilidade do crédito no Relatório 3.</li></ul>`, custo:14 },
    incSec(5,'Validações jurídicas e contábeis'), { html:`<table class="pp-tabela" style="font-size:11px"><thead><tr><th>Validação</th><th>Responsável</th><th>Situação</th></tr></thead><tbody>${[['Conferência dos dados de entrada de cada empresa (receitas, folha, compras, despesas, configuração)','contábil'],['Confirmação do regime e da elegibilidade ao Simples da consolidada no CNPJ sobrevivente','fiscal'],['Balanço de incorporação e laudo de avaliação','contábil / perito'],['Protocolo, justificação e atos societários','jurídico'],['Contratos, licenças e sucessão trabalhista','jurídico / RH'],['Due diligence tributária e contingências','jurídico / fiscal'],['Análise patrimonial e de endividamento','financeiro'],['Validação do estudo pelo responsável técnico','responsável técnico']].map(([v,r])=>`<tr><td class="rot">${v}</td><td>${r}</td><td>☐ pendente</td></tr>`).join('')}</tbody></table>`, custo:20 },
    incSec(6,'Documentos necessários e providências antes da incorporação'), { html:`<ul class="pp-p" style="margin-left:18px"><li>Balancetes e balanços das empresas na data-base.</li><li>Certidões negativas (federal, estadual, municipal, FGTS, trabalhista).</li><li>Relação de contratos, licenças, imóveis, veículos, marcas e sistemas.</li><li>Relação de funcionários e CCT aplicável.</li><li>Protocolo, justificação, laudo, atas e alterações contratuais.</li><li>Recálculo desta simulação após a validação dos dados${R.motorDefasado ? ' e com o motor atualizado' : ''}.</li></ul>`, custo:12 }];
}

// ═══ RENDER ═══
const INC_REL_TIPOS_NOVOS = ['rel_executivo','rel_tributario','rel_reforma','rel_financeira','rel_patrimonial','rel_societaria','rel_memoria','rel_riscos','rel_todos'];
function incFerramentas(M, tipo){
  const statusIA = INC._ia ? `🤖 Textos gerados pela IA em ${esc(INC._ia.quando)}.` : (INC._iaErro ? `⚠️ A geração com IA falhou (${esc(INC._iaErro)}) — textos padrão do sistema.` : 'Textos padrão do sistema — clique em "Gerar textos com IA".');
  return `<div class="card pp-tools"><div class="toolbar" style="align-items:center"><span class="hint">${statusIA}</span><span style="flex:1"></span>
    <button class="btn" onclick="incExcel('${tipo}')" title="Planilha com uma aba por seção/relatório — os mesmos números do documento">📗 Exportar Excel</button>
    <button class="btn" onclick="window.print()" title="Destino = Salvar como PDF · Margens = Nenhuma · Cabeçalhos e rodapés DESLIGADOS · Gráficos de segundo plano ligados">🖨️ Imprimir / PDF</button>
    <button class="btn solid" id="pp-ia-btn" onclick="incParecerIA()">🤖 Gerar textos com IA</button></div><div id="pp-regua"></div></div>`;
}
function incRelatorioRender(tipo){
  const M = incModelo(); if (!M){ $id('rl-corpo').innerHTML = '<div class="card placeholder"><h2>Sem simulação calculada</h2></div>'; return; }
  const tipos = tipo === 'rel_todos' ? Object.keys(INC_DOCS) : [tipo];
  let h = incFerramentas(M, tipo); const apos = [];
  for (const t of tipos){ const d = INC_DOCS[t]; if (!d) continue; const doc = incDocumento(M, { titulo:d.titulo, sub:d.sub, capa:d.capa, blocos:d.blocos(M) }); h += doc.html; apos.push(...doc.apos); }
  $id('rl-corpo').innerHTML = h;
  apos.forEach(f => { try { f(); } catch(e){ console.error('relatório/gráfico', e); } });
  setTimeout(() => { try { ppReguaRender(); } catch(e){ console.error('régua', e); } }, 350);
}
// o parecer da aba Simulação e o "Parecer Consolidado" da aba Relatórios são o MESMO render
function incParecerRender(){ incRelatorioRender('parecer_inc'); }

// ═══ EXCEL (SheetJS) — uma planilha por seção; números como número, formato #.##0,00 ═══
function incExcelAba(nome, aoa){ return { nome: String(nome).replace(/[\\/?*\[\]:]/g,' ').slice(0,31), aoa }; }
function incExcelAbas(M, tipo){
  const A = [], num = v => (v == null || isNaN(v)) ? '' : +v, ents = M.ents, nomes = ents.map(e=>e.nome);
  const cab = ['Simulação de Incorporação v' + M.ident.versao, 'análise ' + M.ident.id, 'motor lacre ' + M.ident.lacre, 'calculado em ' + new Date(M.ident.calculadoEm).toLocaleString('pt-BR')];
  const painel = () => incExcelAba('Painel', [cab, [], ['Melhor cenário', M.painel.melhor], ['Incorporadora', M.painel.incorporadora], ['Incorporada(s)', M.painel.incorporadas], ['Classificação', M.painel.classe.rot], ['Score', num(Math.round(M.painel.score))], ['Δ tributos/ano (consolidada − separadas)', num(M.painel.econ)], ['Δ acumulado Reforma 2027–2033', num(M.painel.refD)], ['Melhor regime', M.painel.regime], ['Situação', M.painel.situacao], ['Alertas', M.painel.nAlertas], ['Dados pendentes', M.painel.nPend], [], ['Convenção', 'Δ = consolidada − separadas · positivo = acréscimo · negativo = economia']]);
  const separadas = () => incExcelAba('Separadas', [['Indicador', ...nomes, 'Separadas', 'Consolidada', 'Δ R$', 'Δ %', 'Leitura'], ...[['Receita bruta','receita'],['Receita de exportação','receitaExp'],['Folha','folha'],['INSS patronal (LP/LR)','inssPatr'],['Simples Nacional','simples'],['Lucro Presumido','lp'],['Lucro Real','lr'],['Adicional IRPJ (LP)','adicionalLP'],['Adicional IRPJ (LR)','adicionalLR']].map(([r,k]) => { const s = +M.R.soma[k]||0, c = +M.cons.T[k]||0; return [r, ...ents.map(e=>num(e.T[k])), num(s), num(c), num(c-s), num(Math.abs(s)>0.005?(c-s)/Math.abs(s):0), incLeit(c-s, /Simples|Lucro|INSS|Adicional/.test(r))]; }),
    ['Tributos — regime mais barato', ...ents.map(e=>num(e.ind.trib)), num(M.sep.ind.trib), num(M.c2.ind.trib), num(M.c2.ind.trib-M.sep.ind.trib), num(M.sep.ind.trib>0.005?(M.c2.ind.trib-M.sep.ind.trib)/M.sep.ind.trib:0), incLeit(M.c2.ind.trib-M.sep.ind.trib)], ['Regime', ...ents.map(e=>e.ind.regNome), M.sep.ind.regNome, M.c2.ind.regNome], ['Carga efetiva', ...ents.map(e=>num(e.ind.carga)), num(M.sep.ind.carga), num(M.c2.ind.carga)]]);
  const tributos = reg => incExcelAba('Tributos ' + INC_REGIME_NOME[reg].replace('Nacional','').trim(), [['Tributo', 'Base (cons.)', 'Alíq. efetiva (cons.)', 'Alíq. nominal', 'Fórmula', ...nomes, 'Separadas', 'Consolidada', 'Δ R$', 'Δ %', 'Leitura', 'Motivo da diferença'], ...M.tributos[reg].linhas.map(l => [l.tributo, num(l.base.cons), num(l.aliq.cons), l.nominal, l.formula, ...l.isos.map(num), num(l.soma), num(l.cons), num(l.delta), num(l.pct), incLeit(l.delta), l.motivo]), ['Total', '', '', '', '', ...M.tributos[reg].total.isos.map(num), num(M.tributos[reg].total.soma), num(M.tributos[reg].total.cons), num(M.tributos[reg].total.cons-M.tributos[reg].total.soma)], [], ['Permitido à consolidada?', M.tributos[reg].permitido ? 'sim' : 'Não permitido — ' + M.regimes.cons.motivoSn]]);
  const regimes = () => incExcelAba('Regimes', [['Regime', 'Permitido?', 'Motivo', ...nomes, 'Separadas', 'Consolidada', 'Carga', 'Resultado após tributos', 'Margem', 'Δ R$', 'Leitura'], ...M.regimes.cons.linhas.map(l => [l.nome, l.permitido?'sim':'Não permitido', l.motivo.replace(/<[^>]+>/g,''), ...ents.map(e=>num(e.T[l.k])), num(M.R.soma[l.k]), num(l.trib), num(l.carga), num(l.resultado), num(l.margem), num(l.trib-M.R.soma[l.k]), incLeit(l.trib-M.R.soma[l.k])]), [], ['Menor tributo', M.regimes.cons.menorTrib ? INC_REGIME_NOME[M.regimes.cons.menorTrib] : ''], ['Maior resultado', M.regimes.cons.maiorRes ? INC_REGIME_NOME[M.regimes.cons.maiorRes] : 'não medido']]);
  const reforma = () => incExcelAba('Reforma', [['Ano', ...nomes, 'Separadas', 'Consolidada', 'Caminho', 'IBS', 'CBS', 'Débito IBS/CBS', 'Crédito', 'Líquido', 'Δ R$', 'Δ %', 'Leitura', 'Acumulado', 'Simples bloqueado?', 'Alíq. CBS %', 'Alíq. IBS %'], ...M.reforma.anos.map(a => [a.ano, ...a.isos.map(x=>num(x.v)), num(a.sep), num(a.cons), a.camRot, num(a.ibs), num(a.cbs), num(a.deb), num(a.cred), num(a.liq), num(a.delta), num(a.pct), incLeit(a.delta), num(a.acum), a.snBloqueado?'sim':'não', num(a.aliqCbs), num(a.aliqIbs)]), [], ['Ano em que a vantagem começa', M.reforma.inicioVantagem ? M.reforma.inicioVantagem.ano : 'nenhum'], ['Ano em que inverte', M.reforma.inversao ? M.reforma.inversao.ano : 'não inverte'], ['Nota', M.reforma.nota]]);
  const ranking = () => incExcelAba('Ranking', [['#', 'Cenário', 'Incorporadora', 'Incorporada(s)', 'Regime', 'Tributos/ano', 'Δ tributos', 'Resultado após tributos', 'Reforma acum.', 'Δ Reforma', 'Estabilidade', 'Score', 'Classificação', 'Justificativa'], ...M.ranking.map(r => [r.pos, r.nome, r.incorporadora, r.incorporadas, r.regime, num(r.trib), num(r.tribDelta), num(r.resultado&&r.resultado.resultado), num(r.refAcum), num(r.refDelta), r.estab, num(Math.round(r.score.total)), r.classe.rot, r.just]), ['ref.', M.sep.nome, '', '', M.sep.ind.regNome, num(M.sep.ind.trib), 0, '', num(M.sep.ind.refAcum), 0, '', '', 'referência'], [], ['Dimensão', 'Nota', 'Peso', 'Fórmula', 'Leitura'], ...Object.entries(M.melhor.score.dims).map(([k,d])=>[k, num(Math.round(d.nota)), num(d.peso), d.formula, d.texto])]);
  const alertas = () => incExcelAba('Alertas e pendências', [['Tipo', 'Nível/Dimensão', 'Item', 'Texto'], ...M.alertas.map(a=>['alerta', a.n, '', a.t]), ...M.pend.map(p=>['pendência', p.dim, p.item, p.texto])]);
  const conclusoes = () => incExcelAba('Conclusões', [['Dimensão', 'Conclusão'], ['Tributária', M.conclusoes.tributaria], ['Financeira', M.conclusoes.financeira], ['Patrimonial', M.conclusoes.patrimonial], ['Societária', M.conclusoes.societaria], ['Reforma Tributária', M.conclusoes.reforma], ['Global', M.conclusoes.global], ['Recomendação', M.recomendacao]].map(l=>l.map(v=>String(v).replace(/<[^>]+>/g,''))));
  const premissas = () => incExcelAba('Premissas e memória', [cab, [], ['Premissas'], ...M.R.premissas.map(p=>[p]), [], ['Notas'], ...M.R.notas.map(p=>[p]), [], ['Operações abatidas'], ['Vendeu', 'Comprou', 'Natureza', 'Valor', 'Abatido receita', 'Abatido compras'], ...M.R.abatidos.map(a=>[a.deNome, a.paraNome, a.natureza, num(a.valor), num(a.abatidoRec), num(a.abatidoDest)])]);
  const memoria = () => { const Mm = M.cons.R.meses; return incExcelAba('Memória mensal', [['Mês', 'RBT12', 'Faixa', 'Fator R', 'Receita', 'DAS', 'Trava ICMS/ISS', 'Simples total', 'Presumido', 'Real', 'Base LR (IRPJ/CSLL)', 'Folha', 'INSS patronal'], ...Mm.map((x,i)=>[MESES[i], num(x.rbt12), x.faixa??'', num(x.fatorR), num(x.receita), num(x.das), num((x.subIcms||0)+(x.subIss||0)), num(x.simples.total), num(x.lp.total), num(x.lr.total), num(x.lr.baseIRCS), num(x.folhaTotal), num(x.inssPatr)])]); };
  const map = { parecer_inc:[painel, separadas, ()=>tributos(M.c2.ind.reg), regimes, reforma, ranking, alertas, conclusoes, premissas], rel_executivo:[painel, ranking, conclusoes], rel_tributario:[separadas, ()=>tributos('simples'), ()=>tributos('lp'), ()=>tributos('lr'), regimes, memoria], rel_reforma:[reforma],
    rel_financeira:[regimes, separadas], rel_patrimonial:[alertas], rel_societaria:[alertas], rel_memoria:[premissas, memoria], rel_riscos:[alertas], rel_todos:[painel, separadas, ()=>tributos('simples'), ()=>tributos('lp'), ()=>tributos('lr'), regimes, reforma, ranking, alertas, conclusoes, premissas, memoria] };
  for (const f of (map[tipo] || map.parecer_inc)) A.push(f());
  return A;
}
function incExcel(tipo){
  const M = incModelo(); if (!M){ toast('Calcule uma simulação antes de exportar.'); return; }
  if (typeof XLSX === 'undefined'){ toast('Biblioteca de planilha (SheetJS) não carregada — verifique a conexão e recarregue.'); return; }
  const wb = XLSX.utils.book_new();
  for (const aba of incExcelAbas(M, tipo)){
    const ws = XLSX.utils.aoa_to_sheet(aba.aoa);
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let r = range.s.r; r <= range.e.r; r++) for (let c = range.s.c; c <= range.e.c; c++){ const cel = ws[XLSX.utils.encode_cell({ r, c })]; if (cel && cel.t === 'n') cel.z = '#,##0.00'; }
    ws['!cols'] = Array.from({ length: range.e.c + 1 }, (_, i) => ({ wch: i === 0 ? 34 : 16 }));
    XLSX.utils.book_append_sheet(wb, ws, aba.nome);
  }
  const nome = `incorporacao_${(INC_DOCS[tipo] ? INC_DOCS[tipo].titulo : 'relatorios').replace(/[^\w]+/g,'_').slice(0,40)}_${M.ident.id}.xlsx`;
  XLSX.writeFile(wb, nome);
  toast('Planilha gerada: ' + nome);
}
