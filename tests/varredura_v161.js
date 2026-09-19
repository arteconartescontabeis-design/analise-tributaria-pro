/* tests/varredura_v161.js — varredura de erros da v1.6.1: carga completa (14 scripts + layout), fluxos venda/locação/permuta/comparativo, entradas hostis, 12 relatórios, abas do layout. Uso: npm i --no-save jsdom@24 && node tests/varredura_v161.js */
var fs=require('fs'),path=require('path'),vm=require('vm'); var JSDOM=require('jsdom').JSDOM;
var RAIZ=process.cwd(), MOD=path.join(RAIZ,'modulos','imobiliario');
var html=fs.readFileSync('imobiliaria.html','utf8').replace(/<script src="[^"]*"><\/script>\s*/g,'').replace(/<script>[\s\S]*?<\/script>/g,'');
var dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://artecon.test/imobiliaria.html'}); var w=dom.window;
w.APP={escritorioId:null,user:{email:'t@a'}}; var erros=[];
w.open=function(){ var dd=new JSDOM('<html><head></head><body></body></html>'); var ww=dd.window; ww.print=function(){}; ww.focus=function(){}; w.__ultimaJanela=ww; return ww; }; w.__ultimaJanela=null;
w.console.error=function(){ erros.push(Array.prototype.slice.call(arguments).join(' ')); };
w.onerror=function(m){ erros.push('onerror '+m); };
['imob_manifesto.js','imob_estilo.js','imob_pagina.js','motorImob.js','persistenciaImob.js','parecerImobIA.js','nucleoRastreio.js','imob_premissas.js','imob_validacao.js','imob_relatorios.js','imob_graficos.js','imob_marca.js','ui_imobiliaria.js','imob_layout.js'].forEach(function(f){ try{ w.eval(fs.readFileSync(path.join(MOD,f),'utf8')); }catch(e){ erros.push('CARGA '+f+': '+e.message); } });
var d=w.document, M=w.MotorImob; function $(i){return d.getElementById(i);} function set(i,v){ var e=$(i); if(!e) erros.push('campo inexistente '+i); else e.value=String(v); }
try{ w.imobEntrar && w.imobEntrar(); }catch(e){ erros.push('imobEntrar '+e.message); }
try{ w.ImobLayout.aplicar({menuLateral:true}); }catch(e){ erros.push('layout.aplicar '+e.message); }
// 1. fluxo venda com layout completo
try{ w.abrirAba('venda'); set('v-val',900000); set('v-raj',400000); set('v-tipo','residencial_novo'); set('v-data','2033-06-15'); w.calcVenda();
  var abas=Array.prototype.map.call(d.querySelectorAll('#v-out .res-tabs button, #v-out .res-tab, #v-out [data-aba]'),function(b){return b.textContent.trim();});
  console.log('abas venda:', abas.join(' | ')||'(layout não montou abas)'); }catch(e){ erros.push('venda '+e.stack.split('\n')[0]); }
// 2. permuta parcelada com R$ formatado
try{ w.abrirAba('permuta'); set('x-val',1000000); set('x-rec',700000); set('x-parte','nao_contribuinte'); set('x-tpaga',300000); set('x-trec',0); set('x-raj',400000); set('x-tparc','R$ 100.000,00; 100.000,00 ; 100.000,00'); set('x-data','2033-06-15'); w.calcPerm();
  console.log('permuta parcelada R$:', $('x-out').innerHTML.indexOf('confere com o total: sim')>0?'ok':'FALHOU'); set('x-tparc','50000;50000'); w.calcPerm(); console.log('permuta soma errada avisa:', /n&atilde;o fecha|não fecha/.test($('x-out').innerHTML)?'ok':'FALHOU'); set('x-tparc',''); }catch(e){ erros.push('permuta '+e.stack.split('\n')[0]); }
// 3. locação não residencial prazo curto não deve pedir classificação
var r=M.calcular({operacao:'locacao',data_fato_gerador:'2033-06-15',valor_operacao:10000,locacao:{finalidade:'nao_residencial',meses:1,prazo_dias:30}},w.ImobPremissas.montarCtx(w.PREM||{}, 'locacao'));
console.log('não residencial 30 dias:', r.status);
// 4. entradas hostis nos caminhos novos
var ctx=M.transicaoPadrao? {aliquotas:{ibs:18.7,cbs:9.21,classificacao:'ESTIMADA'},parametros:{redutor_social_residencial_novo:100000,redutor_social_lote_residencial:30000,redutor_social_locacao_mes:600},indices:{ipca_fator:1}}:null;
[['torna_pagamentos texto',{operacao:'permuta',data_fato_gerador:'2033-06-15',valor_operacao:1e6,permuta:{contraparte:'nao_contribuinte',torna:300000,torna_paga_por:'contribuinte',torna_pagamentos:['a',null,-5,'100000']}}],
 ['torna_pagamentos vazio',{operacao:'permuta',data_fato_gerador:'2033-06-15',valor_operacao:1e6,permuta:{contraparte:'nao_contribuinte',torna:300000,torna_paga_por:'contribuinte',torna_pagamentos:[]}}],
 ['classificacao __proto__',{operacao:'locacao',data_fato_gerador:'2033-06-15',valor_operacao:5000,locacao:{finalidade:'residencial',meses:1,prazo_dias:10,classificacao_operacao:'__proto__',justificativa_classificacao:{}}}],
 ['justificativa objeto',{operacao:'locacao',data_fato_gerador:'2033-06-15',valor_operacao:5000,locacao:{finalidade:'residencial',meses:1,prazo_dias:10,classificacao_operacao:'locacao_residencial',justificativa_classificacao:{a:1}}}],
 ['aliquotas sem classificacao',{operacao:'venda',data_fato_gerador:'2033-06-15',valor_operacao:1e5,imovel:{tipo:'comercial'}}, {aliquotas:{ibs:18.7,cbs:9.21},parametros:{},indices:{}}]
].forEach(function(c){ try{ var x=M.calcular(c[1],c[2]||ctx); console.log(c[0]+':',x.status,(x.bloqueios||[]).map(function(b){return b.codigo;}).join(','),x.total); }catch(e){ erros.push('HOSTIL '+c[0]+': '+e.message); } });
console.log('transicaoPadrao sem alíquotas:', M.transicaoPadrao({aliquotas:{}})===null?'null (ok)':'FALHOU');
console.log('transicaoPadrao hostil:', M.transicaoPadrao({aliquotas:{ibs:'x',cbs:null}})===null?'null (ok)':'FALHOU');
// 5. escada legada com classificacao LEGAL na linha (risco de o genérico rotular 2027 como lei)
var leg={2026:{ibs:0.1,cbs:0.9,classificacao:'LEGAL'},2027:{ibs:0.1,cbs:9.11,classificacao:'LEGAL'},2033:{ibs:18.7,cbs:9.21,classificacao:'ESTIMADA'}};
var pl=M.projetarTransicao({operacao:'venda',data_fato_gerador:'2033-06-15',valor_operacao:1e5,imovel:{tipo:'comercial'}},Object.assign({},ctx,{transicao:leg}));
console.log('escada legada 2027 sai como:', pl.anos[1].classificacao, pl.anos[1].categoria_cbs, '(anos sem alíquota:', pl.anos_sem_aliquota.length+')');
// 6. contagem de homologadas × manifesto
var hom=Object.keys(M.REGRAS).filter(function(k){return M.REGRAS[k].status==='homologada';}).length; console.log('homologadas reais:',hom,'manifesto:',w.ModulosInfo.imobiliario.motor.homologadas);
// 7. percentuais em RET 2026 e locação transitória
console.log('RET 2026:',JSON.stringify(M.calcular({operacao:'ret',data_fato_gerador:'2026-05-01',valor_operacao:1e5,ret:{modalidade:'normal',patrimonio_afetacao:true}},ctx).percentuais.map(function(p){return p.nome+':'+p.aplicada;})));
// 8. relatórios: todos os tipos, todas as operações (calcula antes de emitir)
w.abrirAba('venda'); set('v-val',900000); set('v-raj',400000); set('v-tipo','residencial_novo'); set('v-data','2033-06-15'); w.calcVenda();
w.abrirAba('locacao'); set('l-val',5000); set('l-fim','residencial'); set('l-mes',12); set('l-prz',''); set('l-cls',''); set('l-just',''); set('l-data','2033-06-15'); w.calcLoc();
w.abrirAba('permuta'); set('x-tparc','100000;100000;100000'); w.calcPerm(); set('x-tparc','');
['venda','locacao','permuta'].forEach(function(op){ ['simplificado','executivo','tecnico','memoria'].forEach(function(t){ try{ w.__ultimaJanela=null; w.imobRelatorio(t,op); var h=w.__ultimaJanela? w.__ultimaJanela.document.documentElement.outerHTML:''; if(!h) erros.push('relatório '+t+'/'+op+' não abriu'); else if(/undefined|NaN/.test(h.replace(/data:image[^"']+/g,''))) { var m=h.match(/.{80}(undefined|NaN).{40}/); erros.push('relatório '+t+'/'+op+': '+(m?m[0].replace(/\s+/g,' '):'?')); } else console.log('relatório',t,op,'ok',h.length,'bytes', t==='tecnico'||t==='memoria'?(h.indexOf('Percentuais aplicados')>0?'(percentuais ok)':'(SEM percentuais)'):''); }catch(e){ erros.push('relatório '+t+'/'+op+': '+e.message); } }); });
console.log('res-abas no documento:', d.querySelectorAll('.res-abas').length, Array.prototype.map.call(d.querySelectorAll('.res-abas *'),function(b){return b.textContent.trim();}).filter(Boolean).slice(0,12).join(' | '));
console.log('abas do resultado (layout):', Array.prototype.map.call(d.querySelectorAll('#v-out .res-abas button, #v-out .res-abas [role=tab], #v-out .res-abas *'),function(b){return b.textContent.trim();}).filter(Boolean).join(' | ')||'(nenhuma)');
// 9. procurar undefined/NaN na tela
['v-out','x-out','l-out','c-out','r-out'].forEach(function(id){ var h=($(id)||{}).innerHTML||''; if(/undefined|NaN/.test(h)) erros.push('tela '+id+' contém undefined/NaN'); });
try{ w.abrirAba('regras'); }catch(e){ erros.push('regras '+e.message); }
try{ w.abrirAba('comparativo'); set('c-rv',900000); set('c-rl',120000); set('c-rs',30000); set('c-me',3); set('c-obj','1'); set('c-nat','operacional'); set('c-raj',400000); set('c-tipo','residencial_novo'); set('c-iss',5); w.calcComp(); if(/undefined|NaN/.test($('c-out').innerHTML)) erros.push('comparativo undefined/NaN'); console.log('comparativo:', $('c-out').innerHTML.indexOf('Comparativo lado a lado')>0?'ok':'FALHOU'); }catch(e){ erros.push('comparativo '+e.stack.split('\n')[0]); }
console.log('\nERROS ('+erros.length+'):\n'+erros.join('\n'));

setTimeout(function(){ console.log('res-abas (após o observer):', d.querySelectorAll('.res-abas').length, Array.prototype.map.call(d.querySelectorAll('.res-abas *'),function(b){return b.textContent.trim();}).filter(Boolean).slice(0,14).join(' | ')); process.exit(0); }, 400);
