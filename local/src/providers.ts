// AgentForge Local — API Router v0: modelos free ranqueados com health score e failover
// v0.1: OpenRouter como transport único, failover em nível de MODELO.
// (F2 do roadmap generaliza para providers diretos: Groq, Google AI, GitHub Models…)

export type ModelInfo = {
  id: string; name: string; nativeThinking: boolean; context: number; note?: string;
};

export const RANKED_MODELS: ModelInfo[] = [
  { id: "openai/gpt-oss-20b:free", name: "GPT-OSS 20B", nativeThinking: true, context: 131072, note: "padrão — rápido, bom com tools" },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super 120B", nativeThinking: false, context: 262144, note: "MoE rápido" },
  { id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B", nativeThinking: false, context: 262144 },
  { id: "openai/gpt-oss-120b:free", name: "GPT-OSS 120B", nativeThinking: true, context: 131072, note: "mais forte, mais lento" },
  { id: "inclusionai/ling-3.0-flash:free", name: "Ling 3.0 Flash", nativeThinking: false, context: 262144 },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", name: "Nemotron Nano Omni", nativeThinking: true, context: 256000 },
  { id: "openrouter/free", name: "Auto (Free Router)", nativeThinking: false, context: 200000, note: "OpenRouter escolhe" },
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

/** Ranking efetivo: preferido primeiro, depois os demais ordenados por saúde. */
export function effectiveRank(preferred: string): string[] {
  const rest = RANKED_MODELS
    .map(m => m.id)
    .filter(id => id !== preferred)
    .sort((a, b) => {
      const sa = healthSnapshot()[a]?.score ?? 0.5;
      const sb = healthSnapshot()[b]?.score ?? 0.5;
      return sb - sa;
    });
  return [preferred, ...rest];
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

/** Uma tentativa de stream num modelo. Lança ProviderError em falha. */
async function* streamOnce(
  apiKey: string, model: string, opts: StreamOpts, onFirstByte?: (model: string, latency: number) => void
): AsyncGenerator<StreamEvent> {
  const body: Record<string, unknown> = {
    model, messages: opts.messages, stream: true,
    max_tokens: opts.maxTokens ?? 4096,
  };
  if (opts.tools?.length) { body.tools = opts.tools; body.tool_choice = "auto"; }
  if (opts.reasoningEffort) body.reasoning = { effort: opts.reasoningEffort };

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://agentforge.local",
      "X-Title": "AgentForge Local",
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
      if (first) { first = false; onFirstByte?.(model, Date.now() - lastChunk + 1); }
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
 * Stream com failover: tenta o modelo preferido; em falha retryable, cai pro próximo do ranking.
 * Emite evento failover para a UI narrar a troca.
 */
export async function* streamWithFailover(
  apiKey: string, preferred: string, opts: StreamOpts
): AsyncGenerator<StreamEvent> {
  const rank = effectiveRank(preferred);
  let lastError: ProviderError | null = null;

  for (let i = 0; i < rank.length; i++) {
    const model = rank[i];
    let started = false;
    const produced: StreamEvent[] = [];
    try {
      if (model === "mock" || apiKey === "mock") {
        for await (const ev of mockStream(opts, model)) { produced.push(ev); yield ev; }
        return;
      }
      for await (const ev of streamOnce(apiKey, model, opts, (_m, lat) => { started = true; recordOk(model, lat); })) {
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
