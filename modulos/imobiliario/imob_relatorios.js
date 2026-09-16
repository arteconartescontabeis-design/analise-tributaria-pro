/* ============================================================================
 * imob_relatorios.js — resultado sequencial, coerência matemática, relatórios
 * (executivo · técnico · memória de cálculo), comparação de simulações e
 * histórico local. v1.0.0 · módulo Análise Imobiliária Pro 1.3.0
 *
 * Tudo aqui é PURO: recebe o resultado do motorImob e devolve estruturas ou
 * HTML pronto para imprimir. Nada de DOM, nada de rede.
 * ==========================================================================*/
(function (raiz) {
  'use strict';
  var VERSAO = '1.1.0';   // 1.1.0: explicações simples, tabela de anos e relatório simplificado

  function r2(x) { return Math.round((+x + Number.EPSILON) * 100) / 100; }
  function r4(x) { return Math.round((+x + Number.EPSILON) * 10000) / 10000; }
  function money(v) { return (v == null || !isFinite(v)) ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pct(v, d) { return (v == null || !isFinite(v)) ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 4 : d }) + '%'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function dataBR(iso) { if (!iso) return '—'; var s = String(iso).slice(0, 10).split('-'); return s.length === 3 ? s[2] + '/' + s[1] + '/' + s[0] : iso; }
  function agora(iso) { var d = iso ? new Date(iso) : new Date(); return d.toLocaleString('pt-BR'); }

  function linha(res, desc) {
    var l = (res.linhas || []).filter(function (x) { return x.descricao === desc; });
    return l.length ? l[0] : null;
  }

  /* =========================================================================
     1. RESULTADO SEQUENCIAL DA ALIENAÇÃO (12 etapas com fórmula)
     ========================================================================= */
  var SIMPLES_V = {1: "O preço combinado da venda. É o ponto de partida.", 2: "Desconto que representa o valor que o imóvel já tinha antes da Reforma (art. 375). Só entra até o limite do preço.", 3: "Desconto extra da lei para moradia: R$ 100 mil no residencial novo, R$ 30 mil no lote (art. 259). Vale uma vez por imóvel.", 4: "É sobre este valor que o imposto é calculado: preço menos os dois descontos.", 5: "Imposto estadual/municipal novo. A alíquota já vem com 50% de desconto.", 6: "Imposto federal novo (substitui PIS e COFINS). Também com 50% de desconto.", 7: "IBS/CBS pagos nas compras da empresa que você informou.", 8: "Só é possível abater até o valor do imposto devido; o resto fica guardado.", 9: "Créditos que sobraram e podem ser usados nos próximos meses.", 10: "IBS + CBS antes de abater os créditos.", 11: "O que efetivamente sai do caixa com esta venda.", 12: "Quanto o imposto representa do preço de venda. Serve para comparar com outros cenários."};
  function resultadoVenda(res, e, expl) {
    var lRaj = linha(res, 'Redutor de ajuste') || {}, lSoc = linha(res, 'Redutor social') || {};
    var lCre = linha(res, 'Créditos de IBS/CBS apropriados') || {};
    var valor = e.valor_operacao, rajDisp = r2((lRaj.entrada || {}).saldo_disponivel || 0);
    var rajUsado = r2(res.redutor_ajuste_usado || 0), socUsado = r2(res.redutor_social_usado || 0);
    var socDisp = r2((lSoc.entrada || {}).valor_atualizado || 0);
    var credInf = r2((lCre.entrada || {}).creditos_informados || 0), credUsado = r2(res.creditos || 0);
    var bruto = r2(res.debito != null ? res.debito : (res.ibs || 0) + (res.cbs || 0));
    var etapas = [
      { n: 1, rotulo: 'Valor total da operação', valor: r2(valor), formula: 'valor informado', destaque: true },
      { n: 2, rotulo: 'Redutor de ajuste disponível', valor: rajDisp, formula: 'saldo do imóvel (art. 375); utilizado: min(saldo; valor) = ' + money(rajUsado),
        extra: 'utilizado ' + money(rajUsado) + ' · remanescente ' + money(res.redutor_ajuste_saldo || 0) },
      { n: 3, rotulo: 'Redutor social', valor: socUsado, formula: socDisp ? 'min(' + money(socDisp) + ' atualizado; base após redutor de ajuste)' : 'não aplicável ao tipo do imóvel (art. 259, §1º) ou já utilizado' },
      { n: 4, rotulo: 'Base de cálculo (antes dos créditos)', valor: r2(res.base), formula: money(valor) + ' − ' + money(rajUsado) + ' − ' + money(socUsado), destaque: true },
      { n: 5, rotulo: 'IBS calculado', valor: r2(res.ibs), formula: money(res.base) + ' × ' + pct(expl.ibs_final, 4) + ' (' + pct(expl.ibs_padrao, 2) + ' − ' + expl.reducao_pct + '%)' },
      { n: 6, rotulo: 'CBS calculada', valor: r2(res.cbs), formula: money(res.base) + ' × ' + pct(expl.cbs_final, 4) + ' (' + pct(expl.cbs_padrao, 2) + ' − ' + expl.reducao_pct + '%)' },
      { n: 7, rotulo: 'Créditos de IBS/CBS informados', valor: credInf, formula: 'valor informado pelo usuário' },
      { n: 8, rotulo: 'Créditos efetivamente aproveitados', valor: credUsado, formula: 'min(' + money(credInf) + '; débito ' + money(bruto) + ')' },
      { n: 9, rotulo: 'Saldo de créditos não utilizado', valor: r2(credInf - credUsado), formula: money(credInf) + ' − ' + money(credUsado) + ' (transporta para períodos seguintes, art. 53)' },
      { n: 10, rotulo: 'Total bruto (IBS + CBS)', valor: bruto, formula: money(res.ibs) + ' + ' + money(res.cbs), destaque: true },
      { n: 11, rotulo: 'Total líquido a recolher', valor: r2(res.total), formula: money(bruto) + ' − ' + money(credUsado), destaque: true, principal: true },
      { n: 12, rotulo: 'Carga efetiva sobre a operação', valor: null, texto: pct(res.aliquota_efetiva_sobre_operacao, 4), formula: money(res.total) + ' ÷ ' + money(valor) + ' × 100', destaque: true }
    ];
    etapas.forEach(function (x) { x.simples = SIMPLES_V[x.n]; });
    if (res.ano_teste_2026) etapas.push({ n: 13, rotulo: 'Ano-teste 2026', valor: r2(res.total), texto: 'IBS 0,1% + CBS 0,9% sobre a base; ' + (res.total === 0 ? 'dispensado (art. 348, §1º)' : 'sem dispensa'), formula: 'base × 1%' });
    return etapas;
  }

  var SIMPLES_L = {1: "Aluguel mensal vezes os meses (proporcional se o período for parcial).", 2: "IPTU, taxas e condomínio pagos pelo inquilino, com comprovante, não são receita sua.", 3: "Desconto de R$ 600 por mês, só no aluguel de moradia.", 4: "Valor sobre o qual o imposto é calculado.", 5: "Alíquota com 70% de desconto.", 6: "Alíquota com 70% de desconto.", 7: "Créditos abatidos, limitados ao imposto devido.", 8: "O que sai do caixa no período.", 9: "Percentual do aluguel que vira imposto.", 10: "Mesmo percentual projetado para 12 meses."};
  function resultadoLocacao(res, e, expl) {
    var loc = e.locacao || {}, meses = loc.meses || 1;
    var lExc = linha(res, 'Encargos do locatário excluídos da base') || {};
    var exc = r2(-(lExc.valor || 0)), soc = r2(res.redutor_social_usado || 0);
    var bruto = r2(res.debito != null ? res.debito : 0);
    var carga = res.aliquota_efetiva_sobre_operacao;
    return [
      { n: 1, rotulo: 'Receita bruta do período', valor: r2(e.valor_operacao), formula: money(loc.valor_mensal || e.valor_operacao / meses) + ' × ' + meses + ' mês(es)' + (loc.dias_no_mes ? ' · ' + loc.dias_no_mes + ' dias no mês' : ''), destaque: true },
      { n: 2, rotulo: 'Deduções — encargos do locatário (art. 364, §§ 3º e 4º)', valor: exc, formula: exc ? 'tributos + condomínio + foro, com prova de pagamento' : 'nenhuma dedução (sem prova de pagamento ou sem encargos)' },
      { n: 3, rotulo: 'Redutor social da locação residencial', valor: soc, formula: soc ? 'R$ 600 × fator × meses × proporção do período × fração residencial' : 'não aplicável (finalidade não residencial)' },
      { n: 4, rotulo: 'Base de cálculo', valor: r2(res.base), formula: money(e.valor_operacao) + ' − ' + money(exc) + ' − ' + money(soc), destaque: true },
      { n: 5, rotulo: 'IBS', valor: r2(res.ibs), formula: money(res.base) + ' × ' + pct(expl.ibs_final, 4) + ' (' + pct(expl.ibs_padrao, 2) + ' − ' + expl.reducao_pct + '%)' },
      { n: 6, rotulo: 'CBS', valor: r2(res.cbs), formula: money(res.base) + ' × ' + pct(expl.cbs_final, 4) + ' (' + pct(expl.cbs_padrao, 2) + ' − ' + expl.reducao_pct + '%)' },
      { n: 7, rotulo: 'Créditos aproveitados', valor: r2(res.creditos || 0), formula: 'min(créditos informados; ' + money(bruto) + ')' },
      { n: 8, rotulo: 'Total a recolher no período', valor: r2(res.total), formula: money(bruto) + ' − ' + money(res.creditos || 0), destaque: true, principal: true },
      { n: 9, rotulo: 'Carga efetiva mensal', valor: null, texto: pct(carga, 4), formula: 'total ÷ receita bruta × 100 (por mês: ' + money(res.total / meses) + ')', destaque: true },
      { n: 10, rotulo: 'Carga efetiva anual (12 meses, mesma base)', valor: null, texto: pct(carga, 4) + ' · ' + money(res.total / meses * 12) + '/ano', formula: 'total mensal × 12', destaque: true }
    ].map(function (x) { x.simples = SIMPLES_L[x.n]; return x; });
  }

  var SIMPLES_P = {1: "Valor do imóvel que você entrega.", 2: "Valor do imóvel que você recebe.", 3: "Diferença entre os dois.", 4: "A troca em si não paga imposto.", 5: "Dinheiro que iguala os valores. É a única parte tributada.", 6: "Valor sobre o qual o imposto é calculado.", 7: "Alíquota com 50% de desconto.", 8: "Alíquota com 50% de desconto.", 9: "O que sai do caixa nesta permuta.", 10: "O desconto do imóvel entregue passa para o imóvel recebido.", 11: "Total dividido pelo número de unidades a receber."};
  function resultadoPermuta(res, e, expl, dados) {
    dados = dados || {};
    var dado = r2(e.valor_operacao), rec = r2(dados.valor_recebido || dado);
    var torna = r2((e.permuta || {}).torna || 0);
    var permuta = r2(Math.min(dado, rec));
    var uni = dados.unidades > 0 ? dados.unidades : null;
    var et = [
      { n: 1, rotulo: 'Valor do imóvel dado', valor: dado, formula: 'valor informado' },
      { n: 2, rotulo: 'Valor do imóvel recebido', valor: rec, formula: dados.valor_recebido ? 'valor informado' : 'não informado — considerado igual ao dado' },
      { n: 3, rotulo: 'Diferença de valores', valor: r2(Math.abs(dado - rec)), formula: '|' + money(dado) + ' − ' + money(rec) + '|' },
      { n: 4, rotulo: 'Parcela considerada permuta imobiliária (não incidência)', valor: permuta, formula: 'min(dado; recebido) — art. 360, §3º, I', destaque: true },
      { n: 5, rotulo: 'Parcela considerada torna', valor: torna, formula: (e.permuta || {}).torna_paga_por === 'contribuinte' ? 'torna PAGA pelo contribuinte' : (e.permuta || {}).torna_paga_por === 'nao_contribuinte' ? 'torna RECEBIDA (paga pelo não contribuinte)' : 'sem torna' },
      { n: 6, rotulo: 'Parcela tributável (base de cálculo)', valor: r2(res.base), formula: 'só a torna é tributada, com redução de 50%', destaque: true },
      { n: 7, rotulo: 'IBS', valor: r2(res.ibs), formula: money(res.base) + ' × ' + pct(expl.ibs_final, 4) },
      { n: 8, rotulo: 'CBS', valor: r2(res.cbs), formula: money(res.base) + ' × ' + pct(expl.cbs_final, 4) },
      { n: 9, rotulo: 'Total da operação (IBS + CBS)', valor: r2(res.total), formula: money(res.ibs) + ' + ' + money(res.cbs), destaque: true, principal: true },
      { n: 10, rotulo: 'Redutor de ajuste do imóvel recebido', valor: res.redutor_ajuste_recebido, formula: res.redutor_ajuste_recebido == null ? 'não apurado (ver notas)' : 'art. 360, §§ 7º e 8º' }
    ];
    et.forEach(function (x) { x.simples = SIMPLES_P[x.n]; });
    if (uni) et.push({ n: 11, simples: SIMPLES_P[11], rotulo: 'Resultado por unidade futura (' + uni + ' un.)', valor: r2(res.total / uni), formula: money(res.total) + ' ÷ ' + uni + ' · redutor por unidade ' + money((res.redutor_ajuste_recebido || 0) / uni) });
    return et;
  }

  /* =========================================================================
     2. COERÊNCIA MATEMÁTICA — resultado × memória × alíquotas
     ========================================================================= */
  function coerencia(res, expl) {
    var checks = [];
    function c(nome, ok, esperado, obtido) { checks.push({ item: nome, ok: !!ok, esperado: esperado, obtido: obtido }); }
    if (!res || res.status !== 'CALCULADO') return { ok: false, checks: [{ item: 'cálculo', ok: false, esperado: 'CALCULADO', obtido: res && res.status }] };
    var tol = 0.011;
    var lIbs = (res.linhas || []).filter(function (l) { return /^IBS/.test(l.descricao); })[0];
    var lCbs = (res.linhas || []).filter(function (l) { return /^CBS/.test(l.descricao); })[0];
    var lAlq = (res.linhas || []).filter(function (l) { return /^Alíquotas reduzidas/.test(l.descricao); })[0];
    if (lIbs) c('IBS da memória = IBS do resultado', Math.abs(lIbs.valor - res.ibs) <= tol, res.ibs, lIbs.valor);
    if (lCbs) c('CBS da memória = CBS do resultado', Math.abs(lCbs.valor - res.cbs) <= tol, res.cbs, lCbs.valor);
    if (res.ibs != null && res.cbs != null) {
      var soma = r2(res.ibs + res.cbs);
      c('IBS + CBS = total bruto', Math.abs(soma - (res.debito != null ? res.debito : soma)) <= tol, res.debito, soma);
      c('total bruto − créditos = total líquido', Math.abs(r2((res.debito || 0) - (res.creditos || 0)) - res.total) <= tol, res.total, r2((res.debito || 0) - (res.creditos || 0)));
    }
    if (lAlq && expl) {
      c('alíquota IBS demonstrada = alíquota usada no cálculo', Math.abs(lAlq.ibs_reduzida - expl.ibs_final) <= 0.00011, expl.ibs_final, lAlq.ibs_reduzida);
      c('alíquota CBS demonstrada = alíquota usada no cálculo', Math.abs(lAlq.cbs_reduzida - expl.cbs_final) <= 0.00011, expl.cbs_final, lAlq.cbs_reduzida);
      if (!res.ano_teste_2026 && res.ibs != null) {
        c('base × alíquota IBS = IBS', Math.abs(r2(res.base * lAlq.ibs_reduzida / 100) - res.ibs) <= tol, res.ibs, r2(res.base * lAlq.ibs_reduzida / 100));
        c('base × alíquota CBS = CBS', Math.abs(r2(res.base * lAlq.cbs_reduzida / 100) - res.cbs) <= tol, res.cbs, r2(res.base * lAlq.cbs_reduzida / 100));
      }
    }
    var lBase = linha(res, 'Base de cálculo tributável');
    if (lBase) c('base da memória = base do resultado', Math.abs(lBase.valor - res.base) <= tol, res.base, lBase.valor);
    if (Array.isArray(res.parcelas) && res.parcelas.length && typeof res.parcelas[0] === 'object') {
      // v1.5.0 — as parcelas do motor são BRUTAS (antes dos créditos); a soma bate com o débito, não com o líquido.
      // A comparação com res.total barrava, sem motivo, todo relatório de venda parcelada com créditos.
      var sp = r2(res.parcelas.reduce(function (a, p) { return a + p.total; }, 0)), alvo = res.debito != null ? res.debito : res.total;
      c('soma das parcelas = total bruto', Math.abs(sp - alvo) <= tol, alvo, sp);
    }
    return { ok: checks.every(function (x) { return x.ok; }), checks: checks };
  }

  /* =========================================================================
     3. RELATÓRIOS — HTML para impressão (A4, sem biblioteca)
     ========================================================================= */
  var CSS = '.marca{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1a5276;padding-bottom:8px;margin-bottom:12px} .marca-txt{font-size:11px;color:#6b7a8d;text-align:right} ' + '.graf{margin:8px 0 14px;page-break-inside:avoid} .graf .mini{margin-bottom:4px;color:#6b7a8d;font-size:11px} .graf svg{max-width:100%}' + 'body{font-family:"DM Sans",Arial,sans-serif;color:#1f2d3d;font-size:12.5px;margin:0;padding:18mm 16mm}' +
    'h1{font-family:"Playfair Display",Georgia,serif;color:#1a5276;font-size:22px;margin:0 0 4px}' +
    'h2{font-family:"Playfair Display",Georgia,serif;color:#1a5276;font-size:15px;border-bottom:2px solid #d99a2b;padding-bottom:4px;margin:18px 0 8px;page-break-after:avoid}' +
    '.sub{color:#6b7a8d;font-size:11px;margin-bottom:14px}.box{border:1px solid #e3e8ee;border-radius:8px;padding:10px 12px;margin:8px 0;page-break-inside:avoid}' +
    '.alerta{background:#fdf3e3;border-left:4px solid #b9770e;padding:8px 12px;margin:8px 0;font-size:12px}.ok{background:#e8f6ee;border-left:4px solid #1e8449;padding:8px 12px;margin:8px 0}' +
    '.err{background:#fdecea;border-left:4px solid #c0392b;padding:8px 12px;margin:8px 0}' +
    'table{width:100%;border-collapse:collapse;font-size:11.5px;margin:6px 0}th{background:#1a5276;color:#fff;text-align:left;padding:5px 7px}td{padding:5px 7px;border-bottom:1px solid #e3e8ee;vertical-align:top}' +
    'td.num,th.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}tr{page-break-inside:avoid}tr.destaque td{font-weight:700;background:#f4f6f8}tr.principal td{font-size:13.5px;color:#1a5276}' +
    '.big{font-size:26px;font-weight:800;color:#1a5276}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.mini{font-size:10.5px;color:#6b7a8d}' +
    '.rod{margin-top:22px;border-top:1px dashed #ccc;padding-top:8px;font-size:10px;color:#8a93a6}.ed{color:#b9770e;font-weight:700}' +
    '@media print{@page{size:A4;margin:14mm}body{padding:0}}';

  function cabecalho(p, titulo, subtitulo) {
    var emp = p.empresa || {};
    var r = typeof globalThis !== 'undefined' ? globalThis : window, marca = r.ImobMarca;
    return (marca ? '<div class="marca">' + marca.img(44) + '<div class="marca-txt">' + esc(p.escritorio || marca.nome) + '</div></div>' : '') +
      '<h1>' + esc(titulo) + '</h1><div class="sub">' + esc(subtitulo || '') +
      (emp.nome ? ' · <b>' + esc(emp.nome) + '</b>' + (emp.cnpj ? ' · CNPJ ' + esc(emp.cnpj) : '') : '') +
      ' · emitido em ' + esc(agora()) + ' · ' + esc(p.escritorio || 'Artecon Artes Contábeis') + '</div>';
  }
  function avisosHTML(p) {
    var g = p.grau || { avisos: [] };
    return (g.avisos || []).map(function (a) { return '<div class="alerta">⚠️ ' + esc(a.msg) + '</div>'; }).join('') +
      '<div class="mini">Nível de confiança do resultado: <b>' + esc(g.nivel || (p.res.confianca && p.res.confianca.nivel) || '—') +
      '</b> · ruleset <code>' + esc(p.ruleset || '') + '</code> · motor ' + esc(p.motor || '') + ' · lacre ' + esc(p.lacre || '') + '</div>';
  }
  function tabelaEtapas(etapas) {
    return '<table><thead><tr><th style="width:26px">#</th><th>Etapa</th><th>Fórmula</th><th class="num">Valor</th></tr></thead><tbody>' +
      etapas.map(function (x) {
        return '<tr class="' + (x.principal ? 'destaque principal' : x.destaque ? 'destaque' : '') + '"><td>' + x.n + '</td><td>' + esc(x.rotulo) +
          (x.extra ? '<div class="mini">' + esc(x.extra) + '</div>' : '') + '</td><td class="mini">' + esc(x.formula || '') + (x.simples ? '<br><i>' + esc(x.simples) + '</i>' : '') + '</td><td class="num">' +
          (x.texto != null ? esc(x.texto) : money(x.valor)) + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  function premissasHTML(p) {
    var lista = (p.premissas || []);
    if (!lista.length) return '';
    return '<table><thead><tr><th>Premissa</th><th class="num">Valor automático</th><th class="num">Valor utilizado</th><th>Origem / status</th><th>Justificativa</th></tr></thead><tbody>' +
      lista.map(function (x) {
        var fmt = function (v) { return x.unidade === 'R$' ? money(v) : x.unidade === '%' ? pct(v, 2) : String(v); };
        return '<tr' + (x.editada ? ' style="background:#fdf3e3"' : '') + '><td>' + esc(x.rotulo) + '</td><td class="num">' + fmt(x.valor_automatico) +
          '</td><td class="num">' + (x.editada ? '<span class="ed">' + fmt(x.valor_vigente) + ' ✎</span>' : fmt(x.valor_vigente)) +
          '</td><td class="mini">' + esc(x.origem) + ' · ' + esc(x.status) + (x.data_premissa && x.data_premissa !== '—' ? ' · ' + esc(x.data_premissa) : '') +
          '</td><td class="mini">' + (x.editada ? esc(x.justificativa) + ' <i>(' + esc(agora(x.quando)) + ')</i>' : '—') + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  function envelope(titulo, corpo) {
    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>' + esc(titulo) + '</title><style>' + CSS + '</style></head><body>' + corpo +
      '<div class="rod">Documento gerado pelo Análise Imobiliária Pro (Artecon). A alíquota de referência de IBS/CBS é estimativa não vinculante (Res. CGIBS 14/2026). ' +
      'IRPJ e CSLL permanecem devidos e não estão incluídos nos valores de IBS/CBS. Este documento não substitui o parecer assinado pelo responsável técnico.</div></body></html>';
  }


  /* Tabela "valor do imposto em cada ano" — recebe p.anos = [{ano, ibs, cbs, total, classificacao, ano_teste}] */
  function G() { var r = typeof globalThis !== 'undefined' ? globalThis : window; return r.ImobGraficos || null; }
  function anosParaGrafico(anos) { return (anos || []).map(function (a) { var s = (+a.ibs || 0) + (+a.cbs || 0); return { ano: a.ano, ano_teste: a.ano_teste, valor_total: +a.total || 0, valor_ibs: s ? (+a.total || 0) * (+a.ibs || 0) / s : 0, valor_cbs: s ? (+a.total || 0) * (+a.cbs || 0) / s : 0 }; }); }
  /* v1.5.0 — gráficos de apresentação: composição da base, IBS × CBS e (se houver) comparativo */
  function graficosHTML(p) {
    var g = G(); if (!g) return '';
    var res = p.res || {}, e = p.entrada || {};
    var h = '';
    var c1 = g.composicaoBase({ valor_operacao: e.valor_operacao, redutor_ajuste: res.redutor_ajuste_usado, redutor_social: res.redutor_social_usado, deducoes: res.deducoes, base: res.base });
    var c2 = g.ibsCbs({ ibs: res.ibs, cbs: res.cbs, creditos: res.creditos, total: res.total, carga: pct(res.aliquota_efetiva_sobre_operacao, 2) });
    if (c1) h += '<div class="graf"><div class="mini">Composição da base de cálculo</div>' + c1 + '</div>';
    if (c2) h += '<div class="graf"><div class="mini">Imposto por tributo</div>' + c2 + '</div>';
    var cl = p.comparativo && p.comparativo.linhas; if (cl && cl.length >= 2) h += '<div class="graf"><div class="mini">Hoje × Reforma (tributos substituíveis + IRPJ/CSLL)</div>' + g.comparativo({ hoje: cl[0].total, reforma: cl[1].total }) + '</div>';
    return h ? '<h2>Em gráficos</h2>' + h : '';
  }
  function anosGraficoHTML(anos) { var g = G(); if (!g || !anos || !anos.length) return ''; var ano2033 = anos.filter(function (a) { return a.ano === 2033; })[0]; return '<div class="graf">' + g.anoAAno(anosParaGrafico(anos), { destacar: ano2033 ? 2033 : null }) + '</div>'; }

  function anosHTML(anos) {
    if (!anos || !anos.length) return '';
    return '<h2>Quanto seria o imposto em cada ano (2026 a 2033)</h2><p class="mini">A Reforma entra aos poucos: 2026 é ano-teste (0,1% + 0,9%), a CBS começa em 2027 e o IBS sobe até 2033. A mesma operação, feita em anos diferentes, paga valores diferentes.</p>' +
      anosGraficoHTML(anos) +
      '<table><thead><tr><th>Ano</th><th class="num">IBS</th><th class="num">CBS</th><th class="num">Imposto na operação</th><th>Alíquota</th></tr></thead><tbody>' +
      anos.map(function (a) { return '<tr' + (a.ano === 2033 ? ' class="destaque"' : '') + '><td>' + a.ano + (a.ano_teste ? ' (ano-teste)' : '') + '</td><td class="num">' + pct(a.ibs, 2) + '</td><td class="num">' + pct(a.cbs, 2) + '</td><td class="num"><b>' + money(a.total) + '</b></td><td>' + esc(a.classificacao) + '</td></tr>'; }).join('') + '</tbody></table>';
  }

  /* RELATÓRIO SIMPLIFICADO — para o cliente sem conhecimento técnico */
  function montarSimplificado(p) {
    var res = p.res, e = p.entrada, im = p.imovel || e.imovel || {}, pes = p.empresa || {};
    var op = { venda: 'venda', locacao: 'aluguel', permuta: 'permuta (troca)' }[e.operacao] || e.operacao;
    var principal = (p.etapas || []).filter(function (x) { return x.principal; })[0];
    var corpo = cabecalho(p, 'Resumo para o cliente — ' + op + ' de imóvel', 'Explicação em linguagem simples') +
      '<div class="alerta">Este resumo usa as alíquotas de referência divulgadas pelo governo, que ainda podem mudar. Os valores são uma estimativa séria, não um valor definitivo de imposto.</div>' +
      '<h2>1. De quem e de qual imóvel estamos falando</h2><div class="box">' +
      '<b>' + esc(pes.nome || '—') + '</b>' + (pes.cnpj ? ' · ' + esc(pes.cnpj) : '') + (pes.tipo ? ' · ' + (pes.tipo === 'PF' ? 'pessoa física' : 'empresa') : '') +
      '<br>Imóvel: <b>' + esc(im.codigo_interno || im.id || '—') + '</b>' + (im.endereco ? ' · ' + esc(im.endereco) : '') + (im.municipio ? ' · ' + esc(im.municipio) + (im.uf ? '/' + esc(im.uf) : '') : '') + (im.tipo ? ' · ' + esc(String(im.tipo).replace(/_/g, ' ')) : '') +
      '<br>Operação: <b>' + esc(op) + '</b> em ' + dataBR(e.data_fato_gerador) + ' · valor ' + money(e.valor_operacao) + '</div>' +
      '<h2>2. A resposta em uma linha</h2><div class="box"><div class="grid"><div><div class="mini">Valor da operação</div><div class="big">' + money(e.valor_operacao) + '</div></div>' +
      '<div><div class="mini">Imposto novo (IBS + CBS)</div><div class="big">' + money(res.total) + '</div></div><div><div class="mini">Isso representa</div><div class="big">' + pct(res.aliquota_efetiva_sobre_operacao, 2) + '</div><div class="mini">do valor da operação</div></div></div></div>' +
      (p.comparativo && p.comparativo.variacao != null ? '<div class="' + (p.comparativo.variacao > 0 ? 'alerta' : 'ok') + '">Comparando com o que se paga hoje (PIS, COFINS e ISS): ' + (p.comparativo.variacao > 0 ? 'a Reforma <b>aumenta</b>' : 'a Reforma <b>reduz</b>') + ' o imposto em <b>' + money(Math.abs(p.comparativo.variacao)) + '</b>. IRPJ e CSLL continuam iguais nos dois casos.</div>' : '') +
      graficosHTML(p) +
      '<h2>3. Como chegamos a esse número</h2><table><thead><tr><th>Passo</th><th>O que é</th><th class="num">Valor</th></tr></thead><tbody>' +
      (p.etapas || []).map(function (x) { return '<tr class="' + (x.principal ? 'destaque principal' : x.destaque ? 'destaque' : '') + '"><td>' + x.n + '. ' + esc(x.rotulo) + '</td><td class="mini">' + esc(x.simples || x.formula || '') + '</td><td class="num">' + (x.texto != null ? esc(x.texto) : money(x.valor)) + '</td></tr>'; }).join('') + '</tbody></table>' +
      anosHTML(p.anos) +
      '<h2>4. O que você precisa saber</h2><ul>' +
      '<li><b>Não é o único imposto.</b> IRPJ e CSLL (impostos sobre o lucro) continuam existindo e não estão neste valor.</li>' +
      '<li><b>O desconto do imóvel (redutor de ajuste) precisa ser escolhido até 31/12/2026.</b> Depois disso não há mais como aproveitá-lo. ' + (res.redutor_ajuste_usado ? 'Neste cálculo ele valeu ' + money(res.redutor_ajuste_usado) + ' de desconto na base.' : 'Neste cálculo não foi usado redutor.') + '</li>' +
      '<li><b>As alíquotas ainda são estimativas.</b> O governo divulgou valores de referência (' + pct(p.expl && p.expl.ibs_padrao, 2) + ' IBS e ' + pct(p.expl && p.expl.cbs_padrao, 2) + ' CBS); a lei pode ajustá-los.</li>' +
      ((p.premissas || []).some(function (x) { return x.editada; }) ? '<li><b>Este cálculo usa premissas alteradas manualmente</b> a seu pedido: ' + (p.premissas || []).filter(function (x) { return x.editada; }).map(function (x) { return esc(x.rotulo) + ' (' + esc(x.justificativa) + ')'; }).join('; ') + '.</li>' : '') +
      (res.notas || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<h2>5. Próximos passos sugeridos</h2><p>' + esc(p.recomendacao || 'Confirmar os dados do imóvel (matrícula, valor de aquisição e valor de referência), formalizar a escolha do redutor de ajuste até 31/12/2026 e guardar a memória de cálculo completa, que acompanha este resumo.') + '</p>';
    return envelope('Resumo para o cliente', corpo);
  }

  /* p = { titulo_operacao, entrada, res, etapas, grau, premissas, coerencia,
           auditoria, comparativo, ruleset, motor, lacre, empresa, imovel,
           recomendacao, ressalvas } */
  function montarExecutivo(p) {
    var res = p.res, e = p.entrada, im = p.imovel || e.imovel || {};
    var econ = p.comparativo && p.comparativo.variacao != null ? p.comparativo.variacao : null;
    var corpo = cabecalho(p, 'Relatório executivo — ' + (p.titulo_operacao || e.operacao), 'Regime específico de bens imóveis · IBS/CBS') + avisosHTML(p) +
      '<h2>1. Identificação</h2><div class="box"><table><tbody>' +
      '<tr><td>Operação</td><td><b>' + esc(p.titulo_operacao || e.operacao) + '</b></td><td>Data do fato gerador</td><td>' + dataBR(e.data_fato_gerador) + '</td></tr>' +
      '<tr><td>Imóvel</td><td>' + esc(im.codigo_interno || im.id || '—') + (im.tipo ? ' · ' + esc(im.tipo) : '') + '</td><td>Matrícula / município</td><td>' + esc(im.matricula || '—') + ' · ' + esc(im.municipio || '—') + (im.uf ? '/' + esc(im.uf) : '') + '</td></tr>' +
      '</tbody></table></div>' +
      '<h2>2. Objetivo</h2><p>Demonstrar a tributação de IBS e CBS da operação pelo regime específico de bens imóveis (LC 214/2025, arts. 251 a 270) e o impacto sobre o valor da operação.</p>' +
      '<h2>3. Conclusão</h2><div class="box"><div class="grid"><div><div class="mini">Valor da operação</div><div class="big">' + money(e.valor_operacao) + '</div></div>' +
      '<div><div class="mini">IBS + CBS a recolher</div><div class="big">' + money(res.total) + '</div><div class="mini">IBS ' + money(res.ibs) + ' · CBS ' + money(res.cbs) + '</div></div>' +
      '<div><div class="mini">Carga efetiva</div><div class="big">' + pct(res.aliquota_efetiva_sobre_operacao, 4) + '</div></div></div></div>' +
      (econ != null ? '<div class="' + (econ > 0 ? 'alerta' : 'ok') + '">' + (econ > 0 ? 'Acréscimo' : 'Economia') + ' estimado(a) frente à tributação atual: <b>' + money(Math.abs(econ)) + '</b> (' + pct(Math.abs(p.comparativo.variacao_pct), 2) + ') — IRPJ/CSLL computados nos dois lados.</div>' : '') +
      graficosHTML(p) + anosHTML(p.anos) +
      '<h2>4. Recomendação</h2><p>' + esc(p.recomendacao || (p.auditoria && p.auditoria.permite_conclusao_definitiva
        ? 'Os dados permitem conclusão no nível ' + p.auditoria.nivel_confianca + '. Recomenda-se formalizar a opção do art. 375 e conservar a memória de cálculo anexa.'
        : 'Há impedimentos à conclusão definitiva (ver ressalvas). Recomenda-se completar os dados apontados antes de qualquer decisão.')) + '</p>' +
      '<h2>5. Ressalvas</h2>' + (p.ressalvas || []).concat(res.notas || []).map(function (x) { return '<div class="alerta">' + esc(x) + '</div>'; }).join('');
    return envelope('Relatório executivo', corpo);
  }

  function montarTecnico(p) {
    var res = p.res, e = p.entrada;
    var regras = (res.regras_aplicadas || []).map(function (id) { var r = (p.regras || {})[id] || {}; return { id: id, nome: r.nome, status: r.status, fontes: r.fontes || [] }; });
    var corpo = cabecalho(p, 'Relatório técnico — ' + (p.titulo_operacao || e.operacao), 'Premissas, regras, metodologia, cálculos e fundamentos') + avisosHTML(p) +
      '<h2>1. Premissas</h2>' + premissasHTML(p) +
      '<h2>2. Regras utilizadas</h2><table><thead><tr><th>Regra</th><th>Nome</th><th>Status</th><th>Fontes</th></tr></thead><tbody>' +
      regras.map(function (r) { return '<tr><td><code>' + esc(r.id) + '</code></td><td>' + esc(r.nome || '') + '</td><td>' + esc(r.status || '') + '</td><td class="mini">' + r.fontes.map(esc).join('<br>') + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<h2>3. Metodologia</h2><p>O motor determinístico <b>motorImob</b> aplica, na ordem: (i) valor da operação; (ii) redutor de ajuste do imóvel (arts. 257/258 da LC; 369 a 375 do RIBS/RCBS); (iii) redutor social (art. 259/260; 376 a 378); (iv) base de cálculo; (v) alíquotas reduzidas em 50% ou 70% (art. 261; 379); (vi) créditos limitados ao débito (arts. 47 a 57). Nenhum valor é estimado em silêncio: dado ausente bloqueia o cálculo.</p>' +
      '<h2>4. Cálculos</h2>' + tabelaEtapas(p.etapas || []) +
      anosHTML(p.anos) +
      '<h2>5. Cenários</h2>' + (p.comparativo && p.comparativo.linhas ? '<table><thead><tr><th>Cenário</th><th class="num">Substituíveis</th><th class="num">Permanentes (IRPJ/CSLL)</th><th class="num">Total</th></tr></thead><tbody>' +
        p.comparativo.linhas.map(function (l) { return '<tr><td>' + esc(l.cenario) + '</td><td class="num">' + money(l.substituiveis) + '</td><td class="num">' + money(l.permanentes) + '</td><td class="num"><b>' + money(l.total) + '</b></td></tr>'; }).join('') + '</tbody></table>' : '<p class="mini">Comparativo não gerado nesta simulação.</p>') +
      '<h2>6. Fundamentos</h2><ul>' + fontes(res, p.regras).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
      '<h2>7. Conclusão técnica</h2><div class="box">Total de IBS/CBS apurado: <b>' + money(res.total) + '</b> sobre base de ' + money(res.base) + ' (carga efetiva ' + pct(res.aliquota_efetiva_sobre_operacao, 4) + '). ' +
      (p.auditoria ? 'Auditoria: confiança <b>' + esc(p.auditoria.nivel_confianca) + '</b> — ' + esc(p.auditoria.mensagem || '') : '') + '</div>' +
      (p.coerencia ? coerenciaHTML(p.coerencia) : '');
    return envelope('Relatório técnico', corpo);
  }

  function coerenciaHTML(c) {
    return '<h2>Conferência matemática</h2><div class="' + (c.ok ? 'ok' : 'err') + '">' + (c.ok ? '✅ Memória de cálculo, alíquotas demonstradas, bases e resultado final são coerentes.' : '❌ Há divergência entre memória e resultado — não usar este documento.') + '</div>' +
      '<table><thead><tr><th>Verificação</th><th class="num">Esperado</th><th class="num">Obtido</th><th>Status</th></tr></thead><tbody>' +
      c.checks.map(function (x) { return '<tr><td>' + esc(x.item) + '</td><td class="num">' + (typeof x.esperado === 'number' ? money(x.esperado) : esc(x.esperado)) + '</td><td class="num">' + (typeof x.obtido === 'number' ? money(x.obtido) : esc(x.obtido)) + '</td><td>' + (x.ok ? 'OK' : 'DIVERGE') + '</td></tr>'; }).join('') + '</tbody></table>';
  }

  function fontes(res, regras) {
    var out = [];
    (res.regras_aplicadas || []).forEach(function (id) { (((regras || {})[id] || {}).fontes || []).forEach(function (f) { if (out.indexOf(f) < 0) out.push(f); }); });
    return out;
  }

  function montarMemoria(p) {
    var res = p.res, expl = p.expl || {};
    var corpo = cabecalho(p, 'Memória de cálculo — ' + (p.titulo_operacao || p.entrada.operacao), 'Fórmula, valores, alíquotas, redutores, créditos, bases e fundamentos de cada linha') + avisosHTML(p) +
      '<h2>Alíquotas</h2><table><tbody><tr><td>IBS padrão</td><td class="num">' + pct(expl.ibs_padrao, 2) + '</td><td>CBS padrão</td><td class="num">' + pct(expl.cbs_padrao, 2) + '</td></tr>' +
      '<tr><td>Redução aplicada</td><td class="num">' + pct(expl.reducao_pct, 0) + '</td><td>Combinada final</td><td class="num">' + pct(expl.combinada_final, 4) + '</td></tr>' +
      '<tr><td><b>IBS final</b></td><td class="num"><b>' + pct(expl.ibs_final, 4) + '</b></td><td><b>CBS final</b></td><td class="num"><b>' + pct(expl.cbs_final, 4) + '</b></td></tr></tbody></table>' +
      '<h2>Linhas da memória</h2><table><thead><tr><th>#</th><th>Linha</th><th>Fórmula</th><th>Valores utilizados</th><th class="num">Resultado</th><th>Fundamento</th></tr></thead><tbody>' +
      (res.linhas || []).map(function (l) {
        var ehAlq = l.ibs_reduzida != null;
        var vals = l.entrada ? Object.keys(l.entrada).map(function (k) { var v = l.entrada[k]; return k.replace(/_/g, ' ') + ': ' + (typeof v === 'number' ? (/aliquota|padrao|fator|proporcao|fracao/.test(k) ? String(v).replace('.', ',') : money(v)) : esc(String(v))); }).join('; ') : '—';
        var resTxt = ehAlq ? 'IBS ' + pct(l.ibs_reduzida, 4) + ' · CBS ' + pct(l.cbs_reduzida, 4) : money(l.valor);
        return '<tr><td>' + l.ordem + '</td><td><b>' + esc(l.descricao) + '</b></td><td class="mini">' + esc(l.formula || '') + '</td><td class="mini">' + vals + '</td><td class="num">' + resTxt + '</td><td class="mini">' + (l.fundamentos || []).map(esc).join('<br>') + '<br><code>' + esc(l.regra_id) + ' v' + esc(l.regra_versao) + '</code></td></tr>'; }).join('') +
      '</tbody></table>' +
      (Array.isArray(res.parcelas) && res.parcelas.length && typeof res.parcelas[0] === 'object' ? '<h2>Parcelas (art. 380)</h2><table><thead><tr><th>#</th><th class="num">Pagamento</th><th class="num">Proporção</th><th class="num">Redutor</th><th class="num">Base</th><th class="num">IBS</th><th class="num">CBS</th><th class="num">Devido</th></tr></thead><tbody>' +
        res.parcelas.map(function (x) { return '<tr><td>' + x.ordem + '</td><td class="num">' + money(x.pagamento) + '</td><td class="num">' + pct(x.proporcao, 4) + '</td><td class="num">' + money(x.redutor_aplicado) + '</td><td class="num">' + money(x.base) + '</td><td class="num">' + money(x.ibs) + '</td><td class="num">' + money(x.cbs) + '</td><td class="num"><b>' + money(x.total) + '</b></td></tr>'; }).join('') + '</tbody></table>' : '') +
      '<h2>Resultado</h2><div class="box"><div class="grid"><div><div class="mini">Base</div><div class="big">' + money(res.base) + '</div></div><div><div class="mini">IBS + CBS</div><div class="big">' + money(res.total) + '</div></div><div><div class="mini">Carga efetiva</div><div class="big">' + pct(res.aliquota_efetiva_sobre_operacao, 4) + '</div></div></div></div>' +
      (res.notas && res.notas.length ? '<h2>Notas</h2>' + res.notas.map(function (x) { return '<div class="alerta">' + esc(x) + '</div>'; }).join('') : '') +
      '<h2>Premissas</h2>' + premissasHTML(p) + (p.coerencia ? coerenciaHTML(p.coerencia) : '') +
      '<div class="mini" style="margin-top:12px">Versão do motor: <b>' + esc(p.motor) + '</b> · ruleset <b>' + esc(p.ruleset) + '</b> · lacre <b>' + esc(p.lacre) + '</b> · aplicativo v' + esc(p.app_versao || '') + ' · data e hora do cálculo: <b>' + esc(agora(p.calculado_em)) + '</b></div>';
    return envelope('Memória de cálculo', corpo);
  }

  /* =========================================================================
     4. HISTÓRICO LOCAL — simulações preliminares × cálculos finais
     ========================================================================= */
  function normalizarSimulacao(s) {
    var e = s.entrada || {}, r = s.resultado || s.res || {};
    var lRaj = linha(r, 'Redutor de ajuste') || {};
    var lAlq = (r.linhas || []).filter(function (l) { return l.ibs_reduzida != null; })[0] || {};
    return {
      id: s.id || ('sim-' + (s.quando || Date.now())), quando: s.quando || s.calculado_em || new Date().toISOString(),
      status: s.status || (s.hash_snapshot ? 'final' : 'preliminar'), usuario: s.usuario || s.calculado_por || null,
      empresa: s.empresa || s.empresa_id || (e.imovel && e.imovel.empresa) || null,
      imovel: s.imovel || (e.imovel && (e.imovel.codigo_interno || e.imovel.id)) || null,
      operacao: e.operacao || s.operacao || null, data_fato_gerador: e.data_fato_gerador || null,
      valor_operacao: e.valor_operacao != null ? e.valor_operacao : null,
      redutor: r.redutor_ajuste_usado != null ? r.redutor_ajuste_usado : (e.redutor_ajuste_saldo || 0),
      aliquota_ibs: lAlq.ibs_reduzida != null ? lAlq.ibs_reduzida : null, aliquota_cbs: lAlq.cbs_reduzida != null ? lAlq.cbs_reduzida : null,
      base: r.base != null ? r.base : null, ibs: r.ibs, cbs: r.cbs, creditos: r.creditos, total: r.total != null ? r.total : null,
      confianca: s.nivel_confianca || (r.confianca && r.confianca.nivel) || null,
      hash: s.hash_snapshot || null, motor: s.motor_versao || (r.carimbo && r.carimbo.motor_versao) || null,
      ruleset: s.ruleset_versao || (r.carimbo && r.carimbo.ruleset_versao) || null,
      premissas: s.premissas || null, entrada: e, resultado: r
    };
  }

  function filtrarHistorico(lista, f) {
    f = f || {};
    var q = function (s) { return String(s == null ? '' : s).toLowerCase(); };
    return (lista || []).map(normalizarSimulacao).filter(function (s) {
      if (f.empresa && q(s.empresa).indexOf(q(f.empresa)) < 0) return false;
      if (f.imovel && q(s.imovel).indexOf(q(f.imovel)) < 0) return false;
      if (f.operacao && s.operacao !== f.operacao) return false;
      if (f.status && s.status !== f.status) return false;
      if (f.de && String(s.quando).slice(0, 10) < f.de) return false;
      if (f.ate && String(s.quando).slice(0, 10) > f.ate) return false;
      return true;
    }).sort(function (a, b) { return a.quando < b.quando ? 1 : -1; });
  }

  var ITENS_COMP = [
    { chave: 'valor_operacao', rotulo: 'Valor da operação', tipo: 'money' },
    { chave: 'redutor', rotulo: 'Redutor', tipo: 'money' },
    { chave: 'aliquota_ibs', rotulo: 'Alíquota IBS', tipo: 'pct' },
    { chave: 'aliquota_cbs', rotulo: 'Alíquota CBS', tipo: 'pct' },
    { chave: 'base', rotulo: 'Base de cálculo', tipo: 'money' },
    { chave: 'ibs', rotulo: 'IBS', tipo: 'money' },
    { chave: 'cbs', rotulo: 'CBS', tipo: 'money' },
    { chave: 'creditos', rotulo: 'Créditos', tipo: 'money' },
    { chave: 'total', rotulo: 'Total devido', tipo: 'money' }
  ];
  function compararSimulacoes(a, b) {
    a = normalizarSimulacao(a); b = normalizarSimulacao(b);
    var itens = ITENS_COMP.map(function (it) {
      var va = a[it.chave], vb = b[it.chave];
      var dif = (typeof va === 'number' && typeof vb === 'number') ? (it.tipo === 'pct' ? r4(vb - va) : r2(vb - va)) : null;
      return { item: it.rotulo, tipo: it.tipo, anterior: va, atual: vb, alteracao: dif, mudou: dif !== null ? Math.abs(dif) > (it.tipo === 'pct' ? 0.00001 : 0.005) : (va !== vb) };
    });
    var alteradas = [];
    ['operacao', 'data_fato_gerador', 'empresa', 'imovel', 'ruleset', 'motor', 'status'].forEach(function (k) { if (a[k] !== b[k]) alteradas.push({ campo: k, anterior: a[k], atual: b[k] }); });
    var pa = JSON.stringify(a.premissas || null), pb = JSON.stringify(b.premissas || null);
    if (pa !== pb) alteradas.push({ campo: 'premissas', anterior: a.premissas ? 'editadas' : 'automáticas', atual: b.premissas ? 'editadas' : 'automáticas' });
    return { anterior: a, atual: b, itens: itens, campos_alterados: alteradas,
             identicas: itens.every(function (i) { return !i.mudou; }) && !alteradas.length };
  }

  function exportarCSV(lista) {
    var cab = ['quando', 'status', 'empresa', 'imovel', 'operacao', 'data_fato_gerador', 'valor_operacao', 'base', 'ibs', 'cbs', 'creditos', 'total', 'confianca', 'usuario', 'hash', 'motor', 'ruleset'];
    var linhas = [cab.join(';')].concat((lista || []).map(normalizarSimulacao).map(function (s) {
      return cab.map(function (k) { var v = s[k]; if (typeof v === 'number') return String(v).replace('.', ','); return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';'); }));
    return '\ufeff' + linhas.join('\r\n');
  }

  var API = { VERSAO: VERSAO, money: money, pct: pct, esc: esc, dataBR: dataBR,
              resultadoVenda: resultadoVenda, resultadoLocacao: resultadoLocacao, resultadoPermuta: resultadoPermuta,
              coerencia: coerencia, anosHTML: anosHTML, montarSimplificado: montarSimplificado, montarExecutivo: montarExecutivo, montarTecnico: montarTecnico, montarMemoria: montarMemoria,
              normalizarSimulacao: normalizarSimulacao, filtrarHistorico: filtrarHistorico, compararSimulacoes: compararSimulacoes,
              exportarCSV: exportarCSV, ITENS_COMP: ITENS_COMP };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  raiz.ImobRelatorios = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
