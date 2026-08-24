/* ===========================================================================
   PARECER IMOBILIÁRIO COM IA — Análise Tributária Pro
   parecerImobIA.js · v1.0.0
   ---------------------------------------------------------------------------
   Usa a Edge Function PRÓPRIA do módulo (gerar-parecer-imobiliario), que tem
   renovação de token, repetição única em 401 e limite de 150 s.

   O que muda em relação ao parecer da Reforma: aqui a IA recebe um PACOTE com
   os valores JÁ CALCULADOS e a resposta passa OBRIGATORIAMENTE pela guarda
   anti-alucinação antes de chegar à tela. Texto reprovado NÃO é exibido — o
   módulo cai na memória determinística e diz por quê.

   Três camadas, de novo por testabilidade:
     montarPayloadIA   — puro: monta o corpo enviado à função
     interpretarResposta — puro: valida o que voltou, bloco a bloco
     gerarParecerImob  — executa, com uma segunda tentativa levando os
                         problemas encontrados como correção
   =========================================================================== */
(function (raiz) {
  'use strict';

  var PARECER_IA_VERSAO = '1.1.0';

  // A function do módulo, separada da do Análise Tributário Pro. Trocar aqui é
  // a ÚNICA razão pela qual eu havia proposto encostar na function do outro
  // aplicativo — o que contrariava a separação. Corrigido na 1.1.0.
  var FUNCTION_NOME = 'gerar-parecer-imobiliario';
  var M = raiz.MotorImob || (typeof require !== 'undefined' ? require('./motorImob.js') : null);

  /* Blocos de texto que a função deve devolver, na ordem do parecer. */
  var BLOCOS_TEXTO = ['objetivo', 'operacao', 'regrasAplicadas', 'memoriaComentada',
                      'situacaoAtualEReforma', 'comparacoes', 'riscos', 'recomendacoes',
                      'conclusao', 'limitacoes'];

  /* -------------------------------------------------------------------------
     1. Payload
     ------------------------------------------------------------------------- */
  function montarPayloadIA(pacote, empresa, opts) {
    opts = opts || {};
    if (!pacote || !pacote.contrato_pacote)
      return { erro: 'Pacote do parecer ausente ou fora do contrato.', codigo: 'SEM_PACOTE' };
    if (!Array.isArray(pacote.numeros_autorizados) || !pacote.numeros_autorizados.length)
      return { erro: 'Pacote sem números autorizados — a guarda anti-alucinação ficaria sem referência.', codigo: 'SEM_NUMEROS' };

    return {
      modo: 'imobiliario',                   // ramo novo da Edge Function
      contrato: pacote.contrato_pacote,
      empresa: {
        nome: (empresa && empresa.nome) || '',
        cnpj: (empresa && empresa.cnpj) || '',
        regime: (empresa && empresa.regime) || '',
        ano: (empresa && empresa.ano) || null
      },
      pacote: pacote,
      blocos_esperados: BLOCOS_TEXTO,
      restricoes: {
        proibido_calcular: true,
        numeros_autorizados: pacote.numeros_autorizados,
        marcas_de_origem: M ? M.ORIGENS : [],
        conclusao_permitida: pacote.bloco_11_conclusao.permitida,
        nivel_confianca: pacote.auditoria.nivel_confianca
      },
      correcao_anterior: opts.correcao || null,   // 2ª tentativa: o que reprovou
      versoes: pacote.versoes
    };
  }

  /* -------------------------------------------------------------------------
     2. Interpretação e guarda
     ------------------------------------------------------------------------- */
  function interpretarResposta(data, pacote) {
    if (!data || !data.textos)
      return { aprovado: false, motivo: 'resposta_sem_textos',
               mensagem: 'A função respondeu sem o campo "textos".', blocos: {}, problemas: [] };
    if (!M)
      return { aprovado: false, motivo: 'sem_motor',
               mensagem: 'motorImob indisponível para validar a resposta.', blocos: {}, problemas: [] };

    var t = data.textos, blocos = {}, faltando = [], porBloco = [];
    BLOCOS_TEXTO.forEach(function (b) {
      var txt = typeof t[b] === 'string' ? t[b].trim() : '';
      if (!txt) { faltando.push(b); return; }
      blocos[b] = txt;
      var v = M.validarParecerIA(txt, pacote);
      if (!v.aprovado) porBloco.push({ bloco: b, problemas: v.problemas });
    });

    // O texto inteiro também é conferido junto: número inventado pode nascer da
    // costura entre blocos, não de um bloco isolado.
    var inteiro = M.validarParecerIA(BLOCOS_TEXTO.map(function (b) { return blocos[b] || ''; }).join('\n'), pacote);

    var aprovado = porBloco.length === 0 && inteiro.aprovado && faltando.length === 0;
    return {
      aprovado: aprovado,
      motivo: aprovado ? null : (faltando.length ? 'blocos_faltando' : 'guarda_reprovou'),
      blocos: blocos,
      blocos_faltando: faltando,
      problemas: porBloco,
      problemas_no_conjunto: inteiro.aprovado ? [] : inteiro.problemas,
      numeros_conferidos: inteiro.numeros_conferidos,
      frases_conclusivas: inteiro.frases_conclusivas,
      mensagem: aprovado
        ? 'Texto conferido contra o pacote: todos os números batem e as frases conclusivas declaram a origem.'
        : (faltando.length
            ? 'A função não devolveu: ' + faltando.join(', ') + '.'
            : 'O texto gerado não passou na guarda anti-alucinação e NÃO foi exibido.')
    };
  }

  /* Texto de correção enviado na segunda tentativa. */
  function textoCorrecao(res) {
    var l = [];
    if (res.blocos_faltando && res.blocos_faltando.length)
      l.push('Blocos ausentes na resposta anterior: ' + res.blocos_faltando.join(', ') + '. Devolva todos.');
    (res.problemas || []).forEach(function (p) {
      p.problemas.forEach(function (x) {
        if (x.tipo === 'numero_nao_autorizado')
          l.push('No bloco "' + p.bloco + '" apareceram números que NÃO estão em numeros_autorizados: '
                 + x.itens.join(', ') + '. Reescreva usando apenas os valores do pacote.');
        if (x.tipo === 'frase_conclusiva_sem_origem')
          l.push('No bloco "' + p.bloco + '" há frase conclusiva sem a marca de origem entre colchetes: "'
                 + x.itens[0] + '".');
        if (x.tipo === 'conclusao_definitiva_vedada')
          l.push('O bloco "' + p.bloco + '" apresentou conclusão definitiva, que está VEDADA neste cálculo.');
      });
    });
    return l.join(' ');
  }

  /* -------------------------------------------------------------------------
     3. Execução
     ------------------------------------------------------------------------- */
  function gerarParecerImob(pacote, empresa, opts) {
    opts = opts || {};
    var chamar = opts.supaFn || raiz.supaFn;
    if (typeof chamar !== 'function')
      return Promise.reject({ erro: 'supaFn() do Análise Tributária Pro não encontrado — '
        + 'o parecer imobiliário usa a mesma Edge Function do app.', codigo: 'SEM_SUPAFN' });

    var tentativas = 0, maximo = opts.maximo || 2, historico = [];

    function rodada(correcao) {
      tentativas++;
      var payload = montarPayloadIA(pacote, empresa, { correcao: correcao });
      if (payload.erro) return Promise.reject(payload);

      return Promise.resolve(chamar(FUNCTION_NOME, payload)).then(function (r) {
        if (r && r.ok === false) {
          if (r.status === 404)
            throw { erro: 'Edge Function "' + FUNCTION_NOME + '" não encontrada. Publique-a no '
                        + 'Supabase: ela é do módulo imobiliário e não substitui a do Tributário.',
                    codigo: 'SEM_FUNCTION' };
          throw { erro: 'Falha na function (' + r.status + ').', codigo: 'HTTP' };
        }
        return (r && typeof r.json === 'function') ? r.json() : r;
      }).then(function (data) {
        var res = interpretarResposta(data, pacote);
        historico.push({ tentativa: tentativas, aprovado: res.aprovado, motivo: res.motivo });
        if (res.aprovado) return { ok: true, tentativas: tentativas, historico: historico, resultado: res };
        if (tentativas < maximo) return rodada(textoCorrecao(res));
        return { ok: false, tentativas: tentativas, historico: historico, resultado: res,
                 orientacao: 'O texto foi descartado. A memória de cálculo determinística continua '
                           + 'válida e é o que deve ser usado no parecer — ela não depende da IA.' };
      });
    }
    return rodada(null);
  }

  var API = { PARECER_IA_VERSAO: PARECER_IA_VERSAO, BLOCOS_TEXTO: BLOCOS_TEXTO,
              montarPayloadIA: montarPayloadIA, interpretarResposta: interpretarResposta,
              textoCorrecao: textoCorrecao, gerarParecerImob: gerarParecerImob };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  raiz.ParecerImobIA = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
