// F5 — testes da search layer (spec docs/07-plano-v02.md §4.3)
// Executar a partir de local/:  bun test src/tools/search.test.ts
//
// Quatro grupos:
//   1. CONTRATO       — cada tool tem description, manual e params documentadas (sem rede)
//   2. CAMINHO TRISTE — query vazia → ok:false; tool desconhecida → null (sem rede)
//   3. PARSERS        — arXiv/Bing com fixtures REAIS; GDELT sintético; DDG inline (sem rede)
//   4. LIVE           — cada tool contra a API REAL (rede disponível; skip se offline)
import { describe, test, expect } from "bun:test";
import { SEARCH_TOOLS } from "./search";
import { executeSearchTool, parseArxivXml, parseBingHtml, formatGdelt, parseDdgLite } from "./search-impl";
import { TOOLS } from "./registry";

const NAMES = SEARCH_TOOLS.map(t => t.name);

// ───────────────────────── 1. CONTRATO ─────────────────────────
describe("contrato: schema das tools de busca", () => {
  test("catálogo tem as 9 tools, com nomes únicos", () => {
    expect(NAMES.length).toBe(9);
    expect(new Set(NAMES).size).toBe(9);
    for (const expected of ["web_search", "arxiv_search", "openalex_search", "hn_search", "stack_search", "github_search", "weather_lookup", "gdelt_search", "wikipedia_search"]) {
      expect(NAMES).toContain(expected);
    }
  });

  test("search layer está ligada no registry (TOOLS = core + search)", () => {
    const registryNames = TOOLS.map(t => t.name);
    for (const n of NAMES) expect(registryNames).toContain(n);
  });

  for (const t of SEARCH_TOOLS) {
    test(`schema ${t.name}`, () => {
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.manual.length).toBeGreaterThan(10);
      expect(Object.values(t.parameters).length).toBeGreaterThan(0);
      for (const [k, p] of Object.entries(t.parameters)) {
        expect(p.description.length, `param '${k}' sem description`).toBeGreaterThan(3);
        expect(["string", "number", "boolean"]).toContain(p.type);
      }
    });
  }
});

// ───────────────────────── 2. CAMINHO TRISTE ─────────────────────────
describe("caminho triste", () => {
  test("query/city vazia → ok:false (não lança)", async () => {
    for (const n of NAMES.filter(n => n !== "weather_lookup")) {
      const r = await executeSearchTool(n, { query: "   " });
      expect(r, n).not.toBeNull();
      expect(r!.ok, n).toBe(false);
      expect(r!.error!.length, n).toBeGreaterThan(3);
    }
    const w = await executeSearchTool("weather_lookup", { city: "  " });
    expect(w).not.toBeNull();
    expect(w!.ok).toBe(false);
  });

  test("tool desconhecida → null (o executor core decide)", async () => {
    expect(await executeSearchTool("essa_nao_existe", {})).toBeNull();
    expect(await executeSearchTool("", {})).toBeNull();
  });

  test("cidade inexistente → ok:false com erro legível (geocoding)", async () => {
    const r = await executeSearchTool("weather_lookup", { city: "Xyzzyxqwerty cidade que nao existe 999" });
    expect(r!.ok).toBe(false);
    expect(r!.error!).toContain("não encontrada");
  }, 15_000);
});

// ───────────── 2½. PARSERS OFFLINE (fixtures REAIS — sem rede) ─────────────
// arXiv e Bing: respostas reais capturadas das APIs. GDELT: sintético no
// formato documentado. O IP deste sandbox é compartilhado — arXiv/GDELT
// aplicam tarpit/429 aqui — então os PARSERS são garantidos offline e os
// live tests validam o caminho completo quando a API colabora.
describe("parsers offline (fixtures)", () => {
  test("parseArxivXml com resposta REAL do arXiv", async () => {
    const xml = await Bun.file(import.meta.dir + "/fixtures/arxiv-sample.xml").text();
    const out = parseArxivXml(xml);
    expect(out).toContain("**PyramidTNT");
    expect(out).toContain("arxiv.org/abs/");
    expect(out).toMatch(/\(\d{4}-\d{2}-\d{2}\)/);
    expect(out).toContain("→");
  });

  test("parseArxivXml com entrada vazia", () => {
    expect(parseArxivXml("<feed></feed>")).toContain("nada no arXiv");
  });

  test("parseBingHtml com SERP REAL do Bing (URLs de-redirectadas)", async () => {
    const html = await Bun.file(import.meta.dir + "/fixtures/bing-sample.html").text();
    const hits = parseBingHtml(html);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    for (const h of hits) {
      expect(h.title.length).toBeGreaterThan(3);
      expect(h.href).toMatch(/^https?:\/\//);
      expect(h.href).not.toContain("bing.com/ck"); // redirect decodificado
    }
    expect(hits[0].href).toContain("bun.sh");
    expect(hits[0].snippet!.length).toBeGreaterThan(10);
  });

  test("parseBingHtml com li sem h2>a é ignorado", () => {
    expect(parseBingHtml('<ol><li class="b_algo"><div>x</div></li></ol>')).toEqual([]);
  });

  test("parseDdgLite: anúncio fora, redirect uddg resolvido, snippet casado (merge A1)", () => {
    const html = [
      '<table>',
      '<tr><td class="result-snippet">snippet um real</td></tr>',
      '<tr><td class="result-snippet">snippet dois real</td></tr>',
      `<tr><td><a class="result-link" href="//duckduckgo.com/l/?uddg=${encodeURIComponent("https://bun.sh/docs")}">Bun — Docs</a></td></tr>`,
      '<tr><td><a class="result-link" href="https://duckduckgo.com/y.js?ad_provider=business&ad_domain=example.com&uddg=https%3A%2F%2Fanuncio.example">PROMOVIDO anuncio</a></td></tr>',
      '<tr><td><a class="result-link" href="https://example.org/real-page">Pagina real</a></td></tr>',
      '</table>',
    ].join("\n");
    const out = parseDdgLite(html);
    expect(out.blocked).toBe(false);
    expect(out.hits.length).toBe(2); // anúncio com ad_provider descartado (A1)
    expect(out.hits[0].href).toBe("https://bun.sh/docs"); // redirect uddg de-embrulhado
    expect(out.hits[0].title).toBe("Bun — Docs");
    expect(out.hits[0].snippet).toBe("snippet um real"); // snippet casado por índice
    expect(out.hits[1].href).toBe("https://example.org/real-page");
    expect(out.hits.some(h => h.href.includes("anuncio"))).toBe(false);
  });

  test("parseDdgLite: página de desafio (captcha) → blocked=true, 0 hits (merge A1)", () => {
    const html = '<html><body>If this persists, please contact us with the anomaly detection reference below. select all squares containing a duck</body></html>';
    const out = parseDdgLite(html);
    expect(out.blocked).toBe(true);
    expect(out.hits.length).toBe(0);
  });

  test("formatGdelt com amostra no formato da API (sintética)", async () => {
    const j = await Bun.file(import.meta.dir + "/fixtures/gdelt-sample.json").json();
    const out = formatGdelt(j);
    expect(out).toContain("example.com");
    expect(out).toContain("2026-11-03 01:30");
    expect(out).toContain("(Brazil)");
    expect(out).toContain("→ https://");
    expect(formatGdelt({ articles: [] })).toBe("");
    expect(formatGdelt({})).toBe("");
  });
});

// ───────────────────────── 3. LIVE (rede real) ─────────────────────────
// Probe rápido: se não há rede, os testes live são pulados (não falham).
const netOk = await (async () => {
  try {
    const r = await fetch("https://hn.algolia.com/api/v1/search?query=test&hitsPerPage=1", {
      signal: AbortSignal.timeout(5_000),
    });
    return r.ok;
  } catch {
    return false;
  }
})();

// ⚠️ O IP deste sandbox de CI é COMPARTILHADO: arXiv/OpenAlex/GDELT aplicam 429
// ou tarpit (conexão abre, resposta nunca chega) aqui — no PC do dono, IP
// residencial, fluem normal. Os PARSERS dessas fontes são garantidos offline
// (seção fixtures acima). O contrato dos live tests destas fontes: resultados
// reais OU o erro LIMPO e acionável. Crash ou erro sujo = falha.
function assertLiveOrRateLimited(r: { ok: boolean; result?: string; error?: string } | null, needle: string, extra = "") {
  expect(r).not.toBeNull();
  if (r!.ok) {
    expect(r!.result!.length).toBeGreaterThan(30);
    expect(r!.result!).toContain(needle);
  } else {
    expect(r!.error!).toMatch(new RegExp(`429|rate limit|timeout${extra}`, "i"));
  }
}

describe(`live: APIs reais ${netOk ? "(rede OK)" : "(SEM rede — pulando)"}`, () => {
  test.skipIf(!netOk)("web_search (DDG → fallback Bing) acha resultados reais", async () => {
    const r = await executeSearchTool("web_search", { query: "bun javascript runtime" });
    expect(r!.ok).toBe(true);
    expect(r!.result!.length).toBeGreaterThan(50);
    expect(r!.result!).toContain("→");
    // links precisam ser reais (não redirect do bing)
    expect(r!.result!).toMatch(/→ https?:\/\/(?!www\.bing\.com\/ck)/);
  }, 25_000);

  test.skipIf(!netOk)("arxiv_search devolve papers com link (ou 429/tarpit limpo)", async () => {
    const r = await executeSearchTool("arxiv_search", { query: "transformer attention", max: 3 });
    assertLiveOrRateLimited(r, "arxiv.org", "|indisponível");
  }, 35_000); // inclui o retry de 3,5s do arXiv

  test.skipIf(!netOk)("openalex_search devolve works com citações (ou 429 limpo)", async () => {
    const r = await executeSearchTool("openalex_search", { query: "large language models" });
    assertLiveOrRateLimited(r, "citações");
  }, 30_000);

  test.skipIf(!netOk)("hn_search devolve hits com pontos", async () => {
    const r = await executeSearchTool("hn_search", { query: "bun javascript runtime" });
    expect(r!.ok).toBe(true);
    expect(r!.result!).toContain("pts");
  }, 20_000);

  test.skipIf(!netOk)("stack_search devolve perguntas com score (ou quota do IP esgotada, erro limpo)", async () => {
    const r = await executeSearchTool("stack_search", { query: "python list comprehension" });
    assertLiveOrRateLimited(r, "stackoverflow.com", "|HTTP 400|quota|throttle");
  }, 20_000);

  test.skipIf(!netOk)("github_search devolve repos com estrelas", async () => {
    const r = await executeSearchTool("github_search", { query: "bun javascript runtime" });
    expect(r!.ok).toBe(true);
    expect(r!.result!).toContain("★");
    expect(r!.result!).toContain("github.com");
  }, 20_000);

  test.skipIf(!netOk)("weather_lookup devolve clima de Manaus", async () => {
    const r = await executeSearchTool("weather_lookup", { city: "Manaus", days: 2 });
    expect(r!.ok).toBe(true);
    expect(r!.result!).toContain("Manaus");
    expect(r!.result!).toContain("°C");
  }, 20_000);

  test.skipIf(!netOk)("gdelt_search devolve notícias (ou 429/tarpit limpo)", async () => {
    const r = await executeSearchTool("gdelt_search", { query: "artificial intelligence" });
    // artigos reais OU vazio gracioso (ok:true) OU 429/timeout/fora-de-formato limpo
    expect(r).not.toBeNull();
    if (r!.ok) expect(r!.result!.length).toBeGreaterThan(20);
    else expect(r!.error!).toMatch(/429|rate limit|timeout|fora do formato|indisponível/i);
  }, 40_000);

  test.skipIf(!netOk)("wikipedia_search (referência) segue funcionando", async () => {
    const r = await executeSearchTool("wikipedia_search", { query: "inteligência artificial", lang: "pt" });
    expect(r!.ok).toBe(true);
    expect(r!.result!).toContain("wikipedia.org");
  }, 20_000);
});
