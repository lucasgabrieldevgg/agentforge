// AgentForge Local — API Router v1 (F2): providers diretos + ranking por capability
// v0.1: OpenRouter como transport único, failover em nível de MODELO.
// v0.2.1 (F2): Groq / Google AI Studio / GitHub Models DIRETOS (OpenAI-compatible)
//   entram no ranking misto quando a chave deles está nas settings — ids prefixados
//   ("groq/…") nunca colidem com os do OpenRouter. Sem chave = fora do ranking.
import {
  DIRECT_PROVIDERS, byCapability, providerOf, nativeModelId, type ProviderKeys,
} from "./providers-direct";

export type ModelInfo = {
  id: string; name: string; nativeThinking: boolean; context: number; note?: string;
  provider: string;            // "openrouter" | "groq" | "google-ai" | "github-models"
  providerLabel: string;       // p/ agrupar na UI
  caps?: { tools: boolean; vision: boolean; json: boolean }; // diretos declaram
};

const OR = "openrouter";
export const RANKED_MODELS: ModelInfo[] = [
  { id: "openai/gpt-oss-20b:free", name: "GPT-OSS 20B", nativeThinking: true, context: 131072, note: "padrão — rápido, bom com tools", provider: OR, providerLabel: "OpenRouter", caps: { tools: true, vision: false, json: true } },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super 120B", nativeThinking: false, context: 262144, note: "MoE rápido", provider: OR, providerLabel: "OpenRouter", caps: { tools: true, vision: false, json: true } },
  { id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B", nativeThinking: false, context: 262144, provider: OR, providerLabel: "OpenRouter", caps: { tools: true, vision: false, json: true } },
  { id: "openai/gpt-oss-120b:free", name: "GPT-OSS 120B", nativeThinking: true, context: 131072, note: "mais forte, mais lento", provider: OR, providerLabel: "OpenRouter", caps: { tools: true, vision: false, json: true } },
  { id: "inclusionai/ling-3.0-flash:free", name: "Ling 3.0 Flash", nativeThinking: false, context: 262144, provider: OR, providerLabel: "OpenRouter", caps: { tools: true, vision: false, json: true } },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", name: "Nemotron Nano Omni", nativeThinking: true, context: 256000, provider: OR, providerLabel: "OpenRouter", caps: { tools: true, vision: true, json: true } },
  { id: "openrouter/free", name: "Auto (Free Router)", nativeThinking: false, context: 200000, note: "OpenRouter escolhe", provider: OR, providerLabel: "OpenRouter", caps: { tools: true, vision: true, json: true } },
];

export const DEFAULT_MODEL = RANKED_MODELS[0].id;

// ---------- health score (janela deslizante em memória) ----------
type Health = { ok: number; fail: number; lastLatency: number; lastError: string | null; lastFailAt: number };
const health = new Map<string, Health>();

function h(model: string): Health {
  if (!health.has(model)) health.set(model, { ok: 0, fail: 0, lastLatency: 0, lastError: null, lastFailAt: 0 });
  return health.get(model)!;
}
export function recordOk(model: string, latencyMs: number): void {
  const s = h(model); s.ok++; s.lastLatency = latencyMs;
  // decaimento: com muitos sucessos, falhas antigas pesam menos
  if (s.ok + s.fail > 50) { s.ok = Math.ceil(s.ok * 0.7); s.fail = Math.floor(s.fail * 0.7); }
}
export function recordFail(model: string, error: string): void {
  const s = h(model); s.fail++; s.lastError = error; s.lastFailAt = Date.now();
}
export function healthSnapshot() {
  return Object.fromEntries([...health.entries()].map(([m, s]) => {
    const total = s.ok + s.fail;
    const score = total === 0 ? 0.5 : s.ok / total;
    const penalty = Date.now() - s.lastFailAt < 120_000 && s.fail > 0 ? 0.4 : 0; // falha recente derruba
    return [m, { score: Math.max(0, +(score - penalty).toFixed(2)), ok: s.ok, fail: s.fail, lastLatency: s.lastLatency, lastError: s.lastError }];
  }));
}

// ---------- auth + ranking misto (F2) ----------
/** Chaves de todos os providers — supervisor monta a partir das settings. */
export type Auth = { openrouter?: string } & ProviderKeys;

/** Models diretos como ModelInfo (só os de providers com chave). */
function directInfos(auth: Auth): ModelInfo[] {
  const byId = new Map(DIRECT_PROVIDERS.flatMap(p => p.models.map(m => [m.id, m] as const)));
  return byCapability({}, directKeys(auth), healthSnapshot())
    .map(id => byId.get(id))
    .filter(Boolean)
    .map(m => ({
      id: m!.id, name: m!.label, nativeThinking: false, context: m!.context,
      provider: providerOf(m!.id)!.id, providerLabel: providerOf(m!.id)!.id, caps: m!.caps,
    }));
}
function directKeys(auth: Auth): ProviderKeys {
  return {
    groq: auth.groq?.trim() || undefined,
    "google-ai": auth["google-ai"]?.trim() || undefined,
    "github-models": auth["github-models"]?.trim() || undefined,
  } as ProviderKeys;
}

/** Catálogo misto disponível (OpenRouter com chave + diretos com chave). */
export function availableModels(auth: Auth): ModelInfo[] {
  const out: ModelInfo[] = [];
  if (auth.openrouter?.trim()) out.push(...RANKED_MODELS);
  out.push(...directInfos(auth));
  return out;
}

/** Capability pedida pelo job → modelos que podem atender (diretos filtrados;
 *  OpenRouter entra como fallback quando não temos caps declaradas). */
export function capableModels(auth: Auth, need: Partial<{ tools: boolean; vision: boolean; json: boolean }>): ModelInfo[] {
  const all = availableModels(auth);
  const direct = byCapability(need, directKeys(auth), healthSnapshot());
  const satisfied = all.filter(m => direct.includes(m.id) || (m.provider === OR && (!need.vision || m.caps?.vision === true) && (!need.json || m.caps?.json === true) && (!need.tools || m.caps?.tools === true)));
  // fallback: nada atesta a capability → devolve tudo (o app nunca trava por filtro)
  return satisfied.length ? satisfied : all;
}

/** Ranking efetivo: preferido primeiro (se disponível), depois por saúde. */
export function effectiveRank(preferred: string, auth: Auth = { openrouter: "x" }): string[] {
  const pool = capableModels(auth, {});
  const ids = pool.map(m => m.id);
  const rest = ids.filter(id => id !== preferred)
    .sort((a, b) => {
      const sa = healthSnapshot()[a]?.score ?? 0.5;
      const sb = healthSnapshot()[b]?.score ?? 0.5;
      return sb - sa;
    });
  return ids.includes(preferred) ? [preferred, ...rest] : rest;
}

/** Transport de um model: URL + chave + headers (direto ou OpenRouter).
 *  Env AGENTFORGE_BASEURL_<provider> sobrescreve o baseUrl (testes/self-hosted). */
function transportFor(model: string, auth: Auth): { url: string; key: string; headers: Record<string, string>; model: string; direct: boolean } | null {
  const p = providerOf(model);
  if (p) {
    const key = auth[p.id]?.trim();
    if (!key) return null; // provider sem chave = unavailable
    const base = process.env[`AGENTFORGE_BASEURL_${p.id.replace(/-/g, "_").toUpperCase()}`] || p.baseUrl;
    return { url: `${base}/chat/completions`, key, headers: {}, model: nativeModelId(model), direct: true };
  }
  if (!auth.openrouter?.trim()) return null;
  return {
    url: OPENROUTER_URL, key: auth.openrouter,
    headers: { "HTTP-Referer": "https://agentforge.local", "X-Title": "AgentForge Local" },
    model, direct: false,
  };
}

// ---------- tipos do protocolo de chat ----------
export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[]; reasoning?: string }
  | { role: "tool"; tool_call_id: string; name: string; content: string };

export type StreamEvent =
  | { t: "content"; delta: string }
  | { t: "reasoning"; delta: string }
  | { t: "tool_calls"; calls: ToolCall[] }        // acumulado, emitido no fim do stream
  | { t: "finish"; reason: string }
  | { t: "failover"; from: string; to: string; error: string };

export type StreamOpts = {
  messages: ChatMessage[];
  tools?: unknown[];
  signal?: AbortSignal;
  stallTimeoutMs?: number;   // sem bytes por X ms → aborta (watchdog do supervisor)
  maxTokens?: number;
  reasoningEffort?: "low" | "medium" | "high";
};

export class ProviderError extends Error {
  constructor(msg: string, public status?: number, public retryable: boolean = true) { super(msg); }
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Uma tentativa de stream num modelo (transport parametrizado — F2). Lança ProviderError em falha. */
async function* streamOnce(
  transport: { url: string; key: string; headers: Record<string, string>; model: string; direct: boolean },
  opts: StreamOpts, onFirstByte?: (model: string, latency: number) => void
): AsyncGenerator<StreamEvent> {
  const body: Record<string, unknown> = {
    model: transport.model, messages: opts.messages, stream: true,
    max_tokens: opts.maxTokens ?? 4096,
  };
  if (opts.tools?.length) { body.tools = opts.tools; body.tool_choice = "auto"; }
  if (opts.reasoningEffort && !transport.direct) {
    body.reasoning = { effort: opts.reasoningEffort }; // só OpenRouter aceita
  }

  const res = await fetch(transport.url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${transport.key}`,
      "Content-Type": "application/json",
      ...transport.headers,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status >= 500;
    throw new ProviderError(`HTTP ${res.status} ${text.slice(0, 300)}`, res.status, retryable);
  }

  // watchdog de stall: sem bytes por stallTimeoutMs → aborta
  const stall = opts.stallTimeoutMs ?? 45_000;
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onOuterAbort, { once: true });
  let lastChunk = Date.now();
  const watchdog = setInterval(() => { if (Date.now() - lastChunk > stall) controller.abort(); }, 3_000);

  const toolAcc = new Map<number, ToolCall>();
  let finish = ""; let first = true;

  try {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lastChunk = Date.now();
      if (first) { first = false; onFirstByte?.(transport.model, Date.now() - lastChunk + 1); }
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        let json: any;
        try { json = JSON.parse(payload); } catch { continue; }
        if (json.error) throw new ProviderError(String(json.error.message ?? json.error), undefined, true);
        const delta = json.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.reasoning) yield { t: "reasoning", delta: delta.reasoning };
        if (delta.content) yield { t: "content", delta: delta.content };
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const cur = toolAcc.get(idx) ?? { id: tc.id ?? `call_${idx}_${Date.now().toString(36)}`, type: "function" as const, function: { name: "", arguments: "" } };
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.function.name = tc.function.name;
            if (tc.function?.arguments) cur.function.arguments += tc.function.arguments;
            toolAcc.set(idx, cur);
          }
        }
        if (json.choices?.[0]?.finish_reason) finish = json.choices[0].finish_reason;
      }
    }
  } catch (e: any) {
    if (controller.signal.aborted && Date.now() - lastChunk > (stall - 3000)) {
      throw new ProviderError(`stall: sem dados por ${Math.round(stall / 1000)}s`, undefined, true);
    }
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(String(e?.message ?? e), undefined, true);
  } finally {
    clearInterval(watchdog);
    opts.signal?.removeEventListener("abort", onOuterAbort);
  }

  const calls = [...toolAcc.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c).filter(c => c.function.name);
  if (calls.length) yield { t: "tool_calls", calls };
  if (finish) yield { t: "finish", reason: finish };
}

/**
 * Stream com failover: tenta o modelo preferido; em falha retryable, cai pro próximo
 * do ranking MISTO (OpenRouter + diretos com chave). Emite failover p/ a UI narrar.
 */
export async function* streamWithFailover(
  auth: Auth, preferred: string, opts: StreamOpts
): AsyncGenerator<StreamEvent> {
  const rank = effectiveRank(preferred, auth);
  if (!rank.length) {
    throw new ProviderError("nenhum provider disponível — configure ao menos uma chave (OpenRouter, Groq, Google AI ou GitHub Models) nas configurações", undefined, false);
  }
  let lastError: ProviderError | null = null;

  for (let i = 0; i < rank.length; i++) {
    const model = rank[i];
    const transport = transportFor(model, auth);
    if (!transport) continue; // sem chave → fora do ranking de verdade
    let started = false;
    const produced: StreamEvent[] = [];
    try {
      if (model === "mock" || auth.openrouter === "mock") {
        for await (const ev of mockStream(opts, model)) { produced.push(ev); yield ev; }
        return;
      }
      for await (const ev of streamOnce(transport, opts, (_m, lat) => { started = true; recordOk(model, lat); })) {
        produced.push(ev);
        yield ev; // repassa pro chamador em tempo real
      }
      return; // sucesso completo
    } catch (e: any) {
      lastError = e instanceof ProviderError ? e : new ProviderError(String(e?.message ?? e), undefined, true);
      recordFail(model, lastError.message);
      // se já produziu conteúdo, não dá pra trocar de modelo no meio — relança
      if (started && produced.some(p => p.t === "content" || p.t === "tool_calls")) {
        throw lastError;
      }
      const next = rank[i + 1];
      if (next && lastError.retryable) {
        yield { t: "failover", from: model, to: next, error: lastError.message.slice(0, 200) };
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new ProviderError("todos os modelos falharam");
}

// ---------- mock provider (testes offline) ----------
/** Script de mock via env AGENTFORGE_MOCK_SCRIPT: JSON array de respostas
 *  [{content:"..."} | {tool:{name,args}} | {error:"..."} | {stallMs: 60000}] */
function readMockScript(): any[] {
  try { return JSON.parse(process.env.AGENTFORGE_MOCK_SCRIPT || "[]"); } catch { return []; }
}
let mockIdx = 0;
function resetMock() { mockIdx = 0; }
async function* mockStream(opts: StreamOpts, model: string): AsyncGenerator<StreamEvent> {
  const script = readMockScript();
  const step = script[Math.min(mockIdx, script.length - 1)] ?? { content: "(mock vazio)" };
  mockIdx++;
  if (step.reset) resetMock();
  if (step.error) { await Bun.sleep(50); throw new ProviderError(step.error, 429, true); }
  if (step.stallMs) { await Bun.sleep(Math.min(step.stallMs, 3000)); throw new ProviderError("stall simulado", undefined, true); }
  await Bun.sleep(60);
  if (step.reasoning) yield { t: "reasoning", delta: step.reasoning };
  if (step.content) yield { t: "content", delta: step.content };
  if (step.tool) {
    yield {
      t: "tool_calls", calls: [{
        id: "mock_" + mockIdx + "_" + Date.now().toString(36), type: "function",
        function: { name: step.tool.name, arguments: JSON.stringify(step.tool.args ?? {}) },
      }],
    };
  }
  yield { t: "finish", reason: step.tool ? "tool_calls" : "stop" };
}
export { resetMock };
