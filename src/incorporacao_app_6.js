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
  // separadas medidas no MESMO regime do cenário "Manter as empresas separadas" (regime mais barato para a soma — critério do motor de decisão, v1.3.0), para que Δ resultado = −Δ tributos
  regimes.resIsos = ents.map((e,i) => resAt(regimes.isos[i], sep.ind.reg));
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
const incPar = t => ({ html:`<p class="pp-p">${t}</p>`, custo: Math.max(1, Math.ceil(String(t).replace(/<[^>]+>/g,'').length/480)) });
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
  resumo(M){ return [incSec(3,'Contexto e leitura analítica'), incHint(INC._ia ? 'Textos analíticos gerados com apoio de IA sobre os números calculados pelo sistema.' : 'Textos padrão do sistema — a redação analítica pode ser gerada com IA.'), incPar(M.TX.intro), incPar(M.TX.executivo)]; },
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
    const D = M.regimes.cons, th = `<tr><th>Regime</th><th>Permitido?</th>${M.ents.map(e=>`<th class="num">${esc(e.nome)}</th>`).join('')}<th class="num">Separadas</th><th class="num">Consolidada</th><th class="num">Carga</th><th class="num">Resultado após tributos</th><th class="num">Margem</th><th class="num">Δ R$</th><th class="num">Δ %</th><th>Leitura</th></tr>`;   // v1.7.0: faltava o "Δ %" (11 cabeçalhos para 12 células — colunas desalinhadas)
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
  // v1.7.0: (1) toda tabela passa pelo limite de colunas da orientação (incTabAjustar — "Leitura" vira nota,
  // colunas de detalhe saem no parecer, e o resto é dividido, nunca cortado); (2) o documento é envolto em
  // .inc-doc[data-orient] para o empacotador por medida (incEmpacotar) e a impressão por grupo.
  const orient = opts.paisagem ? 'paisagem' : 'retrato', ctx = { n:0 }, ajOpts = { descartar: opts.compacto ? INC_DESCARTAR_PARECER(M) : [] };
  const aj = lista => lista.filter(Boolean).flatMap(b => b && b.linhas ? incTabAjustar(b, orient, ctx, ajOpts) : [b]);
  const B = aj(opts.blocos||[]), pre = (opts.paginas || []).map(g => aj(g));        // v1.6.0: páginas forçadas (uma por assunto) antes dos blocos corridos
  const apos = [...pre.flat(), ...B].filter(b=>b&&b.apos).map(b=>b.apos);
  let h = opts.capa ? INC_SECOES.capa(M, opts.titulo, opts.sub) : '';
  if (!opts.capa && B.length) B.unshift({ html:`<h3 class="pp-sec" style="margin-top:0">${esc(opts.titulo)}</h3><div class="hint" style="margin-bottom:10px"><b>${esc(M.E[0].nome)}</b> · incorporação de ${esc(M.E.slice(1).map(e=>e.nome).join(', '))} · ano-base ${M.ident.ano} · análise ${esc(M.ident.id)} · ${new Date().toLocaleDateString('pt-BR')} · Artecon Artes Contábeis</div>`, custo:5 });
  // v1.7.0: a primeira folha de cada página forçada leva .pp-fixa — o empacotador por medida respeita a quebra (uma página por assunto)
  const fixa = html => html.replace(/<div class="pp-page( pp-land)?">/, '<div class="pp-page$1 pp-fixa">');
  if (pre.length) h += pre.map(g => fixa(opts.paisagem ? incPaginasPaisagem(g) : ppDocumento(g.filter(Boolean)))).join('');
  if (B.length) h += fixa(opts.paisagem ? incPaginasPaisagem(B) : ppDocumento(B));
  return { html: `<div class="inc-doc" data-orient="${orient}" data-tipo="${esc(opts.tipo||'')}">${h}</div>`, apos };
}
const INC_DOCS = {
  // camada GERENCIAL
  parecer_inc:   { titulo:'Parecer Consolidado de Incorporação', capa:true, ia:true, compacto:true, paginas: M => incResumoExecutivoPaginas(M), blocos: M => [...INC_SECOES.identificacao(M), ...INC_SECOES.objetivo(M), ...INC_SECOES.resumo(M), ...INC_SECOES.painel(M), ...INC_SECOES.separadas(M), ...INC_SECOES.antesDepois(M), ...INC_SECOES.tributos(M), ...INC_SECOES.regimes(M), ...INC_SECOES.reforma(M), ...INC_SECOES.ranking(M), ...INC_SECOES.operacoes(M), ...INC_SECOES.alertas(M), ...INC_SECOES.conclusoes(M), ...INC_SECOES.recomendacao(M), ...INC_SECOES.premissas(M), ...INC_SECOES.limitacoes(M), ...INC_SECOES.memoria(M)] },
  rel_executivo: { titulo:'Relatório 1 — Parecer Executivo', sub:'para o empresário e os sócios · decisão da incorporação', capa:true, paginas: M => incExecutivoPaginas(M, 'ex'), blocos: () => [] },
  // camada TÉCNICA (A4 paisagem para as tabelas largas)
  rel_tributario:{ titulo:'Relatório 2 — Comparativo Tributário Completo', sub:'para o contador e o setor fiscal', capa:false, paisagem:true, blocos: M => [...INC_SECOES.separadas(M), ...INC_SECOES.antesDepois(M), ...INC_SECOES.tributos(M, ['simples','lp','lr'], true), ...INC_SECOES.regimes(M), incSec(9,'Memória mensal da consolidada'), ...incMemoriaBlocos(M.R), ...INC_SECOES.memoria(M)] },
  rel_reforma:   { titulo:'Relatório 3 — Reforma Tributária', sub:'transição 2027–2033', capa:false, paisagem:true, blocos: M => [...INC_SECOES.reforma(M, true), incSec(10,'Abertura de IBS/CBS por tributo e por ente — consolidada'), ...incHtmlEmBlocos(incRfTribConsolidada(M)), ...INC_SECOES.limitacoes(M).slice(0,2)] },
  rel_financeira:{ titulo: M => M.temCustos ? 'Relatório 4 — Análise Financeira' : 'Relatório 4 — Informações financeiras pendentes', capa:false, blocos: M => incRelFinanceiraBlocos(M) },
  rel_patrimonial:{ titulo:'Relatório 5 — Informações patrimoniais pendentes', capa:false, blocos: M => incRelPatrimonialBlocos(M) },
  rel_societaria:{ titulo:'Relatório 6 — Informações societárias e operacionais pendentes', capa:false, blocos: M => incRelSocietariaBlocos(M) },
  rel_memoria:   { titulo:'Relatório 7 — Memória de Cálculo', sub:'todos os cálculos detalhados: base → alíquota → fórmula → resultado', capa:false, paisagem:true, blocos: M => [incPar('Este relatório demonstra, com os números aplicados, cada cálculo que sustenta o parecer: dados de entrada (7.1), consolidação (7.2), Simples Nacional (7.3), Lucro Presumido (7.4), Lucro Real (7.5), Reforma Tributária (7.6), Δ e score (7.7) e a conciliação com os totais do parecer (7.8). Premissas e operações entre as empresas estão nas seções 18 e 11 do Parecer Consolidado; a memória mês a mês de cada empresa isolada, com trilha de origem por dado, está também no relatório "Conferência de cálculos".'), ...incMemoriaCompleta(M).blocos, ...INC_SECOES.memoria(M)] },
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
    B.push(...incPendenteBloco('financeira', INC_DOCS_FIN));
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
  B.push(incSec(3,'Informações financeiras ainda pendentes'), ...incPendenteBloco('de caixa, ponto de equilíbrio e capacidade de pagamento', INC_DOCS_FIN.slice(1)), incPar(M.conclusoes.financeira));
  return B;
}
function incRelPatrimonialBlocos(M){
  const th = `<tr><th>Conta / indicador</th>${M.ents.map(e=>`<th class="num">${esc(e.nome)}</th>`).join('')}<th class="num">Separadas</th><th class="num">Consolidada (antes)</th><th class="num">Consolidada (depois)</th></tr>`;
  const its = ['Ativo total','Ativo circulante','Passivo total','Passivo circulante','Patrimônio líquido','Caixa e equivalentes','Empréstimos e financiamentos','Dívidas fiscais (parceladas e vencidas)','Dívidas trabalhistas','Contingências (provisões)','Liquidez corrente','Dívida líquida','Dívida líquida / EBITDA'];
  return [...incPendenteBloco('patrimonial e de endividamento', INC_DOCS_PATR),
    incSec(1,'Estrutura patrimonial — a preencher'), incTab(th, its.map(i => incTr(i, `${M.ents.map(()=>'<td class="num">—</td>').join('')}<td class="num">—</td><td class="num">—</td><td class="num">—</td>`)), 0, 'font-size:11px'),
    incSec(2,'Pontos de atenção patrimoniais na incorporação'), { html:`<ul class="pp-p" style="margin-left:18px"><li>A incorporadora sucede a incorporada em todos os direitos e obrigações (CC, art. 1.116; Lei 6.404/76, art. 227) — inclusive dívidas fiscais (CTN, art. 132) e trabalhistas (CLT, arts. 10 e 448).</li><li>Laudo de avaliação do patrimônio líquido da incorporada (CC, art. 1.117; Lei 6.404/76, art. 227, § 1º) — valor contábil ou de mercado.</li><li>Prejuízo fiscal e base negativa de CSLL da incorporada não se transferem (DL 2.341/87, art. 33) — já refletido no motor.</li><li>Ágio/deságio, se houver aquisição prévia de participação (Lei 12.973/14, arts. 20 a 22).</li><li>Contingências não provisionadas passam integralmente à incorporadora.</li></ul>`, custo:12 }, incPar(M.conclusoes.patrimonial)];
}
function incRelSocietariaBlocos(M){
  const inc = M.E[0], incs = M.E.slice(1);
  const chk = its => `<table class="pp-tabela" style="font-size:11px"><thead><tr><th>Item</th><th>Situação</th><th>Providência</th></tr></thead><tbody>${its.map(([i,p])=>`<tr><td class="rot">${i}</td><td>☐ não informado</td><td>${p}</td></tr>`).join('')}</tbody></table>`;
  return [...incPendenteBloco('societária e operacional', INC_DOCS_SOC),
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
  const SEM = incSemaforo(M);
  return [{ html:`<h3 class="pp-sec">Visão geral da operação (semáforo)</h3>` + incSemaforoHtml(SEM), custo:11 }, incSec(1,'Alertas de limite, sublimite, Fator R e prejuízos'), incTab(`<tr><th>Ponto</th><th>Situação na consolidada</th></tr>`, lim.map(([a,b])=>incTr(a, `<td>${b}</td>`, 2))),
    ...INC_SECOES.alertas(M).map((b,i)=> i===0 ? incSec(2,'Alertas de fronteira e inconsistências') : b),
    incSec(3,'Dados faltantes e pendências'), incTab(`<tr><th>Dimensão</th><th>Item</th><th>O que falta</th></tr>`, P.map(p=>incTr(esc(p.dim), `<td>${esc(p.item)}</td><td>${esc(p.texto)}</td>`, 2)), 0, 'font-size:11px'),
    incSec(4,'Riscos tributários da operação'), { html:`<ul class="pp-p" style="margin-left:18px"><li>Perda do Simples Nacional pela consolidada (limite/sublimite) — efeitos a partir do mês seguinte ao excesso (LC 123/2006, art. 3º, § 9º).</li><li>Mudança de anexo pelo Fator R da folha conjunta (Anexo III × V).</li><li>Adicional de IRPJ pela soma dos lucros (Lei 9.249/95, art. 3º, § 1º).</li><li>Prejuízo fiscal e base negativa da incorporada não aproveitáveis (DL 2.341/87, art. 33).</li><li>Responsabilidade por tributos da incorporada (CTN, art. 132) e por multas (STJ, REsp 923.012).</li><li>Reforma Tributária: transição 2027–2033 com alíquotas projetadas — ${M.reforma.inversao ? 'a vantagem inverte em ' + M.reforma.inversao.ano : 'sinal estável na simulação'}; sensibilidade do crédito no Relatório 3.</li></ul>`, custo:14 },
    incSec(5,'Validações jurídicas e contábeis'), { html:`<table class="pp-tabela" style="font-size:11px"><thead><tr><th>Validação</th><th>Responsável</th><th>Situação</th></tr></thead><tbody>${[['Conferência dos dados de entrada de cada empresa (receitas, folha, compras, despesas, configuração)','contábil'],['Confirmação do regime e da elegibilidade ao Simples da consolidada no CNPJ sobrevivente','fiscal'],['Balanço de incorporação e laudo de avaliação','contábil / perito'],['Protocolo, justificação e atos societários','jurídico'],['Contratos, licenças e sucessão trabalhista','jurídico / RH'],['Due diligence tributária e contingências','jurídico / fiscal'],['Análise patrimonial e de endividamento','financeiro'],['Validação do estudo pelo responsável técnico','responsável técnico']].map(([v,r])=>`<tr><td class="rot">${v}</td><td>${r}</td><td>☐ pendente</td></tr>`).join('')}</tbody></table>`, custo:20 },
    incSec(6,'Documentos necessários e providências antes da incorporação'), { html:`<ul class="pp-p" style="margin-left:18px"><li>Balancetes e balanços das empresas na data-base.</li><li>Certidões negativas (federal, estadual, municipal, FGTS, trabalhista).</li><li>Relação de contratos, licenças, imóveis, veículos, marcas e sistemas.</li><li>Relação de funcionários e CCT aplicável.</li><li>Protocolo, justificação, laudo, atas e alterações contratuais.</li><li>Recálculo desta simulação após a validação dos dados${R.motorDefasado ? ' e com o motor atualizado' : ''}.</li></ul>`, custo:12 }];
}


// html longo (várias tabelas) → um bloco por tabela/título, com custo pelo nº de linhas
function incHtmlEmBlocos(h){
  const partes = String(h||'').split(/(?=<table)|(?<=<\/table>)/).filter(x => x.trim());
  return partes.map(x => ({ html: `<div style="font-size:10.5px">${x}</div>`, custo: Math.min(19, 2 + (x.match(/<tr/g)||[]).length) }));
}
// memória mensal (incMemoriaHtml, app_3) quebrada em blocos por tabela — uma tabela de 12 meses nunca é cortada pela página
function incMemoriaBlocos(R){
  const h = incMemoriaHtml(R).replace(/<h3[^>]*>Memória de cálculo<\/h3>/,'');
  const partes = h.split(/(?=<div style="font-weight:700;color:var\(--primary\);margin:(?:12px|8px) 0 4px">)/);
  return partes.filter(x => x.trim()).map(x => ({ html: `<div style="font-size:10.5px">${x}</div>`, custo: Math.min(19, 2 + (x.match(/<tr/g)||[]).length + Math.ceil((x.match(/<li/g)||[]).length*0.6)) }));
}

// ═══ RENDER ═══
const INC_REL_TIPOS_NOVOS = ['rel_executivo','rel_tributario','rel_reforma','rel_financeira','rel_patrimonial','rel_societaria','rel_memoria','rel_riscos','rel_todos'];
function incFerramentas(M, tipo){
  const statusIA = INC._ia ? `🤖 Textos gerados pela IA em ${esc(INC._ia.quando)}.` : (INC._iaErro ? `⚠️ A geração com IA falhou (${esc(INC._iaErro)}) — textos padrão do sistema.` : 'Textos padrão do sistema — clique em "Gerar textos com IA".');
  const dica = 'Destino = Salvar como PDF · Margens = Nenhuma · Cabeçalhos e rodapés DESLIGADOS · Gráficos de segundo plano ligados';
  const imprimir = tipo === 'rel_todos'
    ? `<button class="btn" onclick="incImprimir('retrato')" title="${dica} · relatórios 1, 4, 5, 6 e 8 (A4 retrato)">🖨️ PDF gerencial (retrato)</button><button class="btn" onclick="incImprimir('paisagem')" title="${dica} · relatórios 2, 3 e 7 (A4 paisagem)">🖨️ PDF técnico (paisagem)</button>`
    : `<button class="btn" onclick="window.print()" title="${dica}${INC_DOCS[tipo] && INC_DOCS[tipo].paisagem ? ' · A4 paisagem' : ' · A4 retrato'}">🖨️ Imprimir / PDF</button>`;
  return `<div class="card pp-tools"><div class="toolbar" style="align-items:center"><span class="hint">${statusIA}</span><span style="flex:1"></span>
    <button class="btn" onclick="incExcel('${tipo}')" title="Planilha com uma aba por seção/relatório — os mesmos números do documento (Relatório 7: fórmulas de planilha)">📗 Exportar Excel</button>${imprimir}
    <button class="btn solid" id="pp-ia-btn" onclick="incParecerIA()">🤖 Gerar textos com IA</button></div><div id="pp-regua"></div></div>`;
}
function incRelatorioRender(tipo){
  const M = incModelo(); if (!M){ $id('rl-corpo').innerHTML = '<div class="card placeholder"><h2>Sem simulação calculada</h2></div>'; return; }
  const tipos = tipo === 'rel_todos' ? Object.keys(INC_DOCS) : [tipo];
  let h = incFerramentas(M, tipo); const apos = [];
  for (const t of tipos){ const d = INC_DOCS[t]; if (!d) continue; const doc = incDocumento(M, { tipo:t, titulo: typeof d.titulo === 'function' ? d.titulo(M) : d.titulo, sub:d.sub, capa:d.capa, paisagem:!!d.paisagem, compacto:!!d.compacto, paginas: d.paginas ? d.paginas(M) : null, blocos:d.blocos(M) }); h += doc.html; apos.push(...doc.apos); }
  // v1.7.0: orientação ÚNICA por documento (regra @page global — vale em qualquer navegador); "Todos" imprime por grupo
  incPrintCss(tipo === 'rel_todos' ? null : (INC_DOCS[tipo] && INC_DOCS[tipo].paisagem ? 'paisagem' : 'retrato'));
  const corpo = $id('rl-corpo'); corpo.innerHTML = h;
  incEmpacotar(corpo);                                   // v1.7.0: repagina por MEDIÇÃO real antes de desenhar os gráficos
  apos.forEach(f => { try { f(); } catch(e){ console.error('relatório/gráfico', e); } });
  setTimeout(() => { try { incReguaRender(); } catch(e){ console.error('régua', e); } }, 350);
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
    rel_financeira:[regimes, separadas], rel_patrimonial:[alertas], rel_societaria:[alertas], rel_memoria:[premissas, ...incMemoriaCompleta(M).abas.map((a,i) => () => incExcelAba(('M' + (i+1) + ' ' + a.titulo).slice(0,31), a.aoa))], rel_riscos:[alertas], rel_todos:[painel, separadas, ()=>tributos('simples'), ()=>tributos('lp'), ()=>tributos('lr'), regimes, reforma, ranking, alertas, conclusoes, premissas, memoria] };
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

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ══ v1.6.0 · REDESIGN DOS RELATÓRIOS — camada GERENCIAL (executivo + resumo executivo do parecer) ══
// ══ e camada TÉCNICA (relatórios 2, 3, 7 em A4 paisagem). Nada do motor ou do modelo muda: ══
// ══ tudo abaixo LÊ incModelo() e só apresenta — cards, gráficos (Chart.js), interpretações ══
// ══ automáticas escritas a partir dos números calculados, semáforo, pontos +/−, checklist. ══
// ═══════════════════════════════════════════════════════════════════════════════════════════
const INC_COR = { ok:'#1e8449', err:'#c0392b', warn:'#b9770e', cinza:'#8a97a8', azul:'#1a5276', azul2:'#2e86ab', ouro:'#d99a2b', fundo:'#f4f6f9' };
// formatação única (item 22): moeda R$ 1.234.567,89 · negativo -R$ 35.000,00 · percentual 12,34%
const incRS = v => (v == null || isNaN(v)) ? '—' : (v < -0.005 ? '-R$ ' + fmt(Math.abs(v)) : 'R$ ' + fmt(Math.abs(v) < 0.005 ? 0 : v));
const incPct = (v, d=2) => (v == null || isNaN(v)) ? '—' : fmtP(v*100, d) + '%';
const incSinalRS = v => v <= -0.5 ? '-' + incRS(Math.abs(v)).replace('R$','R$') : v >= 0.5 ? '+' + incRS(v) : incRS(0);
const incCorSinal = v => v <= -0.5 ? INC_COR.ok : v >= 0.5 ? INC_COR.err : INC_COR.cinza;
const incIco = k => ({ ok:'🟢', warn:'🟡', err:'🔴', na:'⚪' })[k] || '⚪';

// ── grupos de tributo (executivo): ANTES = cada empresa no seu regime mais barato; DEPOIS = consolidada no dela ──
const INC_GRUPOS = ['IRPJ','Adicional de IRPJ','CSLL','PIS','COFINS','ICMS','ISS','IPI','INSS/CPP','Outros'];
function incGrupoDe(rot){
  const t = rot.toLowerCase();
  if (/adicional/.test(t)) return 'Adicional de IRPJ';
  if (/irpj/.test(t)) return 'IRPJ'; if (/csll/.test(t)) return 'CSLL'; if (/cofins/.test(t)) return 'COFINS'; if (/pis/.test(t)) return 'PIS';
  if (/icms/.test(t)) return 'ICMS'; if (/iss/.test(t)) return 'ISS'; if (/ipi/.test(t)) return 'IPI'; if (/cpp|inss/.test(t)) return 'INSS/CPP';
  return 'Outros';
}
function incGruposTributo(M){
  const antes = {}, depois = {}, porEmp = M.ents.map(() => ({}));
  INC_GRUPOS.forEach(g => { antes[g] = 0; depois[g] = 0; porEmp.forEach(o => o[g] = 0); });
  // ANTES = cada empresa medida no regime mais barato PARA A SOMA das separadas (o mesmo critério do cenário
  // "Manter as empresas separadas" do motor de decisão, v1.3.0) — assim Σ antes = carga atual do dashboard, ao centavo.
  M.ents.forEach((e, i) => { for (const l of incTributosDetalhe(e.R, M.sep.ind.reg, e.cfg).linhas) if (!l.info){ const g = incGrupoDe(l.tributo); antes[g] += l.valor; porEmp[i][g] += l.valor; } });
  for (const l of incTributosDetalhe(M.cons.R, M.c2.ind.reg, M.cons.cfg).linhas) if (!l.info) depois[incGrupoDe(l.tributo)] += l.valor;
  const linhas = INC_GRUPOS.map(g => ({ g, antes: antes[g], depois: depois[g], delta: incZero(depois[g] - antes[g]), porEmp: porEmp.map(o => o[g]) })).filter(l => Math.abs(l.antes) + Math.abs(l.depois) > 0.005);
  const totA = linhas.reduce((s,l)=>s+l.antes,0), totD = linhas.reduce((s,l)=>s+l.depois,0);
  const maiorEco = linhas.filter(l=>l.delta<-0.5).sort((a,b)=>a.delta-b.delta)[0] || null, maiorAcr = linhas.filter(l=>l.delta>0.5).sort((a,b)=>b.delta-a.delta)[0] || null;
  return { linhas, totA, totD, delta: incZero(totD - totA), maiorEco, maiorAcr, regimesAntes: M.ents.map(e=>e.ind.regNome), regimeSoma: M.sep.ind.regNome, regimeDepois: M.c2.ind.regNome };
}
// agrupamento curto da tabela executiva (item 13)
function incGruposCurto(G){
  const j = (nomes, rot) => { const ls = G.linhas.filter(l => nomes.includes(l.g)); return { rot, antes: ls.reduce((s,l)=>s+l.antes,0), depois: ls.reduce((s,l)=>s+l.depois,0) }; };
  return [j(['IRPJ','Adicional de IRPJ'],'IRPJ (com adicional)'), j(['CSLL'],'CSLL'), j(['PIS','COFINS'],'PIS/COFINS'), j(['ICMS','ISS','IPI'],'ICMS/ISS/IPI'), j(['INSS/CPP'],'Previdenciário (INSS/CPP)'), j(['Outros'],'Outros')].filter(l => Math.abs(l.antes)+Math.abs(l.depois) > 0.005).map(l => Object.assign(l, { delta: incZero(l.depois - l.antes) }));
}

// ── semáforo (item 11): "não avaliado" nunca é negativo ──
function incSemaforo(M){
  const p = M.painel, RF = M.reforma, L = [];
  const trib = p.econ <= -0.5 ? ['ok','Favorável', `economia de ${incRS(Math.abs(p.econ))}/ano`] : p.econ >= 0.5 ? ['err','Desfavorável', `acréscimo de ${incRS(p.econ)}/ano`] : ['na','Neutro','diferença inferior a R$ 0,50'];
  L.push({ dim:'Tributária', k:trib[0], rot:trib[1], obs:trib[2] });
  const ref = RF.inversao ? ['warn','Atenção', `o sinal inverte em ${RF.inversao.ano}`] : p.refD <= -0.5 ? ['ok','Favorável', `economia acumulada de ${incRS(Math.abs(p.refD))} (2027–2033)`] : p.refD >= 0.5 ? ['err','Desfavorável', `acréscimo acumulado de ${incRS(p.refD)} (2027–2033)`] : ['na','Neutro','sem diferença relevante na transição'];
  L.push({ dim:'Reforma Tributária', k:ref[0], rot:ref[1], obs:ref[2] });
  if (M.regimes.resCons != null && M.regimes.resSep != null){ const d = incZero(M.regimes.resCons - M.regimes.resSep); L.push({ dim:'Financeira', k: d >= 0.5 ? 'ok' : d <= -0.5 ? 'err' : 'na', rot: d >= 0.5 ? 'Favorável' : d <= -0.5 ? 'Desfavorável' : 'Neutro', obs:`resultado após tributos ${d >= 0.5 ? 'sobe' : d <= -0.5 ? 'cai' : 'não muda'} ${incRS(Math.abs(d))} (só tributos — caixa e dívida não avaliados)` }); }
  else L.push({ dim:'Financeira', k:'na', rot:'Não avaliada', obs:'sem custos e despesas lançados' });
  L.push({ dim:'Patrimonial', k:'na', rot:'Dados insuficientes', obs:'balanço, dívidas e contingências não informados' });
  L.push({ dim:'Societária', k:'warn', rot:'Requer validação', obs:'sucessão de contratos, licenças, funcionários e atos societários' });
  L.push({ dim:'Operacional', k:'warn', rot:'Requer análise', obs: M.R.abatidos.length ? `${M.R.abatidos.length} operação(ões) entre as empresas abatida(s); integração operacional não avaliada` : 'operações entre as empresas não verificadas; integração operacional não avaliada' });
  return L;
}
const incSemaforoHtml = (L, fonte=12) => `<table class="pp-tab" style="font-size:${fonte}px"><thead><tr><th>Dimensão</th><th style="text-align:left">Situação</th><th style="text-align:left">Por quê</th></tr></thead><tbody>${L.map(l => `<tr><td class="rot">${l.dim}</td><td style="text-align:left;white-space:nowrap;font-weight:600;color:${INC_COR[l.k==='na'?'cinza':l.k]}">${incIco(l.k)} ${l.rot}</td><td style="text-align:left">${esc(l.obs)}</td></tr>`).join('')}</tbody></table>`;

// ── pontos favoráveis / de atenção (item 15) — só o que os dados mostram ──
function incPontos(M){
  const G = incGruposTributo(M), p = M.painel, fav = [], at = [];
  if (p.econ <= -0.5) fav.push(`Economia tributária de ${incRS(Math.abs(p.econ))} por ano (${incPct(Math.abs(p.econ)/M.sep.ind.trib)} da carga atual).`);
  if (p.econ >= 0.5) at.push(`Acréscimo tributário de ${incRS(p.econ)} por ano (${incPct(p.econ/M.sep.ind.trib)} da carga atual).`);
  for (const l of G.linhas) if (l.delta <= -0.5 && Math.abs(l.delta) >= 0.002*G.totA) fav.push(`${l.g} cai ${incRS(Math.abs(l.delta))} (${incRS(l.antes)} → ${incRS(l.depois)}).`);
  for (const l of G.linhas) if (l.delta >= 0.5 && Math.abs(l.delta) >= 0.002*G.totA) at.push(`${l.g} sobe ${incRS(l.delta)} (${incRS(l.antes)} → ${incRS(l.depois)}).`);
  const regsAntes = [...new Set(G.regimesAntes)];
  if (regsAntes.length > 1 || regsAntes[0] !== G.regimeDepois){ (M.cons.sn && M.cons.sn.estado !== 'elegivel' && regsAntes.includes('Simples Nacional') ? at : fav).push(`Regime: ${M.ents.map((e,i)=>`${e.nome} em ${G.regimesAntes[i]}`).join(', ')} → consolidada em ${G.regimeDepois}${M.cons.sn && M.cons.sn.estado !== 'elegivel' ? ' (a consolidada não pode ficar no Simples Nacional)' : ''}.`); }
  else fav.push(`Um único regime (${G.regimeDepois}) para toda a operação — uma apuração, uma escrituração.`);
  if (p.refD <= -0.5) fav.push(`Economia acumulada de ${incRS(Math.abs(p.refD))} na transição da Reforma (2027–2033).`);
  if (p.refD >= 0.5) at.push(`Acréscimo acumulado de ${incRS(p.refD)} na transição da Reforma (2027–2033).`);
  if (M.reforma.inversao) at.push(`A vantagem da Reforma inverte de sinal em ${M.reforma.inversao.ano}.`);
  if (M.R.abatidos.length) fav.push(`${M.R.abatidos.length} operação(ões) entre as empresas (${incRS(M.R.abatidos.reduce((s,a)=>s+a.valor,0))}) deixam de existir — sem tributo e sem nota entre elas.`);
  M.alertas.filter(a=>a.n==='err'||a.n==='warn').slice(0,2).forEach(a => at.push(a.t.replace(/\s+—.*$/,'').slice(0,140) + (a.t.length > 140 ? '…' : '')));
  at.push('Patrimônio, endividamento e aspectos societários não avaliados — validação necessária antes de decidir.');
  return { fav: fav.slice(0,8), at: at.slice(0,9), G };
}

// ── interpretações automáticas (item 14) — frases só com números calculados ──
function incInterp(M){
  const p = M.painel, G = incGruposTributo(M), RF = M.reforma, D = M.regimes.cons, I = {};
  const pctA = M.sep.ind.trib > 0.005 ? Math.abs(p.econ)/M.sep.ind.trib : 0;
  I.antesDepois = p.econ <= -0.5 ? `A incorporação representa uma redução estimada de ${incRS(Math.abs(p.econ))} por ano, equivalente a ${incPct(pctA)} da carga tributária atual (${incRS(M.sep.ind.trib)} → ${incRS(M.c2.ind.trib)}).`
    : p.econ >= 0.5 ? `A incorporação representa um aumento estimado de ${incRS(p.econ)} por ano, equivalente a ${incPct(pctA)} da carga tributária atual (${incRS(M.sep.ind.trib)} → ${incRS(M.c2.ind.trib)}).`
    : `A incorporação não altera a carga tributária anual de forma relevante (${incRS(M.sep.ind.trib)} → ${incRS(M.c2.ind.trib)}).`;
  const partes = [];
  if (G.maiorEco) partes.push(`a redução de ${G.maiorEco.g} (${incRS(Math.abs(G.maiorEco.delta))})`);
  if (G.maiorAcr) partes.push(`o aumento de ${G.maiorAcr.g} (${incRS(G.maiorAcr.delta)})`);
  I.tributos = G.delta <= -0.5 ? `O principal fator de economia é ${G.maiorEco ? partes[0] : 'a mudança de regime'}${G.maiorAcr ? ', parcialmente compensado por ' + partes[partes.length-1] : ''}. Impacto tributário líquido: ${incSinalRS(G.delta)}.`
    : G.delta >= 0.5 ? `O principal fator de acréscimo é ${G.maiorAcr ? partes[partes.length-1] : 'a mudança de regime'}${G.maiorEco ? ', parcialmente compensado por ' + partes[0] : ''}. Impacto tributário líquido: ${incSinalRS(G.delta)}.`
    : `Os aumentos e reduções por tributo se compensam: impacto tributário líquido de ${incRS(0)}.`;
  const perm = D.linhas.filter(l=>l.permitido), naoPerm = D.linhas.filter(l=>!l.permitido);
  I.regimes = `Entre os regimes permitidos à consolidada (${perm.map(l=>l.nome).join(' e ')}), o ${D.menorTrib ? INC_REGIME_NOME[D.menorTrib] : '—'} apresenta a menor carga tributária estimada (${incRS(perm.find(l=>l.k===D.menorTrib)?.trib)}${perm.length > 1 ? ', contra ' + perm.filter(l=>l.k!==D.menorTrib).map(l=>`${incRS(l.trib)} no ${l.nome}`).join(' e ') : ''}).${naoPerm.length ? ' ' + naoPerm.map(l=>`O ${l.nome} não é permitido (${String(l.motivo).replace(/<[^>]+>/g,'').split(' (LC')[0]}) e por isso não entra na escolha.`).join(' ') : ''}`;
  const melhorAno = RF.anos.length ? RF.anos.slice().sort((a,b)=>a.delta-b.delta)[0] : null;
  I.reforma = RF.anos.length ? `${RF.acumTotal <= -0.5 ? 'Economia' : RF.acumTotal >= 0.5 ? 'Acréscimo' : 'Impacto neutro'} acumulad${RF.acumTotal <= -0.5 ? 'a' : 'o'} de ${incRS(Math.abs(RF.acumTotal))} entre 2027 e 2033. ${melhorAno && melhorAno.delta <= -0.5 ? `O ano de maior vantagem é ${melhorAno.ano} (${incRS(Math.abs(melhorAno.delta))}). ` : ''}${RF.inversao ? `A vantagem inverte de sinal em ${RF.inversao.ano}.` : RF.acumTotal <= -0.5 ? 'A incorporação permanece vantajosa durante toda a transição.' : RF.acumTotal >= 0.5 ? 'A consolidada paga mais em todos os anos da transição.' : ''}` : 'Sem cenários da Reforma na análise.';
  I.reformaMantem = RF.anos.length ? (RF.anos.every(a => a.delta <= -0.5) ? 'SIM' : RF.anos.every(a => a.delta >= -0.5) ? 'NÃO' : 'PARCIALMENTE') : '—';
  const r1 = M.ranking[0], r2 = M.ranking[1];
  I.ranking = `O cenário "${r1.nome}" é o melhor entre as alternativas avaliadas (score ${Math.round(r1.score.total)}, ${r1.classe.rot})${r2 ? `; "${r2.nome}" fica em 2º (score ${Math.round(r2.score.total)})${Math.abs(r1.trib - r2.trib) > 0.5 ? `, pagando ${incRS(Math.abs(r2.trib - r1.trib))} a mais por ano` : ', empatado na carga anual'}` : ''}. Manter as empresas separadas é a referência de comparação (carga de ${incRS(M.sep.ind.trib)}).`;
  I.conclusao = p.classe.k === 'INC' ? `A análise está incompleta (${p.classe.motivos.join('; ')}) e não permite concluir.`
    : p.econ <= -0.5 ? `Com base nas informações tributárias analisadas, o cenário "${p.melhor}" apresenta o melhor resultado entre as alternativas avaliadas, com economia estimada de ${incRS(Math.abs(p.econ))} por ano em ${p.regime}.`
    : p.econ >= 0.5 ? `Com base nas informações tributárias analisadas, nenhuma alternativa de incorporação reduz a carga: o melhor cenário ("${p.melhor}") ainda representa acréscimo de ${incRS(p.econ)} por ano. A operação só se justifica por ganhos operacionais ou societários, não avaliados aqui.`
    : `Com base nas informações tributárias analisadas, a incorporação ("${p.melhor}") é tributariamente neutra; a decisão deve se apoiar em fatores operacionais e societários, não avaliados aqui.`;
  I.G = G;
  return I;
}

// ── gráficos (Chart.js já carregado; tamanho fixo para impressão estável) ──
function incGrafico(id, w, h, cfg, custo){
  return { html:`<div class="pp-chart" style="width:${w}px;height:${h}px;margin:4px auto 6px"><canvas id="${id}" width="${w}" height="${h}"></canvas></div>`, custo: custo || Math.ceil(h/28), apos: () => { const el = $id(id); if (!el || !window.Chart) return; cfg.options = Object.assign({ responsive:false, animation:false, devicePixelRatio:2, maintainAspectRatio:false }, cfg.options||{}); rlChart(id, cfg); } };
}
const incTick = v => Math.abs(v) >= 1e6 ? (v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:1}) + ' mi' : Math.abs(v) >= 1e3 ? (v/1e3).toLocaleString('pt-BR',{maximumFractionDigits:0}) + ' mil' : String(Math.round(v));
const incEixoRS = { ticks:{ callback: v => 'R$ ' + incTick(v), font:{ size:10 } }, grid:{ color:'#e6eaf0' } };
const INC_TT = { callbacks:{ label: c => (c.dataset.label ? c.dataset.label + ': ' : '') + incRS(Array.isArray(c.raw) ? c.raw[1]-c.raw[0] : c.raw) } };
function incGrAntesDepois(M, id, w=620, h=230){
  const G = incGruposTributo(M);
  return incGrafico(id, w, h, { type:'bar', data:{ labels:[`Empresas separadas\n${M.ents.map(e=>e.nome).join(' + ')}`, `Após a incorporação\n${M.painel.melhorCurto}`], datasets:[{ label:'Tributos por ano', data:[M.sep.ind.trib, M.c2.ind.trib], backgroundColor:[INC_COR.cinza, incCorSinal(M.painel.econ)], borderRadius:6, barPercentage:.55 }] },
    options:{ plugins:{ legend:{ display:false }, tooltip:INC_TT, title:{ display:true, text:`Tributos por ano: ${incRS(M.sep.ind.trib)} → ${incRS(M.c2.ind.trib)}  (${incSinalRS(M.painel.econ)} · ${incPct(M.sep.ind.trib>0.005?M.painel.econ/M.sep.ind.trib:0)})`, font:{ size:12 } } }, scales:{ y:Object.assign({ beginAtZero:true }, incEixoRS), x:{ ticks:{ font:{ size:11 } }, grid:{ display:false } } } } });
}
function incGrWaterfall(M, id, w=620, h=260){
  const G = incGruposTributo(M), labels = ['Antes'], data = [[0, G.totA]], cores = [INC_COR.cinza]; let acc = G.totA;
  for (const l of G.linhas){ if (Math.abs(l.delta) < 0.5) continue; labels.push(l.g); data.push([acc, acc + l.delta]); cores.push(l.delta < 0 ? INC_COR.ok : INC_COR.err); acc += l.delta; }
  labels.push('Depois'); data.push([0, G.totD]); cores.push(INC_COR.azul);
  return incGrafico(id, w, h, { type:'bar', data:{ labels, datasets:[{ data, backgroundColor:cores, borderRadius:3, barPercentage:.7 }] },
    options:{ plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label: c => c.dataIndex===0||c.dataIndex===data.length-1 ? incRS(c.raw[1]) : incSinalRS(c.raw[1]-c.raw[0]) } }, title:{ display:true, text:`Cascata por tributo — 🟢 redução · 🔴 aumento · líquido ${incSinalRS(G.delta)}`, font:{ size:12 } } }, scales:{ y:Object.assign({ beginAtZero:true }, incEixoRS), x:{ ticks:{ font:{ size:10 }, maxRotation:35 }, grid:{ display:false } } } } });
}
function incGrRegimes(M, id, w=620, h=200){
  const D = M.regimes.cons, ls = D.linhas;
  return incGrafico(id, w, h, { type:'bar', data:{ labels: ls.map(l => l.permitido ? `${l.nome} — ${incRS(l.trib)}${l.k===D.menorTrib ? ' ★' : ''}` : `${l.nome} — NÃO PERMITIDO`), datasets:[{ data: ls.map(l=>l.trib), backgroundColor: ls.map(l => !l.permitido ? '#d5dbe1' : l.k===D.menorTrib ? INC_COR.ok : INC_COR.azul2), borderColor: ls.map(l => !l.permitido ? INC_COR.cinza : 'transparent'), borderWidth: ls.map(l => !l.permitido ? 1 : 0), borderDash:[4,3], borderRadius:4, barPercentage:.6 }] },
    options:{ indexAxis:'y', plugins:{ legend:{ display:false }, tooltip:INC_TT, title:{ display:true, text:'Tributos anuais da consolidada por regime (★ menor carga entre os permitidos)', font:{ size:12 } } }, scales:{ x:Object.assign({ beginAtZero:true }, incEixoRS), y:{ ticks:{ font:{ size:11 } }, grid:{ display:false } } } } });
}
function incGrReforma(M, id, w=620, h=240){
  const RF = M.reforma;
  return incGrafico(id, w, h, { type:'line', data:{ labels: RF.anos.map(a=>a.ano), datasets:[{ label:'Empresas separadas', data:RF.anos.map(a=>a.sep), borderColor:INC_COR.cinza, backgroundColor:INC_COR.cinza, tension:.25, pointRadius:3 }, { label:'Empresa consolidada', data:RF.anos.map(a=>a.cons), borderColor:INC_COR.azul, backgroundColor:INC_COR.azul, tension:.25, pointRadius:3 }] },
    options:{ plugins:{ legend:{ position:'bottom', labels:{ font:{ size:11 } } }, tooltip:INC_TT, title:{ display:true, text:`Transição 2027–2033 · acumulado ${incSinalRS(RF.acumTotal)}`, font:{ size:12 } } }, scales:{ y:incEixoRS, x:{ grid:{ display:false } } } } });
}
function incGrRanking(M, id, w=620, h=180){
  const ls = [...M.ranking.map(r => ({ rot:`${r.pos}º — ${r.nome} (${r.regime})`, v:r.score.total, cor: INC_COR[r.classe.cls==='neutro'?'cinza':r.classe.cls] })), { rot:'ref. — Manter separadas', v:0, cor:INC_COR.cinza }];
  return incGrafico(id, w, h, { type:'bar', data:{ labels: ls.map(l=>l.rot), datasets:[{ data: ls.map(l=>l.v), backgroundColor: ls.map(l=>l.cor), borderRadius:4, barPercentage:.6 }] },
    options:{ indexAxis:'y', plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label: c => 'score ' + Math.round(c.raw) } }, title:{ display:true, text:'Score de 0 a 100 (tributário 60% · Reforma 20% · estabilidade 20%) — separadas = referência, sem score', font:{ size:11 } } }, scales:{ x:{ min:0, max:100, ticks:{ font:{ size:10 } }, grid:{ color:'#e6eaf0' } }, y:{ ticks:{ font:{ size:11 } }, grid:{ display:false } } } } });
}

// ── cards / blocos gerenciais ──
const incCard = (v, rot, cor, sub) => `<td style="width:25%;vertical-align:top;padding:5px"><div style="border:1px solid #dfe4ea;border-radius:10px;padding:9px 11px;background:${INC_COR.fundo};min-height:58px"><div class="hint" style="font-size:10px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px">${rot}</div><div style="font-family:var(--display);font-size:${String(v).replace(/<[^>]+>/g,'').length > 20 ? 13 : 19}px;font-weight:700;color:${cor||INC_COR.azul};line-height:1.15">${v}</div>${sub ? `<div class="hint" style="font-size:10.5px;margin-top:2px">${sub}</div>` : ''}</div></td>`;
const incCards = (cards, porLinha=4) => { let h = '<table style="width:100%;border-collapse:collapse;margin:2px 0 6px">'; for (let i = 0; i < cards.length; i += porLinha) h += '<tr>' + cards.slice(i, i+porLinha).join('') + '</tr>'; return h + '</table>'; };
const incTitPag = (t, sub) => ({ html:`<h3 class="pp-sec" style="margin-top:0;font-size:18px">${t}</h3>${sub ? `<div class="hint" style="margin:-4px 0 8px">${sub}</div>` : ''}`, custo:3 });
const incInterpBlk = t => ({ html:`<div style="border-left:3px solid ${INC_COR.ouro};background:#fbf6ea;padding:8px 11px;font-size:12.5px;line-height:1.55;margin:6px 0;border-radius:0 8px 8px 0"><b>Leitura:</b> ${t}</div>`, custo: Math.max(2, Math.ceil(t.length/300)) });
const incDestaque = (t, cor) => ({ html:`<div style="border:2px solid ${cor||INC_COR.azul};border-radius:10px;padding:8px 12px;font-size:13.5px;font-weight:700;color:${cor||INC_COR.azul};margin:8px 0;text-align:center">${t}</div>`, custo:3 });

function incDashboardCards(M){
  const p = M.painel, cl = p.classe, pct = M.sep.ind.trib > 0.005 ? p.econ/M.sep.ind.trib : 0;
  const corE = incCorSinal(p.econ), ecoRot = p.econ <= -0.5 ? 'economia anual' : p.econ >= 0.5 ? 'acréscimo anual' : 'diferença anual';
  return incCards([
    incCard(incBadgeClasse(cl), 'conclusão', null, cl.motivos.length ? esc(cl.motivos.join('; ')) : (p.econ <= -0.5 ? 'no que o sistema mede' : '')),
    incCard(esc(p.melhorCurto), p.econ <= -0.5 ? 'melhor cenário' : 'cenário menos oneroso', null, `${esc(p.incorporadora)} incorpora ${esc(p.incorporadas)}`),
    incCard(esc(p.regime), 'regime indicado', null, 'menor carga entre os permitidos'),
    incCard(String(Math.round(p.score)) + '<span style="font-size:12px;color:#888"> / 100</span>', 'score da operação', INC_COR[cl.cls==='neutro'?'cinza':cl.cls]),
    incCard(incRS(M.sep.ind.trib), 'carga atual (separadas)', INC_COR.cinza, M.ents.map(e=>`${esc(e.nome)}: ${e.ind.regNome}`).join(' · ')),
    incCard(incRS(M.c2.ind.trib), 'após a incorporação', INC_COR.azul, `${incPct(M.c2.ind.carga)} da receita`),
    incCard(incSinalRS(p.econ), ecoRot, corE, `${p.econ <= -0.5 ? '−' : p.econ >= 0.5 ? '+' : ''}${incPct(Math.abs(pct))} da carga atual`),
    incCard(incSinalRS(p.refD), p.refD <= -0.5 ? 'economia acumulada 2027–2033' : p.refD >= 0.5 ? 'acréscimo acumulado 2027–2033' : 'Reforma 2027–2033', incCorSinal(p.refD), 'impacto estimado da Reforma'),
    incCard(String(p.nAlertas), 'riscos / alertas', p.nAlertas ? INC_COR.warn : INC_COR.ok, 'alertas de fronteira do motor'),
    incCard(String(p.nPend), 'pendências', p.nPend ? INC_COR.warn : INC_COR.ok, 'dados a validar antes de decidir'),
    incCard(esc(p.regimeTodos.linhas.filter(l=>!l.permitido).map(l=>l.nome).join(', ') || 'nenhum'), 'regime não permitido', INC_COR.cinza, 'para a consolidada'),
    incCard(M.CE.S3 ? 'sim' : (M.E.length > 2 ? 'não (3+ empresas)' : 'não'), 'sentido inverso simulado', INC_COR.cinza, M.CE.S3 ? `${esc(M.ranking.find(r=>r.pos===2)?.nome||'')}` : ''),
  ]);
}
const incRiscosTop = (M, n=4) => M.alertas.filter(a=>a.n==='err').concat(M.alertas.filter(a=>a.n==='warn')).concat(M.alertas.filter(a=>a.n!=='err'&&a.n!=='warn')).slice(0,n);
const INC_PROXIMOS = ['Validar balanços contábeis das empresas','Confirmar passivos (empréstimos, financiamentos, dívidas fiscais e trabalhistas)','Levantar contingências tributárias','Analisar contratos (clientes, fornecedores, locações)','Revisar quadro societário e atos necessários','Confirmar regime tributário da consolidada no CNPJ sobrevivente','Validar projeções da Reforma (alíquotas e créditos)','Elaborar planejamento da incorporação (protocolo, laudo, cronograma)','Análise jurídica','Aprovação pelos sócios'];
function incChecklistHtml(M){
  const feito = t => /regime tributário/i.test(t) && M.cons.sn ? '☑' : '☐';
  return `<table class="pp-tab" style="font-size:12px"><tbody>${INC_PROXIMOS.map(t => `<tr><td style="width:24px;text-align:center;font-size:14px">${feito(t)}</td><td style="text-align:left">${t}${feito(t)==='☑' ? ' <span class="hint">(elegibilidade calculada; confirmar na opção do CNPJ)</span>' : ''}</td></tr>`).join('')}</tbody></table>`;
}

// ── RELATÓRIO EXECUTIVO (camada gerencial) — 9 páginas, uma por assunto ──
function incExecutivoPaginas(M, pref){
  const I = incInterp(M), G = I.G, S = incSemaforo(M), P = incPontos(M), p = M.painel, RF = M.reforma, id = s => `${pref}-${s}-${M.ident.id}`;
  const pags = [];
  // 2 · Dashboard
  pags.push([incTitPag('Decisão da incorporação', `Dashboard executivo · ${esc(M.E.map(e=>e.nome).join(' + '))} · ano-base ${M.ident.ano} · análise ${esc(M.ident.id)}`), { html: incDashboardCards(M), custo:15 }, incInterpBlk(I.conclusao),
    { html:`<div class="hint" style="margin-top:6px">Convenção: ${INC_LEG_SINAL.replace('Δ = consolidada − separadas · ','')} Valores calculados pelo motor do Análise Tributária Pro (lacre ${esc(M.ident.lacre)}); patrimônio, endividamento e aspectos societários não avaliados.</div>`, custo:2 }]);
  // 3 · Antes × Depois
  pags.push([incTitPag('Antes × Depois', `Tributos anuais das empresas separadas (${esc(M.sep.ind.regNome)} — regime mais barato para a soma) e da empresa consolidada (${esc(M.c2.ind.regNome)} — regime mais barato permitido)`), incGrAntesDepois(M, id('ad')), incInterpBlk(I.antesDepois),
    incTab(`<tr><th>Indicador</th><th class="num">Separadas</th><th class="num">Consolidada</th><th class="num">Diferença</th></tr>`, [
      incTr('Receita bruta', `${incTd(M.R.soma.receita)}${incTd(M.cons.T.receita)}<td class="num">${incSinalRS(M.cons.T.receita - M.R.soma.receita)}</td>`),
      incTr('Regime', `<td class="num">${esc(M.sep.ind.regNome)}</td><td class="num">${esc(M.c2.ind.regNome)}</td><td></td>`),
      incTr('Tributos por ano', `${incTd(M.sep.ind.trib)}${incTd(M.c2.ind.trib)}<td class="num" style="color:${incCorSinal(p.econ)};font-weight:700">${incSinalRS(p.econ)}</td>`),
      incTr('Carga sobre a receita', `<td class="num">${incPct(M.sep.ind.carga)}</td><td class="num">${incPct(M.c2.ind.carga)}</td><td class="num" style="color:${incCorSinal(p.econ)}">${fmtP((M.c2.ind.carga - M.sep.ind.carga)*100,2)} p.p.</td>`),
      M.regimes.resSep != null && M.regimes.resCons != null ? incTr('Resultado após tributos', `${incTd(M.regimes.resSep)}${incTd(M.regimes.resCons)}<td class="num" style="color:${incCorSinal(-(M.regimes.resCons - M.regimes.resSep))}">${incSinalRS(M.regimes.resCons - M.regimes.resSep)}</td>`) : incTr('Resultado após tributos', `<td colspan="3" class="hint">não medido — sem custos e despesas lançados</td>`),
      incTr('Reforma — acumulado 2027–2033', `${incTd(M.sep.ind.refAcum)}${incTd(M.c2.ind.refAcum)}<td class="num" style="color:${incCorSinal(p.refD)};font-weight:700">${incSinalRS(p.refD)}</td>`) ])]);
  // 4 · Regimes
  pags.push([incTitPag('Comparação dos regimes tributários', 'Quanto a empresa consolidada pagaria por ano em cada regime — só os permitidos entram na escolha'), incGrRegimes(M, id('rg')), incInterpBlk(I.regimes),
    incTab(`<tr><th>Regime</th><th style="text-align:left">Situação</th><th class="num">Tributos/ano</th><th class="num">Carga</th><th class="num">Resultado após tributos</th></tr>`, M.regimes.cons.linhas.map(l => incTr(l.nome + (l.k===M.regimes.cons.menorTrib ? ' ★' : ''), `<td style="text-align:left">${l.permitido ? '🟢 permitido' : '🔴 <b>NÃO PERMITIDO</b>'}</td>${incTd(l.trib)}<td class="num">${incPct(l.carga)}</td><td class="num">${l.resultado != null ? fmt(l.resultado) : '—'}</td>`))),
    ...(M.regimes.cons.linhas.some(l=>!l.permitido) ? [{ html:`<div class="hint">${M.regimes.cons.linhas.filter(l=>!l.permitido).map(l=>`<b>${l.nome}:</b> ${String(l.motivo).replace(/<[^>]+>/g,'')}`).join('<br>')}</div>`, custo:3 }] : [])]);
  // 5 · Economia por tributo
  pags.push([incTitPag(G.delta <= -0.5 ? 'Economia por tributo' : 'Variação por tributo', `De onde vem a diferença: cada tributo antes (separadas em ${esc(G.regimeSoma)}) e depois (consolidada em ${esc(G.regimeDepois)})`), incGrWaterfall(M, id('wf')), incInterpBlk(I.tributos),
    incTab(`<tr><th>Tributo</th><th class="num">Antes</th><th class="num">Depois</th><th class="num">Diferença</th><th style="text-align:left">Efeito</th></tr>`, [...incGruposCurto(G).map(l => incTr(l.rot, `${incTd(l.antes)}${incTd(l.depois)}<td class="num" style="color:${incCorSinal(l.delta)}">${incSinalRS(l.delta)}</td><td style="text-align:left">${l.delta <= -0.5 ? '🟢 redução' : l.delta >= 0.5 ? '🔴 aumento' : '⚪ sem impacto relevante'}</td>`)),
      { html:`<tr style="font-weight:700"><td class="rot">TOTAL</td>${incTd(G.totA)}${incTd(G.totD)}<td class="num" style="color:${incCorSinal(G.delta)}">${incSinalRS(G.delta)}</td><td style="text-align:left">${G.delta <= -0.5 ? '🟢 economia' : G.delta >= 0.5 ? '🔴 acréscimo' : '⚪ neutro'}</td></tr>`, custo:1 }]),
    incDestaque(`Impacto tributário líquido: ${incSinalRS(G.delta)} por ano`, incCorSinal(G.delta))]);
  // 6 · Reforma
  const melhorAno = RF.anos.length ? RF.anos.slice().sort((a,b)=>a.delta-b.delta)[0] : null;
  pags.push([incTitPag('Reforma Tributária — projeção 2027 a 2033', 'Tributos anuais estimados durante a transição (alíquotas de IBS/CBS projetadas para cada ano)'), incGrReforma(M, id('rf')), incInterpBlk(I.reforma),
    incTab(`<tr><th>Ano</th><th class="num">Separadas</th><th class="num">Consolidada</th><th class="num">Diferença</th><th class="num">Acumulado</th></tr>`, RF.anos.map(a => incTr(String(a.ano) + (melhorAno && a.ano===melhorAno.ano && a.delta <= -0.5 ? ' ★' : ''), `${incTd(a.sep)}${incTd(a.cons)}<td class="num" style="color:${incCorSinal(a.delta)}">${incSinalRS(a.delta)}</td><td class="num" style="color:${incCorSinal(a.acum)}">${incSinalRS(a.acum)}</td>`)), 0, 'font-size:11.5px'),
    incDestaque(`Impacto acumulado 2027–2033: ${incSinalRS(RF.acumTotal)} · vantajosa durante toda a transição: ${I.reformaMantem}${RF.inversao ? ' · ponto de inversão: ' + RF.inversao.ano : ''}`, incCorSinal(RF.acumTotal))]);
  // 7 · Ranking
  pags.push([incTitPag('Ranking das alternativas', 'Todas as alternativas avaliadas, da melhor para a pior'), incGrRanking(M, id('rk')), incInterpBlk(I.ranking),
    incTab(`<tr><th>#</th><th style="text-align:left">Cenário</th><th style="text-align:left">Regime</th><th class="num">Tributos/ano</th><th class="num">Economia/ano</th><th class="num">Score</th><th style="text-align:left">Classificação</th></tr>`, [...M.ranking.map(r => incTr(String(r.pos)+'º', `<td style="text-align:left">${esc(r.nome)}</td><td style="text-align:left">${esc(r.regime)}</td>${incTd(r.trib)}<td class="num" style="color:${incCorSinal(r.tribDelta)}">${incSinalRS(-r.tribDelta).replace(/^\+/,'').replace(/^-/,'-')}${r.tribDelta <= -0.5 ? '' : r.tribDelta >= 0.5 ? ' (acréscimo)' : ''}</td><td class="num"><b>${Math.round(r.score.total)}</b></td><td style="text-align:left">${incBadgeClasse(r.classe)}</td>`)),
      incTr('ref.', `<td style="text-align:left">${esc(M.sep.nome)}</td><td style="text-align:left">${esc(M.sep.ind.regNome)}</td>${incTd(M.sep.ind.trib)}<td class="num">—</td><td class="num">—</td><td style="text-align:left">referência</td>`)], 0, 'font-size:11.5px'),
    { html:`<div class="hint">Economia/ano: positivo = o cenário paga menos que as empresas separadas; negativo (acréscimo) = paga mais. Como o score é calculado: seção 10 do Parecer Consolidado.</div>`, custo:2 }]);
  // 8 · Riscos, pendências e semáforo
  const riscos = incRiscosTop(M, 3);
  pags.push([incTitPag('Riscos, pendências e semáforo de decisão'), { html:`<div style="font-weight:700;color:${INC_COR.azul};margin:2px 0 4px">Visão geral da operação</div>` + incSemaforoHtml(S, 11), custo:8 },
    { html:`<table style="width:100%;border-collapse:collapse;margin-top:6px"><tr><td style="width:50%;vertical-align:top;padding-right:6px"><div style="border:1px solid #cfe3d6;border-radius:10px;padding:8px 10px;background:#eef7f1"><div style="font-weight:700;color:${INC_COR.ok};margin-bottom:4px">✔ Pontos favoráveis</div><ul style="margin:0 0 0 16px;font-size:11.5px;line-height:1.5">${P.fav.map(t=>`<li>${t}</li>`).join('') || '<li>nenhum ponto favorável medido</li>'}</ul></div></td><td style="width:50%;vertical-align:top;padding-left:6px"><div style="border:1px solid #f0d9b0;border-radius:10px;padding:8px 10px;background:#fdf6ea"><div style="font-weight:700;color:${INC_COR.warn};margin-bottom:4px">⚠ Pontos de atenção</div><ul style="margin:0 0 0 16px;font-size:11.5px;line-height:1.5">${P.at.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div></td></tr></table>`, custo: 3 + Math.ceil(Math.max(P.fav.length, P.at.length)*0.9) },
    ...(riscos.length ? [{ html:`<div style="font-weight:700;color:${INC_COR.azul};margin:8px 0 4px">Principais riscos apontados pelo motor (${M.alertas.length} alerta(s) — lista completa no Relatório 8)</div><ul style="margin:0 0 0 16px;font-size:11px;line-height:1.45">${riscos.map(a=>`<li>${incIco(a.n==='err'?'err':a.n==='warn'?'warn':'na')} ${esc(a.t)}</li>`).join('')}</ul>`, custo: Math.ceil(riscos.length*1.6) }] : [])]);
  // 9 · Conclusão e próximos passos
  pags.push([incTitPag('Conclusão final e próximos passos'),
    { html: incCards([incCard(incBadgeClasse(p.classe), 'conclusão'), incCard(esc(p.melhorCurto), p.econ <= -0.5 ? 'operação recomendada (no que o sistema mede)' : 'cenário menos oneroso'), incCard(p.econ <= -0.5 ? incRS(Math.abs(p.econ)) + '/ano' : incSinalRS(p.econ) + '/ano', p.econ <= -0.5 ? 'benefício estimado' : 'efeito tributário'), incCard(incSinalRS(p.refD), 'Reforma 2027–2033 (acumulado)', incCorSinal(p.refD))]), custo:5 },
    incPar(I.conclusao), incPar(`<b>Principais riscos:</b> ${riscos.length ? riscos.slice(0,3).map(a=>a.t.split(':')[0]).join('; ') : 'nenhum alerta de fronteira'}. <b>Condições para execução:</b> ${M.recomendacao}`),
    { html:`<div style="font-weight:700;color:${INC_COR.azul};margin:6px 0 2px">Informações pendentes (${M.pend.length})</div><div class="hint">${[...new Set(M.pend.map(p=>p.dim))].map(d => `<b>${d}:</b> ${M.pend.filter(p=>p.dim===d).map(p=>esc(p.item)).join(', ')}`).join(' · ')}</div>`, custo:3 },
    { html:`<div style="font-weight:700;color:${INC_COR.azul};margin:8px 0 4px">Próximos passos</div>` + incChecklistHtml(M), custo: 8 },
    { html: incAssinatura(), custo:4 }]);
  return pags;
}
// páginas forçadas (uma por assunto): cada grupo vira ao menos uma página timbrada
const incPaginas = grupos => grupos.map(b => ppDocumento(b.filter(Boolean))).join('');

// ── RESUMO EXECUTIVO do Parecer Consolidado (2–3 páginas antes das seções técnicas) ──
function incResumoExecutivoPaginas(M){
  const I = incInterp(M), S = incSemaforo(M), P = incPontos(M), riscos = incRiscosTop(M, 4), id = s => `pc-${s}-${M.ident.id}`;
  return [
    [incTitPag('Resumo executivo', 'Para os sócios e administradores — o parecer técnico detalhado começa na seção 1'), { html: incDashboardCards(M), custo:15 }, incInterpBlk(I.conclusao)],
    [incTitPag('Resumo executivo — Antes × Depois e regimes'), incGrAntesDepois(M, id('ad'), 600, 200), incInterpBlk(I.antesDepois), incGrRegimes(M, id('rg'), 600, 170), incInterpBlk(I.regimes)],
    [incTitPag('Resumo executivo — Reforma, ranking e riscos'), incGrReforma(M, id('rf'), 600, 170), incInterpBlk(I.reforma), incGrRanking(M, id('rk'), 600, 130), { html: incSemaforoHtml(S, 10.5), custo:6 },
      { html:`<div class="hint"><b>Principais riscos:</b> ${riscos.length ? riscos.map(a=>esc(a.t.split(':')[0])).join('; ') : 'nenhum alerta'}. <b>Pontos de atenção:</b> ${P.at.slice(0,3).map(esc).join(' ')}</div>`, custo:2 }],
  ];
}

// ── relatórios de dados pendentes (item 12): título e abertura dizem que a análise NÃO foi concluída ──
function incPendenteBloco(dim, docs){
  return [{ html:`<div class="pp-alerta" style="background:#f2f4f7;border-left-color:${INC_COR.cinza}"><b>A análise ${dim} não foi concluída porque não foram fornecidas informações suficientes.</b> Isto não é um resultado negativo: a dimensão está <b>⚪ não avaliada</b>. Para concluí-la, informe:</div>`, custo:5 },
    { html:`<table class="pp-tab" style="font-size:12px"><thead><tr><th>Documento / informação</th><th style="text-align:left">Para quê</th></tr></thead><tbody>${docs.map(([d,p])=>`<tr><td class="rot">☐ ${d}</td><td style="text-align:left">${p}</td></tr>`).join('')}</tbody></table>`, custo: 2 + docs.length }];
}
const INC_DOCS_PATR = [['Balanço patrimonial e balancete (data-base)','ativo, passivo, patrimônio líquido, caixa'],['Relação de bens (imóveis, veículos, máquinas, marcas)','patrimônio a incorporar e laudo de avaliação'],['Empréstimos e financiamentos','endividamento, serviço da dívida, covenants'],['Passivos fiscais, trabalhistas e parcelamentos','sucessão de dívidas (CTN, art. 132)'],['Contingências (provisões e processos)','riscos que passam à incorporadora'],['Ágio/deságio de participações','efeito fiscal (Lei 12.973/14)']];
const INC_DOCS_FIN = [['Custos e despesas por natureza (fixos × variáveis)','lucro, margem, ponto de equilíbrio'],['Fluxo de caixa e capital de giro','geração de caixa e capacidade de pagamento'],['Serviço da dívida','capacidade de pagamento'],['Investimentos previstos','necessidade de caixa da integração']];
const INC_DOCS_SOC = [['Contratos com clientes e fornecedores','cláusulas de mudança de controle e cessão'],['Licenças, alvarás e inscrições','transferibilidade e reemissão'],['Relação de funcionários e CCT','sucessão trabalhista'],['Contrato social/estatuto e quadro societário','atos, quóruns e direito de retirada'],['Imóveis, veículos, marcas e sistemas','transferência de titularidade'],['Estrutura operacional (unidades, estoques, sistemas)','integração operacional']];

// ── CSS de impressão do redesign + paisagem para os relatórios técnicos largos ──
function incPaginasPaisagem(blocos, cap){
  // paginador PRÓPRIO para A4 paisagem (o ppDocumento copiado do index é fixo em retrato, PP_CAP 26)
  const pags = []; let cur = '', usado = 0; const CAP = cap || 20;
  const fecha = () => { if (cur){ pags.push(cur); cur = ''; usado = 0; } };
  for (const b of blocos.filter(Boolean)){
    if (b.linhas){ const custoCab = (b.custoFixo||0) + 1; if (usado > 0 && usado + custoCab + 3 > CAP) fecha();
      cur += b.htmlFixo||''; usado += b.custoFixo||0; let aberta = false;
      const abrir = () => { cur += `<table class="pp-tab"${b.estilo?` style="${b.estilo}"`:''}><thead>${b.thead}</thead><tbody>`; usado += 1; aberta = true; };
      const fecharTb = () => { if (aberta){ cur += '</tbody></table>'; aberta = false; } };
      abrir(); for (const L of b.linhas){ const c = L.custo||1; if (usado + c > CAP){ fecharTb(); fecha(); abrir(); } cur += L.html; usado += c; } fecharTb();
    } else { const c = b.custo||2; if (usado > 0 && usado + c > CAP) fecha(); cur += b.html; usado += c; }
  }
  fecha();
  return pags.map((p, i) => `<div class="pp-page pp-land"><div class="pp-land-cab"><span>Artecon Artes Contábeis · Simulação de Incorporação</span><span>página ${i+1} de ${pags.length}</span></div><div class="pp-miolo">${p}</div></div>`).join('');
}
