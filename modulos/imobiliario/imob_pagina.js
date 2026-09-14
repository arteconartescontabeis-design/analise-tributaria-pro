/* ============================================================================
 * imob_pagina.js — a MARCAÇÃO da aba, injetada pelo próprio módulo.
 * v1.3.0 — cadastro ampliado, locação e permuta completas, premissas
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
  <div class="tab on" data-t="imovel" role="tab">&#127970; Im&oacute;vel e redutor</div>
  <div class="tab" data-t="inventario" role="tab">&#128203; Invent&aacute;rio 2026</div>
  <div class="tab" data-t="venda" role="tab">&#128176; Venda</div>
  <div class="tab" data-t="locacao" role="tab">&#128273; Loca&ccedil;&atilde;o</div>
  <div class="tab" data-t="permuta" role="tab">&#128260; Permuta</div>
  <div class="tab" data-t="opcional" role="tab">&#9878;&#65039; Regimes opcionais</div>
  <div class="tab" data-t="comparativo" role="tab">&#128202; Comparativo e proje&ccedil;&atilde;o</div>
  <div class="tab" data-t="pf" role="tab">&#128100; Pessoa f&iacute;sica</div>
  <div class="tab" data-t="auditoria" role="tab">&#128269; Auditoria e parecer</div>
  <div class="tab" data-t="historico" role="tab">&#128451;&#65039; Hist&oacute;rico</div>
  <div class="tab" data-t="regras" role="tab">&#128220; Regras e fontes</div>
  <div class="tab" data-t="premissas" role="tab">&#9881;&#65039; Premissas</div>
</div>
<div id="imob-erro-aba" style="display:none"></div>

<!-- ========================= IM&Oacute;VEL ========================= -->
<div id="t-imovel">
 <div class="card"><h2>Cadastro do im&oacute;vel</h2>
  <div class="mini" style="margin-bottom:10px"><span class="badge b-err">obrigat&oacute;rio</span> <span class="badge b-info">opcional</span> <span class="badge b-warn">conforme a opera&ccedil;&atilde;o</span> &mdash; passe o mouse sobre o r&oacute;tulo para ver quando o campo &eacute; exigido.</div>
  <h3 class="sec">Identifica&ccedil;&atilde;o</h3>
  <div class="grid g4">
   <div><label data-req="obrigatorio">C&oacute;digo interno</label><input id="i-cod" value="AP-1201"></div>
   <div><label data-req="opcional">Empresa propriet&aacute;ria</label><input id="i-emp" placeholder="raz&atilde;o social ou apelido"></div>
   <div><label data-req="opcional">Matr&iacute;cula</label><input id="i-mat" placeholder="n&uacute;mero e cart&oacute;rio"></div>
   <div><label data-req="obrigatorio">Tipo do im&oacute;vel</label><select id="i-tipo">
     <option value="residencial_novo">Residencial novo</option>
     <option value="lote_residencial">Lote residencial</option>
     <option value="comercial">Comercial</option>
     <option value="terreno">Terreno</option></select></div>
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
     <option value="pos2027">Adquirido a partir de 2027 (art. 375, III)</option></select></div>
  </div>
  <h3 class="sec">Datas e valores</h3>
  <div class="grid g4">
   <div><label data-req="condicional" title="Obrigat&oacute;ria na hip&oacute;tese III do art. 375">Data de aquisi&ccedil;&atilde;o</label><input id="i-daq" type="date"></div>
   <div><label data-req="condicional" title="Im&oacute;vel em constru&ccedil;&atilde;o">Data de conclus&atilde;o</label><input id="i-dcon" type="date"></div>
   <div><label data-req="condicional" title="Hip&oacute;teses I e III do art. 375 e im&oacute;vel em constru&ccedil;&atilde;o">Valor de aquisi&ccedil;&atilde;o</label><input id="i-aq" type="number" min="0" value="300000"></div>
   <div><label data-req="condicional" title="Im&oacute;vel em constru&ccedil;&atilde;o (art. 375, II, b)">Custos de constru&ccedil;&atilde;o at&eacute; 31/12/2026</label><input id="i-cst" type="number" min="0" value="0"></div>
  </div>
  <div class="grid g4" style="margin-top:12px">
   <div><label data-req="condicional" title="Op&ccedil;&atilde;o do art. 375, I, b">Valor de refer&ecirc;ncia (art. 366)</label><input id="i-ref" type="number" min="0" value="480000" placeholder="vazio = indispon&iacute;vel"></div>
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
</div>

<!-- ===================== INVENT&Aacute;RIO 2026 ===================== -->
<div id="t-inventario" style="display:none">
 <div class="card"><h2>Invent&aacute;rio Tribut&aacute;rio &mdash; posi&ccedil;&atilde;o em 31/12/2026</h2>
  <div class="info">O redutor de ajuste se constitui numa <b>data &uacute;nica</b> e a op&ccedil;&atilde;o do art. 375
   &eacute; <b>definitiva por im&oacute;vel</b>. O que n&atilde;o for inventariado at&eacute; l&aacute; simplesmente
   n&atilde;o gera redutor.</div>
  <div class="grid g4">
   <div><label>Data do invent&aacute;rio (data-base)</label><input id="iv-base" type="date"></div>
   <div><label>Data atual (autom&aacute;tica)</label><input id="iv-hoje" type="date" readonly></div>
   <div><label>Data limite</label><input id="iv-limite" type="text" value="31/12/2026" readonly></div>
   <div><label>Fator de atualiza&ccedil;&atilde;o at&eacute; 2026</label><input id="iv-fator" type="number" step="0.0001" min="0" value="1.4523"></div>
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
 <div class="card"><h2>Aliena&ccedil;&atilde;o</h2>
  <div class="grid g4">
   <div><label>Valor da opera&ccedil;&atilde;o</label><input id="v-val" type="number" min="0" value="900000"></div>
   <div><label>Tipo do im&oacute;vel</label><select id="v-tipo">
     <option value="residencial_novo">Residencial novo</option>
     <option value="lote_residencial">Lote residencial</option>
     <option value="comercial">Comercial</option>
     <option value="terreno">Terreno</option></select></div>
   <div><label>Saldo do redutor de ajuste</label><input id="v-raj" type="number" min="0" value="400000"></div>
   <div><label>Cr&eacute;ditos de IBS/CBS</label><input id="v-cre" type="number" min="0" value="0"></div>
  </div>
  <div class="grid g4" style="margin-top:14px">
   <div><label>Data do fato gerador</label><input id="v-data" type="date" value="2033-06-15"></div>
   <div><label>Redutor social j&aacute; usado?</label><select id="v-rsu"><option value="0">N&atilde;o</option><option value="1">Sim</option></select></div>
   <div><label>Pagamentos (separe por ;)</label><input id="v-pag" placeholder="ex.: 200000;100000;600000"></div>
   <div style="display:flex;align-items:flex-end;gap:8px"><button class="btn pri" style="flex:1" onclick="calcVenda()">Calcular</button><button class="btn" onclick="imobFinalizar()">Finalizar e gravar</button></div>
  </div>
  <div id="v-valid"></div>
 </div>
 <div id="v-out"></div>
</div>

<!-- ========================= LOCA&Ccedil;&Atilde;O ========================= -->
<div id="t-locacao" style="display:none">
 <div class="card"><h2>Loca&ccedil;&atilde;o, cess&atilde;o onerosa ou arrendamento</h2>
  <div class="grid g4">
   <div><label>Valor mensal do aluguel</label><input id="l-val" type="number" min="0" value="5000"></div>
   <div><label>Finalidade</label><select id="l-fim">
     <option value="residencial">Residencial</option><option value="nao_residencial">N&atilde;o residencial</option></select></div>
   <div><label>Quantidade de meses</label><input id="l-mes" type="number" min="1" step="1" value="1"></div>
   <div><label>Prazo do contrato (dias)</label><input id="l-prz" type="number" min="0" placeholder="vazio = longo prazo"></div>
  </div>
  <div class="grid g4" style="margin-top:14px">
   <div><label>Tributos e emolumentos (m&ecirc;s)</label><input id="l-trib" type="number" min="0" value="180"></div>
   <div><label>Condom&iacute;nio (m&ecirc;s)</label><input id="l-cond" type="number" min="0" value="850"></div>
   <div><label>Foro / taxa de ocupa&ccedil;&atilde;o (m&ecirc;s)</label><input id="l-foro" type="number" min="0" value="0"></div>
   <div><label>Prova de pagamento pelo locat&aacute;rio (&sect;4&ordm;)</label><select id="l-prova"><option value="1">Sim</option><option value="0">N&atilde;o</option></select></div>
  </div>
  <div class="grid g4" style="margin-top:14px">
   <div><label>Dias no m&ecirc;s (per&iacute;odo parcial)</label><input id="l-dias" type="number" min="0" max="31" placeholder="vazio = m&ecirc;s cheio"></div>
   <div><label>Fra&ccedil;&atilde;o de &aacute;rea residencial</label><input id="l-area" type="number" step="0.01" min="0" max="1" placeholder="vazio = 100%"></div>
   <div><label>Cr&eacute;ditos de IBS/CBS permitidos</label><input id="l-cre" type="number" min="0" value="0"></div>
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
 <div class="card"><h2>Permuta entre bens im&oacute;veis &mdash; art. 360, &sect;&sect; 3&ordm; a 9&ordm;</h2>
  <div class="grid g4">
   <div><label>Valor do im&oacute;vel dado</label><input id="x-val" type="number" min="0" value="1000000"></div>
   <div><label>Valor do im&oacute;vel recebido</label><input id="x-rec" type="number" min="0" placeholder="vazio = igual ao dado"></div>
   <div><label>Identifica&ccedil;&atilde;o da contraparte</label><input id="x-nome" placeholder="nome / CNPJ / CPF"></div>
   <div><label>Contraparte</label><select id="x-parte">
     <option value="contribuinte">Contribuinte do regime regular</option>
     <option value="nao_contribuinte">N&atilde;o contribuinte</option></select></div>
  </div>
  <div class="grid g4" style="margin-top:14px">
   <div><label>Torna PAGA por mim (contribuinte)</label><input id="x-tpaga" type="number" min="0" value="0"></div>
   <div><label>Torna RECEBIDA por mim</label><input id="x-trec" type="number" min="0" value="0"></div>
   <div><label>Redutor de ajuste do im&oacute;vel dado</label><input id="x-raj" type="number" min="0" value="400000"></div>
   <div><label>Cr&eacute;ditos de IBS/CBS</label><input id="x-cre" type="number" min="0" value="0"></div>
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
 <div class="card"><h2>Regimes opcionais de transi&ccedil;&atilde;o</h2>
  <div class="grid g4">
   <div><label>Regime</label><select id="o-reg" onchange="pintaOpc()">
     <option value="ret">RET &mdash; incorpora&ccedil;&atilde;o (art. 461)</option>
     <option value="loteamento">Parcelamento do solo (art. 462)</option>
     <option value="locacao_transitoria">Loca&ccedil;&atilde;o &mdash; contrato antigo (art. 463)</option></select></div>
   <div><label>Receita da opera&ccedil;&atilde;o</label><input id="o-val" type="number" min="0" value="1000000"></div>
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
 <div class="card"><h2>Tributa&ccedil;&atilde;o atual &times; regime espec&iacute;fico de bens im&oacute;veis</h2>
  <div class="info">IRPJ e CSLL <b>permanecem</b> nos dois cen&aacute;rios e s&atilde;o computados dos dois lados.
   O que muda &eacute; a troca de PIS, COFINS e ISS por IBS e CBS.</div>
  <div class="grid g4">
   <div><label>Receita de venda no per&iacute;odo</label><input id="c-rv" type="number" min="0" value="900000"></div>
   <div><label>Receita de loca&ccedil;&atilde;o</label><input id="c-rl" type="number" min="0" value="0"></div>
   <div><label>Receita de servi&ccedil;os</label><input id="c-rs" type="number" min="0" value="0"></div>
   <div><label>Meses do per&iacute;odo</label><input id="c-me" type="number" min="1" value="3"></div>
  </div>
  <div class="grid g4" style="margin-top:14px">
   <div><label>Atividade imobili&aacute;ria no objeto social?</label><select id="c-obj"><option value="1">Sim</option><option value="0">N&atilde;o</option></select></div>
   <div><label>Redutor de ajuste dispon&iacute;vel</label><input id="c-raj" type="number" min="0" value="400000"></div>
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
 <div class="card"><h2>Enquadramento da pessoa f&iacute;sica &mdash; art. 382 (LC 214, art. 251)</h2>
  <div class="grid g4">
   <div><label>Receita de loca&ccedil;&atilde;o (ano anterior)</label><input id="p-rec" type="number" min="0" value="300000"></div>
   <div><label>Receita de loca&ccedil;&atilde;o (ano corrente)</label><input id="p-recc" type="number" min="0" value="0"></div>
   <div><label>Im&oacute;veis locados distintos</label><input id="p-qtd" type="number" min="0" step="1" value="5"></div>
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

<!-- ===================== AUDITORIA E PARECER ===================== -->
<div id="t-auditoria" style="display:none">
 <div class="card"><h2>Auditoria do &uacute;ltimo c&aacute;lculo e relat&oacute;rios</h2>
  <div class="mini">Roda sobre o cen&aacute;rio da aba Venda. Calcule l&aacute; e volte aqui.</div>
  <div class="toolbar" style="margin-top:12px">
   <button class="btn pri" onclick="rodarAuditoria()">Auditar e montar o pacote do parecer</button>
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
