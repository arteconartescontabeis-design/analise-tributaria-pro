/* ===========================================================================
   MOTOR IMOBILIÁRIO — Análise Tributária Pro / módulo "Imobiliário"
   Fase 0 · Passos 2 e 3 do Guia de Implementação
   ---------------------------------------------------------------------------
   REGRA DE OURO: este arquivo NÃO conhece e NÃO altera o motor genérico do ATP
   (Simples / LP / LR / transição 2026-2033). Ele apenas RECEBE as alíquotas já
   calculadas pelo motor genérico via ctx.aliquotas. Nenhuma função daqui pode
   ser chamada pelo motor genérico, e o lacre deste motor (LACRE_IMOB) é
   independente do lacre do motor genérico (5a5562df).

   ARQUITETURA: funções puras. Sem DOM, sem fetch, sem Supabase, sem estado
   global. Entrada JSON → saída JSON. Mesma entrada + mesma versão = mesmo
   resultado (idempotência exigida pela Seção 13 do Prompt v5).

   VERSÕES
   MOTOR_IMOB_VERSAO      versão do código do motor
   CONTRATO_VERSAO        versão do contrato de entrada/saída (JSON)
   RULESET_VERSAO         versão do conjunto de regras aplicado
   =========================================================================== */
(function (raiz) {
  'use strict';

  var MOTOR_IMOB_VERSAO = '1.2.0';
  var CONTRATO_VERSAO   = 'calc-imob-1';
  var RULESET_VERSAO    = 'imob-2026.08.21';

  /* =========================================================================
     1. POLÍTICA MATEMÁTICA ÚNICA (Passo 3 / Seção 14 do Prompt v5)
     -------------------------------------------------------------------------
     P1. Precisão interna: ponto flutuante pleno. NUNCA arredondar no meio.
     P2. Arredondamento: só na EXIBIÇÃO e no valor final de cada tributo,
         2 casas, half-away-from-zero (0,005 -> 0,01; -0,005 -> -0,01).
     P3. Totais: somam parcelas JÁ arredondadas (mesma regra do r2/somaExib do
         motor genérico) — evita total ≠ soma das linhas no relatório.
     P4. Alíquotas: guardadas em PONTOS PERCENTUAIS com 4 casas (ex. 18,7000).
         Convertidas para fração só dentro do cálculo.
     P5. Base negativa: proibida. Todo redutor é limitado ao saldo da base
         (LC 214/2025, art. 259, caput — "até o limite do valor da base").
     P6. Ordem dos redutores: redutor de ajuste PRIMEIRO, redutor social DEPOIS
         (art. 259 — "após a dedução do redutor de ajuste").
     P7. Rateio em parcelas: proporcional ao valor total do bem (art. 262, §4º).
         O resíduo de centavos vai para a ÚLTIMA parcela, de modo que
         Σ parcelas arredondadas ≡ total arredondado.
     P8. Índices (IPCA): nunca gravar valor atualizado hardcoded. Guarda-se
         valor original + fator + competência; a atualização é multiplicação
         explícita e rastreável.
     ========================================================================= */

  function r2(x) {                        // P2
    if (typeof x !== 'number' || !isFinite(x)) return 0;
    var s = x < 0 ? -1 : 1;
    return s * Math.round(Math.abs(x) * 100 + 1e-9) / 100;
  }
  function r4(x) {                        // P4
    if (typeof x !== 'number' || !isFinite(x)) return 0;
    var s = x < 0 ? -1 : 1;
    return s * Math.round(Math.abs(x) * 10000 + 1e-9) / 10000;
  }
  function somaExib(arr) {                // P3
    var t = 0; for (var i = 0; i < arr.length; i++) t += r2(arr[i]); return r2(t);
  }
  function naoNeg(x) { return x > 0 ? x : 0; }                       // P5
  function aplicarRedutor(base, redutor) {                           // P5
    var usado = Math.min(naoNeg(redutor), naoNeg(base));
    return { base: naoNeg(base - usado), usado: usado, saldo: naoNeg(redutor - usado) };
  }
  function atualizarPorIndice(valorOriginal, fator) {                // P8
    return naoNeg(valorOriginal) * (typeof fator === 'number' && fator > 0 ? fator : 1);
  }
  function ratearParcelas(total, n) {                                // P7
    var out = [], acum = 0, i, v;
    for (i = 0; i < n; i++) {
      if (i === n - 1) { v = r2(r2(total) - acum); }
      else { v = r2(total / n); acum = r2(acum + v); }
      out.push(v);
    }
    return out;
  }

  /* =========================================================================
     2. CATÁLOGO DE REGRAS (espelho do que vai para atp_imob_regras)
     -------------------------------------------------------------------------
     status: draft | staging | homologada | ativa | suspensa | revogada
     Nenhuma regra nasce "ativa". A promoção depende de hash_fonte real do
     Passo 0 + dupla aprovação do Passo 6.
     ========================================================================= */
  var REGRAS = {
    'IMOB-BASE-001': { nome: 'Base de cálculo da alienação', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, arts. 251, 252 e 255', 'RIBS art. 359, 360 e 364', 'RCBS art. 359, 360 e 364'] },
    'IMOB-RAJ-001': { nome: 'Redutor de ajuste — dedução na alienação', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, arts. 257 e 258', 'RIBS arts. 369 a 375', 'RCBS arts. 369 a 375'] },
    'IMOB-RSO-001': { nome: 'Redutor social — alienação (R$ 100.000 / R$ 30.000)', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 259', 'RIBS arts. 376 a 378', 'RCBS arts. 376 a 378'] },
    'IMOB-RSO-002': { nome: 'Redutor social — locação residencial (R$ 600/mês)', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 260 (redação da LC 227/2026)', 'RIBS art. 377', 'RCBS art. 377'] },
    'IMOB-ALQ-001': { nome: 'Redução de 50% — operações com bens imóveis', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 261, caput', 'RIBS art. 379, caput', 'RCBS art. 379, caput'] },
    'IMOB-ALQ-002': { nome: 'Redução de 70% — locação, cessão onerosa e arrendamento', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 261, parágrafo único', 'RIBS art. 379, parágrafo único', 'RCBS art. 379, parágrafo único'] },
    'IMOB-TEM-001': { nome: 'Locação por temporada até 90 dias — regra de hotelaria', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, arts. 253 e 281', 'RIBS art. 361 (remete ao art. 410)', 'RCBS art. 361 (remete ao art. 410)'] },
    'IMOB-RET-001': { nome: 'RET de transição — 2,08% (regime normal)', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 485, I', 'RIBS art. 461, I', 'RCBS art. 461, I'] },
    'IMOB-RET-002': { nome: 'RET de transição — 0,53% (interesse social)', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 485, II', 'RIBS art. 461, II', 'RCBS art. 461, II'] },
    'IMOB-RET-003': { nome: 'RET — vedação de créditos e de redutores', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 485, §1º e §6º', 'RIBS art. 461, §§ 1º a 6º', 'RCBS art. 461, §§ 1º a 6º'] },
    'IMOB-PAR-001': { nome: 'Rateio proporcional dos redutores em pagamento parcelado', versao: 2, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 262, §4º', 'RIBS art. 380, §§ 4º e 6º', 'RCBS art. 380, §§ 4º e 6º'] },
    'IMOB-BASE-002': { nome: 'Exclusões da base de cálculo da locação', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 255', 'RIBS art. 364, §§ 2º a 4º', 'RCBS art. 364, §§ 2º a 4º'] },
    'IMOB-RAJ-002': { nome: 'Valor inicial do redutor de ajuste — opções do art. 258', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 258', 'RIBS art. 375', 'RCBS art. 375', 'RIBS art. 366 (valor de referência)'] },
    'IMOB-RSO-003': { nome: 'Redutor social proporcional — período parcial e imóvel misto', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['RIBS art. 377, parágrafo único, I', 'RIBS art. 378', 'RCBS arts. 377 e 378'] },
    'IMOB-CRE-001': { nome: 'Créditos de IBS/CBS — apropriação condicionada à extinção do débito', versao: 2, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 47, caput e §1º', 'LC 214/2025, art. 48', 'LC 214/2025, art. 57'] },
    'IMOB-CRE-002': { nome: 'Créditos vedados — operações imunes, isentas, alíquota zero, diferimento e suspensão', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 49', 'LC 214/2025, art. 50', 'LC 214/2025, art. 52'] },
    'IMOB-CRE-003': { nome: 'Ordem de utilização e prazo de 5 anos dos créditos', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 53', 'LC 214/2025, art. 54', 'LC 214/2025, art. 55'] },
    'IMOB-2026-001': { nome: 'Ano-teste 2026 — IBS 0,1% e CBS 0,9% sobre a base do regime específico, com dispensa condicionada', versao: 2, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 343', 'LC 214/2025, art. 346',
        'LC 214/2025, art. 348, III, "b"', 'LC 214/2025, art. 348, §§ 1º e 2º'] },
    'IMOB-PF-001': { nome: 'Pessoa física — limites de enquadramento como contribuinte', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 251, §§ 1º a 6º', 'RIBS art. 382', 'RCBS art. 382'] },
    'IMOB-PER-001': { nome: 'Permuta entre imóveis — não incidência, exceto sobre a torna', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 252, §3º', 'RIBS art. 360, §3º, I, e §4º', 'RCBS art. 360, §3º, I, e §4º'] },
    'IMOB-PER-002': { nome: 'Permuta — transferência do redutor de ajuste', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['RIBS art. 360, §§ 5º, 7º e 8º', 'RCBS art. 360, §§ 5º, 7º e 8º'] },
    'IMOB-LOT-001': { nome: 'Loteamento — regime transitório de 3,65% sobre a receita bruta', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 486', 'RIBS art. 462', 'RCBS art. 462'] },
    'IMOB-LOC-TR1': { nome: 'Locação — regime transitório de 3,65% para contratos antigos', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, art. 487', 'RIBS art. 463', 'RCBS art. 463'] },
    'IMOB-LP-001': { nome: 'Lucro Presumido — venda de imóveis (8% IRPJ / 12% CSLL)', versao: 1, status: 'homologada',
      nivel: 'administrativo', fontes: ['Lei 9.249/1995, arts. 15 e 20', 'IN RFB 1.700/2017, arts. 33 e 34',
        'SC COSIT 7/2021', 'SC COSIT 221/2024'] },
    'IMOB-LP-002': { nome: 'Lucro Presumido — locação de imóveis (32% IRPJ / 32% CSLL)', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['Lei 9.249/1995, art. 15, §1º, III, "c"', 'Lei 9.249/1995, art. 20'] },
    'IMOB-LP-003': { nome: 'Lucro Presumido — PIS/COFINS cumulativos de 0,65% e 3%', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['Lei 9.718/1998, arts. 2º e 3º', 'SC COSIT 7/2021'] },
    'IMOB-LP-004': { nome: 'Ganho de capital — imóvel do ativo não circulante fora do objeto social', versao: 1, status: 'homologada',
      nivel: 'administrativo', fontes: ['Lei 9.430/1996, art. 29', 'IN RFB 1.700/2017, art. 215', 'SC COSIT 221/2024'] },
    'IMOB-LR-001': { nome: 'Lucro Real — simulação comparativa indicativa', versao: 1, status: 'staging',
      nivel: 'premissa', fontes: ['Lei 9.430/1996', 'Leis 10.637/2002 e 10.833/2003 (regime a confirmar por atividade)'] },
    'IMOB-TRA-001': { nome: 'Projeção 2026-2033 — alíquotas vindas do motor genérico', versao: 1, status: 'homologada',
      nivel: 'legal', fontes: ['LC 214/2025, arts. 343, 346 e 348', 'LC 214/2025, art. 125 do ADCT (escada IBS)'] }
  };

  function regra(id) {
    var r = REGRAS[id];
    return r ? { regra_id: id, versao: r.versao, status: r.status, nivel: r.nivel, fontes: r.fontes.slice() } : null;
  }

  /* =========================================================================
     3. VALIDAÇÃO E BLOQUEIO (Seção 16 — nunca estimar em silêncio)
     ========================================================================= */
  var OPERACOES = ['venda', 'locacao', 'ret', 'permuta', 'loteamento', 'locacao_transitoria'];

  function validar(e, ctx) {
    var b = [];
    if (!e || typeof e !== 'object') { return [{ codigo: 'E000', msg: 'Entrada ausente.' }]; }
    if (OPERACOES.indexOf(e.operacao) < 0) b.push({ codigo: 'E001', msg: 'Operação não reconhecida pelo motor: ' + e.operacao });
    if (!e.data_fato_gerador || !/^\d{4}-\d{2}-\d{2}$/.test(e.data_fato_gerador)) b.push({ codigo: 'E002', msg: 'Data do fato gerador ausente ou inválida.' });
    if (typeof e.valor_operacao !== 'number' || !(e.valor_operacao > 0)) b.push({ codigo: 'E003', msg: 'Valor da operação ausente, zerado ou não numérico.' });
    if (!ctx || !ctx.aliquotas || typeof ctx.aliquotas.ibs !== 'number' || typeof ctx.aliquotas.cbs !== 'number') b.push({ codigo: 'E004', msg: 'Alíquotas de IBS/CBS não fornecidas pelo motor genérico.' });
    if (ctx && ctx.aliquotas && ['LEGAL', 'ESTIMADA', 'SIMULACAO'].indexOf(ctx.aliquotas.classificacao) < 0) b.push({ codigo: 'E005', msg: 'Alíquota sem classificação LEGAL/ESTIMADA/SIMULACAO.' });
    if (e.operacao === 'venda' && !e.imovel) b.push({ codigo: 'E006', msg: 'Alienação sem cadastro de imóvel vinculado.' });
    if (e.operacao === 'venda' && e.imovel && !e.imovel.id) b.push({ codigo: 'E007', msg: 'Imóvel sem identificador — redutores não podem ser controlados por imóvel.' });
    if (e.operacao === 'locacao' && (!e.locacao || ['residencial', 'nao_residencial'].indexOf(e.locacao.finalidade) < 0)) b.push({ codigo: 'E008', msg: 'Locação sem finalidade (residencial / não residencial).' });
    if (e.operacao === 'ret' && (!e.ret || ['normal', 'social'].indexOf(e.ret.modalidade) < 0)) b.push({ codigo: 'E009', msg: 'RET sem modalidade (normal / interesse social).' });
    if (e.operacao === 'ret' && e.ret && e.ret.patrimonio_afetacao !== true) b.push({ codigo: 'E010', msg: 'RET sem comprovação de patrimônio de afetação (art. 485, caput).' });
    if (e.operacao === 'permuta' && !e.permuta) b.push({ codigo: 'E011', msg: 'Permuta sem os dados da operação (torna, contraparte, redutores).' });
    if (e.operacao === 'permuta' && e.permuta && ['contribuinte', 'nao_contribuinte'].indexOf(e.permuta.contraparte) < 0) b.push({ codigo: 'E012', msg: 'Permuta sem indicação do regime da contraparte (contribuinte / não contribuinte).' });
    if (e.operacao === 'loteamento' && !(e.loteamento && e.loteamento.registro_ate_2028 === true)) b.push({ codigo: 'E013', msg: 'Regime transitório do loteamento exige registro do parcelamento efetivado antes de 1º/01/2029 (art. 462, caput).' });
    if (e.operacao === 'locacao_transitoria' && !e.contrato) b.push({ codigo: 'E014', msg: 'Regime transitório de locação sem os dados do contrato (art. 463).' });
    return b;
  }

  function ano(dataISO) { return parseInt(String(dataISO).slice(0, 4), 10); }

  /* =========================================================================
     4. NÚCLEO DE CÁLCULO
     ========================================================================= */

  // Alíquotas efetivas depois da redução do art. 261.
  function aliquotasReduzidas(ctx, tipoReducao) {
    var pct = tipoReducao === 70 ? 0.70 : 0.50;
    return {
      ibs: r4(ctx.aliquotas.ibs * (1 - pct)),
      cbs: r4(ctx.aliquotas.cbs * (1 - pct)),
      reducao_pct: tipoReducao,
      classificacao: ctx.aliquotas.classificacao,
      fonte_aliquota: ctx.aliquotas.fonte || 'motor genérico do ATP'
    };
  }

  function linha(ordem, desc, formula, entrada, valor, regraId, extra) {
    var r = regra(regraId) || {};
    var o = { ordem: ordem, descricao: desc, formula: formula, entrada: entrada, valor: r2(valor),
              regra_id: r.regra_id || null, regra_versao: r.versao || null, regra_status: r.status || null,
              nivel_interpretacao: r.nivel || null, fundamentos: r.fontes || [] };
    if (extra) { for (var k in extra) if (extra.hasOwnProperty(k)) o[k] = extra[k]; }
    return o;
  }


  /* ---- 4.0 Valor inicial do redutor de ajuste (art. 375 / art. 258 da LC) --
     Devolve as opções LEGALMENTE POSSÍVEIS para o imóvel, sem escolher nenhuma.
     A escolha é do contribuinte, exige justificativa e é definitiva (art. 375,
     I, "b": "por opção do contribuinte"). O app apresenta; o usuário decide. */
  function rajValorInicial(im, ctx) {
    im = im || {}; ctx = ctx || {};
    var idx = ctx.indices || {};
    var r = { hipotese: null, opcoes: [], data_constituicao: null, bloqueios: [],
              regra_id: 'IMOB-RAJ-002', fundamentos: (regra('IMOB-RAJ-002') || {}).fontes };

    if (im.adquirido_de_nao_contribuinte_apos_2027 === true) {
      // art. 375, III — sem opção: é o valor de aquisição, limitado pelo §5º.
      r.hipotese = 'III';
      r.data_constituicao = im.data_aquisicao || null;
      if (!(im.valor_aquisicao > 0)) r.bloqueios.push({ codigo: 'R001', msg: 'Valor de aquisição não informado (art. 375, III).' });
      r.opcoes = [{ chave: 'aquisicao', rotulo: 'Valor de aquisição do imóvel',
                    valor: r2(naoNeg(im.valor_aquisicao)), atualizado: false,
                    fundamento: 'RIBS/RCBS art. 375, III' }];
      return r;
    }

    if (im.em_construcao_2026 === true) {
      // art. 375, II — terreno atualizado + custos anteriores a 2027 atualizados.
      r.hipotese = 'II'; r.data_constituicao = '2026-12-31';
      if (!(im.valor_aquisicao > 0)) r.bloqueios.push({ codigo: 'R002', msg: 'Valor de aquisição do terreno não informado (art. 375, II, "a").' });
      if (typeof im.custos_ate_2026 !== 'number') r.bloqueios.push({ codigo: 'R003', msg: 'Custos de bens e serviços anteriores a 1º/01/2027 não informados (art. 375, II, "b").' });
      if (!idx.fator_ate_2026) r.bloqueios.push({ codigo: 'R004', msg: 'Fator de atualização até 31/12/2026 não informado (art. 375, §4º).' });
      var terreno = atualizarPorIndice(im.valor_aquisicao, idx.fator_ate_2026);
      var custos  = atualizarPorIndice(im.custos_ate_2026, idx.fator_ate_2026);
      r.opcoes = [{ chave: 'construcao', rotulo: 'Terreno atualizado + custos até 31/12/2026 atualizados',
                    valor: r2(terreno + custos), atualizado: true,
                    detalhe: { terreno_atualizado: r2(terreno), custos_atualizados: r2(custos),
                               fator: idx.fator_ate_2026 },
                    fundamento: 'RIBS/RCBS art. 375, II, e §4º' }];
      return r;
    }

    // art. 375, I — imóvel do contribuinte em 31/12/2026: DUAS opções.
    r.hipotese = 'I'; r.data_constituicao = '2026-12-31';
    if (!(im.valor_aquisicao > 0)) r.bloqueios.push({ codigo: 'R005', msg: 'Valor de aquisição não informado (art. 375, I, "a").' });
    if (!idx.fator_ate_2026) r.bloqueios.push({ codigo: 'R004', msg: 'Fator de atualização até 31/12/2026 não informado (art. 375, §4º).' });
    var atual = atualizarPorIndice(im.valor_aquisicao, idx.fator_ate_2026);
    r.opcoes.push({ chave: 'aquisicao', rotulo: 'Valor de aquisição atualizado',
                    valor: r2(atual), atualizado: true,
                    detalhe: { valor_original: r2(naoNeg(im.valor_aquisicao)), fator: idx.fator_ate_2026 },
                    fundamento: 'RIBS/RCBS art. 375, I, "a", e §4º (IPC/Fipe até 1979; IPCA de 1980 a 2026)' });
    if (im.valor_referencia > 0) {
      r.opcoes.push({ chave: 'referencia', rotulo: 'Valor de referência do imóvel',
                      valor: r2(im.valor_referencia), atualizado: false,
                      fundamento: 'RIBS/RCBS art. 375, I, "b", c/c art. 366' });
    } else {
      r.opcoes.push({ chave: 'referencia', rotulo: 'Valor de referência do imóvel',
                      valor: null, indisponivel: true,
                      nota: 'Valor de referência não disponível. O art. 375, §2º permite estimativa de valor de mercado por procedimento específico de ato conjunto RFB/CGIBS — não estimado automaticamente aqui.',
                      fundamento: 'RIBS/RCBS art. 375, I, "b", e §2º' });
    }
    var disp = r.opcoes.filter(function (o) { return o.valor !== null; });
    r.recomendacao_neutra = disp.length > 1
      ? 'As duas opções estão disponíveis. A escolha é do contribuinte (art. 375, I, "b") e é definitiva — registre a justificativa.'
      : 'Apenas uma opção disponível no momento.';
    r.maior = disp.length ? disp.reduce(function (a, b) { return b.valor > a.valor ? b : a; }).chave : null;
    return r;
  }

  /* ---- 4.0b Enquadramento da pessoa física (art. 382 / art. 251 da LC) ----- */
  function pfEnquadramento(dados, ctx) {
    dados = dados || {}; ctx = ctx || {};
    var lim = (ctx.parametros && ctx.parametros.limite_pf_locacao) || 240000;
    var fator = (ctx.indices && ctx.indices.ipca_fator) || 1;
    var limAt = lim * fator;                                   // art. 382, §4º
    var m = [], contrib = false;

    if (dados.receita_locacao_ano_anterior > limAt && dados.imoveis_locados_distintos > 3) {
      contrib = true; m.push({ inciso: 'I', motivo: 'receita de locação do ano anterior acima do limite atualizado E mais de 3 imóveis distintos' });
    }
    if (dados.alienacoes_ano_anterior > 3) {
      contrib = true; m.push({ inciso: 'II', motivo: 'mais de 3 imóveis distintos alienados no ano-calendário anterior' });
    }
    if (dados.alienacoes_construidos_proprio_ano_anterior > 1) {
      contrib = true; m.push({ inciso: 'III', motivo: 'mais de 1 imóvel construído pelo próprio alienante alienado no ano anterior' });
    }
    // §1º — enquadramento no PRÓPRIO ano-calendário
    if (dados.alienacoes_ano_corrente >= 4) {
      contrib = true; m.push({ inciso: '§1º, I', motivo: 'a partir da 4ª alienação do próprio ano-calendário' });
    }
    if (dados.alienacoes_construidos_proprio_ano_corrente >= 2) {
      contrib = true; m.push({ inciso: '§1º, II', motivo: 'a partir da 2ª alienação de imóvel construído pelo próprio alienante no ano corrente' });
    }
    if (dados.receita_locacao_ano_corrente > limAt * 1.20 && dados.imoveis_locados_distintos > 3) {
      contrib = true; m.push({ inciso: '§1º, III', motivo: 'receita de locação do ano corrente excede em 20% o limite, com mais de 3 imóveis distintos' });
    }
    return { contribuinte: contrib, motivos: m,
             limite_original: r2(lim), limite_atualizado: r2(limAt), fator_ipca: fator,
             limite_mais_20: r2(limAt * 1.20),
             nota_prazo: 'Art. 382, §2º: para os incisos II e §1º, I, contam apenas imóveis no patrimônio há menos de 5 anos; §3º manda contar da aquisição pelo meeiro, de cujus ou doador em meação, doação e herança.',
             nota_temporada: 'Art. 361: a locação residencial de até 90 dias, embora tributada como hotelaria, ENTRA nos limites do inciso I e do §1º, III.',
             regra_id: 'IMOB-PF-001', fundamentos: (regra('IMOB-PF-001') || {}).fontes };
  }

  /* ---- 4.1 Alienação (venda de imóvel / lote) ---------------------------- */
  function calcVenda(e, ctx) {
    var L = [], ordem = 0, notas = [];
    var valor = e.valor_operacao;
    L.push(linha(++ordem, 'Valor da operação', 'valor informado', null, valor, 'IMOB-BASE-001'));

    // Redutor de ajuste (art. 257/258) — saldo vinculado ao imóvel.
    var saldoRaj = naoNeg(e.redutor_ajuste_saldo || 0);
    var apRaj = aplicarRedutor(valor, saldoRaj);
    L.push(linha(++ordem, 'Redutor de ajuste', 'min(saldo do imóvel; base)',
      { saldo_disponivel: r2(saldoRaj) }, -apRaj.usado, 'IMOB-RAJ-001',
      { saldo_remanescente: r2(apRaj.saldo) }));

    // Redutor social (art. 259) — depois do ajuste, uma única vez por imóvel.
    var im = e.imovel || {};
    var baseSocial = 0, regraSocial = null;
    if (im.tipo === 'residencial_novo') { baseSocial = (ctx.parametros && ctx.parametros.redutor_social_residencial_novo) || 0; regraSocial = 'IMOB-RSO-001'; }
    else if (im.tipo === 'lote_residencial') { baseSocial = (ctx.parametros && ctx.parametros.redutor_social_lote_residencial) || 0; regraSocial = 'IMOB-RSO-001'; }

    var socialAtualizado = 0, apSoc = { base: apRaj.base, usado: 0 };
    if (regraSocial) {
      if (e.redutor_social_ja_utilizado === true) {
        notas.push('Redutor social não aplicado: já utilizado para este imóvel (art. 259, §2º).');
      } else {
        socialAtualizado = atualizarPorIndice(baseSocial, ctx.indices && ctx.indices.ipca_fator);
        apSoc = aplicarRedutor(apRaj.base, socialAtualizado);
      }
      L.push(linha(++ordem, 'Redutor social', 'min(valor atualizado; base após redutor de ajuste)',
        { valor_original: r2(baseSocial), fator_ipca: (ctx.indices && ctx.indices.ipca_fator) || 1,
          competencia_indice: (ctx.indices && ctx.indices.competencia) || null, valor_atualizado: r2(socialAtualizado) },
        -apSoc.usado, 'IMOB-RSO-001'));
    } else {
      notas.push('Redutor social não aplicável ao tipo de imóvel informado (art. 259, §1º).');
    }

    var base = apSoc.base;
    L.push(linha(++ordem, 'Base de cálculo tributável', 'valor − redutor de ajuste − redutor social', null, base, 'IMOB-BASE-001'));

    var alq = aliquotasReduzidas(ctx, 50);
    L.push(linha(++ordem, 'Alíquotas reduzidas em 50%', 'alíquota padrão × (1 − 50%)',
      { ibs_padrao: r4(ctx.aliquotas.ibs), cbs_padrao: r4(ctx.aliquotas.cbs) }, 0, 'IMOB-ALQ-001',
      { ibs_reduzida: alq.ibs, cbs_reduzida: alq.cbs, classificacao: alq.classificacao }));

    var ibs = base * alq.ibs / 100, cbs = base * alq.cbs / 100;
    L.push(linha(++ordem, 'IBS devido', 'base × alíquota IBS reduzida', { base: r2(base), aliquota: alq.ibs }, ibs, 'IMOB-ALQ-001'));
    L.push(linha(++ordem, 'CBS devida', 'base × alíquota CBS reduzida', { base: r2(base), aliquota: alq.cbs }, cbs, 'IMOB-ALQ-001'));

    var cred = naoNeg(e.creditos || 0);
    var debito = somaExib([ibs, cbs]);
    var credUsado = Math.min(cred, debito);
    L.push(linha(++ordem, 'Créditos de IBS/CBS apropriados', 'min(créditos informados; débito apurado)',
      { creditos_informados: r2(cred) }, -credUsado, 'IMOB-CRE-001',
      { credito_a_transportar: r2(cred - credUsado) }));

    var total = r2(debito - credUsado);
    var parcelas = null;
    var redutorTotal = apRaj.usado + apSoc.usado;
    if (Array.isArray(e.pagamentos) && e.pagamentos.length) {
      // art. 380, §6º: a proporção é a do VALOR PRINCIPAL DA PARCELA sobre o
      // valor total da alienação, aplicada sobre o redutor total.
      var somaPg = e.pagamentos.reduce(function (a, b) { return a + naoNeg(b); }, 0);
      if (Math.abs(somaPg - valor) > 0.02) {
        notas.push('Atenção: a soma dos pagamentos (' + r2(somaPg) + ') não fecha com o valor da operação (' + r2(valor) + ').');
      }
      parcelas = []; var accIbs = 0, accCbs = 0;
      for (var pi = 0; pi < e.pagamentos.length; pi++) {
        var vp = naoNeg(e.pagamentos[pi]);
        var prop = valor > 0 ? vp / valor : 0;
        var basePg = naoNeg(vp - redutorTotal * prop);
        var ibsPg = pi === e.pagamentos.length - 1 ? r2(ibs) - accIbs : r2(basePg * alq.ibs / 100);
        var cbsPg = pi === e.pagamentos.length - 1 ? r2(cbs) - accCbs : r2(basePg * alq.cbs / 100);
        accIbs = r2(accIbs + ibsPg); accCbs = r2(accCbs + cbsPg);
        parcelas.push({ ordem: pi + 1, pagamento: r2(vp), proporcao: r4(prop * 100),
                        redutor_aplicado: r2(redutorTotal * prop), base: r2(basePg),
                        ibs: r2(ibsPg), cbs: r2(cbsPg), total: r2(ibsPg + cbsPg) });
      }
      notas.push('IBS/CBS devidos em cada pagamento (art. 380, caput); redutores deduzidos na proporção do valor principal de cada parcela sobre o total (art. 380, §§ 4º e 6º).');
      if (e.pagamento_iniciado_antes_2027 === true) {
        notas.push('Art. 380, §5º: pagamento iniciado antes de 1º/01/2027 — a proporção considera inclusive as parcelas pagas antes dessa data.');
      }
    } else if (e.parcelas && e.parcelas > 1) {
      parcelas = ratearParcelas(total, e.parcelas);
      notas.push('Parcelas iguais: rateio proporcional ao valor total do bem (art. 380, §§ 4º e 6º); resíduo de centavos na última parcela.');
    }

    return { linhas: L, base: r2(base), ibs: r2(ibs), cbs: r2(cbs), debito: debito,
             creditos: r2(credUsado), total: total, parcelas: parcelas,
             aliquota_efetiva_sobre_operacao: valor > 0 ? r4(total / valor * 100) : 0,
             redutor_ajuste_usado: r2(apRaj.usado), redutor_ajuste_saldo: r2(apRaj.saldo),
             redutor_social_usado: r2(apSoc.usado), notas: notas,
             regras_aplicadas: ['IMOB-BASE-001', 'IMOB-RAJ-001', 'IMOB-RSO-001', 'IMOB-ALQ-001']
               .concat(cred > 0 ? ['IMOB-CRE-001'] : []) };
  }

  /* ---- 4.2 Locação / cessão onerosa / arrendamento ----------------------- */
  function calcLocacao(e, ctx) {
    var L = [], ordem = 0, notas = [];
    var valor = e.valor_operacao;
    var loc = e.locacao || {};
    L.push(linha(++ordem, 'Valor do aluguel no período', 'valor informado', null, valor, 'IMOB-BASE-001'));

    // Temporada até 90 dias: sai do regime de bens imóveis (art. 253) -> bloqueio.
    if (typeof loc.prazo_dias === 'number' && loc.prazo_dias > 0 && loc.prazo_dias <= 90 && loc.finalidade === 'residencial') {
      return { bloqueio: { codigo: 'B001',
        msg: 'Locação residencial de até 90 dias ininterruptos segue as regras de hotelaria (art. 253), fora deste motor: não se aplicam o redutor social do art. 260 nem a redução de 70% do art. 261, parágrafo único.',
        regra_id: 'IMOB-TEM-001' } };
    }

    // Exclusões da base (art. 364, §§ 2º a 4º) — só com prova de pagamento pelo locatário.
    var exc = loc.encargos_locatario || {};
    var excProvado = exc.prova_pagamento === true;
    var excTotal = 0, excDetalhe = { tributos_emolumentos: 0, condominio: 0, foro_taxa_ocupacao: 0 };
    if (excProvado) {
      excDetalhe.tributos_emolumentos = naoNeg(exc.tributos_emolumentos || 0);
      excDetalhe.condominio           = naoNeg(exc.condominio || 0);
      excDetalhe.foro_taxa_ocupacao   = naoNeg(exc.foro_taxa_ocupacao || 0);
      excTotal = excDetalhe.tributos_emolumentos + excDetalhe.condominio + excDetalhe.foro_taxa_ocupacao;
    } else if ((exc.tributos_emolumentos || exc.condominio || exc.foro_taxa_ocupacao)) {
      notas.push('Encargos informados NÃO excluídos da base: o art. 364, §4º exige prova inequívoca do pagamento pelo locatário.');
    }
    if (naoNeg(exc.benfeitorias || 0) > 0) {
      notas.push('Benfeitorias custeadas pelo locatário NÃO reduzem a base (art. 364, §2º).');
    }
    var apExc = aplicarRedutor(valor, excTotal);
    if (excTotal > 0) {
      L.push(linha(++ordem, 'Encargos do locatário excluídos da base',
        'tributos e emolumentos + condomínio + foro/taxa de ocupação',
        excDetalhe, -apExc.usado, 'IMOB-BASE-002'));
    }

    var socialAtualizado = 0, ap = { base: apExc.base, usado: 0 };
    if (loc.finalidade === 'residencial') {
      var meses = loc.meses && loc.meses > 0 ? loc.meses : 1;
      var unit = (ctx.parametros && ctx.parametros.redutor_social_locacao_mes) || 0;
      // art. 377, § único, I: proporcional quando o período não for mensal cheio.
      var propPeriodo = (typeof loc.dias_no_mes === 'number' && loc.dias_no_mes > 0 && loc.dias_no_mes < 30)
        ? loc.dias_no_mes / 30 : 1;
      // art. 378: proporcional à área residencial em imóvel de uso misto.
      var propArea = (typeof loc.fracao_area_residencial === 'number'
        && loc.fracao_area_residencial > 0 && loc.fracao_area_residencial < 1)
        ? loc.fracao_area_residencial : 1;
      socialAtualizado = atualizarPorIndice(unit, ctx.indices && ctx.indices.ipca_fator) * meses * propPeriodo * propArea;
      ap = aplicarRedutor(apExc.base, socialAtualizado);
      L.push(linha(++ordem, 'Redutor social da locação residencial',
        'R$ 600 atualizado × meses × proporção do período × fração de área residencial, limitado à base',
        { valor_original_mes: r2(unit), meses: meses, fator_ipca: (ctx.indices && ctx.indices.ipca_fator) || 1,
          proporcao_periodo: propPeriodo, fracao_area_residencial: propArea,
          valor_atualizado: r2(socialAtualizado) }, -ap.usado, 'IMOB-RSO-002'));
      if (propPeriodo < 1) notas.push('Redutor social proporcionalizado ao período (art. 377, parágrafo único, I).');
      if (propArea < 1) notas.push('Redutor social proporcionalizado à área residencial do imóvel misto (art. 378).');
    } else {
      notas.push('Redutor social não se aplica à locação não residencial (art. 377, caput).');
    }

    var base = ap.base;
    L.push(linha(++ordem, 'Base de cálculo tributável', 'aluguel − encargos excluídos − redutor social', null, base, 'IMOB-BASE-001'));

    var alq = aliquotasReduzidas(ctx, 70);
    L.push(linha(++ordem, 'Alíquotas reduzidas em 70%', 'alíquota padrão × (1 − 70%)',
      { ibs_padrao: r4(ctx.aliquotas.ibs), cbs_padrao: r4(ctx.aliquotas.cbs) }, 0, 'IMOB-ALQ-002',
      { ibs_reduzida: alq.ibs, cbs_reduzida: alq.cbs, classificacao: alq.classificacao }));

    var ibs = base * alq.ibs / 100, cbs = base * alq.cbs / 100;
    L.push(linha(++ordem, 'IBS devido', 'base × alíquota IBS reduzida', { base: r2(base), aliquota: alq.ibs }, ibs, 'IMOB-ALQ-002'));
    L.push(linha(++ordem, 'CBS devida', 'base × alíquota CBS reduzida', { base: r2(base), aliquota: alq.cbs }, cbs, 'IMOB-ALQ-002'));

    var cred = naoNeg(e.creditos || 0);
    var debito = somaExib([ibs, cbs]);
    var credUsado = Math.min(cred, debito);
    if (cred > 0) {
      L.push(linha(++ordem, 'Créditos de IBS/CBS apropriados', 'min(créditos informados; débito apurado)',
        { creditos_informados: r2(cred) }, -credUsado, 'IMOB-CRE-001'));
    }

    var total = r2(debito - credUsado);
    return { linhas: L, base: r2(base), ibs: r2(ibs), cbs: r2(cbs), debito: debito,
             creditos: r2(credUsado), total: total, parcelas: null,
             aliquota_efetiva_sobre_operacao: valor > 0 ? r4(total / valor * 100) : 0,
             redutor_social_usado: r2(ap.usado), notas: notas,
             regras_aplicadas: ['IMOB-BASE-001', 'IMOB-RSO-002', 'IMOB-ALQ-002'] };
  }

  /* ---- 4.3 RET de transição (art. 485) ----------------------------------- */
  function calcRET(e, ctx) {
    var L = [], ordem = 0, notas = [];
    var receita = e.valor_operacao;
    var social = e.ret.modalidade === 'social';
    var aliq = social ? 0.53 : 2.08;      // IBS + CBS conjuntos, art. 485, I e II
    var regraId = social ? 'IMOB-RET-002' : 'IMOB-RET-001';

    L.push(linha(++ordem, 'Receita mensal recebida', 'valor informado', null, receita, regraId));
    L.push(linha(++ordem, 'IBS + CBS pelo RET de transição', 'receita × ' + aliq.toFixed(2) + '%',
      { receita: r2(receita), aliquota: aliq }, receita * aliq / 100, regraId,
      { observacao: 'Percentual conjunto de IBS e CBS. O IRPJ/CSLL do RET (1,92% no normal, 0,47% no social) permanece fora do IBS/CBS e não é calculado por este motor.' }));

    if (naoNeg(e.creditos || 0) > 0) {
      notas.push('Créditos informados DESCONSIDERADOS: a opção pelo RET de transição veda a apropriação de créditos (art. 485, §1º e §6º).');
      L.push(linha(++ordem, 'Créditos vedados no RET', 'vedação legal', { creditos_informados: r2(e.creditos) }, 0, 'IMOB-RET-003'));
    }
    if (naoNeg(e.redutor_ajuste_saldo || 0) > 0 || (e.imovel && e.imovel.tipo === 'residencial_novo')) {
      notas.push('Redutores de ajuste e social não deduzidos: vedação do regime especial do art. 485, §1º.');
    }

    var total = r2(receita * aliq / 100);
    return { linhas: L, base: r2(receita), ibs: null, cbs: null, debito: total,
             creditos: 0, total: total, parcelas: null,
             aliquota_efetiva_sobre_operacao: aliq, notas: notas,
             regras_aplicadas: [regraId, 'IMOB-RET-003'] };
  }


  /* ---- 4.6 Permuta (art. 360, §§ 3º a 9º) ------------------------------- */
  function calcPermuta(e, ctx) {
    var L = [], ordem = 0, notas = [];
    var pm = e.permuta || {};
    var torna = naoNeg(pm.torna || 0);
    var pagaTorna = pm.torna_paga_por || 'nenhum';   // contribuinte | nao_contribuinte | nenhum

    L.push(linha(++ordem, 'Valor do imóvel dado em permuta', 'valor informado', null, e.valor_operacao, 'IMOB-PER-001'));
    L.push(linha(++ordem, 'Permuta entre bens imóveis — não incidência',
      'art. 360, §3º, I: o IBS/CBS não incide na permuta, exceto sobre a torna',
      { valor_permutado: r2(e.valor_operacao) }, 0, 'IMOB-PER-001'));

    if (pm.contraprestacao_diversa === true) {
      return { bloqueio: { codigo: 'B002', regra_id: 'IMOB-PER-001',
        msg: 'Há contraprestação diferente de imóvel e dinheiro. O art. 360, §4º sujeita essa parcela ao regime REGULAR, fora do regime específico de bens imóveis — cálculo não realizado aqui.' } };
    }

    // Só a torna é tributada, com a redução de 50% do art. 379.
    var alq = aliquotasReduzidas(ctx, 50);
    var ibs = torna * alq.ibs / 100, cbs = torna * alq.cbs / 100;
    L.push(linha(++ordem, 'Torna — base tributável', 'só a torna é tributada (art. 360, §3º, I)',
      { torna: r2(torna), paga_por: pagaTorna }, torna, 'IMOB-PER-001'));
    L.push(linha(++ordem, 'IBS sobre a torna', 'torna × alíquota IBS reduzida em 50%', { aliquota: alq.ibs }, ibs, 'IMOB-ALQ-001'));
    L.push(linha(++ordem, 'CBS sobre a torna', 'torna × alíquota CBS reduzida em 50%', { aliquota: alq.cbs }, cbs, 'IMOB-ALQ-001'));

    // Destino do redutor de ajuste.
    var rajDado = naoNeg(pm.redutor_ajuste_dado || 0), rajRecebido = null, fund = '';
    if (pm.contraparte === 'contribuinte') {
      if (pm.unidades_a_construir === true) {
        var fr = (typeof pm.fracao_ideal === 'number' && pm.fracao_ideal > 0 && pm.fracao_ideal <= 1) ? pm.fracao_ideal : null;
        if (fr === null) {
          notas.push('Permuta para entrega de unidades a construir sem fração ideal informada — o redutor não pôde ser rateado (art. 360, §7º, II).');
        } else {
          rajRecebido = rajDado * fr;
          fund = 'art. 360, §7º, II — rateio pela fração ideal das unidades permutadas';
        }
      } else {
        rajRecebido = rajDado;
        fund = 'art. 360, §7º, I — o redutor do imóvel dado é mantido e migra para o imóvel recebido';
      }
    } else {
      // contraparte não contribuinte (art. 360, §8º)
      if (pagaTorna === 'contribuinte')        { rajRecebido = rajDado + torna; fund = 'art. 360, §8º, II, "b" — redutor do imóvel dado acrescido da torna paga'; }
      else if (pagaTorna === 'nao_contribuinte'){ rajRecebido = naoNeg(rajDado - torna); fund = 'art. 360, §8º, II, "c" — redutor do imóvel dado deduzido da torna recebida, nunca negativo'; }
      else                                      { rajRecebido = rajDado; fund = 'art. 360, §8º, II, "a" — sem torna, o redutor do imóvel dado é transferido'; }
      notas.push('Art. 360, §8º, I: o não contribuinte NÃO constitui redutor de ajuste para o imóvel que recebeu.');
    }
    if (rajRecebido !== null) {
      L.push(linha(++ordem, 'Redutor de ajuste do imóvel recebido', fund,
        { redutor_do_imovel_dado: r2(rajDado), torna: r2(torna) }, rajRecebido, 'IMOB-PER-002'));
    }
    notas.push('Art. 360, §5º: o valor permutado NÃO entra no valor da operação para o cálculo do redutor de ajuste dos arts. 369 a 375.');

    var debito = somaExib([ibs, cbs]);
    return { linhas: L, base: r2(torna), ibs: r2(ibs), cbs: r2(cbs), debito: debito,
             creditos: 0, total: debito, parcelas: null,
             redutor_ajuste_recebido: rajRecebido === null ? null : r2(rajRecebido),
             aliquota_efetiva_sobre_operacao: e.valor_operacao > 0 ? r4(debito / e.valor_operacao * 100) : 0,
             notas: notas, regras_aplicadas: ['IMOB-PER-001', 'IMOB-PER-002', 'IMOB-ALQ-001'] };
  }

  /* ---- 4.7 Regimes opcionais de 3,65% (arts. 462 e 463) ------------------ */
  function calc365(e, ctx, tipo) {
    var L = [], ordem = 0, notas = [];
    var receita = e.valor_operacao;
    var eLot = tipo === 'loteamento';
    var regraId = eLot ? 'IMOB-LOT-001' : 'IMOB-LOC-TR1';
    var rot = eLot ? 'Receita bruta recebida do parcelamento do solo' : 'Receita bruta recebida da locação';

    if (!eLot) {
      // art. 463, §1º — requisitos de elegibilidade, verificados um a um.
      var c = e.contrato || {}, falta = [];
      if (c.firmado_ate_16_01_2025 !== true) falta.push('contrato firmado até 16/01/2025 (art. 463, §1º)');
      if (c.finalidade === 'nao_residencial') {
        if (c.prazo_determinado !== true) falta.push('prazo determinado (art. 463, §1º, I)');
        if (c.data_comprovada !== true) falta.push('data comprovada por firma reconhecida ou assinatura eletrônica (art. 463, §1º, I, "a")');
        if (c.registrado_ate_2025 !== true && c.disponibilizado_rfb_cgibs !== true)
          falta.push('registro em cartório até 31/12/2025 ou disponibilização à RFB e ao CGIBS (art. 463, §1º, I, "b")');
      } else if (c.finalidade === 'residencial') {
        if (c.data_comprovada !== true && c.pagamento_comprovado !== true)
          falta.push('data comprovada por firma, assinatura eletrônica ou comprovação de pagamento (art. 463, §1º, II)');
        if (typeof e.data_fato_gerador === 'string' && e.data_fato_gerador > '2028-12-31')
          falta.push('o regime residencial encerra em 31/12/2028 ou no fim do prazo original, o que ocorrer primeiro (art. 463, §1º, II)');
      } else {
        falta.push('finalidade do contrato (residencial / não residencial)');
      }
      if (falta.length) {
        return { bloqueio: { codigo: 'B003', regra_id: regraId,
          msg: 'Requisitos do regime transitório de locação não comprovados: ' + falta.join('; ') +
               '. Sem eles, a operação segue o regime específico comum (redução de 70% e redutor social).' } };
      }
    }

    L.push(linha(++ordem, rot, 'valor informado', null, receita, regraId));
    var total = receita * 3.65 / 100;
    L.push(linha(++ordem, 'IBS + CBS pelo regime opcional', 'receita bruta × 3,65%',
      { receita: r2(receita), aliquota: 3.65 }, total, regraId,
      { observacao: 'Percentual conjunto de IBS e CBS. Opção IRRETRATÁVEL.' }));

    if (naoNeg(e.creditos || 0) > 0) {
      notas.push('Créditos informados DESCONSIDERADOS: a opção veda a apropriação de créditos (' +
        (eLot ? 'art. 462, §3º' : 'art. 463, §4º') + ').');
    }
    notas.push(eLot
      ? 'Art. 462, §4º: a opção impede a dedução do redutor de ajuste (arts. 369 a 375) e do redutor social (art. 376) na alienação decorrente do parcelamento.'
      : 'Art. 463, §5º: a opção impede a utilização do redutor social do art. 377.');
    notas.push(eLot
      ? 'Art. 462, §5º: o adquirente contribuinte do regime regular NÃO apropria crédito na aquisição do imóvel.'
      : 'Art. 463, §7º: o pagamento é DEFINITIVO — não gera direito a restituição nem a compensação em qualquer hipótese.');
    notas.push(eLot
      ? 'Art. 462, §2º: a opção afasta qualquer outra forma de incidência sobre o respectivo parcelamento.'
      : 'Art. 463, §§ 6º e 8º: receita bruta inclui receitas financeiras e variações monetárias da operação; receitas, custos e despesas próprios ficam fora da apuração das demais atividades.');

    return { linhas: L, base: r2(receita), ibs: null, cbs: null, debito: r2(total),
             creditos: 0, total: r2(total), parcelas: null,
             aliquota_efetiva_sobre_operacao: 3.65, notas: notas,
             regras_aplicadas: [regraId] };
  }

  /* ---- 4.4 Ano-teste 2026 ------------------------------------------------ */
  function ajuste2026(res, e, ctx) {
    if (ano(e.data_fato_gerador) !== 2026) return res;
    var dispensa = !(ctx.parametros && ctx.parametros.dispensa_2026 === false);
    res.notas = res.notas || [];
    res.notas.push('Ano-teste 2026: IBS 0,1% (art. 343) e CBS 0,9% (art. 346) aplicados sobre a BASE DO REGIME ESPECÍFICO — o art. 348, III, "b" manda observar as bases próprias dos regimes específicos, e não reduz a alíquota de teste (a redução da alínea "a" é dos regimes DIFERENCIADOS). ' +
      (dispensa ? 'Dispensado o recolhimento para quem cumprir as obrigações acessórias (art. 348, §1º) — valor devido demonstrado como zero. O §2º mantém a obrigação de pagar integralmente PIS e COFINS no período.'
                : 'SEM dispensa (parâmetro do usuário) — valor teórico mantido.'));
    var ibs26 = res.base * 0.1 / 100, cbs26 = res.base * 0.9 / 100;
    res.linhas.push(linha(res.linhas.length + 1, 'IBS/CBS de teste de 2026', 'base × (0,1% + 0,9%)',
      { base: res.base }, dispensa ? 0 : r2(ibs26 + cbs26), 'IMOB-2026-001',
      { valor_teorico: r2(ibs26 + cbs26), dispensa_aplicada: dispensa }));
    res.ibs = dispensa ? 0 : r2(ibs26);
    res.cbs = dispensa ? 0 : r2(cbs26);
    res.debito = dispensa ? 0 : r2(ibs26 + cbs26);
    res.creditos = 0;
    res.total = res.debito;
    res.aliquota_efetiva_sobre_operacao = e.valor_operacao > 0 ? r4(res.total / e.valor_operacao * 100) : 0;
    res.ano_teste_2026 = true;
    return res;
  }

  /* ---- 4.5 Nível de confiança (Seção 16) --------------------------------- */
  function nivelConfianca(e, ctx, res) {
    var mot = [];
    if (ctx.aliquotas.classificacao !== 'LEGAL') mot.push('alíquota ' + ctx.aliquotas.classificacao.toLowerCase());
    var statusRegras = (res.regras_aplicadas || []).map(function (id) { return (REGRAS[id] || {}).status; });
    if (statusRegras.indexOf('ativa') < 0) mot.push('regras ainda não ativas (Fase 0)');
    if (!(ctx.indices && ctx.indices.ipca_fator)) mot.push('índice de atualização não informado');
    return { nivel: mot.length ? 'MEDIA' : 'ALTA', motivos: mot };
  }


  /* ---- 4.8 Comparador: regime opcional x regime específico comum --------
     Nunca conclui pela alíquota nominal: confronta o que é renunciado. */
  function compararRegimes(entrada, ctx) {
    var opc = calcular(entrada, ctx);
    var reg = calcular({ operacao: 'venda', data_fato_gerador: entrada.data_fato_gerador,
      valor_operacao: entrada.valor_operacao, imovel: entrada.imovel || { id: 'CMP', tipo: 'residencial_novo' },
      redutor_ajuste_saldo: naoNeg(entrada.redutor_ajuste_saldo || 0),
      creditos: naoNeg(entrada.creditos || 0) }, ctx);
    if (opc.status === 'BLOQUEADO' || reg.status === 'BLOQUEADO') {
      return { status: 'BLOQUEADO', opcional: opc, regular: reg,
               mensagem: 'Comparação não realizada: um dos cenários está bloqueado.' };
    }
    var dif = r2(reg.total - opc.total);
    return { status: 'CALCULADO',
      opcional: { rotulo: entrada.operacao, total: opc.total, aliquota: opc.aliquota_efetiva_sobre_operacao },
      regular: { rotulo: 'regime específico comum', total: reg.total, aliquota: reg.aliquota_efetiva_sobre_operacao,
                 redutor_usado: reg.redutor_ajuste_usado, redutor_social: reg.redutor_social_usado, creditos: reg.creditos },
      diferenca: dif, menor: dif > 0 ? 'opcional' : (dif < 0 ? 'regular' : 'empate'),
      renuncias: ['redutor de ajuste (arts. 369 a 375)', 'redutor social (arts. 376 a 378)',
                  'créditos de IBS/CBS nas aquisições', 'irretratabilidade da opção'],
      ressalva: 'A comparação vale para os dados informados. A opção é IRRETRATÁVEL e alcança toda a incorporação ou parcelamento; um resultado favorável hoje pode se inverter quando o redutor de ajuste e os créditos das fases seguintes forem considerados. Não decidir pela alíquota nominal.' };
  }


  /* =========================================================================
     4.9 FASE 3 — COMPARATIVOS COM A TRIBUTAÇÃO ATUAL
     -------------------------------------------------------------------------
     PREMISSA ESTRUTURAL: IBS e CBS substituem PIS, COFINS, ISS e ICMS.
     IRPJ e CSLL PERMANECEM nos dois cenários. Comparar só IBS/CBS contra
     PIS/COFINS sem carregar IRPJ/CSLL dos dois lados produz conclusão errada
     sobre "qual regime é melhor" — por isso as duas funções abaixo devolvem
     os tributos separados e o total com e sem IRPJ/CSLL.
     ========================================================================= */

  function irpjCsll(baseIrpj, baseCsll, mesesPeriodo, ctx) {
    var pr = (ctx && ctx.parametros) || {};
    var aIrpj = typeof pr.irpj_aliquota === 'number' ? pr.irpj_aliquota : 15;
    var aAdic = typeof pr.irpj_adicional === 'number' ? pr.irpj_adicional : 10;
    var limMes = typeof pr.irpj_limite_mes === 'number' ? pr.irpj_limite_mes : 20000;
    var aCsll = typeof pr.csll_aliquota === 'number' ? pr.csll_aliquota : 9;
    var meses = mesesPeriodo > 0 ? mesesPeriodo : 3;
    var limite = limMes * meses;
    var irpj = baseIrpj * aIrpj / 100;
    var adicional = naoNeg(baseIrpj - limite) * aAdic / 100;
    var csll = baseCsll * aCsll / 100;
    return { irpj: r2(irpj), adicional: r2(adicional), csll: r2(csll),
             limite_adicional: r2(limite), total: somaExib([irpj, adicional, csll]) };
  }

  /* ---- 4.9.1 Lucro Presumido -------------------------------------------- */
  function calcLucroPresumido(d, ctx) {
    d = d || {}; ctx = ctx || {};
    var pr = ctx.parametros || {}, L = [], ordem = 0, notas = [], bloq = [];
    var rVenda = naoNeg(d.receita_venda || 0);
    var rLoc   = naoNeg(d.receita_locacao || 0);
    var rServ  = naoNeg(d.receita_servicos || 0);   // administração, intermediação, construção
    var meses  = d.meses_periodo > 0 ? d.meses_periodo : 3;

    if (rVenda + rLoc + rServ <= 0) bloq.push({ codigo: 'LP01', msg: 'Nenhuma receita informada para o Lucro Presumido.' });
    if (rVenda > 0 && d.atividade_imobiliaria_no_objeto !== true) {
      notas.push('ATENÇÃO: a presunção de 8%/12% na venda depende de a atividade imobiliária constar do objeto social e a receita ser operacional. Sem isso, a alienação é GANHO DE CAPITAL (art. 29 da Lei 9.430/1996) — use o cálculo de ganho de capital, não este.');
    }
    if (bloq.length) return { status: 'BLOQUEADO', bloqueios: bloq, linhas: [] };

    var pVenda  = typeof pr.presuncao_venda_irpj === 'number' ? pr.presuncao_venda_irpj : 8;
    var pVendaC = typeof pr.presuncao_venda_csll === 'number' ? pr.presuncao_venda_csll : 12;
    var pLoc    = typeof pr.presuncao_locacao === 'number' ? pr.presuncao_locacao : 32;
    var pServ   = typeof pr.presuncao_servicos === 'number' ? pr.presuncao_servicos : 32;

    var bIrpj = rVenda * pVenda / 100 + rLoc * pLoc / 100 + rServ * pServ / 100;
    var bCsll = rVenda * pVendaC / 100 + rLoc * pLoc / 100 + rServ * pServ / 100;

    L.push(linha(++ordem, 'Base presumida do IRPJ',
      'venda × ' + pVenda + '% + locação × ' + pLoc + '% + serviços × ' + pServ + '%',
      { receita_venda: r2(rVenda), receita_locacao: r2(rLoc), receita_servicos: r2(rServ) },
      bIrpj, 'IMOB-LP-001'));
    L.push(linha(++ordem, 'Base presumida da CSLL',
      'venda × ' + pVendaC + '% + locação × ' + pLoc + '% + serviços × ' + pServ + '%', null, bCsll,
      rLoc > 0 && rVenda === 0 ? 'IMOB-LP-002' : 'IMOB-LP-001'));

    var ic = irpjCsll(bIrpj, bCsll, meses, ctx);
    L.push(linha(++ordem, 'IRPJ', 'base presumida × 15%', { base: r2(bIrpj) }, ic.irpj, 'IMOB-LP-001'));
    L.push(linha(++ordem, 'Adicional de IRPJ', '10% sobre o que exceder R$ 20.000 por mês do período',
      { limite_do_periodo: ic.limite_adicional, meses: meses }, ic.adicional, 'IMOB-LP-001'));
    L.push(linha(++ordem, 'CSLL', 'base presumida × 9%', { base: r2(bCsll) }, ic.csll, 'IMOB-LP-001'));

    var aPis = typeof pr.pis_cumulativo === 'number' ? pr.pis_cumulativo : 0.65;
    var aCof = typeof pr.cofins_cumulativo === 'number' ? pr.cofins_cumulativo : 3;
    var receitaTotal = rVenda + rLoc + rServ;
    var pis = receitaTotal * aPis / 100, cof = receitaTotal * aCof / 100;
    L.push(linha(++ordem, 'PIS cumulativo', 'receita bruta × ' + aPis + '%', { receita: r2(receitaTotal) }, pis, 'IMOB-LP-003'));
    L.push(linha(++ordem, 'COFINS cumulativa', 'receita bruta × ' + aCof + '%', { receita: r2(receitaTotal) }, cof, 'IMOB-LP-003'));

    var iss = 0;
    if (rServ > 0) {
      var aIss = typeof pr.iss === 'number' ? pr.iss : 0;
      iss = rServ * aIss / 100;
      L.push(linha(++ordem, 'ISS sobre administração e intermediação', 'receita de serviços × ' + aIss + '%',
        { receita_servicos: r2(rServ), aliquota: aIss }, iss, 'IMOB-LP-003',
        { observacao: 'A locação de imóvel próprio NÃO sofre ISS (Súmula Vinculante 31). Administração, intermediação e construção civil sofrem.' }));
      if (aIss === 0) notas.push('ISS parametrizado em 0% com receita de serviços informada — confirmar a alíquota do município antes de usar o comparativo.');
    }

    var substituidos = somaExib([pis, cof, iss]);      // o que o IBS/CBS vai substituir
    var permanecem   = ic.total;                       // IRPJ e CSLL seguem na Reforma
    return { status: 'CALCULADO', regime: 'Lucro Presumido', linhas: L, notas: notas,
             receita_total: r2(receitaTotal),
             irpj: ic.irpj, adicional: ic.adicional, csll: ic.csll, pis: r2(pis), cofins: r2(cof), iss: r2(iss),
             tributos_substituidos: substituidos, tributos_permanentes: permanecem,
             total: somaExib([substituidos, permanecem]),
             carga_sobre_receita: receitaTotal > 0 ? r4(somaExib([substituidos, permanecem]) / receitaTotal * 100) : 0,
             regras_aplicadas: ['IMOB-LP-001', 'IMOB-LP-002', 'IMOB-LP-003'] };
  }

  /* ---- 4.9.2 Ganho de capital (imóvel fora do objeto social) ------------- */
  function calcGanhoCapital(d, ctx) {
    d = d || {};
    var L = [], ordem = 0;
    var valor = naoNeg(d.valor_alienacao || 0), custo = naoNeg(d.custo_contabil || 0);
    var ganho = naoNeg(valor - custo);
    L.push(linha(++ordem, 'Valor da alienação', 'valor informado', null, valor, 'IMOB-LP-004'));
    L.push(linha(++ordem, 'Custo contábil (líquido de depreciação)', 'valor informado', null, -custo, 'IMOB-LP-004'));
    L.push(linha(++ordem, 'Ganho de capital', 'alienação − custo, nunca negativo', null, ganho, 'IMOB-LP-004'));
    var ic = irpjCsll(ganho, ganho, d.meses_periodo || 3, ctx);
    L.push(linha(++ordem, 'IRPJ sobre o ganho', 'ganho × 15%', null, ic.irpj, 'IMOB-LP-004'));
    L.push(linha(++ordem, 'Adicional de IRPJ', '10% sobre o excedente do limite', null, ic.adicional, 'IMOB-LP-004'));
    L.push(linha(++ordem, 'CSLL sobre o ganho', 'ganho × 9%', null, ic.csll, 'IMOB-LP-004'));
    return { status: 'CALCULADO', regime: 'Ganho de capital', linhas: L, ganho: r2(ganho),
      irpj: ic.irpj, adicional: ic.adicional, csll: ic.csll, pis: 0, cofins: 0, iss: 0,
      tributos_substituidos: 0, tributos_permanentes: ic.total, total: ic.total,
      notas: ['Não há PIS/COFINS sobre ganho de capital (SC COSIT 221/2024).',
              'Como não há receita bruta operacional, também não há base de IBS/CBS pelo regime específico — confirmar o enquadramento antes de comparar com a Reforma.'],
      regras_aplicadas: ['IMOB-LP-004'] };
  }

  /* ---- 4.9.3 Lucro Real — SIMULAÇÃO INDICATIVA -------------------------- */
  var LR_DADOS_MINIMOS = ['receita_total', 'custos_dedutiveis', 'despesas_dedutiveis'];
  function calcLucroRealIndicativo(d, ctx) {
    d = d || {}; ctx = ctx || {};
    var pr = ctx.parametros || {}, L = [], ordem = 0, faltando = [];
    LR_DADOS_MINIMOS.forEach(function (k) { if (typeof d[k] !== 'number') faltando.push(k); });

    var receita = naoNeg(d.receita_total || 0);
    var custos = naoNeg(d.custos_dedutiveis || 0), desp = naoNeg(d.despesas_dedutiveis || 0);
    var lucro = receita - custos - desp;
    var prejAnterior = naoNeg(d.prejuizo_acumulado || 0);
    var compensavel = Math.min(prejAnterior, naoNeg(lucro) * 0.30);   // trava dos 30%
    var base = naoNeg(lucro - compensavel);

    L.push(linha(++ordem, 'Receita total', 'valor informado', null, receita, 'IMOB-LR-001'));
    L.push(linha(++ordem, 'Custos dedutíveis', 'valor informado', null, -custos, 'IMOB-LR-001'));
    L.push(linha(++ordem, 'Despesas dedutíveis', 'valor informado', null, -desp, 'IMOB-LR-001'));
    L.push(linha(++ordem, 'Lucro antes da compensação', 'receita − custos − despesas', null, lucro, 'IMOB-LR-001'));
    L.push(linha(++ordem, 'Prejuízo compensado', 'limitado a 30% do lucro do período',
      { saldo_anterior: r2(prejAnterior) }, -compensavel, 'IMOB-LR-001'));
    L.push(linha(++ordem, 'Base de cálculo', 'lucro − compensação, nunca negativa', null, base, 'IMOB-LR-001'));

    var ic = irpjCsll(base, base, d.meses_periodo || 3, ctx);
    L.push(linha(++ordem, 'IRPJ', 'base × 15%', null, ic.irpj, 'IMOB-LR-001'));
    L.push(linha(++ordem, 'Adicional de IRPJ', '10% sobre o excedente do limite', null, ic.adicional, 'IMOB-LR-001'));
    L.push(linha(++ordem, 'CSLL', 'base × 9%', null, ic.csll, 'IMOB-LR-001'));

    // Regime de PIS/COFINS: NÃO assumir. É premissa declarada pelo usuário.
    var regimePC = d.regime_pis_cofins || 'cumulativo';
    var aPis = regimePC === 'nao_cumulativo'
      ? (typeof pr.pis_nao_cumulativo === 'number' ? pr.pis_nao_cumulativo : 1.65)
      : (typeof pr.pis_cumulativo === 'number' ? pr.pis_cumulativo : 0.65);
    var aCof = regimePC === 'nao_cumulativo'
      ? (typeof pr.cofins_nao_cumulativo === 'number' ? pr.cofins_nao_cumulativo : 7.6)
      : (typeof pr.cofins_cumulativo === 'number' ? pr.cofins_cumulativo : 3);
    var baseP = regimePC === 'nao_cumulativo' ? naoNeg(receita - naoNeg(d.creditos_pis_cofins || 0)) : receita;
    var pis = baseP * aPis / 100, cof = baseP * aCof / 100;
    L.push(linha(++ordem, 'PIS (' + regimePC + ')', 'base × ' + aPis + '%', { base: r2(baseP) }, pis, 'IMOB-LR-001'));
    L.push(linha(++ordem, 'COFINS (' + regimePC + ')', 'base × ' + aCof + '%', { base: r2(baseP) }, cof, 'IMOB-LR-001'));

    var notas = ['SIMULAÇÃO COMPARATIVA INDICATIVA — LUCRO REAL. Este resultado não substitui apuração completa.'];
    if (regimePC === 'nao_cumulativo') {
      notas.push('PREMISSA DECLARADA: regime não cumulativo de PIS/COFINS. A atividade imobiliária tem hipóteses de permanência no cumulativo — confirmar por atividade antes de usar este cenário com cliente.');
    } else {
      notas.push('PREMISSA DECLARADA: regime cumulativo de PIS/COFINS.');
    }
    if (faltando.length) notas.push('Conjunto mínimo de dados incompleto: ' + faltando.join(', ') + '.');

    var subs = somaExib([pis, cof]);
    return { status: 'CALCULADO', regime: 'Lucro Real (simulação indicativa)', linhas: L, notas: notas,
             rotulo_obrigatorio: 'SIMULAÇÃO COMPARATIVA INDICATIVA — LUCRO REAL',
             dados_minimos_ok: faltando.length === 0, faltando: faltando,
             lucro: r2(lucro), base: r2(base), irpj: ic.irpj, adicional: ic.adicional, csll: ic.csll,
             pis: r2(pis), cofins: r2(cof), iss: 0,
             tributos_substituidos: subs, tributos_permanentes: ic.total,
             total: somaExib([subs, ic.total]),
             confianca: faltando.length === 0 ? 'MEDIA' : 'BAIXA',
             regras_aplicadas: ['IMOB-LR-001'] };
  }

  /* ---- 4.9.4 Projeção 2026-2033 ----------------------------------------
     As alíquotas de cada ano VÊM do motor genérico (ctx.transicao). Este
     motor não constrói escada nem inventa percentual: se o ano não vier,
     ele bloqueia aquele ano em vez de estimar. */
  function projetarTransicao(entrada, ctx) {
    ctx = ctx || {};
    var tr = ctx.transicao;
    if (!tr || typeof tr !== 'object') {
      return { status: 'BLOQUEADO', bloqueios: [{ codigo: 'T001',
        msg: 'Projeção não realizada: as alíquotas ano a ano devem vir do motor genérico do ATP (ctx.transicao). Este motor não constrói a escada de transição.' }] };
    }
    var anos = [], faltantes = [];
    for (var a = 2026; a <= 2033; a++) {
      var al = tr[a] || tr[String(a)];
      if (!al || typeof al.ibs !== 'number' || typeof al.cbs !== 'number') { faltantes.push(a); continue; }
      var e = JSON.parse(JSON.stringify(entrada));
      e.data_fato_gerador = a + '-06-30';
      var c = JSON.parse(JSON.stringify(ctx));
      c.aliquotas = { ibs: al.ibs, cbs: al.cbs,
                      classificacao: al.classificacao || ctx.aliquotas.classificacao,
                      fonte: al.fonte || 'motor genérico do ATP' };
      var r = calcular(e, c);
      anos.push({ ano: a, ibs_aliquota: r4(al.ibs), cbs_aliquota: r4(al.cbs),
                  classificacao: c.aliquotas.classificacao,
                  base: r.base, ibs: r.ibs, cbs: r.cbs, total: r.total,
                  status: r.status, ano_teste: r.ano_teste_2026 === true });
    }
    return { status: anos.length ? 'CALCULADO' : 'BLOQUEADO', anos: anos, anos_sem_aliquota: faltantes,
             regra_id: 'IMOB-TRA-001', fundamentos: (regra('IMOB-TRA-001') || {}).fontes,
             nota: 'As alíquotas de cada ano são as do motor genérico já validado do Análise Tributária Pro. O módulo imobiliário aplica apenas as reduções e os redutores do regime específico.' };
  }

  /* ---- 4.9.5 Comparativo geral atual × Reforma -------------------------- */
  function comparativoAtualXReforma(cenario, ctx) {
    var atualLP = calcLucroPresumido(cenario.atual || {}, ctx);
    var atualLR = cenario.lucro_real ? calcLucroRealIndicativo(cenario.lucro_real, ctx) : null;
    var reforma = calcular(cenario.reforma, ctx);
    if (reforma.status === 'BLOQUEADO' || atualLP.status === 'BLOQUEADO') {
      return { status: 'BLOQUEADO', mensagem: 'Comparativo não realizado: um dos cenários está bloqueado.',
               presumido: atualLP, reforma: reforma };
    }
    // IRPJ/CSLL permanecem — entram nos dois lados.
    var permLP = atualLP.tributos_permanentes;
    var linhas = [
      { cenario: 'Lucro Presumido — hoje', substituiveis: atualLP.tributos_substituidos,
        permanentes: permLP, total: atualLP.total },
      { cenario: 'Lucro Presumido + IBS/CBS do regime específico', substituiveis: reforma.total,
        permanentes: permLP, total: somaExib([reforma.total, permLP]) }
    ];
    if (atualLR && atualLR.status === 'CALCULADO') {
      linhas.push({ cenario: atualLR.rotulo_obrigatorio, substituiveis: atualLR.tributos_substituidos,
        permanentes: atualLR.tributos_permanentes, total: atualLR.total, indicativo: true });
    }
    var dif = r2(linhas[1].total - linhas[0].total);
    return { status: 'CALCULADO', linhas: linhas,
      variacao: dif, variacao_pct: linhas[0].total > 0 ? r4(dif / linhas[0].total * 100) : 0,
      presumido: atualLP, real: atualLR, reforma: reforma,
      premissa: 'IRPJ e CSLL permanecem nos dois cenários e foram computados dos dois lados. O que muda é a troca de PIS, COFINS e ISS por IBS e CBS.',
      ressalva: 'A comparação usa as alíquotas classificadas como ' + (ctx.aliquotas.classificacao || 'ESTIMADA') +
        '. Enquanto a alíquota de referência não for fixada em norma, nenhuma conclusão sobre "regime mais vantajoso" pode ser apresentada com confiança alta.' };
  }

  /* ---- 4.9.6 Sensibilidade à alíquota ----------------------------------- */
  function sensibilidade(entrada, ctx, variacoes) {
    variacoes = variacoes || [-20, -10, 0, 10, 20];
    var base = ctx.aliquotas;
    return variacoes.map(function (v) {
      var c = JSON.parse(JSON.stringify(ctx));
      c.aliquotas.ibs = r4(base.ibs * (1 + v / 100));
      c.aliquotas.cbs = r4(base.cbs * (1 + v / 100));
      c.aliquotas.classificacao = 'SIMULACAO';
      var r = calcular(entrada, c);
      return { variacao_pct: v, ibs: c.aliquotas.ibs, cbs: c.aliquotas.cbs,
               combinada: r4(c.aliquotas.ibs + c.aliquotas.cbs),
               total: r.total, status: r.status };
    });
  }





  /* =========================================================================
     4.17 FASE 6 — RELEASE, FEATURE FLAGS E ROLLBACK (Seção 22)
     -------------------------------------------------------------------------
     Esteira: desenvolvimento → staging → homologação interna → piloto
     controlado → produção homologada. Regra nova nasce DESATIVADA.
     Rollback nunca apaga cálculo já realizado.
     ========================================================================= */
  var ESTEIRA = ['desenvolvimento', 'staging', 'homologacao_interna', 'piloto_controlado', 'producao_homologada'];

  function podePromover(regraId, ambienteDestino, contexto) {
    contexto = contexto || {};
    var r = REGRAS[regraId];
    if (!r) return { pode: false, motivos: ['Regra inexistente: ' + regraId] };
    var m = [];
    var idx = ESTEIRA.indexOf(ambienteDestino);
    if (idx < 0) return { pode: false, motivos: ['Ambiente desconhecido: ' + ambienteDestino] };

    if (idx >= ESTEIRA.indexOf('homologacao_interna')) {
      if (r.status === 'draft') m.push('Regra ainda em rascunho.');
      if (!r.fontes || !r.fontes.length) m.push('Regra sem fonte legal declarada.');
      if (contexto.fontes_com_hash === false) m.push('Fonte legal sem hash e URL oficial (trava do banco).');
    }
    if (idx >= ESTEIRA.indexOf('piloto_controlado')) {
      if (r.status !== 'homologada' && r.status !== 'ativa') m.push('Regra não homologada.');
      if (contexto.golden_cases_ok === false) m.push('Suíte de golden cases não passou.');
      if (contexto.lacre_integro === false) m.push('Lacre do motor não confere.');
    }
    if (idx >= ESTEIRA.indexOf('producao_homologada')) {
      if (contexto.aprovacoes == null) m.push('Número de aprovações não informado.');
      else if (contexto.alto_impacto && contexto.aprovacoes < 2) m.push('Regra de alto impacto exige 2 aprovações independentes.');
      else if (!contexto.alto_impacto && contexto.aprovacoes < 1) m.push('Exige ao menos 1 aprovação de homologador.');
      if (contexto.editor_id && contexto.aprovadores &&
          contexto.aprovadores.indexOf(contexto.editor_id) >= 0)
        m.push('Segregação de funções: o editor não pode homologar a própria alteração.');
      if (contexto.classificacao_aliquota && contexto.classificacao_aliquota !== 'LEGAL')
        m.push('Alíquota ' + contexto.classificacao_aliquota + ': cabe piloto controlado, não produção homologada.');
      if (contexto.backup_restore_testado === false) m.push('Teste de restauração de backup não realizado.');
      if (contexto.teste_isolamento_tenant === false) m.push('Teste de isolamento entre tenants não realizado.');
    }
    return { pode: m.length === 0, motivos: m, ambiente: ambienteDestino,
             regra: { id: regraId, status: r.status, alto_impacto: !!contexto.alto_impacto } };
  }

  /* Flag por regra e versão. Regra sem flag declarada nasce DESATIVADA. */
  function flagAtiva(regraId, flags) {
    flags = flags || {};
    var r = REGRAS[regraId];
    var chave = regraId + '@' + (r ? r.versao : '?');
    if (flags[chave] !== undefined) return { ativa: !!flags[chave], chave: chave, origem: 'flag por versão' };
    if (flags[regraId] !== undefined) return { ativa: !!flags[regraId], chave: regraId, origem: 'flag por regra' };
    return { ativa: false, chave: chave, origem: 'padrão — regra nova nasce desativada' };
  }

  function planoRollback(versaoAtual, versaoAlvo, calculosNoPeriodo) {
    return {
      de: versaoAtual, para: versaoAlvo,
      calculos_preservados: calculosNoPeriodo || 0,
      acoes: [
        'Reverter o ruleset ativo para ' + versaoAlvo + ' — as regras da versão ' + versaoAtual + ' passam a status suspensa, não são apagadas.',
        'NENHUM snapshot é excluído: cálculos já finalizados permanecem íntegros e consultáveis com o ruleset da época.',
        'Reativar o lacre correspondente à versão alvo e rodar a suíte antes de liberar novo cálculo.',
        'Emitir release note tributária informando a reversão, as regras afetadas e os cálculos do período.'
      ],
      vedacoes: ['Apagar snapshots', 'Reescrever memória de cálculo já emitida', 'Alterar regra publicada em vez de criar nova versão'],
      regras_historicas: 'Regras antigas permanecem consultáveis para histórico (Seção 22).'
    };
  }

  function releaseNote(versao, regrasAlteradas, normas, testes) {
    return {
      versao: versao, data: null,
      normas_de_referencia: normas || [],
      regras_alteradas: (regrasAlteradas || []).map(function (id) {
        var r = REGRAS[id] || {};
        return { regra_id: id, nome: r.nome, versao: r.versao, status: r.status, fontes: r.fontes }; }),
      testes: testes || { total: null, falhas: null },
      lacre_imob: LACRE_IMOB_HASH,
      ruleset: RULESET_VERSAO, motor: MOTOR_IMOB_VERSAO, contrato: CONTRATO_VERSAO,
      impacto: 'Descrever o efeito no cálculo e nos pareceres já emitidos.',
      obrigatorio: 'Release note tributária é pré-requisito de promoção para piloto controlado ou produção (Seção 22).'
    };
  }

  /* =========================================================================
     4.18 SEGURANÇA, LGPD E OBSERVABILIDADE (Seções 20 e 23)
     ========================================================================= */
  var CAMPOS_PESSOAIS = ['cpf', 'cnpj', 'nome', 'email', 'telefone', 'endereco', 'matricula', 'cib'];

  function mascarar(v, tipo) {
    v = String(v == null ? '' : v);
    if (!v) return '';
    if (tipo === 'cpf')  return v.replace(/^(\d{3})\d{3}\d{3}(\d{2})$/, '$1.***.***-$2');
    if (tipo === 'cnpj') return v.replace(/^(\d{2})\d{3}\d{3}(\d{4})(\d{2})$/, '$1.***.***/$2-$3');
    if (tipo === 'email') return v.replace(/^(.).*(@.*)$/, '$1***$2');
    if (v.length <= 4) return '***';
    return v.slice(0, 2) + '***' + v.slice(-2);
  }

  /* Log seguro: nunca sai dado pessoal em claro. */
  function logSeguro(evento) {
    evento = evento || {};
    var saida = {}, k;
    for (k in evento) {
      if (!evento.hasOwnProperty(k)) continue;
      if (CAMPOS_PESSOAIS.indexOf(k) >= 0) saida[k] = mascarar(evento[k], k);
      else if (typeof evento[k] === 'object' && evento[k] !== null) saida[k] = '[objeto omitido do log]';
      else saida[k] = evento[k];
    }
    saida._mascarado = true;
    return saida;
  }

  /* Isolamento entre tenants — verificação chamável pela suíte. */
  function verificarIsolamento(registros, tenantSolicitante) {
    var vazando = (registros || []).filter(function (r) {
      return r && r.escritorio_id !== undefined && r.escritorio_id !== tenantSolicitante; });
    return { total: (registros || []).length, do_tenant: (registros || []).length - vazando.length,
             vazamentos: vazando.length, isolado: vazando.length === 0,
             mensagem: vazando.length
               ? 'VAZAMENTO: ' + vazando.length + ' registro(s) de outro escritório retornaram na consulta.'
               : 'Nenhum registro de outro escritório na consulta.' };
  }

  /* Painel de saúde do módulo (Seção 23). */
  function saudeDoModulo(m) {
    m = m || {};
    var regras = Object.keys(REGRAS);
    var emStaging = regras.filter(function (k) { return REGRAS[k].status === 'staging' || REGRAS[k].status === 'draft'; });
    var lac = lacreVerificar();
    var alertas = [];
    if (!lac.integro) alertas.push({ nivel: 'critico', msg: 'Lacre do motor não confere — publicação bloqueada.' });
    if (m.golden_falhas > 0) alertas.push({ nivel: 'critico', msg: m.golden_falhas + ' golden case(s) divergindo do resultado homologado.' });
    if (emStaging.length) alertas.push({ nivel: 'atencao', msg: emStaging.length + ' regra(s) pendentes de homologação: ' + emStaging.join(', ') + '.' });
    if (m.fonte_mais_antiga && m.fonte_mais_antiga < '2026-01-01')
      alertas.push({ nivel: 'atencao', msg: 'Fonte legislativa coletada antes de 2026 — reconferir hashes.' });
    if (m.erros_rls > 0) alertas.push({ nivel: 'critico', msg: m.erros_rls + ' erro(s) de RLS ou autorização no período.' });
    if (m.tempo_medio_ms > 500) alertas.push({ nivel: 'atencao', msg: 'Tempo médio do motor acima de 500 ms.' });
    var bloqPct = m.calculos_total > 0 ? r4((m.calculos_bloqueados || 0) / m.calculos_total * 100) : 0;
    if (bloqPct > 30) alertas.push({ nivel: 'atencao', msg: bloqPct + '% dos cálculos bloqueados por falta de fundamento — revisar qualidade dos dados de entrada.' });
    return {
      lacre: lac,
      regras: { total: regras.length,
                homologadas: regras.filter(function (k) { return REGRAS[k].status === 'homologada'; }).length,
                ativas: regras.filter(function (k) { return REGRAS[k].status === 'ativa'; }).length,
                pendentes: emStaging },
      metricas: { calculos_total: m.calculos_total || 0, calculos_bloqueados: m.calculos_bloqueados || 0,
                  percentual_bloqueado: bloqPct, tempo_medio_ms: m.tempo_medio_ms || null,
                  erros_rls: m.erros_rls || 0, golden_falhas: m.golden_falhas || 0 },
      alertas: alertas,
      status_geral: alertas.some(function (a) { return a.nivel === 'critico'; }) ? 'CRITICO'
                  : (alertas.length ? 'ATENCAO' : 'SAUDAVEL')
    };
  }

  /* Definition of Done da Seção 27 — checagem programática. */
  function definitionOfDone(ctx) {
    ctx = ctx || {};
    var itens = [
      { id: 'DoD1', txt: 'Fonte legal com hash e URL oficial em toda regra homologada', ok: ctx.fontes_hasheadas !== false },
      { id: 'DoD2', txt: 'Motor determinístico isolado do motor genérico, com selo próprio', ok: lacreVerificar().integro },
      { id: 'DoD3', txt: 'Política matemática única documentada e testada', ok: ctx.politica_matematica !== false },
      { id: 'DoD4', txt: 'Golden cases aprovados e bloqueando o build', ok: ctx.golden_ok !== false },
      { id: 'DoD5', txt: 'Snapshot forense imutável com idempotência', ok: ctx.snapshot_ok !== false },
      { id: 'DoD6', txt: 'Segregação de funções e dupla aprovação para alto impacto', ok: ctx.segregacao_ok !== false },
      { id: 'DoD7', txt: 'Memória de cálculo com fundamentação por linha', ok: ctx.memoria_ok !== false },
      { id: 'DoD8', txt: 'Auditoria com nível de confiança e bloqueio de conclusão em BAIXA', ok: ctx.auditoria_ok !== false },
      { id: 'DoD9', txt: 'Parecer com IA sem cálculo e com guarda anti-alucinação', ok: ctx.parecer_ok !== false },
      { id: 'DoD10', txt: 'RLS ativo e teste de isolamento entre tenants', ok: ctx.isolamento_ok === true },
      { id: 'DoD11', txt: 'Backup automático e teste de restauração', ok: ctx.backup_restore === true },
      { id: 'DoD12', txt: 'Feature flags, rollback sem perda e release note tributária', ok: ctx.release_ok !== false },
      { id: 'DoD13', txt: 'Observabilidade com alertas de fonte desatualizada e divergência', ok: ctx.observabilidade !== false },
      { id: 'DoD14', txt: 'Alíquotas classificadas como LEGAL', ok: ctx.aliquota_legal === true }
    ];
    var faltam = itens.filter(function (i) { return !i.ok; });
    return { itens: itens, atendidos: itens.length - faltam.length, total: itens.length,
             pendentes: faltam,
             producao_homologada_liberada: faltam.length === 0,
             veredito: faltam.length === 0 ? 'PRODUÇÃO HOMOLOGADA LIBERADA'
               : 'PILOTO CONTROLADO — ' + faltam.length + ' item(ns) do Definition of Done em aberto.' };
  }

  /* =========================================================================
     4.15 FASE 5 — IMPORTAÇÃO, EVIDÊNCIAS E QUALIDADE DE DADOS (Seção 24)
     -------------------------------------------------------------------------
     Princípio: OCR e extração por IA NUNCA viram dado fiscal definitivo.
     Todo campo carrega procedência e status de validação, e o motor se recusa
     a calcular com campo essencial ainda não validado.
     ========================================================================= */
  var ORIGENS_DADO = ['manual', 'importacao', 'ia', 'api'];
  var STATUS_DADO  = ['nao_validado', 'validado', 'rejeitado'];

  /* Campos que, se não validados, impedem o cálculo definitivo. */
  var CAMPOS_ESSENCIAIS = ['valor_operacao', 'data_fato_gerador', 'valor_aquisicao',
                           'valor_referencia', 'redutor_ajuste_saldo', 'receita_mensal'];

  function campo(valor, origem, opts) {
    opts = opts || {};
    var org = ORIGENS_DADO.indexOf(origem) >= 0 ? origem : 'manual';
    return {
      valor: valor,
      origem: org,
      // só o preenchimento manual nasce validado; o resto exige confirmação
      status: opts.status || (org === 'manual' ? 'validado' : 'nao_validado'),
      evidencia_id: opts.evidencia_id || null,
      extraido_de: opts.extraido_de || null,      // ex.: 'matricula.pdf, pág. 2'
      confianca_extracao: typeof opts.confianca_extracao === 'number' ? opts.confianca_extracao : null,
      validado_por: opts.validado_por || null,
      validado_em: opts.validado_em || null
    };
  }

  function validarCampo(c, usuario, quando) {
    if (!c) return c;
    if (c.origem !== 'manual' && !c.evidencia_id)
      return { erro: 'Campo de origem ' + c.origem + ' não pode ser validado sem evidência vinculada.' };
    c.status = 'validado'; c.validado_por = usuario || null; c.validado_em = quando || null;
    return c;
  }

  /* Verificações de tipo, faixa, consistência e duplicidade (Seção 24). */
  function validarImportacao(linhas, ctx) {
    linhas = Array.isArray(linhas) ? linhas : [];
    ctx = ctx || {};
    var problemas = [], avisos = [], vistos = {}, aceitas = 0;
    var hoje = ctx.hoje || '2026-08-20';

    linhas.forEach(function (l, i) {
      var ref = l.linha || (i + 1), erros = [];

      // tipo
      if (typeof l.valor_operacao !== 'number' || !isFinite(l.valor_operacao))
        erros.push({ campo: 'valor_operacao', tipo: 'tipo', msg: 'Valor não numérico.' });
      if (l.data_fato_gerador && !/^\d{4}-\d{2}-\d{2}$/.test(l.data_fato_gerador))
        erros.push({ campo: 'data_fato_gerador', tipo: 'tipo', msg: 'Data fora do formato AAAA-MM-DD.' });

      // faixa
      if (typeof l.valor_operacao === 'number') {
        if (l.valor_operacao <= 0) erros.push({ campo: 'valor_operacao', tipo: 'faixa', msg: 'Valor deve ser maior que zero.' });
        if (l.valor_operacao > 1e12) erros.push({ campo: 'valor_operacao', tipo: 'faixa', msg: 'Valor implausível (acima de 1 trilhão) — provável erro de separador decimal.' });
      }
      // Data futura dentro da transição é o uso normal do módulo (projeção até 2033).
      // Só vira erro de faixa depois do fim da transição ou antes do início do regime.
      if (l.data_fato_gerador && /^\d{4}-/.test(l.data_fato_gerador)) {
        var anoL = parseInt(l.data_fato_gerador.slice(0, 4), 10);
        if (anoL < 2026)
          erros.push({ campo: 'data_fato_gerador', tipo: 'faixa', msg: 'Fato gerador anterior ao início do regime (2026).' });
        else if (anoL > 2033 && l.permite_futuro !== true)
          erros.push({ campo: 'data_fato_gerador', tipo: 'faixa', msg: 'Data posterior ao fim da transição sem marcação explícita de projeção.' });
        else if (l.data_fato_gerador > hoje)
          avisos.push({ linha: ref, campo: 'data_fato_gerador',
            msg: 'Data futura: a linha é tratada como PROJEÇÃO, não como fato gerador ocorrido.' });
      }
      if (l.fracao_area_residencial != null && (l.fracao_area_residencial <= 0 || l.fracao_area_residencial > 1))
        erros.push({ campo: 'fracao_area_residencial', tipo: 'faixa', msg: 'Fração deve ficar entre 0 e 1.' });

      // consistência
      if (l.operacao === 'venda' && !l.imovel_codigo)
        erros.push({ campo: 'imovel_codigo', tipo: 'consistencia', msg: 'Alienação sem imóvel vinculado.' });
      if (typeof l.redutor_ajuste_saldo === 'number' && typeof l.valor_operacao === 'number' &&
          l.redutor_ajuste_saldo > l.valor_operacao * 3)
        erros.push({ campo: 'redutor_ajuste_saldo', tipo: 'consistencia', msg: 'Redutor mais de 3x maior que a operação — conferir a origem do saldo.' });
      if (Array.isArray(l.pagamentos) && typeof l.valor_operacao === 'number') {
        var soma = l.pagamentos.reduce(function (a, b) { return a + naoNeg(b); }, 0);
        if (Math.abs(soma - l.valor_operacao) > 0.02)
          erros.push({ campo: 'pagamentos', tipo: 'consistencia',
            msg: 'Soma dos pagamentos (' + r2(soma) + ') não fecha com o valor da operação (' + r2(l.valor_operacao) + ').' });
      }
      if (l.data_aquisicao && l.data_fato_gerador && l.data_aquisicao > l.data_fato_gerador)
        erros.push({ campo: 'data_aquisicao', tipo: 'consistencia', msg: 'Aquisição posterior ao fato gerador.' });

      // duplicidade
      var chave = [l.imovel_codigo || '', l.operacao || '', l.data_fato_gerador || '',
                   typeof l.valor_operacao === 'number' ? r2(l.valor_operacao) : ''].join('|');
      if (vistos[chave] !== undefined)
        erros.push({ campo: '(linha)', tipo: 'duplicidade',
          msg: 'Mesma combinação de imóvel, operação, data e valor já apareceu na linha ' + vistos[chave] + '.' });
      else vistos[chave] = ref;

      if (erros.length) problemas.push({ linha: ref, erros: erros });
      else aceitas++;
    });

    var porTipo = { tipo: 0, faixa: 0, consistencia: 0, duplicidade: 0 };
    problemas.forEach(function (p) { p.erros.forEach(function (e) { porTipo[e.tipo]++; }); });

    return {
      total: linhas.length, aceitas: aceitas, rejeitadas: problemas.length,
      problemas: problemas, avisos: avisos, por_tipo: porTipo,
      pode_importar: problemas.length === 0,
      regra: 'Nenhuma linha com erro é importada. A importação é tudo-ou-nada por lote: importar parcialmente deixaria o lote irreconciliável com o arquivo de origem.'
    };
  }

  /* Bloqueia cálculo definitivo com campo essencial não validado (Seção 24). */
  function conferirProcedencia(campos) {
    campos = campos || {};
    var pendentes = [], porOrigem = { manual: 0, importacao: 0, ia: 0, api: 0 };
    Object.keys(campos).forEach(function (k) {
      var c = campos[k];
      if (!c || typeof c !== 'object' || !c.origem) return;
      porOrigem[c.origem] = (porOrigem[c.origem] || 0) + 1;
      if (c.status !== 'validado' && CAMPOS_ESSENCIAIS.indexOf(k) >= 0)
        pendentes.push({ campo: k, origem: c.origem, extraido_de: c.extraido_de,
                         confianca_extracao: c.confianca_extracao });
    });
    return {
      por_origem: porOrigem,
      pendentes_de_validacao: pendentes,
      permite_calculo_definitivo: pendentes.length === 0,
      mensagem: pendentes.length
        ? 'Há ' + pendentes.length + ' campo(s) essencial(is) ainda não validado(s). Extração automática não vira dado fiscal sem confirmação humana.'
        : 'Todos os campos essenciais estão validados.'
    };
  }

  /* =========================================================================
     4.16 CONTRATO DE API E IDEMPOTÊNCIA (Seção 19)
     ========================================================================= */
  var API_CONTRATOS = {
    'POST /imobiliario/calculos/simular':   { idempotente: false, exige: ['ruleset_version', 'calculation_contract_version'] },
    'POST /imobiliario/calculos/finalizar': { idempotente: true,  exige: ['idempotency_key', 'tenant_id', 'request_id',
                                                                          'engine_version', 'ruleset_version', 'calculation_contract_version'] },
    'GET  /imobiliario/calculos/{id}/memoria':     { idempotente: true, exige: ['tenant_id'] },
    'GET  /imobiliario/calculos/{id}/fundamentos': { idempotente: true, exige: ['tenant_id'] },
    'POST /imobiliario/regras/validar':    { idempotente: false, exige: ['tenant_id', 'perfil:editor_tributario'] },
    'POST /imobiliario/regras/publicar':   { idempotente: false, exige: ['tenant_id', 'perfil:homologador_tributario'] }
  };

  function validarRequisicao(rota, cab) {
    var c = API_CONTRATOS[rota];
    if (!c) return { aceita: false, faltando: [], erro: 'Rota não reconhecida: ' + rota };
    cab = cab || {};
    var faltando = c.exige.filter(function (k) {
      return k.indexOf('perfil:') === 0
        ? (cab.perfis || []).indexOf(k.slice(7)) < 0
        : !cab[k];
    });
    return { aceita: faltando.length === 0, faltando: faltando, idempotente: c.idempotente,
             erro: faltando.length ? 'Cabeçalhos ou permissões ausentes: ' + faltando.join(', ') : null };
  }

  /* Mesma idempotency_key no mesmo tenant devolve o MESMO resultado, sem novo snapshot. */
  function finalizarCalculo(e, ctx, cab, registro) {
    registro = registro || {};   // { 'tenant|key': snapshot }
    var v = validarRequisicao('POST /imobiliario/calculos/finalizar', cab);
    if (!v.aceita) return { status: 'REJEITADO', http: 400, erro: v.erro, faltando: v.faltando };
    var chave = cab.tenant_id + '|' + cab.idempotency_key;
    if (registro[chave]) {
      return { status: 'JA_FINALIZADO', http: 200, reenvio: true,
               snapshot: registro[chave], novo_snapshot_criado: false,
               nota: 'Mesma idempotency_key no mesmo tenant: devolvido o resultado já finalizado, sem criar novo snapshot (Seção 19.1).' };
    }
    var res = calcular(e, ctx);
    var snap = montarSnapshot(e, res, ctx, {
      request_id: cab.request_id, correlation_id: cab.correlation_id,
      empresa_id: cab.tenant_id, engine_build_id: cab.engine_version,
      calculado_por: cab.usuario_id || null
    });
    registro[chave] = snap;
    return { status: res.status === 'BLOQUEADO' ? 'BLOQUEADO' : 'FINALIZADO',
             http: res.status === 'BLOQUEADO' ? 422 : 201,
             resultado: res, snapshot: snap, novo_snapshot_criado: true, registro: registro };
  }

  /* =========================================================================
     4.14 MOTOR DE CRÉDITOS (LC 214/2025, arts. 47 a 56)
     -------------------------------------------------------------------------
     O crédito NÃO nasce da nota: nasce da EXTINÇÃO do débito da operação
     anterior (art. 47, caput). A dispensa desse requisito é excepcional e
     depende de não ter havido split payment nem recolhimento pelo adquirente
     (art. 48). Por isso o motor exige o status de extinção e, sem ele, não
     apropria — em vez de assumir que o crédito existe.
     ========================================================================= */
  var CRED_EXTINCAO = ['split_payment', 'recolhimento_adquirente', 'pagamento_fornecedor',
                       'compensacao', 'nenhuma'];
  var CRED_SEM_DIREITO = ['imune', 'isenta', 'aliquota_zero', 'diferimento', 'suspensao'];

  function apurarCreditos(itens, ctx) {
    itens = Array.isArray(itens) ? itens : [];
    var L = [], ordem = 0, apropriados = 0, negados = [], obs = [];
    var ibsAp = 0, cbsAp = 0;

    itens.forEach(function (it, i) {
      var id = it.id || ('item-' + (i + 1));
      var vIbs = naoNeg(it.ibs || 0), vCbs = naoNeg(it.cbs || 0), v = vIbs + vCbs;
      var sit = it.situacao || 'tributada';
      var ext = it.extincao || 'nenhuma';

      if (it.uso_consumo_pessoal === true) {
        negados.push({ item: id, valor: r2(v), motivo: 'Bem ou serviço de uso ou consumo pessoal — vedação expressa do art. 47, caput, c/c art. 57.', regra: 'IMOB-CRE-001' });
        return;
      }
      if (CRED_SEM_DIREITO.indexOf(sit) >= 0) {
        if (sit === 'aliquota_zero') {
          // art. 52 — alíquota zero MANTÉM os créditos das operações anteriores
          obs.push('Item ' + id + ': operação a alíquota zero — os créditos das operações anteriores são mantidos (art. 52).');
        } else if (sit === 'suspensao') {
          negados.push({ item: id, valor: r2(v), motivo: 'Suspensão: a apropriação só é admitida no momento da extinção do débito, e nunca sobre acréscimos legais (art. 50).', regra: 'IMOB-CRE-002' });
          return;
        } else {
          negados.push({ item: id, valor: r2(v), motivo: 'Operação ' + sit + ' não permite apropriação de crédito pelo adquirente (art. 49). Créditos presumidos expressos na lei não são afetados por esta regra.', regra: 'IMOB-CRE-002' });
          return;
        }
      }
      if (ext === 'nenhuma') {
        if (it.dispensa_art48 === true) {
          obs.push('Item ' + id + ': requisito de extinção dispensado — não houve split payment nem recolhimento pelo adquirente (art. 48).');
        } else {
          negados.push({ item: id, valor: r2(v), motivo: 'Débito da operação anterior não extinto. O crédito só se apropria com a extinção (art. 47, caput); a dispensa do art. 48 não foi declarada.', regra: 'IMOB-CRE-001' });
          return;
        }
      }
      if (it.documento_idoneo === false) {
        negados.push({ item: id, valor: r2(v), motivo: 'Item sem documento fiscal idôneo vinculado.', regra: 'IMOB-CRE-001' });
        return;
      }
      // art. 47, §1º, I — apropriação SEGREGADA por tributo
      ibsAp += vIbs; cbsAp += vCbs; apropriados += v;
      L.push(linha(++ordem, 'Crédito apropriado — ' + id,
        'IBS e CBS segregados (art. 47, §1º, I)',
        { situacao: sit, extincao: ext, ibs: r2(vIbs), cbs: r2(vCbs) }, v, 'IMOB-CRE-001'));
    });

    // art. 51 — imunidade e isenção NAS SAÍDAS anulam créditos proporcionalmente
    var anulacao = 0, propAnul = 0;
    var saidas = (ctx && ctx.saidas) || null;
    if (saidas && saidas.total > 0) {
      var isentas = naoNeg(saidas.imunes_isentas || 0);
      var exportacao = naoNeg(saidas.exportacao || 0);
      propAnul = (isentas) / saidas.total;                 // exportação não anula (art. 51, §2º, I)
      anulacao = apropriados * propAnul;
      if (anulacao > 0) {
        L.push(linha(++ordem, 'Anulação proporcional de créditos',
          'créditos × (saídas imunes e isentas ÷ total das saídas); exportação não anula',
          { imunes_isentas: r2(isentas), exportacao: r2(exportacao), total_saidas: r2(saidas.total),
            proporcao: r4(propAnul * 100) }, -anulacao, 'IMOB-CRE-002'));
      }
    }

    var liquido = naoNeg(apropriados - anulacao);
    return {
      itens_analisados: itens.length,
      creditos_apropriados: r2(apropriados),
      ibs: r2(ibsAp), cbs: r2(cbsAp),
      anulacao_proporcional: r2(anulacao), proporcao_anulacao: r4(propAnul * 100),
      creditos_liquidos: r2(liquido),
      negados: negados, total_negado: r2(negados.reduce(function (a, b) { return a + b.valor; }, 0)),
      observacoes: obs, linhas: L,
      ordem_de_uso: ['1º — saldo a recolher de períodos anteriores, não extinto e não inscrito em dívida ativa, inclusive acréscimos (art. 53, I)',
                     '2º — débitos do mesmo período de apuração, em ordem cronológica (art. 53, II)'],
      prazo: 'O direito de utilizar o crédito extingue-se em 5 anos, contados do primeiro dia do período seguinte ao da apropriação (art. 54).',
      intransferibilidade: 'Vedada a transferência a outra pessoa, salvo sucessão por fusão, cisão ou incorporação, preservada a data original de apropriação (art. 55).',
      regras_aplicadas: ['IMOB-CRE-001', 'IMOB-CRE-002', 'IMOB-CRE-003']
    };
  }


  /* =========================================================================
     4.19 INVENTÁRIO TRIBUTÁRIO DE 31/12/2026 (melhoria 1)
     -------------------------------------------------------------------------
     O redutor de ajuste se constitui numa DATA ÚNICA (art. 375) e a opção do
     art. 375, I, "b" é DEFINITIVA POR IMÓVEL. Toda a carteira precisa passar
     por essa decisão antes de 31/12/2026 — depois disso, o que não foi
     inventariado simplesmente não gera redutor.

     Esta função olha a CARTEIRA, não o imóvel: diz o que está decidido, o que
     está pronto para decidir, o que falta dado, e quanto de redutor já está
     constituído. Ela NÃO escolhe por ninguém.
     ========================================================================= */
  var DATA_CORTE_INVENTARIO = '2026-12-31';

  function diasAte(deData, ateData) {
    var a = new Date(deData + 'T00:00:00Z'), b = new Date(ateData + 'T00:00:00Z');
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round((b - a) / 86400000);
  }

  function inventario2026(imoveis, ctx) {
    imoveis = Array.isArray(imoveis) ? imoveis : [];
    ctx = ctx || {};
    var hoje = ctx.hoje || '2026-08-20';
    var itens = [], tot = {
      total: imoveis.length, exercidos: 0, prontos: 0, faltam_dados: 0, fora_do_inventario: 0,
      redutor_constituido: 0, potencial_maximo: 0, potencial_minimo: 0, em_risco: 0
    };

    imoveis.forEach(function (im) {
      var r = rajValorInicial(im, ctx);
      var linha = {
        id: im.id || null, codigo: im.codigo_interno || im.codigo || '(sem código)',
        empresa_id: im.empresa_id || null, tipo: im.tipo || null,
        hipotese: r.hipotese, data_constituicao: r.data_constituicao,
        opcoes: r.opcoes, pendencias: r.bloqueios.slice()
      };

      if (r.hipotese === 'III') {
        // adquirido de não contribuinte a partir de 2027: não integra o
        // inventário da data de corte — o redutor nasce na própria aquisição
        linha.status = 'fora_do_inventario';
        linha.observacao = 'Redutor constituído na data da aquisição (art. 375, III), não em 31/12/2026.';
        tot.fora_do_inventario++;
      } else if (im.raj_opcao_escolhida) {
        linha.status = 'exercida';
        linha.escolha = im.raj_opcao_escolhida;
        linha.justificativa = im.raj_justificativa || null;
        linha.valor = im.raj_saldo != null ? r2(im.raj_saldo) : null;
        if (!im.raj_justificativa) linha.pendencias.push({ codigo: 'I001',
          msg: 'Opção exercida sem justificativa gravada — exigida pelo art. 375 e pela trilha de auditoria.' });
        tot.exercidos++;
        tot.redutor_constituido = r2(tot.redutor_constituido + naoNeg(linha.valor));
      } else if (r.bloqueios.length) {
        linha.status = 'faltam_dados';
        tot.faltam_dados++;
        tot.em_risco++;
      } else {
        linha.status = 'pronto_para_escolher';
        tot.prontos++;
        tot.em_risco++;
      }

      // potencial de redutor ainda não constituído
      if (linha.status === 'pronto_para_escolher') {
        var vals = r.opcoes.filter(function (o) { return typeof o.valor === 'number'; })
                           .map(function (o) { return o.valor; });
        if (vals.length) {
          linha.potencial_min = r2(Math.min.apply(null, vals));
          linha.potencial_max = r2(Math.max.apply(null, vals));
          linha.diferenca_entre_opcoes = r2(linha.potencial_max - linha.potencial_min);
          tot.potencial_maximo = r2(tot.potencial_maximo + linha.potencial_max);
          tot.potencial_minimo = r2(tot.potencial_minimo + linha.potencial_min);
        }
      }
      itens.push(linha);
    });

    var dias = diasAte(hoje, DATA_CORTE_INVENTARIO);
    var urgencia = dias == null ? 'DESCONHECIDA'
                 : dias < 0 ? 'PRAZO_VENCIDO'
                 : dias <= 30 ? 'CRITICA'
                 : dias <= 90 ? 'ALTA'
                 : dias <= 180 ? 'MEDIA' : 'NORMAL';

    var alertas = [];
    if (dias != null && dias < 0 && tot.em_risco > 0)
      alertas.push({ nivel: 'critico', msg: 'Prazo de 31/12/2026 vencido com ' + tot.em_risco +
        ' imóvel(is) sem opção exercida — esses imóveis não constituíram redutor de ajuste.' });
    else if (tot.em_risco > 0)
      alertas.push({ nivel: dias != null && dias <= 90 ? 'critico' : 'atencao',
        msg: tot.em_risco + ' imóvel(is) ainda sem opção exercida, faltando ' + dias + ' dia(s) para 31/12/2026.' });
    if (tot.faltam_dados > 0)
      alertas.push({ nivel: 'atencao', msg: tot.faltam_dados + ' imóvel(is) sem dado suficiente para nem ' +
        'apresentar as opções — levantar valor de aquisição, valor de referência ou o fator de atualização.' });
    var semJust = itens.filter(function (i) {
      return i.status === 'exercida' && i.pendencias.some(function (p) { return p.codigo === 'I001'; }); });
    if (semJust.length)
      alertas.push({ nivel: 'atencao', msg: semJust.length + ' opção(ões) exercida(s) sem justificativa gravada.' });

    return {
      data_corte: DATA_CORTE_INVENTARIO, hoje: hoje, dias_restantes: dias, urgencia: urgencia,
      totais: tot, itens: itens, alertas: alertas,
      diferenca_em_jogo: r2(tot.potencial_maximo - tot.potencial_minimo),
      regra_id: 'IMOB-RAJ-002', fundamentos: (regra('IMOB-RAJ-002') || {}).fontes,
      nota: 'A opção do art. 375, I, "b" é do contribuinte e é definitiva. Este quadro mostra o estado da ' +
            'carteira e o que está em jogo; a escolha continua sendo caso a caso, com justificativa gravada.'
    };
  }

  /* Agrupa o inventário por empresa — é assim que o escritório trabalha. */
  function inventarioPorEmpresa(imoveis, ctx) {
    var geral = inventario2026(imoveis, ctx);
    var mapa = {};
    geral.itens.forEach(function (i) {
      var k = i.empresa_id || '(sem empresa)';
      if (!mapa[k]) mapa[k] = { empresa_id: k, total: 0, exercidos: 0, em_risco: 0,
                                redutor_constituido: 0, potencial_maximo: 0 };
      var g = mapa[k];
      g.total++;
      if (i.status === 'exercida') { g.exercidos++; g.redutor_constituido = r2(g.redutor_constituido + naoNeg(i.valor)); }
      if (i.status === 'pronto_para_escolher' || i.status === 'faltam_dados') g.em_risco++;
      if (i.potencial_max) g.potencial_maximo = r2(g.potencial_maximo + i.potencial_max);
    });
    var lista = Object.keys(mapa).map(function (k) { return mapa[k]; })
      .sort(function (a, b) { return b.em_risco - a.em_risco || b.potencial_maximo - a.potencial_maximo; });
    return { data_corte: geral.data_corte, dias_restantes: geral.dias_restantes,
             urgencia: geral.urgencia, empresas: lista, totais: geral.totais, alertas: geral.alertas };
  }


  /* =========================================================================
     4.20 COMPARADOR DE CRITÉRIO NA CARTEIRA (melhoria 2)
     -------------------------------------------------------------------------
     A escolha do art. 375, I, "b" é imóvel a imóvel — mas a decisão racional
     se enxerga no conjunto. Esta função responde três perguntas diferentes,
     que costumam ser confundidas:
       1. quanto rende adotar o MESMO critério em toda a carteira;
       2. quanto rende escolher o melhor critério EM CADA imóvel;
       3. quanto custa errar, isto é, a distância entre a melhor e a pior.
     A 2 é sempre >= a 1. A diferença entre elas é o valor do trabalho de
     analisar caso a caso em vez de padronizar.
     ========================================================================= */
  function compararCriterioCarteira(imoveis, ctx) {
    imoveis = Array.isArray(imoveis) ? imoveis : [];
    ctx = ctx || {};
    var porAquisicao = 0, porReferencia = 0, melhorCaso = 0, piorCaso = 0;
    var semAquisicao = [], semReferencia = [], itens = [], considerados = 0;

    imoveis.forEach(function (im) {
      if (im.raj_opcao_escolhida) return;                       // já decidido
      var r = rajValorInicial(im, ctx);
      if (r.hipotese !== 'I') return;                           // só a hipótese com opção
      var a = null, b = null;
      r.opcoes.forEach(function (o) {
        if (o.chave === 'aquisicao' && typeof o.valor === 'number') a = o.valor;
        if (o.chave === 'referencia' && typeof o.valor === 'number') b = o.valor;
      });
      var cod = im.codigo_interno || im.codigo || '(sem código)';
      if (a === null) semAquisicao.push(cod);
      if (b === null) semReferencia.push(cod);
      if (a === null && b === null) return;
      considerados++;

      var disp = [a, b].filter(function (v) { return v !== null; });
      var mx = Math.max.apply(null, disp), mn = Math.min.apply(null, disp);
      porAquisicao   += (a !== null ? a : mn);
      porReferencia  += (b !== null ? b : mn);
      melhorCaso += mx; piorCaso += mn;

      itens.push({ codigo: cod, empresa_id: im.empresa_id || null,
                   aquisicao: a === null ? null : r2(a), referencia: b === null ? null : r2(b),
                   melhor: a === null ? 'referencia' : (b === null ? 'aquisicao' : (b > a ? 'referencia' : 'aquisicao')),
                   diferenca: r2(mx - mn) });
    });

    var uniformeMelhor = porReferencia >= porAquisicao ? 'referencia' : 'aquisicao';
    var uniformeValor = Math.max(porAquisicao, porReferencia);
    var ganhoCasoACaso = r2(melhorCaso - uniformeValor);
    var custoDoErro = r2(melhorCaso - piorCaso);

    // efeito no imposto: a base do redutor reduz base tributável, e a alíquota
    // da alienação já vem reduzida em 50% pelo art. 379.
    var efeito = null;
    if (ctx.aliquotas && typeof ctx.aliquotas.ibs === 'number') {
      var alq = aliquotasReduzidas(ctx, 50);
      var pct = (alq.ibs + alq.cbs) / 100;
      efeito = {
        aliquota_combinada_reduzida: r4(alq.ibs + alq.cbs),
        classificacao: alq.classificacao,
        imposto_evitado_melhor_caso: r2(melhorCaso * pct),
        imposto_evitado_uniforme: r2(uniformeValor * pct),
        ganho_de_analisar_caso_a_caso: r2(ganhoCasoACaso * pct),
        custo_de_escolher_errado: r2(custoDoErro * pct),
        ressalva: 'Efeito no imposto calculado com alíquota ' + alq.classificacao +
          '. O redutor só vira imposto evitado quando e se o imóvel for alienado, e até o limite da base.'
      };
    }

    return {
      considerados: considerados, ja_decididos: imoveis.length - considerados,
      total_por_criterio: { aquisicao: r2(porAquisicao), referencia: r2(porReferencia) },
      criterio_uniforme_melhor: uniformeMelhor, valor_uniforme: r2(uniformeValor),
      valor_caso_a_caso: r2(melhorCaso), valor_pior_caso: r2(piorCaso),
      ganho_de_analisar_caso_a_caso: ganhoCasoACaso,
      custo_de_escolher_errado: custoDoErro,
      itens: itens.sort(function (x, y) { return y.diferenca - x.diferenca; }),
      lacunas: { sem_valor_de_aquisicao: semAquisicao, sem_valor_de_referencia: semReferencia },
      efeito_no_imposto: efeito,
      leitura: 'Padronizar o critério em toda a carteira renderia ' + r2(uniformeValor) +
        ' de redutor; escolher o melhor em cada imóvel renderia ' + r2(melhorCaso) +
        '. A diferença de ' + ganhoCasoACaso + ' é o que se ganha analisando caso a caso.',
      regra_id: 'IMOB-RAJ-002', fundamentos: (regra('IMOB-RAJ-002') || {}).fontes,
      aviso: 'Este quadro é insumo de decisão, não decisão. A opção é do contribuinte, exige ' +
             'justificativa e é definitiva por imóvel (art. 375, I, "b").'
    };
  }

  /* =========================================================================
     4.21 NF-e DE ALIENAÇÃO DE BENS IMÓVEIS — MODELO 77 (melhoria 5)
     -------------------------------------------------------------------------
     Prevista nos regulamentos (RIBS/RCBS art. 2º, III). Ainda não há emissão
     em produção; prever o campo agora evita migração depois.
     ========================================================================= */
  var NFE_ABI_MODELO = '77';

  function validarChaveNFe(chave) {
    var c = String(chave || '').replace(/\D/g, '');
    if (!c) return { valida: false, motivo: 'Chave não informada.' };
    if (c.length !== 44) return { valida: false, motivo: 'A chave tem ' + c.length + ' dígitos; deveria ter 44.' };
    var modelo = c.substr(20, 2);
    if (modelo !== NFE_ABI_MODELO)
      return { valida: false, modelo: modelo,
               motivo: 'Modelo ' + modelo + ' — a NF-e de Alienação de Bens Imóveis é o modelo 77.' };
    // dígito verificador, módulo 11 com pesos 2..9
    var soma = 0, peso = 2;
    for (var i = 42; i >= 0; i--) { soma += parseInt(c.charAt(i), 10) * peso; peso = peso === 9 ? 2 : peso + 1; }
    var resto = soma % 11, dv = (resto === 0 || resto === 1) ? 0 : 11 - resto;
    if (dv !== parseInt(c.charAt(43), 10))
      return { valida: false, motivo: 'Dígito verificador não confere (calculado ' + dv + ').' };
    return { valida: true, chave: c, modelo: modelo,
             uf: c.substr(0, 2), competencia: '20' + c.substr(2, 2) + '-' + c.substr(4, 2),
             cnpj_emitente: c.substr(6, 14), serie: c.substr(22, 3), numero: c.substr(25, 9),
             fonte: 'RIBS/RCBS art. 2º, III — NF-e ABI, modelo 77' };
  }

  /* =========================================================================
     4.22 DECADÊNCIA DO CRÉDITO — ART. 54 (melhoria 6)
     -------------------------------------------------------------------------
     "Extingue-se em 5 anos, contados do PRIMEIRO DIA DO PERÍODO SEGUINTE ao da
     apropriação." O marco não é a data da apropriação — é o primeiro dia do
     mês seguinte. Errar isso dá até 30 dias de diferença.
     ========================================================================= */
  function limiteDecadencia(competenciaApropriacao) {
    var m = /^(\d{4})-(\d{2})$/.exec(String(competenciaApropriacao || ''));
    if (!m) return null;
    var ano = parseInt(m[1], 10), mes = parseInt(m[2], 10);
    // primeiro dia do período seguinte
    var aIni = mes === 12 ? ano + 1 : ano, mIni = mes === 12 ? 1 : mes + 1;
    var aFim = aIni + 5;
    var d = new Date(Date.UTC(aFim, mIni - 1, 1));
    d.setUTCDate(d.getUTCDate() - 1);          // último dia do quinquênio
    return { inicio_contagem: aIni + '-' + ('0' + mIni).slice(-2) + '-01',
             limite: d.toISOString().slice(0, 10) };
  }

  function decadenciaCreditos(creditos, ctx) {
    creditos = Array.isArray(creditos) ? creditos : [];
    ctx = ctx || {};
    var hoje = ctx.hoje || '2026-08-20';
    var itens = [], tot = { total: 0, vigentes: 0, a_vencer_180: 0, a_vencer_90: 0, decaidos: 0,
                            valor_total: 0, valor_em_risco: 0, valor_decaido: 0 };

    creditos.forEach(function (c) {
      var lim = limiteDecadencia(c.competencia);
      var v = naoNeg(c.valor || 0);
      tot.total++; tot.valor_total = r2(tot.valor_total + v);
      if (!lim) {
        itens.push({ id: c.id || null, competencia: c.competencia || null, valor: r2(v),
                     situacao: 'competencia_invalida',
                     msg: 'Competência fora do formato AAAA-MM — prazo não calculado.' });
        return;
      }
      var dias = diasAte(hoje, lim.limite);
      var sit = dias < 0 ? 'decaido' : (dias <= 90 ? 'critico' : (dias <= 180 ? 'atencao' : 'vigente'));
      if (sit === 'decaido') { tot.decaidos++; tot.valor_decaido = r2(tot.valor_decaido + v); }
      else if (sit === 'critico') { tot.a_vencer_90++; tot.valor_em_risco = r2(tot.valor_em_risco + v); }
      else if (sit === 'atencao') { tot.a_vencer_180++; tot.valor_em_risco = r2(tot.valor_em_risco + v); }
      else tot.vigentes++;
      itens.push({ id: c.id || null, competencia: c.competencia, valor: r2(v),
                   inicio_contagem: lim.inicio_contagem, limite: lim.limite,
                   dias_restantes: dias, situacao: sit });
    });

    var alertas = [];
    if (tot.decaidos)
      alertas.push({ nivel: 'critico', msg: tot.decaidos + ' crédito(s) já decaído(s), somando ' +
        tot.valor_decaido + '. O direito de utilizar extinguiu-se (art. 54).' });
    if (tot.a_vencer_90)
      alertas.push({ nivel: 'critico', msg: tot.a_vencer_90 + ' crédito(s) vencem em até 90 dias.' });
    if (tot.a_vencer_180)
      alertas.push({ nivel: 'atencao', msg: tot.a_vencer_180 + ' crédito(s) vencem entre 90 e 180 dias.' });

    return { hoje: hoje, totais: tot,
             itens: itens.sort(function (a, b) {
               return (a.dias_restantes == null ? 1e9 : a.dias_restantes) -
                      (b.dias_restantes == null ? 1e9 : b.dias_restantes); }),
             alertas: alertas,
             regra_id: 'IMOB-CRE-003', fundamentos: (regra('IMOB-CRE-003') || {}).fontes,
             nota: 'A contagem começa no PRIMEIRO DIA DO PERÍODO SEGUINTE ao da apropriação, não na data ' +
                   'da apropriação (art. 54). A ordem de utilização do art. 53 é o que consome o saldo antes do prazo.' };
  }

  /* =========================================================================
     4.10 FASE 4 — AUDITORIA, RISCO E NÍVEL DE CONFIANÇA (Seção 16)
     -------------------------------------------------------------------------
     Roda ANTES de liberar o resultado. Não corrige nada: aponta.
     Severidade: impeditivo > alto > medio > baixo.
     BAIXA confiança IMPEDE conclusão definitiva — não é só um aviso.
     ========================================================================= */
  var AUDIT_SEVERIDADE = { impeditivo: 4, alto: 3, medio: 2, baixo: 1 };

  function auditar(e, res, ctx) {
    e = e || {}; res = res || {}; ctx = ctx || {};
    var A = [], hoje = (ctx.hoje || '2026-08-20');
    function add(cod, sev, titulo, detalhe, fonte) {
      A.push({ codigo: cod, severidade: sev, titulo: titulo, detalhe: detalhe, fonte: fonte || null });
    }

    // 1. Datas
    if (e.data_fato_gerador) {
      var ano = parseInt(e.data_fato_gerador.slice(0, 4), 10);
      if (ano < 2026) add('A01', 'impeditivo', 'Fato gerador anterior ao início do regime',
        'O regime específico de bens imóveis produz efeitos a partir de 2026 (teste) e 2027 (pleno). Data informada: ' + e.data_fato_gerador + '.', 'LC 214/2025, arts. 343 a 348');
      if (ano > 2033) add('A02', 'medio', 'Fato gerador após o fim da transição',
        'A partir de 2033 vigora o regime pleno; confirmar se a alíquota informada é a definitiva.', 'ADCT, art. 125');
      if (ano === 2026 && (naoNeg(e.redutor_ajuste_saldo || 0) > 0))
        add('A03', 'alto', 'Redutor de ajuste informado em operação de 2026',
          'O redutor de ajuste só se constitui em 31/12/2026 e é utilizável a partir de 2027. Em 2026 vale apenas a regra do ano-teste.', 'RIBS/RCBS art. 375');
    }

    // 2. Duplicidade
    if (e.request_id && Array.isArray(ctx.request_ids_ja_usados) &&
        ctx.request_ids_ja_usados.indexOf(e.request_id) >= 0)
      add('A04', 'impeditivo', 'Operação duplicada',
        'Já existe cálculo finalizado com o mesmo request_id para esta empresa.', 'Seção 15 — idempotência');

    // 3. Documentos e CIB
    if (e.imovel) {
      if (!e.imovel.cib && !e.imovel.matricula)
        add('A05', 'medio', 'Imóvel sem CIB nem matrícula',
          'Sem identificador cartorário ou CIB, o controle do redutor por imóvel não é auditável.', 'RIBS/RCBS art. 366');
      if (!e.imovel.tipo)
        add('A06', 'alto', 'Destinação do imóvel não informada',
          'A destinação decide o redutor social e a alíquota aplicável.', 'RIBS/RCBS arts. 376 a 379');
    }

    // 4. Regime e alíquota
    if (ctx.aliquotas) {
      if (ctx.aliquotas.classificacao !== 'LEGAL')
        add('A07', 'medio', 'Alíquota não é legal',
          'Alíquota classificada como ' + ctx.aliquotas.classificacao + '. Enquanto a alíquota de referência não for fixada em norma, não cabe conclusão definitiva sobre carga tributária.', 'Seção 6 do prompt');
      if (ctx.aliquotas.vigencia_fim && ctx.aliquotas.vigencia_fim < (e.data_fato_gerador || hoje))
        add('A08', 'alto', 'Alíquota vencida para a data do fato gerador',
          'A alíquota informada tem vigência até ' + ctx.aliquotas.vigencia_fim + '.', null);
    }

    // 5. Redutor excessivo
    if (e.valor_operacao > 0) {
      var redTot = naoNeg(res.redutor_ajuste_usado || 0) + naoNeg(res.redutor_social_usado || 0);
      if (redTot > 0 && redTot >= e.valor_operacao)
        add('A09', 'alto', 'Redutores zeraram integralmente a base',
          'Os redutores absorveram 100% do valor da operação. Confirmar o saldo do redutor de ajuste e a documentação do art. 375 antes de emitir parecer.', 'RIBS/RCBS arts. 369 a 378');
      else if (redTot > e.valor_operacao * 0.8)
        add('A10', 'medio', 'Redutores acima de 80% da operação',
          'Proporção elevada de redutor — verificar a origem do saldo.', 'RIBS/RCBS art. 375');
    }

    // 6. Crédito sem evidência
    if (naoNeg(e.creditos || 0) > 0 && e.creditos_com_documento !== true)
      add('A11', 'alto', 'Crédito informado sem evidência documental',
        'Crédito de IBS/CBS lançado sem confirmação de documento fiscal idôneo vinculado.', 'LC 214/2025, arts. 47 a 56');

    // 7. RET sem requisito
    if (e.operacao === 'ret') {
      if (!e.ret || e.ret.patrimonio_afetacao !== true)
        add('A12', 'impeditivo', 'RET sem patrimônio de afetação', 'Requisito do caput do art. 461.', 'RIBS/RCBS art. 461');
      if (e.ret && e.ret.opcao_ate_2028 === false)
        add('A13', 'impeditivo', 'RET fora do prazo de opção',
          'A opção exige pedido efetivado antes de 1º/01/2029.', 'RIBS/RCBS art. 461, caput');
    }

    // 8. Contrato transitório
    if (e.operacao === 'locacao_transitoria' && e.contrato && e.contrato.finalidade === 'residencial' &&
        e.data_fato_gerador && e.data_fato_gerador > '2028-12-31')
      add('A14', 'impeditivo', 'Regime transitório residencial encerrado',
        'O art. 463, §1º, II limita o regime ao prazo original do contrato ou a 31/12/2028, o que ocorrer primeiro.', 'RIBS/RCBS art. 463');

    // 9. Simples vedado
    if (ctx.empresa && ctx.empresa.regime === 'simples')
      add('A15', 'alto', 'Empresa no Simples Nacional',
        'O regime específico de bens imóveis pressupõe apuração no regime regular. Confirmar o enquadramento antes de aplicar redutores e reduções.', 'RIBS/RCBS art. 359');

    // 10. Legislação desatualizada
    if (ctx.ruleset_coletado_em && ctx.ruleset_coletado_em < '2026-01-01')
      add('A16', 'medio', 'Base normativa possivelmente desatualizada',
        'A última coleta de fontes é anterior a 2026. Reconferir hashes antes de emitir parecer.', 'Seção 2.3 do prompt');

    // 11. Regras não homologadas
    var naoHom = (res.regras_aplicadas || []).filter(function (id) {
      return REGRAS[id] && REGRAS[id].status !== 'homologada' && REGRAS[id].status !== 'ativa'; });
    if (naoHom.length)
      add('A17', 'alto', 'Regra não homologada aplicada',
        'Regras em rascunho ou staging usadas neste cálculo: ' + naoHom.join(', ') + '.', 'Seção 3.2 do prompt');

    // 12. Bloqueios do próprio motor
    (res.bloqueios || []).forEach(function (b) {
      add('A18', 'impeditivo', 'Cálculo bloqueado pelo motor', b.msg, b.regra_id || null); });

    // ---- nível de confiança (quadro da Seção 16) ----
    var pior = A.reduce(function (m, x) { return Math.max(m, AUDIT_SEVERIDADE[x.severidade] || 0); }, 0);
    var nivel = pior >= 4 ? 'BAIXA' : (pior >= 3 ? 'BAIXA' : (pior >= 2 ? 'MEDIA' : 'ALTA'));
    var permite = nivel !== 'BAIXA';
    return { achados: A.sort(function (x, y) { return AUDIT_SEVERIDADE[y.severidade] - AUDIT_SEVERIDADE[x.severidade]; }),
             total: A.length,
             por_severidade: { impeditivo: A.filter(function (x) { return x.severidade === 'impeditivo'; }).length,
                               alto: A.filter(function (x) { return x.severidade === 'alto'; }).length,
                               medio: A.filter(function (x) { return x.severidade === 'medio'; }).length,
                               baixo: A.filter(function (x) { return x.severidade === 'baixo'; }).length },
             nivel_confianca: nivel,
             permite_conclusao_definitiva: permite,
             mensagem: permite
               ? (nivel === 'ALTA' ? 'Dados essenciais completos e regras homologadas.'
                                   : 'Há premissas ou estimativas controladas. Cabe conclusão indicativa, não definitiva.')
               : 'Confiança BAIXA: faltam dados relevantes ou há impedimento. O parecer NÃO pode apresentar conclusão definitiva sobre este cálculo.' };
  }

  /* =========================================================================
     4.11 MEMÓRIA NAVEGÁVEL (Seção 26)
     ========================================================================= */
  function porQueEsteValor(linha) {
    if (!linha) return null;
    var r = REGRAS[linha.regra_id] || {};
    return {
      valor: linha.valor,
      formula: linha.formula || '(sem fórmula: valor informado)',
      regra: { id: linha.regra_id, nome: r.nome || null, versao: linha.regra_versao, status: linha.regra_status },
      condicoes_satisfeitas: linha.entrada
        ? Object.keys(linha.entrada).map(function (k) {
            return { campo: k.replace(/_/g, ' '), valor: linha.entrada[k] }; })
        : [],
      fontes: linha.fundamentos || [],
      nivel_interpretacao: linha.nivel_interpretacao || null,
      trilha: ['Valor', 'Fórmula', 'Regra', 'Condições satisfeitas', 'Fontes', 'Versão']
    };
  }

  function porQueEstaRegra(regraId, e, ctx) {
    var r = REGRAS[regraId];
    if (!r) return null;
    var hier = { 'CF/EC': 1, 'LC': 2, 'lei': 3, 'decreto': 4, 'resolucao': 5, 'ato': 6 };
    var fontesOrdenadas = (r.fontes || []).slice().sort(function (a, b) {
      function peso(f) {
        if (/^LC |LC 214/.test(f)) return hier.LC;
        if (/^Lei /.test(f)) return hier.lei;
        if (/RCBS|Decreto/.test(f)) return hier.decreto;
        if (/RIBS|Resolu/.test(f)) return hier.resolucao;
        if (/IN RFB|SC COSIT|Súmula/.test(f)) return hier.ato;
        return 9;
      }
      return peso(a) - peso(b);
    });
    return {
      regra: { id: regraId, nome: r.nome, versao: r.versao, status: r.status, nivel: r.nivel },
      enquadramento: {
        operacao: (e && e.operacao) || null,
        tipo_imovel: (e && e.imovel && e.imovel.tipo) || null,
        finalidade: (e && e.locacao && e.locacao.finalidade) || null,
        data_fato_gerador: (e && e.data_fato_gerador) || null
      },
      precedencia_normativa: fontesOrdenadas,
      criterio_precedencia: 'CF/EC > Lei Complementar > lei ordinária > decreto (RCBS) > resolução (RIBS) > ato administrativo. ' +
        'No capítulo de bens imóveis, RIBS e RCBS foram confrontados dispositivo a dispositivo e não há divergência material — a precedência não precisou ser exercida.',
      classificacao_aliquota: (ctx && ctx.aliquotas && ctx.aliquotas.classificacao) || null
    };
  }

  /* =========================================================================
     4.12 SNAPSHOT E REPRODUTIBILIDADE (Seção 15)
     ========================================================================= */
  function canonico(o) {
    if (o === null || typeof o !== 'object') return JSON.stringify(o === undefined ? null : o);
    if (Array.isArray(o)) return '[' + o.map(canonico).join(',') + ']';
    return '{' + Object.keys(o).sort().map(function (k) {
      return JSON.stringify(k) + ':' + canonico(o[k]); }).join(',') + '}';
  }
  function hash128(str) {
    var out = '';
    for (var seed = 0; seed < 4; seed++) {
      var h = (0x811c9dc5 ^ (seed * 0x9e3779b9)) >>> 0;
      for (var i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
      }
      out += ('00000000' + h.toString(16)).slice(-8);
    }
    return out;
  }

  function montarSnapshot(e, res, ctx, meta) {
    meta = meta || {};
    if (!meta.request_id) {
      return { erro: 'request_id obrigatório: sem ele não há idempotência (Seção 15).' };
    }
    var aud = auditar(e, res, ctx);
    var corpo = {
      entrada: e,
      contexto: { aliquotas: ctx.aliquotas, parametros: ctx.parametros, indices: ctx.indices,
                  transicao: ctx.transicao || null },
      resultado: { status: res.status, base: res.base, ibs: res.ibs, cbs: res.cbs,
                   debito: res.debito, creditos: res.creditos, total: res.total,
                   parcelas: res.parcelas || null, linhas: res.linhas || [], notas: res.notas || [] },
      regras: (res.regras_aplicadas || []).map(function (id) {
        var r = REGRAS[id] || {};
        return { regra_id: id, versao: r.versao, status: r.status, fontes: r.fontes }; }),
      auditoria: { nivel_confianca: aud.nivel_confianca, achados: aud.achados,
                   permite_conclusao_definitiva: aud.permite_conclusao_definitiva },
      versoes: { motor: MOTOR_IMOB_VERSAO, contrato: CONTRATO_VERSAO, ruleset: RULESET_VERSAO,
                 lacre_imob: LACRE_IMOB_HASH, schema: meta.database_schema_version || 'imob-v3',
                 engine_build_id: meta.engine_build_id || null }
    };
    var can = canonico(corpo);
    return {
      request_id: meta.request_id,
      correlation_id: meta.correlation_id || null,
      empresa_id: meta.empresa_id || null,
      calculado_em: meta.calculado_em || null,
      calculado_por: meta.calculado_por || null,
      corpo: corpo,
      canonico_bytes: can.length,
      hash_snapshot: hash128(can),
      algoritmo_hash: 'FNV1a-128 (cliente). O SHA-256 autoritativo é calculado no banco ao gravar.',
      nota_reprodutibilidade: 'Para reprocessar este cálculo no futuro, use ruleset ' + RULESET_VERSAO +
        ' e motor ' + MOTOR_IMOB_VERSAO + '. Reprocessar com ruleset diferente produz outro hash — e isso é o esperado, não um erro.'
    };
  }

  function reprocessar(snapshot, ctxAtual) {
    if (!snapshot || !snapshot.corpo) return { erro: 'Snapshot inválido.' };
    var novo = calcular(snapshot.corpo.entrada, snapshot.corpo.contexto);
    var igual = r2(novo.total) === r2(snapshot.corpo.resultado.total);
    var mesmoRuleset = RULESET_VERSAO === snapshot.corpo.versoes.ruleset;
    return {
      reproduzido: igual,
      total_original: snapshot.corpo.resultado.total,
      total_reprocessado: novo.total,
      diferenca: r2(novo.total - snapshot.corpo.resultado.total),
      ruleset_original: snapshot.corpo.versoes.ruleset,
      ruleset_atual: RULESET_VERSAO,
      mesmo_ruleset: mesmoRuleset,
      diagnostico: igual
        ? 'Cálculo reproduzido de forma idêntica.'
        : (mesmoRuleset
            ? 'DIVERGÊNCIA COM O MESMO RULESET — isto indica defeito no motor e deve bloquear a publicação.'
            : 'Divergência esperada: o ruleset mudou de ' + snapshot.corpo.versoes.ruleset + ' para ' + RULESET_VERSAO +
              '. Para reprodutibilidade histórica, reprocesse com o motor da época.')
    };
  }


  /* =========================================================================
     4.13 PACOTE DO PARECER E PROMPT TRAVADO (Seção 17)
     -------------------------------------------------------------------------
     A IA recebe VALORES JÁ CALCULADOS e nunca instrução para calcular.
     Toda afirmação conclusiva carrega a origem:
       vigente | vigencia_futura | transicao | interpretacao_tecnica | premissa_simulacao
     ========================================================================= */
  var ORIGENS = ['vigente', 'vigencia_futura', 'transicao', 'interpretacao_tecnica', 'premissa_simulacao'];

  function origemDaRegra(id, e) {
    var r = REGRAS[id]; if (!r) return 'premissa_simulacao';
    var ano = e && e.data_fato_gerador ? parseInt(e.data_fato_gerador.slice(0, 4), 10) : 2027;
    if (r.nivel === 'premissa') return 'premissa_simulacao';
    if (r.nivel === 'administrativo' || r.nivel === 'tecnico') return 'interpretacao_tecnica';
    if (/RET|LOT|LOC-TR|2026/.test(id)) return 'transicao';
    if (ano >= 2027) return 'vigencia_futura';
    return 'vigente';
  }

  function pacoteParecer(e, res, ctx, extras) {
    extras = extras || {};
    var aud = auditar(e, res, ctx);
    var num = [];   // todo número que a IA está autorizada a citar
    function reg(v) {
      if (typeof v === 'number' && isFinite(v)) { num.push(r2(v)); if (r4(v) !== r2(v)) num.push(r4(v)); }
      return v;
    }

    var memoria = (res.linhas || []).map(function (l) {
      reg(l.valor);
      return { ordem: l.ordem, descricao: l.descricao, formula: l.formula, valor: r2(l.valor),
               regra_id: l.regra_id, versao: l.regra_versao, status: l.regra_status,
               fundamentos: l.fundamentos, origem: origemDaRegra(l.regra_id, e) };
    });
    [res.base, res.ibs, res.cbs, res.debito, res.creditos, res.total,
     res.aliquota_efetiva_sobre_operacao, e.valor_operacao].forEach(reg);
    if (ctx.aliquotas) { reg(ctx.aliquotas.ibs); reg(ctx.aliquotas.cbs); }
    (res.parcelas || []).forEach(function (p) {
      if (typeof p === 'number') reg(p); else { reg(p.pagamento); reg(p.base); reg(p.total); } });
    if (extras.comparativo && extras.comparativo.linhas)
      extras.comparativo.linhas.forEach(function (l) { reg(l.substituiveis); reg(l.permanentes); reg(l.total); });
    if (extras.projecao && extras.projecao.anos)
      extras.projecao.anos.forEach(function (a) { reg(a.base); reg(a.total); reg(a.ibs_aliquota); reg(a.cbs_aliquota); });

    var fontes = [];
    (res.regras_aplicadas || []).forEach(function (id) {
      ((REGRAS[id] || {}).fontes || []).forEach(function (f) { if (fontes.indexOf(f) < 0) fontes.push(f); }); });

    return {
      contrato_pacote: 'parecer-imob-1',
      bloco_01_objetivo: extras.objetivo ||
        'Demonstrar a tributação da operação com bem imóvel pelo regime específico do IBS e da CBS e compará-la com a tributação atual.',
      bloco_02_dados_analisados: {
        operacao: e.operacao, data_fato_gerador: e.data_fato_gerador,
        valor_operacao: r2(e.valor_operacao),
        imovel: e.imovel || null, locacao: e.locacao || null, contrato: e.contrato || null
      },
      bloco_03_regime_atual: extras.regime_atual || null,
      bloco_04_operacao: { tipo: e.operacao, enquadramento: extras.enquadramento || null },
      bloco_05_regras_legais: (res.regras_aplicadas || []).map(function (id) {
        var r = REGRAS[id] || {};
        return { regra_id: id, nome: r.nome, versao: r.versao, status: r.status,
                 origem: origemDaRegra(id, e), fontes: r.fontes }; }),
      bloco_06_memoria_de_calculo: memoria,
      bloco_07_situacao_atual_e_reforma: extras.comparativo || null,
      bloco_08_comparacoes: extras.projecao || null,
      bloco_09_riscos: aud.achados.map(function (a) {
        return { codigo: a.codigo, severidade: a.severidade, titulo: a.titulo, detalhe: a.detalhe, fonte: a.fonte }; }),
      bloco_10_recomendacoes: extras.recomendacoes || [],
      bloco_11_conclusao: {
        permitida: aud.permite_conclusao_definitiva,
        tipo: aud.permite_conclusao_definitiva
          ? (aud.nivel_confianca === 'ALTA' ? 'definitiva' : 'indicativa') : 'vedada',
        total_devido: r2(res.total),
        instrucao: aud.permite_conclusao_definitiva
          ? 'Conclusão permitida no nível ' + aud.nivel_confianca + '.'
          : 'PROIBIDO apresentar conclusão definitiva. Descrever o cálculo e listar o que impede a conclusão.'
      },
      bloco_12_fundamentacao: fontes,
      bloco_13_limitacoes_e_premissas: []
        .concat(res.notas || [])
        .concat(ctx.aliquotas && ctx.aliquotas.classificacao !== 'LEGAL'
          ? ['Alíquotas classificadas como ' + ctx.aliquotas.classificacao + ' — não vinculantes.'] : [])
        .concat(aud.nivel_confianca !== 'ALTA' ? [aud.mensagem] : []),
      auditoria: { nivel_confianca: aud.nivel_confianca, por_severidade: aud.por_severidade },
      numeros_autorizados: num.filter(function (v, i, a) { return a.indexOf(v) === i; }),
      versoes: { motor: MOTOR_IMOB_VERSAO, ruleset: RULESET_VERSAO, contrato: CONTRATO_VERSAO,
                 lacre_imob: LACRE_IMOB_HASH }
    };
  }

  function promptParecer(pacote) {
    return [
      'Você redige um parecer tributário a partir de um pacote de cálculo JÁ CALCULADO.',
      '',
      'REGRAS ABSOLUTAS:',
      '1. NÃO calcule nada. Não some, não multiplique, não converta, não arredonde, não projete.',
      '2. Use APENAS os números presentes em "numeros_autorizados". Citar qualquer outro número é erro grave.',
      '3. Cada frase conclusiva deve trazer a origem entre colchetes ANTES do ponto final, escolhida entre: ' + ORIGENS.join(' | ') + '. Exemplo: "... aplica-se a redução de 50% [vigencia_futura]."',
      '4. Se bloco_11_conclusao.permitida for false, é PROIBIDO afirmar qual regime é mais vantajoso ou apresentar conclusão definitiva. Descreva o cálculo e liste os impedimentos.',
      '5. Não invente dispositivo legal. Use somente o que está em bloco_05 e bloco_12.',
      '6. Não omita bloco_09 (riscos) nem bloco_13 (limitações e premissas).',
      '',
      'ESTRUTURA OBRIGATÓRIA, nesta ordem: objetivo e dados analisados; regime atual; operação; regras legais; memória de cálculo; situação atual e Reforma; comparações; riscos; recomendações; conclusão; fundamentação e legislação consultada; limitações e premissas.',
      '',
      'PACOTE:',
      JSON.stringify(pacote, null, 1)
    ].join('\n');
  }

  /* Guarda anti-alucinação: confere o texto devolvido pela IA contra o pacote. */
  function validarParecerIA(texto, pacote) {
    texto = String(texto || '');
    var permitidos = {}, i;
    for (i = 0; i < pacote.numeros_autorizados.length; i++) {
      permitidos[pacote.numeros_autorizados[i].toFixed(2)] = true;
      permitidos[pacote.numeros_autorizados[i].toFixed(4)] = true;
    }
    // números no formato brasileiro com 2 casas
    var achados = texto.match(/\d{1,3}(?:\.\d{3})*,\d{2,4}|\d+,\d{2,4}/g) || [];
    var naoAutorizados = [];
    achados.forEach(function (a) {
      var v = parseFloat(a.replace(/\./g, '').replace(',', '.'));
      if (!isFinite(v)) return;
      if (!permitidos[v.toFixed(2)] && !permitidos[v.toFixed(4)] && naoAutorizados.indexOf(a) < 0) naoAutorizados.push(a);
    });
    var frasesConclusivas = (texto.match(/[^.!?]*\b(portanto|conclui-se|conclus[ãa]o|recomenda-se|é mais vantajoso|resulta em)\b[^.!?]*[.!?]/gi) || []);
    var semOrigem = frasesConclusivas.filter(function (f) {
      var pos = texto.indexOf(f);
      var janela = f + texto.substr(pos + f.length, 30);   // aceita a marca logo após a pontuação
      return !ORIGENS.some(function (o) { return janela.indexOf('[' + o + ']') >= 0; }); });
    var conclusaoIndevida = !pacote.bloco_11_conclusao.permitida &&
      /mais vantajos|melhor regime|recomenda-se optar|deve optar/i.test(texto);
    var problemas = [];
    if (naoAutorizados.length) problemas.push({ tipo: 'numero_nao_autorizado', itens: naoAutorizados });
    if (semOrigem.length) problemas.push({ tipo: 'frase_conclusiva_sem_origem', itens: semOrigem.map(function (f) { return f.trim().slice(0, 120); }) });
    if (conclusaoIndevida) problemas.push({ tipo: 'conclusao_definitiva_vedada',
      itens: ['O nível de confiança é ' + pacote.auditoria.nivel_confianca + ' e o pacote proíbe conclusão definitiva.'] });
    return { aprovado: problemas.length === 0, problemas: problemas,
             numeros_conferidos: achados.length, frases_conclusivas: frasesConclusivas.length };
  }

  /* =========================================================================
     5. FUNÇÃO PÚBLICA
     ========================================================================= */
  function calcular(entrada, ctx) {
    var bloq = validar(entrada, ctx);
    var carimbo = { motor_versao: MOTOR_IMOB_VERSAO, contrato_versao: CONTRATO_VERSAO, ruleset_versao: RULESET_VERSAO };
    if (bloq.length) {
      return { status: 'BLOQUEADO', bloqueios: bloq, linhas: [], total: null,
               mensagem: 'Cálculo bloqueado por dado insuficiente ou inconsistente — nenhuma estimativa foi produzida.',
               carimbo: carimbo };
    }
    var res;
    if (entrada.operacao === 'venda') res = calcVenda(entrada, ctx);
    else if (entrada.operacao === 'locacao') res = calcLocacao(entrada, ctx);
    else if (entrada.operacao === 'permuta') res = calcPermuta(entrada, ctx);
    else if (entrada.operacao === 'loteamento') res = calc365(entrada, ctx, 'loteamento');
    else if (entrada.operacao === 'locacao_transitoria') res = calc365(entrada, ctx, 'locacao');
    else res = calcRET(entrada, ctx);

    if (res.bloqueio) {
      return { status: 'BLOQUEADO', bloqueios: [res.bloqueio], linhas: [], total: null,
               mensagem: res.bloqueio.msg, carimbo: carimbo };
    }
    res = ajuste2026(res, entrada, ctx);
    res.status = 'CALCULADO';
    res.bloqueios = [];
    res.confianca = nivelConfianca(entrada, ctx, res);
    res.carimbo = carimbo;
    return res;
  }

  /* =========================================================================
     6. SELO DE INTEGRIDADE PRÓPRIO (LACRE_IMOB) — Passo 2
     -------------------------------------------------------------------------
     Mesmo algoritmo FNV-1a do lacre do motor genérico, mas cadeia SEPARADA.
     Reassinar este selo nunca exige reconferir o selo 5a5562df do motor
     genérico — e vice-versa. O vetor abaixo é fixo e independente de PARAMS.
     ========================================================================= */
  var LACRE_IMOB_CTX = {
    aliquotas: { ibs: 18.70, cbs: 9.21, classificacao: 'ESTIMADA', fonte: 'Res. CGIBS 14/2026 (lacre)' },
    parametros: { redutor_social_residencial_novo: 100000, redutor_social_lote_residencial: 30000, redutor_social_locacao_mes: 600 },
    indices: { ipca_fator: 1, competencia: '2026-01' }
  };
  var LACRE_IMOB_CASOS = [
    { operacao: 'venda', data_fato_gerador: '2033-06-15', valor_operacao: 900000, imovel: { id: 'L1', tipo: 'residencial_novo' }, redutor_ajuste_saldo: 400000 },
    { operacao: 'venda', data_fato_gerador: '2033-06-15', valor_operacao: 150000, imovel: { id: 'L2', tipo: 'lote_residencial' }, redutor_ajuste_saldo: 0 },
    { operacao: 'venda', data_fato_gerador: '2033-06-15', valor_operacao: 500000, imovel: { id: 'L3', tipo: 'comercial' }, redutor_ajuste_saldo: 120000, creditos: 5000 },
    { operacao: 'locacao', data_fato_gerador: '2033-06-15', valor_operacao: 2000, locacao: { finalidade: 'residencial', meses: 1 } },
    { operacao: 'locacao', data_fato_gerador: '2033-06-15', valor_operacao: 10000, locacao: { finalidade: 'nao_residencial', meses: 1 } },
    { operacao: 'ret', data_fato_gerador: '2029-03-10', valor_operacao: 250000, ret: { modalidade: 'normal', patrimonio_afetacao: true } },
    { operacao: 'ret', data_fato_gerador: '2029-03-10', valor_operacao: 250000, ret: { modalidade: 'social', patrimonio_afetacao: true } },
    { operacao: 'locacao', data_fato_gerador: '2033-06-15', valor_operacao: 5000, locacao: { finalidade: 'residencial', meses: 1,
        encargos_locatario: { prova_pagamento: true, tributos_emolumentos: 180, condominio: 850, foro_taxa_ocupacao: 0 } } },
    { operacao: 'locacao', data_fato_gerador: '2033-06-15', valor_operacao: 3000, locacao: { finalidade: 'residencial', meses: 1, dias_no_mes: 18, fracao_area_residencial: 0.6 } },
    { operacao: 'venda', data_fato_gerador: '2033-06-15', valor_operacao: 800000, imovel: { id: 'L8', tipo: 'residencial_novo' },
      redutor_ajuste_saldo: 300000, pagamentos: [200000, 100000, 500000] },
    { operacao: 'permuta', data_fato_gerador: '2033-06-15', valor_operacao: 1000000,
      permuta: { contraparte: 'contribuinte', redutor_ajuste_dado: 400000 } },
    { operacao: 'permuta', data_fato_gerador: '2033-06-15', valor_operacao: 1000000,
      permuta: { contraparte: 'nao_contribuinte', torna: 200000, torna_paga_por: 'contribuinte', redutor_ajuste_dado: 400000 } },
    { operacao: 'loteamento', data_fato_gerador: '2030-05-01', valor_operacao: 500000, loteamento: { registro_ate_2028: true } },
    { operacao: 'locacao_transitoria', data_fato_gerador: '2027-03-01', valor_operacao: 20000,
      contrato: { finalidade: 'nao_residencial', firmado_ate_16_01_2025: true, prazo_determinado: true,
                  data_comprovada: true, registrado_ate_2025: true } }
  ];

  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  var LACRE_IMOB_F3 = {
    lp: { receita_venda: 1000000, receita_locacao: 240000, receita_servicos: 60000,
          atividade_imobiliaria_no_objeto: true, meses_periodo: 3 },
    gc: { valor_alienacao: 800000, custo_contabil: 500000, meses_periodo: 3 },
    lr: { receita_total: 1000000, custos_dedutiveis: 600000, despesas_dedutiveis: 150000,
          prejuizo_acumulado: 200000, meses_periodo: 3 },
    transicao: { 2026:{ibs:0.1,cbs:0.9}, 2027:{ibs:0.05,cbs:9.11}, 2028:{ibs:0.05,cbs:9.11},
                 2029:{ibs:1.87,cbs:9.21}, 2030:{ibs:3.74,cbs:9.21}, 2031:{ibs:5.61,cbs:9.21},
                 2032:{ibs:7.48,cbs:9.21}, 2033:{ibs:18.70,cbs:9.21} }
  };
  function lacreVetor() {
    var v = [];
    for (var i = 0; i < LACRE_IMOB_CASOS.length; i++) {
      var r = calcular(LACRE_IMOB_CASOS[i], LACRE_IMOB_CTX);
      v.push(r.base, r.ibs, r.cbs, r.debito, r.creditos, r.total);
      if (Array.isArray(r.parcelas)) {
        for (var q = 0; q < r.parcelas.length; q++) {
          var pq = r.parcelas[q];
          v.push(typeof pq === 'number' ? pq : pq.base, typeof pq === 'number' ? 0 : pq.total);
        }
      }
    }
    // Fase 3 — comparativos entram no mesmo selo
    var lp = calcLucroPresumido(LACRE_IMOB_F3.lp, LACRE_IMOB_CTX);
    v.push(lp.irpj, lp.adicional, lp.csll, lp.pis, lp.cofins, lp.tributos_substituidos, lp.tributos_permanentes, lp.total);
    var gc = calcGanhoCapital(LACRE_IMOB_F3.gc, LACRE_IMOB_CTX);
    v.push(gc.ganho, gc.total);
    var lr = calcLucroRealIndicativo(LACRE_IMOB_F3.lr, LACRE_IMOB_CTX);
    v.push(lr.lucro, lr.base, lr.irpj, lr.csll, lr.pis, lr.cofins, lr.total);
    var ctxT = JSON.parse(JSON.stringify(LACRE_IMOB_CTX)); ctxT.transicao = LACRE_IMOB_F3.transicao;
    var prj = projetarTransicao(LACRE_IMOB_CASOS[0], ctxT);
    for (var t = 0; t < prj.anos.length; t++) v.push(prj.anos[t].base, prj.anos[t].total);
    // Fase 4 — o veredito da auditoria também entra no selo, codificado em número
    var COD = { ALTA: 1, MEDIA: 2, BAIXA: 3 };
    for (var w = 0; w < LACRE_IMOB_CASOS.length; w++) {
      var rw = calcular(LACRE_IMOB_CASOS[w], LACRE_IMOB_CTX);
      var aw = auditar(LACRE_IMOB_CASOS[w], rw, LACRE_IMOB_CTX);
      v.push(COD[aw.nivel_confianca] || 0, aw.por_severidade.impeditivo, aw.por_severidade.alto, aw.por_severidade.medio);
    }
    return v;
  }
  function lacreCalcular() {
    return fnv1a(lacreVetor().map(function (n) { return n === null ? 'null' : r2(n).toFixed(2); }).join('|'));
  }
  // Selo homologado desta versão do motor. Alterar qualquer fórmula muda este
  // valor e OBRIGA re-selar + registrar no changelog (a suíte quebra antes).
  var LACRE_IMOB_HASH = 'c287341e';
  function lacreVerificar() {
    var atual = lacreCalcular();
    return { hash_atual: atual, hash_homologado: LACRE_IMOB_HASH,
             integro: atual === LACRE_IMOB_HASH,
             motor_versao: MOTOR_IMOB_VERSAO };
  }

  var API = {
    MOTOR_IMOB_VERSAO: MOTOR_IMOB_VERSAO, CONTRATO_VERSAO: CONTRATO_VERSAO, RULESET_VERSAO: RULESET_VERSAO,
    LACRE_IMOB_HASH: LACRE_IMOB_HASH,
    calcular: calcular, validar: validar, REGRAS: REGRAS, regra: regra,
    r2: r2, r4: r4, somaExib: somaExib, naoNeg: naoNeg, aplicarRedutor: aplicarRedutor,
    atualizarPorIndice: atualizarPorIndice, ratearParcelas: ratearParcelas,
    aliquotasReduzidas: aliquotasReduzidas, rajValorInicial: rajValorInicial, pfEnquadramento: pfEnquadramento,
    compararRegimes: compararRegimes, calcLucroPresumido: calcLucroPresumido,
    calcGanhoCapital: calcGanhoCapital, calcLucroRealIndicativo: calcLucroRealIndicativo,
    projetarTransicao: projetarTransicao, comparativoAtualXReforma: comparativoAtualXReforma,
    sensibilidade: sensibilidade, irpjCsll: irpjCsll,
    apurarCreditos: apurarCreditos, CRED_SEM_DIREITO: CRED_SEM_DIREITO,
    inventario2026: inventario2026, inventarioPorEmpresa: inventarioPorEmpresa,
    compararCriterioCarteira: compararCriterioCarteira, validarChaveNFe: validarChaveNFe,
    NFE_ABI_MODELO: NFE_ABI_MODELO, limiteDecadencia: limiteDecadencia, decadenciaCreditos: decadenciaCreditos,
    DATA_CORTE_INVENTARIO: DATA_CORTE_INVENTARIO, diasAte: diasAte,
    campo: campo, validarCampo: validarCampo, validarImportacao: validarImportacao,
    conferirProcedencia: conferirProcedencia, CAMPOS_ESSENCIAIS: CAMPOS_ESSENCIAIS,
    API_CONTRATOS: API_CONTRATOS, validarRequisicao: validarRequisicao, finalizarCalculo: finalizarCalculo,
    ESTEIRA: ESTEIRA, podePromover: podePromover, flagAtiva: flagAtiva, planoRollback: planoRollback,
    releaseNote: releaseNote, mascarar: mascarar, logSeguro: logSeguro,
    verificarIsolamento: verificarIsolamento, saudeDoModulo: saudeDoModulo, definitionOfDone: definitionOfDone,
    auditar: auditar, porQueEsteValor: porQueEsteValor, porQueEstaRegra: porQueEstaRegra,
    montarSnapshot: montarSnapshot, reprocessar: reprocessar, canonico: canonico, hash128: hash128,
    pacoteParecer: pacoteParecer, promptParecer: promptParecer, validarParecerIA: validarParecerIA,
    origemDaRegra: origemDaRegra, ORIGENS: ORIGENS,
    lacreCalcular: lacreCalcular, lacreVerificar: lacreVerificar, lacreVetor: lacreVetor
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  raiz.MotorImob = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
