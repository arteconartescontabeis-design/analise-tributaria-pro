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
    texto: `${econ >= 0.5 ? 'Economia' : (econ <= -0.5 ? 'Acréscimo' : 'Neutralidade')} tributária de ${fmtR(Math.abs(econ))} ao ano (${fmtP(Math.abs(econRel)*100,1)}% da carga das separadas) no regime mais barato permitido de cada cenário (${sep.ind.regNome} × ${c.ind.regNome}).` };
  const rAcum = sep.ind.refAcum - c.ind.refAcum, rRel = sep.ind.refAcum > 0.005 ? rAcum / sep.ind.refAcum : 0;
  dims.reforma = { nota: incClamp(50 + rRel * 500, 0, 100), peso: INC_SCORE_PESOS.reforma, formula: 'mesma régua, sobre o acumulado 2027–2033 do melhor caminho de cada ano', valor: rAcum, rel: rRel,
    texto: `Na transição da Reforma (${c.ind.refAnos[0] ? c.ind.refAnos[0].ano : '—'}–${c.ind.refAnos.length ? c.ind.refAnos[c.ind.refAnos.length-1].ano : '—'}), ${rAcum >= 0.5 ? 'economia' : (rAcum <= -0.5 ? 'acréscimo' : 'neutralidade')} acumulada de ${fmtR(Math.abs(rAcum))}.` };
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
  let h = `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div style="font-family:var(--display);font-size:${compacto?34:44}px;font-weight:700;color:${cor}">${Math.round(sc.total)}<span style="font-size:14px;color:var(--muted)"> / 100</span></div><div><b style="color:${cor}">${esc(sc.rot)}</b>${sc.incompleta ? ' · <span class="badge warn">ANÁLISE INCOMPLETA</span>' : ''}<div class="hint">tributário ${Math.round(INC_SCORE_PESOS.tributario*100)}% · Reforma ${Math.round(INC_SCORE_PESOS.reforma*100)}% · estabilidade ${Math.round(INC_SCORE_PESOS.estabilidade*100)}% · patrimônio e dívida: sem dados</div></div></div>`;
  if (!compacto && sc.dims && Object.keys(sc.dims).length) h += `<table class="pp-tabela" style="margin-top:8px"><thead><tr><th>Dimensão</th><th class="num">Nota</th><th class="num">Peso</th><th>Leitura</th></tr></thead><tbody>${Object.entries(sc.dims).map(([k,d])=>`<tr><td class="rot">${k}</td><td class="num">${Math.round(d.nota)}</td><td class="num">${Math.round(d.peso*100)}%</td><td>${d.texto}<div class="hint">${d.formula}</div></td></tr>`).join('')}</tbody></table>`;
  return h;
}
const incVar = (antes, depois, moeda=true) => { const d = depois - antes, p = Math.abs(antes) > 0.005 ? d/Math.abs(antes) : 0; return `<td class="num">${moeda?fmt(d):fmtP(d*100,2)+' p.p.'}</td><td class="num">${fmtP(p*100,1)}%</td>`; };

// ── PARECER DE INCORPORAÇÃO (substitui o incParecerRender da v1.0) ──
function incParecerRender(){
  const R = INC.res, E = R.empresas, inc = E[0], C = R.consolidada.T, D = R.delta;
  const CE = incCenarios(), c2 = CE.cen[1], sep = CE.cen[0], c3 = CE.cen[2] || null, melhor = CE.rank[0];
  const TX = Object.assign(incTextosPadrao(R), incTextosDecisao(CE), (INC._ia && INC._ia.textos) || {});
  const hoje = new Date().toLocaleDateString('pt-BR');
  const statusIA = INC._ia ? `🤖 Textos gerados pela IA em ${INC._ia.quando}.` : (INC._iaErro ? `⚠️ A geração com IA falhou (${esc(INC._iaErro)}) — textos padrão do sistema.` : 'Textos padrão do sistema — clique em "Gerar textos com IA".');
  let h = `<div class="card pp-tools"><div class="toolbar" style="align-items:center"><span class="hint">${statusIA}</span><span style="flex:1"></span>
    <button class="btn" onclick="window.print()" title="Destino = Salvar como PDF · Margens = Nenhuma · Cabeçalhos e rodapés DESLIGADOS · Gráficos de segundo plano ligados">🖨️ Imprimir / PDF</button>
    <button class="btn solid" id="pp-ia-btn" onclick="incParecerIA()">🤖 Gerar textos com IA</button></div><div id="pp-regua"></div></div>`;
  h += `<div class="pp-page pp-capa"><img class="pp-bg" src="capa.jpg" onerror="this.style.display='none';this.parentNode.classList.add('pp-semarte')">
    <div class="pp-capa-cliente"><div class="pp-capa-lbl">Parecer de incorporação elaborado para</div>
      <div class="pp-capa-nome">${esc(inc.nome)}</div>
      <div class="pp-capa-cnpj">CNPJ ${fmtCNPJ(inc.cnpj)} · incorporação de ${esc(E.slice(1).map(e=>e.nome).join(', '))}</div>
      <div class="pp-capa-data">Ano-base ${R.ano} · ${hoje}</div></div></div>`;
  const sec = (n,t) => ({ html:`<h3 class="pp-sec">${n}. ${t}</h3>`, custo:2 });
  const par = t => ({ html:`<p class="pp-p">${t}</p>`, custo: Math.max(2, Math.ceil(String(t).length/420)) });
  const tab = (thead, linhas, custoFixo=0) => ({ thead, linhas, custoFixo });
  const tr = (rot, cels) => ({ html:`<tr><td class="rot">${rot}</td>${cels}</tr>`, custo:1 });
  const B = [];
  // 1. executivo
  B.push({ html:`<h3 class="pp-sec" style="margin-top:0">1. Parecer executivo</h3><div class="hint" style="margin-bottom:8px">${INC._ia?'Textos analíticos gerados com apoio de IA sobre os números calculados pelo sistema.':'Textos padrão do sistema — a redação analítica pode ser gerada com IA.'}</div>`, custo:4 }, par(TX.intro));
  B.push({ html: incScoreHtml(c2.score, false), custo: 12 });
  B.push(tab(`<tr><th>Indicador</th><th class="num">Separadas (soma)</th><th class="num">Consolidada</th><th class="num">Variação</th><th class="num">%</th></tr>`, [
    tr('Receita bruta', `<td class="num">${fmt(sep.ind.receita)}</td><td class="num">${fmt(c2.ind.receita)}</td>${incVar(sep.ind.receita, c2.ind.receita)}`),
    tr(`Tributos — regime mais barato permitido`, `<td class="num">${fmt(sep.ind.trib)}<br><span class="hint">${sep.ind.regNome}</span></td><td class="num">${fmt(c2.ind.trib)}<br><span class="hint">${c2.ind.regNome}</span></td>${incVar(sep.ind.trib, c2.ind.trib)}`),
    tr('Carga tributária efetiva', `<td class="num">${fmtP(sep.ind.carga*100,2)}%</td><td class="num">${fmtP(c2.ind.carga*100,2)}%</td>${incVar(sep.ind.carga*100, c2.ind.carga*100, false)}`),
    tr('Folha + INSS patronal', `<td class="num">${fmt(sep.ind.folha + sep.ind.inss)}</td><td class="num">${fmt(c2.ind.folha + c2.ind.inss)}</td>${incVar(sep.ind.folha+sep.ind.inss, c2.ind.folha+c2.ind.inss)}`),
    tr('Resultado após tributos no Lucro Real <span class="hint">(base IRPJ/CSLL − IRPJ/CSLL)</span>', c2.ind.resLR != null ? `<td class="num">${sep.ind.resLR != null ? fmt(sep.ind.resLR) : fmt(CE.iso.reduce((s,e)=>s+(e.ind.resLR||0),0))}</td><td class="num">${fmt(c2.ind.resLR)}</td>${incVar(CE.iso.reduce((s,e)=>s+(e.ind.resLR||0),0), c2.ind.resLR)}` : `<td class="num" colspan="4"><span class="hint">sem custos/despesas lançados — não calculado</span></td>`),
    tr('Reforma — acumulado 2027–2033 (melhor caminho de cada ano)', `<td class="num">${fmt(sep.ind.refAcum)}</td><td class="num">${fmt(c2.ind.refAcum)}</td>${incVar(sep.ind.refAcum, c2.ind.refAcum)}`),
    tr('Patrimônio líquido · Endividamento · Caixa', `<td colspan="4"><span class="hint">sem dados de balanço no sistema — não avaliados nesta versão</span></td>`),
  ]), par(TX.executivo));
  // 2. ranking
  B.push(sec(2,'Ranking dos cenários'), tab(`<tr><th>#</th><th>Cenário</th><th class="num">Score</th><th>Classificação</th><th class="num">Tributos/ano</th><th class="num">Carga</th><th class="num">Reforma acum.</th></tr>`,
    [melhor, ...CE.rank.filter(c=>c!==melhor), sep].map((c,i)=>({ html:`<tr${c===melhor?' style="background:#eaf2f8"':''}><td class="rot">${c.sep?'—':(i+1)}</td><td>${esc(c.nome)}${c.n===2?' <span class="hint">(cenário simulado)</span>':''}</td><td class="num"><b>${Math.round(c.score.total)}</b></td><td>${esc(c.score.rot)}${c.score.incompleta?' · <b>incompleta</b>':''}</td><td class="num">${fmt(c.ind.trib)}<br><span class="hint">${c.ind.regNome}</span></td><td class="num">${fmtP(c.ind.carga*100,2)}%</td><td class="num">${fmt(c.ind.refAcum)}</td></tr>`, custo:2 }))),
    par(TX.ranking), ...(CE.erro3 ? [par(`O cenário 3 (incorporação em sentido inverso) não pôde ser simulado: ${esc(CE.erro3)}.`)] : []));
  // 3. antes × depois
  B.push(sec(3,'Comparativo — antes × depois'), tab(`<tr><th>Indicador</th>${E.map(e=>`<th class="num">${esc(e.nome)}</th>`).join('')}<th class="num">Separadas</th><th class="num">Consolidada</th><th class="num">Δ R$</th><th class="num">Δ %</th></tr>`, [
    ['Receita bruta', e=>e.T.receita, sep.ind.receita, c2.ind.receita],
    ['Receita de exportação', e=>e.T.receitaExp, R.soma.receitaExp, C.receitaExp],
    ['Folha', e=>e.T.folha, R.soma.folha, C.folha],
    ['INSS patronal (LP/LR)', e=>e.T.inssPatr, R.soma.inssPatr, C.inssPatr],
    ['Simples Nacional', e=>e.T.simples, R.soma.simples, C.simples],
    ['Lucro Presumido', e=>e.T.lp, R.soma.lp, C.lp],
    ['Lucro Real', e=>e.T.lr, R.soma.lr, C.lr],
    ['Lucro tributável (base LR)', e=>{ const i = CE.iso.find(x=>x.chave===e.cnpj); return i && i.ind.baseLR != null ? i.ind.baseLR : null; }, CE.iso.reduce((s,e)=>s+(e.ind.baseLR||0),0), c2.ind.baseLR],
  ].map(([rot,f,s,c]) => c == null ? tr(rot, `<td colspan="${E.length+4}"><span class="hint">sem dados</span></td>`) : tr(rot, `${E.map(e=>`<td class="num">${fmt(f(e)||0)}</td>`).join('')}<td class="num">${fmt(s)}</td><td class="num"><b>${fmt(c)}</b></td>${incVar(s,c)}`))),
    par(TX.antesDepois), tr('', '').html ? { html:`<div class="hint">Ativo, passivo, patrimônio líquido e dívidas: sem dados no sistema — não comparados.</div>`, custo:2 } : null);
  // 4. carga tributária consolidada + regimes
  const porTrib = reg => { const cons = incPorTributo(R.consolidada.R, reg); const isoL = E.map(e => incPorTributo(e.R, reg)); return cons.map(([rot],i) => ({ rot, iso: isoL.map(l=>l[i][1]), soma: isoL.reduce((s,l)=>s+l[i][1],0), cons: cons[i][1] })); };
  const regComp = c2.ind.reg, regSep = sep.ind.reg;
  B.push(sec(4,'Carga tributária consolidada'), par(`Detalhamento por tributo no regime mais barato permitido da consolidada (${c2.ind.regNome})${regComp!==regSep?` — nas separadas o regime mais barato é ${sep.ind.regNome}; a comparação abaixo usa o mesmo regime nas duas colunas para isolar o efeito da consolidação`:''}.`),
    tab(`<tr><th>Tributo</th>${E.map(e=>`<th class="num">${esc(e.nome)}</th>`).join('')}<th class="num">Separadas</th><th class="num">Consolidada</th><th class="num">Δ R$</th><th class="num">Δ %</th></tr>`,
      porTrib(regComp).filter(x=>Math.abs(x.soma)+Math.abs(x.cons)>0.005).map(x=>tr(x.rot, `${x.iso.map(v=>`<td class="num">${fmt(v)}</td>`).join('')}<td class="num">${fmt(x.soma)}</td><td class="num"><b>${fmt(x.cons)}</b></td>${incVar(x.soma,x.cons)}`))
      .concat([tr('<b>Total</b>', `${E.map(e=>`<td class="num">${fmt(e.T[regComp])}</td>`).join('')}<td class="num">${fmt(R.soma[regComp])}</td><td class="num"><b>${fmt(C[regComp])}</b></td>${incVar(R.soma[regComp],C[regComp])}`)])),
    par(TX.carga));
  B.push(sec(5,'Comparativo por regime — consolidada'), tab(`<tr><th>Regime</th><th>Permitido?</th>${E.map(e=>`<th class="num">${esc(e.nome)}</th>`).join('')}<th class="num">Separadas</th><th class="num">Consolidada</th><th class="num">Carga</th><th class="num">Δ</th></tr>`,
    ['simples','lp','lr'].map(k => tr(INC_REGIME_NOME[k], `<td>${k!=='simples'||c2.ind.perm.includes('simples') ? 'sim' : 'não — ' + esc(R.consolidada.sn.estado||'')}</td>${E.map(e=>`<td class="num">${fmt(e.T[k])}</td>`).join('')}<td class="num">${fmt(R.soma[k])}</td><td class="num"><b>${fmt(C[k])}</b></td><td class="num">${fmtP((C.receita>0.005?C[k]/C.receita:0)*100,2)}%</td><td class="num">${incSinal(D[k].dif)}</td>`))),
    par(TX.regimes), par(TX.leitura));
  // 6. reforma
  const anos = Object.keys(D.anos).map(Number).sort();
  if (anos.length){
    let acS = 0, acC = 0;
    B.push(sec(6,'Reforma Tributária — separadas × consolidada, ano a ano'), tab(`<tr><th>Ano</th><th class="num">Separadas (melhor caminho)</th><th class="num">Consolidada (melhor caminho)</th><th class="num">Débito IBS/CBS</th><th class="num">Crédito IBS/CBS</th><th class="num">Líquido</th><th class="num">Economia / acréscimo</th><th class="num">Acumulado</th></tr>`,
      c2.ind.refAnos.map((x,i)=>{ const s = sep.ind.refAnos[i].v, d = s - x.v; acS += s; acC += x.v; return { html:`<tr${x.ano===R.anoRef?' style="background:#eaf2f8"':''}><td class="rot">${x.ano}${x.ano===R.anoRef?' ◀':''}</td><td class="num">${fmt(s)}</td><td class="num"><b>${fmt(x.v)}</b><br><span class="hint">${x.cam==='dentro'?'por dentro do Simples':x.cam==='hib'?'híbrido':'regime regular'}</span></td><td class="num">${fmt(x.deb||0)}</td><td class="num">${fmt(x.cred||0)}</td><td class="num">${fmt((x.deb||0)-(x.cred||0))}</td><td class="num">${d>=0?'<span style="color:var(--ok)">economia '+fmt(d)+'</span>':'<span style="color:var(--err)">acréscimo '+fmt(-d)+'</span>'}</td><td class="num">${fmt(acS-acC)}</td></tr>`, custo:2 }; })),
      par(TX.reforma), par(TX.reformaDecisao));
  }
  // 7. patrimônio e dívida — sem dados
  B.push(sec(7,'Patrimônio e endividamento consolidados'), { html:`<div class="pp-alerta"><b>Sem dados.</b> O sistema não recebe balanço (ativo, passivo, patrimônio líquido, dívidas). Liquidez, ROA, ROE, dívida líquida e dívida/EBITDA não foram calculados e o score não contempla estas dimensões. A conclusão global fica restrita ao efeito tributário e da Reforma; a decisão societária exige a análise patrimonial e de endividamento em separado.</div>`, custo:6 });
  // 8. operações, premissas, alertas (mantidos da v1.0)
  if (R.abatidos.length) B.push(sec(8,'Operações entre as empresas'), tab(`<tr><th>Vendeu → comprou</th><th>Natureza</th><th class="num">Valor</th><th class="num">Abatido da receita</th><th>Fonte</th></tr>`, R.abatidos.map(a=>({ html:`<tr><td class="rot">${esc(a.deNome)} → ${esc(a.paraNome)}</td><td>${esc(a.natureza)}</td><td class="num">${fmt(a.valor)}</td><td class="num">${fmt(a.abatidoRec)}</td><td>${esc(a.fonte||'')}</td></tr>`, custo:1 }))));
  else B.push(sec(8,'Operações entre as empresas'), par('Nenhuma operação entre as empresas foi abatida; se houver vendas ou serviços entre elas, o resultado consolidado está superestimado na receita e no crédito.'));
  if (R.alertas.length) B.push(sec(9,'Alertas de fronteira'), { html:`<div class="pp-alerta"><ul style="margin:6px 0 0 18px">${R.alertas.map(a=>`<li>${esc(a.t)}</li>`).join('')}</ul></div>`, custo: 2 + R.alertas.length*2 });
  // 10. conclusões
  B.push(sec(10,'Conclusões'), tab(`<tr><th>Dimensão</th><th>Conclusão</th></tr>`, [
    tr('Tributária', `<td>${TX.conclTrib}</td>`), tr('Financeira', `<td>${TX.conclFin}</td>`), tr('Patrimonial', `<td>${TX.conclPatr}</td>`), tr('Reforma Tributária', `<td>${TX.conclReforma}</td>`),
    tr('<b>Global</b>', `<td><b>${TX.conclGlobal}</b></td>`) ]), par(TX.parecer1), par(TX.parecer2), { html:`<div class="pp-final"><b>Recomendação:</b> ${TX.recomendacao}</div>`, custo:4 });
  // 11. premissas e memória
  B.push(sec(11,'Premissas e memória de cálculo'), { html:`<ul class="pp-p" style="margin-left:18px">${R.premissas.concat(R.notas).map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`, custo: 2 + R.premissas.length + R.notas.length }, par(TX.premissas),
    par(`Memória de cálculo: cada número deste parecer sai do motor do Análise Tributária Pro (lacre ${R.motorLacre}, ${R.motorDefasado?'DEFASADO em relação ao index':'igual ao do index em produção'}) aplicado à análise gravada de cada empresa e à análise consolidada; a memória mês a mês está no relatório "Conferência de cálculos" (Consolidada · Incorporadora · Incorporada). Score: ${Object.entries(c2.score.dims).map(([k,d])=>`${k} ${Math.round(d.nota)} × ${Math.round(d.peso*100)}%`).join(' + ')} = ${Math.round(c2.score.total)}. Cenário 3 = mesma consolidação com a ordem invertida (configuração, ISS/ICMS e prejuízo fiscal da incorporadora). Dado histórico = análise gravada; premissa = configuração da incorporadora; projetado = meses estimados pela janela de projeção.`));
  const esc_ = PARAMS.escritorio || {};
  B.push({ html:`<div class="hint" style="margin-top:14px">Simulação de Incorporação v${INC_VERSAO} · motor do Análise Tributária Pro (lacre ${R.motorLacre}) · calculado em ${new Date(R.calculadoEm).toLocaleString('pt-BR')}${INC.salvo?' · simulação nº '+INC.salvo.id:''}. Ferramenta de apoio à decisão econômica, contábil, financeira e tributária, com base nos dados e premissas informados; a efetivação de reorganizações societárias deve ser precedida das validações jurídicas, societárias, contábeis, fiscais e de due diligence aplicáveis. Não substitui a apuração oficial.</div>
    <div style="margin-top:28px;border-top:1px solid #999;width:280px;padding-top:6px;font-size:12px">${esc(esc_.respNome||'Responsável técnico')}<br>${esc(esc_.respQualif||'Contador')}${esc_.respCRC?' · CRC '+esc(esc_.respCRC):''}<br>Artecon Artes Contábeis</div>`, custo:8 });
  h += ppDocumento(B.filter(Boolean));
  $id('rl-corpo').innerHTML = h;
  setTimeout(() => { try { ppReguaRender(); } catch(e){ console.error('régua', e); } }, 350);
}
// textos padrão das seções novas (a IA pode sobrescrever cada chave)
function incTextosDecisao(CE){
  const sep = CE.cen[0], c2 = CE.cen[1], melhor = CE.rank[0], sc = c2.score, dT = sc.dims.tributario, dR = sc.dims.reforma;
  const ganho = v => v >= 0.5 ? 'economia' : (v <= -0.5 ? 'acréscimo tributário' : 'neutralidade');
  return {
    executivo: `A consolidação leva a carga anual de ${fmtR(sep.ind.trib)} (${fmtP(sep.ind.carga*100,2)}% da receita, separadas) para ${fmtR(c2.ind.trib)} (${fmtP(c2.ind.carga*100,2)}%) — ${ganho(dT.valor)} de ${fmtR(Math.abs(dT.valor))} ao ano. Na transição da Reforma, ${ganho(dR.valor)} acumulada de ${fmtR(Math.abs(dR.valor))}. Score ${Math.round(sc.total)}/100: ${sc.rot}${sc.incompleta?' — análise incompleta (há alertas de fronteira ou faltam dados)':''}.`,
    ranking: CE.rank.length > 1 ? `O cenário "${melhor.nome}" fica à frente (${Math.round(melhor.score.total)} × ${Math.round(CE.rank[1].score.total)}) por ${Math.abs(melhor.ind.trib - CE.rank[1].ind.trib) > 0.5 ? 'pagar ' + fmtR(Math.abs(melhor.ind.trib - CE.rank[1].ind.trib)) + ' a menos por ano' : 'empatar na carga'}; a diferença entre os sentidos da incorporação vem da configuração, das alíquotas de ISS/ICMS e do prejuízo fiscal da incorporadora — a soma das receitas é a mesma.` : `Só o cenário "${c2.nome}" foi simulado além da situação atual${CE.erro3?'':' (a simulação em sentido inverso exige exatamente duas empresas)'}.`,
    antesDepois: `Receita, folha, exportação e base do Lucro Real da consolidada são a soma das empresas (menos as operações entre elas abatidas); o que muda é o cálculo dos tributos sobre essa soma: faixa e sublimite do Simples, RBT12, fator R e as alíquotas da incorporadora.`,
    carga: `Os tributos que explicam a diferença são os listados com maior Δ; no Simples, o efeito vem da faixa do RBT12 somado e do sublimite (ISS/ICMS por fora); no Presumido e no Real, da soma das bases com a alíquota da incorporadora e da absorção (ou perda) do prejuízo fiscal.`,
    regimes: `Regimes permitidos à consolidada: ${c2.ind.perm.map(k=>INC_REGIME_NOME[k]).join(', ')}. Menor carga: ${c2.ind.regNome}.${c2.ind.resLR != null ? ' Melhor resultado econômico medido (resultado após tributos no Lucro Real): ' + fmtR(c2.ind.resLR) + ', margem ' + fmtP((c2.ind.margemLR||0)*100,1) + '%.' : ' O resultado econômico por regime não foi medido: não há custos e despesas lançados na análise.'}`,
    reformaDecisao: `${dR.texto} ${sc.dims.estabilidade.texto}`,
    conclTrib: `${dT.texto}`,
    conclFin: c2.ind.resLR != null ? `Resultado após tributos no Lucro Real da consolidada de ${fmtR(c2.ind.resLR)} (margem ${fmtP((c2.ind.margemLR||0)*100,1)}%), contra ${fmtR(CE.iso.reduce((s,e)=>s+(e.ind.resLR||0),0))} nas separadas. Caixa e capacidade de pagamento não avaliados (sem dados).` : 'Não avaliada: não há custos, despesas e dados de caixa suficientes na análise para medir lucro, margem e capacidade de pagamento.',
    conclPatr: 'Não avaliada: o sistema não recebe balanço (ativo, passivo, patrimônio líquido, dívidas). Sem esta análise a recomendação não é definitiva.',
    conclReforma: dR.texto + (sc.dims.estabilidade.invert ? ' A vantagem de hoje se inverte em parte da transição.' : ' O sinal de hoje se mantém ao longo da transição.'),
    conclGlobal: `Cenário recomendado, no que o sistema mede (tributos e Reforma): ${melhor.nome} — score ${Math.round(melhor.score.total)}/100, ${melhor.score.rot}.${sc.incompleta?' STATUS: ANÁLISE INCOMPLETA — conclusão condicionada aos alertas e à análise patrimonial/de endividamento.':' Ressalva: patrimônio e endividamento não avaliados.'}`,
  };
}

// ── APRESENTAÇÃO DE INCORPORAÇÃO (simplificada 7 telas · completa 15 telas), telas 1280×720 do padrão ap-* ──
function incApresentar(modo){
  const R = INC.res, E = R.empresas, inc = E[0], CE = incCenarios(), sep = CE.cen[0], c2 = CE.cen[1], melhor = CE.rank[0], sc = c2.score;
  const TX = Object.assign(incTextosPadrao(R), incTextosDecisao(CE), (INC._ia && INC._ia.textos) || {});
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
  S.pergunta = () => ({ html: cab('Vale a pena incorporar?', `Esta tela responde em <b>uma linha</b> o que o estudo mede: tributos de hoje, transição da Reforma e estabilidade. Patrimônio e dívida <b>não</b> entram (sem dados).`) + grade([kpi(Math.round(sc.total)+'/100', 'score — '+esc(sc.rot), sc.cls==='err'?'warn':sc.cls), kpi(fmtMi(Math.abs(dT.valor)), ganho(dT.valor)+' tributário / ano', dT.valor>=0?'ok':'warn'), kpi(fmtMi(Math.abs(dR.valor)), ganho(dR.valor)+' acumulado na Reforma', dR.valor>=0?'ok':'warn'), kpi(esc(melhor.curto), 'melhor cenário', 'ok')]) + resumo(TX.conclGlobal, sc.cls==='err'?'warn':sc.cls) });
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
  S.conclusao = () => ({ escuro:true, html:`<div style="padding:70px 64px 0"><div class="ap-capa-lbl">Conclusão</div><h1 style="color:#fff;font-size:34px;margin:8px 0 22px">${esc(melhor.nome)}</h1><table style="width:100%;color:#dce6f0;font-size:15px;line-height:1.45"><tr><td style="width:150px;color:#9fb3c8;vertical-align:top;padding:6px 0">Tributária</td><td style="padding:6px 0">${TX.conclTrib}</td></tr><tr><td style="color:#9fb3c8;vertical-align:top;padding:6px 0">Reforma</td><td style="padding:6px 0">${TX.conclReforma}</td></tr><tr><td style="color:#9fb3c8;vertical-align:top;padding:6px 0">Financeira</td><td style="padding:6px 0">${TX.conclFin}</td></tr><tr><td style="color:#9fb3c8;vertical-align:top;padding:6px 0">Patrimonial</td><td style="padding:6px 0">${TX.conclPatr}</td></tr><tr><td style="color:#9fb3c8;vertical-align:top;padding:6px 0"><b>Global</b></td><td style="padding:6px 0"><b>${TX.conclGlobal}</b></td></tr></table><p style="color:#9fb3c8;font-size:12px;margin-top:18px">Ferramenta de apoio à decisão; a efetivação exige validações jurídicas, societárias, contábeis, fiscais e due diligence. Motor lacre ${R.motorLacre} · v${INC_VERSAO}</p></div>` });
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
