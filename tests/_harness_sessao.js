/* tests/_harness_sessao.js — Supabase simulado + janela jsdom, compartilhados por
   run_sessao_imob.js (suíte) e reproduzir_defeito.js (prova do defeito na versão publicada). */
'use strict';
const fs = require('fs'), path = require('path');
const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');
const dormir = ms => new Promise(r => setTimeout(r, ms));
async function ate(fn, ms = 4000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await dormir(15); } return fn(); }
const ORIGEM = 'https://app.teste.local';
/* ───────────────────────── Supabase simulado ───────────────────────── */
function novoSupabase() {
  const db = {
    escritorios: [{ id: 7, nome: 'Escritório A' }, { id: 8, nome: 'Escritório B' }],
    atp_usuarios: [
      { id: 101, email: 'teste.a@artecon.local', nome: 'Teste A', papel: 'operador', escritorio_id: 7 },
      { id: 102, email: 'teste.b@artecon.local', nome: 'Teste B', papel: 'admin', escritorio_id: 8 },
      { id: 103, email: 'sem.vinculo@artecon.local', nome: 'Sem Vínculo', papel: 'operador', escritorio_id: null }
    ],
    atp_imob_imoveis: [
      { id: 'im-b-1', escritorio_id: 8, codigo_interno: 'B-001', tipo: 'comercial', valor_aquisicao: 100000, excluido_em: null }
    ],
    atp_imob_calculos: []
  };
  const auth = {  // e-mail → senha, uid
    'teste.a@artecon.local': { senha: 'senha-a', uid: 'uuid-a' },
    'teste.b@artecon.local': { senha: 'senha-b', uid: 'uuid-b' },
    'sem.vinculo@artecon.local': { senha: 'senha-s', uid: 'uuid-s' },
    'so.auth@artecon.local': { senha: 'senha-x', uid: 'uuid-x' }        // existe no Auth, não no cadastro
  };
  const tokens = new Map();   // access_token → { email, uid, exp }
  const refreshs = new Map(); // refresh_token → email
  let seq = 0;
  const log = [];             // toda requisição REST: { metodo, tabela, escritorio_chamador, body }
  const opcoes = { falharRestVezes: 0 };

  function emitir(email, expSeg) {
    const a = auth[email]; seq++;
    const at = 'at-' + a.uid + '-' + seq, rt = 'rt-' + a.uid + '-' + seq;
    tokens.set(at, { email, uid: a.uid, exp: Math.floor(Date.now() / 1000) + (expSeg || 3600) });
    refreshs.set(rt, email);
    return { access_token: at, refresh_token: rt, token_type: 'bearer', expires_in: expSeg || 3600,
             expires_at: Math.floor(Date.now() / 1000) + (expSeg || 3600), user: { id: a.uid, email } };
  }
  const json = (status, corpo) => ({ ok: status < 300, status, text: async () => corpo == null ? '' : JSON.stringify(corpo), json: async () => corpo });
  function quem(headers) {
    const h = headers || {}; const auth = h.Authorization || h.authorization || '';
    const t = tokens.get(auth.replace('Bearer ', ''));
    return t || null;
  }
  function escritorioDe(sess) { const u = db.atp_usuarios.find(x => x.email === sess.email); return u ? u.escritorio_id : null; }

  async function fetchSim(url, init) {
    init = init || {}; const u = new URL(String(url)); const m = (init.method || 'GET').toUpperCase();
    const p = u.pathname;
    /* ---- Auth ---- */
    if (p === '/auth/v1/token') {
      const b = JSON.parse(init.body || '{}'); const g = u.searchParams.get('grant_type');
      if (g === 'password') { const a = auth[String(b.email || '').toLowerCase()]; if (!a || a.senha !== b.password) return json(400, { error_description: 'Invalid login credentials' }); return json(200, emitir(String(b.email).toLowerCase())); }
      if (g === 'refresh_token') { const em = refreshs.get(b.refresh_token); if (!em) return json(400, { error: 'invalid_grant' }); refreshs.delete(b.refresh_token); return json(200, emitir(em)); }
      return json(400, { error: 'unsupported' });
    }
    if (p === '/auth/v1/user') { const s = quem(init.headers); if (!s) return json(401, { msg: 'invalid JWT' }); return json(200, { id: s.uid, email: s.email }); }
    if (p === '/auth/v1/logout') { const t = (init.headers.authorization || init.headers.Authorization || '').replace('Bearer ', ''); tokens.delete(t); return json(204, null); }
    /* ---- PostgREST ---- */
    if (p.startsWith('/rest/v1/')) {
      const tabela = p.slice('/rest/v1/'.length); const s = quem(init.headers);
      if (!s) return json(401, { message: 'JWT expired' });
      if (opcoes.falharRestVezes > 0) { opcoes.falharRestVezes--; return json(503, { message: 'indisponível (simulado)' }); }
      const meu = escritorioDe(s); const body = init.body ? JSON.parse(init.body) : null;
      log.push({ metodo: m, tabela, escritorio_chamador: meu, email: s.email, body, query: u.search });
      const filtro = (rows) => { let r = rows;
        for (const [k, v] of u.searchParams) { if (['select', 'limit', 'order', 'on_conflict'].includes(k)) continue;
          const [op, ...rest] = v.split('.'); const val = rest.join('.');
          r = r.filter(x => { const c = x[k]; if (op === 'eq') return String(c) === val; if (op === 'ilike') return String(c || '').toLowerCase() === val.toLowerCase(); if (op === 'is') return val === 'null' ? c == null : c === (val === 'true'); if (op === 'gte') return String(c) >= val; if (op === 'lte') return String(c) <= val; return true; }); }
        const lim = u.searchParams.get('limit'); if (lim) r = r.slice(0, +lim); return r; };
      if (tabela === 'atp_usuarios') {  // RLS: vê a própria linha e as do próprio escritório
        if (m !== 'GET') return json(403, { code: '42501' });
        return json(200, filtro(db.atp_usuarios.filter(x => x.email === s.email || (meu != null && x.escritorio_id === meu))));
      }
      if (tabela === 'atp_imob_imoveis' || tabela === 'atp_imob_calculos') {
        const rows = db[tabela];
        if (m === 'GET') return json(200, filtro(rows.filter(x => meu != null && x.escritorio_id === meu)));
        if (m === 'POST') { const lista = Array.isArray(body) ? body : [body]; const out = [];
          for (const r of lista) { if (r.escritorio_id == null || String(r.escritorio_id) !== String(meu)) return json(403, { code: '42501', message: 'new row violates row-level security policy' });
            const nr = Object.assign({ id: tabela.slice(9, 12) + '-' + (++seq), excluido_em: null, calculado_em: new Date().toISOString() }, r); rows.push(nr); out.push(nr); }
          return json(201, out); }
        if (m === 'PATCH') { const alvo = filtro(rows.filter(x => x.escritorio_id === meu)); alvo.forEach(x => Object.assign(x, body)); return json(200, alvo); }
        return json(405, {});
      }
      return json(404, { message: 'tabela desconhecida: ' + tabela });
    }
    return json(404, { message: 'rota desconhecida ' + p });
  }
  return { db, fetch: fetchSim, log, opcoes, tokens };
}

/* ───────────────────────── janela jsdom ───────────────────────── */
class Loader extends ResourceLoader {
  constructor(raiz){ super(); this.raiz = raiz; }
  fetch(url) {
    const u = new URL(url); if (u.origin !== ORIGEM) return Promise.reject(new Error('rede bloqueada no teste: ' + url));
    const f = path.join(this.raiz, u.pathname.replace(/^\//, ''));      // ?v= é ignorado
    return Promise.resolve(fs.readFileSync(f));
  }
}
async function abrirJanela(RAIZ, supa, storageInicial, consoleLinhas) {
  const HTML = fs.readFileSync(path.join(RAIZ, 'imobiliaria.html'), 'utf8');
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Could not load|not implemented/i.test(String(e && e.message))) consoleLinhas.push('jsdomError: ' + e.message); });
  ['info', 'warn', 'error', 'log'].forEach(n => vc.on(n, (...a) => consoleLinhas.push(n + ': ' + a.map(String).join(' '))));
  const dom = new JSDOM(HTML, {
    url: ORIGEM + '/imobiliaria.html', runScripts: 'dangerously', resources: new Loader(RAIZ), pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) {
      window.fetch = (u, i) => supa.fetch(u, i);
      window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      if (storageInicial) for (const k of Object.keys(storageInicial)) window.localStorage.setItem(k, storageInicial[k]);
    }
  });
  const w = dom.window;
  await new Promise(r => { if (w.document.readyState === 'complete') r(); else w.addEventListener('load', r); });
  await dormir(30);
  return { dom, w, $: id => w.document.getElementById(id) };
}
const visivel = el => el && el.style.display !== 'none';
const texto = el => (el && el.textContent || '').replace(/\s+/g, ' ').trim();
const MSG_TEC = 'Sem escritório na sessão';
const MSG_SEM_VINCULO = 'Usuário autenticado, mas sem escritório vinculado. Procure o administrador.';

async function login(J, email, senha) { J.$('l-email').value = email; J.$('l-senha').value = senha; await J.w.doLogin(); await ate(() => !J.w.APP || (J.w.APP.sessao !== 'carregando' && !J.w.ENTRANDO)); await dormir(20); }
function copiarStorage(w) { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; }


module.exports = { ORIGEM, novoSupabase, abrirJanela, visivel, texto, MSG_TEC, MSG_SEM_VINCULO, login, copiarStorage, dormir, ate };
