// ══ RELATÓRIOS (v1.1.0) — os MESMOS relatórios da aba Relatórios do Análise Tributária Pro ══════════
//  As funções de relatório (rlConferencia, rlRegimes, rlReforma, rlCnpjRender e tudo que elas usam) são
//  COPIADAS do index.html pelo build, byte a byte, e conferidas pela suíte. Elas leem o estado global RL
//  ({dados, res, reforma, empresa, forn}) e escrevem em #rl-corpo. O que é PRÓPRIO daqui:
//   • rlRender() — o do index escolhe a empresa pelo seletor; este percorre a consolidada e cada isolada;
//   • incRlEntidades() — monta o RL de cada entidade a partir do resultado da simulação;
//   • "lado a lado" — cada entidade é desenhada em #rl-corpo e depois movida para a sua coluna (o
//     #rl-corpo fica ANTES das colunas no DOM, então os ids que os relatórios procuram acham sempre o
//     desenho recém-feito, e não o da coluna anterior);
//   • #rl-corpo é um só (a régua do parecer também o procura): vive no card do parecer e é movido
//     para esta página quando ela abre (incRlCorpoPara).
//  Regra mantida: nada aqui altera o motor nem as análises; os relatórios da isolada saem da análise
//  gravada, como no index; os da consolidada saem da análise consolidada que passou pelo mesmo motor.
const INC_RL_TIPOS = {
  parecer_inc:     'Parecer de Incorporação — com IA',
  conferencia:     'Conferência de Cálculos — Memória (documento interno)',
  apresentacao_inc_s: 'Apresentação de Incorporação — simplificada (7 telas)',
  apresentacao_inc_c: 'Apresentação de Incorporação — completa (15 telas)',
};
// relatórios DA INCORPORAÇÃO (um documento para o conjunto): o seletor de empresa não se aplica
const INC_RL_CONJUNTO = ['parecer_inc','apresentacao_inc_s','apresentacao_inc_c'];

function incRlCorpoPara(dockId){
  const c = $id('rl-corpo'), d = $id(dockId);
  if (c && d && c.parentNode !== d) d.appendChild(c);
}

// analíticos gravados (venda/compra) no formato que rlCnpjRender lê (linhas de atp_fornec)
function incRlFornIsolada(e){
  const an = e.analiticos || {}, F = {};
  for (const t of ['venda','compra']){
    const a = an[t];
    if (a && Array.isArray(a.itens) && a.itens.length)
      F[t] = { consultado_em: a.em || new Date().toISOString(), dados: { tipo:t, periodo: a.periodo||'', itens: a.itens } };
  }
  return Object.keys(F).length ? F : null;
}
// consolidada: junta os analíticos de todas as empresas; as operações ENTRE elas (raiz do CNPJ de uma
// empresa do grupo) saem da relação — depois da incorporação deixam de existir; o mesmo CNPJ que vende
// para (ou compra de) duas empresas vira uma linha só, com os valores e CFOPs somados.
function incRlFornConsolidada(E){
  const raizes = new Set(E.empresas.map(e => incRaiz(e.cnpj)));
  const F = {}, intra = { n:0, v:0 };
  for (const t of ['venda','compra']){
    const porC = {}, per = new Set(); let em = null;
    for (const e of E.empresas){
      const a = (e.analiticos||{})[t]; if (!a || !Array.isArray(a.itens)) continue;
      if (a.periodo) per.add(a.periodo);
      if (a.em && (!em || a.em > em)) em = a.em;
      for (const it of a.itens){
        if (raizes.has(incRaiz(it.cnpj))){ intra.n++; intra.v += (+it.valor||0); continue; }
        const k = String(it.cnpj||'') + '|' + (it.classe||'');
        if (!porC[k]) porC[k] = clone(it);
        else {
          porC[k].valor = (+porC[k].valor||0) + (+it.valor||0);
          porC[k].cfops = porC[k].cfops || {};
          for (const [c,v] of Object.entries(it.cfops||{})) porC[k].cfops[c] = (+porC[k].cfops[c]||0) + (+v||0);
        }
      }
    }
    const itens = Object.values(porC);
    if (itens.length) F[t] = { consultado_em: em || new Date().toISOString(), dados: { tipo:t, periodo: [...per].join(' · '), itens } };
  }
  return { forn: Object.keys(F).length ? F : null, intra };
}

// entidades dos relatórios: consolidada + cada empresa. O resultado reaberto de um snapshot guarda só
// os totais — para relatórios completos a análise gravada passa de novo pelo motor (e o aviso diz isso).
function incRlEntidades(){
  const S = INC.res, E = INC.entradas;
  if (!S || !E || !S.consolidada) return null;
  const ano = +S.ano; let recalculado = false;
  const roda = d => calcular(d, PARAMS.anexos, folhaPercDaEmpresa(d.cfg));
  const lista = [];
  const dC = S._snapshot ? anNormalizar(clone(S.consolidada.dados), E.empresas[0].cnpj, ano) : S.consolidada.dados;
  let rC = S._snapshot ? null : (S.consolidada.R && S.consolidada.R.totais ? S.consolidada.R : null);
  if (!rC){ recalculado = true; rC = roda(dC); }
  const fc = incRlFornConsolidada(E);
  lista.push({ chave:'cons', rot:'Consolidada', consolidada:true, nome: 'CONSOLIDADA — ' + E.empresas.map(e=>e.nome).join(' + '),
               cnpj: E.empresas[0].cnpj, dados:dC, res:rC, reforma: S.consolidada.reforma || null, forn: fc.forn, intra: fc.intra });
  E.empresas.forEach((e, i) => {
    const d = anNormalizar(e.dados, e.cnpj, ano);
    const se = (S.empresas||[]).find(x => x.cnpj === e.cnpj);
    let res = (!S._snapshot && se && se.Rreal && se.Rreal.totais) ? se.Rreal : null;
    if (!res){ recalculado = true; res = roda(d); }
    lista.push({ chave:e.cnpj, rot: i===0 ? 'Incorporadora' : 'Incorporada', nome:e.nome, cnpj:e.cnpj, dados:d, res, reforma: d.reforma || null, forn: incRlFornIsolada(e) });
  });
  return { lista, recalculado };
}

function incRlSelecionar(ent){
  RL.dados = ent.dados; RL.res = ent.res; RL.reforma = ent.reforma; RL.forn = ent.forn;
  RL.empresa = { cnpj: ent.cnpj, razao_social: ent.nome };
  RL.cmp = null; RL.defasado = null; RL._ia = null; RL._iaErro = null;
}
function incRlSub(ent, n){
  const per = ($id('rl-per') && $id('rl-per').selectedOptions && $id('rl-per').selectedOptions[0]) ? $id('rl-per').selectedOptions[0].text : ({1:'Mensal',2:'Bimestral',3:'Trimestral',6:'Semestral',12:'Anual'})[n]||'';
  return `<b>${esc(ent.nome)}</b> · CNPJ ${fmtCNPJ(ent.cnpj)} · Ano-base ${ent.dados.ano} · Periodicidade: ${per} · Artecon Artes Contábeis`;
}
// desenha UMA entidade em #rl-corpo (o mesmo caminho que o rlRender do index percorre para uma empresa)
async function incRlDesenhar(tipo, ent, n){
  incRlSelecionar(ent);
  const corpo = $id('rl-corpo'); corpo.innerHTML = '';
  if (tipo === 'conferencia') corpo.innerHTML = rlConferencia();
}

function incRlPopularEntidades(ents){
  const sel = $id('inc-rl-ent'); if (!sel) return;
  const atual = sel.value;
  const ops = '<option value="todas">Todas — lado a lado (Consolidada · ' + ents.lista.slice(1).map(e=>esc(e.rot)).join(' · ') + ')</option>' +
    ents.lista.map(e => `<option value="${esc(e.chave)}">${esc(e.rot)} — ${esc(e.consolidada ? E_NOMES(ents) : e.nome)}</option>`).join('');
  if (sel.innerHTML !== ops) sel.innerHTML = ops;
  sel.value = (atual && (atual === 'todas' || ents.lista.some(e => e.chave === atual))) ? atual : 'todas';
}
const E_NOMES = ents => ents.lista.slice(1).map(e => e.nome).join(' + ');

// rlRender PRÓPRIO — chamado pelos seletores desta página e pelos controles copiados (rlProjTrocar,
// rlConfAnosSel…), que no index chamam rlRender().
async function rlRender(){
  if (APP.page !== 'relatorios') return;
  rlLimparCharts();
  apPrintCss(false);                                      // @page paisagem só na apresentação (como no index)
  const tipo = $id('rl-tipo').value, n = +$id('rl-per').value || 3;
  const conf = tipo === 'conferencia', conjunto = INC_RL_CONJUNTO.includes(tipo);
  { const e1 = $id('rl-conf-modo-wrap'); if (e1) e1.style.display = conf ? '' : 'none';
    const sm = $id('rl-conf-mes'), e2 = $id('rl-conf-mes-wrap');
    if (conf && sm && !sm.options.length) sm.innerHTML = MESES_ROT.map((r,i)=>`<option value="${i}">${r}</option>`).join('');
    if (e2) e2.style.display = (conf && ($id('rl-conf-modo')||{}).value === 'mes') ? '' : 'none'; }
  { const aw = $id('rl-conf-anos-wrap'); if (aw){ aw.style.display = conf ? '' : 'none'; if (conf) rlConfAnosPopular(); } }
  { const ew = $id('inc-rl-ent-wrap'); if (ew) ew.style.display = conjunto ? 'none' : ''; const pw = $id('rl-per-wrap'); if (pw) pw.style.display = conjunto ? 'none' : ''; }
  incRlCorpoPara('inc-rl-dock');
  const lado = $id('inc-rl-lado'), aviso = $id('inc-rl-aviso'), cab = $id('rl-cab'), corpo = $id('rl-corpo');
  const esconde = id => { const el = $id(id); if (el) el.style.display = 'none'; };
  if (!INC.res || !INC.res.consolidada){
    lado.innerHTML = ''; lado.style.display = 'none'; cab.style.display = 'none'; aviso.innerHTML = ''; esconde('rl-status-proj');
    const sel = $id('inc-rl-ent'); if (sel) sel.innerHTML = '<option value="todas">— calcule uma simulação —</option>';
    corpo.innerHTML = '<div class="card placeholder"><h2>Sem simulação calculada</h2><p>Na aba Simulação, importe os dados e clique em <b>Calcular</b> (ou reabra uma simulação gravada).</p></div>';
    return;
  }
  const S = INC.res;
  if (conjunto){
    lado.innerHTML = ''; lado.style.display = 'none'; cab.style.display = 'none'; esconde('rl-status-proj');
    aviso.innerHTML = `Documento da <b>incorporação</b> (isoladas × consolidada × cenários). Os textos com IA são gerados no parecer e valem para a apresentação.`;
    if (tipo === 'parecer_inc') incParecerRender();
    else incApresentar(tipo === 'apresentacao_inc_s' ? 'simplificada' : 'completa');
    corpo.style.display = '';
    return;
  }
  const ents = incRlEntidades();
  incRlPopularEntidades(ents);
  aviso.innerHTML = [
    ents.recalculado ? `Resultado reaberto de um snapshot: a conferência é gerada agora, passando a análise gravada pelo motor atual (lacre <b>${LACRE_HASH}</b>)${S.motorLacre && S.motorLacre !== LACRE_HASH ? ` — <span style="color:var(--warn)">o quadro da Simulação é da época (lacre ${esc(S.motorLacre)}) e pode diferir</span>` : ' — mesmo motor da época, mesmos números'}.` : '',
    `Consolidada = análise conjunta (12 meses: as isoladas já projetadas e somadas); isoladas = análise gravada de cada empresa, exatamente como na aba Relatórios do Análise Tributária Pro.`,
  ].filter(Boolean).join('<br>');
  const escolha = $id('inc-rl-ent').value || 'todas';
  const ent = ents.lista.find(e => e.chave === escolha) || ents.lista[0];
  if (escolha !== 'todas'){
    lado.innerHTML = ''; lado.style.display = 'none';
    cab.style.display = 'block'; $id('rl-titulo').textContent = INC_RL_TIPOS[tipo]; $id('rl-sub').innerHTML = incRlSub(ent, n);
    await incRlDesenhar(tipo, ent, n);
    try { rlStatusProj(tipo); } catch(e){ console.error('rlStatusProj', e); }
    corpo.style.display = '';
    return;
  }
  cab.style.display = 'none'; esconde('rl-status-proj');
  lado.innerHTML = ''; lado.style.display = 'flex';
  for (const e of ents.lista){
    await incRlDesenhar(tipo, e, n);
    const col = document.createElement('div'); col.className = 'inc-rl-col';
    col.innerHTML = `<div class="inc-rl-colcab"><span class="badge ok">${esc(e.rot)}</span> <b>${esc(e.nome)}</b><div class="hint">${incRlSub(e, n)}</div></div>`;
    while (corpo.firstChild) col.appendChild(corpo.firstChild);
    lado.appendChild(col);
  }
  corpo.innerHTML = '';
}
