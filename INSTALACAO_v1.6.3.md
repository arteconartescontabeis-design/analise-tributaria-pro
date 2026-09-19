# Instalação — Análise Imobiliária Pro v1.6.3

1. Subir os arquivos de `modulos/imobiliario/` (todos os 15 — os que não mudaram estão idênticos aos publicados, conferir pelo MANIFESTO).
2. Subir `imobiliaria.html` (só mudou `?v=1.5.0` → `?v=1.6.1` nos 14 `<script src>`, para furar o cache do Pages).
3. Subir `tests/` (run_imob_v160.js, casos_base.js, baseline_motor_1.2.0.json, run_imob_ui.js, varredura_v161.js). Não há SQL nesta versão — nenhuma tabela, política ou gatilho muda.
4. Conferir: `node tests/run_imob_v160.js` → 106/106 · `npm i --no-save jsdom@24 && node tests/run_imob_ui.js` → 53/53 · na tela, badge v1.6.3.

Arquivos alterados (acumulado 1.5.0 → 1.6.2): motorImob.js, ui_imobiliaria.js, imob_pagina.js, imob_relatorios.js, imob_layout.js, imob_validacao.js, imob_manifesto.js, imobiliaria.html. Sem alteração: imob_estilo.js, imob_graficos.js, imob_marca.js, imob_premissas.js, persistenciaImob.js, parecerImobIA.js, nucleoRastreio.js.
