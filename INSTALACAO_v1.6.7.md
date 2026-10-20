# Instalação — Análise Imobiliária Pro v1.6.7

Reanálise P2: **política metodológica publicada** + **limites de entrada documentados**. Lacre `cd2c7359` INALTERADO; motor 1.4.0 → **1.4.1** apenas pelo texto da fonte do achado A07 (nenhuma fórmula mudou — o vetor do lacre é numérico e não é afetado).

**Onde publicar:** repositório `tributario-fiscal`, pasta `imobiliario/`.

1. Subir de `modulos/imobiliario/` os 5 arquivos alterados e o documento novo:
   - `politica-metodologica.html` → publicar em `imobiliario/politica-metodologica.html` (AO LADO do index.html — o link da aba Regras é relativo)
   - `motorImob.js` (1.4.1: fonte do A07 aponta o documento PM-IMOB; lacre cd2c7359 inalterado)
   - `imob_validacao.js` (1.3.0: limite documentado de R$ 10 trilhões por valor, mensagem citando a PM-IMOB)
   - `ui_imobiliaria.js` (link "Política metodológica (PM-IMOB)" na aba Regras)
   - `imob_relatorios.js` (rodapé de todos os relatórios cita o documento)
   - `imob_manifesto.js` (v**1.6.7**, motor 1.4.1, lacre `cd2c7359`, changelog)
2. No HTML do app publicado, trocar `?v=` dos `<script src>` para `?v=1.6.7`.
3. Subir `tests/` (run_imob_v160.js com os 5 casos extremos; run_imob_ui.js com R6 e R7). Não há SQL.
4. Conferir: `node tests/run_imob_v160.js` → **124/124** · `npm i --no-save jsdom@24 && node tests/run_imob_ui.js` → **71/71** · na tela, badge v1.6.7 e selo `cd2c7359`.

Validação manual (critérios P2 da reanálise):

- Aba **Regras**: link "Política metodológica (PM-IMOB, documento versionado)" abre o documento, com versão 1.0.0, data, ruleset, limites e histórico.
- Aba **Auditoria**: a fonte do achado A07 cita o documento (`politica-metodologica.html`), o ruleset e a Res. CGIBS 14/2026.
- Rodapé de qualquer relatório emitido: "Metodologia: Política Metodológica PM-IMOB (politica-metodologica.html…)".
- Venda de R$ 20 trilhões: bloqueia com "acima do limite documentado de R$ 10 trilhões (política metodológica PM-IMOB…)"; R$ 1 trilhão continua calculando (IBS 93,5 bi · CBS 46,05 bi · total 139,55 bi, como na reanálise).
