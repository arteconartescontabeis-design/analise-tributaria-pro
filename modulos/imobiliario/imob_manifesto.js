/* ============================================================================
 * imob_manifesto.js — identidade do MÓDULO Análise Imobiliária
 * Primeiro arquivo do módulo a carregar. Declara versão, motor e changelog
 * PRÓPRIOS — separados do núcleo, que tem os seus.
 * ==========================================================================*/
(function (raiz) {
  'use strict';
  raiz.ModulosInfo = raiz.ModulosInfo || {};
  raiz.ModulosInfo.imobiliario = {
    chave: 'imobiliario',
    rotulo: 'An\u00e1lise Imobili\u00e1ria Pro',
    versao: '1.3.0',
    data: '14/09/2026',
    cadastro_ampliado_no_banco: false,   // true só depois de rodar sql/setup_imob_v130.sql
    aba: 'page-imobiliaria',
    motor: { nome: 'motorImob', versao: '1.2.0', contrato: 'calc-imob-1',
             ruleset: 'imob-2026.08.21', lacre: 'c287341e', regras: 29, homologadas: 28 },
    base_legal: { dispositivos: 97, fontes: ['Decreto 12.955/2026', 'Resolu\u00e7\u00e3o CGIBS 6/2026',
                                             'LC 214/2025 at\u00e9 a LC 227/2026'] },
    estado: 'piloto controlado',
    ressalva: 'Al\u00edquota de refer\u00eancia \u00e9 estimativa n\u00e3o vinculante da Resolu\u00e7\u00e3o CGIBS 14/2026.',
    changelog: [
      { versao: '1.3.0', data: '14/09/2026', texto:
        'Prompt Mestre de melhorias (18 itens): invent\u00e1rio 2026 com data-base informada, data atual autom\u00e1tica e prazo '
        + 'recalculado todo dia; mem\u00f3ria de c\u00e1lculo mostra as al\u00edquotas (padr\u00e3o, redu\u00e7\u00e3o e finais) em vez de R$ 0,00; '
        + 'resultado da aliena\u00e7\u00e3o em 12 etapas com f\u00f3rmula; grau de certeza e premissas no topo do resultado; '
        + 'edi\u00e7\u00e3o controlada de premissas com justificativa (original \u00d7 editado na mem\u00f3ria e nos relat\u00f3rios); '
        + 'cadastro do im\u00f3vel ampliado com campos obrigat\u00f3rios/opcionais/condicionais; valida\u00e7\u00f5es antes de calcular; '
        + 'loca\u00e7\u00e3o e permuta completas; guia comparativo dos regimes opcionais; comparativo lado a lado com proje\u00e7\u00f5es '
        + 'mensal, anual e 2026-2033 e gr\u00e1fico; pessoa f\u00edsica com crit\u00e9rios e pend\u00eancias; relat\u00f3rios executivo, '
        + 't\u00e9cnico e mem\u00f3ria; hist\u00f3rico com filtros, compara\u00e7\u00e3o de vers\u00f5es, duplicar e exportar; regras por assunto '
        + 'com vig\u00eancia e impacto; 25 testes de aceite em tests/run_imob_ui.js. Motor intocado (lacre c287341e).' },
      { versao: '1.2.1', data: '25/08/2026', texto:
        'A trava da op\u00e7\u00e3o do art. 375 passa a congelar tamb\u00e9m QUEM escolheu e QUANDO — '
        + 'antes ela guardava apenas QUAL op\u00e7\u00e3o, e regravar a mesma escolha reescrevia autoria e '
        + 'data em sil\u00eancio; \u00e9 a data que prova a tempestividade do prazo de 31/12/2026. '
        + 'A grava\u00e7\u00e3o do im\u00f3vel deixou de usar upsert por id (evita o 42501 em im\u00f3vel exclu\u00eddo) '
        + 'e o exerc\u00edcio da op\u00e7\u00e3o passou a viajar com a condi\u00e7\u00e3o no pr\u00f3prio caminho. '
        + 'Requer setup_v7460.sql.' },
      { versao: '1.2.0', data: '21/08/2026', texto:
        'Comparador de crit\u00e9rio na carteira, NF-e modelo 77 com valida\u00e7\u00e3o de chave, ' +
        'decad\u00eancia do cr\u00e9dito pelo art. 54 e o n\u00facleo de rastreabilidade. 394 verifica\u00e7\u00f5es.' },
      { versao: '1.1.0', data: '20/08/2026', texto:
        'Invent\u00e1rio Tribut\u00e1rio de 31/12/2026: a carteira inteira com dias restantes, ' +
        'sem\u00e1foro de urg\u00eancia e quanto est\u00e1 em jogo entre uma op\u00e7\u00e3o e outra.' },
      { versao: '1.0.0', data: '20/08/2026', texto:
        'Primeira vers\u00e3o: regime espec\u00edfico de bens im\u00f3veis com 11 telas, redutor de ajuste ' +
        'do art. 375 com as duas op\u00e7\u00f5es, persist\u00eancia e parecer com IA.' }
    ]
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
