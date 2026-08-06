// Curated catalog of OpenRouter free models that work well for the AgentForge agent.
// Updated 2026-08-05. When OpenRouter removes a model, users get a 404 error.
// This list is what we show in the UI dropdown.

export type ModelInfo = {
  id: string
  name: string
  description: string
  contextLength: number
  hasNativeThinking: boolean
  recommended?: boolean
}

// Curated list — only the best free models for chat
export const RECOMMENDED_MODELS: ModelInfo[] = [
  {
    id: "openai/gpt-oss-20b:free",
    name: "GPT-OSS 20B",
    description:
      "Modelo de reasoning da OpenAI. Equilibrado: bom em tools, raciocínio nativo, rápido. RECOMENDADO.",
    contextLength: 131_072,
    hasNativeThinking: true,
    recommended: true,
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "Nemotron 3 Ultra",
    description: "NVIDIA 550B params. Janela de contexto gigante (1M tokens). Bom pra documentos longos.",
    contextLength: 1_000_000,
    hasNativeThinking: false,
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Gemma 4 31B",
    description: "Google Gemma 4 31B (instruction-tuned). Rápido, sem reasoning nativo.",
    contextLength: 262_144,
    hasNativeThinking: false,
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "Nemotron 3 Super",
    description: "NVIDIA 120B MoE. Rápido pra tamanho, sem reasoning nativo.",
    contextLength: 262_144,
    hasNativeThinking: false,
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    name: "Nemotron 3 Nano Omni (Reasoning)",
    description: "NVIDIA 30B com reasoning nativo. Mais rápido que o Ultra.",
    contextLength: 256_000,
    hasNativeThinking: true,
  },
  {
    id: "inclusionai/ling-3.0-flash:free",
    name: "Ling 3.0 Flash",
    description: "Modelo chinês multilíngue. Rápido, sem reasoning nativo.",
    contextLength: 262_144,
    hasNativeThinking: false,
  },
  {
    id: "openrouter/free",
    name: "Auto (Free Router)",
    description: "OpenRouter escolhe o melhor modelo free automaticamente. Pode variar.",
    contextLength: 200_000,
    hasNativeThinking: false,
  },
]

export const DEFAULT_MODEL = "openai/gpt-oss-20b:free"

export function getModelInfo(id: string): ModelInfo | undefined {
  return RECOMMENDED_MODELS.find((m) => m.id === id)
}

export function formatContextLength(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M`
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`
  return String(tokens)
}
