// AgentForge Local — executor das tools de busca (F5)
// 👥 RESPONSABILIDADE: Agente 1 (Z) — adicione os cases aqui, ao lado do wikipedia.
// Padrão: retorne { ok: true, result: string } ou { ok: false, error: string };
// retorne null SOMENTE quando o nome não for de busca (o executor core decide o resto).
import type { ToolResult } from "./executor";

const TIMEOUT_MS = 10_000;
const MAX_OUT = 12_000;

async function get(url: string, headers: Record<string, string> = {}): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "AgentForge-Local/0.2 (free; contact: agentforge@example.com)", ...headers },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

export async function executeSearchTool(name: string, args: Record<string, unknown>): Promise<ToolResult | null> {
  try {
    switch (name) {
      case "wikipedia_search": {
        const q = String(args.query ?? "").trim();
        if (!q) return { ok: false, error: "query obrigatória" };
        const lang = args.lang === "en" ? "en" : "pt";
        // 1) busca o título mais relevante
        const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json&origin=*`;
        const s = JSON.parse(await get(searchUrl));
        const hits = s?.query?.search ?? [];
        if (hits.length === 0) return { ok: true, result: `nada encontrado na Wikipédia ${lang} para: ${q}` };
        // 2) pega o resumo (extract) do melhor resultado
        const title = hits[0].title;
        const sumUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
        const sum = JSON.parse(await get(sumUrl));
        const lines = [
          `**${sum.title ?? title}**`,
          sum.extract ?? "(sem resumo)",
          "",
          ...hits.slice(0, 3).map((h: any) => `- ${h.title} → https://${lang}.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, "_"))}`),
        ];
        return { ok: true, result: lines.join("\n").slice(0, MAX_OUT) };
      }
      default:
        return null; // não é tool de busca — deixa o executor core decidir
    }
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? `timeout de ${TIMEOUT_MS / 1000}s` : (e?.message ?? String(e));
    return { ok: false, error: `busca falhou: ${msg}` };
  }
}
