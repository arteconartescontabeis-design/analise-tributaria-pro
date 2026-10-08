// ═══ Análise Imobiliária Pro — Edge Function "gerar-parecer-imobiliario" (v1.0.0) ═══
// v1.0.0 (08/10/2026): function PRÓPRIA do módulo imobiliário. Até aqui o slot "gerar-parecer-imobiliario"
//   estava publicado com o código da Simulação de Incorporação (v1.4.0), que exige incorporadora/incorporadas
//   e devolvia "payload inválido" para a tela Imobiliária. Este arquivo implementa o contrato que o cliente
//   (modulos/imobiliario/parecerImobIA.js) já esperava: recebe { modo:'imobiliario', contrato, empresa, pacote,
//   blocos_esperados, restricoes, correcao_anterior, versoes } e devolve { textos: { <bloco>: string } }.
//   A GUARDA ANTI-ALUCINAÇÃO é do cliente (motorImob.validarParecerIA): aqui a IA recebe as mesmas regras e
//   os números autorizados, mas quem aprova ou descarta o texto é o app — e texto reprovado NÃO é exibido.
// IA CENTRAL: chama o ia-gateway do projeto Departamento Pessoal. Token: IA_GATEWAY_TOKEN_IMOBILIARIO
//   (cartão próprio no Portal → Consumo de IA) ou, na falta dele, IA_GATEWAY_TOKEN (cartão do Análise
//   Tributária). Mesma estrutura da gerar-parecer v8.0: Verify JWT OFF no gateway (preflight CORS) com
//   validação da sessão AQUI dentro; rate-limit em memória + tabela atp_ia_uso; payload máximo; max_tokens
//   8000 com detecção de corte; reparo tolerante do JSON.
// Secrets usados: IA_GATEWAY_TOKEN_IMOBILIARIO (ou IA_GATEWAY_TOKEN), IA_GATEWAY_URL (opcional),
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

const MAX_PAYLOAD = 200_000;             // o pacote imobiliário traz memória de cálculo e regras — mais largo que o do ATP
const JANELA_MS = 60_000, MAX_POR_JANELA = 6;
const chamadas = new Map<string, number[]>();
async function rateLimitDb(supaUrl: string, usuario: string): Promise<boolean> {
  try {
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!srk || !supaUrl) return true;
    const h = { apikey: srk, authorization: "Bearer " + srk, "content-type": "application/json" };
    await fetch(`${supaUrl}/rest/v1/atp_ia_uso`, { method: "POST", headers: { ...h, prefer: "return=minimal" }, body: JSON.stringify({ usuario }) });
    const desde = new Date(Date.now() - JANELA_MS).toISOString();
    const r = await fetch(`${supaUrl}/rest/v1/atp_ia_uso?usuario=eq.${encodeURIComponent(usuario)}&ts=gte.${encodeURIComponent(desde)}&select=id`,
      { headers: { ...h, prefer: "count=exact", range: "0-0" } });
    const total = parseInt((r.headers.get("content-range") || "/0").split("/")[1] || "0", 10);
    if (Math.random() < 0.05) fetch(`${supaUrl}/rest/v1/atp_ia_uso?ts=lt.${encodeURIComponent(new Date(Date.now() - 3600_000).toISOString())}`, { method: "DELETE", headers: h }).catch(() => {});
    return total <= MAX_POR_JANELA;
  } catch { return true; }   // fail-open: o banco não bloqueia o parecer; a trava de memória é a 1ª barreira
}
function rateLimitOk(chave: string): boolean {
  const agora = Date.now();
  const lista = (chamadas.get(chave) || []).filter(t => agora - t < JANELA_MS);
  if (lista.length >= MAX_POR_JANELA) { chamadas.set(chave, lista); return false; }
  lista.push(agora); chamadas.set(chave, lista);
  if (chamadas.size > 500) for (const [k, v] of chamadas) if (!v.some(t => agora - t < JANELA_MS)) chamadas.delete(k);
  return true;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const GATEWAY_URL = Deno.env.get("IA_GATEWAY_URL") || "https://fbxelwhdiisfmnwrerbl.supabase.co/functions/v1/ia-gateway";

// blocos do parecer imobiliário (mesma lista e ordem de parecerImobIA.js — BLOCOS_TEXTO)
const BLOCOS_PADRAO = ["objetivo", "operacao", "regrasAplicadas", "memoriaComentada", "situacaoAtualEReforma", "comparacoes", "riscos", "recomendacoes", "conclusao", "limitacoes"];
const BLOCO_DESC: Record<string, string> = {
  objetivo: "objetivo do parecer e dados analisados (bloco_01 e bloco_02): operação, data do fato gerador, valor, imóvel/locação/contrato",
  operacao: "a operação e seu enquadramento (bloco_04) e o regime atual da empresa (bloco_03)",
  regrasAplicadas: "as regras legais aplicadas (bloco_05), com nome, status (vigente/vigência futura/transição/interpretação) e fontes de bloco_12; os percentuais usados (bloco_05b) SEMPRE com a categoria (fixado em lei / estimativa / projeção / premissa)",
  memoriaComentada: "a memória de cálculo (bloco_06) comentada passo a passo — só repetindo os números do pacote, nunca refazendo conta",
  situacaoAtualEReforma: "situação atual × Reforma (bloco_07): o que muda com o regime específico de IBS/CBS para bens imóveis",
  comparacoes: "comparações e projeção (bloco_08), citando os valores como constam",
  riscos: "riscos e achados da auditoria (bloco_09) — TODOS, com severidade; nunca omitir",
  recomendacoes: "recomendações (bloco_10) — práticas, condicionadas às premissas",
  conclusao: "conclusão (bloco_11): se permitida, no nível de confiança indicado; se VEDADA, descrever o cálculo e listar o que impede concluir, sem dizer qual regime é mais vantajoso",
  limitacoes: "limitações e premissas (bloco_13) — TODAS, mais o nível de confiança da auditoria",
};
const fmtBR = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v); };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    // IA Central: token próprio do módulo imobiliário, ou o do Análise Tributária na falta dele
    const tokGw = ((Deno.env.get("IA_GATEWAY_TOKEN_IMOBILIARIO") || "").trim()) || ((Deno.env.get("IA_GATEWAY_TOKEN") || "").trim());
    const viaGateway = tokGw.startsWith("iagw_");
    const apiKey = viaGateway ? tokGw : (Deno.env.get("ANTHROPIC_API_KEY") || "").trim();   // último recurso: chave direta
    if (!apiKey) return json({ erro: "Falta o secret IA_GATEWAY_TOKEN_IMOBILIARIO (ou IA_GATEWAY_TOKEN) — token gerado no Portal → Consumo de IA." }, 500);
    const URL_IA = viaGateway ? GATEWAY_URL : "https://api.anthropic.com/v1/messages";

    // sessão do usuário do app (Verify JWT OFF no gateway: a validação é aqui)
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supaUrl = Deno.env.get("SUPABASE_URL") || "";
    if (!token || token === anon) return json({ erro: "Faça login no app para gerar o parecer." }, 401);
    const auth = await fetch(supaUrl + "/auth/v1/user", { headers: { apikey: anon, authorization: "Bearer " + token } });
    if (!auth.ok) return json({ erro: "Sessão inválida ou expirada — entre novamente no app." }, 401);
    const perfilAuth = await auth.json();
    const usuario = (perfilAuth?.id as string) || token.slice(-24);
    const emailIa = String(perfilAuth?.email || usuario).slice(0, 120);
    if (!rateLimitOk(usuario) || !(await rateLimitDb(supaUrl, usuario)))
      return json({ erro: "Muitas gerações em sequência — aguarde um minuto e tente de novo." }, 429);

    const bruto = await req.text();
    if (bruto.length > MAX_PAYLOAD) return json({ erro: "Pacote do parecer grande demais para a função." }, 413);
    const p = JSON.parse(bruto);
    if (p?.modo !== "imobiliario" || !p?.pacote || typeof p.pacote !== "object")
      return json({ erro: "payload inválido: esperado { modo:'imobiliario', pacote, blocos_esperados, restricoes }" }, 400);
    const pacote = p.pacote;
    const R = p.restricoes || {};
    const nums: number[] = Array.isArray(R.numeros_autorizados) ? R.numeros_autorizados : (Array.isArray(pacote.numeros_autorizados) ? pacote.numeros_autorizados : []);
    if (!nums.length) return json({ erro: "pacote sem numeros_autorizados — a guarda anti-alucinação ficaria sem referência" }, 400);
    const marcas: string[] = Array.isArray(R.marcas_de_origem) && R.marcas_de_origem.length ? R.marcas_de_origem : ["vigente", "vigencia_futura", "transicao", "interpretacao_tecnica", "premissa_simulacao"];
    const blocos: string[] = Array.isArray(p.blocos_esperados) && p.blocos_esperados.length ? p.blocos_esperados.map(String) : BLOCOS_PADRAO;
    const permitida = R.conclusao_permitida === true || pacote?.bloco_11_conclusao?.permitida === true;
    const confianca = String(R.nivel_confianca || pacote?.auditoria?.nivel_confianca || pacote?.confianca || "—");
    const emp = p.empresa || {};

    const system = `Você é o redator técnico da Artecon Artes Contábeis (Palhoça/SC) e escreve PARECERES TRIBUTÁRIOS sobre operações com BENS IMÓVEIS (venda, locação, permuta, incorporação) sob a Reforma Tributária do Consumo — EC 132/2023 e LC 214/2025 (regime específico de IBS/CBS para bens imóveis, arts. 251 a 270: redutores de ajuste e social, redução de alíquota, locação, transição) — comparando com a tributação atual (Lucro Presumido, Lucro Real, Simples Nacional, RET).
Você recebe um PACOTE DE CÁLCULO JÁ CALCULADO pelo motor do aplicativo e devolve APENAS os textos do parecer. Um verificador automático confere cada número e cada frase conclusiva do que você escrever; texto reprovado é descartado.

REGRAS ABSOLUTAS:
1. NÃO calcule nada. Não some, não multiplique, não converta, não arredonde, não projete, não compare por diferença. Cite os valores exatamente como constam no pacote, no formato brasileiro (ex.: 1.234,56), sem arredondar nem truncar casas.
2. Use APENAS números presentes em "numeros_autorizados" (abaixo). Anos, números de artigo de lei, versões e percentuais listados em bloco_05b_percentuais também podem ser citados. Qualquer outro número é erro grave.
3. Toda FRASE CONCLUSIVA (que afirma incidência, aplicação de regra, enquadramento, vantagem, resultado) traz a marca de origem entre colchetes ANTES do ponto final, escolhida entre: ${marcas.join(" | ")}. Exemplo: "Aplica-se o redutor social de R$ 100.000,00 [vigencia_futura]."
4. ${permitida ? `Conclusão PERMITIDA no nível de confiança ${confianca}: a conclusão é condicionada às premissas e à regulamentação vigente na data-base, sem linguagem absoluta ("definitivamente", "sem dúvida", "sempre").` : `Conclusão VEDADA pela auditoria do cálculo (nível de confiança ${confianca}): é PROIBIDO afirmar qual regime ou cenário é mais vantajoso ou apresentar conclusão definitiva. No bloco "conclusao", descreva o que o cálculo mostra e liste o que impede a conclusão (bloco_11_conclusao.instrucao e bloco_09).`}
5. Não invente dispositivo legal: use somente o que está em bloco_05_regras_legais e bloco_12_fundamentacao. Ao citar uma regra, diga o status dela (vigente, vigência futura, transição ou interpretação técnica).
6. Todo percentual citado vem com a categoria de bloco_05b_percentuais (fixado em lei / estimativa / projeção / premissa). É PROIBIDO chamar de "alíquota legal" ou "vigente" um percentual cuja categoria não seja LEGAL.
7. Não omita riscos (bloco_09) nem limitações e premissas (bloco_13). Se o pacote trouxer mensagem de auditoria, incorpore-a com as palavras do sistema.
8. Linguagem clara para dono de empresa: frases curtas, tom profissional e direto; ao citar lei, o dispositivo em uma linha.
9. Responda APENAS com JSON válido, sem markdown, sem crase, sem texto fora do JSON, no formato exato:
{"textos":{${blocos.map(b => `"${b}":"..."`).join(",")}}}
Cada chave é um bloco de 1 a 3 parágrafos (texto corrido, sem títulos). Conteúdo de cada bloco:
${blocos.map(b => `- ${b}: ${BLOCO_DESC[b] || "conforme o pacote"}`).join("\n")}

NÚMEROS AUTORIZADOS (os únicos valores que você pode escrever): ${nums.map(fmtBR).join(" · ")}
EMPRESA: ${String(emp.nome || "—")}${emp.cnpj ? " · CNPJ " + String(emp.cnpj) : ""}${emp.regime ? " · regime atual " + String(emp.regime) : ""}${emp.ano ? " · ano-base " + String(emp.ano) : ""}
VERSÕES: ${JSON.stringify(p.versoes || pacote.versoes || {})}${p.correcao_anterior ? `

CORREÇÃO OBRIGATÓRIA — a tentativa anterior foi REPROVADA pelo verificador por estes motivos; corrija todos: ${String(p.correcao_anterior)}` : ""}`;

    const user = "PACOTE DE CÁLCULO (contrato " + String(p.contrato || pacote.contrato_pacote || "parecer-imob-1") + "):\n" + JSON.stringify(pacote, null, 1);

    const r = await fetch(URL_IA, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", ...(viaGateway ? { "x-ia-usuario": emailIa } : {}) },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 8000, system, messages: [{ role: "user", content: user }] }),
    });
    if (!r.ok) {
      const t = await r.text();
      let motivo = ""; try { motivo = String(JSON.parse(t)?.error?.message || ""); } catch { /* não-JSON */ }
      return json({ erro: motivo || ("IA Central " + r.status + ": " + t.slice(0, 300)) }, r.status === 429 || r.status === 403 ? r.status : 502);
    }
    const data = await r.json();
    if (data?.stop_reason === "max_tokens")
      return json({ erro: "A IA precisou de mais espaço do que o limite desta função permite. O parecer sai com a memória determinística." }, 502);
    const texto = (data.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    const limpo = texto.replace(/```json|```/g, "").trim();
    const tentar = (t: string) => { try { return JSON.parse(t); } catch { return null; } };
    let obj: any = tentar(limpo);
    if (!obj) { const m = limpo.match(/\{[\s\S]*\}/); if (m) obj = tentar(m[0]); }
    if (!obj) {
      let t = limpo.slice(limpo.indexOf("{"));
      t = t.replace(/[^}\]"\d\w]+$/, "");
      const pilha: string[] = []; let dentro = false, escapa = false;
      for (const ch of t) {
        if (escapa) { escapa = false; continue; }
        if (ch === "\\") { escapa = true; continue; }
        if (ch === '"') { dentro = !dentro; continue; }
        if (dentro) continue;
        if (ch === "{" || ch === "[") pilha.push(ch); else if (ch === "}" || ch === "]") pilha.pop();
      }
      if (dentro) t += '"';
      t = t.replace(/,\s*$/, "");
      while (pilha.length) t += pilha.pop() === "{" ? "}" : "]";
      obj = tentar(t); if (obj) obj.__reparado = true;
    }
    if (!obj) return json({ erro: "A IA não devolveu JSON válido e não foi possível reparar. Detalhe: " + limpo.slice(0, 160) }, 502);
    if (!obj?.textos || typeof obj.textos !== "object") return json({ erro: "Resposta sem o campo textos." }, 502);
    for (const b of blocos) if (typeof obj.textos[b] !== "string") obj.textos[b] = "";   // bloco ausente = vazio: o cliente acusa "blocos_faltando"
    obj.__funcao = "gerar-parecer-imobiliario v1.0.0";
    return json(obj, 200);
  } catch (e) {
    return json({ erro: "Falha interna: " + (e as Error).message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}
