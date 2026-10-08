# Instalação — Análise Tributária Pro v7.96.0 → v7.99.1 (entrega de 07–08/10/2026)

## Já feito no Supabase (não precisa repetir)
- `sql/setup_v7991.sql` aplicado (colunas novas em `atp_empresas`: `data_abertura`, `cnae_codigo`, `data_exclusao_simples`, `data_opcao_simei`, `data_exclusao_simei`, `natureza_juridica`, `receita_consultada_em`). O script é idempotente: rodar de novo não faz mal.
- Edge Function **`gerar-parecer-imobiliario`** publicada (v1.0.0 — versão 18 no painel), Verify JWT desligado (a função valida a sessão por dentro).
- Edge Function **`gerar-parecer-incorporacao`** publicada (v1.4.1 — versão 8 no painel), Verify JWT desligado.

## Publicar no GitHub Pages (subir os arquivos)
1. `index.html` (v7.99.1 · lacre `0a257d66`).
2. `incorporacao.html` (reconstruído a partir do index v7.99.1).
3. `tests/run.js`, `tests/run_incorporacao.js` (sem mudança), `sql/setup_v7991.sql`, `supabase/functions/**`, `PENDENCIAS.md`, `docs/INSTALACAO_v7.99.1.md`, `.github/workflows/tests.yml`.
4. Nada muda em `imobiliaria.html`, `classificacao.html` nem nos módulos da Imobiliária.

## Conferir
- `node tests/run.js` → **1249 verificações OK** (lacre `0a257d66`).
- `node tests/run_incorporacao.js` → **272 verificações OK** (motor idêntico ao index).
- Na tela: badge **v7.99.1**; aba Versões mostra o lacre `0a257d66` íntegro.
- Análises **fechadas** antes desta versão vão mostrar "recálculo diverge do snapshot" quando: tiverem mês com crédito de ICMS maior que o débito (v7.96.0), ou forem de 2026 com receita acima de R$ 1,25 mi/trimestre no Presumido (v7.99.0). É o comportamento esperado de uma re-selagem; o snapshot original fica preservado.

## O que o usuário vê de novo
- **Configuração:** "Saldo credor de ICMS em 1º/jan" e "LC 224/2025 — presunção +10%" (Aplicar / Não aplicar — liminar).
- **Aba Compras:** linha "De fornecedores MEI / Simples (dentro das compras sem ST)".
- **Aba ICMS·IPI:** quadro apurado com líquido, saldo anterior, a recolher e saldo a transportar; compras sem ST, parcela MEI/Simples e base do crédito; ISS, PIS e COFINS (LP e LR) editáveis; botão "Preencher compras de MEI/Simples pelos fornecedores"; toda substituição de valor apurado pede o **motivo**.
- **Empresas:** data de abertura, CNAE e situação Simples/MEI na ficha (preenchidos pela Receita); coluna Abertura; a análise usa a data de abertura como início de atividade (selo "E").
- **Memórias e relatórios:** linhas novas de conta gráfica do ICMS, exclusão do crédito de MEI/Simples, acréscimo da LC 224/2025 e "valor informado manualmente" com motivo.

## Opcional
- Criar o secret `IA_GATEWAY_TOKEN_IMOBILIARIO` (token gerado no Portal → Consumo de IA) para o parecer da Imobiliária ter cartão próprio de consumo. Sem ele, a função usa o cartão do Análise Tributária (`IA_GATEWAY_TOKEN`).
