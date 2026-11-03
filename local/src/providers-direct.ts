// AgentForge Local — F2: providers DIRETOS + ranking por capability
// ─────────────────────────────────────────────────────────────
// 👥 RESPONSABILIDADE: spec §7 de docs/07 (agentforge-brain) — designada ao
//    Agente 1 em 2026-11-03 05:02 UTC; prazo de confirmação 06:00 UTC expirou
//    sem sinal → DECISÃO na sala: líder assume (nada fica órfão).
//
// CONTRATO (funções PURAS — testáveis offline, sem rede, zero deps):
//   DIRECT_PROVIDERS   — os 3 providers OpenAI-compatible free-tier
//   directModelsFlat() — lista única p/ ranking misto (id prefixado)
//   byCapability()     — ids filtrados por capability, só de providers COM chave
//
// REGRAS:
//   1. Sem chave na settings → provider inteiro fora do ranking (nunca crash).
//   2. Chave nunca aparece em log/output deste módulo.
//   3. Determinismo: mesma entrada → mesma saída; health é só desempate.
// ─────────────────────────────────────────────────────────────

export type DirectCapabilities = { tools: boolean; vision: boolean; json: boolean };
export type DirectModelInfo = {
  id: string;              // "groq/llama-3.3-70b-versatile" (prefixo = nunca colide com OpenRouter)
  label: string;           // "Llama 3.3 70B (Groq)"
  context: number;         // tokens
  caps: DirectCapabilities;
  free: boolean;           // free tier oficial (sem cobrança)
};
export type DirectProvider = {
  id: "groq" | "google-ai" | "github-models";
  kind: "openai-compatible";
  baseUrl: string;         // SEM /chat/completions (o transport junta)
  settingKey: string;      // "groq_key" | "google_ai_key" | "github_models_key"
  models: DirectModelInfo[];
};

export const DIRECT_PROVIDERS: DirectProvider[] = [
  {
    id: "groq",
    kind: "openai-compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    settingKey: "groq_key",
    models: [
      { id: "groq/llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)", context: 131072, caps: { tools: true, vision: false, json: true }, free: true },
      { id: "groq/llama-3.1-8b-instant", label: "Llama 3.1 8B instant (Groq)", context: 131072, caps: { tools: true, vision: false, json: true }, free: true },
      { id: "groq/openai/gpt-oss-120b", label: "GPT-OSS 120B (Groq)", context: 131072, caps: { tools: true, vision: false, json: true }, free: true },
    ],
  },
  {
    id: "google-ai",
    kind: "openai-compatible",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    settingKey: "google_ai_key",
    models: [
      { id: "google-ai/gemini-2.5-flash", label: "Gemini 2.5 Flash (AI Studio)", context: 1048576, caps: { tools: true, vision: true, json: true }, free: true },
      { id: "google-ai/gemini-2.0-flash", label: "Gemini 2.0 Flash (AI Studio)", context: 1048576, caps: { tools: true, vision: true, json: true }, free: true },
    ],
  },
  {
    id: "github-models",
    kind: "openai-compatible",
    baseUrl: "https://models.github.ai/inference",
    settingKey: "github_models_key",
    models: [
      { id: "github-models/openai/gpt-4o-mini", label: "GPT-4o mini (GitHub Models)", context: 128000, caps: { tools: true, vision: true, json: true }, free: true },
      { id: "github-models/openai/gpt-4o", label: "GPT-4o (GitHub Models)", context: 128000, caps: { tools: true, vision: true, json: true }, free: true },
    ],
  },
];

/** Chaves por provider — {"groq":"gsk_…"}. Nunca logar o valor. */
export type ProviderKeys = Partial<Record<DirectProvider["id"], string>>;

/** Lista única de models diretos (id prefixado, campo provider incluso). */
export function directModelsFlat(): (DirectModelInfo & { provider: string })[] {
  return DIRECT_PROVIDERS.flatMap(p => p.models.map(m => ({ ...m, provider: p.id })));
}

/** Provider que atende um id de model direto (prefixo), se houver. */
export function providerOf(modelId: string): DirectProvider | undefined {
  return DIRECT_PROVIDERS.find(p => modelId === p.id || modelId.startsWith(p.id + "/"));
}

/** Id nativo (sem o prefixo do provider) — o que vai no corpo do request. */
export function nativeModelId(modelId: string): string {
  const p = providerOf(modelId);
  return p ? modelId.slice(p.id.length + 1) : modelId;
}

export type HealthLike = Record<string, { score?: number }>;

/**
 * Ids de models diretos que atendem à capability pedida, SÓ de providers com
 * chave configurada. Ordenação: health score (se existir) → ordem do registry
 * (tie-break determinístico). Pura: nunca lança, nunca loga chave.
 */
export function byCapability(
  need: Partial<DirectCapabilities>,
  keys: ProviderKeys,
  health?: HealthLike,
): string[] {
  const out: { id: string; score: number; order: number }[] = [];
  let order = 0;
  for (const p of DIRECT_PROVIDERS) {
    const key = keys[p.id];
    if (!key || !key.trim()) continue; // sem chave = provider inteiro unavailable
    for (const m of p.models) {
      const ok = Object.entries(need).every(([cap, want]) => !want || (m.caps as any)[cap] === true);
      if (!ok) continue;
      out.push({ id: m.id, score: health?.[m.id]?.score ?? 0.5, order: order++ });
    }
  }
  // health desempata; empate → ordem declarada no registry (determinismo)
  return out.sort((a, b) => (b.score - a.score) || (a.order - b.order)).map(x => x.id);
}
