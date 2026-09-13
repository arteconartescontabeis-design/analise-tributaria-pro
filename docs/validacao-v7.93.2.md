[validacao-v7.93.2.md](https://github.com/user-attachments/files/32174152/validacao-v7.93.2.md)
# Validação externa — Análise Tributária Pro v7.93.2

**Linha de base:** app v7.93.2 · lacre do motor `453f7b32` · suíte `tests/run.js` 1086 verificações · tag `v7.93.2-validada`.

Rodada de auditoria externa de 11 a 13/09/2026: cada relatório do auditor gerou uma versão própria; o lacre foi re-selado três vezes (2e1139e9 → c503dbd2 → 5996c4be → 453f7b32) e ficou íntegro da v7.91.0 até a v7.93.2. Resultado: relatórios aprovados em 100%; último teste de fronteira (Fator R 28,00000000% → Anexo III) evidenciado em PDF; análise da empresa TESTE/2026 fechada com snapshot da versão em 13/09/2026 20:14:43.

| Data | Relatório do auditor | Versão |
|---|---|---|
| 11/09 | Relatório Consolidado de Pontos Críticos | v7.88.0 |
| 11/09 | Pendências Remanescentes — Artecon(8) | v7.90.0 |
| 11/09 | Prompt v7.91 — classificação de fornecedores | v7.91.0 / v7.91.1 |
| 12/09 | Correções da versão 7.91 | v7.92.0 |
| 12/09 | Melhoria 7.92 — editor por valores | v7.92.1 |
| 13/09 | Auditoria F01–F14 — v7.92.1 | v7.92.2 |
| 13/09 | Parecer técnico v7.92.2 + Artecon1 | v7.92.3 |
| 13/09 | Validação final da 7.92.3 | v7.92.4 |
| 13/09 | Navegação + divergências entre relatórios | v7.93.0 |
| 13/09 | Reteste dos relatórios — v7.93.0 | v7.93.1 |
| 13/09 | Reteste final — v7.93.1 (100%) | v7.93.2 |
| 13/09 | PDF Artecon7 — fronteira 28% → Anexo III | — |

Dossiê completo (relatórios do auditor, respostas da Artecon, evidências): pasta privada no Drive — `ATP — Validação v7.93.2 (set/2026)` (link: Z:\Aplicativo Criado Artecon\analise-tributaria-pro\ATP — Validação v7.93.2 (set2026)). Nenhum relatório com dados de empresa é versionado neste repositório.

Regra a partir daqui: cada melhoria em versão própria; relatório pré-implantação quando tocar motor ou banco; lacre re-selado só com rebaseline declarado; auditor roda só a área tocada. F01–F14 e T01–T08 permanecem como regressão automatizada.

Ressalva conhecida fora desta rodada: falso aviso "Diferenças em: reforma" no comparador tela × gravada dos Relatórios (ordem de chaves do jsonb) — v7.93.3, após a tag.
