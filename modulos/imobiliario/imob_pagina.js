/* ============================================================================
 * imob_pagina.js — a MARCAÇÃO da aba, injetada pelo próprio módulo.
 * v1.5.0 — textos de ajuda por campo reposicionados junto do campo certo (estavam agrupados na célula errada); v1.4.0 — cadastro PF/PJ, fluxo guiado, memória, ajudas para leigos; v1.3.0 — cadastro ampliado, locação e permuta completas, premissas
 * editáveis, histórico com filtros/comparação e indicador de carregamento.
 * ==========================================================================*/
(function (raiz) {
  'use strict';
  var HTML = `<div id="page-imobiliaria" style="display:none">
<div class="page-title">
  <h1>&#127968; An&aacute;lise Imobili&aacute;ria</h1>
  <span class="crumb">Regime espec&iacute;fico de bens im&oacute;veis &middot; LC 214/2025 arts. 251-270 &middot; RIBS/RCBS arts. 359-390
    <span id="imob-carregando" class="carregando" style="display:none">&#8987; processando&hellip;</span></span>
</div>

<div class="tabs" id="imob-tabs" role="tablist">
  <div class="tab on" data-t="cadastro" role="tab">&#128100; 1. Cadastro (PF ou PJ)</div>
  <div class="tab" data-t="imovel" role="tab">&#127970; 2. Im&oacute;vel</div>
  <div class="tab" data-t="inventario" role="tab">&#128203; Invent&aacute;rio 2026</div>
  <div class="tab" data-t="venda" role="tab">&#128176; Venda</div>
  <div class="tab" data-t="locacao" role="tab">&#128273; Loca&ccedil;&atilde;o</div>
  <div class="tab" data-t="permuta" role="tab">&#128260; Permuta</div>
  <div class="tab" data-t="opcional" role="tab">&#9878;&#65039; Regimes opcionais</div>
  <div class="tab" data-t="comparativo" role="tab">&#128202; Comparativo e proje&ccedil;&atilde;o</div>
  <div class="tab" data-t="pf" role="tab">&#128100; Pessoa f&iacute;sica</div>
  <div class="tab" data-t="memoria" role="tab">&#129518; Mem&oacute;ria de c&aacute;lculo</div>
  <div class="tab" data-t="auditoria" role="tab">&#128269; Auditoria e parecer</div>
  <div class="tab" data-t="historico" role="tab">&#128451;&#65039; Hist&oacute;rico</div>
  <div class="tab" data-t="regras" role="tab">&#128220; Regras e fontes</div>
  <div class="tab" data-t="premissas" role="tab">&#9881;&#65039; Premissas</div>
</div>
<div id="imob-erro-aba" style="display:none"></div>

<!-- ========================= CADASTRO PF/PJ ========================= -->
<div id="t-cadastro">
 <div class="card"><h2>Passo 1 &mdash; Quem &eacute; o dono do im&oacute;vel?</h2>
  <div class="ajuda"><b>Por que isso importa:</b> a Reforma Tribut&aacute;ria trata de forma diferente a <b>pessoa f&iacute;sica</b> (s&oacute; paga IBS/CBS sobre im&oacute;veis se passar de certos limites de aluguel ou de n&uacute;mero de vendas) e a <b>empresa</b> (paga sempre, com redu&ccedil;&otilde;es). O regime da empresa (Lucro Presumido, Real ou Simples) define como &eacute; a tributa&ccedil;&atilde;o de hoje, usada na compara&ccedil;&atilde;o.</div>
  <div class="grid g4">
   <div><label data-req="obrigatorio">Tipo de pessoa</label><select id="cd-tipo" onchange="imobCadastroTipo()"><option value="PJ">Pessoa jur&iacute;dica (empresa)</option><option value="PF">Pessoa f&iacute;sica</option></select><small class="ajuda-campo">Empresa ou pessoa em nome pr&oacute;prio.</small></div>
   <div><label data-req="obrigatorio">Nome / raz&atilde;o social</label><input id="cd-nome" placeholder="ex.: Incorporadora Exemplo Ltda"></div>
   <div><label data-req="obrigatorio">CPF / CNPJ</label><input id="cd-doc" placeholder="s&oacute; n&uacute;meros"><small class="ajuda-campo">Aparece nos relat&oacute;rios.</small></div>
   <div id="cd-regime-box"><label data-req="obrigatorio">Regime tribut&aacute;rio atual</label><select id="cd-regime"><option value="presumido">Lucro Presumido</option><option value="real">Lucro Real</option><option value="simples">Simples Nacional</option></select><small class="ajuda-campo">Como a empresa paga imposto hoje. O comparativo usa o Lucro Presumido como refer&ecirc;ncia.</small></div>
  </div>
  <div class="grid g4" style="margin-top:12px">
   <div id="cd-obj-box"><label>A atividade imobili&aacute;ria est&aacute; no objeto social?</label><select id="cd-obj"><option value="1">Sim</option><option value="0">N&atilde;o</option></select><small class="ajuda-campo">Se a empresa foi criada para vender/alugar im&oacute;veis, a venda &eacute; receita normal; se n&atilde;o, &eacute; ganho de capital (tributa&ccedil;&atilde;o atual diferente).</small></div>
   <div><label data-req="opcional">E-mail</label><input id="cd-email" type="email"></div>
   <div><label data-req="opcional">Telefone</label><input id="cd-fone"></div>
   <div><label data-req="opcional">Munic&iacute;pio / UF</label><input id="cd-mun" placeholder="ex.: Palho&ccedil;a/SC"></div>
  </div>
  <div id="cd-valid"></div>
  <div class="toolbar" style="margin-top:14px">
   <button class="btn pri" onclick="imobSalvarCadastro()">Salvar e ir para o im&oacute;vel &rarr;</button>
   <button class="btn" onclick="imobLimparCadastro()">Limpar</button>
  </div>
 </div>
 <div id="cd-out"></div>
</div>

<!-- ========================= IM&Oacute;VEL ========================= -->
<div id="t-imovel" style="display:none">
 <div class="card"><h2>Passo 2 &mdash; Cadastro do im&oacute;vel</h2>
  <div class="ajuda"><b>Para que serve:</b> os dados do im&oacute;vel definem o <b>redutor de ajuste</b> &mdash; um "desconto" na base do imposto que representa o valor que o im&oacute;vel j&aacute; tinha antes da Reforma (art. 375). Quanto maior o redutor, menor o IBS/CBS na venda. Voc&ecirc; precisa escolher, at&eacute; 31/12/2026, se esse desconto ser&aacute; o <b>valor de aquisi&ccedil;&atilde;o atualizado</b> ou o <b>valor de refer&ecirc;ncia</b> (uma esp&eacute;cie de valor venal calculado pelo governo). A escolha &eacute; definitiva por im&oacute;vel.</div>
  <div class="mini" style="margin-bottom:10px"><span class="badge b-err">obrigat&oacute;rio</span> <span class="badge b-info">opcional</span> <span class="badge b-warn">conforme a opera&ccedil;&atilde;o</span> &mdash; passe o mouse sobre o r&oacute;tulo para ver quando o campo &eacute; exigido.</div>
  <h3 class="sec">Identifica&ccedil;&atilde;o</h3>
  <div class="grid g4">
   <div><label data-req="obrigatorio">C&oacute;digo interno</label><input id="i-cod" value="AP-1201"><small class="ajuda-campo">Seu identificador interno do im&oacute;vel.</small></div>
   <div><label data-req="opcional">Empresa propriet&aacute;ria</label><input id="i-emp" placeholder="raz&atilde;o social ou apelido"></div>
   <div><label data-req="opcional">Matr&iacute;cula</label><input id="i-mat" placeholder="n&uacute;mero e cart&oacute;rio"></div>
   <div><label data-req="obrigatorio">Tipo do im&oacute;vel</label><select id="i-tipo">
     <option value="residencial_novo">Residencial novo</option>
     <option value="lote_residencial">Lote residencial</option>
     <option value="comercial">Comercial</option>
     <option value="terreno">Terreno</option></select><small class="ajuda-campo">"Residencial novo" e "lote residencial" t&ecirc;m um desconto extra (redutor social).</small></div>
  </div>
  <div class="grid g4" style="margin-top:12px">
   <div><label data-req="opcional">Endere&ccedil;o</label><input id="i-end"></div>
   <div><label data-req="opcional">Munic&iacute;pio</label><input id="i-mun"></div>
   <div><label data-req="opcional">UF</label><input id="i-uf" maxlength="2" placeholder="SC"></div>
   <div><label data-req="opcional">Lote / unidade / bloco</label><input id="i-lote" placeholder="ex.: Lote 12 &middot; Un. 1201 &middot; Bl. B"></div>
  </div>
  <h3 class="sec">&Aacute;reas e fra&ccedil;&atilde;o</h3>
  <div class="grid g4">
   <div><label data-req="opcional">&Aacute;rea total (m&sup2;)</label><input id="i-atot" type="number" step="0.01" min="0"></div>
   <div><label data-req="opcional">&Aacute;rea constru&iacute;da (m&sup2;)</label><input id="i-acon" type="number" step="0.01" min="0"></div>
   <div><label data-req="condicional" title="Exigida na permuta por unidades futuras (art. 360, &sect;7&ordm;, II)">Fra&ccedil;&atilde;o ideal</label><input id="i-frac" type="number" step="0.0001" min="0" max="1" placeholder="ex.: 0,25"></div>
   <div><label data-req="obrigatorio">Situa&ccedil;&atilde;o em 31/12/2026</label><select id="i-sit">
     <option value="pronto">Pronto, do contribuinte</option>
     <option value="construcao">Em constru&ccedil;&atilde;o</option>
     <option value="pos2027">Adquirido a partir de 2027 (art. 375, III)</option></select><small class="ajuda-campo">Define qual regra do art. 375 vale para o redutor.</small></div>
  </div>
  <h3 class="sec">Datas e valores</h3>
  <div class="grid g4">
   <div><label data-req="condicional" title="Obrigat&oacute;ria na hip&oacute;tese III do art. 375">Data de aquisi&ccedil;&atilde;o</label><input id="i-daq" type="date"></div>
   <div><label data-req="condicional" title="Im&oacute;vel em constru&ccedil;&atilde;o">Data de conclus&atilde;o</label><input id="i-dcon" type="date"></div>
   <div><label data-req="condicional" title="Hip&oacute;teses I e III do art. 375 e im&oacute;vel em constru&ccedil;&atilde;o">Valor de aquisi&ccedil;&atilde;o</label><input id="i-aq" class="money" inputmode="decimal" value="300000"><small class="ajuda-campo">Quanto foi pago pelo im&oacute;vel (escritura). &Eacute; atualizado pelo fator at&eacute; 2026.</small></div>
   <div><label data-req="condicional" title="Im&oacute;vel em constru&ccedil;&atilde;o (art. 375, II, b)">Custos de constru&ccedil;&atilde;o at&eacute; 31/12/2026</label><input id="i-cst" class="money" inputmode="decimal" value="0"><small class="ajuda-campo">S&oacute; para im&oacute;vel em obra: gastos com materiais e servi&ccedil;os at&eacute; 31/12/2026.</small></div>
  </div>
  <div class="grid g4" style="margin-top:12px">
   <div><label data-req="condicional" title="Op&ccedil;&atilde;o do art. 375, I, b">Valor de refer&ecirc;ncia (art. 366)</label><input id="i-ref" class="money" inputmode="decimal" value="480000" placeholder="vazio = indispon&iacute;vel"><small class="ajuda-campo">Valor calculado pelo governo (art. 366). Deixe vazio se ainda n&atilde;o existir.</small></div>
   <div><label data-req="condicional" title="Quando houver valor de refer&ecirc;ncia">Origem do valor de refer&ecirc;ncia</label><select id="i-reforig"><option value="">&mdash;</option><option value="cgibs">Plataforma do CGIBS</option><option value="laudo">Laudo de avalia&ccedil;&atilde;o</option><option value="itbi">Base do ITBI</option><option value="outra">Outra</option></select></div>
   <div><label data-req="condicional" title="Quando houver valor de refer&ecirc;ncia">Data do valor de refer&ecirc;ncia</label><input id="i-refdata" type="date"></div>
   <div><label data-req="condicional" title="Hip&oacute;teses I e II do art. 375 (&sect;4&ordm;)">Fator de atualiza&ccedil;&atilde;o at&eacute; 2026</label><input id="i-fat" type="number" step="0.0001" min="0" value="1.4523"></div>
  </div>
  <h3 class="sec">Documentos e observa&ccedil;&otilde;es</h3>
  <div class="grid g2">
   <div><label data-req="opcional">Documentos relacionados</label><textarea id="i-doc" rows="2" placeholder="matr&iacute;cula, escritura, contrato, habite-se, laudo&hellip;"></textarea></div>
   <div><label data-req="opcional">Observa&ccedil;&otilde;es t&eacute;cnicas</label><textarea id="i-obs" rows="2"></textarea></div>
  </div>
  <div id="i-valid"></div>
  <div class="toolbar" style="margin-top:14px">
   <button class="btn pri" onclick="calcRaj()">Calcular op&ccedil;&otilde;es do art. 375</button>
   <button class="btn" onclick="imobLimparImovel()">Limpar cadastro</button>
  </div>
 </div>
 <div id="raj-out"></div>
 <div id="fluxo-out"></div>
</div>

<!-- ===================== INVENT&Aacute;RIO 2026 ===================== -->
<div id="t-inventario" style="display:none">
 <div class="card"><h2>Invent&aacute;rio Tribut&aacute;rio &mdash; posi&ccedil;&atilde;o em 31/12/2026</h2>
  <div class="info">O redutor de ajuste se constitui numa <b>data &uacute;nica</b> e a op&ccedil;&atilde;o do art. 375
   &eacute; <b>definitiva por im&oacute;vel</b>. O que n&atilde;o for inventariado at&eacute; l&aacute; simplesmente
   n&atilde;o gera redutor.</div>
  <div class="grid g4">
   <div><label>Data do invent&aacute;rio (data-base)</label><input id="iv-base" type="date"><small class="ajuda-campo">Data em que voc&ecirc; est&aacute; levantando a carteira (fica no relat&oacute;rio).</small></div>
   <div><label>Data atual (autom&aacute;tica)</label><input id="iv-hoje" type="date" readonly></div>
   <div><label>Data limite</label><input id="iv-limite" type="text" value="31/12/2026" readonly></div>
   <div><label>Fator de atualiza&ccedil;&atilde;o at&eacute; 2026</label><input id="iv-fator" type="number" step="0.0001" min="0" value="1.4523"><small class="ajuda-campo">Corrige o valor de aquisi&ccedil;&atilde;o pela infla&ccedil;&atilde;o at&eacute; 2026 (1 = sem corre&ccedil;&atilde;o).</small></div>
  </div>
  <div id="iv-prazo" class="prazo" style="margin-top:12px"></div>
  <div class="toolbar" style="margin-top:12px">
   <button class="btn pri" onclick="imobInventario()">Levantar carteira</button>
   <button class="btn" onclick="imobInventarioExemplo()">Usar carteira de exemplo</button>
  </div>
 </div>
 <div id="iv-out"></div>
</div>

<!-- ========================= VENDA ========================= -->
<div id="t-venda" style="display:none">
 <div class="card"><h2>Venda do im&oacute;vel</h2><div class="ajuda"><b>Como funciona:</b> na venda, o IBS e a CBS incidem sobre o pre&ccedil;o <b>menos</b> o redutor de ajuste (valor que o im&oacute;vel j&aacute; tinha) e <b>menos</b> o redutor social (R$ 100 mil no residencial novo, R$ 30 mil no lote). Sobre o que sobra aplica-se a al&iacute;quota com <b>50% de desconto</b>. Cr&eacute;ditos de compras podem abater o valor final. IRPJ e CSLL continuam existindo e n&atilde;o entram aqui.</div>
  <div class="grid g4">
   <div><label>Valor da opera&ccedil;&atilde;o</label><input id="v-val" class="money" inputmode="decimal" value="900000"><small class="ajuda-campo">Pre&ccedil;o de venda combinado.</small></div>
   <div><label>Tipo do im&oacute;vel</label><select id="v-tipo">
     <option value="residencial_novo">Residencial novo</option>
     <option value="lote_residencial">Lote residencial</option>
     <option value="comercial">Comercial</option>
     <option value="terreno">Terreno</option></select></div>
   <div><label>Saldo do redutor de ajuste</label><input id="v-raj" class="money" inputmode="decimal" value="400000"><small class="ajuda-campo">Desconto do art. 375 calculado no Passo 2 (preenchido automaticamente).</small></div>
   <div><label>Cr&eacute;ditos de IBS/CBS</label><input id="v-cre" class="money" inputmode="decimal" value="0"><small class="ajuda-campo">IBS/CBS pagos nas compras da empresa que podem abater o imposto da venda.</small></div>
  </div>
  <div class="grid g4" style="margin-top:14px">
   <div><label>Data do fato gerador</label><input id="v-data" type="date" value="2033-06-15"><small class="ajuda-campo">Dia da venda. O ano define a al&iacute;quota (a Reforma entra aos poucos at&eacute; 2033).</small></div>
   <div><label>Redutor social j&aacute; usado?</label><select id="v-rsu"><option value="0">N&atilde;o</option><option value="1">Sim</option></select></div>
   <div><label>Pagamentos (separe por ;)</label><input id="v-pag" placeholder="ex.: 200000;100000;600000"><small class="ajuda-campo">Se a venda for parcelada, o imposto &eacute; devido a cada pagamento.</small></div>
   <div style="display:flex;align-items:flex-end;gap:8px"><button class="btn pri" style="flex:1" onclick="calcVenda()">Calcular</button><button class="btn" onclick="imobFinalizar()">Finalizar e gravar</button></div>
  </div>
  <div id="v-valid"></div>
 </div>
 <div id="v-out"></div>
</div>

<!-- ========================= LOCA&Ccedil;&Atilde;O ========================= -->
<div id="t-locacao" style="display:none">
 <div class="card"><h2>Aluguel (loca&ccedil;&atilde;o)</h2><div class="ajuda"><b>Como funciona:</b> o imposto incide sobre o aluguel recebido, descontando o que o inquilino paga de IPTU/condom&iacute;nio (com comprovante) e, no aluguel residencial, R$ 600 por m&ecirc;s. A al&iacute;quota tem <b>70% de desconto</b>. Aluguel residencial de temporada (at&eacute; 90 dias seguidos) segue a regra de hotel; se o prazo for curto, o sistema pede que voc&ecirc; classifique a opera&ccedil;&atilde;o antes de calcular.</div>
  <div class="grid g4">
   <div><label>Valor mensal do aluguel</label><input id="l-val" class="money" inputmode="decimal" value="5000"><small class="ajuda-campo">Aluguel mensal combinado.</small></div>
   <div><label>Finalidade</label><select id="l-fim">
     <option value="residencial">Residencial</option><option value="nao_residencial">N&atilde;o residencial</option></select><small class="ajuda-campo">Aluguel residencial tem desconto extra de R$ 600/m&ecirc;s e a redu&ccedil;&atilde;o &eacute; de 70% nos dois casos.</small></div>
   <div><label>Quantidade de meses</label><input id="l-mes" type="number" min="1" step="1" value="1"></div>
   <div><label>Prazo do contrato (dias)</label><input id="l-prz" type="number" min="0" placeholder="vazio = longo prazo"><small class="ajuda-campo">At&eacute; 90 dias em im&oacute;vel residencial: informe a classifica&ccedil;&atilde;o abaixo.</small></div>
  </div>
  <div class="grid g4" style="margin-top:14px" id="l-cls-wrap">
   <div><label>Classifica&ccedil;&atilde;o (prazo &le; 90 dias)</label><select id="l-cls"><option value="">&mdash; escolher &mdash;</option><option value="hospedagem">Hospedagem / temporada (regra de hotel)</option><option value="locacao_residencial">Loca&ccedil;&atilde;o residencial (n&atilde;o &eacute; temporada)</option></select><small class="ajuda-campo">Art. 253: loca&ccedil;&atilde;o residencial de at&eacute; 90 dias ininterruptos &eacute; tratada como hotelaria (sem R$ 600 e sem os 70%). A escolha &eacute; do respons&aacute;vel e fica na mem&oacute;ria.</small></div>
   <div style="grid-column:span 3"><label>Justificativa da classifica&ccedil;&atilde;o</label><input id="l-just" type="text" placeholder="ex.: contrato por prazo indeterminado com per&iacute;odo inicial de 60 dias; prorroga&ccedil;&atilde;o cont&iacute;nua sem interrup&ccedil;&atilde;o"><small class="ajuda-campo">Obrigat&oacute;ria quando classificar como loca&ccedil;&atilde;o residencial com prazo curto.</small></div>
  </div>
  <div class="grid g4" style="margin-top:14px">
   <div><label>Tributos e emolumentos (m&ecirc;s)</label><input id="l-trib" class="money" inputmode="decimal" value="180"><small class="ajuda-campo">IPTU, taxas e emolumentos pagos pelo inquilino: saem da base se houver comprovante.</small></div>
   <div><label>Condom&iacute;nio (m&ecirc;s)</label><input id="l-cond" class="money" inputmode="decimal" value="850"><small class="ajuda-campo">Condom&iacute;nio pago pelo inquilino: sai da base se houver comprovante.</small></div>
   <div><label>Foro / taxa de ocupa&ccedil;&atilde;o (m&ecirc;s)</label><input id="l-foro" class="money" inputmode="decimal" value="0"></div>
   <div><label>Prova de pagamento pelo locat&aacute;rio (&sect;4&ordm;)</label><select id="l-prova"><option value="1">Sim</option><option value="0">N&atilde;o</option></select></div>
  </div>
  <div class="grid g4" style="margin-top:14px">
   <div><label>Dias no m&ecirc;s (per&iacute;odo parcial)</label><input id="l-dias" type="number" min="0" max="31" placeholder="vazio = m&ecirc;s cheio"></div>
   <div><label>Fra&ccedil;&atilde;o de &aacute;rea residencial</label><input id="l-area" type="number" step="0.01" min="0" max="1" placeholder="vazio = 100%"></div>
   <div><label>Cr&eacute;ditos de IBS/CBS permitidos</label><input id="l-cre" class="money" inputmode="decimal" value="0"></div>
   <div><label>Data do fato gerador</label><input id="l-data" type="date" value="2033-06-15"></div>
  </div>
  <div class="grid g4" style="margin-top:14px">
   <div><label>Comparar residencial &times; n&atilde;o residencial</label><select id="l-cmp"><option value="1">Sim</option><option value="0">N&atilde;o</option></select></div>
   <div style="display:flex;align-items:flex-end"><button class="btn pri" style="width:100%" onclick="calcLoc()">Calcular</button></div>
  </div>
  <div id="l-valid"></div>
 </div>
 <div id="l-out"></div>
</div>

<!-- ========================= PERMUTA ========================= -->
<div id="t-permuta" style="display:none">
 <div class="card"><h2>Permuta (troca de im&oacute;veis)</h2><div class="ajuda"><b>Como funciona:</b> trocar um im&oacute;vel por outro <b>n&atilde;o paga</b> IBS/CBS. S&oacute; paga imposto a <b>torna</b> &mdash; o dinheiro que uma parte d&aacute; &agrave; outra para igualar os valores &mdash; com o mesmo desconto de 50% da venda. O redutor de ajuste do im&oacute;vel entregue passa para o im&oacute;vel recebido.</div>
  <div class="grid g4">
   <div><label>Valor do im&oacute;vel dado</label><input id="x-val" class="money" inputmode="decimal" value="1000000"><small class="ajuda-campo">Quanto vale o im&oacute;vel que voc&ecirc; entrega.</small></div>
   <div><label>Valor do im&oacute;vel recebido</label><input id="x-rec" class="money" inputmode="decimal" placeholder="vazio = igual ao dado"><small class="ajuda-campo">Quanto vale o im&oacute;vel que voc&ecirc; recebe.</small></div>
   <div><label>Identifica&ccedil;&atilde;o da contraparte</label><input id="x-nome" placeholder="nome / CNPJ / CPF"></div>
   <div><label>Contraparte</label><select id="x-parte">
     <option value="contribuinte">Contribuinte do regime regular</option>
     <option value="nao_contribuinte">N&atilde;o contribuinte</option></select></div>
  </div>
  <div class="grid g4" style="margin-top:14px">
   <div><label>Torna PAGA por mim (contribuinte)</label><input id="x-tpaga" class="money" inputmode="decimal" value="0"><small class="ajuda-campo">Dinheiro que VOC&Ecirc; paga para igualar os valores.</small></div>
   <div><label>Torna RECEBIDA por mim</label><input id="x-trec" class="money" inputmode="decimal" value="0"><small class="ajuda-campo">Dinheiro que voc&ecirc; RECEBE para igualar os valores. S&oacute; a torna paga imposto.</small></div>
   <div><label>Redutor de ajuste do im&oacute;vel dado</label><input id="x-raj" class="money" inputmode="decimal" value="400000"></div>
   <div><label>Cr&eacute;ditos de IBS/CBS</label><input id="x-cre" class="money" inputmode="decimal" value="0"></div>
  </div>
  <div class="grid g4" style="margin-top:14px">
   <div style="grid-column:span 2"><label>Torna paga em parcelas? (valores separados por ;)</label><input id="x-tparc" type="text" placeholder="ex.: 100000; 100000; 100000"><small class="ajuda-campo">Se a torna for paga aos poucos, o imposto &eacute; devido em cada pagamento (art. 380). A soma deve fechar com a torna.</small></div>
   <div><label>Torna quitada com financiamento?</label><select id="x-fin"><option value="0">N&atilde;o</option><option value="1">Sim</option></select><small class="ajuda-campo">Com financiamento o vendedor recebe de uma vez: imposto integral no recebimento.</small></div>
  </div>
  <div class="grid g4" style="margin-top:14px">
   <div><label>Unidades futuras a receber?</label><select id="x-uni"><option value="0">N&atilde;o</option><option value="1">Sim</option></select></div>
   <div><label>Quantidade de unidades futuras</label><input id="x-nuni" type="number" min="0" step="1" placeholder="ex.: 4"></div>
   <div><label>Fra&ccedil;&atilde;o ideal (se a construir)</label><input id="x-fr" type="number" step="0.01" min="0" max="1" placeholder="ex.: 0,20"></div>
   <div><label>Data do fato gerador</label><input id="x-data" type="date" value="2033-06-15"></div>
  </div>
  <div class="grid g4" style="margin-top:14px">
   <div><label>Contrapresta&ccedil;&atilde;o em dinheiro al&eacute;m da torna?</label><select id="x-din"><option value="0">N&atilde;o</option><option value="1">Sim</option></select></div>
   <div><label>Contrapresta&ccedil;&atilde;o diferente de im&oacute;vel e dinheiro?</label><select id="x-div"><option value="0">N&atilde;o</option><option value="1">Sim (&sect;4&ordm; &mdash; regime regular)</option></select></div>
   <div style="display:flex;align-items:flex-end"><button class="btn pri" style="width:100%" onclick="calcPerm()">Calcular</button></div>
  </div>
  <div id="x-valid"></div>
 </div>
 <div id="x-out"></div>
</div>

<!-- ===================== REGIMES OPCIONAIS ===================== -->
<div id="t-opcional" style="display:none">
 <div class="card"><h2>Regimes opcionais de transi&ccedil;&atilde;o</h2><div class="ajuda"><b>O que s&atilde;o:</b> para incorpora&ccedil;&otilde;es, loteamentos e contratos de aluguel antigos, a lei permite <b>optar</b> por pagar um percentual fixo sobre a receita (2,08%, 0,53% ou 3,65%) em vez do c&aacute;lculo normal. &Eacute; mais simples, mas a op&ccedil;&atilde;o &eacute; definitiva e abre m&atilde;o dos redutores e cr&eacute;ditos. Compare antes de decidir.</div>
  <div class="grid g4">
   <div><label>Regime</label><select id="o-reg" onchange="pintaOpc()">
     <option value="ret">RET &mdash; incorpora&ccedil;&atilde;o (art. 461)</option>
     <option value="loteamento">Parcelamento do solo (art. 462)</option>
     <option value="locacao_transitoria">Loca&ccedil;&atilde;o &mdash; contrato antigo (art. 463)</option></select></div>
   <div><label>Receita da opera&ccedil;&atilde;o</label><input id="o-val" class="money" inputmode="decimal" value="1000000"></div>
   <div><label>Data do fato gerador</label><input id="o-data" type="date" value="2030-01-15"></div>
   <div style="display:flex;align-items:flex-end"><button class="btn pri" style="width:100%" onclick="calcOpc()">Calcular e comparar</button></div>
  </div>
  <div id="o-campos" style="margin-top:14px"></div>
 </div>
 <div id="o-guia"></div>
 <div id="o-out"></div>
</div>

<!-- ===================== COMPARATIVO E PROJE&Ccedil;&Atilde;O ===================== -->
<div id="t-comparativo" style="display:none">
 <div class="card"><h2>Hoje &times; Reforma: quanto muda?</h2><div class="ajuda"><b>O que esta tela responde:</b> quanto a empresa paga <b>hoje</b> (PIS, COFINS e ISS, no Lucro Presumido) e quanto passar&aacute; a pagar de <b>IBS e CBS</b>, com a mesma receita. Mostra tamb&eacute;m a evolu&ccedil;&atilde;o ano a ano de 2026 a 2033, porque a Reforma entra em vigor gradualmente.</div>
  <div class="info">IRPJ e CSLL <b>permanecem</b> nos dois cen&aacute;rios e s&atilde;o computados dos dois lados.
   O que muda &eacute; a troca de PIS, COFINS e ISS por IBS e CBS.</div>
  <div class="grid g4">
   <div><label>Receita de venda no per&iacute;odo</label><input id="c-rv" class="money" inputmode="decimal" value="900000"><small class="ajuda-campo">Total de vendas de im&oacute;veis no per&iacute;odo.</small></div>
   <div><label>Receita de loca&ccedil;&atilde;o</label><input id="c-rl" class="money" inputmode="decimal" value="0"></div>
   <div><label>Receita de servi&ccedil;os</label><input id="c-rs" class="money" inputmode="decimal" value="0"></div>
   <div><label>Meses do per&iacute;odo</label><input id="c-me" type="number" min="1" value="3"><small class="ajuda-campo">Quantos meses a receita informada cobre.</small></div>
  </div>
  <div class="grid g4" style="margin-top:14px">
   <div><label>Atividade imobili&aacute;ria no objeto social?</label><select id="c-obj"><option value="">&mdash; confirmar &mdash;</option><option value="1">Sim</option><option value="0">N&atilde;o</option></select><small class="ajuda-campo">Sem confirma&ccedil;&atilde;o o Lucro Presumido n&atilde;o &eacute; aplicado &agrave; venda.</small></div>
   <div><label>Natureza da receita de venda</label><select id="c-nat"><option value="">&mdash; confirmar &mdash;</option><option value="operacional">Operacional (im&oacute;vel de estoque)</option><option value="ativo_nao_circulante">Ativo n&atilde;o circulante (ganho de capital)</option></select><small class="ajuda-campo">Im&oacute;vel do ativo n&atilde;o circulante &eacute; ganho de capital, n&atilde;o 8%/12%.</small></div>
   <div><label>Redutor de ajuste dispon&iacute;vel</label><input id="c-raj" class="money" inputmode="decimal" value="400000"></div>
   <div><label>Tipo do im&oacute;vel</label><select id="c-tipo">
     <option value="residencial_novo">Residencial novo</option><option value="comercial">Comercial</option>
     <option value="lote_residencial">Lote residencial</option></select></div>
   <div><label>ISS sobre servi&ccedil;os (%)</label><input id="c-iss" type="number" min="0" max="5" step="0.01" value="0"></div>
  </div>
  <div class="toolbar" style="margin-top:14px"><button class="btn pri" onclick="calcComp()">Comparar e projetar</button></div>
  <div id="c-valid"></div>
 </div>
 <div id="c-out"></div>
</div>

<!-- ========================= PESSOA F&Iacute;SICA ========================= -->
<div id="t-pf" style="display:none">
 <div class="card"><h2>Pessoa f&iacute;sica: precisa pagar IBS/CBS?</h2><div class="ajuda"><b>Regra geral:</b> a pessoa f&iacute;sica <b>n&atilde;o</b> paga IBS/CBS ao vender ou alugar seus im&oacute;veis. Passa a pagar se, no ano anterior, a receita de aluguel superou R$ 240 mil (atualizado) <b>e</b> tinha mais de 3 im&oacute;veis alugados, ou se vendeu mais de 3 im&oacute;veis, ou mais de 1 im&oacute;vel constru&iacute;do por ela mesma.</div>
  <div class="grid g4">
   <div><label>Receita de loca&ccedil;&atilde;o (ano anterior)</label><input id="p-rec" class="money" inputmode="decimal" value="300000"><small class="ajuda-campo">Soma dos alugu&eacute;is recebidos no ano passado.</small></div>
   <div><label>Receita de loca&ccedil;&atilde;o (ano corrente)</label><input id="p-recc" class="money" inputmode="decimal" value="0"></div>
   <div><label>Im&oacute;veis locados distintos</label><input id="p-qtd" type="number" min="0" step="1" value="5"><small class="ajuda-campo">Quantos im&oacute;veis diferentes voc&ecirc; alugou.</small></div>
   <div><label>Aliena&ccedil;&otilde;es no ano anterior</label><input id="p-ali" type="number" min="0" step="1" value="0"></div>
  </div>
  <div class="grid g4" style="margin-top:14px">
   <div><label>Constru&iacute;dos pelo pr&oacute;prio (ano anterior)</label><input id="p-con" type="number" min="0" step="1" value="0"></div>
   <div><label>Aliena&ccedil;&otilde;es no ano corrente</label><input id="p-alic" type="number" min="0" step="1" value="0"></div>
   <div><label>Constru&iacute;dos pelo pr&oacute;prio (corrente)</label><input id="p-conc" type="number" min="0" step="1" value="0"></div>
   <div><label>Fator IPCA do limite</label><input id="p-fat" type="number" step="0.0001" min="0" value="1.15"></div>
  </div>
  <div class="toolbar" style="margin-top:14px"><button class="btn pri" onclick="calcPF()">Avaliar</button></div>
  <div id="p-valid"></div>
 </div>
 <div id="p-out"></div>
</div>

<!-- ========================= MEM&Oacute;RIA ========================= -->
<div id="t-memoria" style="display:none">
 <div class="card"><h2>Mem&oacute;ria de c&aacute;lculo do &uacute;ltimo c&aacute;lculo</h2>
  <div class="ajuda">Aqui fica, linha por linha, <b>como o imposto foi calculado</b>: o valor de partida, cada desconto (redutores), a base, as al&iacute;quotas e o resultado &mdash; com a explica&ccedil;&atilde;o em palavras simples e o artigo de lei que sustenta cada passo. &Eacute; o documento para conferir e para anexar ao parecer.</div>
  <div class="toolbar"><button class="btn" onclick="imobMemoriaAba()">Atualizar</button></div>
 </div>
 <div id="mem-out"></div>
</div>

<!-- ===================== AUDITORIA E PARECER ===================== -->
<div id="t-auditoria" style="display:none">
 <div class="card"><h2>Auditoria do &uacute;ltimo c&aacute;lculo e relat&oacute;rios</h2>
  <div class="mini">Roda sobre o cen&aacute;rio da aba Venda. Calcule l&aacute; e volte aqui.</div>
  <div class="toolbar" style="margin-top:12px">
   <button class="btn pri" onclick="rodarAuditoria()">Auditar e montar o pacote do parecer</button>
   <button class="btn" onclick="imobRelatorio('simplificado')">&#128203; Resumo para o cliente</button>
   <button class="btn" onclick="imobRelatorio('executivo')">&#128196; Relat&oacute;rio executivo</button>
   <button class="btn" onclick="imobRelatorio('tecnico')">&#128203; Relat&oacute;rio t&eacute;cnico</button>
   <button class="btn" onclick="imobRelatorio('memoria')">&#129518; Mem&oacute;ria de c&aacute;lculo</button>
  </div>
 </div>
 <div id="au-out"></div>
</div>

<!-- ========================= HIST&Oacute;RICO ========================= -->
<div id="t-historico" style="display:none">
 <div class="card"><h2>Hist&oacute;rico de simula&ccedil;&otilde;es e c&aacute;lculos</h2>
  <div class="mini">Simula&ccedil;&otilde;es <span class="badge b-warn">preliminar</span> ficam neste navegador; c&aacute;lculos <span class="badge b-ok">final</span> s&atilde;o os snapshots imut&aacute;veis gravados em <code>atp_imob_calculos</code>.</div>
  <div class="grid g4" style="margin-top:12px">
   <div><label>Empresa</label><input id="h-emp" placeholder="cont&eacute;m&hellip;"></div>
   <div><label>Im&oacute;vel</label><input id="h-imo" placeholder="c&oacute;digo cont&eacute;m&hellip;"></div>
   <div><label>Tipo de opera&ccedil;&atilde;o</label><select id="h-op"><option value="">Todas</option><option value="venda">Venda</option><option value="locacao">Loca&ccedil;&atilde;o</option><option value="permuta">Permuta</option><option value="ret">RET</option><option value="loteamento">Loteamento</option><option value="locacao_transitoria">Loca&ccedil;&atilde;o transit&oacute;ria</option></select></div>
   <div><label>Status</label><select id="h-st"><option value="">Todos</option><option value="preliminar">Preliminar</option><option value="final">Final</option></select></div>
  </div>
  <div class="grid g4" style="margin-top:12px">
   <div><label>De</label><input id="h-de" type="date"></div>
   <div><label>At&eacute;</label><input id="h-ate" type="date"></div>
   <div style="display:flex;align-items:flex-end"><button class="btn pri" style="width:100%" onclick="imobHistorico()">Pesquisar</button></div>
   <div style="display:flex;align-items:flex-end;gap:8px"><button class="btn" style="flex:1" onclick="imobListarImoveis()">Im&oacute;veis</button><button class="btn" style="flex:1" onclick="imobExportarHistorico()">Exportar CSV</button></div>
  </div>
  <div class="mini" style="margin-top:8px">Marque duas linhas e clique em <b>Comparar</b> para ver o que mudou entre as vers&otilde;es.</div>
 </div>
 <div id="hi-out"></div>
</div>

<!-- ========================= REGRAS ========================= -->
<div id="t-regras" style="display:none"><div class="card"><h2>Regras do motor e fontes legais</h2><div id="r-out"></div></div></div>

<!-- ========================= PREMISSAS ========================= -->
<div id="t-premissas" style="display:none">
 <div class="card"><h2>Premissas do c&aacute;lculo</h2>
  <div class="info">Os valores autom&aacute;ticos s&atilde;o o padr&atilde;o. A altera&ccedil;&atilde;o manual &eacute; opcional, exige justificativa, atualiza o resultado imediatamente e fica marcada na mem&oacute;ria e nos relat&oacute;rios com o valor original ao lado do editado.</div>
  <div id="pr-out"></div>
 </div>
</div>
</div>`;

  function injetar() {
    var doc = raiz.document;
    if (!doc || !doc.getElementById) return false;
    if (doc.getElementById('page-imobiliaria')) return true;   // idempotente
    var caixa = doc.createElement('div');
    caixa.innerHTML = HTML;
    var pagina = caixa.firstElementChild;
    if (!pagina) return false;
    var antes = doc.getElementById('page-relatorios');
    var dentro = doc.getElementById('modulo-destino');
    if (antes && antes.parentNode) antes.parentNode.insertBefore(pagina, antes);
    else if (dentro) { dentro.appendChild(pagina); pagina.style.display = 'block'; }
    else if (doc.body) doc.body.appendChild(pagina);
    else return false;
    return true;
  }

  raiz.ImobPagina = { HTML: HTML, injetar: injetar, injetada: function () {
    return !!(raiz.document && raiz.document.getElementById &&
              raiz.document.getElementById('page-imobiliaria')); } };
  injetar();
})(typeof globalThis !== 'undefined' ? globalThis : this);
