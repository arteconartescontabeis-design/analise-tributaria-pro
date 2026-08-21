// Testes T48 — ano de referência, memória da projeção e premissa do crédito (v7.41.7)
const fs=require('fs'), vm=require('vm');
const alvo = process.argv[2] || 'index.html';
if (!fs.existsSync(alvo)){
  console.error('Arquivo não encontrado: ' + alvo);
  console.error('Uso: node ' + require('path').basename(process.argv[1]) + ' [caminho/do/index.html]');
  console.error('Sem argumento, procura index.html na pasta atual.');
  process.exit(2);
}
console.log('Conferindo: ' + alvo + '\n');
const html=fs.readFileSync(alvo,'utf8');
const blocos=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(x=>x.trim());
const js=blocos.sort((a,b)=>b.length-a.length)[0];
let ok=0,bad=0;
const t=(n,c)=>{ if(c){ok++;console.log('  ok  '+n);} else {bad++;console.log('  FALHA '+n);} };
const els={}; const mk=id=>els[id]||(els[id]={id,style:{},options:[],innerHTML:'',textContent:'',value:''});
const ctx={ console, document:{ querySelectorAll:()=>[], addEventListener(){}, getElementById:mk, createElement:()=>({style:{}}) },
  localStorage:{ getItem:()=>null, setItem(){}, removeItem(){} }, fetch:async()=>({ok:true,text:async()=>'[]'}),
  alert(){}, confirm:()=>true, setTimeout, clearTimeout, Chart:function(){}, XLSX:{}, navigator:{}, location:{href:''} };
ctx.globalThis=ctx; ctx.window=ctx; vm.createContext(ctx);
try{ vm.runInContext(js,ctx); }catch(e){ console.log('carga:',e.message); }
const run=c=>vm.runInContext(c,ctx);

console.log('T48a — resolução do ano de referência');
run('PAR_ANO_REF_DOC = null');
t('padrão é 2027', run('parAnoRefEfetivo({}).v')===2027);
t('origem padrão', run('parAnoRefEfetivo({}).origem')==='padrao');
t('config da empresa prevalece', run('parAnoRefEfetivo({anoRefParecer:2033}).v')===2033);
t('origem empresa', run('parAnoRefEfetivo({anoRefParecer:2030}).origem')==='empresa');
run('PAR_ANO_REF_DOC = 2031');
t('documento vence a empresa', run('parAnoRefEfetivo({anoRefParecer:2033}).v')===2031);
t('origem documento', run('parAnoRefEfetivo({}).origem')==='documento');
run('PAR_ANO_REF_DOC = null');
t('ano fora da lista cai no padrão', run('parAnoRefNorm(2050)')===2027);
t('lixo cai no padrão', run("parAnoRefNorm('abc')")===2027);
t('2033 continua válido', run('parAnoRefNorm(2033)')===2033);
t('rótulo pleno só em 2033', run('parAnoRefRotulo(2033)')==='modelo pleno' && run('parAnoRefRotulo(2027)')==='transição');

console.log('T48b — o parecer não fixa mais 2033');
t('L33 procura o ano escolhido', /REF\.find\(l=>l\.ano===anoRef\)/.test(js));
t('cai em 2033 se o ano não existir na série', /REF\.find\(l=>l\.ano===anoRef\) \|\| REF\.find\(l=>l\.ano===2033\) \|\| null/.test(js));
t('dRef indexa pelo ano, não pelo último', /anos\.findIndex\(l=>l\.ano===anoRef\)/.test(js));
t('nenhum "sDentro[D.sDentro.length-1]" sobrou', !/D\.sDentro\[D\.sDentro\.length-1\]/.test(js));
t('título dos três caminhos usa o ano', /três caminhos do Simples em '\+D\.anoRef/.test(js));
t('caixa da jornada usa o ano', /pp-jet">\$\{D\.anoRef\}/.test(js));
t('premissa da alíquota usa o ano', /Alíquota de referência \(\$\{D\.anoRef\}\)/.test(js));
t('payload leva anoReferencia', /anoReferencia: D\.anoRef/.test(js));
t('payload mantém a chave antiga', /cenarios2033:/.test(js));

console.log('T48c — premissa do crédito de IBS/CBS');
run("RL = { forn:null }");
const semTudo = run("premissaCreditoIBS({anoRef:2027, cen:{semCreditos:true, rfx:{contra:{}}}})");
t('não afirma inexistência de direito', /não por inexistência de direito/.test(semTudo));
t('cita o art. 58 mesmo sem dados', /art\. 58/.test(semTudo));
t('traz o percentual do ano de referência', /0,62%/.test(semTudo));
const comSimples = run("premissaCreditoIBS({anoRef:2027, cen:{semCreditos:false, rfx:{contra:{compras_simples:100000}}}})");
t('compras do Simples/MEI geram crédito', /crédito simplificado/.test(comSimples));
t('nunca diz "sem crédito" quando há Simples/MEI', !/sem crédito/i.test(comSimples));
t('quantifica o crédito no ano', /R\$ 620,00/.test(comSimples));
t('avisa que MEI recolhe valor fixo', /valores fixos/.test(comSimples));
const manual = run("premissaCreditoIBS({anoRef:2033, cen:{semCreditos:false, rfx:{contra:{compras_simples:100000}, credSimplesPct:27.91}}})");
t('percentual manual prevalece', /percentual informado/.test(manual) && /R\$ 27\.910,00/.test(manual));

console.log('T48d — a consulta de fornecedores entra na premissa');
run(`RL = { forn: { compra: { consultado_em:'2026-08-01T12:00:00Z', dados:{ itens:[
  {classe:'mei', valor:50000}, {classe:'simples', valor:30000},
  {classe:'normal', valor:20000}, {classe:'proprio', valor:9999} ] } } } }`);
const fx = run('fornComprasSimplesMEI()');
t('soma MEI + Simples', Math.abs(fx.soma-80000)<0.01);
t('separa o MEI', Math.abs(fx.mei-50000)<0.01);
t('exclui movimentação própria', Math.abs(fx.tot-100000)<0.01);
const alerta = run("premissaCreditoIBS({anoRef:2027, cen:{semCreditos:true, rfx:{contra:{}}}})");
t('aponta o valor já conhecido', /R\$ 80\.000,00/.test(alerta));
t('destaca o MEI', /MEI R\$ 50\.000,00/.test(alerta));
t('explica que falta APLICAR na aba Reforma', /Aplique a consulta na aba Reforma/.test(alerta));
t('atribui a causa ao dado, não ao direito', /nenhuma compra foi informada/.test(alerta));

console.log('T48e — memória de cálculo da projeção');
t('função existe', typeof run('typeof rlConfProjecao')==='string' && run('typeof rlConfProjecao')==='function');
t('entra no modo anual', /rlConfSublimite\(\) \+ rlConfProjecao\(\)/.test(js));
t('entra no modo mês', /return h \+ rlConfProjecao\(\)/.test(js));
run("RL = { dados:null }");
t('sem análise não quebra', run('rlConfProjecao()')==='');

console.log('\n'+(ok+bad)+' verificações · '+ok+' ok · '+bad+' falhas');
process.exit(bad?1:0);
