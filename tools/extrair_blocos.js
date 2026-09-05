// Extrai do index.html os blocos que o incorporacao.html COPIA (núcleo + motor). Usado pelo build.
const fs = require('fs');
function blocos(html){
  const L = html.split('\n');
  const idx = (re, from=0) => { for (let i=from;i<L.length;i++) if (re.test(L[i])) return i; throw new Error('âncora não achada: '+re); };
  const faixa = (reIni, reFim, from=0) => { const a = idx(reIni, from), b = idx(reFim, a+1); return { a, b, txt: L.slice(a, b).join('\n') }; };
  const B = {};
  // CSS: do primeiro <style> ao último </style> antes do <body>
  { const a = idx(/^<style>/), body = idx(/^<body>/); let b = a; for (let i=a;i<body;i++) if (/^<\/style>/.test(L[i])) b = i; B.css = L.slice(a, b+1).join('\n'); }
  B.nucleo   = faixa(/^\/\/ ── CONFIG/, /^async function entrar\(\)/).txt;                  // supa, login, sessão, supaFn, logout
  B.dialogos = faixa(/^async function comBotao/, /^function extrairCNPJs/).txt;              // comBotao, dlg, dlgSimNao, toast, limparCNPJ, fmtCNPJ, validaCNPJ
  B.motor    = faixa(/^const FAIXAS_LIM/, /^let PARAMS = \{/).txt;                          // tabelas, calcular, projeção, sublimite, LR
  B.params   = faixa(/^let PARAMS = \{/, /^let AN = null/).txt;                             // PARAMS
  B.helpers  = faixa(/^let EMPRESAS = \[\];/, /^\/\/ ═+ ANÁLISE: DEFINIÇÃO DAS SEÇÕES/).txt; // MESES, esc, fmt*, r2, somaExib, totExib, z12, anNovo
  B.normalizar = faixa(/^function anNormalizar\(/, /^\/\/ ── v7\.51\.0 · SELO DAS JANELAS/).txt;
  B.iniAtiv  = faixa(/^function iniAtividadeValido/, /^function anAvisoInicioAtividade/).txt; // iniAtividadeValido, iniAvisoInvalido, iniPorExtenso, MESES_LONGO, anMesesAtividade
  B.folhaPerc = faixa(/^function ratAjustado/, /^function cfgCredLRSet/).txt;               // ratAjustado, folhaPercDaEmpresa
  B.snEleg   = faixa(/^const SN_TETO_CHEIO/, /^function snPerguntarAnterior/).txt;          // SN_TETO, snElegibilidade
  B.prCarregar = faixa(/^async function prCarregar\(\)/, /^let EMP_EDIT/).txt;                   // prRestaurar, prCarregar
  B.reformaDefs = faixa(/^const RF_ANOS/, /^function prCgibs14/).txt;                   // RF_ANOS, RF_ALIQ_DEFAULT, RF_REDUCOES, RF_CONTRA, RF, rfNormalizar, rfNovo, prCgibs14, prRenderAliq
  B.reformaCalc = faixa(/^function rfContraEfetivo/, /^const QX_R2/).txt;                   // rfContraEfetivo, rfLinhaBase, cenDentro, calcCenariosReforma
  B.lacre    = faixa(/^const LACRE_CASOS/, /^let RF_MARCO/).txt;                            // LACRE_CASOS, LACRE_HASH, lacreHash, lacreRodar, lacreBoot, lacreRender
  B.ppDoc    = faixa(/^const PP_CAP/, /^async function rlCnpjRender/).txt;                  // PP_CAP, ppDocumento
  B.ppMedir  = faixa(/^const PP_RESERVA_MM/, /^async function parecerIA/).txt;             // ppEmpacotarDOM, ppMedirPaginas, ppTimbradoStatus, ppReguaRender
  B.versao   = (html.match(/^const APP_VERSAO = '([^']+)';/m)||[])[1];
  B.lacreHash = (html.match(/^const LACRE_HASH = '([^']+)';/m)||[])[1];
  return B;
}
module.exports = { blocos };
if (require.main === module) {
  const B = blocos(fs.readFileSync(process.argv[2]||'index.html','utf8'));
  for (const k of Object.keys(B)) console.log(k.padEnd(12), typeof B[k]==='string' ? B[k].length+' bytes' : B[k]);
}
