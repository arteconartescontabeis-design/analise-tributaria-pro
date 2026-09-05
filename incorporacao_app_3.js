// ══ CÁLCULO E TELA ═════════════════════════════════════════════════════════════════════════
function incCalcular(){
  if (!INC.entradas){ toast('Importe os dados primeiro.'); return; }
  try {
    INC.res = incSimular(INC.entradas, INC.prem);
    INC._ia = null; INC._iaErro = null;
    incRender();
    $id('inc-btn-recalcular').disabled = false;
    $id('inc-card-parecer').style.display = 'none';
    toast('Simulação calculada.');
  } catch(e){ console.error('incCalcular', e); alert('Falha ao calcular: ' + (e.message||e)); }
}
function incRender(){
  const R = INC.res; if (!R) return;
  $id('inc-resultado').style.display = 'block';
  $id('inc-res-sub').textContent = `— ${R.empresas.map(e=>e.nome).join(' + ')} · ano ${R.ano} · calculado em ${new Date(R.calculadoEm).toLocaleString('pt-BR')} · motor ${R.motorLacre}${R.motorDefasado?' (DEFASADO em relação ao index)':''}`;
  $id('inc-res-status').innerHTML = INC.salvo ? `Gravada em ${new Date(INC.salvo.criado_em||Date.now()).toLocaleString('pt-BR')} (nº ${INC.salvo.id}).` : 'Ainda não gravada.';
  const AL = R.alertas;
  $id('inc-alertas').innerHTML = AL.length ? AL.map(a => `<div style="border-left:4px solid ${a.n==='err'?'var(--err)':a.n==='warn'?'var(--warn)':'var(--primary-light)'};background:${a.n==='err'?'var(--err-bg)':a.n==='warn'?'var(--warn-bg)':'var(--info-bg)'};padding:8px 12px;border-radius:0 8px 8px 0;margin-bottom:6px;font-size:13px">${esc(a.t)}</div>`).join('') : '';
  $id('inc-quadro').innerHTML = incQuadroHtml(R);
  $id('inc-reforma').innerHTML = incReformaHtml(R);
  $id('inc-memoria').innerHTML = incMemoriaHtml(R);
}
const incSinal = v => v > 0.5 ? `<span style="color:var(--err)">+${fmt(v)}</span>` : v < -0.5 ? `<span style="color:var(--ok)">${fmt(v)}</span>` : fmt(0);
function incQuadroHtml(R){
  const E = R.empresas, C = R.consolidada.T, So = R.soma, D = R.delta;
  const cab = `<tr><th></th>${E.map(e=>`<th class="num" title="${fmtCNPJ(e.cnpj)}">${esc(e.nome)}${e.P?' <span class="hint">(proj.)</span>':''}</th>`).join('')}<th class="num">Soma (separadas)</th><th class="num">Consolidada</th><th class="num">Δ R$</th><th class="num">Δ %</th></tr>`;
  const lin = (rot, k, f) => `<tr><td class="rot">${rot}</td>${E.map(e=>`<td class="num">${fmt(f?f(e.T):e.T[k])}</td>`).join('')}<td class="num">${fmt(f?f(So):So[k])}</td><td class="num"><b>${fmt(f?f(C):C[k])}</b></td>${D[k]?`<td class="num">${incSinal(D[k].dif)}</td><td class="num">${D[k].soma?fmtP(D[k].pct*100,1)+'%':'—'}</td>`:'<td></td><td></td>'}</tr>`;
  const snTxt = R.consolidada.sn.estado!=='elegivel' ? ` <span class="badge" style="background:var(--err);color:#fff">Simples ${R.consolidada.sn.estado==='inelegivel'?'inelegível':'em transição'}</span>` : '';
  return `<h3 style="margin-top:14px">Regimes de hoje — ano ${R.ano}${snTxt}</h3>
    <div class="hint" style="margin-bottom:6px">Todas as colunas no ano cheio (empresas com ano incompleto projetadas individualmente). Δ = consolidada − soma das separadas: positivo é custo da incorporação, negativo é ganho.</div>
    <table class="gtable"><thead>${cab}</thead><tbody>
    ${lin('Receita bruta','receita')}
    ${lin('&nbsp;&nbsp;exportação','receitaExp')}
    ${lin('Folha (salários + pró-labore)','folha')}
    ${lin('<b>Simples Nacional</b> (DAS + trava + CPP fora)','simples')}
    ${lin('&nbsp;&nbsp;DAS','das')}
    ${lin('&nbsp;&nbsp;trava da 5ª faixa (ICMS/ISS)','trava')}
    ${lin('<b>Lucro Presumido</b>','lp')}
    ${lin('&nbsp;&nbsp;adicional de IRPJ','adicionalLP')}
    ${lin('<b>Lucro Real</b>','lr')}
    ${lin('&nbsp;&nbsp;adicional de IRPJ','adicionalLR')}
    ${lin('RBT12 máximo do ano','rbt12Max')}
    <tr><td class="rot">Faixa do Simples (dez)</td>${E.map(e=>`<td class="num">${e.T.faixaDez??'—'}</td>`).join('')}<td class="num">—</td><td class="num"><b>${C.faixaDez??'—'}</b></td><td></td><td></td></tr>
    <tr><td class="rot">Fator R médio</td>${E.map(e=>`<td class="num">${fmtP(e.T.fatorRMedio*100,1)}%</td>`).join('')}<td class="num">—</td><td class="num"><b>${fmtP(C.fatorRMedio*100,1)}%</b></td><td></td><td></td></tr>
    </tbody></table>`;
}
function incReformaHtml(R){
  const C = R.consolidada.T.anos, So = R.soma.anos, D = R.delta.anos;
  const anos = Object.keys(C).map(Number).filter(a=>a>=2027).sort();
  if (!anos.length) return '';
  const cel = (a,k) => { const d = D[a][k]; return `<td class="num">${fmt(d.soma)}</td><td class="num"><b>${fmt(d.cons)}</b></td><td class="num">${incSinal(d.dif)}</td>`; };
  return `<h3 style="margin-top:18px">Reforma Tributária — soma das separadas × consolidada, ano a ano</h3>
    <div class="hint" style="margin-bottom:6px">Três caminhos: Simples por dentro (DAS com a trava), híbrido (art. 22-A da Res. CGSN 190 — IBS/CBS fora do DAS) e regime regular (melhor entre Presumido e Real com IBS/CBS). Ano de referência do parecer: <b>${R.anoRef}</b>.</div>
    <table class="gtable"><thead><tr><th rowspan="2">Ano</th><th colspan="3" style="text-align:center">Simples por dentro</th><th colspan="3" style="text-align:center">Híbrido</th><th colspan="3" style="text-align:center">Regime regular</th><th rowspan="2">Melhor caminho<br><span class="hint">soma → consolidada</span></th></tr>
    <tr>${['Soma','Consol.','Δ','Soma','Consol.','Δ','Soma','Consol.','Δ'].map(x=>`<th class="num">${x}</th>`).join('')}</tr></thead><tbody>
    ${anos.map(a => `<tr${a===R.anoRef?' style="background:var(--info-bg)"':''}><td class="rot">${a}${C[a].snBloqueado?' <span title="'+esc(C[a].snMotivo||'')+'">🚫</span>':''}</td>${cel(a,'dentro')}${cel(a,'hib')}${cel(a,'regular')}<td>${INC_CAM_ROT[incMelhor(So[a])]} → <b>${INC_CAM_ROT[incMelhor(C[a])]}</b></td></tr>`).join('')}
    </tbody></table>`;
}
function incMemoriaToggle(){ const m = $id('inc-memoria'); m.style.display = m.style.display==='none' ? 'block' : 'none'; }
function incMemoriaHtml(R){
  const C = R.consolidada, M = C.R.meses, d = C.dados;
  const recMes = m => PROJ_KREC.reduce((s,k)=>s+(+d.receitas[k][m]||0),0);
  let h = `<h3 style="margin-top:18px">Memória de cálculo</h3>
    <div style="font-weight:700;color:var(--primary);margin:8px 0 4px">0. Premissas</div><ul style="margin:0 0 8px 18px;font-size:13px">${R.premissas.map(p=>`<li>${esc(p)}</li>`).join('')}${R.notas.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`;
  if (R.abatidos.length) h += `<div style="font-weight:700;color:var(--primary);margin:8px 0 4px">0b. Operações entre as empresas abatidas</div><table class="gtable"><thead><tr><th>Vendeu → comprou</th><th>Natureza</th><th class="num">Informado</th><th class="num">Abatido da receita</th><th class="num">Abatido de compras/despesas</th><th>Rateio mensal</th></tr></thead><tbody>${R.abatidos.map(a=>`<tr><td>${esc(a.deNome)} → ${esc(a.paraNome)}</td><td>${a.natureza}</td><td class="num">${fmt(a.valor)}</td><td class="num">${fmt(a.abatidoRec)}</td><td class="num">${fmt(a.abatidoDest)}</td><td class="hint">${a.porMes.map((v,m)=>v?MESES[m]+' '+fmt(v):'').filter(Boolean).join(' · ')}</td></tr>`).join('')}</tbody></table>`;
  h += `<div style="font-weight:700;color:var(--primary);margin:12px 0 4px">1. Receita mensal por empresa e consolidada (após abatimentos)</div>
    <table class="gtable"><thead><tr><th>Mês</th>${R.empresas.map(e=>`<th class="num">${esc(e.nome)}</th>`).join('')}<th class="num">Consolidada</th></tr></thead><tbody>
    ${MESES.map((m,i)=>`<tr><td class="rot">${m}${R.empresas.some(e=>e.P&&i>e.P.ultimo)?' <span class="hint">est.</span>':''}</td>${R.empresas.map(e=>`<td class="num">${fmt(+e.R.meses[i].receita||0)}</td>`).join('')}<td class="num"><b>${fmt(recMes(i))}</b></td></tr>`).join('')}</tbody></table>`;
  h += `<div style="font-weight:700;color:var(--primary);margin:12px 0 4px">2. Consolidada mês a mês — Simples</div>
    <table class="gtable"><thead><tr><th>Mês</th><th class="num">RBT12</th><th class="num">Faixa</th><th class="num">Fator R</th><th class="num">Receita</th><th class="num">DAS</th><th class="num">Trava ICMS/ISS</th><th class="num">Simples total</th><th class="num">Presumido</th><th class="num">Real</th></tr></thead><tbody>
    ${M.map((x,i)=>`<tr><td class="rot">${MESES[i]}</td><td class="num">${fmt(x.rbt12)}</td><td class="num">${x.faixa??'—'}</td><td class="num">${x.fatorR!=null?fmtP(x.fatorR*100,1)+'%':'—'}</td><td class="num">${fmt(x.receita)}</td><td class="num">${fmt(x.das)}</td><td class="num">${fmt((x.subIcms||0)+(x.subIss||0))}</td><td class="num">${fmt(x.simples.total)}</td><td class="num">${fmt(x.lp.total)}</td><td class="num">${fmt(x.lr.total)}</td></tr>`).join('')}
    <tr style="font-weight:700"><td>Total</td><td></td><td></td><td></td><td class="num">${fmt(somaExib(M,x=>x.receita))}</td><td class="num">${fmt(somaExib(M,x=>x.das))}</td><td class="num">${fmt(somaExib(M,x=>(x.subIcms||0)+(x.subIss||0)))}</td><td class="num">${fmt(somaExib(M,x=>x.simples.total))}</td><td class="num">${fmt(somaExib(M,x=>x.lp.total))}</td><td class="num">${fmt(somaExib(M,x=>x.lr.total))}</td></tr>
    </tbody></table><div class="hint">${NOTA_SOMA} Janelas: RBT12 lançado da consolidada = ${fmtR(S(d.cfg.rbt12Lanc))} (soma) · folha do Fator R = ${fmtR(S(d.cfg.folha12Lanc))}.</div>`;
  return h;
}

// ══ GRAVAÇÃO / HISTÓRICO (tabela própria atp_incorporacoes — nada em atp_analises) ═════════
function incSnapshot(){
  const R = INC.res;
  // guarda o que é preciso para REEXIBIR sem recalcular: entradas (cópia), premissas e o resultado enxuto
  const enx = e => ({ cnpj:e.cnpj, nome:e.nome, regime:e.regime, incorporadora:e.incorporadora, T:e.T, sn:{estado:e.sn.estado, rbtMax:e.sn.rbtMax, teto:e.sn.teto}, P: e.P ? { nReais:e.P.nReais, nProj:e.P.nProj, janela:e.P.janela, ultimo:e.P.ultimo } : null,
                      meses: e.R.meses.map(x=>({ receita:x.receita, rbt12:x.rbt12, faixa:x.faixa, fatorR:x.fatorR, das:x.das, sub:(x.subIcms||0)+(x.subIss||0), simples:x.simples.total, lp:x.lp.total, lr:x.lr.total })) });
  return { versao: INC_VERSAO, motorLacre: R.motorLacre, motorDefasado: R.motorDefasado, calculadoEm: R.calculadoEm, ano: R.ano, anoRef: R.anoRef,
    empresas: R.empresas.map(enx), soma: R.soma, delta: R.delta, alertas: R.alertas, premissas: R.premissas, notas: R.notas, abatidos: R.abatidos, projetadas: R.projetadas,
    consolidada: { T:R.consolidada.T, sn:{estado:R.consolidada.sn.estado, rbtMax:R.consolidada.sn.rbtMax, teto:R.consolidada.sn.teto}, dados: R.consolidada.dados, reforma: R.consolidada.reforma,
      meses: R.consolidada.R.meses.map(x=>({ receita:x.receita, rbt12:x.rbt12, faixa:x.faixa, fatorR:x.fatorR, das:x.das, sub:(x.subIcms||0)+(x.subIss||0), simples:x.simples.total, lp:x.lp.total, lr:x.lr.total })) },
    ia: INC._ia || null };
}
async function incSalvar(){
  if (!INC.res || !INC.entradas){ toast('Calcule antes de gravar.'); return; }
  const E = INC.entradas;
  const body = { ano: E.ano, cnpj_incorporadora: E.empresas[0].cnpj, cnpjs_incorporadas: E.empresas.slice(1).map(e=>e.cnpj),
    titulo: E.empresas.map(e=>e.nome).join(' + '),
    entradas: { importadoEm: E.importadoEm, janela: E.janela, chave: E.chave, empresas: E.empresas.map(e=>({ cnpj:e.cnpj, nome:e.nome, regime:e.regime, atualizadoEm:e.atualizadoEm, status:e.status, dados:e.dados, analiticos:e.analiticos })) },
    premissas: clone(INC.prem), snapshot: incSnapshot() };
  try {
    const r = await supa('POST', INC_TABELA, { body, params:{ select:'id,criado_em' }, returning:true });
    const reg = Array.isArray(r) ? r[0] : r;
    INC.salvo = { id: reg?.id, criado_em: reg?.criado_em || new Date().toISOString(), _chave: E.chave };
    toast('Simulação gravada (nº ' + (reg?.id ?? '?') + ').');
    $id('inc-res-status').innerHTML = `Gravada em ${new Date(INC.salvo.criado_em).toLocaleString('pt-BR')} (nº ${INC.salvo.id}).`;
  } catch(e){ console.error(e); alert('Não foi possível gravar.\n\nSe o script sql/setup_incorporacao_v1.sql ainda não foi executado no Supabase, a tabela não existe.\n\nDetalhe: ' + (e.message||e)); }
}
async function incHistCarregar(){
  const el = $id('inc-hist'); if (!el) return;
  el.innerHTML = '<div class="hint">Carregando…</div>';
  let rs = [];
  try { rs = await supa('GET', INC_TABELA, { params:{ select:'id,ano,titulo,cnpj_incorporadora,cnpjs_incorporadas,criado_em,criado_por,snapshot->motorLacre,snapshot->calculadoEm,entradas->importadoEm', order:'criado_em.desc', limit:'200' } }) || []; }
  catch(e){ el.innerHTML = '<div class="hint" style="color:var(--err)">Não consegui ler as simulações gravadas: ' + esc(e.message||e) + '<br>Se a tabela ainda não existe, execute sql/setup_incorporacao_v1.sql no Supabase.</div>'; return; }
  if (!rs.length){ el.innerHTML = '<div class="hint">Nenhuma simulação gravada ainda.</div>'; return; }
  el.innerHTML = `<table class="gtable"><thead><tr><th>Nº</th><th>Empresas</th><th>Ano</th><th>Importada em</th><th>Calculada em</th><th>Gravada em</th><th>Motor</th><th></th></tr></thead><tbody>${rs.map(r=>`<tr><td>${r.id}</td><td>${esc(r.titulo||'')}</td><td>${r.ano}</td>
    <td>${r.importadoEm?new Date(r.importadoEm).toLocaleString('pt-BR'):'—'}</td><td>${r.calculadoEm?new Date(r.calculadoEm).toLocaleString('pt-BR'):'—'}</td><td>${new Date(r.criado_em).toLocaleString('pt-BR')}<br><span class="hint">${esc(r.criado_por||'')}</span></td><td><code>${esc(r.motorLacre||'')}</code>${r.motorLacre&&r.motorLacre!==LACRE_HASH?' <span class="hint" title="gravada com outra versão do motor">≠ atual</span>':''}</td>
    <td style="white-space:nowrap"><button class="btn" onclick="incAbrir(${r.id})">Reabrir</button> <button class="btn" onclick="incExcluir(${r.id})" style="color:var(--err)">Excluir</button></td></tr>`).join('')}</tbody></table>`;
}
async function incAbrir(id){
  let r; try { r = (await supa('GET', INC_TABELA, { params:{ select:'*', id:'eq.'+id, limit:'1' } }))[0]; } catch(e){ alert('Falha ao ler: '+(e.message||e)); return; }
  if (!r){ toast('Registro não encontrado.'); return; }
  const En = r.entradas || {};
  INC.entradas = { ano:r.ano, janela:En.janela||'', importadoEm:En.importadoEm, chave:En.chave, empresas:(En.empresas||[]).map(e=>({ ...e, dados: anNormalizar(e.dados, e.cnpj, r.ano), analiticos: e.analiticos||{venda:null,compra:null} })) };
  INC.prem = r.premissas || { abatimentos:[], manuais:[] };
  INC.sel = { incorporadora: r.cnpj_incorporadora, incorporadas: r.cnpjs_incorporadas||[], ano:r.ano, janela:En.janela||'' };
  INC.salvo = { id:r.id, criado_em:r.criado_em, _chave:En.chave };
  INC._ia = r.snapshot && r.snapshot.ia || null; INC._iaErro = null;
  // resultado da época: reexibido a partir do snapshot, SEM recalcular
  INC.res = incResDoSnapshot(r.snapshot);
  go('sim'); incRenderSel(); incEntradasRender(); incIntraRender(); incRender();
  $id('inc-btn-detectar').disabled = false; $id('inc-btn-calcular').disabled = false; $id('inc-btn-recalcular').disabled = false;
  $id('inc-res-status').innerHTML = `Reaberta: simulação nº ${r.id}, gravada em ${new Date(r.criado_em).toLocaleString('pt-BR')} — resultado da época (motor ${esc(r.snapshot?.motorLacre||'?')}). <b>Recalcular</b> refaz com a cópia atual dos dados; <b>Importar dados</b> busca as análises de novo.`;
  const av = await incConferirDefasagem(INC.entradas);
  if (av.length){
    const el = $id('inc-entradas'); if (el) el.insertAdjacentHTML('afterbegin', `<div style="background:var(--warn-bg);border-left:4px solid var(--warn);padding:8px 12px;border-radius:0 8px 8px 0;margin-bottom:8px;font-size:13px">⚠️ Os dados mudaram depois desta simulação:<br>${av.map(esc).join('<br>')}<br><b>Importar dados</b> traz a versão atual; <b>Recalcular</b> sozinho usa a cópia da época.</div>`);
  }
}
// reconstrói um objeto de resultado "de exibição" a partir do snapshot (as tabelas leem só T/meses/deltas)
function incResDoSnapshot(s){
  if (!s) return null;
  const mes = x => ({ receita:x.receita, rbt12:x.rbt12, faixa:x.faixa, fatorR:x.fatorR, das:x.das, subIcms:x.sub, subIss:0, simples:{total:x.simples}, lp:{total:x.lp,adicional:0}, lr:{total:x.lr,adicional:0} });
  return { ano:s.ano, anoRef:s.anoRef, calculadoEm:s.calculadoEm, motorLacre:s.motorLacre, motorDefasado:s.motorDefasado,
    empresas: (s.empresas||[]).map(e=>({ ...e, R:{ meses:(e.meses||[]).map(mes) }, P:e.P })),
    consolidada: { T:s.consolidada.T, sn:s.consolidada.sn, dados:s.consolidada.dados, reforma:s.consolidada.reforma, R:{ meses:(s.consolidada.meses||[]).map(mes), subMon:null } },
    soma:s.soma, delta:s.delta, alertas:s.alertas||[], premissas:s.premissas||[], notas:s.notas||[], abatidos:s.abatidos||[], projetadas:s.projetadas||[], _snapshot:true };
}
async function incExcluir(id){
  if (!await dlgSimNao('Excluir a simulação nº '+id+'?', 'Ela sai da lista (exclusão lógica — fica na trilha do banco, sem aparecer no aplicativo).', 'Excluir', 'Cancelar')) return;
  try { await supa('POST','rpc/atp_excluir_incorporacao',{ body:{ p_id:id }, semPrefer:true }); toast('Simulação excluída.'); incHistCarregar(); }
  catch(e){ alert('Não foi possível excluir: ' + (e.message||e)); }
}

// ══ PARECER (papel timbrado, layout do parecer do ATP) ════════════════════════════════════
function incParecerAbrir(){
  if (!INC.res){ toast('Calcule antes de gerar o parecer.'); return; }
  $id('inc-card-parecer').style.display = 'block';
  incRlCorpoPara('inc-parecer-dock');            // v1.1.0: #rl-corpo é um só — volta do Relatórios para o parecer
  incParecerRender();
  $id('inc-card-parecer').scrollIntoView({ behavior:'smooth' });
}
function incTextosPadrao(R){
  const E = R.empresas, inc = E[0], C = R.consolidada.T, D = R.delta, ar = R.anoRef, LA = D.anos[ar] || null;
  const nomes = E.slice(1).map(e=>e.nome).join(', ');
  const melhorHoje = k => ({ simples:'Simples Nacional', lp:'Lucro Presumido', lr:'Lucro Real' })[k];
  const menorCons = ['simples','lp','lr'].filter(k=>R.consolidada.sn.estado==='elegivel'||k!=='simples').sort((a,b)=>C[a]-C[b])[0];
  const menorSoma = ['simples','lp','lr'].sort((a,b)=>R.soma[a]-R.soma[b])[0];
  return {
    intro: `Este estudo simula a incorporação de ${nomes} por ${inc.nome}, no ano-base ${R.ano}, comparando a carga tributária das empresas separadas com a de uma única empresa que reúna as receitas, a folha, as compras e as despesas de todas. O objetivo é medir o efeito tributário da operação — que quase nunca é neutro, porque as alíquotas do Simples são progressivas, o adicional de IRPJ tem limite mensal e a Reforma Tributária trata de forma diferente quem está dentro e fora do Simples.`,
    empresas: `Separadas, as empresas somam receita de ${fmtR(R.soma.receita)} e carga de ${fmtR(R.soma[menorSoma])} no regime mais barato para cada uma (${melhorHoje(menorSoma)} no conjunto). Consolidadas, a receita é ${fmtR(C.receita)} e a carga fica em ${fmtR(C[menorCons])} no ${melhorHoje(menorCons)}${R.consolidada.sn.estado!=='elegivel'?' — a consolidada não é elegível ao Simples Nacional':''}.`,
    premissas: `A simulação usa as análises gravadas de cada empresa, projeta individualmente as que têm ano incompleto e soma mês a mês. O RBT12 consolidado é a soma dos RBT12; as alíquotas de ISS e ICMS e as opções de configuração são as da incorporadora. ${R.abatidos.length ? `Foram abatidas ${R.abatidos.length} operação(ões) entre as empresas, no total de ${fmtR(R.abatidos.reduce((s,a)=>s+a.abatidoRec,0))} de receita.` : 'Não foi abatida nenhuma operação entre as empresas.'}`,
    leitura: `No Simples Nacional a diferença é de ${fmtR(D.simples.dif)} (${fmtP(D.simples.pct*100,1)}%); no Lucro Presumido, ${fmtR(D.lp.dif)}; no Lucro Real, ${fmtR(D.lr.dif)}. Valor positivo é custo da incorporação; negativo é economia.`,
    reforma: LA ? `Em ${ar}, ano de referência, a consolidada paga ${fmtR(LA.dentro.cons)} por dentro do Simples, ${fmtR(LA.hib.cons)} no híbrido e ${fmtR(LA.regular.cons)} no regime regular, contra ${fmtR(LA.dentro.soma)}, ${fmtR(LA.hib.soma)} e ${fmtR(LA.regular.soma)} das empresas separadas.` : 'Sem cenários da Reforma calculados.',
    parecer1: `A incorporação ${D[menorCons].dif > 0.5 ? 'aumenta' : 'reduz'} a carga tributária anual em ${fmtR(Math.abs(D[menorCons].dif))} no regime mais barato da consolidada (${melhorHoje(menorCons)}), considerando o ano-base e as premissas declaradas.`,
    parecer2: R.alertas.length ? 'Pontos que pesam na decisão: ' + R.alertas.slice(0,4).map(a=>a.t).join(' ') : 'Não foram apontados alertas de fronteira.',
    recomendacao: `Considerando as premissas adotadas, os dados disponíveis e a regulamentação vigente na data-base, a incorporação ${D[menorCons].dif > 0.5 ? 'tem custo tributário e deve ser justificada por ganhos operacionais ou societários' : 'não tem custo tributário relevante e pode ser conduzida pelo regime ' + melhorHoje(menorCons)}.`,
  };
}
function incParecerRender(){
  const R = INC.res, E = R.empresas, inc = E[0], C = R.consolidada.T, D = R.delta;
  const TX = Object.assign(incTextosPadrao(R), (INC._ia && INC._ia.textos) || {});
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
  const B = [];
  B.push({ html:`<h3 class="pp-sec" style="margin-top:0">1. Introdução e objetivo</h3><div class="hint" style="margin-bottom:8px">${INC._ia?'Textos analíticos gerados com apoio de IA sobre os números calculados pelo sistema.':'Textos padrão do sistema — a IA não foi usada neste documento.'}${R.motorDefasado?' <b>Atenção:</b> calculado com cópia do motor diferente da versão em produção do Análise Tributária Pro.':''}</div>`, custo:4 }, par(TX.intro));
  B.push(sec(2,'As empresas'), { thead:`<tr><th>Empresa</th><th>Regime (cadastro)</th><th class="num">Receita ${R.ano}</th><th class="num">Simples</th><th class="num">Presumido</th><th class="num">Real</th></tr>`, custoFixo:0,
    linhas: E.map(e=>({ html:`<tr><td class="rot">${e.incorporadora?'★ ':''}${esc(e.nome)}<br><span class="hint">${fmtCNPJ(e.cnpj)}${e.P?' · '+e.P.nReais+' meses lançados, '+e.P.nProj+' estimados':''}</span></td><td>${esc(e.regime||'—')}</td><td class="num">${fmt(e.T.receita)}</td><td class="num">${fmt(e.T.simples)}</td><td class="num">${fmt(e.T.lp)}</td><td class="num">${fmt(e.T.lr)}</td></tr>`, custo:2 })) }, par(TX.empresas));
  B.push(sec(3,'Premissas'), { html:`<ul class="pp-p" style="margin-left:18px">${R.premissas.concat(R.notas).map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`, custo: 2 + R.premissas.length + R.notas.length }, par(TX.premissas));
  if (R.abatidos.length) B.push(sec(4,'Operações entre as empresas'), { thead:`<tr><th>Vendeu → comprou</th><th>Natureza</th><th class="num">Valor</th><th class="num">Abatido da receita</th><th>Fonte</th></tr>`, linhas: R.abatidos.map(a=>({ html:`<tr><td class="rot">${esc(a.deNome)} → ${esc(a.paraNome)}</td><td>${a.natureza}</td><td class="num">${fmt(a.valor)}</td><td class="num">${fmt(a.abatidoRec)}</td><td class="hint">${esc(a.fonte)}</td></tr>`, custo:1 })) });
  else B.push(sec(4,'Operações entre as empresas'), par('Nenhuma operação entre as empresas foi abatida' + (R.premissas.length?'; se houver vendas ou serviços entre elas, o resultado consolidado está superestimado na receita e no crédito.':'.')));
  B.push(sec(5,'Regimes de hoje — separadas × consolidada'), { thead:`<tr><th>Regime</th>${E.map(e=>`<th class="num">${esc(e.nome)}</th>`).join('')}<th class="num">Soma</th><th class="num">Consolidada</th><th class="num">Δ</th></tr>`,
    linhas: [['Receita bruta','receita'],['Simples Nacional','simples'],['Lucro Presumido','lp'],['Lucro Real','lr']].map(([rot,k])=>({ html:`<tr><td class="rot">${rot}</td>${E.map(e=>`<td class="num">${fmt(e.T[k])}</td>`).join('')}<td class="num">${fmt(R.soma[k])}</td><td class="num"><b>${fmt(C[k])}</b></td><td class="num">${D[k]?fmt(D[k].dif):'—'}</td></tr>`, custo:1 })) }, par(TX.leitura));
  const anos = Object.keys(D.anos).map(Number).sort();
  if (anos.length) B.push(sec(6,'Reforma Tributária — ano a ano'), { thead:`<tr><th>Ano</th><th class="num">Por dentro (soma)</th><th class="num">Por dentro (consol.)</th><th class="num">Híbrido (soma)</th><th class="num">Híbrido (consol.)</th><th class="num">Regular (soma)</th><th class="num">Regular (consol.)</th></tr>`,
    linhas: anos.map(a=>({ html:`<tr${a===R.anoRef?' style="background:#eaf2f8"':''}><td class="rot">${a}${a===R.anoRef?' ◀':''}</td>${['dentro','hib','regular'].map(k=>`<td class="num">${fmt(D.anos[a][k].soma)}</td><td class="num"><b>${fmt(D.anos[a][k].cons)}</b></td>`).join('')}</tr>`, custo:1 })) }, par(TX.reforma));
  if (R.alertas.length) B.push(sec(7,'Alertas de fronteira'), { html:`<div class="pp-alerta"><ul style="margin:6px 0 0 18px">${R.alertas.map(a=>`<li>${esc(a.t)}</li>`).join('')}</ul></div>`, custo: 2 + R.alertas.length*2 });
  B.push(sec(8,'Parecer'), par(TX.parecer1), par(TX.parecer2), { html:`<div class="pp-final"><b>Recomendação:</b> ${TX.recomendacao}</div>`, custo:4 });
  const esc_ = PARAMS.escritorio || {};
  B.push({ html:`<div class="hint" style="margin-top:14px">Simulação de Incorporação v${INC_VERSAO} · motor do Análise Tributária Pro (lacre ${R.motorLacre}) · calculado em ${new Date(R.calculadoEm).toLocaleString('pt-BR')}${INC.salvo?' · simulação nº '+INC.salvo.id:''}. Este documento não substitui a apuração oficial; os valores dependem das premissas declaradas e dos dados lançados nas análises de origem.</div>
    <div style="margin-top:28px;border-top:1px solid #999;width:280px;padding-top:6px;font-size:12px">${esc(esc_.respNome||'Responsável técnico')}<br>${esc(esc_.respQualif||'Contador')}${esc_.respCRC?' · CRC '+esc(esc_.respCRC):''}<br>Artecon Artes Contábeis</div>`, custo:8 });
  h += ppDocumento(B);
  $id('rl-corpo').innerHTML = h;
  setTimeout(() => { try { ppReguaRender(); } catch(e){ console.error('régua', e); } }, 350);
}
async function incParecerIA(){
  const R = INC.res; if (!R) return;
  const btn = $id('pp-ia-btn'); if (btn){ btn.disabled = true; btn.textContent = '⏳ Gerando…'; }
  try {
    const E = R.empresas, C = R.consolidada, D = R.delta, ar = R.anoRef;
    const payload = {
      incorporadora: { nome:E[0].nome, cnpj:E[0].cnpj, regime:E[0].regime },
      incorporadas: E.slice(1).map(e=>({ nome:e.nome, cnpj:e.cnpj, regime:e.regime })),
      ano: R.ano, anoReferencia: ar,
      empresas: E.map(e=>({ nome:e.nome, incorporadora:e.incorporadora, receitaAnual:e.T.receita, receitaExportacao:e.T.receitaExp, simplesAnual:e.T.simples, lpAnual:e.T.lp, lrAnual:e.T.lr, rbt12Max:e.T.rbt12Max, faixaDez:e.T.faixaDez, fatorRMedio:e.T.fatorRMedio, elegivelSimples:e.sn.estado, projetada: !!e.P, mesesLancados: e.P?e.P.nReais:12 })),
      consolidada: { receitaAnual:C.T.receita, receitaExportacao:C.T.receitaExp, simplesAnual:C.T.simples, lpAnual:C.T.lp, lrAnual:C.T.lr, dasAnual:C.T.das, travaAnual:C.T.trava, adicionalIrpjLP:C.T.adicionalLP, adicionalIrpjLR:C.T.adicionalLR, rbt12Max:C.T.rbt12Max, faixaDez:C.T.faixaDez, fatorRMedio:C.T.fatorRMedio, elegivelSimples:C.sn.estado, teto:C.sn.teto },
      somaSeparadas: { simplesAnual:R.soma.simples, lpAnual:R.soma.lp, lrAnual:R.soma.lr, receitaAnual:R.soma.receita },
      delta: { simples:D.simples, lucroPresumido:D.lp, lucroReal:D.lr, leitura:'delta = consolidada − soma das separadas; positivo = custo da incorporação, negativo = economia' },
      reformaAnoAAno: Object.keys(D.anos).sort().map(a=>({ ano:+a, porDentro:D.anos[a].dentro, hibrido:D.anos[a].hib, regimeRegular:D.anos[a].regular, lucroPresumido:D.anos[a].lp, lucroReal:D.anos[a].lr, porDentroBloqueado: !!(C.T.anos[a]&&C.T.anos[a].snBloqueado) })),
      abatimentosIntragrupo: R.abatidos.map(a=>({ de:a.deNome, para:a.paraNome, natureza:a.natureza, valor:a.valor, abatidoDaReceita:a.abatidoRec, fonte:a.fonte })),
      premissas: R.premissas, notas: R.notas, alertas: R.alertas.map(a=>a.t),
      regrasDeTexto: [
        'Use apenas os números do JSON; nunca calcule, some ou estime.',
        'delta positivo é CUSTO da incorporação; negativo é ECONOMIA. Nunca inverta o sinal.',
        'A coluna Simples da consolidada só é um caminho real se consolidada.elegivelSimples for "elegivel"; caso contrário, trate-a como referência e diga que a incorporação implica saída do Simples.',
        'Prejuízo fiscal e base negativa de CSLL das incorporadas NÃO passam para a incorporadora (DL 2.341/87, art. 33) — se houver nota a respeito, repita-a.',
        'O RBT12 da consolidada é a SOMA dos RBT12; operações entre as empresas no ano anterior não foram abatidas — cite como limitação quando houver abatimentos.',
        'Não recomende a operação de forma absoluta: condicione às premissas, aos dados e à regulamentação vigente na data-base.',
      ],
    };
    const r = await supaFn(INC_FN_IA, payload);
    if (!r.ok){ const t = await r.text().catch(()=> ''); if (r.status===404) throw new Error('Edge Function "'+INC_FN_IA+'" não encontrada — instale pelo painel do Supabase (pasta supabase/functions).'); throw new Error('Falha na function ('+r.status+'): '+t.slice(0,200)); }
    const data = await r.json();
    if (!data || !data.textos) throw new Error('Resposta da function sem o campo "textos".');
    const tx = {}; for (const [k,v] of Object.entries(data.textos)) tx[k] = esc(v);
    INC._ia = { textos: tx, quando: new Date().toLocaleString('pt-BR'), reparado: !!data.__reparado };
    INC._iaErro = null;
    toast('✅ Textos do parecer gerados pela IA.');
    incParecerRender();
  } catch(e){
    console.error('incParecerIA', e); INC._iaErro = e && e.message ? e.message : String(e);
    alert('A geração dos textos com IA FALHOU.\n\n' + INC._iaErro + '\n\nO parecer continua com os TEXTOS PADRÃO do sistema, e isso fica declarado no documento.');
    incParecerRender();
  }
}

// ══ VERSÕES ═══════════════════════════════════════════════════════════════════════════════
function incVersoesRender(){
  const tb = $id('inc-changelog'); if (!tb) return;
  tb.innerHTML = INC_CHANGELOG.map(([v,d,t],i)=>`<tr><td><b>v${v}</b>${i===0?' <span class="badge ok">atual</span>':''}</td><td>${d}</td><td>${t}</td></tr>`).join('');
}
// ── BOOT (mesmo padrão do index: sessão guardada entra direto; senão, tela de login) ──────
(async () => {
  if (await tentarSessao()) entrar();
  else $id('auth-screen').style.display = 'flex';
})();
