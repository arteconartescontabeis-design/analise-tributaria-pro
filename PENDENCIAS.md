# Pendências — Análise Tributária Pro

Registro do que ficou para depois, com o motivo. Atualizado em 08/10/2026 (entrega v7.96.0 → v7.99.1).

## Resolvido nesta entrega (07–08/10/2026)

| Item | Versão | O que foi feito |
|---|---|---|
| Saldo credor de ICMS abatia os outros tributos | v7.96.0 | Conta gráfica do ICMS (saldo anterior · a recolher · saldo a transportar); campo "Saldo credor de ICMS em 1º/jan" |
| Compra de MEI/Simples gerava crédito de ICMS | v7.97.0 | `compras.simplesMei` fora da base do crédito e da Lei 14.592; crédito informado por optante (`icms.credSimples`); preenchimento pela classificação dos fornecedores |
| ISS, PIS e COFINS não aceitavam valor informado; alterações sem motivo | v7.98.0 | `trib.*` editáveis na aba ICMS·IPI; motivo obrigatório em toda substituição de valor apurado (ICMS, IPI, ISS, PIS, COFINS); memória e trilha mostram o motivo |
| LC 224/2025 (presunção +10% acima de R$ 1,25 mi/trimestre) | v7.99.0 | Trimestral acumulado, rateio por atividade, IRPJ jan/2026 e CSLL abr/2026, chave para liminar. **Lacre re-selado 8ab9c16a → 0a257d66** |
| Início de atividade espalhado; data de abertura da Receita descartada | v7.99.1 | Ficha da empresa com data de abertura, CNAE e Simples/MEI com datas (`sql/setup_v7991.sql`, já aplicado); análise lê a ficha (origem E) |
| Edge Function `gerar-parecer-imobiliario` publicada com o código da Incorporação | — | Função própria da Imobiliária escrita e publicada (v1.0.0, versão 18 no Supabase); Incorporação v1.4.1 publicada no slot certo (versão 8) |
| `incorporacao.html` com motor defasado (7 testes falhando) | — | Reconstruído com `tools/build_incorporacao.js` a partir do index v7.99.1; suíte 272/272 |

## Em aberto

### 1. Secret `IA_GATEWAY_TOKEN_IMOBILIARIO` (recomendado)
A função da Imobiliária usa, nesta ordem: `IA_GATEWAY_TOKEN_IMOBILIARIO` → `IA_GATEWAY_TOKEN` (cartão do Análise Tributária) → `ANTHROPIC_API_KEY`. Hoje ela funciona pelo cartão do Análise Tributária. Para o consumo da Imobiliária aparecer em cartão próprio no Portal → Consumo de IA, gerar o token lá e cadastrar o secret no Supabase (Edge Functions → Secrets). A função da Incorporação segue a mesma cascata com `IA_GATEWAY_TOKEN_INCORPORACAO`.

### 2. Validar o parecer da Imobiliária em uso real
A função nova respeita o contrato de `parecerImobIA.js` (blocos, números autorizados, marcas de origem), mas o texto da IA passa pela guarda anti-alucinação do cliente. Gerar um parecer de teste na tela Imobiliária e conferir se a guarda aprova na 1ª ou 2ª tentativa; se reprovar sempre, ajustar o prompt da função (`supabase/functions/gerar-parecer-imobiliario/index.ts`).

### 3. Histórico de versões frágil
`atp_analises_hist` guarda só as **3 últimas** versões por empresa/ano (gatilho `atp_hist_podar`), o autor é informado pelo navegador (não pelo servidor) e qualquer usuário do escritório pode apagar linhas (política RLS de DELETE). A trilha de alterações dentro do JSON da análise (`auditoria[]`, com motivo desde a v7.98.0) é hoje o registro mais confiável. Sugestão: guardar 12+ versões, `gravado_por` preenchido por gatilho a partir do token, e DELETE só para administrador.

### 4. Cadastro único — fases 2 e 3
- **Fase 2:** regime tributário **por ano** (hoje `atp_empresas.regime` é um valor só; relatórios de anos anteriores saem com o regime de hoje).
- **Fase 3:** Imobiliária e Classificação passarem a ler a ficha da empresa (`atp_empresas`). A Imobiliária guarda os dados da empresa só no navegador (`localStorage`) e grava cálculos sem CNPJ; a Classificação mantém cópia própria do nome.

### 5. LC 224/2025 nos outros módulos
- **Imobiliária** (`motorImob.js`, `calcLucroPresumido`): motor próprio, sem ano-base — não aplica o acréscimo de 10%. Avaliar se o módulo precisa (venda de imóvel por empresa do Presumido acima de R$ 1,25 mi/trimestre é plausível).
- **Incorporação** (`src/incorporacao_app_6.js`): usa o motor copiado (já com a LC 224), mas remonta a base da CSLL para exibição por conta própria (linhas ~96-103) — conferir se o quadro bate com o motor quando houver acréscimo.

### 6. Teste E3 da Imobiliária
`tests/run_imob_ui.js` → 51/52: o teste E3 espera a versão **1.6.2** visível na tela e o módulo está em 1.6.3. Falha anterior a esta entrega; corrigir a expectativa do teste.

### 7. Projeção da Reforma e LC 224
`calcCenariosReforma` projeta 2026–2033 usando o IRPJ/CSLL do **ano-base** (`lpResto`), sem recalcular ano a ano. Com a LC 224 isso é consistente (o acréscimo do ano-base entra em todos os anos), mas uma empresa que cruze o limite só em anos futuros não terá o acréscimo projetado. Documentado; decidir se vale projetar.

## Como voltar atrás
- **Código:** `backups/codigo_analise-tributaria-pro_2026-10-07_4770de5.zip` (estado da `main` em 07/10/2026) ou `git checkout 4770de5`.
- **Banco:** `backups/supabase_analise-tributaria-pro_2026-10-07.zip` (estrutura + dados + Edge Functions publicadas em 07/10). As colunas novas de `atp_empresas` (v7.99.1) são aditivas: podem ficar sem prejudicar a versão antiga do app.
- **Edge Functions:** o código que estava publicado em 07/10 está em `backups/supabase_2026-10-07/04_edge_functions/`.
