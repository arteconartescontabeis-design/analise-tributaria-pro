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
    versao: '1.5.0',
    data: '16/09/2026',
    cadastro_ampliado_no_banco: false,   // true só depois de rodar sql/setup_imob_v130.sql
    aba: 'page-imobiliaria',
    motor: { nome: 'motorImob', versao: '1.2.0', contrato: 'calc-imob-1',
             ruleset: 'imob-2026.08.21', lacre: 'c287341e', regras: 29, homologadas: 28 },
    base_legal: { dispositivos: 97, fontes: ['Decreto 12.955/2026', 'Resolu\u00e7\u00e3o CGIBS 6/2026',
                                             'LC 214/2025 at\u00e9 a LC 227/2026'] },
    estado: 'piloto controlado',
    ressalva: 'Al\u00edquota de refer\u00eancia \u00e9 estimativa n\u00e3o vinculante da Resolu\u00e7\u00e3o CGIBS 14/2026.',
    changelog: [
      { versao: '1.5.0', data: '16/09/2026', texto:
        'Nova apresenta\u00e7\u00e3o. As telas do m\u00f3dulo passam para o menu da esquerda, em quatro grupos (Preparar, Calcular, Analisar, '
        + 'Registros), com o passo 3 "O que calcular?" como item pr\u00f3prio. O resultado de cada opera\u00e7\u00e3o fica em uma tela s\u00f3: '
        + 'n\u00famero final em destaque (total l\u00edquido a recolher), IBS, CBS, carga efetiva e cr\u00e9ditos, composi\u00e7\u00e3o da base em uma linha, '
        + 'bot\u00f5es de relat\u00f3rio no cabe\u00e7alho e abas internas (Resumo, Gr\u00e1ficos, Etapas, Por parcela, Ano a ano, Mem\u00f3ria, Premissas). '
        + 'Gr\u00e1ficos de apresenta\u00e7\u00e3o de valores (composi\u00e7\u00e3o da base, IBS \u00d7 CBS, hoje \u00d7 Reforma, imposto ano a ano) na tela e nos '
        + 'relat\u00f3rios Resumo para o cliente e Executivo. Logotipo da Artecon no menu, no resultado e nos relat\u00f3rios. '
        + 'Corre\u00e7\u00f5es: ajudas por campo reposicionadas no campo certo (23 estavam na c\u00e9lula errada); relat\u00f3rio de venda parcelada com '
        + 'cr\u00e9ditos n\u00e3o era emitido (a confer\u00eancia comparava as parcelas brutas com o total l\u00edquido). Motor intocado (lacre c287341e).' },
      { versao: '1.4.1', data: '15/09/2026', texto:
        'Corre\u00e7\u00e3o da sess\u00e3o: o escrit\u00f3rio vinculado ao usu\u00e1rio passa a ser carregado antes de o m\u00f3dulo entrar '
        + 'e antes de qualquer consulta ou grava\u00e7\u00e3o (carteira, invent\u00e1rio, im\u00f3vel, hist\u00f3rico, relat\u00f3rios). '
        + 'Fim da mensagem "Sem escrit\u00f3rio na sess\u00e3o" para usu\u00e1rio vinculado; usu\u00e1rio sem v\u00ednculo v\u00ea um aviso claro '
        + '("procure o administrador"), sem termos t\u00e9cnicos. Fluxo revisto para login, atualiza\u00e7\u00e3o da p\u00e1gina, URL direta, '
        + 'retorno \u00e0 aba e sair/entrar de novo (o Sair agora encerra a sess\u00e3o de verdade). Corrigida a renova\u00e7\u00e3o '
        + 'autom\u00e1tica do token, que falhava por uma vari\u00e1vel n\u00e3o declarada na casca. C\u00e1lculos, regras e layout intocados.' },
      { versao: '1.4.0', data: '14/09/2026', texto:
        'Fluxo guiado em 3 passos: (1) cadastro da pessoa (PF ou PJ, regime, objeto social), (2) im\u00f3vel e redutor, '
        + '(3) escolha do que calcular (venda, loca\u00e7\u00e3o, permuta, opcionais, comparativo, PF) com os dados j\u00e1 preenchidos '
        + 'e os relat\u00f3rios ao fim de cada resultado. Nova aba Mem\u00f3ria de c\u00e1lculo (linha a linha, em palavras simples). '
        + 'Tabela "quanto seria o imposto em cada ano, 2026 a 2033" em venda, loca\u00e7\u00e3o e permuta e nos relat\u00f3rios. '
        + 'Campos de valor formatados em R$ ao sair do campo. Textos explicativos para quem n\u00e3o \u00e9 da \u00e1rea em cada aba, '
        + 'campo e etapa do resultado. Novo Resumo para o cliente (relat\u00f3rio simplificado); executivo, t\u00e9cnico e mem\u00f3ria '
        + 'agora tamb\u00e9m para loca\u00e7\u00e3o e permuta. Motor intocado.' },
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
