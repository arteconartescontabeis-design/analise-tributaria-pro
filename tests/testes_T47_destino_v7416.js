// t_sessao — varredura da renovação de sessão v7.17.1 (fetch e localStorage simulados)
import { readFileSync } from 'fs';
import vm from 'vm';

const html = readFileSync('index.html','utf-8');
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// recorta só o trecho de CONFIG+AUTH (até doLogout) p/ não depender do DOM inteiro
const ini = js.indexOf('// ── CONFIG');
const fim = js.indexOf('function doLogout');
const trecho = js.slice(ini, fim);

let chamadas = [];            // registro das chamadas de rede
let agora = 1_000_000_000_000;
const store = {};
const ctx = {
  console, URL, JSON, Promise, Object, Error, Math,
  Date: { now: () => agora },
  localStorage: { getItem:k=>store[k]??null, setItem:(k,v)=>store[k]=String(v), removeItem:k=>delete store[k] },
  document: { getElementById: () => ({ value:'', textContent:'', disabled:false }) },
  fetch: async (url, opts) => {
    chamadas.push({ url:String(url), auth: opts?.headers?.['Authorization'] });
    if (String(url).includes('grant_type=refresh_token')) {
      await new Promise(r=>setTimeout(r,20));   // simula latência p/ testar o single-flight
      return { ok:true, json: async()=>({ access_token:'tok_novo_'+chamadas.length, refresh_token:'rt_novo', expires_in:3600, user:{email:'x@y'} }) };
    }
    if (String(url).includes('/functions/v1/')) {
      const tok = (opts.headers['Authorization']||'').replace('Bearer ','');
      return tok.startsWith('tok_novo') ? { ok:true, status:200, json:async()=>({ok:1}) }
                                        : { ok:false, status:401, text:async()=>'{"erro":"Sessão inválida"}', json:async()=>({}) };
    }
    return { ok:true, status:200, text: async()=>'[]' };
  },
  setTimeout, entrar: ()=>{},
};
vm.createContext(ctx);
vm.runInContext(trecho + '\n;({APP,supa,supaFn,garantirToken,sessaoGuardar,tentarSessao})', ctx);
const { APP, supaFn, garantirToken } = vm.runInContext('({APP,supaFn,garantirToken})', ctx);

let ok=0, falha=0;
const t = (nome,cond)=>{ cond?ok++:falha++; console.log((cond?'✅':'❌')+' '+nome); };

// caso 1: token vencido → supaFn renova ANTES e a function recebe token novo (nenhum 401 visto)
store['atp_refresh']='rt_0'; APP.token='tok_velho'; APP.tokenExp = agora - 1;
chamadas=[];
let r = await supaFn('gerar-parecer', {a:1});
t('c1 renova antes da chamada (status 200)', r.status===200);
t('c1 sequência refresh→function', chamadas[0].url.includes('refresh_token') && chamadas[1].url.includes('gerar-parecer'));
t('c1 function recebeu o token novo', chamadas[1].auth.includes('tok_novo'));
t('c1 tokenExp atualizado (+1h)', APP.tokenExp === agora + 3600*1000);

// caso 2: token "válido" pelo relógio mas rejeitado pelo servidor (revogado) → 1 retry com token novo
APP.token='tok_velho'; APP.tokenExp = agora + 3600*1000; store['atp_refresh']='rt_novo';
chamadas=[];
r = await supaFn('gerar-parecer', {a:1});
t('c2 401 no meio → renova e repete uma vez (200)', r.status===200);
t('c2 exatamente 3 chamadas (function, refresh, function)', chamadas.length===3);

// caso 3: single-flight — 5 chamadas simultâneas com token vencido → UM único refresh
APP.token='tok_velho'; APP.tokenExp = agora - 1; store['atp_refresh']='rt_novo';
chamadas=[];
await Promise.all([1,2,3,4,5].map(()=>garantirToken()));
t('c3 single-flight: 1 refresh p/ 5 chamadas simultâneas', chamadas.filter(c=>c.url.includes('refresh_token')).length===1);

// caso 4: token ainda válido (>2 min) → nenhuma chamada de rede
APP.tokenExp = agora + 10*60*1000; chamadas=[];
await garantirToken();
t('c4 token válido não gera rede', chamadas.length===0);

// caso 5: refresh_token inválido → false, storage limpo, supaFn orienta relogar
delete store['atp_refresh']; APP.token='tok_velho'; APP.tokenExp = agora - 1;
let erro=null; try { await supaFn('gerar-parecer',{}); } catch(e){ erro=e.message; }
t('c5 sem refresh → pede novo login', /entre novamente/.test(erro||''));

console.log(`\n${ok}/${ok+falha} checks`); process.exit(falha?1:0);
