# Instalação — Análise Imobiliária Pro v1.6.5

Fecho das recomendações da REANÁLISE externa de 20/10/2026 sobre a v1.6.4 (F02-R e observações 3, 4 e 5). **Motor 1.4.0 e lacre `cd2c7359` INALTERADOS** — nenhuma fórmula de cálculo mudou; as mudanças são de interface, rastreabilidade da decisão e validação de formulário.

**Onde publicar:** o app vive no repositório `tributario-fiscal` (pasta `imobiliario/`) — este repositório é o arquivo-fonte. Copiar para lá os arquivos abaixo.

1. Subir de `modulos/imobiliario/` os 4 arquivos alterados (os demais 11, incluindo `motorImob.js` e `imob_relatorios.js`, estão idênticos aos publicados na v1.6.4 — conferir pelo MANIFESTO):
   - `ui_imobiliaria.js` (F02-R: cenário manual do redutor com ciência/justificativa; aviso no resultado; ressalva nos relatórios; bloqueio de parecer e finalização sem confirmação)
   - `imob_layout.js` (faixa da base honesta: sequência completa da locação; redutor transferido da permuta rotulado; `.seq` achada mesmo com aviso antes dela; VERSAO 1.6.5)
   - `imob_validacao.js` (1.2.0: texto não numérico em campo obrigatório → mensagem de formato)
   - `imob_manifesto.js` (v**1.6.5**, motor 1.4.0, lacre `cd2c7359`, changelog)
2. No HTML do app publicado, trocar `?v=` dos `<script src>` para `?v=1.6.5` (furar o cache do Pages).
3. Subir `tests/` (run_imob_ui.js com 6 casos novos e relatório gravado no fim; run_imob_v160.js inalterado nesta versão). Não há SQL — nenhuma tabela, política ou gatilho muda.
4. Conferir: `node tests/run_imob_v160.js` → **113/113** · `npm i --no-save jsdom@24 && node tests/run_imob_ui.js` → **66/66** · na tela, badge v1.6.5 e selo `cd2c7359`.

Validação manual (roteiro da reanálise):

- **F02-R**: com imóvel sugerindo 480.000 e campo em 400.000, calcular Venda: o resultado abre com o aviso "Cenário manual … NÃO CONFIRMADO"; "Gerar parecer com IA" e "Finalizar e gravar" bloqueiam com orientação. Registrar o motivo ao lado do campo ("Manter como cenário manual"): o aviso vira confirmação, o motivo aparece na etapa 2 do resultado, na memória e nas ressalvas dos relatórios, e o parecer é liberado. "Usar 480.000,00 do imóvel" desfaz a divergência e mantém a origem ao lado do campo.
- **Obs. 3**: locação 5.000/mês residencial com encargos comprovados 180+850: o cabeçalho do resultado mostra "Base de cálculo 3.370,00 = Receita bruta do período 5.000,00 − Deduções 1.030,00 − Redutor social da locação residencial 600,00".
- **Obs. 4**: permuta dado 1.000.000 / recebido 800.000 / torna recebida 200.000: o cabeçalho mostra "Parcela tributável 200.000,00 · Redutor de ajuste do imóvel recebido 400.000,00 (transferido — não é dedução desta base)" — sem subtração falsa.
- **Obs. 5**: digitar "abc" no valor da venda: a mensagem é de formato ("não é um número válido"), não de campo vazio.
