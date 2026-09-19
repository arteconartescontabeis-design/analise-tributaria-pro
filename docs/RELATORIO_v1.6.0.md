# Análise Imobiliária Pro — v1.6.0 / v1.6.1 / v1.6.2 · Relatório de implementação

**Versão** 1.6.0 · **Data** 18/09/2026 · **Responsável** Cleiver (Artecon) / desenvolvimento com Claude · **Origem** "Prompt de Alteração do Aplicativo de Análise Imobiliária v1.5.0"
**Motor** motorImob 1.2.0 → **1.3.0** · **Ruleset** imob-2026.08.21 → **imob-2026.09.18** · **Lacre** c287341e → **338c914d** (calculado após os testes; o anterior foi conferido íntegro antes de qualquer alteração)

## 0. Linha de base (item 9 — inventário antes de alterar)

Não existe `run_imob.js` (394 verificações). A linha de base foi construída **antes de tocar no motor**: a saída do motor 1.2.0 publicado (lacre c287341e íntegro) foi congelada para 28 casos + 6 funções comparativas em `tests/baseline_motor_1.2.0.json`. A suíte nova `tests/run_imob_v160.js` compara o motor 1.3.0 com essa saída; **toda divergência tem de estar na lista de divergências esperadas, nomeada** — divergência não listada é falha.

Resultado: **92/92**. `tests/run_imob_ui.js` (suíte de interface, 41 → 48): **48/48**.

## 1. Divergências numéricas em relação ao motor 1.2.0 (só estas)

| Onde | Antes (1.2.0) | Depois (1.3.0) | Fundamento |
|---|---|---|---|
| Tabela 2026–2033, anos 2027 e 2028 — IBS | 0,05% (a interface trazia só uma das metades) | **0,10%** (0,05% estadual + 0,05% municipal) | LC 214/2025, art. 344 |
| Ex.: venda de 900.000 com redutor de 400.000, ano 2027 | R$ 18.320,00 | **R$ 18.420,00** | idem |
| Locação de até 90 dias residencial sem classificação | bloqueio B001 pelo prazo | bloqueio **B005** pedindo a classificação (hospedagem × locação residencial) | LC 214, art. 253 (IMOB-TEM-001 v2) |
| Lucro Presumido com venda sem confirmar objeto social / natureza | calculava com aviso | **bloqueia** (LP02 / LP03 / LP04) e aponta `calcGanhoCapital` | Lei 9.249, art. 15; Lei 9.430, art. 29; IN 1.700, art. 215 (IMOB-LP-001 v2) |

Todos os demais 28 casos, o Lucro Presumido confirmado, o ganho de capital, o Lucro Real e a projeção com a escada antiga são **idênticos ao centavo** ao motor 1.2.0.

## 2. Alterações, uma a uma (arquivo · função · regra · fórmula anterior → nova · fundamento · teste)

| # | Arquivo / função | Regra | Fórmula anterior → nova | Fundamento oficial | Teste |
|---|---|---|---|---|---|
| P0-1 | `motorImob.js` · `percentuaisAliquotas`, `percentuaisDoResultado`, `aliquotasReduzidas`, `calcular` | IMOB-ALQ-001/002, IMOB-2026-001, RET, 3,65% | não havia → todo percentual sai como `{nome, valor, categoria, fonte, vigencia, versao}` em `res.percentuais` e na linha de alíquotas da memória; categorias LEGAL · ADMINISTRATIVA · PREMISSA · ESTIMATIVA · PROJECAO · SIMULACAO · INFORMADO | LC 214 art. 261; Res. CGIBS 14/2026 (estimativa não vinculante) | run_imob_v160: P0 (7 testes); run_imob_ui V2 |
| P0-2 | `motorImob.js` · `transicaoPadrao` (nova), `projetarTransicao` | IMOB-TRA-001 v2 (status **projeção**) | tabela fixa na UI com "LEGAL" por ano → escada gerada pelo motor com categoria **por ano e por tributo**; linha só é LEGAL se IBS e CBS forem LEGAL; 2027-28 IBS 0,05 → 0,10 | LC 214 arts. 343, 344, 346, 347, 348; ADCT arts. 125-129 | P0 escada (8 testes); A-projeção; V1 |
| P0-2 | `ui_imobiliaria.js` · `TRANSICAO` removida, `escadaAtual`, `calcularAnos`, `imobAnosHTML`, `calcComp` | — | tabela ano a ano passa a mostrar IBS e CBS **separados** (alíquota, origem e valor de cada um) | — | N4, V1 |
| P0-3 | (já existia) `calcVenda`/`calcLocacao` | IMOB-BASE-001 | valor − redutor de ajuste − redutor social = base; IBS + CBS = débito; débito − créditos = total — agora **testado** | LC 214 arts. 252, 257-259 | P0 reconcilia (2) |
| P0-4 | `calcular` · `carga_efetiva_pct`; `imobAnosHTML`; relatórios | — | carga efetiva no resultado; IBS/CBS separados em todas as tabelas | — | P0 separados (3) |
| P1-1 | (já existia) rateio art. 380 §6º | IMOB-PAR-001 | Σ parcelas ≡ total — **testado** (3 e 7 parcelas) | LC 214 art. 262 §4º | P1 rateio (3) |
| P1-2 | `motorImob.js` · `calcPermuta` | IMOB-PER-001 v2 | torna à vista → **torna_pagamentos[]**: IBS/CBS por pagamento na proporção do principal, Σ ≡ total; **torna_financiada**: incidência integral no recebimento, nota | LC 214 art. 252 §3º; RIBS art. 360 §3º e art. 380 caput | P1 permuta (7); V5 |
| P1-3 | `motorImob.js` · `calcLucroPresumido` | IMOB-LP-001 v2 | aviso → **bloqueio** sem `atividade_imobiliaria_no_objeto === true` **e** `natureza_receita_venda === 'operacional'`; ativo não circulante → LP04 com alternativa `calcGanhoCapital` | Lei 9.249 art. 15; Lei 9.430 art. 29; IN RFB 1.700 art. 215; SC COSIT 221/2024 | P1 LP (4); V4 |
| P1-4 | (já existia) `calcLucroRealIndicativo` | IMOB-LR-001 (staging, categoria indicativa) | rótulo obrigatório de simulação — **testado** | Lei 9.430; Leis 10.637/10.833 | P1 LR |
| R-temporada | `motorImob.js` · `calcLocacao` | IMOB-TEM-001 v2 | bloqueio pelo prazo → **classificação obrigatória** (`classificacao_operacao`: hospedagem → B001 com explicação; locacao_residencial → exige `justificativa_classificacao` (B006), calcula e grava a decisão na memória) | LC 214 art. 253 | LOC temporada (4); V3 |
| R-catálogo | `motorImob.js` · `META`, `aplicarMeta`, `regra()` | todas as 29 | `fontes` resumidas → catálogo auditável: código, versão, fórmula, fonte oficial (norma + link), data de consulta, vigência, status ampliado, categoria, premissas, dependências, impacto, alteração posterior; premissa/indicativa/projeção nunca "homologada" | Planalto (LC 214, Leis 9.249/9.430/9.718, EC 132), Decreto 12.955/2026, normas RFB | FUND (5); V6 |
| R-catálogo | `ui_imobiliaria.js` · `pintaRegras` | — | tela Regras e fontes mostra o catálogo com link `[oficial]`, consulta e alerta ⚠ de norma posterior | — | V6 |
| Relatórios | `imob_relatorios.js` · `avisosHTML`, `percentuaisHTML`, CSS `.rot-*` | — | aviso obrigatório de **simulação técnica dependente de validação documental, contábil e jurídica**; legenda dos valores (lei / informado / premissa / estimativa / projeção); tabela dos percentuais no técnico e na memória | — | V7 |
| UI | `imob_pagina.js` | — | campos novos: `l-cls`, `l-just` (locação); `x-tparc`, `x-fin` (permuta); `c-nat` e `c-obj` com "confirmar" (comparativo) | — | V3, V4, V5 |
| UI | `ui_imobiliaria.js` · `imobParcelasHTML`, `imobNotasHTML`, `imobPercentuaisHTML`, `catBadge` | — | parcelas na permuta; observações do motor; percentuais na memória | — | V2, V5 |
| Layout | `imob_layout.js` · `nomeAba` | — | cards novos encaixados nas abas Premissas e alertas / Etapas | — | 48/48 |
| Versão | `imob_manifesto.js`, `imobiliaria.html` | — | 1.5.0 → 1.6.0, motor 1.3.0, lacre 338c914d, changelog; `?v=1.6.0` nos 14 scripts | — | E3 |

## 3. Revisão das regras em fonte (item 3)

Conferido diretamente no texto legal nesta entrega: **art. 344** (IBS 2027-2028: 0,05% estadual + 0,05% municipal) e **art. 347** (CBS 2027-2028 = referência do art. 14 − 0,1 p.p.; §1º, II: aplica-se aos regimes específicos sobre as respectivas bases) — ambos mudaram o cálculo. O Decreto 12.955/2026 (art. 585) reproduz o art. 347.
Reaproveitado do Passo 0 (já conferido em fonte primária, 14/14): arts. 251-263, 343, 346, 348, 485-487 da LC e 359-390, 461-463 dos regulamentos.
**Não reconferido em fonte primária nesta entrega** (segue como estava): Lei 9.249, Lei 9.430, IN 1.700, SC COSIT 7/2021 e 221/2024 (Lucro Presumido/ganho de capital) — os links do catálogo apontam para o Planalto/RFB, mas o texto não foi relido. Fica como pendência.

## 4. Pendências (item 9)

1. Links do catálogo: os do Planalto para LC 214, Leis 9.249/9.430/9.718 e EC 132 seguem o padrão do site; o link da IN 1.700 e das SC COSIT é o do sistema SIJUT (consulta) — conferir se abrem antes de mostrar a cliente.
2. `data_consulta` está gravada como 2026-09-18 em todas as regras; as regras não relidas nesta entrega (item 3) deveriam trazer a data do Passo 0 (20/08/2026). Ajuste simples no `META` quando você decidir.
3. Cessão onerosa de direitos aquisitivos (50% × 70%) e redutor estático × dinâmico continuam decisões do responsável técnico (registradas nas premissas das regras IMOB-ALQ-002 e IMOB-RAJ-001).
4. `imob_validacao.js` não valida os campos novos (classificação/justificativa/torna parcelada) antes de chamar o motor — o motor bloqueia e explica, mas a validação de formulário poderia antecipar.
5. `pacoteParecer`/Edge Function ainda não recebem `res.percentuais` — o parecer com IA continua sem a categoria de cada percentual no payload.
6. `run_imob.js` original não existe; a regressão é contra a saída congelada de 28 + 6 casos, não contra as 394 verificações. Se o arquivo aparecer, rodá-lo sobre o motor 1.3.0 e registrar o que divergir.
7. A escada 2029-2032 é projeção linear; quando o Senado fixar as alíquotas anuais, `transicaoPadrao` precisa receber os valores legais (categoria LEGAL) — hoje isso exige alterar o motor e relacrar.

## 5. Como conferir na tela

Badge **v1.6.0** e a linha no changelog (tela Módulo); Venda → aba **Ano a ano**: 2027 com IBS 0,10% "fixada em lei" e CBS "estimativa"; aba **Premissas e alertas**: tabela "Percentuais usados neste cálculo"; Locação com prazo 60 dias → pede classificação; Comparativo sem confirmar objeto/natureza → "Lucro Presumido não aplicado"; Regras e fontes → links [oficial] e alerta LC 227; relatório técnico → aviso de simulação técnica e legenda.

## 6. Varredura de erros (v1.6.1, 18/09/2026) — lacre 338c914d inalterado

Método: carga dos 14 scripts + layout em jsdom (`tests/varredura_v161.js`), fluxos completos de venda, locação, permuta e comparativo, entradas hostis nos caminhos novos, emissão dos 12 relatórios (4 tipos × 3 operações) procurando `undefined`/`NaN`, inspeção das abas montadas pelo layout.

| Achado | Gravidade | Correção | Teste |
|---|---|---|---|
| `torna_pagamentos` com texto/negativo virava parcelas de R$ 0 e **todo o imposto caía na última** — `naoNeg('100000')` devolvia a string. O mesmo defeito existia na venda (`pagamentos`) desde o 1.2.0, nunca exposto. | alta (número errado sem aviso) | `validar()` E015: lista vazia, não-array, texto ou negativo → bloqueio | VAR (3) |
| Justificativa da classificação aceitava objeto (`[object Object]`) | baixa | E016 | VAR |
| Escada 2026-2033 recebida de fora com `classificacao:'LEGAL'` na linha (formato do motor genérico) rotulava 2027 como lei | média | categoria derivada da regra do ano quando não há categoria por tributo | VAR + A-projeção |
| `transicaoPadrao` sem alíquota de referência montava escada com CBS 0 e categoria "estimativa" | média | devolve `null`; a projeção bloqueia (T001) | VAR (2) |
| Layout abria **duas abas "Premissas e alertas"** (card de percentuais + card de grau) | visual | `aba()` funde cards de mesmo nome | varredura |
| Relatórios: falso positivo de `NaN` — está dentro do base64 do logotipo | — | nada | — |
| Locação **não residencial** com prazo curto não pede classificação (art. 253 é só residencial) | conferido, correto | — | varredura |
| Contagem `homologadas` do manifesto (27) confere com o catálogo | conferido | — | varredura |

Suítes finais: `run_imob_v160.js` **99/99** · `run_imob_ui.js` **48/48** · varredura sem erro.

## 7. v1.6.2 (18/09/2026) — fecho das dívidas da 1.6.1 · motor 1.3.1 · lacre 338c914d inalterado (nenhuma fórmula mudou)

| # | Arquivo / função | O que mudou | Teste |
|---|---|---|---|
| 1 | `imob_validacao.js` · `validarLocacao`, `validarPermuta`, `validarComparativo`; `ui_imobiliaria.js` passa os campos | Erro no próprio campo, antes de chamar o motor: `l-cls`/`l-just` (prazo ≤ 90 dias em residencial), `x-tparc` (parcelas numéricas > 0 e soma = torna), `c-obj`/`c-nat` (venda no comparativo). O motor continua bloqueando se chamado direto (defesa em profundidade). | V3, V8, V9, V10 |
| 2 | `motorImob.js` · `pacoteParecer`, `promptParecer` | `bloco_05b_percentuais` (valor, categoria, fonte, vigência, versão); percentuais entram em `numeros_autorizados`; limitação "percentuais NÃO fixados em lei"; regra 7 do prompt: proibido chamar de legal/vigente o que não é LEGAL; **`confianca` e `tipo` no topo do pacote** — achado da varredura de 22/08 (o `pdfImob` lia daí e recebia undefined) | PAC (5) |
| 3 | `motorImob.js` · `META`/`aplicarMeta`; `ui_imobiliaria.js` · `pintaRegras` | `data_consulta` por regra: 20/08 (Passo 0, texto da LC e dos regulamentos), 18/09 (arts. 344/347), 22/08 para LP/LR; `conferida_em_fonte_primaria=false` nas cinco regras do regime atual, com badge "fonte secundária — texto não relido" na tela | CAT (2), V11 |

Suítes: `run_imob_v160.js` **106/106** · `run_imob_ui.js` **52/52** · `varredura_v161.js` 0 erros. Arquivos alterados nesta versão: motorImob.js, imob_validacao.js, ui_imobiliaria.js, imob_manifesto.js, imobiliaria.html.

**Ainda sem tratar (fora do escopo destas três):** Edge Function sem o ramo `imobiliario` (o pacote já leva os percentuais, mas o servidor não os usa até o ramo existir); regras LP/LR seguem em fonte secundária — agora declaradas como tal; Parecer Técnico v2 (RET); escada 2029-2032 projeção; caso real do setor.
