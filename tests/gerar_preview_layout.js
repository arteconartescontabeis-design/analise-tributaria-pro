/* Gera preview_layout_v150.html: o módulo REAL (motor, UI, página) com sessão simulada,
   dados de exemplo preenchidos e o alternador "Layout atual ⇄ Layout proposto". Sem login, sem Supabase. */
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), M = path.join(R, 'modulos/imobiliario');
const html = fs.readFileSync(path.join(R, 'imobiliaria.html'), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const js = f => fs.readFileSync(path.join(M, f), 'utf8');
const mods = ['imob_manifesto.js','imob_estilo.js','imob_pagina.js','motorImob.js','persistenciaImob.js','parecerImobIA.js','nucleoRastreio.js','imob_premissas.js','imob_validacao.js','imob_relatorios.js','imob_graficos.js','ui_imobiliaria.js','imob_layout.js'];
const out = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Análise Imobiliária — prévia do layout proposto (v1.5.0)</title>
<style>${css}
#pv-bar{position:fixed;top:0;left:0;right:0;z-index:50;background:#12405e;color:#fff;display:flex;align-items:center;gap:14px;padding:8px 18px;font-size:13px;box-shadow:0 2px 10px rgba(0,0,0,.3)}
#pv-bar b{font-family:'Playfair Display',serif;font-size:15px}
#pv-bar .sw{display:flex;border:1px solid rgba(255,255,255,.35);border-radius:20px;overflow:hidden}
#pv-bar .sw button{background:transparent;color:#fff;border:0;padding:6px 14px;font-size:13px;font-weight:600;cursor:pointer}
#pv-bar .sw button.on{background:#fff;color:#12405e}
#pv-bar .telas{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
#pv-bar .telas button{background:rgba(255,255,255,.12);color:#fff;border:0;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer}
#pv-bar .telas button:hover{background:rgba(255,255,255,.25)}
body{padding-top:46px}.sidebar{top:46px}
#page-imobiliaria.l2 .caso{top:46px}
</style></head><body>
<div id="pv-bar"><b>Prévia</b><span>Análise Imobiliária Pro · demonstração, nada é gravado</span>
 <div class="sw"><button id="sw-atual" onclick="pvLayout(false)">Resultado atual (v1.4.1)</button><button id="sw-novo" class="on" onclick="pvLayout(true)">Resultado proposto (v1.5.0)</button></div>
 <span style="margin-left:auto;opacity:.75">as telas do módulo ficam no menu da esquerda</span></div>
<div class="toast" id="toast"></div>
<div id="app" style="display:block">
  <div class="sidebar">
    <div class="brand"><b>🏢 Análise Imobiliária</b><br><span class="hint">Artecon · <span id="mod-versao-badge">v?</span></span></div>
    <div class="nav-item active" data-p="imob">🏢 <span>Análise Imobiliária</span></div>
    <div class="nav-item" data-p="modulo">🧩 <span>Sobre o módulo</span></div>
    <div class="nav-item">↩ <span>Análise Tributária</span></div>
    <div class="foot"><span id="user-email">teste.a@artecon.local</span><br><span class="sair">Sair</span></div>
  </div>
  <div class="main"><div id="sessao-aviso" style="display:none"></div><div id="modulo-destino"></div></div>
</div>
<script>
/* sessão simulada — o mesmo contrato da casca v1.4.1, sem rede */
const APP = { token:'x', user:{ id:'uuid-a', email:'teste.a@artecon.local' }, papel:'operador', escritorioId:7, usuarioId:101, sessao:'ok' }; window.APP = APP;
window.sessaoPronta = () => Promise.resolve({ escritorio_id: 7 });
const DB = { imoveis: [
  { id:'im-1', escritorio_id:7, codigo_interno:'AP-301', tipo:'residencial_novo', matricula:'45.678', municipio:'Palhoça', uf:'SC', valor_aquisicao:300000, valor_referencia:480000, data_aquisicao:'2021-03-10', raj_opcao_escolhida:null, raj_saldo:0, excluido_em:null },
  { id:'im-2', escritorio_id:7, codigo_interno:'SL-09', tipo:'comercial', municipio:'São José', uf:'SC', valor_aquisicao:900000, valor_referencia:820000, raj_opcao_escolhida:'aquisicao', raj_justificativa:'Aquisição atualizada supera a referência.', raj_saldo:1307070, excluido_em:null },
  { id:'im-3', escritorio_id:7, codigo_interno:'LT-14', tipo:'lote_residencial', municipio:'Palhoça', uf:'SC', excluido_em:null } ], calculos: [] };
window.supa = async (m, caminho, opts) => { const t = caminho.split('?')[0];
  if (t === 'atp_imob_imoveis' && m === 'GET') return DB.imoveis;
  if (t === 'atp_imob_imoveis' && m === 'POST') { const r = Object.assign({ id:'im-'+(DB.imoveis.length+1), excluido_em:null }, opts.body); DB.imoveis.push(r); return [r]; }
  if (t === 'atp_imob_calculos' && m === 'GET') return DB.calculos;
  if (t === 'atp_imob_calculos' && m === 'POST') { const r = Object.assign({ id:'cal-'+(DB.calculos.length+1), calculado_em:new Date().toISOString() }, opts.body[0] || opts.body); DB.calculos.push(r); return [r]; }
  return []; };
window.supaFn = undefined;
</script>
${mods.map(f => '<script>/* ' + f + ' */\n' + js(f) + '\n</script>').join('\n')}
<script>
(function(){ var b=document.getElementById('mod-versao-badge'), i=(window.ModulosInfo||{}).imobiliario; if(b&&i) b.textContent='v'+i.versao; })();
imobEntrar();
/* dados de exemplo para a demonstração */
const V = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
V('cd-tipo','PJ'); V('cd-nome','Construtora Horizonte Ltda'); V('cd-doc','23.456.789/0001-01'); V('cd-regime','presumido'); V('cd-obj','1'); V('cd-mun','Palhoça/SC');
V('i-cod','SL-1204'); V('i-emp','Construtora Horizonte Ltda'); V('i-mat','88.120 · 2º RI São José'); V('i-tipo','comercial'); V('i-mun','São José'); V('i-uf','SC'); V('i-atot','140'); V('i-acon','128'); V('i-sit','pronto'); V('i-daq','2019-08-22'); V('i-aq','520000'); V('i-ref','760000'); V('i-reforig','cgibs'); V('i-refdata','2026-08-01');
try { calcRaj(); } catch(e){ console.warn(e); }
V('v-val','1200000'); V('v-tipo','comercial'); V('v-raj','755180'); V('v-cre','18500'); V('v-data','2028-03-10'); V('v-rsu','0'); V('v-pag','400000;400000;400000');
try { calcVenda(); } catch(e){ console.warn(e); }
V('l-val','5000'); V('l-mes','12'); V('l-data','2027-02-01'); try { calcLoc(); } catch(e){}
try { calcComp(); } catch(e){}
try { ligarMoney(); } catch(e){}
abrirAba('venda');
function pvLayout(novo){ if (novo) ImobLayout.aplicar(); else ImobLayout.desfazer();
  document.getElementById('sw-novo').classList.toggle('on', !!novo); document.getElementById('sw-atual').classList.toggle('on', !novo); }
pvLayout(true);
</script></body></html>`;
const dest = path.join(R, 'preview_layout_v150.html'); fs.writeFileSync(dest, out); console.log(dest, (out.length/1024).toFixed(0)+' KB');
