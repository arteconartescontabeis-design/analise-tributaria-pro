# Instalação — Análise Imobiliária Pro v1.6.6

Reanálise P1: **validação dos relatórios contra o cálculo que os gerou**. Motor 1.4.0 e lacre `cd2c7359` INALTERADOS — nenhuma fórmula mudou.

**Onde publicar:** o app vive no repositório `tributario-fiscal` (pasta `imobiliario/`) — este repositório é o arquivo-fonte.

1. Subir de `modulos/imobiliario/` os 3 arquivos alterados (os demais 12, incluindo `imob_layout.js` e `imob_validacao.js` da v1.6.5, estão idênticos aos publicados — conferir pelo MANIFESTO):
   - `imob_relatorios.js` (1.2.0: `conferirRelatorio` — varredura de valores do documento contra o pacote, presença dos números centrais e da data, carimbo com snapshot e identificadores; data do fato gerador no cabeçalho de todos os documentos)
   - `ui_imobiliaria.js` (relatório só abre depois de aprovado na conferência; reprovado mostra os valores sem origem; pacote ganha `snapshot_hash`)
   - `imob_manifesto.js` (v**1.6.6**, motor 1.4.0, lacre `cd2c7359`, changelog)
2. No HTML do app publicado, trocar `?v=` dos `<script src>` para `?v=1.6.6`.
3. Subir `tests/` (run_imob_v160.js com 6 casos novos de anos de transição em locação e permuta; run_imob_ui.js com os testes P1a-P1c). Não há SQL.
4. Conferir: `node tests/run_imob_v160.js` → **119/119** · `npm i --no-save jsdom@24 && node tests/run_imob_ui.js` → **69/69** · na tela, badge v1.6.6 e selo `cd2c7359`.

Validação manual (critério de aceite do P1 da reanálise):

- Calcular Venda 900.000 / redutor 400.000 / 2033 e abrir os 4 relatórios: cada documento termina com o rodapé "Conferência automática do documento: N valor(es) conferidos contra o cálculo de origem · snapshot `…` · motor 1.4.0 · ruleset imob-2026.09.18 · lacre `cd2c7359` · app v1.6.6".
- O cabeçalho de TODOS os documentos (técnico e memória inclusive) mostra "fato gerador em 15/06/2033".
- A mesma conferência vale para locação e permuta.
- Garantia de reprovação: um documento com número sem origem no cálculo, ou sem total/base/valor/data, NÃO é emitido — a tela lista o que reprovou (testável só pela suíte, caso P1c).
