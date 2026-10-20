# Instalação — Análise Imobiliária Pro v1.6.4

Correções da auditoria externa de 20/10/2026 (achados F01 a F06). **Motor 1.4.0 — novo lacre `cd2c7359`** (anterior `338c914d`): fórmulas mudaram de propósito (a data do fato gerador passou a escolher a alíquota), por isso o selo foi re-selado e registrado no changelog.

**Onde publicar:** o app vive no repositório `tributario-fiscal` (pasta `imobiliario/`) desde 16/10/2026 — este repositório é o arquivo-fonte. Copiar para lá os arquivos abaixo.

1. Subir de `modulos/imobiliario/` os 4 arquivos alterados (os demais 11 estão idênticos aos publicados, conferir pelo MANIFESTO):
   - `motorImob.js` (1.3.1 → **1.4.0**: alíquota pela data, E017, categoriasDoAno, fonte do A07, lacre `cd2c7359`)
   - `ui_imobiliaria.js` (auditoria exige cálculo da sessão; aviso de divergência do redutor; rótulos acessíveis; comparativo rotulado "referência 2033")
   - `imob_relatorios.js` (etapa 2 = redutor utilizado; fórmulas com os percentuais do próprio cálculo; coerência pelo catálogo do resultado)
   - `imob_manifesto.js` (v**1.6.4**, motor 1.4.0, lacre `cd2c7359`, changelog)
2. No HTML do app publicado, trocar `?v=` dos `<script src>` para `?v=1.6.4` (furar o cache do Pages).
3. Subir `tests/` (run_imob_v160.js e run_imob_ui.js atualizados; casos_base e baseline inalterados). Não há SQL nesta versão — nenhuma tabela, política ou gatilho muda.
4. Conferir: `node tests/run_imob_v160.js` → **113/113** · `npm i --no-save jsdom@24 && node tests/run_imob_ui.js` → **60/60** · na tela, badge v1.6.4 e selo `cd2c7359`.

Validação manual dos achados (roteiro da auditoria):
- **F01**: Venda 900.000 / redutor 400.000 / residencial novo — calcular em 01/01/2027 (→ 18.420), 01/01/2029 (→ 22.160) e 15/06/2033 (→ 55.820); os valores têm de bater com a coluna Período da projeção. 31/12/2025 tem de bloquear (E017).
- **F02**: com imóvel de aquisição 300.000 (fator 1,4523) e referência 480.000, abrir Venda pelo MENU lateral com o campo divergente: o aviso com a origem e o botão "Usar … do imóvel" tem de aparecer; nada é sobrescrito sem o clique.
- **F03**: em sessão nova, abrir Auditoria e parecer antes de calcular: estado vazio ("Ainda não há cálculo de Venda"), sem pacote.
- **F04**: Venda 300.000 / redutor 400.000: etapa 2 mostra utilizado 300.000 (disponível 400.000 · remanescente 100.000) e a igualdade da base fecha em zero.
- **F05**: inspecionar `v-val`/`v-raj`: `label[for]` presente e `aria-describedby` apontando para a ajuda.
- **F06**: no achado A07 da Auditoria, a fonte cita a política metodológica (ruleset) e a Res. CGIBS 14/2026.
