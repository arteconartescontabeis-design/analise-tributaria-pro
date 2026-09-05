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
  // ── v1.1.0 · RELATÓRIOS copiados do index (os mesmos da aba Relatórios do Análise Tributária Pro) ──
  B.mesesRot = faixa(/^const MESES_ROT = /, /^const MODELO_TPL_PATHS/).txt;                  // MESES_ROT
  B.triExp   = faixa(/^const TRI_EXP_CFOPS/, /^function triParse\(/).txt;                    // TRI_EXP_CFOPS (Resumo Estatístico)
  B.origemRot = faixa(/^const ORIGEM_ROT/, /^function anOrigemMarcar/).txt;                  // ORIGEM_ROT (trilha de origem no bloco 0)
  B.pgBlocos = faixa(/^const PG_BLOCOS/, /^let PG_DADOS/).txt;                               // PG_BLOCOS (rótulos dos blocos de receita)
  B.rfConfExp = faixa(/^function rfConfereExportacao/, /^function rfAvisoExportacaoHtml/).txt; // rfConfereExportacao
  B.rlEstado = faixa(/^let RL = \{/, /^async function rlCarregar/).txt;                      // RL, RL_CHARTS, PER_ROTULOS, agrupar
  B.rlCharts = faixa(/^function rlLimparCharts/, /^\/\/ ═+ v7\.34\.0: página única do parecer/).txt; // rlLimparCharts, rlQuadroTribPgdas, rlChart, CORES
  B.rlBaseReforma = faixa(/^function rlBaseReforma/, /^function parecerDados/).txt;          // rlBaseReforma (base única da Reforma)
  B.rlCnpj   = faixa(/^async function rlCnpjRender/, /^\/\/ ═+ v6: RELATÓRIO CONSOLIDADO/).txt; // Resumo Estatístico
  B.rlRfTrib = faixa(/^\/\/ ═+ Notas fiscais do período/, /^async function rlCtBuscar/).txt;   // CT_MIN, rlRfTribHtml, rlRfTribTrocar
  B.conferencia = faixa(/^\/\/ ═+ Conferência de cálculos — memória/, /^async function rlSalvarERecarregar/).txt; // CF, rlConf*, rlStatusProj, rlCmpHtml, rlProjTrocar…
  B.rlRegimes = faixa(/^function rlRegimes\(/, /^function rlRegistros\(/).txt;                // Comparativo de regimes (resumo anual + memória INSS/IRPJ/CSLL)
  B.rlReforma = faixa(/^function refCenCard\(/, /^\/\/ ═+ DASHBOARD DE ANÁLISES/).txt;         // refCenCard, rlReforma (ano a ano + abertura IBS/CBS)
  B.versao   = (html.match(/^const APP_VERSAO = '([^']+)';/m)||[])[1];
  B.lacreHash = (html.match(/^const LACRE_HASH = '([^']+)';/m)||[])[1];
  return B;
}
module.exports = { blocos };
if (require.main === module) {
  const B = blocos(fs.readFileSync(process.argv[2]||'index.html','utf8'));
  for (const k of Object.keys(B)) console.log(k.padEnd(12), typeof B[k]==='string' ? B[k].length+' bytes' : B[k]);
}
