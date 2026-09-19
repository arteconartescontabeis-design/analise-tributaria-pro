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
    versao: '1.6.2',
    data: '18/09/2026',
    cadastro_ampliado_no_banco: false,   // true só depois de rodar sql/setup_imob_v130.sql
    aba: 'page-imobiliaria',
    motor: { nome: 'motorImob', versao: '1.3.1', contrato: 'calc-imob-1',
             ruleset: 'imob-2026.09.18', lacre: '338c914d', lacre_anterior: 'c287341e', regras: 29, homologadas: 27,
             nota: 'IMOB-TRA-001 reclassificada como proje\u00e7\u00e3o e IMOB-LR-001 segue em staging: regra baseada em premissa, estimativa ou proje\u00e7\u00e3o n\u00e3o \u00e9 homologada.' },
    base_legal: { dispositivos: 97, fontes: ['Decreto 12.955/2026', 'Resolu\u00e7\u00e3o CGIBS 6/2026',
                                             'LC 214/2025 at\u00e9 a LC 227/2026'] },
    estado: 'piloto controlado',
    ressalva: 'Al\u00edquota de refer\u00eancia \u00e9 estimativa n\u00e3o vinculante da Resolu\u00e7\u00e3o CGIBS 14/2026.',
    changelog: [
      { versao: '1.6.2', data: '18/09/2026', texto:
        'Fecho das d\u00edvidas da 1.6.1 (motor 1.3.1, lacre 338c914d inalterado \u2014 nenhuma f\u00f3rmula mudou). Valida\u00e7\u00e3o de formul\u00e1rio para os campos novos: classifica\u00e7\u00e3o/justificativa da loca\u00e7\u00e3o curta, parcelas da torna (n\u00fameros e soma) e objeto social/natureza no comparativo \u2014 o erro aparece no campo antes de chamar o motor. '
        + 'Pacote do parecer com IA passa a levar os percentuais com categoria (bloco_05b), a limita\u00e7\u00e3o "percentuais n\u00e3o fixados em lei", a regra 7 do prompt (proibido chamar de legal o que n\u00e3o \u00e9) e confian\u00e7a/tipo no topo do pacote. '
        + 'Cat\u00e1logo: data de consulta por regra (Passo 0 = 20/08; LP/LR = 22/08 em fonte secund\u00e1ria; transi\u00e7\u00e3o = 18/09) e marca "fonte secund\u00e1ria \u2014 texto n\u00e3o relido" nas regras do regime atual. Su\u00edtes: run_imob_v160 106/106 \u00b7 run_imob_ui 52/52.' },
      { versao: '1.6.1', data: '18/09/2026', texto:
        'Varredura de erros sobre a 1.6.0 (lacre 338c914d inalterado). Listas de pagamentos (venda e torna da permuta) com texto, negativo ou vazias passam a bloquear (E015) '
        + '\u2014 antes um valor n\u00e3o num\u00e9rico virava parcela de R$ 0 e todo o imposto ca\u00eda na \u00faltima parcela (defeito pr\u00e9-existente na venda, exposto pelo caso novo da permuta); justificativa da classifica\u00e7\u00e3o precisa ser texto (E016); '
        + 'escada 2026-2033 recebida de fora sem categoria por tributo n\u00e3o herda mais o r\u00f3tulo "LEGAL" da linha (a categoria vem da regra do ano); sem al\u00edquota de refer\u00eancia a escada n\u00e3o \u00e9 montada com zeros (a proje\u00e7\u00e3o bloqueia); '
        + 'layout: cards de mesmo nome caem na mesma aba (a 1.6.0 abria duas abas "Premissas e alertas"). Su\u00edtes: run_imob_v160 99/99 · run_imob_ui 48/48.' },
      { versao: '1.6.0', data: '18/09/2026', texto:
        'Prompt de Altera\u00e7\u00e3o v1.5 \u2014 corre\u00e7\u00f5es de c\u00e1lculo e fundamenta\u00e7\u00e3o. MOTOR 1.3.0, ruleset imob-2026.09.18, novo lacre 338c914d (anterior c287341e). '
        + 'P0: todo percentual sai com categoria (fixada em lei, ato administrativo, premissa, estimativa, proje\u00e7\u00e3o, simula\u00e7\u00e3o), fonte, vig\u00eancia e vers\u00e3o, na tela, na mem\u00f3ria e nos relat\u00f3rios; '
        + 'a tabela 2026-2033 deixou de ser fixa na interface e passou a vir do motor com categoria por ano E por tributo \u2014 corrigido o IBS de 2027-2028 (era 0,05%, s\u00f3 metade; \u00e9 0,10% = 0,05% estadual + 0,05% municipal, art. 344) e o r\u00f3tulo "fixada em lei" que 2027-2028 recebiam por atacado (a CBS desses anos depende da refer\u00eancia, art. 347); '
        + 'IBS e CBS separados tamb\u00e9m na tabela ano a ano. P1: Lucro Presumido n\u00e3o aplica mais 8%/12% \u00e0 venda sem confirma\u00e7\u00e3o expressa do objeto social e da natureza da receita (im\u00f3vel do ativo n\u00e3o circulante \u00e9 ganho de capital); '
        + 'permuta com torna parcelada (imposto em cada pagamento, art. 380) e com torna financiada; loca\u00e7\u00e3o de at\u00e9 90 dias n\u00e3o bloqueia mais s\u00f3 pelo prazo \u2014 exige a classifica\u00e7\u00e3o da opera\u00e7\u00e3o (hospedagem \u00d7 loca\u00e7\u00e3o residencial com justificativa) e explica a hotelaria. '
        + 'Regras e fontes viraram cat\u00e1logo audit\u00e1vel (f\u00f3rmula, link oficial, data de consulta, vig\u00eancia, status ampliado, premissas, depend\u00eancias, impacto, alerta de altera\u00e7\u00e3o por norma posterior). '
        + 'Relat\u00f3rios com aviso de simula\u00e7\u00e3o t\u00e9cnica, legenda dos valores e tabela dos percentuais aplicados. Nova su\u00edte tests/run_imob_v160.js (regress\u00e3o contra a sa\u00edda congelada do motor 1.2.0 + testes P0/P1 do item 7).' },
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
