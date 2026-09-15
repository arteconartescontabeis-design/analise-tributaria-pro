/* ============================================================================
 * imob_validacao.js — validação ANTES do cálculo, por formulário.
 * v1.0.0 · módulo Análise Imobiliária Pro 1.3.0
 *
 * Cada função devolve { ok, erros:[{campo, msg}], avisos:[{campo,msg}] }.
 * `campo` é o id do input da tela, para o UI destacar o campo errado.
 * A mensagem diz O QUE está errado e COMO corrigir. Funções puras.
 * ==========================================================================*/
(function (raiz) {
  'use strict';
  var VERSAO = '1.1.0';   // 1.1.0: aceita valores formatados em R$

  function num(v) {
    if (v === '' || v == null) return null;
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    var t = String(v).replace(/R\$|\s/g, '');
    if (t === '' || t === '-') return null;
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');   // pt-BR: 1.234,56
    var x = parseFloat(t); return isFinite(x) && /^-?\d*\.?\d+$/.test(t) ? x : NaN;
  }
  function dataValida(s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + 'T00:00:00Z'); return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }
  function E(campo, msg) { return { campo: campo, msg: msg }; }
  function saida(erros, avisos) { return { ok: erros.length === 0, erros: erros, avisos: avisos || [] }; }

  function negativo(erros, campo, rotulo, v) {
    var x = num(v);
    if (x === null) return null;
    if (isNaN(x)) { erros.push(E(campo, rotulo + ': informe apenas números (use ponto ou vírgula para decimais).')); return NaN; }
    if (x < 0) erros.push(E(campo, rotulo + ' não pode ser negativo. Informe zero ou um valor positivo.'));
    return x;
  }
  function obrigatorio(erros, campo, rotulo, v, como) {
    var x = num(v);
    if (x === null || isNaN(x)) { erros.push(E(campo, rotulo + ' é obrigatório. ' + (como || 'Preencha o campo para calcular.'))); return null; }
    return x;
  }
  function data(erros, campo, rotulo, s, obrig) {
    if (!s) { if (obrig) erros.push(E(campo, rotulo + ' é obrigatória. Informe no formato dia/mês/ano.')); return null; }
    if (!dataValida(s)) { erros.push(E(campo, rotulo + ' inválida. Informe uma data real no formato dia/mês/ano.')); return null; }
    return s;
  }

  /* ---- Cadastro do imóvel (obrigatórios · opcionais · conforme operação) --- */
  var CAMPOS_IMOVEL = [
    { id: 'i-cod',   rotulo: 'Código interno',            classe: 'obrigatorio' },
    { id: 'i-emp',   rotulo: 'Empresa proprietária',      classe: 'opcional' },
    { id: 'i-mat',   rotulo: 'Matrícula',                 classe: 'opcional' },
    { id: 'i-end',   rotulo: 'Endereço',                  classe: 'opcional' },
    { id: 'i-mun',   rotulo: 'Município',                 classe: 'opcional' },
    { id: 'i-uf',    rotulo: 'UF',                        classe: 'opcional' },
    { id: 'i-tipo',  rotulo: 'Tipo do imóvel',            classe: 'obrigatorio' },
    { id: 'i-lote',  rotulo: 'Lote / unidade / bloco',    classe: 'opcional' },
    { id: 'i-atot',  rotulo: 'Área total (m²)',           classe: 'opcional' },
    { id: 'i-acon',  rotulo: 'Área construída (m²)',      classe: 'opcional' },
    { id: 'i-frac',  rotulo: 'Fração ideal',              classe: 'condicional', quando: 'permuta com unidades futuras' },
    { id: 'i-daq',   rotulo: 'Data de aquisição',         classe: 'condicional', quando: 'hipótese III do art. 375 (adquirido a partir de 2027)' },
    { id: 'i-dcon',  rotulo: 'Data de conclusão',         classe: 'condicional', quando: 'imóvel em construção' },
    { id: 'i-aq',    rotulo: 'Valor de aquisição',        classe: 'condicional', quando: 'hipóteses I e III do art. 375 e imóvel em construção' },
    { id: 'i-cst',   rotulo: 'Custos de construção até 31/12/2026', classe: 'condicional', quando: 'imóvel em construção (art. 375, II)' },
    { id: 'i-ref',   rotulo: 'Valor de referência',       classe: 'condicional', quando: 'opção do art. 375, I, "b"' },
    { id: 'i-reforig', rotulo: 'Origem do valor de referência', classe: 'condicional', quando: 'valor de referência informado' },
    { id: 'i-refdata', rotulo: 'Data do valor de referência', classe: 'condicional', quando: 'valor de referência informado' },
    { id: 'i-sit',   rotulo: 'Situação do imóvel',        classe: 'obrigatorio' },
    { id: 'i-doc',   rotulo: 'Documentos relacionados',   classe: 'opcional' },
    { id: 'i-obs',   rotulo: 'Observações técnicas',      classe: 'opcional' },
    { id: 'i-fat',   rotulo: 'Fator de atualização até 2026', classe: 'condicional', quando: 'hipóteses I e II do art. 375' }
  ];

  function validarImovel(f) {
    var erros = [], avisos = []; f = f || {};
    if (!f.codigo || !String(f.codigo).trim()) erros.push(E('i-cod', 'Código interno é obrigatório. Informe o identificador do imóvel no seu controle (ex.: AP-1201).'));
    if (!f.tipo) erros.push(E('i-tipo', 'Tipo do imóvel é obrigatório. Escolha residencial novo, lote residencial, comercial ou terreno.'));
    var sit = f.situacao || 'pronto';
    var aq = negativo(erros, 'i-aq', 'Valor de aquisição', f.valor_aquisicao);
    var ref = negativo(erros, 'i-ref', 'Valor de referência', f.valor_referencia);
    var cst = negativo(erros, 'i-cst', 'Custos de construção', f.custos);
    negativo(erros, 'i-atot', 'Área total', f.area_total);
    negativo(erros, 'i-acon', 'Área construída', f.area_construida);
    var fr = negativo(erros, 'i-frac', 'Fração ideal', f.fracao_ideal);
    if (typeof fr === 'number' && fr > 1) erros.push(E('i-frac', 'Fração ideal deve ficar entre 0 e 1 (ex.: 0,25 para 25%).'));
    var fat = num(f.fator);
    if (sit !== 'pos2027') {
      if (fat === null || isNaN(fat)) erros.push(E('i-fat', 'Informe o fator de atualização até 31/12/2026 (art. 375, §4º) — ex.: 1,4523.'));
      else if (fat <= 0) erros.push(E('i-fat', 'Fator de atualização não pode ser zero ou negativo. Informe um fator positivo (1 = sem atualização).'));
    }
    if (sit === 'pronto' || sit === 'pos2027') {
      if (aq === null || (typeof aq === 'number' && !(aq > 0))) erros.push(E('i-aq', 'Informe o valor de aquisição do imóvel para calcular a hipótese ' + (sit === 'pronto' ? 'I' : 'III') + ' do art. 375.'));
    }
    if (sit === 'pronto' && (ref === null || !(ref > 0)))
      avisos.push(E('i-ref', 'Sem valor de referência, a opção do art. 375, I, "b" fica indisponível — só a aquisição atualizada será apresentada. Informe o valor de referência do imóvel para calcular a hipótese prevista no art. 375.'));
    if (sit === 'construcao') {
      if (aq === null || !(aq > 0)) erros.push(E('i-aq', 'Imóvel em construção: informe o valor de aquisição do terreno (art. 375, II, "a").'));
      if (cst === null) erros.push(E('i-cst', 'Imóvel em construção: informe os custos de bens e serviços até 31/12/2026, ainda que zero (art. 375, II, "b").'));
    }
    if (sit === 'pos2027') {
      if (!data(erros, 'i-daq', 'Data de aquisição', f.data_aquisicao, true)) { /* já registrado */ }
      else if (f.data_aquisicao < '2027-01-01') erros.push(E('i-daq', 'Hipótese III do art. 375 exige aquisição a partir de 01/01/2027. Para aquisições anteriores use a situação "Pronto, do contribuinte".'));
    } else data(erros, 'i-daq', 'Data de aquisição', f.data_aquisicao, false);
    data(erros, 'i-dcon', 'Data de conclusão', f.data_conclusao, false);
    if (typeof ref === 'number' && ref > 0) {
      if (!f.ref_origem) avisos.push(E('i-reforig', 'Informe a origem do valor de referência (ex.: plataforma do CGIBS, laudo, ITBI) para a trilha de auditoria.'));
      data(erros, 'i-refdata', 'Data do valor de referência', f.ref_data, false);
    }
    if (f.uf && !/^[A-Z]{2}$/i.test(String(f.uf).trim())) erros.push(E('i-uf', 'UF deve ter 2 letras (ex.: SC).'));
    return saida(erros, avisos);
  }

  /* ---- Venda ------------------------------------------------------------- */
  function validarVenda(f) {
    var erros = [], avisos = []; f = f || {};
    var val = obrigatorio(erros, 'v-val', 'Valor da operação', f.valor, 'Informe o preço de venda do imóvel.');
    if (typeof val === 'number' && val <= 0) erros.push(E('v-val', 'Valor da operação deve ser maior que zero. Informe o preço de venda.'));
    negativo(erros, 'v-raj', 'Saldo do redutor de ajuste', f.redutor);
    negativo(erros, 'v-cre', 'Créditos de IBS/CBS', f.creditos);
    data(erros, 'v-data', 'Data do fato gerador', f.data, true);
    if (!f.tipo) erros.push(E('v-tipo', 'Escolha o tipo do imóvel — ele define o redutor social aplicável.'));
    if (f.pagamentos) {
      var partes = String(f.pagamentos).split(';').map(function (x) { return x.trim(); }).filter(Boolean);
      var soma = 0, ruim = false;
      partes.forEach(function (p) { var x = num(p); if (x === null || isNaN(x) || x < 0) ruim = true; else soma += x; });
      if (ruim) erros.push(E('v-pag', 'Pagamentos: use apenas números positivos separados por ponto e vírgula (ex.: 200000;100000;600000).'));
      else if (typeof val === 'number' && Math.abs(soma - val) > 0.02)
        avisos.push(E('v-pag', 'A soma dos pagamentos (' + soma.toFixed(2) + ') não fecha com o valor da operação (' + val.toFixed(2) + '). Ajuste as parcelas ou o valor.'));
    }
    return saida(erros, avisos);
  }

  /* ---- Locação ----------------------------------------------------------- */
  function validarLocacao(f) {
    var erros = [], avisos = []; f = f || {};
    var val = obrigatorio(erros, 'l-val', 'Valor mensal do aluguel', f.valor, 'Informe o aluguel mensal.');
    if (typeof val === 'number' && val <= 0) erros.push(E('l-val', 'Valor mensal do aluguel deve ser maior que zero.'));
    if (['residencial', 'nao_residencial'].indexOf(f.finalidade) < 0) erros.push(E('l-fim', 'Escolha a finalidade: residencial ou não residencial.'));
    var meses = num(f.meses);
    if (meses === null || isNaN(meses) || meses <= 0) erros.push(E('l-mes', 'Quantidade de meses deve ser um inteiro maior que zero.'));
    else if (meses !== Math.floor(meses)) erros.push(E('l-mes', 'Quantidade de meses deve ser um número inteiro (períodos parciais vão em "dias no mês").'));
    var prz = negativo(erros, 'l-prz', 'Prazo do contrato', f.prazo_dias);
    var dias = negativo(erros, 'l-dias', 'Dias no mês', f.dias_no_mes);
    if (typeof dias === 'number' && dias > 31) erros.push(E('l-dias', 'Dias no mês não pode exceder 31. Para vários meses use o campo "meses".'));
    var area = negativo(erros, 'l-area', 'Fração de área residencial', f.fracao_area);
    if (typeof area === 'number' && area > 1) erros.push(E('l-area', 'Fração de área residencial deve ficar entre 0 e 1 (ex.: 0,6 para 60%).'));
    negativo(erros, 'l-trib', 'Tributos e emolumentos', f.tributos);
    negativo(erros, 'l-cond', 'Condomínio', f.condominio);
    negativo(erros, 'l-foro', 'Foro / taxa de ocupação', f.foro);
    negativo(erros, 'l-cre', 'Créditos de IBS/CBS', f.creditos);
    data(erros, 'l-data', 'Data do fato gerador', f.data, true);
    if (f.finalidade === 'residencial' && typeof prz === 'number' && prz > 0 && prz <= 90)
      avisos.push(E('l-prz', 'Locação residencial de até 90 dias segue as regras de hotelaria (art. 253): o motor vai bloquear este cenário de propósito.'));
    return saida(erros, avisos);
  }

  /* ---- Permuta ----------------------------------------------------------- */
  function validarPermuta(f) {
    var erros = [], avisos = []; f = f || {};
    var dado = obrigatorio(erros, 'x-val', 'Valor do imóvel dado', f.valor_dado, 'Informe o valor do imóvel entregue na permuta.');
    if (typeof dado === 'number' && dado <= 0) erros.push(E('x-val', 'Valor do imóvel dado deve ser maior que zero.'));
    var rec = negativo(erros, 'x-rec', 'Valor do imóvel recebido', f.valor_recebido);
    var tp = negativo(erros, 'x-tpaga', 'Torna paga', f.torna_paga);
    var tr = negativo(erros, 'x-trec', 'Torna recebida', f.torna_recebida);
    if (typeof tp === 'number' && typeof tr === 'number' && tp > 0 && tr > 0)
      erros.push(E('x-tpaga', 'Informe torna paga OU torna recebida, não as duas: na permuta a torna vai numa única direção.'));
    if (['contribuinte', 'nao_contribuinte'].indexOf(f.contraparte) < 0) erros.push(E('x-parte', 'Indique se a contraparte é contribuinte do regime regular.'));
    negativo(erros, 'x-raj', 'Redutor de ajuste do imóvel dado', f.redutor);
    negativo(erros, 'x-cre', 'Créditos de IBS/CBS', f.creditos);
    var uni = negativo(erros, 'x-nuni', 'Unidades futuras', f.unidades);
    var fr = negativo(erros, 'x-fr', 'Fração ideal', f.fracao_ideal);
    if (typeof fr === 'number' && fr > 1) erros.push(E('x-fr', 'Fração ideal deve ficar entre 0 e 1.'));
    if (f.unidades_futuras && (fr === null || !(fr > 0))) erros.push(E('x-fr', 'Permuta por unidades futuras: informe a fração ideal das unidades a receber (art. 360, §7º, II).'));
    if (f.unidades_futuras && (uni === null || !(uni >= 1))) erros.push(E('x-nuni', 'Permuta por unidades futuras: informe quantas unidades serão recebidas (mínimo 1).'));
    data(erros, 'x-data', 'Data do fato gerador', f.data, true);
    if (typeof dado === 'number' && typeof rec === 'number' && rec > 0) {
      var dif = Math.abs(dado - rec), torna = (tp || 0) + (tr || 0);
      if (dif > 0.02 && torna === 0) avisos.push(E('x-rec', 'Os imóveis têm valores diferentes (' + dif.toFixed(2) + ') e não há torna: confira se a diferença foi compensada de outra forma (§4º).'));
    }
    return saida(erros, avisos);
  }

  /* ---- Pessoa física ----------------------------------------------------- */
  function validarPF(f) {
    var erros = []; f = f || {};
    ['p-rec', 'p-qtd', 'p-ali', 'p-con', 'p-alic', 'p-conc', 'p-recc'].forEach(function (id) {
      var v = f[id]; var x = num(v);
      if (x === null) return;
      if (isNaN(x)) erros.push(E(id, 'Informe apenas números.'));
      else if (x < 0) erros.push(E(id, 'Valor negativo não é admitido — informe zero ou um valor positivo.'));
    });
    var fat = num(f['p-fat']);
    if (fat === null || isNaN(fat)) erros.push(E('p-fat', 'Informe o fator IPCA do limite (1 = sem atualização).'));
    else if (fat <= 0) erros.push(E('p-fat', 'Fator IPCA não pode ser zero ou negativo.'));
    return saida(erros, []);
  }

  /* ---- Comparativo ------------------------------------------------------- */
  function validarComparativo(f) {
    var erros = [], avisos = []; f = f || {};
    var rv = negativo(erros, 'c-rv', 'Receita de venda', f.receita_venda);
    var rl = negativo(erros, 'c-rl', 'Receita de locação', f.receita_locacao);
    var rs = negativo(erros, 'c-rs', 'Receita de serviços', f.receita_servicos);
    if (!((rv || 0) + (rl || 0) + (rs || 0) > 0)) erros.push(E('c-rv', 'Informe ao menos uma receita (venda, locação ou serviços) maior que zero.'));
    var me = num(f.meses);
    if (me === null || isNaN(me) || me <= 0) erros.push(E('c-me', 'Meses do período deve ser maior que zero.'));
    negativo(erros, 'c-raj', 'Redutor de ajuste', f.redutor);
    if ((rs || 0) > 0 && !(num(f.iss) > 0)) avisos.push(E('c-iss', 'Há receita de serviços com ISS em 0% — confirme a alíquota do município.'));
    return saida(erros, avisos);
  }

  var API = { VERSAO: VERSAO, CAMPOS_IMOVEL: CAMPOS_IMOVEL, dataValida: dataValida,
              validarImovel: validarImovel, validarVenda: validarVenda, validarLocacao: validarLocacao,
              validarPermuta: validarPermuta, validarPF: validarPF, validarComparativo: validarComparativo };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  raiz.ImobValidacao = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
