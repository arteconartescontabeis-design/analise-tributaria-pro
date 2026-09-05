// ═══ Simulação de Incorporação — Edge Function "gerar-parecer-incorporacao" (v1.0) ═══
// Function PRÓPRIA do aplicativo Simulação de Incorporação. A "gerar-parecer" do Análise
// Tributária Pro NÃO é alterada (decisão de 24/08: cada aplicativo tem a sua function).
// Mesma estrutura da gerar-parecer v7.7: Verify JWT OFF no gateway (para o preflight CORS
// passar) com validação da sessão AQUI dentro; rate-limit em memória + tabela atp_ia_uso;
// payload máximo; max_tokens 8000 com detecção de corte; reparo tolerante do JSON.
// A IA NUNCA calcula: recebe os números do motor (isoladas, soma, consolidada, deltas,
// abatimentos, alertas) e devolve só os TEXTOS do parecer de incorporação.
// Secrets usados: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

const MAX_PAYLOAD = 120_000;             // ~120 KB — o payload real do app tem ~5-15 KB
const JANELA_MS = 60_000, MAX_POR_JANELA = 6;
const chamadas = new Map<string, number[]>();
// v7.1b: contador PERSISTENTE no banco (tabela atp_ia_uso) — vale entre instâncias.
// Fail-open: se o banco falhar, o parecer não é bloqueado (a trava de memória segue como 1ª barreira).
async function rateLimitDb(supaUrl: string, usuario: string): Promise<boolean> {
  try {
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!srk || !supaUrl) return true;
    const h = { apikey: srk, authorization: "Bearer " + srk, "content-type": "application/json" };
    await fetch(`${supaUrl}/rest/v1/atp_ia_uso`, { method: "POST",
      headers: { ...h, prefer: "return=minimal" }, body: JSON.stringify({ usuario }) });
    const desde = new Date(Date.now() - JANELA_MS).toISOString();
    const r = await fetch(`${supaUrl}/rest/v1/atp_ia_uso?usuario=eq.${encodeURIComponent(usuario)}&ts=gte.${encodeURIComponent(desde)}&select=id`,
      { headers: { ...h, prefer: "count=exact", range: "0-0" } });
    const total = parseInt((r.headers.get("content-range") || "/0").split("/")[1] || "0", 10);
    if (Math.random() < 0.05) fetch(`${supaUrl}/rest/v1/atp_ia_uso?ts=lt.${encodeURIComponent(new Date(Date.now() - 3600_000).toISOString())}`,
      { method: "DELETE", headers: h }).catch(() => {});
    return total <= MAX_POR_JANELA;
  } catch { return true; }
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ erro: "Secret ANTHROPIC_API_KEY não configurado no Supabase." }, 500);

    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supaUrl = Deno.env.get("SUPABASE_URL") || "";
    if (!token || token === anon) return json({ erro: "Faça login no app para gerar o parecer." }, 401);
    const auth = await fetch(supaUrl + "/auth/v1/user", { headers: { apikey: anon, authorization: "Bearer " + token } });
    if (!auth.ok) return json({ erro: "Sessão inválida ou expirada — entre novamente no app." }, 401);
    const usuario = ((await auth.json())?.id as string) || token.slice(-24);
    if (!rateLimitOk(usuario) || !(await rateLimitDb(supaUrl, usuario)))
      return json({ erro: "Muitas gerações em sequência — aguarde um minuto e tente de novo." }, 429);

    const bruto = await req.text();
    if (bruto.length > MAX_PAYLOAD) return json({ erro: "Dados da simulação grandes demais para o parecer." }, 413);
    const p = JSON.parse(bruto);
    if (!p?.incorporadora?.nome || !Array.isArray(p?.incorporadas) || !p.incorporadas.length || !p?.consolidada || !p?.delta)
      return json({ erro: "payload inválido: faltam incorporadora, incorporadas, consolidada ou delta" }, 400);

    const fmtBR = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? "R$ " + x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"; };
    const ANO_REF = Number(p?.anoReferencia) || 2027;
    const C = p.consolidada, D = p.delta;
    const eleg = String(C.elegivelSimples || "");
    const enq = eleg === "elegivel"
      ? "A empresa CONSOLIDADA fica DENTRO do teto do Simples Nacional (" + fmtBR(C.teto) + "): os três regimes são comparáveis, e a Reforma se lê nos três caminhos (por dentro, híbrido do art. 22-A e regime regular)."
      : eleg === "transicao"
        ? "A empresa CONSOLIDADA ULTRAPASSA o teto do Simples durante o ano-base: a incorporação tende a levar o grupo ao regime regular (Presumido ou Real). A coluna do Simples é referência, não opção durável. É PROIBIDO recomendar permanência no Simples sem ressalva."
        : "A empresa CONSOLIDADA é INELEGÍVEL ao Simples Nacional (RBT12 acima do teto). Compare apenas Lucro Presumido e Lucro Real; trate a coluna do Simples como referência e diga que a incorporação implica saída do regime.";
    const regras: string[] = Array.isArray(p?.regrasDeTexto) ? p.regrasDeTexto : [];
    const blocoRegras = regras.length ? "\n\nREGRAS DE TEXTO ENVIADAS PELO SISTEMA (obrigatórias):\n" + regras.map((r: string, i: number) => (i + 1) + ". " + String(r)).join("\n") : "";
    const blocoAb = Array.isArray(p?.abatimentosIntragrupo) && p.abatimentosIntragrupo.length
      ? "\n\nOPERAÇÕES ENTRE AS EMPRESAS ABATIDAS (campo abatimentosIntragrupo): " + p.abatimentosIntragrupo.map((a: any) => String(a.de) + " → " + String(a.para) + " (" + String(a.natureza) + ") " + fmtBR(a.abatidoDaReceita)).join("; ") + ". Explique que essas operações deixam de existir depois da incorporação e por isso saíram da receita do vendedor e das compras/despesas do comprador. Diga também a limitação: o RBT12 do ano anterior NÃO foi abatido."
      : "\n\nNENHUMA operação entre as empresas foi abatida: se houver vendas ou serviços entre elas, o resultado consolidado está SUPERESTIMADO na receita e no crédito — registre isso como ressalva de dado.";
    const blocoAl = Array.isArray(p?.alertas) && p.alertas.length
      ? "\n\nALERTAS APURADOS PELO SISTEMA (incorpore CADA um em parecer1 ou parecer2, com as palavras do sistema):\n" + p.alertas.map((x: string, i: number) => "  " + (i + 1) + ". " + String(x)).join("\n") : "";

    const system = `Você é o redator técnico da Artecon Artes Contábeis (Palhoça/SC) e escreve pareceres de PLANEJAMENTO SOCIETÁRIO-TRIBUTÁRIO sobre INCORPORAÇÃO de empresas (Lei 6.404/76, arts. 227 e seguintes; CC arts. 1.116 a 1.118), com efeitos no Simples Nacional (LC 123/2006), no Lucro Presumido, no Lucro Real (inclusive a vedação de aproveitar prejuízo fiscal da incorporada — DL 2.341/87, art. 33) e na Reforma Tributária do Consumo (EC 132/2023, LC 214/2025, Res. CGSN 190/2026).

REGRAS ABSOLUTAS:
1. Use SOMENTE os números fornecidos no JSON — nunca calcule, some, subtraia, estime ou invente valores. Cite-os no formato brasileiro (R$ 1.234.567,89).
2. SINAL DO DELTA: delta = consolidada − soma das empresas separadas. POSITIVO é CUSTO tributário da incorporação; NEGATIVO é ECONOMIA. Nunca inverta.
3. ENQUADRAMENTO FIXO (não contrarie): ${enq}
4. Linguagem clara para dono de empresa: frases curtas, tom profissional e direto, sem juridiquês desnecessário; ao citar lei, cite o dispositivo em uma linha.
5. Não afirme que a incorporação "deve" ou "não deve" ser feita de forma absoluta: a recomendação é condicionada às premissas, aos dados disponíveis e à regulamentação vigente na data-base. Expressões proibidas: "com certeza", "sem dúvida", "definitivamente", "a melhor opção".
6. Responda APENAS com JSON válido, sem markdown, sem crase, sem texto fora do JSON.

Formato exato da resposta:
{"textos":{"intro":"...","empresas":"...","premissas":"...","leitura":"...","reforma":"...","parecer1":"...","parecer2":"...","recomendacao":"..."}}

Conteúdo de cada campo (1 parágrafo cada):
- intro: o que é a simulação (incorporação de ${p.incorporadas.map((e: any) => String(e.nome)).join(", ")} por ${String(p.incorporadora.nome)}, ano-base ${p.ano}), por que a carga não é linear (progressividade do Simples, adicional de IRPJ, Reforma) e o que o documento compara.
- empresas: retrato de cada empresa (receita, regime, carga) e da consolidada, citando os valores de empresas[] e consolidada.
- premissas: as premissas listadas em premissas[] e notas[], com as palavras do sistema, em texto corrido.
- leitura: leitura do delta nos três regimes (delta.simples, delta.lucroPresumido, delta.lucroReal), dizendo claramente o que é custo e o que é economia, e qual regime fica mais barato para a consolidada.
- reforma: leitura de reformaAnoAAno com destaque para ${ANO_REF}: por dentro × híbrido × regime regular, consolidada contra a soma, e se o caminho por dentro está bloqueado em algum ano.
- parecer1 e parecer2: o parecer técnico em dois parágrafos, com os porquês; incorporar os alertas.
- recomendacao: UMA frase conclusiva, condicionada às premissas adotadas, aos dados disponíveis e à regulamentação vigente na data-base.${blocoAb}${blocoAl}${blocoRegras}`;

    const user = "Dados da simulação (calculados pelo motor do sistema):\n" + JSON.stringify(p, null, 1);
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 8000, system, messages: [{ role: "user", content: user }] }),
    });
    if (!r.ok) { const t = await r.text(); return json({ erro: "API Anthropic " + r.status + ": " + t.slice(0, 300) }, 502); }
    const data = await r.json();
    if (data?.stop_reason === "max_tokens")
      return json({ erro: "A IA precisou de mais espaço do que o limite desta função permite. O parecer sai com os textos padrão." }, 502);
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
    if (!obj?.textos) return json({ erro: "Resposta sem o campo textos." }, 502);
    for (const k of ["intro","empresas","premissas","leitura","reforma","parecer1","parecer2","recomendacao"])
      if (typeof obj.textos[k] !== "string") obj.textos[k] = "";
    return json(obj, 200);
  } catch (e) {
    return json({ erro: "Falha interna: " + (e as Error).message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}
