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
    versao: '1.2.0',
    data: '22/08/2026',
    aba: 'page-imobiliaria',
    motor: { nome: 'motorImob', versao: '1.2.0', contrato: 'calc-imob-1',
             ruleset: 'imob-2026.08.21', lacre: 'c287341e', regras: 29, homologadas: 28 },
    base_legal: { dispositivos: 97, fontes: ['Decreto 12.955/2026', 'Resolu\u00e7\u00e3o CGIBS 6/2026',
                                             'LC 214/2025 at\u00e9 a LC 227/2026'] },
    estado: 'piloto controlado',
    ressalva: 'Al\u00edquota de refer\u00eancia \u00e9 estimativa n\u00e3o vinculante da Resolu\u00e7\u00e3o CGIBS 14/2026.',
    changelog: [
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
