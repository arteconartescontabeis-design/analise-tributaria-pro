/* tests/capturar_telas.js — evidência visual em Chromium real com o Supabase simulado.
   Uso: node tests/capturar_telas.js [pasta-do-app] [pasta-de-saída] */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const H = require('./_harness_sessao.js');
(async () => {
  const RAIZ = path.resolve(process.argv[2] || path.join(__dirname, '..'));
  const OUT = path.resolve(process.argv[3] || path.join(__dirname, 'saida')); fs.mkdirSync(OUT, { recursive: true });
  const supa = H.novoSupabase();
  const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1280, height: 860 } });
  await pg.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.origin === H.ORIGEM) { const f = path.join(RAIZ, u.pathname.replace(/^\//, '')); if (fs.existsSync(f)) return route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' }); return route.fulfill({ status: 404, body: '' }); }
    if (u.hostname.endsWith('supabase.co')) { const req = route.request(); const r = await supa.fetch(u.toString(), { method: req.method(), headers: req.headers(), body: req.postData() }); return route.fulfill({ status: r.status, contentType: 'application/json', body: await r.text() }); }
    return route.abort();
  });
  const logs = []; pg.on('console', m => logs.push(m.type() + ': ' + m.text()));
  async function entrar(email, senha) { await pg.fill('#l-email', email); await pg.fill('#l-senha', senha); await pg.click('#btn-login'); await pg.waitForFunction(() => window.APP && APP.sessao !== 'carregando' && APP.sessao !== 'deslogado'); await pg.waitForTimeout(150); }
  await pg.goto(H.ORIGEM + '/imobiliaria.html'); await pg.waitForTimeout(200);
  await entrar('teste.a@artecon.local', 'senha-a');
  await pg.evaluate(() => { abrirAba('inventario'); imobInventario(); }); await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(OUT, '1_inventario_com_escritorio.png'), fullPage: false });
  await pg.evaluate(() => { abrirAba('imovel'); document.getElementById('i-cod').value = 'TESTE-141'; document.getElementById('i-tipo').value = 'comercial'; document.getElementById('i-aq').value = '250000'; document.getElementById('i-ref').value = '300000'; document.getElementById('i-daq').value = '2020-05-10'; calcRaj(); imobSalvarImovel(); }); await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(OUT, '2_imovel_gravado.png') });
  await pg.reload(); await pg.waitForFunction(() => window.APP && APP.sessao === 'ok'); await pg.waitForTimeout(150);
  await pg.evaluate(() => { abrirAba('inventario'); imobInventario(); }); await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(OUT, '3_apos_F5_carteira_recuperada.png') });
  await pg.evaluate(() => doLogout()); await pg.waitForTimeout(150);
  await entrar('sem.vinculo@artecon.local', 'senha-s');
  await pg.evaluate(() => { abrirAba('inventario'); imobInventario(); }); await pg.waitForTimeout(300);
  await pg.screenshot({ path: path.join(OUT, '4_usuario_sem_vinculo.png') });
  fs.writeFileSync(path.join(OUT, 'console_chromium.txt'), logs.join('\n'));
  console.log('telas em', OUT); console.log(logs.filter(l => /sess|imob/.test(l)).join('\n'));
  await br.close();
})().catch(e => { console.error(e); process.exit(2); });
