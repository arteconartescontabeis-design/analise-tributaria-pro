/* ============================================================================
 * imob_premissas.js — PREMISSAS do cálculo: origem, status, edição controlada
 * e grau de certeza. v1.0.0 · módulo Análise Imobiliária Pro 1.3.0
 *
 * O motorImob (lacre c287341e) NÃO é tocado. Este arquivo só monta o `ctx`
 * que o motor recebe e registra, para cada premissa: o valor automático, o
 * valor editado (se houver), quem justificou e quando. O relatório mostra os
 * dois valores lado a lado.
 *
 * Funções PURAS (sem DOM, sem rede) — testadas em tests/run_imob_ui.js.
 * ==========================================================================*/
(function (raiz) {
  'use strict';

  var VERSAO = '1.0.0';

  /* Catálogo: cada premissa com valor automático, origem, data e status.
     status: 'ativa' (regra em vigor) | 'estimada' (alíquota de referência não
     vinculante) | 'pendente' (depende de regulamentação/índice futuro).      */
  var CATALOGO = {
    ibs_padrao:  { rotulo: 'Alíquota padrão do IBS (%)', valor: 18.70, unidade: '%', min: 0, max: 100,
      origem: 'Resolução CGIBS 14/2026 — alíquota de referência (estimativa não vinculante)',
      data: '29/07/2026', status: 'estimada',
      fundamento: 'LC 214/2025, art. 14 c/c Res. CGIBS 14/2026' },
    cbs_padrao:  { rotulo: 'Alíquota padrão da CBS (%)', valor: 9.21, unidade: '%', min: 0, max: 100,
      origem: 'Resolução CGIBS 14/2026 — alíquota de referência (estimativa não vinculante)',
      data: '29/07/2026', status: 'estimada',
      fundamento: 'LC 214/2025, art. 14 c/c Res. CGIBS 14/2026' },
    reducao_venda: { rotulo: 'Redução de alíquota — alienação e demais operações (%)', valor: 50, unidade: '%', min: 0, max: 100,
      origem: 'LC 214/2025, art. 261, caput; RIBS/RCBS art. 379, caput', data: '16/01/2025', status: 'ativa',
      fundamento: 'LC 214/2025, art. 261, caput' },
    reducao_locacao: { rotulo: 'Redução de alíquota — locação, cessão onerosa e arrendamento (%)', valor: 70, unidade: '%', min: 0, max: 100,
      origem: 'LC 214/2025, art. 261, parágrafo único; RIBS/RCBS art. 379, parágrafo único', data: '16/01/2025', status: 'ativa',
      fundamento: 'LC 214/2025, art. 261, parágrafo único' },
    fator_ate_2026: { rotulo: 'Fator de atualização até 31/12/2026', valor: 1.4523, unidade: 'x', min: 0.000001, max: 1000,
      origem: 'Índice informado pelo usuário (IPC/Fipe até 1979; IPCA de 1980 a 2026) — a tabela oficial ainda não foi publicada',
      data: '—', status: 'pendente', fundamento: 'RIBS/RCBS art. 375, §4º' },
    ipca_fator: { rotulo: 'Fator IPCA de atualização dos redutores sociais', valor: 1, unidade: 'x', min: 0.000001, max: 1000,
      origem: 'Sem atualização (fator 1) até a publicação do índice de 2027', data: '—', status: 'pendente',
      fundamento: 'LC 214/2025, art. 259, §3º; art. 260, §2º' },
    redutor_social_residencial_novo: { rotulo: 'Redutor social — imóvel residencial novo (R$)', valor: 100000, unidade: 'R$', min: 0, max: 1e12,
      origem: 'LC 214/2025, art. 259, I', data: '16/01/2025', status: 'ativa', fundamento: 'LC 214/2025, art. 259, I' },
    redutor_social_lote_residencial: { rotulo: 'Redutor social — lote residencial (R$)', valor: 30000, unidade: 'R$', min: 0, max: 1e12,
      origem: 'LC 214/2025, art. 259, II', data: '16/01/2025', status: 'ativa', fundamento: 'LC 214/2025, art. 259, II' },
    redutor_social_locacao_mes: { rotulo: 'Redutor social — locação residencial (R$/mês)', valor: 600, unidade: 'R$', min: 0, max: 1e9,
      origem: 'LC 214/2025, art. 260 (redação da LC 227/2026)', data: '2026', status: 'ativa', fundamento: 'LC 214/2025, art. 260' },
    limite_pf_locacao: { rotulo: 'Limite de receita de locação — pessoa física (R$/ano)', valor: 240000, unidade: 'R$', min: 0, max: 1e12,
      origem: 'LC 214/2025, art. 251, §1º, I', data: '16/01/2025', status: 'ativa', fundamento: 'LC 214/2025, art. 251, §1º' }
  };
  var CHAVES = Object.keys(CATALOGO);

  function r4(x) { return Math.round((+x + Number.EPSILON) * 10000) / 10000; }

  /* Estado das edições: { chave: { valor, justificativa, quando, por } } */
  function novoEstado() { return {}; }

  function validarEdicao(chave, valor, justificativa) {
    var c = CATALOGO[chave];
    if (!c) return { ok: false, msg: 'Premissa desconhecida: ' + chave + '.' };
    var v = typeof valor === 'string' ? parseFloat(String(valor).replace(',', '.')) : valor;
    if (typeof v !== 'number' || !isFinite(v)) return { ok: false, msg: 'Informe um número válido para "' + c.rotulo + '".' };
    if (v < 0) return { ok: false, msg: 'Valor negativo não é admitido em "' + c.rotulo + '".' };
    if (v < c.min) return { ok: false, msg: '"' + c.rotulo + '" não pode ser inferior a ' + c.min + '.' };
    if (v > c.max) return { ok: false, msg: '"' + c.rotulo + '" não pode exceder ' + c.max + (c.unidade === '%' ? '%' : '') + '.' };
    if (c.unidade === 'x' && v === 0) return { ok: false, msg: 'Fator de atualização igual a zero anularia a base — informe um fator positivo.' };
    if (!justificativa || !String(justificativa).trim() || String(justificativa).trim().length < 5)
      return { ok: false, msg: 'A alteração manual de "' + c.rotulo + '" exige justificativa (mínimo de 5 caracteres).' };
    return { ok: true, valor: v };
  }

  function editar(estado, chave, valor, justificativa, por) {
    var v = validarEdicao(chave, valor, justificativa);
    if (!v.ok) return v;
    if (v.valor === CATALOGO[chave].valor) {           // voltou ao padrão: não é edição
      delete estado[chave];
      return { ok: true, restaurada: true, valor: v.valor };
    }
    estado[chave] = { valor: v.valor, justificativa: String(justificativa).trim(),
                      quando: new Date().toISOString(), por: por || null };
    return { ok: true, valor: v.valor };
  }
  function restaurar(estado, chave) { delete estado[chave]; return estado; }
  function restaurarTodas(estado) { CHAVES.forEach(function (k) { delete estado[k]; }); return estado; }

  function valorVigente(estado, chave) {
    return estado && estado[chave] ? estado[chave].valor : CATALOGO[chave].valor;
  }

  /* Lista consolidada — é o que o relatório imprime. */
  function listar(estado) {
    return CHAVES.map(function (k) {
      var c = CATALOGO[k], e = estado && estado[k];
      return { chave: k, rotulo: c.rotulo, unidade: c.unidade, valor_automatico: c.valor,
               valor_vigente: e ? e.valor : c.valor, editada: !!e,
               justificativa: e ? e.justificativa : null, quando: e ? e.quando : null, por: e ? e.por : null,
               origem: c.origem, data_premissa: c.data, status: c.status, fundamento: c.fundamento };
    });
  }
  function alteradas(estado) { return listar(estado).filter(function (p) { return p.editada; }); }

  /* Monta o ctx do motor a partir das premissas vigentes.
     O motor aplica SEMPRE 50% (venda) e 70% (locação) sobre ctx.aliquotas.
     Quando o usuário edita o percentual de redução, a alíquota enviada ao
     motor é a EQUIVALENTE: padrão × (1 − red_manual) / (1 − red_motor), de
     modo que padrão_enviada × (1 − red_motor) = padrão × (1 − red_manual).
     A memória mostra as duas — original e editada — pela função `explicar`. */
  function montarCtx(estado, operacao, extras) {
    var st = estado || {};
    var ibs = valorVigente(st, 'ibs_padrao'), cbs = valorVigente(st, 'cbs_padrao');
    var ehLoc = operacao === 'locacao';
    var redMotor = ehLoc ? 70 : 50;
    var redManual = valorVigente(st, ehLoc ? 'reducao_locacao' : 'reducao_venda');
    var fatorEq = 1;
    if (redManual !== redMotor) fatorEq = (1 - redManual / 100) / (1 - redMotor / 100);
    var edit = alteradas(st);
    var classificacao = 'ESTIMADA';
    if (edit.some(function (p) { return ['ibs_padrao', 'cbs_padrao', 'reducao_venda', 'reducao_locacao'].indexOf(p.chave) >= 0; }))
      classificacao = 'SIMULACAO';
    var ctx = {
      aliquotas: { ibs: r4(ibs * fatorEq), cbs: r4(cbs * fatorEq), classificacao: classificacao,
                   fonte: classificacao === 'SIMULACAO' ? 'premissa editada manualmente pelo usuário'
                                                        : CATALOGO.ibs_padrao.origem },
      parametros: { redutor_social_residencial_novo: valorVigente(st, 'redutor_social_residencial_novo'),
                    redutor_social_lote_residencial: valorVigente(st, 'redutor_social_lote_residencial'),
                    redutor_social_locacao_mes: valorVigente(st, 'redutor_social_locacao_mes'),
                    limite_pf_locacao: valorVigente(st, 'limite_pf_locacao') },
      indices: { ipca_fator: valorVigente(st, 'ipca_fator'), competencia: '2026-01',
                 fator_ate_2026: valorVigente(st, 'fator_ate_2026') },
      premissas: { versao: VERSAO, editadas: edit.map(function (p) { return p.chave; }),
                   reducao_aplicada: redManual, reducao_do_motor: redMotor, fator_equivalencia: r4(fatorEq),
                   ibs_padrao_original: ibs, cbs_padrao_original: cbs }
    };
    if (extras) for (var k in extras) if (extras.hasOwnProperty(k)) ctx[k] = extras[k];
    return ctx;
  }

  /* Alíquotas para exibição, coerentes com o resultado do motor. */
  function explicar(estado, operacao) {
    var st = estado || {};
    var ehLoc = operacao === 'locacao';
    var ibs = valorVigente(st, 'ibs_padrao'), cbs = valorVigente(st, 'cbs_padrao');
    var red = valorVigente(st, ehLoc ? 'reducao_locacao' : 'reducao_venda');
    // mesma sequência de arredondamento do motor: r4(padrão × eq) × (1 − red_motor)
    var redMotor = ehLoc ? 70 : 50;
    var fatorEq = red === redMotor ? 1 : (1 - red / 100) / (1 - redMotor / 100);
    var ibsF = r4(r4(ibs * fatorEq) * (1 - redMotor / 100)), cbsF = r4(r4(cbs * fatorEq) * (1 - redMotor / 100));
    return { ibs_padrao: ibs, cbs_padrao: cbs, reducao_pct: red,
             ibs_final: ibsF, cbs_final: cbsF,
             combinada_final: r4(ibsF + cbsF),
             editadas: alteradas(st).map(function (p) { return p.chave; }) };
  }

  /* Grau de certeza do resultado — aparece NO TOPO do resultado. */
  function grauCerteza(estado, res, ruleset) {
    var st = estado || {}, avisos = [], nivel = 'ALTA';
    var lista = listar(st);
    var estim = lista.filter(function (p) { return p.status === 'estimada'; });
    var pend  = lista.filter(function (p) { return p.status === 'pendente'; });
    var edit  = lista.filter(function (p) { return p.editada; });
    if (estim.length) { nivel = 'MEDIA';
      avisos.push({ tipo: 'estimada', msg: 'Simulação baseada em alíquotas estimadas e regras de transição. O resultado poderá ser atualizado conforme regulamentação posterior.' }); }
    if (pend.length) avisos.push({ tipo: 'pendente', msg: 'Premissas pendentes de regulamentação ou índice oficial: ' +
      pend.map(function (p) { return p.rotulo; }).join('; ') + '.' });
    if (edit.length) { nivel = 'BAIXA';
      avisos.push({ tipo: 'editada', msg: 'Há ' + edit.length + ' premissa(s) alterada(s) manualmente — o resultado é SIMULAÇÃO do usuário, não a aplicação automática da norma.' }); }
    if (res && res.confianca && res.confianca.nivel === 'BAIXA') nivel = 'BAIXA';
    if (res && res.confianca && res.confianca.nivel === 'MEDIA' && nivel === 'ALTA') nivel = 'MEDIA';
    return { nivel: nivel, avisos: avisos, ruleset: ruleset || null,
             premissas: lista, data_calculo: new Date().toISOString() };
  }

  var API = { VERSAO: VERSAO, CATALOGO: CATALOGO, CHAVES: CHAVES, novoEstado: novoEstado,
              validarEdicao: validarEdicao, editar: editar, restaurar: restaurar, restaurarTodas: restaurarTodas,
              valorVigente: valorVigente, listar: listar, alteradas: alteradas,
              montarCtx: montarCtx, explicar: explicar, grauCerteza: grauCerteza };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  raiz.ImobPremissas = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
