// ══ v1.3.0 · CAMADA DE DECISÃO — cenários, indicadores, score, parecer e apresentação DE INCORPORAÇÃO ═══
//  Estrutura do documento (anexo "Relatório e Prompt — versão intermediária", relatórios 1,2,3,4,11,20):
//  capa → parecer executivo + indicadores + score → ranking dos cenários → antes × depois → carga tributária
//  consolidada e regimes → Reforma ano a ano → patrimônio e endividamento (SEM DADOS por decisão dele, 05/09)
//  → conclusões (tributária, financeira, patrimonial, Reforma, global) → premissas e memória de cálculo.
//  Regras do anexo aplicadas: nenhum número novo — tudo sai do motor lacrado (incSimular) e do motor da Reforma;
//  "acréscimo tributário" quando aumenta (nunca "economia negativa"); score explicável dimensão a dimensão;
//  "ANÁLISE INCOMPLETA" (sem conclusão definitiva) quando falta dado crítico ou há alerta de fronteira.
//  Cenários: 1 = separadas; 2 = A incorpora B (o que está em INC.res); 3 = B incorpora A — a MESMA consolidação
//  com a ordem invertida (cfg, ISS/ICMS do município e prejuízo fiscal da incorporadora mudam, o resto é soma).
const INC_SCORE_PESOS = { tributario: 0.6, reforma: 0.2, estabilidade: 0.2 };   // 30/10/10 do anexo, renormalizados sem patrimônio/dívida
const INC_SCORE_FAIXAS = [[90,'altamente favorável','ok'],[75,'favorável','ok'],[60,'moderadamente favorável','warn'],[40,'baixa atratividade','warn'],[0,'não recomendada','err']];
const INC_REGIME_NOME = { simples:'Simples Nacional', lp:'Lucro Presumido', lr:'Lucro Real' };
const incClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const incRegimesPermitidos = (sn) => (sn && sn.estado === 'elegivel') ? ['simples','lp','lr'] : ['lp','lr'];
const incMenor = (T, perm) => perm.slice().sort((a,b)=>T[a]-T[b])[0];

// ── indicadores de UM conjunto de resultado (isolada, soma das separadas ou consolidada) ──
function incIndic(T, sn, R){
  const perm = incRegimesPermitidos(sn), reg = incMenor(T, perm);
  const trib = T[reg], carga = T.receita > 0.005 ? trib / T.receita : 0;
  // lucro tributável (base IRPJ/CSLL do Lucro Real, conforme custos/despesas lançados) e resultado após tributos NO LUCRO REAL
  let baseLR = null, resLR = null;
  if (R && R.meses){ baseLR = R.meses.reduce((s,m)=>s+(+m.lr.baseIRCS||0),0); const ircs = R.meses.reduce((s,m)=>s+(+m.lr.irpj||0)+(+m.lr.csll||0)+(+m.lr.adicional||0),0); resLR = baseLR - ircs; if (Math.abs(baseLR) < 0.005) { baseLR = null; resLR = null; } }
  const anos = T.anos || {}, ys = Object.keys(anos).map(Number).sort();
  const melhorAno = a => { const x = anos[a]; if (!x) return null; const c = ['dentro','hib','regular'].filter(k => k !== 'dentro' || !x.snBloqueado); return c.map(k=>({k, v:x[k]})).sort((p,q)=>p.v-q.v)[0]; };
  const refAnos = ys.map(a => { const m = melhorAno(a); return { ano:a, cam: m ? m.k : null, v: m ? m.v : 0, deb: anos[a].deb, cred: anos[a].cred }; });
  return { perm, reg, regNome: INC_REGIME_NOME[reg], trib, carga, receita: T.receita, folha: T.folha, inss: T.inssPatr, baseLR, resLR,
           margemLR: (resLR != null && T.receita > 0.005) ? resLR / T.receita : null, refAnos, refAcum: refAnos.reduce((s,x)=>s+x.v,0) };
}
// ── por tributo: soma dos meses do regime escolhido ──
function incPorTributo(R, reg){
  const M = R.meses, s = k => M.reduce((a,m)=>a+(+m[reg][k]||0),0);
  if (reg === 'simples') return [['DAS (guia)', M.reduce((a,m)=>a+(+m.dasGuia||0),0)], ['ISS retido na fonte', s('issRetido')], ['CPP fora do DAS', s('inssPatrForaDAS')], ['FGTS', s('fgts')]];
  return [['IRPJ', s('irpj')], ['Adicional de IRPJ', s('adicional')], ['CSLL', s('csll')], ['PIS', s('pis')], ['COFINS', s('cofins')], ['ICMS', s('icms')], ['IPI', s('ipi')], ['ISS', s('iss')], ['INSS patronal', s('inssPatr')], ['FGTS', s('fgts')]];
}
// ── os cenários: 1 separadas · 2 A incorpora B (INC.res) · 3 B incorpora A (mesmo motor, ordem invertida) ──
function incCenarios(){
  const S = INC.res; if (!S || !S.consolidada) return null;
  const E = INC.entradas || { ano:S.ano, janela:'', empresas: S.empresas.map(e => ({ cnpj:e.cnpj, nome:e.nome, regime:e.regime, dados:e.dados, analiticos:{} })) };
  if (INC._cen && INC._cen.base === S) return INC._cen;
  const vivo = S.consolidada && S.consolidada.R && S.consolidada.R.meses;
  const S2 = vivo ? S : incSimular(E, INC.opts || { abatimentos: (S.abatidos||[]).map(a=>({ ...a })) });
  let S3 = null, erro3 = null;
  if (E.empresas.length === 2){
    try { const E3 = clone(E); E3.empresas = [E.empresas[1], E.empresas[0]].map(e => ({ ...e, dados: e.dados })); S3 = incSimular(E3, INC.opts || { abatimentos: (S.abatidos||[]).map(a=>({ ...a })) }); }
    catch(e){ erro3 = e.message; }
  }
  const iso = S2.empresas.map(e => ({ chave:e.cnpj, nome:e.nome, ind: incIndic(e.T, e.sn, e.R) }));
  const somaSn = { estado: S2.empresas.every(e => e.sn.estado === 'elegivel') ? 'elegivel' : 'nao' };
  const soma = incIndic(S2.soma, somaSn, null);
  // Reforma da soma: por ano, a soma do melhor caminho de cada isolada
  soma.refAnos = iso[0].ind.refAnos.map((x,i) => ({ ano:x.ano, cam:'soma', v: iso.reduce((s,e)=>s+((e.ind.refAnos[i]||{}).v||0),0) }));
  soma.refAcum = soma.refAnos.reduce((s,x)=>s+x.v,0);
  const cen = [{ n:1, nome:'Manter as empresas separadas', curto:'Separadas', ind: soma, res:null, sep:true }];
  const mk = (n, R_) => { const ind = incIndic(R_.consolidada.T, R_.consolidada.sn, R_.consolidada.R); return { n, nome:`${R_.empresas[0].nome} incorpora ${R_.empresas.slice(1).map(e=>e.nome).join(', ')}`, curto:`${R_.empresas[0].nome} → incorporadora`, ind, res:R_, sep:false, alertas:R_.alertas }; };
  cen.push(mk(2, S2)); if (S3) cen.push(mk(3, S3));
  cen.forEach(c => { if (!c.sep) c.score = incScore(c, cen[0]); });
  const rank = cen.filter(c=>!c.sep).slice().sort((a,b)=>b.score.total-a.score.total);
  // cenário 1 recebe score = 100 − melhor dos outros? Não: separadas é a referência (50 = neutro); fica explícito
  cen[0].score = { total: 50, cls:'neutro', rot:'referência (situação atual)', dims:{}, incompleta:false, motivos:['É a situação de partida: os demais cenários são medidos contra ela.'] };
  INC._cen = { base:S, iso, cen, rank, S2, S3, erro3, vivo: !!vivo };
  return INC._cen;
}
// ── score explicável: tributário (60) · Reforma (20) · estabilidade (20); patrimônio e dívida FORA (sem dados) ──
function incScore(c, sep){
  const dims = {}, motivos = [];
  const econ = sep.ind.trib - c.ind.trib, econRel = sep.ind.trib > 0.005 ? econ / sep.ind.trib : 0;
  dims.tributario = { nota: incClamp(50 + econRel * 500, 0, 100), peso: INC_SCORE_PESOS.tributario, formula: 'nota = 50 + 500 × (economia ÷ carga das separadas), limitada a 0–100 (10% de economia = 100; 10% de acréscimo = 0)', valor: econ, rel: econRel,
    texto: `${econ >= 0.5 ? 'Economia tributária' : (econ <= -0.5 ? 'Acréscimo tributário' : 'Neutralidade tributária')} de ${fmtR(Math.abs(econ))} ao ano (${fmtP(Math.abs(econRel)*100,1)}% da carga das separadas) no regime mais barato permitido de cada cenário (${sep.ind.regNome} × ${c.ind.regNome}).` };
  const rAcum = sep.ind.refAcum - c.ind.refAcum, rRel = sep.ind.refAcum > 0.005 ? rAcum / sep.ind.refAcum : 0;
  dims.reforma = { nota: incClamp(50 + rRel * 500, 0, 100), peso: INC_SCORE_PESOS.reforma, formula: 'mesma régua, sobre o acumulado 2027–2033 do melhor caminho de cada ano', valor: rAcum, rel: rRel,
    texto: `Na transição da Reforma (${c.ind.refAnos[0] ? c.ind.refAnos[0].ano : '—'}–${c.ind.refAnos.length ? c.ind.refAnos[c.ind.refAnos.length-1].ano : '—'}), ${rAcum >= 0.5 ? 'economia acumulada' : (rAcum <= -0.5 ? 'acréscimo acumulado' : 'neutralidade acumulada')} de ${fmtR(Math.abs(rAcum))}.` };
  // estabilidade: o sinal se mantém ano a ano? há alertas de fronteira (sublimite, limite, fator R, início de atividade)?
  const anos = c.ind.refAnos.map((x,i) => ({ ano:x.ano, econ: (sep.ind.refAnos[i]||{}).v - x.v }));
  const sinal = econ >= 0 ? 1 : -1, invert = anos.filter(a => (a.econ >= 0 ? 1 : -1) !== sinal).length;
  const nAl = (c.alertas||[]).length;
  dims.estabilidade = { nota: incClamp(100 - invert * 25 - nAl * 10, 0, 100), peso: INC_SCORE_PESOS.estabilidade, formula: 'nota = 100 − 25 por ano da transição em que o sinal (economia/acréscimo) se inverte − 10 por alerta de fronteira', invert, nAl,
    texto: invert || nAl ? `${invert ? invert + ' ano(s) da transição invertem o sinal do resultado de hoje' : 'O sinal se mantém em toda a transição'}${nAl ? '; ' + nAl + ' alerta(s) de fronteira (limite/sublimite do Simples, fator R, início de atividade)' : ''}.` : 'O sinal se mantém em toda a transição e não há alertas de fronteira.' };
  const total = Object.values(dims).reduce((s,d)=>s+d.nota*d.peso, 0);
  const fx = INC_SCORE_FAIXAS.find(f => total >= f[0]);
  const critico = !!(c.res && c.res.motorDefasado) || c.ind.receita < 0.005;
  const incompleta = critico || nAl > 0;
  if (critico) motivos.push('Dado crítico ausente ou motor defasado: conclusão bloqueada.');
  if (nAl) motivos.push('Há alertas de fronteira: a conclusão fica condicionada (status ANÁLISE INCOMPLETA para fins de recomendação definitiva).');
  motivos.push('Patrimônio e endividamento não avaliados (sem dados de balanço no sistema) — pesos redistribuídos entre tributário, Reforma e estabilidade.');
  return { total, cls: fx[2], rot: fx[1], dims, incompleta, motivos };
}
function incScoreHtml(sc, compacto){
  const cor = { ok:'var(--ok)', warn:'var(--warn)', err:'var(--err)', neutro:'var(--muted)' }[sc.cls] || 'var(--muted)';
  let h = `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div style="font-family:var(--display);font-size:${compacto?34:44}px;font-weight:700;color:${cor}">${Math.round(sc.total)}<span style="font-size:14px;color:var(--muted)"> / 100</span></div><div><b style="color:${sc.classe5 ? sc.classe5.cor : cor}">${esc(sc.classe5 ? sc.classe5.rot : sc.rot)}</b>${sc.classe5 ? (sc.classe5.motivos.length ? ' <span class="hint">(' + esc(sc.classe5.motivos.join('; ')) + ')</span>' : '') : (sc.incompleta ? ' · <span class="badge warn">ANÁLISE INCOMPLETA</span>' : '')}<div class="hint">tributário ${Math.round(INC_SCORE_PESOS.tributario*100)}% · Reforma ${Math.round(INC_SCORE_PESOS.reforma*100)}% · estabilidade ${Math.round(INC_SCORE_PESOS.estabilidade*100)}% · patrimônio e dívida: sem dados</div></div></div>`;
  if (!compacto && sc.dims && Object.keys(sc.dims).length) h += `<table class="pp-tabela" style="margin-top:8px"><thead><tr><th>Dimensão</th><th class="num">Nota</th><th class="num">Peso</th><th>Leitura</th></tr></thead><tbody>${Object.entries(sc.dims).map(([k,d])=>`<tr><td class="rot">${k}</td><td class="num">${Math.round(d.nota)}</td><td class="num">${Math.round(d.peso*100)}%</td><td>${d.texto}<div class="hint">${d.formula}</div></td></tr>`).join('')}</tbody></table>`;
  return h;
}
const incVar = (antes, depois, moeda=true) => { const d = depois - antes, p = Math.abs(antes) > 0.005 ? d/Math.abs(antes) : 0; return `<td class="num">${moeda?fmt(d):fmtP(d*100,2)+' p.p.'}</td><td class="num">${fmtP(p*100,1)}%</td>`; };

// v1.5.0: incParecerRender vive em src/incorporacao_app_6.js (Parecer Consolidado de Incorporação — 20 seções)
// textos padrão das seções novas (a IA pode sobrescrever cada chave)
function incTextosDecisao(CE){
  const sep = CE.cen[0], c2 = CE.cen[1], melhor = CE.rank[0], sc = c2.score, dT = sc.dims.tributario, dR = sc.dims.reforma;
  const ganho = v => v >= 0.5 ? 'economia' : (v <= -0.5 ? 'acréscimo tributário' : 'neutralidade');
  return {
    executivo: `A consolidação leva a carga anual de ${fmtR(sep.ind.trib)} (${fmtP(sep.ind.carga*100,2)}% da receita, separadas) para ${fmtR(c2.ind.trib)} (${fmtP(c2.ind.carga*100,2)}%) — ${ganho(dT.valor)} de ${fmtR(Math.abs(dT.valor))} ao ano. Na transição da Reforma (2027–2033), ${ganho(dR.valor)} acumulad${dR.valor >= 0.5 ? 'a' : 'o'} de ${fmtR(Math.abs(dR.valor))}. Score ${Math.round(sc.total)}/100: ${c2.classe ? c2.classe.rot : sc.rot}${c2.classe && c2.classe.motivos.length ? ' (' + c2.classe.motivos.join('; ') + ')' : ''}.`,
    ranking: CE.rank.length > 1 ? `O cenário "${melhor.nome}" fica à frente (${Math.round(melhor.score.total)} × ${Math.round(CE.rank[1].score.total)}) por ${Math.abs(melhor.ind.trib - CE.rank[1].ind.trib) > 0.5 ? 'pagar ' + fmtR(Math.abs(melhor.ind.trib - CE.rank[1].ind.trib)) + ' a menos por ano' : 'empatar na carga'}; a diferença entre os sentidos da incorporação vem da configuração, das alíquotas de ISS/ICMS e do prejuízo fiscal da incorporadora — a soma das receitas é a mesma.` : `Só o cenário "${c2.nome}" foi simulado além da situação atual${CE.erro3?'':' (a simulação em sentido inverso exige exatamente duas empresas)'}.`,
    antesDepois: `Receita, folha, exportação e base do Lucro Real da consolidada são a soma das empresas (menos as operações entre elas abatidas); o que muda é o cálculo dos tributos sobre essa soma: faixa e sublimite do Simples, RBT12, fator R e as alíquotas da incorporadora.`,
    carga: `Os tributos que explicam a diferença são os listados com maior Δ; no Simples, o efeito vem da faixa do RBT12 somado e do sublimite (ISS/ICMS por fora); no Presumido e no Real, da soma das bases com a alíquota da incorporadora e da absorção (ou perda) do prejuízo fiscal.`,
    regimes: `Regimes permitidos à consolidada: ${c2.ind.perm.map(k=>INC_REGIME_NOME[k]).join(', ')}. Menor carga: ${c2.ind.regNome}.${c2.ind.resLR != null ? ' Melhor resultado econômico medido (resultado após tributos no Lucro Real): ' + fmtR(c2.ind.resLR) + ', margem ' + fmtP((c2.ind.margemLR||0)*100,1) + '%.' : ' O resultado econômico por regime não foi medido: não há custos e despesas lançados na análise.'}`,
    reformaDecisao: `${dR.texto} ${sc.dims.estabilidade.texto}`,
    conclTrib: `${dT.texto}`,
    conclFin: c2.ind.resLR != null ? `Resultado após tributos no Lucro Real da consolidada de ${fmtR(c2.ind.resLR)} (margem ${fmtP((c2.ind.margemLR||0)*100,1)}%), contra ${fmtR(CE.iso.reduce((s,e)=>s+(e.ind.resLR||0),0))} nas separadas. Caixa e capacidade de pagamento não avaliados (sem dados).` : 'Não avaliada: não há custos, despesas e dados de caixa suficientes na análise para medir lucro, margem e capacidade de pagamento.',
    conclPatr: 'Não avaliada: o sistema não recebe balanço (ativo, passivo, patrimônio líquido, dívidas). Sem esta análise a recomendação não é definitiva.',
    conclReforma: dR.texto + (sc.dims.estabilidade.invert ? ' A vantagem de hoje se inverte em parte da transição.' : ' O sinal de hoje se mantém ao longo da transição.'),
    conclGlobal: `Cenário mais favorável, no que o sistema mede (tributos e Reforma): ${melhor.nome} — score ${Math.round(melhor.score.total)}/100${melhor.classe ? ', ' + melhor.classe.rot : ''}.${sc.incompleta?' A conclusão fica condicionada aos alertas de fronteira e':' Ressalva:'} patrimônio, endividamento, financeiro e societário não avaliados por ausência de dados suficientes — a recomendação é condicionada à validação dessas dimensões.`,
  };
}

// ── APRESENTAÇÃO DE INCORPORAÇÃO (simplificada 7 telas · completa 15 telas), telas 1280×720 do padrão ap-* ──
function incApresentar(modo){
  const M = incModelo();   // v1.5.0: as telas leem o mesmo modelo do Parecer Consolidado (classificação em 5 categorias, pendências, recomendação condicionada)
  const R = INC.res, E = R.empresas, inc = E[0], CE = M.CE, sep = CE.cen[0], c2 = CE.cen[1], melhor = CE.rank[0], sc = c2.score;
  const TX = M.TX;
  const razao = esc(inc.nome) + ' + ' + esc(E.slice(1).map(e=>e.nome).join(' + '));
  const hoje = new Date().toLocaleDateString('pt-BR'), fmtMi = v => fmtR(v);
  const cab = (t, mostra) => `<h1>${t}</h1><p class="ap-mostra">${mostra}</p>`;
  const resumo = (t, cls='') => `<div class="ap-resumo ${cls}"><b>Em resumo:</b> ${t}</div>`;
  const kpi = (v, rot, cls='') => `<div class="ap-cartao ${cls}"><div class="ap-num m ${cls}">${v}</div><div class="ap-rot">${rot}</div></div>`;
  const grade = itens => `<div class="ap-grade" style="display:grid;grid-template-columns:repeat(${Math.min(4,itens.length)},1fr);gap:14px">${itens.join('')}</div>`;
  const tabela = (cab_, linhas) => `<table class="pp-tabela" style="font-size:13px;width:100%"><thead><tr>${cab_.map(c=>`<th${/^[0-9R$%(]/.test(c)?' class="num"':''}>${c}</th>`).join('')}</tr></thead><tbody>${linhas.map(l=>`<tr>${l.map((c,i)=>`<td${i?' class="num"':' class="rot"'}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const dT = sc.dims.tributario, dR = sc.dims.reforma, ganho = v => v >= 0.5 ? 'economia' : (v <= -0.5 ? 'acréscimo' : 'neutro');
  const S = {};
  S.capa = () => ({ capa:true, html:`<img src="capa.jpg" class="ap-capa-img" onerror="this.style.display='none'"><div class="ap-capa-txt"><div><div class="ap-capa-lbl">Estudo de Incorporação</div><div class="ap-capa-nome">${esc(inc.nome)}</div><div class="ap-capa-sub">incorporação de ${esc(E.slice(1).map(e=>e.nome).join(', '))}<br>ano-base ${R.ano} · referência ${R.anoRef}</div></div><div><div class="ap-capa-modo">${modo==='simplificada'?'Apresentação simplificada — o essencial em 7 telas':'Apresentação completa — números, cenários e fundamentos em 15 telas'}</div><div class="ap-capa-rod">Artecon Artes Contábeis · Palhoça/SC · ${hoje}</div></div></div>` });
  S.pergunta = () => ({ html: cab('Vale a pena incorporar?', `Esta tela responde em <b>uma linha</b> o que o estudo mede: tributos de hoje, transição da Reforma e estabilidade. Patrimônio e dívida <b>não</b> entram (sem dados).`) + grade([kpi(Math.round(melhor.score.total)+'/100', esc(M.painel.classe.rot), M.painel.classe.cls==='neutro'?'':M.painel.classe.cls), kpi(fmtMi(Math.abs(M.painel.econ)), incLeit(M.painel.econ)+' tributário / ano', M.painel.econ<=-0.5?'ok':'warn'), kpi(fmtMi(Math.abs(M.painel.refD)), incLeit(M.painel.refD)+' acumulado na Reforma', M.painel.refD<=-0.5?'ok':'warn'), kpi(esc(melhor.curto), 'melhor cenário · ' + M.painel.nAlertas + ' alerta(s) · ' + M.painel.nPend + ' pendência(s)', 'ok')]) + resumo(TX.conclGlobal, M.painel.classe.cls==='neutro'?'':M.painel.classe.cls) });
  S.empresas = () => ({ html: cab('As empresas', `Situação de cada empresa no ano-base, pelo <b>regime mais barato permitido</b> a cada uma.`) + tabela(['Empresa','Receita','Tributos','Carga','Regime'], CE.iso.map(e=>[esc(e.nome), fmt(e.ind.receita), fmt(e.ind.trib), fmtP(e.ind.carga*100,2)+'%', e.ind.regNome]).concat([['<b>Separadas (soma)</b>', fmt(sep.ind.receita), fmt(sep.ind.trib), fmtP(sep.ind.carga*100,2)+'%', sep.ind.regNome]])) + resumo(TX.empresas) });
  S.antesDepois = () => ({ html: cab('Antes × depois', `O que muda quando as receitas, folha e compras passam a ser <b>uma empresa só</b>.`) + tabela(['Indicador','Separadas','Consolidada','Variação'], [['Receita', fmt(sep.ind.receita), fmt(c2.ind.receita), fmt(c2.ind.receita-sep.ind.receita)], ['Tributos (regime mais barato)', fmt(sep.ind.trib)+' · '+sep.ind.regNome, fmt(c2.ind.trib)+' · '+c2.ind.regNome, fmt(c2.ind.trib-sep.ind.trib)], ['Carga efetiva', fmtP(sep.ind.carga*100,2)+'%', fmtP(c2.ind.carga*100,2)+'%', fmtP((c2.ind.carga-sep.ind.carga)*100,2)+' p.p.'], ['Folha + INSS patronal', fmt(sep.ind.folha+sep.ind.inss), fmt(c2.ind.folha+c2.ind.inss), fmt(c2.ind.folha+c2.ind.inss-sep.ind.folha-sep.ind.inss)], ['Patrimônio · dívida · caixa', 'sem dados', 'sem dados', '—']]) + resumo(TX.antesDepois) });
  S.carga = () => { const cons = incPorTributo(R.consolidada.R, c2.ind.reg), iso = E.map(e=>incPorTributo(e.R, c2.ind.reg)); return { html: cab('Carga tributária consolidada — por tributo', `Regime ${c2.ind.regNome} nas duas colunas, para isolar o <b>efeito da consolidação</b>.`) + tabela(['Tributo','Separadas','Consolidada','Δ'], cons.map(([rot],i)=>{ const s = iso.reduce((a,l)=>a+l[i][1],0); return [rot, fmt(s), fmt(cons[i][1]), fmt(cons[i][1]-s)]; }).filter(l=>l[1]!==fmt(0)||l[2]!==fmt(0))) + resumo(TX.carga) }; };
  S.regimes = () => ({ html: cab('Qual regime para a consolidada?', `Só os <b>regimes permitidos</b>; menor carga e, quando há custos lançados, melhor resultado.`) + grade(['simples','lp','lr'].map(k => kpi(fmt(R.consolidada.T[k]), INC_REGIME_NOME[k] + (c2.ind.perm.includes(k)?'':' · não permitido'), k===c2.ind.reg?'ok':(c2.ind.perm.includes(k)?'':'warn')))) + resumo(TX.regimes) });
  S.reforma = () => ({ html: cab('A vantagem permanece na Reforma?', `Ano a ano, separadas × consolidada, pelo <b>melhor caminho</b> de cada ano; acumulado ao final.`) + `<div style="height:300px"><canvas id="inc-ap-ref"></canvas></div>` + resumo(TX.conclReforma, dR.valor>=0?'ok':'warn'), apos: () => rlChart('inc-ap-ref', { type:'line', data:{ labels:c2.ind.refAnos.map(x=>x.ano), datasets:[{ label:'Separadas', data:sep.ind.refAnos.map(x=>x.v), borderColor:'#1e8449', tension:.25 }, { label:'Consolidada', data:c2.ind.refAnos.map(x=>x.v), borderColor:'#2e86ab', tension:.25 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } } }) });
  S.reformaTab = () => ({ html: cab('Reforma — quadro ano a ano', `Débito e crédito de IBS/CBS da consolidada e a <b>economia ou acréscimo</b> de cada ano.`) + tabela(['Ano','Separadas','Consolidada','Débito IBS/CBS','Crédito','Economia / acréscimo'], c2.ind.refAnos.map((x,i)=>{ const s = sep.ind.refAnos[i].v; return [x.ano, fmt(s), fmt(x.v), fmt(x.deb||0), fmt(x.cred||0), (s-x.v>=0?'economia ':'acréscimo ')+fmt(Math.abs(s-x.v))]; })) + resumo(TX.reformaDecisao) });
  S.ranking = () => ({ html: cab('Ranking dos cenários', `Cada cenário pelo <b>score explicável</b>: tributário 60 · Reforma 20 · estabilidade 20.`) + tabela(['Cenário','Score','Classificação','Tributos/ano','Reforma acum.'], [melhor, ...CE.rank.filter(c=>c!==melhor), sep].map(c=>[esc(c.nome), Math.round(c.score.total), esc(c.score.rot), fmt(c.ind.trib), fmt(c.ind.refAcum)])) + resumo(TX.ranking) });
  S.score = () => ({ html: cab('Como o score foi calculado', `Nota por dimensão, peso e fórmula — <b>auditável</b>, nunca caixa-preta.`) + incScoreHtml(sc, false) });
  S.operacoes = () => ({ html: cab('Operações entre as empresas', `Vendas e serviços <b>entre</b> as empresas deixam de existir com a incorporação.`) + (R.abatidos.length ? tabela(['Vendeu → comprou','Natureza','Valor','Abatido'], R.abatidos.map(a=>[esc(a.deNome)+' → '+esc(a.paraNome), esc(a.natureza), fmt(a.valor), fmt(a.abatidoRec)])) : '<p class="ap-mostra">Nenhuma operação entre as empresas foi abatida.</p>') + resumo(R.abatidos.length ? 'Operações intragrupo abatidas da receita consolidada.' : 'Se houver vendas entre elas, o consolidado está superestimado.') });
  S.alertas = () => ({ html: cab('Alertas de fronteira', `Pontos em que a consolidada <b>encosta</b> em limite, sublimite, fator R ou início de atividade.`) + (R.alertas.length ? `<ul class="ap-lista">${R.alertas.slice(0,8).map(a=>`<li>${esc(a.t)}</li>`).join('')}</ul>` : '<p class="ap-mostra">Nenhum alerta de fronteira.</p>') + resumo(R.alertas.length ? 'Com alertas, a conclusão é condicionada — status ANÁLISE INCOMPLETA.' : 'Sem alertas: a conclusão vale nos limites das premissas.', R.alertas.length?'warn':'ok') });
  S.patrimonio = () => ({ html: cab('Patrimônio e endividamento', `O que este estudo <b>não</b> mede — e por quê.`) + `<div class="ap-cartao warn" style="padding:22px;font-size:16px;line-height:1.5">Sem dados de balanço no sistema: ativo, passivo, patrimônio líquido, dívidas, caixa. Liquidez, ROA, ROE, dívida líquida e dívida/EBITDA não foram calculados; o score não contempla estas dimensões. A decisão societária exige esta análise em separado.</div>` + resumo(TX.conclPatr, 'warn') });
  S.premissas = () => ({ html: cab('Premissas', `De onde vem cada número: análise gravada, configuração da incorporadora, meses projetados.`) + `<ul class="ap-lista">${R.premissas.slice(0,7).map(p=>`<li>${esc(p)}</li>`).join('')}</ul>` + resumo(TX.premissas) });
  S.conclusao = () => ({ escuro:true, html:`<div style="padding:70px 64px 0"><div class="ap-capa-lbl">Conclusão</div><h1 style="color:#fff;font-size:34px;margin:8px 0 22px">${esc(melhor.nome)}</h1><table style="width:100%;color:#dce6f0;font-size:15px;line-height:1.45"><tr><td style="width:150px;color:#9fb3c8;vertical-align:top;padding:6px 0">Tributária</td><td style="padding:6px 0">${TX.conclTrib}</td></tr><tr><td style="color:#9fb3c8;vertical-align:top;padding:6px 0">Reforma</td><td style="padding:6px 0">${TX.conclReforma}</td></tr><tr><td style="color:#9fb3c8;vertical-align:top;padding:6px 0">Financeira</td><td style="padding:6px 0">${TX.conclFin}</td></tr><tr><td style="color:#9fb3c8;vertical-align:top;padding:6px 0">Patrimonial</td><td style="padding:6px 0">${M.conclusoes.patrimonial}</td></tr><tr><td style="color:#9fb3c8;vertical-align:top;padding:6px 0">Societária</td><td style="padding:6px 0">${M.conclusoes.societaria}</td></tr><tr><td style="color:#9fb3c8;vertical-align:top;padding:6px 0"><b>Global</b></td><td style="padding:6px 0"><b>${TX.conclGlobal}</b></td></tr><tr><td style="color:#9fb3c8;vertical-align:top;padding:6px 0"><b>Recomendação</b></td><td style="padding:6px 0"><b>${esc(M.painel.classe.rot)}</b> — ${M.recomendacao}</td></tr></table><p style="color:#9fb3c8;font-size:12px;margin-top:18px">Ferramenta de apoio à decisão; a efetivação exige validações jurídicas, societárias, contábeis, fiscais e due diligence. Motor lacre ${R.motorLacre} · v${INC_VERSAO}</p></div>` });
  const ordem = modo === 'simplificada' ? ['capa','pergunta','antesDepois','carga','reforma','ranking','conclusao']
    : ['capa','pergunta','empresas','antesDepois','carga','regimes','reforma','reformaTab','ranking','score','operacoes','alertas','patrimonio','premissas','conclusao'];
  const telas = ordem.map(k => S[k]());
  const statusIA = INC._ia ? '🤖 Textos gerados pela IA em ' + esc(INC._ia.quando) : 'Textos padrão — gere os textos com IA no parecer para a apresentação usar a redação sob medida';
  let h = `<div class="ap-doc" id="ap-doc" data-modo="${modo}"><div class="card pp-tools ap-tools"><div class="toolbar" style="align-items:center"><span class="hint">${statusIA} · ${telas.length} telas · em tela cheia: Enter, espaço, setas ou clique avançam; Esc sai</span><span style="flex:1"></span><button class="btn solid" onclick="apApresentar()">▶ Apresentar (tela cheia)</button><button class="btn" onclick="window.print()" title="Destino = Salvar como PDF · Layout = Paisagem · Margens = Nenhuma · Cabeçalhos e rodapés DESLIGADOS · ativar Gráficos de segundo plano">🖨️ Imprimir / PDF</button></div></div>`;
  RL.empresa = { razao_social: inc.nome + ' + ' + E.slice(1).map(e=>e.nome).join(' + '), cnpj: inc.cnpj };   // apTimbrado lê RL.empresa
  telas.forEach((t,i)=>{
    const inner = t.capa ? t.html : (t.escuro ? t.html + `<div class="ap-rod"><div class="ap-linha claro"></div><div class="ap-rod-txt claro">Estudo de Incorporação · ${razao}</div><div class="ap-rod-pag claro" style="right:64px">${i+1} / ${telas.length}</div></div>` : apTimbrado(i+1, telas.length, modo).replace('Estudo de Impacto da Reforma Tributária', 'Estudo de Incorporação') + `<div class="ap-miolo">${t.html}</div>`);
    h += `<div class="ap-slide" data-i="${i}"><div class="ap-tela${t.escuro?' escuro':''}">${inner}</div></div>`;
  });
  h += `<div class="ap-nav no-print"><button type="button" onclick="apIr(-1);this.blur()" title="Anterior (←)">‹</button><span id="ap-nav-cont"></span><button type="button" onclick="apIr(1);this.blur()" title="Próxima (→, Enter, espaço ou clique)">›</button></div></div>`;
  $id('rl-corpo').innerHTML = h;
  telas.forEach(t => { if (t.apos) { try { t.apos(); } catch(e){ console.error('apresentação/gráfico', e); } } });
  apPrintCss(true);
  apAjustar();
}
