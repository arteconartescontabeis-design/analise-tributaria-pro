/* tests/reproduzir_defeito.js — PROVA DO DEFEITO na versão publicada (v1.4.0)
   Uso: node tests/reproduzir_defeito.js <pasta-com-a-versao-original>
   Faz login com usuário VINCULADO ao escritório 7 e abre o Inventário 2026.
   Esperado na versão defeituosa: window.APP undefined → "Sem escritório na sessão". */
'use strict';
const path = require('path');
const H = require('./_harness_sessao.js');
(async () => {
  const RAIZ = path.resolve(process.argv[2] || path.join(__dirname, '..'));
  const supa = H.novoSupabase(); const con = [];
  const J = await H.abrirJanela(RAIZ, supa, null, con);
  await H.login(J, 'teste.a@artecon.local', 'senha-a');
  await H.dormir(150);
  const appNoWindow = typeof J.w.APP;
  const escritorioDaCasca = (() => { try { return J.w.eval('typeof APP !== "undefined" ? APP.escritorioId : "(sem APP)"'); } catch (e) { return 'erro: ' + e.message; } })();
  J.w.abrirAba('inventario'); J.w.imobInventario();
  await H.ate(() => /Posi|escrit/i.test(J.$('iv-out').innerHTML));
  const tela = H.texto(J.$('iv-out'));
  console.log('pasta:', RAIZ);
  console.log('versão do módulo:', J.w.ModulosInfo && J.w.ModulosInfo.imobiliario.versao);
  console.log('escritório carregado pela casca (APP.escritorioId):', escritorioDaCasca);
  console.log('typeof window.APP (o que o módulo enxerga):', appNoWindow);
  console.log('Inventário 2026 mostra "Sem escritório na sessão"?', tela.includes(H.MSG_TEC) ? 'SIM — defeito reproduzido' : 'NÃO');
  console.log('trecho da tela:', tela.slice(0, 160));
  J.w.close(); process.exit(0);
})().catch(e => { console.error('ERRO:', e); process.exit(2); });
