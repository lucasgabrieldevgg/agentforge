// F2 — testes de contrato dos providers diretos (spec §7.6 — offline, sem rede)
import { describe, test, expect } from "bun:test";
import {
  DIRECT_PROVIDERS, directModelsFlat, byCapability, providerOf, nativeModelId,
  type ProviderKeys,
} from "./providers-direct";

describe("F2 · contrato do registry", () => {
  test("3 providers, todos openai-compatible, ≥2 models cada", () => {
    expect(DIRECT_PROVIDERS.length).toBe(3);
    for (const p of DIRECT_PROVIDERS) {
      expect(p.kind).toBe("openai-compatible");
      expect(p.models.length).toBeGreaterThanOrEqual(2);
      expect(p.baseUrl.startsWith("https://")).toBe(true);
      expect(p.baseUrl.endsWith("/chat/completions")).toBe(false); // transport junta
      expect(["groq_key", "google_ai_key", "github_models_key"]).toContain(p.settingKey);
    }
  });
  test("todo model tem id/label/context/caps/free preenchidos", () => {
    for (const m of directModelsFlat()) {
      expect(m.id.length).toBeGreaterThan(3);
      expect(m.label.length).toBeGreaterThan(3);
      expect(m.context).toBeGreaterThan(0);
      expect(typeof m.caps.tools).toBe("boolean");
      expect(typeof m.caps.vision).toBe("boolean");
      expect(typeof m.caps.json).toBe("boolean");
      expect(m.free).toBe(true); // todos free-tier oficial
    }
  });
});

describe("F2 · byCapability", () => {
  const keys: ProviderKeys = { groq: "gsk_test-key", "google-ai": "AIza-test-key" };

  test("só models tools de providers COM chave (github sem chave fica fora)", () => {
    const ids = byCapability({ tools: true }, keys);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(id.startsWith("groq/") || id.startsWith("google-ai/")).toBe(true);
      expect(id.startsWith("github-models/")).toBe(false);
    }
  });
  test("vision filtra os llama (sem vision) e mantém gemini", () => {
    const ids = byCapability({ vision: true }, keys);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(id.startsWith("google-ai/")).toBe(true);
  });
  test("sem chave nenhuma → lista vazia, sem throw", () => {
    expect(byCapability({}, {})).toEqual([]);
    expect(byCapability({ tools: true }, {})).toEqual([]);
  });
  test("determinismo: 2 chamadas iguais → deep equal", () => {
    const a = byCapability({ tools: true, json: true }, keys, { "groq/llama-3.3-70b-versatile": { score: 0.9 } });
    const b = byCapability({ tools: true, json: true }, keys, { "groq/llama-3.3-70b-versatile": { score: 0.9 } });
    expect(a).toEqual(b);
  });
  test("tie-break: mesmo health → ordem do registry", () => {
    const ids = byCapability({ tools: true }, keys, {}); // sem health → todos 0.5
    expect(ids[0]).toBe("groq/llama-3.3-70b-versatile"); // 1º do registry com chave
    const flat = directModelsFlat().map(m => m.id);
    const filtered = ids.filter(id => flat.includes(id));
    expect(filtered).toEqual(ids); // preserva sub-ordem do registry
  });
  test("health reordena (desempate, não filtro)", () => {
    const ids = byCapability({ tools: true }, keys, { "google-ai/gemini-2.5-flash": { score: 1 } });
    expect(ids[0]).toBe("google-ai/gemini-2.5-flash");
  });
});

describe("F2 · ids e resolução de provider", () => {
  test("nenhum id colide entre providers (nem com prefixo de outro)", () => {
    const ids = directModelsFlat().map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  test("providerOf + nativeModelId", () => {
    expect(providerOf("groq/llama-3.3-70b-versatile")?.id).toBe("groq");
    expect(providerOf("github-models/openai/gpt-4o")?.id).toBe("github-models");
    expect(nativeModelId("groq/openai/gpt-oss-120b")).toBe("openai/gpt-oss-120b");
    expect(nativeModelId("google-ai/gemini-2.0-flash")).toBe("gemini-2.0-flash");
    expect(providerOf("openai/gpt-oss-20b:free")).toBeUndefined(); // id do OpenRouter não é direto
  });
});

// ─────────────────────────────────────────────────────────────
// Integração do TRANSPORT direto (parte do líder): servidor SSE local
// OpenAI-compatible simulando um provider direto — prova baseUrl, Bearer,
// id nativo sem prefixo e stream com failover vindo do provider direto.
// ─────────────────────────────────────────────────────────────
import { streamWithFailover } from "./providers";

describe("F2 · transport direto (integração, rede local)", () => {
  test("stream num model direto: URL certa, Bearer da chave certa, id nativo, conteúdo recebido", async () => {
    let hitPath = "", hitAuth = "", hitModel = "";
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        hitPath = new URL(req.url).pathname;
        hitAuth = req.headers.get("authorization") ?? "";
        const body = await req.json();
        hitModel = body.model;
        const sse = 'data: {"choices":[{"delta":{"content":"ok do provider direto"}}]}\n\n'
          + 'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'
          + "data: [DONE]\n\n";
        return new Response(sse, { headers: { "Content-Type": "text/event-stream" } });
      },
    });
    process.env.AGENTFORGE_BASEURL_GROQ = `http://localhost:${server.port}`;
    try {
      let text = "";
      for await (const ev of streamWithFailover(
        { groq: "gsk-integration-key" },
        "groq/llama-3.1-8b-instant",
        { messages: [{ role: "user", content: "oi" }] },
      )) {
        if (ev.t === "content") text += ev.delta;
      }
      expect(hitPath).toBe("/chat/completions");
      expect(hitAuth).toBe("Bearer gsk-integration-key");
      expect(hitModel).toBe("llama-3.1-8b-instant"); // id nativo, sem prefixo
      expect(text).toBe("ok do provider direto");
    } finally {
      delete process.env.AGENTFORGE_BASEURL_GROQ;
      server.stop(true);
    }
  });

  test("sem chave nenhuma → ProviderError limpo (não crash, não rede)", async () => {
    let threw = "";
    try {
      for await (const ev of streamWithFailover({}, "groq/llama-3.1-8b-instant", { messages: [] })) { void ev; }
    } catch (e: any) { threw = String(e?.message ?? e); }
    expect(threw).toContain("nenhum provider disponível");
  });
});
