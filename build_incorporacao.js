#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════════════════
//  Simulação de Incorporação — BUILD
//  Uso:  node tools/build_incorporacao.js            (a partir da raiz do repositório)
//  Lê o index.html (Análise Tributária Pro), COPIA por âncoras os blocos que o incorporação
//  reaproveita (CSS, núcleo Supabase/sessão, motor lacrado, projeção, Reforma, lacre, papel
//  timbrado) e os une aos fontes próprios em src/, gerando incorporacao.html na raiz.
//  Rode de novo sempre que o index.html re-selar o lacre (a tela do incorporação avisa).
//  v1.1.0: os RELATÓRIOS da aba Relatórios do index (conferência, comparativo de regimes, Reforma,
//  Resumo Estatístico) também são copiados por âncoras — a lista está em ORDEM e é conferida pela suíte.
//  Única alteração feita em bloco copiado: a chave do localStorage do lacre ('atp_lacre' →
//  'atp_lacre_inc'), para que os dois aplicativos não fiquem se revalidando um ao outro.
// ════════════════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const { blocos } = require('./extrair_blocos.js');
const RAIZ = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const B = blocos(html);
const src = f => fs.readFileSync(path.join(RAIZ, 'src', f), 'utf8');

const lacre = B.lacre.replace(/'atp_lacre'/g, "'atp_lacre_inc'");
if (lacre === B.lacre) throw new Error('bloco do lacre: chave atp_lacre não encontrada para renomear');

const ORDEM = ['nucleo','dialogos','motor','params','helpers','normalizar','iniAtiv','folhaPerc','snEleg','prCarregar','reformaDefs','reformaCalc','ppDoc','ppMedir',
  // v1.1.0 · relatórios do Análise Tributária Pro (copiados pelas mesmas âncoras; rlRender é PRÓPRIO do incorporação — src/incorporacao_app_4.js)
  'mesesRot','triExp','origemRot','pgBlocos','rfConfExp','rlEstado','rlCharts','rlBaseReforma','rlCnpj','rlRfTrib','conferencia','rlRegimes','rlReforma'];

const copiado = ORDEM.map(k => `// ┌── copiado do index.html: bloco "${k}" ──\n${B[k]}`).join('\n\n') + `\n\n// ┌── copiado do index.html: bloco "lacre" (chave do localStorage renomeada) ──\n${lacre}`;

const out = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Simulação de Incorporação — Artecon</title>
<!-- GERADO por tools/build_incorporacao.js a partir do index.html v${B.versao} (lacre ${B.lacreHash}) em ${new Date().toISOString()}. NÃO EDITE À MÃO: edite src/ e rode o build. -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet">
${B.css}
</head>
<body>
${src('incorporacao_body.html')}
<script>
${copiado}
// └── fim dos blocos copiados do index.html ──

${src('incorporacao_app_1.js')}
${src('incorporacao_app_2.js')}
${src('incorporacao_app_3.js')}
${src('incorporacao_app_4.js')}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(RAIZ, 'incorporacao.html'), out);
console.log(`incorporacao.html gerado: ${Buffer.byteLength(out)} bytes · base index v${B.versao} · lacre ${B.lacreHash}`);
