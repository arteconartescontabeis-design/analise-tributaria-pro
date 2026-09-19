/* ===========================================================================
   NÚCLEO DE RASTREABILIDADE — Análise Tributária Pro (motor genérico)
   nucleoRastreio.js · v1.0.0 · melhorias 3 e 4
   ---------------------------------------------------------------------------
   Leva ao motor GENÉRICO (Simples, Lucro Presumido, Lucro Real, Reforma) o que
   o módulo imobiliário ganhou: fonte legal com hash, snapshot forense,
   auditoria com nível de confiança, guarda anti-alucinação no parecer e
   reprodutibilidade histórica.

   REGRA DE OURO, de novo: este arquivo NÃO CALCULA NADA e não altera uma linha
   do motor genérico. Ele OBSERVA o resultado que o motor produziu. O lacre
   5a5562df continua sendo do motor, e nada aqui o toca.

   POR QUE ISSO IMPORTA: na v7.36.3 a IA usou 309.333,79 na narrativa porque o
   payload mandava o valor errado. Com a lista de números autorizados extraída
   do RESULTADO do motor — e não do payload —, aquele texto teria sido barrado
   antes de chegar ao cliente.
   =========================================================================== */
(function (raiz) {
  'use strict';

  var RASTREIO_VERSAO = '1.0.0';
  var RULESET_GENERICO = 'atp-2026.08.21';

  /* =========================================================================
     1. EXTRAÇÃO DOS NÚMEROS AUTORIZADOS A PARTIR DO RESULTADO DO MOTOR
     -------------------------------------------------------------------------
     Percorre a árvore do resultado e recolhe todo número. É deliberadamente
     abrangente: melhor autorizar um número a mais do que barrar um verdadeiro.
     O que a guarda impede é a IA inventar número que o motor nunca produziu.
     ========================================================================= */
  function r2(x) {
    if (typeof x !== 'number' || !isFinite(x)) return 0;
    var s = x < 0 ? -1 : 1;
    return s * Math.round(Math.abs(x) * 100 + 1e-9) / 100;
  }
  function r4(x) {
    if (typeof x !== 'number' || !isFinite(x)) return 0;
    var s = x < 0 ? -1 : 1;
    return s * Math.round(Math.abs(x) * 10000 + 1e-9) / 10000;
  }

  function numerosDoResultado(obj, limite) {
    limite = limite || 5000;
    var vistos = [], fila = [obj], n = 0;
    while (fila.length && n < limite) {
      var v = fila.shift(); n++;
      if (typeof v === 'number' && isFinite(v)) {
        vistos.push(r2(v));
        if (r4(v) !== r2(v)) vistos.push(r4(v));
      } else if (v && typeof v === 'object') {
        for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) fila.push(v[k]);
      }
    }
    // números triviais entram sempre: percentuais e contagens pequenas aparecem
    // no texto sem virem do cálculo (ex.: "as 5 faixas", "os 12 meses")
    [0, 1, 2, 3, 4, 5, 6, 10, 12, 100].forEach(function (x) { vistos.push(x); });
    return vistos.filter(function (x, i, a) { return a.indexOf(x) === i; });
  }

  /* =========================================================================
     2. GUARDA ANTI-ALUCINAÇÃO PARA O PARECER DA REFORMA
     ========================================================================= */
  var TOLERANCIA_CENTAVOS = 0.02;   // divergência de arredondamento aceitável

  function validarTextoParecer(texto, autorizados, opts) {
    opts = opts || {};
    texto = String(texto || '');
    var achados = texto.match(/\d{1,3}(?:\.\d{3})*,\d{2,4}|\d+,\d{2,4}/g) || [];
    var naoAutorizados = [], proximos = [];

    achados.forEach(function (a) {
      var v = parseFloat(a.replace(/\./g, '').replace(',', '.'));
      if (!isFinite(v)) return;
      var exato = autorizados.some(function (x) { return Math.abs(x - v) < 0.0001; });
      if (exato) return;
      var perto = autorizados.filter(function (x) { return Math.abs(x - v) <= TOLERANCIA_CENTAVOS; });
      if (perto.length) {
        if (!proximos.some(function (p) { return p.citado === a; }))
          proximos.push({ citado: a, esperado: perto[0], diferenca: r2(Math.abs(perto[0] - v)) });
        return;
      }
      if (naoAutorizados.indexOf(a) < 0) naoAutorizados.push(a);
    });

    var problemas = [];
    if (naoAutorizados.length)
      problemas.push({ tipo: 'numero_nao_autorizado', gravidade: 'alta', itens: naoAutorizados,
        explicacao: 'Valores citados que o motor não produziu neste cálculo.' });
    if (proximos.length && opts.exigir_centavo_exato)
      problemas.push({ tipo: 'divergencia_de_centavos', gravidade: 'baixa', itens: proximos,
        explicacao: 'Diferenças dentro de dois centavos — provável arredondamento na redação.' });

    if (opts.conclusao_vedada &&
        /mais vantajos|melhor regime|recomenda-se optar|deve optar|certamente|garantidamente/i.test(texto))
      problemas.push({ tipo: 'conclusao_vedada', gravidade: 'alta',
        itens: ['O nível de confiança não permite conclusão definitiva.'] });

    if (opts.exigir_ressalva_aliquota && !/estimad|n[ãa]o vinculante|refer[êe]ncia/i.test(texto))
      problemas.push({ tipo: 'sem_ressalva_de_aliquota', gravidade: 'media',
        itens: ['A alíquota usada não é legal e o texto não ressalva isso.'] });

    return { aprovado: problemas.filter(function (p) { return p.gravidade !== 'baixa'; }).length === 0,
             problemas: problemas, numeros_conferidos: achados.length,
             numeros_proximos: proximos };
  }

  /* =========================================================================
     3. AUDITORIA DO CÁLCULO GENÉRICO
     -------------------------------------------------------------------------
     Observa o resultado e o contexto e diz o quanto se pode concluir dali.
     Não corrige, não recalcula: aponta.
     ========================================================================= */
  function auditarAnalise(dados, ctx) {
    dados = dados || {}; ctx = ctx || {};
    var A = [];
    function add(cod, sev, titulo, detalhe, fonte) {
      A.push({ codigo: cod, severidade: sev, titulo: titulo, detalhe: detalhe, fonte: fonte || null });
    }

    if (ctx.aliquota_classificacao && ctx.aliquota_classificacao !== 'LEGAL')
      add('R01', 'medio', 'Alíquota de referência não é legal',
        'Classificada como ' + ctx.aliquota_classificacao + '. A Resolução CGIBS nº 14/2026 traz estimativa não vinculante.',
        'Res. CGIBS 14/2026');
    if (dados.creditos_por_proxy === true)
      add('R02', 'alto', 'Crédito de IBS/CBS estimado por proxy',
        'O crédito foi calculado por aproximação de compras, não pelas notas. O comparativo entre regimes fica sensível a esse número.', null);
    if (dados.despesas_ignoradas > 0)
      add('R03', 'alto', 'Despesas fora da base de crédito',
        r2(dados.despesas_ignoradas) + ' de despesas não entraram no crédito — o cenário fora do Simples fica superestimado.', null);
    if (dados.iss_configurado === 0 && dados.receita_servicos > 0)
      add('R04', 'alto', 'ISS em 0% com receita de serviços',
        'ISS parametrizado em zero havendo receita de serviço favorece artificialmente Presumido e Real na comparação.', 'LC 116/2003');
    if (dados.margem_sublimite_pct != null && dados.margem_sublimite_pct < 5)
      add('R05', 'alto', 'Margem estreita no limite ou sublimite',
        'A projeção fica a ' + r4(dados.margem_sublimite_pct) + '% do limite — o cenário "permanecer no Simples" é frágil.',
        'LC 123/2006, art. 3º');
    if (dados.mes_ultrapassagem)
      add('R06', 'alto', 'Mês de ultrapassagem do sublimite projetado',
        'Em ' + dados.mes_ultrapassagem + ' a receita se parte entre a parcela dentro do sublimite e a excedente — regra ainda não modelada.',
        'Res. CGSN 140/2018');
    if (dados.lucro_real_simulado === true)
      add('R07', 'medio', 'Lucro Real por simulação indicativa',
        'O cenário de Lucro Real é indicativo e não substitui apuração completa.', null);
    if (dados.dados_atipicos && dados.dados_atipicos.length)
      add('R08', 'medio', 'Dados atípicos no período',
        dados.dados_atipicos.join('; '), null);
    if (dados.periodo_incompleto === true)
      add('R09', 'medio', 'Período incompleto',
        'A análise cobre parte do ano. Totais e projeções refletem o realizado, não valores anuais.', null);
    if (dados.fontes_sem_hash > 0)
      add('R10', 'medio', 'Regras sem fonte hasheada',
        dados.fontes_sem_hash + ' regra(s) aplicada(s) sem fonte legal com hash e URL oficial.', null);

    var peso = { impeditivo: 4, alto: 3, medio: 2, baixo: 1 };
    var pior = A.reduce(function (m, x) { return Math.max(m, peso[x.severidade] || 0); }, 0);
    var nivel = pior >= 3 ? 'BAIXA' : (pior >= 2 ? 'MEDIA' : 'ALTA');
    return {
      achados: A.sort(function (a, b) { return peso[b.severidade] - peso[a.severidade]; }),
      total: A.length, nivel_confianca: nivel,
      permite_conclusao_definitiva: nivel !== 'BAIXA',
      mensagem: nivel === 'ALTA' ? 'Dados completos e alíquotas legais.'
        : nivel === 'MEDIA' ? 'Há premissas declaradas. Cabe conclusão indicativa.'
        : 'Confiança BAIXA: o parecer não deve afirmar qual regime é mais vantajoso.'
    };
  }

  /* =========================================================================
     4. SNAPSHOT E REPRODUTIBILIDADE HISTÓRICA (melhoria 4)
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

  function snapshotAnalise(entrada, resultado, ctx, meta) {
    meta = meta || {};
    if (!meta.request_id) return { erro: 'request_id obrigatório.', codigo: 'SEM_REQUEST_ID' };
    var aud = auditarAnalise(meta.sinais || {}, ctx || {});
    var corpo = {
      entrada: entrada, resultado: resultado,
      contexto: { aliquotas: (ctx && ctx.aliquotas) || null,
                  aliquota_classificacao: (ctx && ctx.aliquota_classificacao) || null,
                  parametros: (ctx && ctx.parametros) || null },
      auditoria: { nivel_confianca: aud.nivel_confianca, achados: aud.achados },
      versoes: { app: meta.app_versao || null, lacre_motor: meta.lacre_motor || null,
                 ruleset: meta.ruleset || RULESET_GENERICO, rastreio: RASTREIO_VERSAO,
                 engine_build_id: meta.engine_build_id || null }
    };
    var can = canonico(corpo);
    return { request_id: meta.request_id, empresa_cnpj: meta.cnpj || null, ano: meta.ano || null,
             corpo: corpo, hash_snapshot: hash128(can), canonico_bytes: can.length,
             numeros_autorizados: numerosDoResultado(resultado),
             auditoria: aud,
             algoritmo_hash: 'FNV1a-128 (cliente); o SHA-256 autoritativo é o do banco' };
  }

  /* Distingue os três casos que importam numa refação de parecer. */
  function reprocessarAnalise(snapshot, resultadoAtual, meta) {
    meta = meta || {};
    if (!snapshot || !snapshot.corpo) return { erro: 'Snapshot inválido.' };
    var antes = snapshot.corpo.resultado, agora = resultadoAtual;
    var mesmoLacre = (meta.lacre_motor || null) === (snapshot.corpo.versoes.lacre_motor || null);
    var mesmoRuleset = (meta.ruleset || RULESET_GENERICO) === snapshot.corpo.versoes.ruleset;

    var difs = [];
    function comparar(a, b, caminho) {
      if (typeof a === 'number' && typeof b === 'number') {
        if (r2(a) !== r2(b)) difs.push({ campo: caminho, antes: r2(a), agora: r2(b), delta: r2(b - a) });
        return;
      }
      if (a && b && typeof a === 'object' && typeof b === 'object') {
        Object.keys(a).forEach(function (k) { if (k in b) comparar(a[k], b[k], caminho ? caminho + '.' + k : k); });
      }
    }
    comparar(antes, agora, '');

    var igual = difs.length === 0;
    var diagnostico, gravidade;
    if (igual) { diagnostico = 'Cálculo reproduzido de forma idêntica.'; gravidade = 'ok'; }
    else if (mesmoLacre && mesmoRuleset) {
      diagnostico = 'DIVERGÊNCIA COM O MESMO MOTOR E O MESMO RULESET. Isto indica defeito — '
                  + 'não publique nem reemita parecer até investigar.'; gravidade = 'critico';
    } else if (!mesmoLacre) {
      diagnostico = 'O motor mudou (lacre ' + snapshot.corpo.versoes.lacre_motor + ' → ' + meta.lacre_motor
                  + '). A diferença é esperada. Para reproduzir o parecer da época, use o motor da época; '
                  + 'para reemitir com a regra atual, informe o cliente do que mudou.'; gravidade = 'atencao';
    } else {
      diagnostico = 'O ruleset mudou (' + snapshot.corpo.versoes.ruleset + ' → ' + (meta.ruleset || RULESET_GENERICO)
                  + '). Diferença esperada.'; gravidade = 'atencao';
    }

    return { reproduzido: igual, gravidade: gravidade, diagnostico: diagnostico,
             mesmo_lacre: mesmoLacre, mesmo_ruleset: mesmoRuleset,
             divergencias: difs.sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); }).slice(0, 30),
             total_divergencias: difs.length,
             lacre_original: snapshot.corpo.versoes.lacre_motor,
             lacre_atual: meta.lacre_motor || null,
             ruleset_original: snapshot.corpo.versoes.ruleset,
             ruleset_atual: meta.ruleset || RULESET_GENERICO,
             alerta_parecer_emitido: !igual && meta.parecer_emitido === true
               ? 'ATENÇÃO: já houve parecer emitido com o resultado anterior. Qualquer reemissão precisa '
               + 'declarar a alteração e a norma que a motivou.' : null };
  }

  var API = { RASTREIO_VERSAO: RASTREIO_VERSAO, RULESET_GENERICO: RULESET_GENERICO,
              numerosDoResultado: numerosDoResultado, validarTextoParecer: validarTextoParecer,
              auditarAnalise: auditarAnalise, snapshotAnalise: snapshotAnalise,
              reprocessarAnalise: reprocessarAnalise, canonico: canonico, hash128: hash128 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  raiz.NucleoRastreio = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
