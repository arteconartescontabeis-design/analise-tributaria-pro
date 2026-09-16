/* ===========================================================================
   tests/run_sessao_imob.js — v1.4.1 · sessão e escritório
   ---------------------------------------------------------------------------
   Carrega imobiliaria.html + modulos/imobiliario/ em jsdom, com um Supabase
   SIMULADO (Auth + PostgREST com isolamento por escritório) e percorre os
   12 itens de validação do pedido de 15/09/2026, mais 4 verificações de
   regressão (sem vínculo, falha transitória, renovação de token, retorno à aba).

   Uso:  node tests/run_sessao_imob.js [pasta-do-app]   (padrão: pasta acima)
   Saída: OK/FALHA por verificação, resumo e código de saída 1 se falhar.
   Nada aqui toca o Supabase real: fetch é substituído dentro da janela.
   =========================================================================== */
'use strict';
const fs = require('fs'), path = require('path');
const H = require('./_harness_sessao.js');
const { novoSupabase, visivel, texto, MSG_TEC, MSG_SEM_VINCULO, login, copiarStorage, dormir, ate } = H;
const RAIZ = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const abrirJanela = (supa, st, con) => H.abrirJanela(RAIZ, supa, st, con);

let total = 0, falhas = 0; const linhas = [];
function ok(cond, rotulo, detalhe) {
  total++; const passou = !!cond; if (!passou) falhas++;
  const l = (passou ? '  OK    ' : '  FALHA ') + rotulo + (detalhe && !passou ? '  → ' + detalhe : '');
  linhas.push(l); console.log(l);
}
function titulo(t) { const l = '\n' + t; linhas.push(l); console.log(l); }

/* ═════════════════════════════ CENÁRIOS ═════════════════════════════ */
(async () => {
  const supa = novoSupabase(); const con = [];
  const evid = { antes: null, depois: null };

  titulo('0. Abertura direta da URL sem sessão');
  let J = await abrirJanela(supa, null, con);
  ok(visivel(J.$('auth-screen')) && !visivel(J.$('app')), 'tela de login aparece; app oculto');
  ok(typeof J.w.sessaoPronta === 'function' && typeof J.w.imobEntrar === 'function', 'casca expõe sessaoPronta() e o módulo carregou (imobEntrar)');
  ok(J.$('mod-versao-badge').textContent === 'v1.5.0', 'badge de versão v1.5.0 no menu', J.$('mod-versao-badge').textContent);

  titulo('1. Login com usuário de teste (escritório 7)');
  const antesLogin = supa.log.length;
  await login(J, 'teste.a@artecon.local', 'senha-a');
  ok(visivel(J.$('app')) && !visivel(J.$('auth-screen')), 'app aberto após login');
  ok(J.w.APP.user && J.w.APP.user.email === 'teste.a@artecon.local', 'usuário autenticado consultado no servidor (/auth/v1/user)');

  titulo('2. Carregamento automático do escritório');
  ok(J.w.APP.sessao === 'ok' && J.w.APP.escritorioId === 7, 'APP.escritorioId = 7 e estado ok', JSON.stringify({ s: J.w.APP.sessao, e: J.w.APP.escritorioId }));
  ok(J.w.APP.papel === 'operador' && J.w.APP.usuarioId === 101, 'papel e id do cadastro carregados');
  const pri = supa.log.slice(antesLogin);
  ok(pri.length && pri[0].tabela === 'atp_usuarios', '1ª requisição ao banco após o login é a do cadastro do usuário', pri[0] && pri[0].tabela);
  ok(!pri.some(r => r.tabela.startsWith('atp_imob_')), 'nenhuma consulta às tabelas do módulo antes de o escritório existir');
  ok(!visivel(J.$('sessao-aviso')), 'sem aviso de sessão na tela');
  const ctx = J.w.__imobUI && J.w.imobAtualizarContexto ? J.w.imobAtualizarContexto() : false;
  ok(ctx === true, 'contexto de banco do módulo sincronizado com o escritório');

  titulo('3. Aba Inventário 2026 — a mensagem "Sem escritório na sessão" não aparece');
  J.w.abrirAba('inventario'); J.w.imobInventario();
  await ate(() => /Posi|Falha|escrit/i.test(J.$('iv-out').innerHTML) && !/Carregando a carteira/.test(J.$('iv-out').innerHTML));
  ok(!texto(J.$('iv-out')).includes(MSG_TEC), 'mensagem técnica ausente');
  ok(!/atp_usuarios|escritorio_id|RLS/.test(texto(J.$('iv-out'))), 'nenhum nome de tabela/código interno na tela');

  titulo('4. Botão "Levantar carteira"');
  ok(/Posi..o da carteira/.test(J.$('iv-out').innerHTML), 'carteira levantada do banco (título "Posição da carteira")', texto(J.$('iv-out')).slice(0, 120));
  const reqInv = supa.log.filter(r => r.tabela === 'atp_imob_imoveis' && r.metodo === 'GET');
  ok(reqInv.length >= 1 && reqInv.every(r => r.escritorio_chamador === 7), 'leitura da carteira feita com o escritório 7');
  ok(!texto(J.$('iv-out')).includes('B-001'), 'imóvel do escritório 8 NÃO aparece para o escritório 7 (isolamento)');

  titulo('5. Botão "Usar carteira de exemplo"');
  J.w.imobInventarioExemplo(); await dormir(30);
  ok(/AP-101/.test(J.$('iv-out').innerHTML) && /GL-22/.test(J.$('iv-out').innerHTML), 'carteira de exemplo com 5 imóveis pintada');

  titulo('6. Cadastro de um imóvel de teste');
  J.w.abrirAba('imovel');
  const campos = { 'i-cod': 'TESTE-141', 'i-tipo': 'comercial', 'i-emp': 'Empresa Teste', 'i-mat': '12345', 'i-mun': 'Palhoça', 'i-uf': 'SC', 'i-aq': '250000', 'i-ref': '300000', 'i-daq': '2020-05-10', 'i-sit': 'pronto' };
  for (const k of Object.keys(campos)) { const el = J.$(k); if (el) { if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === campos[k])) continue; el.value = campos[k]; } }
  try { J.w.calcRaj(); } catch (e) {}
  ok(J.$('i-cod').value === 'TESTE-141', 'formulário do imóvel preenchido');

  titulo('7. Salvamento dos dados');
  const antesSalvar = supa.db.atp_imob_imoveis.length;
  J.w.imobSalvarImovel();
  await ate(() => supa.db.atp_imob_imoveis.length > antesSalvar || /N.o gravado|Nada foi gravado/.test((J.$('just-ok') || J.$('raj-out') || {}).innerHTML || ''));
  await dormir(30);
  const gravado = supa.db.atp_imob_imoveis.find(r => r.codigo_interno === 'TESTE-141');
  ok(!!gravado, 'imóvel TESTE-141 inserido no banco', (J.$('just-ok') || J.$('raj-out') || {}).innerHTML);
  ok(gravado && gravado.escritorio_id === 7, 'gravado com escritorio_id = 7', gravado && String(gravado.escritorio_id));
  const post = supa.log.filter(r => r.metodo === 'POST' && r.tabela === 'atp_imob_imoveis');
  ok(post.length && post.every(r => r.body && (Array.isArray(r.body) ? r.body : [r.body]).every(b => b.escritorio_id === 7)), 'corpo da gravação carrega o escritório da sessão');
  // venda finalizada e gravada
  J.w.abrirAba('venda');
  Object.entries({ 'v-val': '400000', 'v-raj': '250000', 'v-cre': '0', 'v-data': '2027-03-15', 'v-pag': '', 'v-rsu': '0' }).forEach(([k, v]) => { const el = J.$(k); if (el) el.value = v; });
  if (J.$('v-tipo') && [...J.$('v-tipo').options].some(o => o.value === 'comercial')) J.$('v-tipo').value = 'comercial';
  try { J.w.calcVenda(); } catch (e) { con.push('calcVenda: ' + e.message); }
  const antesCalc = supa.db.atp_imob_calculos.length;
  J.w.imobFinalizar();
  await ate(() => supa.db.atp_imob_calculos.length > antesCalc || /N.o finalizado|bloqueado|Nada foi gravado/.test(J.$('v-out').innerHTML), 6000);
  await dormir(30);
  const calc = supa.db.atp_imob_calculos[antesCalc];
  ok(!!calc, 'cálculo de venda finalizado e gravado em atp_imob_calculos', texto(J.$('v-out')).slice(0, 200));
  ok(calc && calc.escritorio_id === 7 && calc.hash_snapshot, 'cálculo carimbado com escritório 7 e hash', calc && JSON.stringify({ e: calc.escritorio_id, h: !!calc.hash_snapshot }));
  evid.antes = { imoveis: supa.db.atp_imob_imoveis.map(r => ({ id: r.id, codigo: r.codigo_interno, escritorio_id: r.escritorio_id })), calculos: supa.db.atp_imob_calculos.map(r => ({ id: r.id, escritorio_id: r.escritorio_id, hash: r.hash_snapshot, request_id: r.request_id })) };

  titulo('8. Atualização da página (F5) com a sessão guardada');
  const storage = copiarStorage(J.w);
  ok(storage.atp_refresh && storage.atp_token, 'token e refresh guardados no navegador');
  J.w.close();
  const con2 = []; J = await abrirJanela(supa, storage, con2);
  await ate(() => J.w.APP.sessao === 'ok' || J.w.APP.sessao === 'sem_vinculo' || J.w.APP.sessao === 'falha' || visivel(J.$('auth-screen')), 5000);
  await ate(() => !J.w.ENTRANDO); await dormir(20);
  ok(visivel(J.$('app')) && !visivel(J.$('auth-screen')), 'reentrou sem pedir login');
  ok(J.w.APP.sessao === 'ok' && J.w.APP.escritorioId === 7, 'escritório recarregado automaticamente após o F5', JSON.stringify({ s: J.w.APP.sessao, e: J.w.APP.escritorioId }));
  ok(con2.some(l => /\[sessão\] escritório carregado/.test(l)), 'console registra "[sessão] escritório carregado"');
  ok(!con2.some(l => /teste\.a@|senha|at-uuid|rt-uuid/.test(l)), 'console não expõe e-mail, senha nem token');

  titulo('9. Recuperação dos dados salvos');
  J.w.abrirAba('inventario'); J.w.imobInventario();
  await ate(() => /Posi|Falha|escrit/i.test(J.$('iv-out').innerHTML) && !/Carregando a carteira/.test(J.$('iv-out').innerHTML));
  ok(/TESTE-141/.test(J.$('iv-out').innerHTML), 'imóvel TESTE-141 volta na carteira levantada do banco', texto(J.$('iv-out')).slice(0, 160));
  ok(!/B-001/.test(J.$('iv-out').innerHTML), 'imóvel do outro escritório continua invisível');
  J.w.abrirAba('historico'); J.w.imobListarImoveis();
  await ate(() => /im.vel\(is\)|Nada foi gravado/.test(J.$('hi-out').innerHTML));
  ok(/TESTE-141/.test(J.$('hi-out').innerHTML), 'lista de imóveis (Histórico → Imóveis) recupera TESTE-141');

  titulo('10. Histórico');
  J.w.imobHistorico();
  await ate(() => /registro\(s\)|Nada foi gravado/.test(J.$('hi-out').innerHTML));
  ok(/1 registro\(s\)|[1-9]\d* registro\(s\)/.test(J.$('hi-out').innerHTML), 'histórico lista o cálculo gravado', texto(J.$('hi-out')).slice(0, 160));
  ok(!texto(J.$('hi-out')).includes(MSG_TEC), 'sem a mensagem técnica no histórico');
  const gets = supa.log.filter(r => r.tabela === 'atp_imob_calculos' && r.metodo === 'GET');
  ok(gets.length && gets.every(r => r.escritorio_chamador === 7), 'leitura do histórico com o escritório 7');

  titulo('11. Logout e novo login');
  await J.w.doLogout(); await dormir(20);
  ok(visivel(J.$('auth-screen')) && !visivel(J.$('app')), 'volta à tela de login');
  ok(!J.w.localStorage.getItem('atp_token') && !J.w.localStorage.getItem('atp_refresh'), 'token e refresh removidos do navegador (F5 não reentra sozinho)');
  ok(J.w.APP.escritorioId === null && J.w.APP.sessao === 'deslogado', 'estado global zerado');
  // entra como usuário do escritório 8
  await login(J, 'teste.b@artecon.local', 'senha-b');
  ok(J.w.APP.sessao === 'ok' && J.w.APP.escritorioId === 8, 'novo login carrega o escritório 8', JSON.stringify({ s: J.w.APP.sessao, e: J.w.APP.escritorioId }));
  J.w.abrirAba('inventario'); J.w.imobInventario();
  await ate(() => /Posi|Falha|escrit/i.test(J.$('iv-out').innerHTML) && !/Carregando a carteira/.test(J.$('iv-out').innerHTML));
  ok(/B-001/.test(J.$('iv-out').innerHTML) && !/TESTE-141/.test(J.$('iv-out').innerHTML), 'escritório 8 vê só o próprio imóvel (B-001), não o TESTE-141');
  await J.w.doLogout(); await dormir(20);
  await login(J, 'teste.a@artecon.local', 'senha-a');
  ok(J.w.APP.escritorioId === 7, 'relogin do usuário A volta ao escritório 7');

  titulo('12. Dados permanecem vinculados ao escritório correto');
  evid.depois = { imoveis: supa.db.atp_imob_imoveis.map(r => ({ id: r.id, codigo: r.codigo_interno, escritorio_id: r.escritorio_id })), calculos: supa.db.atp_imob_calculos.map(r => ({ id: r.id, escritorio_id: r.escritorio_id, hash: r.hash_snapshot, request_id: r.request_id })) };
  ok(JSON.stringify(evid.antes) === JSON.stringify(evid.depois), 'registros idênticos antes e depois de F5/logout/login (nada perdido, nada movido)');
  ok(supa.db.atp_imob_imoveis.filter(r => r.codigo_interno === 'TESTE-141').every(r => r.escritorio_id === 7), 'TESTE-141 segue no escritório 7');
  const semTenant = supa.log.filter(r => r.tabela.startsWith('atp_imob_') && (r.escritorio_chamador == null || (r.body && (Array.isArray(r.body) ? r.body : [r.body]).some(b => b.escritorio_id == null))));
  ok(semTenant.length === 0, 'NENHUMA requisição ao módulo saiu sem escritório (' + supa.log.filter(r => r.tabela.startsWith('atp_imob_')).length + ' requisições auditadas)');

  titulo('R1. Usuário autenticado sem escritório vinculado');
  await J.w.doLogout(); await dormir(20);
  const antesR1 = supa.log.length;
  await login(J, 'sem.vinculo@artecon.local', 'senha-s');
  ok(J.w.APP.sessao === 'sem_vinculo' && J.w.APP.escritorioId === null, 'estado sem_vinculo', J.w.APP.sessao);
  ok(visivel(J.$('sessao-aviso')) && texto(J.$('sessao-aviso')).includes(MSG_SEM_VINCULO), 'aviso: "' + MSG_SEM_VINCULO + '"', texto(J.$('sessao-aviso')));
  J.w.abrirAba('inventario'); J.w.imobInventario(); await dormir(60);
  ok(texto(J.$('iv-out')).includes(MSG_SEM_VINCULO) && !texto(J.$('iv-out')).includes(MSG_TEC), 'inventário mostra a mensagem amigável, não a técnica', texto(J.$('iv-out')).slice(0, 160));
  J.w.imobInventarioExemplo(); await dormir(30);
  ok(/AP-101/.test(J.$('iv-out').innerHTML), 'carteira de exemplo continua funcionando sem escritório');
  J.w.abrirAba('imovel'); J.$('i-cod').value = 'X'; J.$('i-tipo').value = 'comercial'; J.w.imobSalvarImovel(); await dormir(60);
  ok(!supa.log.slice(antesR1).some(r => r.tabela.startsWith('atp_imob_')), 'nenhuma requisição às tabelas do módulo com escritório nulo');
  await J.w.doLogout(); await dormir(20);
  await login(J, 'so.auth@artecon.local', 'senha-x');
  ok(J.w.APP.sessao === 'sem_vinculo' && texto(J.$('sessao-aviso')).includes(MSG_SEM_VINCULO), 'usuário que existe só no Auth (sem cadastro) recebe a mesma mensagem');

  titulo('R2. Falha transitória do banco na entrada → 3 tentativas');
  await J.w.doLogout(); await dormir(20);
  supa.opcoes.falharRestVezes = 2;
  await login(J, 'teste.a@artecon.local', 'senha-a');
  ok(J.w.APP.sessao === 'ok' && J.w.APP.escritorioId === 7, 'escritório carregado na 3ª tentativa após 2 falhas 503');
  await J.w.doLogout(); await dormir(20);
  supa.opcoes.falharRestVezes = 99;
  await login(J, 'teste.a@artecon.local', 'senha-a');
  ok(J.w.APP.sessao === 'falha' && /Tentar novamente/.test(J.$('sessao-aviso').innerHTML), 'falha persistente: aviso com "Tentar novamente", sem termos técnicos', J.w.APP.sessao);
  supa.opcoes.falharRestVezes = 0;
  await J.w.sessaoRecarregar(); await dormir(20);
  ok(J.w.APP.sessao === 'ok' && J.w.APP.escritorioId === 7 && !visivel(J.$('sessao-aviso')), '"Tentar novamente" recupera o escritório e some o aviso');

  titulo('R3. Renovação do token (a casca não tinha SESS_RENOVANDO declarado)');
  J.w.APP.tokenExp = Date.now() + 30000;   // vence em 30 s → supa() precisa renovar antes
  let erroRen = null;
  try { await J.w.supa('GET', 'atp_usuarios', { params: { select: 'email', limit: '1' } }); } catch (e) { erroRen = e; }
  ok(!erroRen, 'supa() renova o token sem ReferenceError', erroRen && erroRen.message);
  ok(J.w.APP.tokenExp > Date.now() + 3000000, 'token renovado (nova validade)');

  titulo('R4. Retorno à aplicação (visibilitychange/focus)');
  J.w.APP.sessao = 'falha'; J.w.APP.escritorioId = null; J.w.SESSAO_REVALIDOU = 0;
  Object.defineProperty(J.w.document, 'visibilityState', { value: 'visible', configurable: true });
  J.w.document.dispatchEvent(new J.w.Event('visibilitychange'));
  await ate(() => J.w.APP.sessao === 'ok', 3000); await dormir(20);
  ok(J.w.APP.sessao === 'ok' && J.w.APP.escritorioId === 7, 'ao voltar à aba, o escritório é recarregado quando faltava');
  ok(J.w.imobAtualizarContexto() === true, 'módulo recebe o contexto ao voltar');

  /* ─────────────── resumo ─────────────── */
  const resumo = `\n${total - falhas}/${total} verificações OK` + (falhas ? ` · ${falhas} FALHA(S)` : '');
  console.log(resumo);
  const rel = { quando: new Date().toISOString(), pasta: RAIZ, total, falhas, linhas, evidencia_persistencia: evid,
    requisicoes_modulo: supa.log.filter(r => r.tabela.startsWith('atp_imob_')).map(r => ({ metodo: r.metodo, tabela: r.tabela, escritorio_chamador: r.escritorio_chamador, escritorio_no_corpo: r.body ? (Array.isArray(r.body) ? r.body : [r.body]).map(b => b.escritorio_id) : null })),
    console_amostra: con.concat(con2).filter(l => /\[sess|\[imob\]/.test(l)).slice(0, 40) };
  try { fs.mkdirSync(path.join(__dirname, 'saida'), { recursive: true }); fs.writeFileSync(path.join(__dirname, 'saida', 'sessao_imob_resultado.json'), JSON.stringify(rel, null, 1)); } catch (e) {}
  J.w.close();
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO NO HARNESS:', e); process.exit(2); });
