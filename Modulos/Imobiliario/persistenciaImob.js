/* ===========================================================================
   PERSISTÊNCIA DO MÓDULO IMOBILIÁRIO — Análise Tributária Pro
   persistenciaImob.js  ·  v1.0.0
   ---------------------------------------------------------------------------
   Duas camadas, de propósito:

   imobRepo  — funções PURAS que só MONTAM a requisição (método, caminho, corpo,
               cabeçalhos) e recusam operação inválida. Não fazem rede, então
               são testáveis fora do navegador, na mesma suíte do motor.

   imobDB    — executa o que o imobRepo montou, usando o supa() do próprio app.
               Se o supa() não existir, falha com mensagem clara em vez de
               inventar credencial ou endpoint.

   REGRAS QUE A CAMADA IMPÕE, e não só documenta:
     · escritorio_id obrigatório em toda gravação (a RLS exige e a falta dele
       viraria erro 42501 opaco no meio da tela);
     · atp_imob_calculos é APENAS INSERT — qualquer tentativa de PATCH ou DELETE
       é recusada aqui, antes de bater na trigger de imutabilidade;
     · exercer a opção do art. 375 exige justificativa não vazia;
     · finalizar cálculo exige request_id — sem ele não há idempotência;
     · nenhum campo pessoal vai para log.
   =========================================================================== */
(function (raiz) {
  'use strict';

  var PERSIST_VERSAO = '1.0.1';
  var M = raiz.MotorImob || (typeof require !== 'undefined' ? require('./motorImob.js') : null);

  var TABELAS = {
    imoveis:  'atp_imob_imoveis',
    redutor:  'atp_imob_redutor_mov',
    calculos: 'atp_imob_calculos',
    regras:   'atp_imob_regras',
    fontes:   'atp_imob_fontes_legais',
    indices:  'atp_imob_indices',
    perfis:   'atp_imob_perfis',
    aprov:    'atp_imob_aprovacoes'
  };
  var SO_INSERT = [TABELAS.calculos];

  function erro(msg, codigo) { return { erro: msg, codigo: codigo || 'REPO' }; }
  function precisaEscritorio(ctx) {
    return !ctx || !(ctx.escritorio_id > 0)
      ? erro('escritorio_id ausente: a RLS do módulo isola por escritório e a gravação seria recusada.', 'SEM_TENANT')
      : null;
  }

  /* =========================================================================
     imobRepo — montagem pura
     ========================================================================= */
  var imobRepo = {

    /* ---- imóvel ---- */
    salvarImovel: function (imovel, ctx) {
      var e = precisaEscritorio(ctx); if (e) return e;
      if (!imovel || !imovel.codigo_interno) return erro('Imóvel sem código interno.', 'SEM_CODIGO');
      if (!imovel.tipo) return erro('Imóvel sem destinação — ela decide redutor social e alíquota.', 'SEM_TIPO');
      var corpo = {
        escritorio_id: ctx.escritorio_id,
        empresa_id: ctx.empresa_id || null,
        codigo_interno: imovel.codigo_interno,
        cib: imovel.cib || null,
        matricula: imovel.matricula || null,
        cartorio: imovel.cartorio || null,
        endereco: imovel.endereco || null,
        municipio: imovel.municipio || null,
        uf: imovel.uf || null,
        tipo: imovel.tipo,
        destinacao: imovel.destinacao || null,
        em_construcao_2026: imovel.em_construcao_2026 === true,
        data_aquisicao: imovel.data_aquisicao || null,
        valor_aquisicao: imovel.valor_aquisicao != null ? imovel.valor_aquisicao : null,
        valor_referencia: imovel.valor_referencia != null ? imovel.valor_referencia : null,
        raj_opcao_aquisicao: imovel.raj_opcao_aquisicao != null ? imovel.raj_opcao_aquisicao : null,
        raj_opcao_referencia: imovel.raj_opcao_referencia != null ? imovel.raj_opcao_referencia : null,
        criado_por: ctx.usuario_uuid || null
      };
      if (imovel.id) corpo.id = imovel.id;
      return { metodo: 'POST', tabela: TABELAS.imoveis,
               caminho: TABELAS.imoveis + '?on_conflict=id',
               corpo: [corpo], upsert: !!imovel.id, retorna: 'representation' };
    },

    /* ---- opção do art. 375: definitiva e justificada ---- */
    exercerOpcao258: function (imovelId, escolha, justificativa, ctx) {
      var e = precisaEscritorio(ctx); if (e) return e;
      if (!imovelId) return erro('Imóvel não identificado.', 'SEM_IMOVEL');
      if (['aquisicao', 'referencia', 'construcao'].indexOf(escolha) < 0)
        return erro('Opção inválida: use aquisicao, referencia ou construcao.', 'OPCAO_INVALIDA');
      if (!justificativa || !String(justificativa).trim())
        return erro('A escolha do art. 375 é definitiva e exige justificativa gravada.', 'SEM_JUSTIFICATIVA');
      if (!(ctx.saldo_inicial >= 0))
        return erro('Saldo inicial do redutor não informado.', 'SEM_SALDO');
      return { metodo: 'PATCH', tabela: TABELAS.imoveis,
               caminho: TABELAS.imoveis + '?id=eq.' + imovelId,
               corpo: {
                 raj_opcao_escolhida: escolha,
                 raj_justificativa: String(justificativa).trim(),
                 raj_escolhido_por: ctx.usuario_id || null,
                 raj_escolhido_em: ctx.quando || null,
                 raj_saldo: ctx.saldo_inicial,
                 atualizado_por: ctx.usuario_id != null ? String(ctx.usuario_id) : null
               },
               aviso: 'A trigger atp_imob_trava_opcao_raj recusa a troca depois de exercida.' };
    },

    /* ---- movimentação do saldo do redutor ---- */
    movimentarRedutor: function (mov, ctx) {
      var e = precisaEscritorio(ctx); if (e) return e;
      var tipos = ['constituicao', 'atualizacao', 'utilizacao', 'transferencia', 'rateio', 'estorno'];
      if (tipos.indexOf(mov && mov.tipo) < 0)
        return erro('Tipo de movimentação inválido: ' + (mov && mov.tipo) + '.', 'TIPO_INVALIDO');
      if (!mov.imovel_id) return erro('Movimentação sem imóvel vinculado.', 'SEM_IMOVEL');
      if (typeof mov.valor !== 'number' || !isFinite(mov.valor))
        return erro('Valor da movimentação não numérico.', 'VALOR_INVALIDO');
      if (typeof mov.saldo_apos !== 'number' || mov.saldo_apos < 0)
        return erro('Saldo posterior ausente ou negativo — o redutor nunca fica negativo.', 'SALDO_INVALIDO');
      if (!mov.fundamento) return erro('Movimentação sem fundamento legal.', 'SEM_FUNDAMENTO');
      return { metodo: 'POST', tabela: TABELAS.redutor, caminho: TABELAS.redutor,
               corpo: [{
                 escritorio_id: ctx.escritorio_id, imovel_id: mov.imovel_id,
                 calculo_id: mov.calculo_id || null, tipo: mov.tipo,
                 competencia: mov.competencia || null, valor: mov.valor,
                 saldo_apos: mov.saldo_apos, fundamento: mov.fundamento,
                 regra_id: mov.regra_id || null, criado_por: ctx.usuario_uuid || null
               }] };
    },

    /* ---- finalizar cálculo: snapshot imutável e idempotente ---- */
    finalizarCalculo: function (entrada, resultado, ctxCalc, meta) {
      var e = precisaEscritorio(meta); if (e) return e;
      if (!meta || !meta.request_id)
        return erro('request_id ausente: sem ele o reenvio criaria um segundo snapshot.', 'SEM_REQUEST_ID');
      if (!M) return erro('motorImob não disponível para montar o snapshot.', 'SEM_MOTOR');
      if (resultado && resultado.status === 'BLOQUEADO')
        return erro('Cálculo bloqueado não é finalizado — corrija os impedimentos antes.', 'BLOQUEADO');
      var snap = M.montarSnapshot(entrada, resultado, ctxCalc, {
        request_id: meta.request_id, correlation_id: meta.correlation_id || null,
        empresa_id: meta.empresa_id || null, engine_build_id: meta.engine_build_id || null,
        calculado_por: meta.usuario_id || null,
        database_schema_version: meta.schema || 'imob-v3'
      });
      if (snap.erro) return erro(snap.erro, 'SNAPSHOT');
      var aud = M.auditar(entrada, resultado, ctxCalc);
      return { metodo: 'POST', tabela: TABELAS.calculos,
               caminho: TABELAS.calculos + '?on_conflict=escritorio_id,empresa_id,request_id',
               idempotente: true,
               corpo: [{
                 escritorio_id: meta.escritorio_id, empresa_id: meta.empresa_id || null,
                 imovel_id: meta.imovel_id || null, cnpj: meta.cnpj || null,
                 request_id: meta.request_id, correlation_id: meta.correlation_id || null,
                 calculado_por: meta.usuario_id || null,
                 entrada: entrada, resultado: snap.corpo.resultado,
                 motor_versao: M.MOTOR_IMOB_VERSAO, engine_build_id: meta.engine_build_id || null,
                 database_schema_version: meta.schema || 'imob-v3',
                 calculation_contract_version: M.CONTRATO_VERSAO,
                 ruleset_versao: M.RULESET_VERSAO,
                 regras_aplicadas: resultado.regras_aplicadas || [],
                 aliquotas: ctxCalc.aliquotas, nivel_confianca: aud.nivel_confianca,
                 lacre_imob: M.LACRE_IMOB_HASH, hash_snapshot: snap.hash_snapshot
               }],
               snapshot: snap, auditoria: aud,
               nota_conflito: 'Reenvio com a mesma chave não duplica: o on_conflict devolve a linha já gravada.' };
    },

    /* ---- índice de atualização ---- */
    salvarIndice: function (ix, ctx) {
      var e = precisaEscritorio(ctx); if (e) return e;
      if (!ix || !/^\d{4}-\d{2}$/.test(ix.competencia || ''))
        return erro('Competência do índice fora do formato AAAA-MM.', 'COMPETENCIA');
      if (!(ix.fator_desde_publicacao > 0))
        return erro('Fator de atualização ausente ou não positivo.', 'FATOR');
      return { metodo: 'POST', tabela: TABELAS.indices,
               caminho: TABELAS.indices + '?on_conflict=indice,competencia',
               corpo: [{ indice: ix.indice || 'IPCA', competencia: ix.competencia,
                         variacao_mes: ix.variacao_mes != null ? ix.variacao_mes : null,
                         numero_indice: ix.numero_indice != null ? ix.numero_indice : null,
                         fator_desde_publicacao: ix.fator_desde_publicacao,
                         fonte: ix.fonte || 'IBGE/SIDRA', criado_por: ctx.usuario_uuid || null }] };
    },

    /* ---- leituras ---- */
    listarImoveis: function (ctx) {
      var e = precisaEscritorio(ctx); if (e) return e;
      var q = TABELAS.imoveis + '?select=*&excluido_em=is.null&order=codigo_interno';
      if (ctx.empresa_id) q += '&empresa_id=eq.' + ctx.empresa_id;
      return { metodo: 'GET', tabela: TABELAS.imoveis, caminho: q };
    },
    listarCalculos: function (ctx) {
      var e = precisaEscritorio(ctx); if (e) return e;
      var q = TABELAS.calculos + '?select=id,calculado_em,request_id,nivel_confianca,hash_snapshot,'
            + 'motor_versao,ruleset_versao,resultado&order=calculado_em.desc&limit=' + (ctx.limite || 50);
      if (ctx.empresa_id) q += '&empresa_id=eq.' + ctx.empresa_id;
      return { metodo: 'GET', tabela: TABELAS.calculos, caminho: q };
    },
    movimentacoesDoImovel: function (imovelId) {
      if (!imovelId) return erro('Imóvel não identificado.', 'SEM_IMOVEL');
      return { metodo: 'GET', tabela: TABELAS.redutor,
               caminho: TABELAS.redutor + '?select=*&imovel_id=eq.' + imovelId + '&order=criado_em' };
    },
    fontesDaRegra: function (regraId) {
      if (!regraId) return erro('Regra não identificada.', 'SEM_REGRA');
      return { metodo: 'GET', tabela: TABELAS.fontes,
               caminho: TABELAS.fontes + '?select=tipo_norma,numero,artigo,fonte_oficial,hash_fonte,'
                      + 'status_fonte,coletado_em&regra_uuid=not.is.null&order=hierarquia_normativa' };
    },

    /* ---- guarda contra escrita indevida ---- */
    verificarOperacao: function (req) {
      if (!req || req.erro) return req || erro('Requisição vazia.');
      if (SO_INSERT.indexOf(req.tabela) >= 0 && req.metodo !== 'POST' && req.metodo !== 'GET')
        return erro('A tabela ' + req.tabela + ' é imutável: só INSERT e leitura. '
                  + 'Gere um novo cálculo em vez de alterar o snapshot.', 'IMUTAVEL');
      return req;
    }
  };

  /* =========================================================================
     imobDB — execução sobre o supa() do app
     ========================================================================= */
  function executar(req) {
    var r = imobRepo.verificarOperacao(req);
    if (r.erro) return Promise.reject(r);
    if (typeof raiz.supa !== 'function')
      return Promise.reject(erro('supa() do Análise Tributária Pro não encontrado — '
        + 'a persistência do módulo usa a mesma camada do resto do app.', 'SEM_SUPA'));
    // CORREÇÃO 1.0.1 — o contrato real do app é supa(METODO, tabela, opts), e
    // esta camada chamava supa(caminho, {method}). Medido: o app recebia a
    // query string inteira no lugar do método e a requisição morria antes de
    // sair. NENHUMA gravação do módulo funcionava. Defeito de contrato meu:
    // escrevi a camada sem o index à mão para conferir.
    // O `caminho` já traz a query, e o supa() do app o concatena na URL.
    var opts = {};
    if (r.corpo !== undefined) opts.body = r.corpo;
    if (r.retorna) opts.returning = true;          // o app usa `returning`, não `retorna`
    return Promise.resolve(raiz.supa(r.metodo, r.caminho, opts));
  }

  var imobDB = {
    VERSAO: PERSIST_VERSAO, TABELAS: TABELAS,
    salvarImovel: function (im, ctx) { return executar(imobRepo.salvarImovel(im, ctx)); },
    exercerOpcao258: function (id, esc, just, ctx) { return executar(imobRepo.exercerOpcao258(id, esc, just, ctx)); },
    movimentarRedutor: function (mov, ctx) { return executar(imobRepo.movimentarRedutor(mov, ctx)); },
    salvarIndice: function (ix, ctx) { return executar(imobRepo.salvarIndice(ix, ctx)); },
    listarImoveis: function (ctx) { return executar(imobRepo.listarImoveis(ctx)); },
    listarCalculos: function (ctx) { return executar(imobRepo.listarCalculos(ctx)); },
    movimentacoesDoImovel: function (id) { return executar(imobRepo.movimentacoesDoImovel(id)); },
    finalizarCalculo: function (e, res, ctxCalc, meta) {
      var req = imobRepo.finalizarCalculo(e, res, ctxCalc, meta);
      if (req.erro) return Promise.reject(req);
      return executar(req).then(function (dados) {
        return { gravado: true, hash_snapshot: req.snapshot.hash_snapshot,
                 nivel_confianca: req.auditoria.nivel_confianca, retorno: dados };
      });
    }
  };

  var API = { PERSIST_VERSAO: PERSIST_VERSAO, imobRepo: imobRepo, imobDB: imobDB, TABELAS: TABELAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  raiz.imobRepo = imobRepo; raiz.imobDB = imobDB;
})(typeof globalThis !== 'undefined' ? globalThis : this);
