// AgentForge Local — executor das tools de busca (F5)
// 👥 RESPONSABILIDADE: Z.ai (líder) — merge seletivo de DUAS implementações
//    paralelas da mesma spec (Z.ai 94f410d + Agente 1 da90c2b1), diretriz do
//    dono em 2026-11-03: "dois códigos → o melhor de cada, num único".
//    Contribuições do Agente 1 marcadas com (A1) — ver docs/07 §8.
// Padrão: retorne { ok: true, result: string } ou { ok: false, error: string };
// retorne null SOMENTE quando o nome não for de busca (o executor core decide o resto).
// Erros devem ser ACIONÁVEIS: dizem o que aconteceu e sugerem fonte alternativa,
// para o agente decidir tentar outra tool na mesma iteração.
//
// Resiliência (aprendidos ao vivo no sandbox, IP compartilhado):
//   • web_search tem DOIS motores: DDG Lite → fallback Bing HTML (IPs de datacenter
//     tomam captcha do DDG; IPs residenciais raramente)
//   • arXiv/OpenAlex: 1 retry com pausa em 429 (etiqueta das APIs)
//   • GDELT: instável por natureza — erro limpo e o agente troca de fonte
import type { ToolResult } from "./executor";

const TIMEOUT_MS = 10_000;
const MAX_OUT = 12_000;
const UA = "AgentForge-Local/0.2 (free; contact: agentforge@example.com)";

// ---------- fetch com timeout ----------
async function fetchT(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = TIMEOUT_MS, ...rest } = init;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function getText(url: string, headers: Record<string, string> = {}, timeoutMs = TIMEOUT_MS): Promise<string> {
  const r = await fetchT(url, { headers: { "user-agent": UA, ...headers }, timeoutMs });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.text();
}

/** GET com 1 retry após pausa quando a API devolve 429 (rate limit educado). */
async function getTextWithRetry(url: string, pauseMs: number, headers: Record<string, string> = {}): Promise<string> {
  try {
    return await getText(url, headers);
  } catch (e: any) {
    if (/429/.test(String(e?.message ?? ""))) {
      await Bun.sleep(pauseMs);
      return getText(url, headers);
    }
    throw e;
  }
}

// ---------- helpers de parse (HTML/XML → texto) ----------
/** Decodifica entidades HTML comuns + numéricas (&#x27; &#39; …). */
function dec(s: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m, n) => named[n] ?? m);
}

/** Remove tags, decodifica entidades e colapsa whitespace. */
function strip(s: string): string {
  return dec(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Extrai o conteúdo da primeira tag <name>…</name> de um chunk XML. */
function tag(xml: string, name: string): string {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? m[1] : "";
}

/** Encoding estilo form (espaço → '+') p/ APIs velhinhas que rejeitam %20
 *  (StackExchange responde 400 com %20 no parâmetro q; GDELT idem). */
function qPlus(s: string): string {
  return encodeURIComponent(s).replace(/%20/g, "+");
}

type Hit = { href: string; title: string; snippet?: string };
export type { Hit };

/** Resolve links de redirect do DDG (//duckduckgo.com/l/?uddg=<enc> → URL real). */
function resolveDdg(u: string): string {
  try {
    if (u.startsWith("//")) u = "https:" + u;
    const parsed = new URL(u);
    return parsed.searchParams.get("uddg") ?? u;
  } catch {
    return u;
  }
}

/** Decodifica redirect do Bing (bing.com/ck/a?...&u=a1<base64url>) → URL real. */
function bingUnwrap(u: string): string {
  try {
    const uu = new URL(dec(u));
    if (uu.pathname.startsWith("/ck/")) {
      const enc = uu.searchParams.get("u") ?? "";
      if (enc.startsWith("a1")) {
        const b64 = enc.slice(2).replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        const real = Buffer.from(padded, "base64").toString("utf8");
        if (/^https?:\/\//.test(real)) return real;
      }
    }
    return u;
  } catch {
    return u;
  }
}

// ---------- motor 1: DuckDuckGo Lite (POST form; GET se a rede filtrar POST) ----------

/** Página de bloqueio/anti-bot? (A1) — o DDG devolve 200 com página de desafio
 *  pra IP de datacenter; sem isto, um BLOQUEIO com 0 resultados seria reportado
 *  como "nada encontrado", o que engana o agente (a query pode ter resultados). */
export function isBlockedPage(html: string): boolean {
  return /anomaly|challenge|captcha|unusual traffic|access denied|request blocked/i.test(html ?? "");
}

/** Parser do DDG Lite — exportado p/ teste offline. (A1) filtro de anúncios:
 *  redirects do DDG com ad_provider/ad_domain são descartados do resultado. */
export function parseDdgLite(html: string): { hits: Hit[]; blocked: boolean } {
  const hits: Hit[] = [];
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const attrs = m[1];
    if (!/class=["'][^"']*result-link/i.test(attrs)) continue;
    const href = /href=["']([^"']+)["']/i.exec(attrs)?.[1] ?? "";
    const title = strip(m[2]);
    if (!href || !title) continue;
    try { // anúncio do DDG Lite (A1): marcadores de ad no redirect → fora
      const u = new URL(href.startsWith("//") ? "https:" + href : href, "https://duckduckgo.com");
      if (u.searchParams.has("ad_provider") || u.searchParams.has("ad_domain")) continue;
    } catch { /* href relativo estranho — segue como veio */ }
    hits.push({ href: resolveDdg(href), title });
  }
  const snippets: string[] = [];
  const snipRe = /<td[^>]*class=["'][^"']*result-snippet[^"']*["'][^>]*>([\s\S]*?)<\/td>/gi;
  while ((m = snipRe.exec(html)) !== null) snippets.push(strip(m[1]));
  hits.forEach((h, i) => { if (snippets[i]) h.snippet = snippets[i]; });
  return { hits, blocked: isBlockedPage(html) };
}

async function ddgLite(q: string): Promise<{ hits: Hit[]; blocked: boolean }> {
  const r = await fetchT("https://lite.duckduckgo.com/lite/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA, accept: "text/html" },
    body: new URLSearchParams({ q }).toString(),
    timeoutMs: 8_000,
  });
  if (r.status === 429) throw new Error("HTTP 429 (rate limit) — tentando Bing");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const out = parseDdgLite(await r.text());
  // (A1) POST filtrado por rede intermediária? 0 resultados SEM página de
  // bloqueio → tenta GET no mesmo motor (captcha é bloqueio: GET não ajudaria)
  if (out.hits.length === 0 && !out.blocked) {
    const r2 = await fetchT(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`, {
      headers: { "user-agent": UA, accept: "text/html" },
      timeoutMs: 8_000,
    });
    if (r2.ok) return parseDdgLite(await r2.text());
  }
  return out;
}

// ---------- motor 2 (fallback): Bing HTML ----------
/** Parser do SERP do Bing — exportado p/ teste offline com fixture real. */
export function parseBingHtml(html: string): Hit[] {
  const hits: Hit[] = [];
  const liRe = /<li class="b_algo[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
  let m: RegExpExecArray | null;
  while ((m = liRe.exec(html)) !== null) {
    const li = m[1];
    const a = /<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(li);
    if (!a) continue;
    const href = bingUnwrap(a[1]);
    const title = strip(a[2]);
    if (!href || !title) continue;
    const sn =
      /<p class="b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(li) ??
      /<div class="b_caption[^"]*"[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/.exec(li);
    hits.push({ href, title, snippet: sn ? strip(sn[1]) : undefined });
  }
  return hits;
}

async function bingSearch(q: string): Promise<{ hits: Hit[]; blocked: boolean }> {
  const r = await fetchT(`https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=en&count=10`, {
    headers: { "user-agent": UA, accept: "text/html", "accept-language": "en-US,en;q=0.9" },
    timeoutMs: 10_000,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} (Bing)`);
  const html = await r.text();
  return { hits: parseBingHtml(html), blocked: isBlockedPage(html) };
}

// Códigos WMO (Open-Meteo) em PT-BR — subconjunto dos mais comuns
const WMO: Record<number, string> = {
  0: "céu limpo", 1: "predominantemente limpo", 2: "parcialmente nublado", 3: "nublado",
  45: "neblina", 48: "neblina com geada",
  51: "garoa leve", 53: "garoa", 55: "garoa forte",
  61: "chuva leve", 63: "chuva", 65: "chuva forte", 66: "chuva congelante", 67: "chuva congelante forte",
  71: "neve leve", 73: "neve", 75: "neve forte", 77: "grãos de neve",
  80: "pancadas de chuva leves", 81: "pancadas de chuva", 82: "pancadas violentas",
  85: "neve em pancadas", 86: "neve em pancadas forte",
  95: "tempestade", 96: "tempestade com granizo", 99: "tempestade com granizo forte",
};

/** "20261103T043000Z" → "2026-11-03 04:30" */
function gdeltDate(s: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(s ?? "");
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` : (s ?? "");
}

/** Parser do Atom XML do arXiv — exportado p/ teste offline com fixture real. */
export function parseArxivXml(xml: string): string {
  const entries = xml.split("<entry>").slice(1);
  if (entries.length === 0) return `nada no arXiv para: (query)`;
  const lines = entries.map(e => {
    const title = strip(tag(e, "title")) || "(sem título)";
    const id = tag(e, "id").trim();
    const pub = tag(e, "published").slice(0, 10);
    const summary = strip(tag(e, "summary")).slice(0, 220);
    return `**${title}** (${pub})\n  ${summary}…\n  → ${id}`;
  });
  return lines.join("\n\n").slice(0, MAX_OUT);
}

/** Formatador do JSON do GDELT — exportado p/ teste offline. Vazio → "". */
export function formatGdelt(j: any): string {
  const arts = j?.articles ?? [];
  if (!Array.isArray(arts) || arts.length === 0) return "";
  const lines = arts.slice(0, 10).map((a: any) =>
    `**${strip(a.title ?? "")}** — ${gdeltDate(a.seendate)} · ${a.domain ?? "?"}${a.sourcecountry ? ` (${a.sourcecountry})` : ""}\n  → ${a.url}`
  );
  return lines.join("\n").slice(0, MAX_OUT);
}

export async function executeSearchTool(name: string, args: Record<string, unknown>): Promise<ToolResult | null> {
  try {
    switch (name) {
      // ── 1. web_search — DDG Lite → fallback Bing ─────────────────────
      case "web_search": {
        const q = String(args.query ?? "").trim();
        if (!q) return { ok: false, error: "query obrigatória" };
        let hits: Hit[] = [];
        let engine = "duckduckgo";
        let blocked = false;
        try {
          const d = await ddgLite(q);
          hits = d.hits; blocked = d.blocked;
        } catch {
          hits = []; // DDG fora/rate-limit na rede → Bing decide
        }
        if (hits.length === 0) {
          engine = "bing";
          const b = await bingSearch(q); // se o Bing também falhar, o catch externo devolve erro limpo
          hits = b.hits; blocked = blocked || b.blocked;
        }
        if (hits.length === 0) {
          // (A1) distinguir BLOQUEIO de vazio: "nada encontrado" num bloqueio engana o agente
          if (blocked) {
            return { ok: false, error: "DDG e Bing bloquearam a requisição (anti-bot/captcha) — tente wikipedia_search, hn_search ou gdelt_search" };
          }
          return { ok: true, result: `nada encontrado para: ${q} — tente termos diferentes ou outra fonte (wikipedia_search, hn_search, gdelt_search)` };
        }
        const lines = hits.slice(0, 8).map((h, i) =>
          `**${i + 1}. ${h.title}**${h.snippet ? `\n  ${h.snippet.slice(0, 240)}` : ""}\n  → ${h.href}`
        );
        const note = engine === "bing" ? "\n\n(motor: Bing — DDG indisponível agora)" : "";
        return { ok: true, result: (lines.join("\n\n") + note).slice(0, MAX_OUT) };
      }

      // ── 2. arxiv_search — Atom XML (etiqueta: 1 req/3s; retry em 429) ─
      case "arxiv_search": {
        const q = String(args.query ?? "").trim();
        if (!q) return { ok: false, error: "query obrigatória" };
        const max = Math.min(Math.max(Number(args.max ?? 5) || 5, 1), 10);
        const xml = await getTextWithRetry(
          `https://export.arxiv.org/api/query?search_query=${encodeURIComponent("all:" + q)}&max_results=${max}`,
          3_500 // arXiv pede ≥3s entre requisições
        );
        const out = parseArxivXml(xml);
        return { ok: true, result: out === "nada no arXiv para: (query)" ? `nada no arXiv para: ${q}` : out };
      }

      // ── 3. openalex_search — JSON (retry em 429) ─────────────────────
      case "openalex_search": {
        const q = String(args.query ?? "").trim();
        if (!q) return { ok: false, error: "query obrigatória" };
        const j = JSON.parse(await getTextWithRetry(
          `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=10&mailto=agentforge@example.com`,
          2_500
        ));
        const works = j?.results ?? [];
        if (works.length === 0) return { ok: true, result: `nada no OpenAlex para: ${q}` };
        const lines = works.map((w: any) =>
          `**${w.display_name ?? "(sem título)"}** (${w.publication_year ?? "?"}) — ${w.cited_by_count ?? 0} citações\n  → ${w.doi ?? "(sem DOI)"}`
        );
        return { ok: true, result: lines.join("\n").slice(0, MAX_OUT) };
      }

      // ── 4. hn_search — JSON (Algolia) ────────────────────────────────
      case "hn_search": {
        const q = String(args.query ?? "").trim();
        if (!q) return { ok: false, error: "query obrigatória" };
        const j = JSON.parse(await getText(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&hitsPerPage=15`));
        const hits = (j?.hits ?? []).filter((h: any) => h?.title);
        if (hits.length === 0) return { ok: true, result: `nada no Hacker News para: ${q}` };
        const lines = hits.slice(0, 10).map((h: any) =>
          `**${h.title}** — ${h.points ?? 0} pts · ${h.num_comments ?? 0} comentários\n  → ${h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`}`
        );
        return { ok: true, result: lines.join("\n").slice(0, MAX_OUT) };
      }

      // ── 5. stack_search — JSON (gzip automático no Bun) ──────────────
      case "stack_search": {
        const q = String(args.query ?? "").trim();
        if (!q) return { ok: false, error: "query obrigatória" };
        let raw: string;
        try {
          raw = await getText(`https://api.stackexchange.com/2.3/search/advanced?q=${qPlus(q)}&site=stackoverflow&pagesize=15&sort=relevance`);
        } catch (e: any) {
          // throttle_violation chega como HTTP 400 (não 429): quota diária do IP
          if (String(e?.message).includes("400")) throw new Error("HTTP 400 — quota diária da StackExchange esgotada neste IP (throttle_violation); use web_search ou aguarde o reset (~24h)");
          throw e;
        }
        const j = JSON.parse(raw);
        const items = j?.items ?? [];
        if (items.length === 0) return { ok: true, result: `nada no Stack Overflow para: ${q}` };
        const lines = items.slice(0, 10).map((it: any) =>
          `**${strip(it.title ?? "")}** — score ${it.score ?? 0}${it.is_answered ? " · ✓ respondida" : ""} (${it.answer_count ?? 0} respostas)\n  → ${it.link}`
        );
        return { ok: true, result: lines.join("\n").slice(0, MAX_OUT) };
      }

      // ── 6. github_search — JSON (sem token; 10 req/min) ──────────────
      case "github_search": {
        const q = String(args.query ?? "").trim();
        if (!q) return { ok: false, error: "query obrigatória" };
        let raw: string;
        try {
          raw = await getText(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=10`);
        } catch (e: any) {
          if (String(e?.message).includes("403")) throw new Error("HTTP 403 — rate limit do GitHub sem token (10 req/min); aguarde ~1min ou use web_search");
          throw e;
        }
        const j = JSON.parse(raw);
        const items = j?.items ?? [];
        if (items.length === 0) return { ok: true, result: `nenhum repositório no GitHub para: ${q}` };
        const lines = items.slice(0, 10).map((r: any) =>
          `**${r.full_name}** — ★ ${r.stargazers_count ?? 0}${r.language ? ` · ${r.language}` : ""}\n  ${r.description ?? "(sem descrição)"}\n  → ${r.html_url}`
        );
        return { ok: true, result: lines.join("\n").slice(0, MAX_OUT) };
      }

      // ── 7. weather_lookup — Open-Meteo (geocoding + forecast) ────────
      case "weather_lookup": {
        const city = String(args.city ?? args.query ?? "").trim(); // (A1) alias: o LLM às vezes passa 'query'
        if (!city) return { ok: false, error: "city obrigatória (ex: 'Manaus')" };
        const days = Math.min(Math.max(Number(args.days ?? 3) || 3, 1), 7);
        const gj = JSON.parse(await getText(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt&format=json`));
        const g = gj?.results?.[0];
        if (!g) return { ok: false, error: `cidade não encontrada: ${city} — confira a grafia (ex: 'Sao Paulo', 'New York')` };
        const fj = JSON.parse(await getText(
          `https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}` +
          `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=${days}&timezone=auto`
        ));
        const cur = fj?.current ?? {};
        const daily = fj?.daily ?? {};
        const where = [g.name, g.admin1, g.country].filter(Boolean).join(", ");
        const lines = [
          `**Clima em ${where}** (${fj?.timezone ?? "?"})`,
          `Agora: ${cur.temperature_2m ?? "?"}°C (sensação ${cur.apparent_temperature ?? "?"}°C), ${WMO[cur.weather_code] ?? "código " + cur.weather_code}, umidade ${cur.relative_humidity_2m ?? "?"}%, vento ${cur.wind_speed_10m ?? "?"} km/h`,
        ];
        const times: string[] = daily.time ?? [];
        times.forEach((d: string, i: number) => {
          const wd = new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(new Date(d + "T12:00:00"));
          lines.push(`${wd} ${d.slice(5)}: mín ${daily.temperature_2m_min?.[i] ?? "?"}°C · máx ${daily.temperature_2m_max?.[i] ?? "?"}°C — ${WMO[daily.weather_code?.[i]] ?? "?"}`);
        });
        return { ok: true, result: lines.join("\n").slice(0, MAX_OUT) };
      }

      // ── 8. gdelt_search — JSON (notícias globais; timeout 20s: cold-start
      //        de ~13s medido em campo (A1) + 429 de IP compartilhado chega em
      //        ~11s — o timeout só corta o silêncio total) ──────────────────
      case "gdelt_search": {
        const q = String(args.query ?? "").trim();
        if (!q) return { ok: false, error: "query obrigatória" };
        const raw = await getText(`https://api.gdeltproject.org/api/v2/doc/doc?query=${qPlus(q)}&mode=artlist&maxrecords=15&sort=datedesc&format=json`, {}, 20_000);
        let j: any;
        try {
          j = JSON.parse(raw);
        } catch {
          return { ok: false, error: "GDELT respondeu fora do formato (serviço instável) — tente web_search" };
        }
        const out = formatGdelt(j);
        if (!out) {
          return { ok: true, result: `GDELT sem artigos para: ${q} — reformule a query (termos em inglês ajudam) ou use web_search` };
        }
        return { ok: true, result: out };
      }

      // ── 9. wikipedia_search — referência (padrão de ouro) ────────────
      case "wikipedia_search": {
        const q = String(args.query ?? "").trim();
        if (!q) return { ok: false, error: "query obrigatória" };
        const lang = args.lang === "en" ? "en" : "pt";
        // 1) busca o título mais relevante
        const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json&origin=*`;
        const s = JSON.parse(await getText(searchUrl));
        const hits = s?.query?.search ?? [];
        if (hits.length === 0) return { ok: true, result: `nada encontrado na Wikipédia ${lang} para: ${q}` };
        // 2) pega o resumo (extract) do melhor resultado
        const title = hits[0].title;
        const sumUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
        const sum = JSON.parse(await getText(sumUrl));
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
    const aborted = /abort/i.test(String(e?.name ?? "")) || /aborted|cancelled/i.test(String(e?.message ?? ""));
    const msg = aborted ? "timeout — fonte lenta ou indisponível; tente outra tool (web_search, wikipedia_search, hn_search)" : (e?.message ?? String(e));
    return { ok: false, error: `busca falhou: ${msg}` };
  }
}
