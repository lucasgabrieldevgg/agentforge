import { db } from "@/lib/db"
import { executeTool, type ToolContext } from "@/lib/tools/executor"
import { getEnabledTools, type ToolSchema } from "@/lib/tools/registry"

// ─────────────────────────────────────────────────────────────────────────────
// Thinking mode
// ─────────────────────────────────────────────────────────────────────────────
// Models with built-in thinking (reasoning). OpenRouter exposes the reasoning
// in a `reasoning` field on the response message. We can also detect by name.
const NATIVE_THINKING_PATTERNS = [
  /(^|[\/-])o[134]($|-|mini)/i,           // openai/o1, o3, o4-mini
  /(^|[\/-])o[134]-mini/i,
  /deepseek-r[0-9]/i,                      // deepseek-r1
  /(^|[\/-])qwq/i,                         // qwen/qwq
  /(^|[\/-])reasoning/i,
  /thinking/i,                             // gemini-thinking, etc.
  /(^|[\/-])gpt-oss(-|:)?(120|70|20)/i,    // gpt-oss reasoning variants
]

const COT_PROMPT = `
Antes de responder, você DEVE raciocinar passo a passo dentro de uma tag <thinking>...</thinking>.
Dentro da tag, explore o problema, considere alternativas, decida que ferramentas usar.
Depois de fechar a tag </thinking>, forneça a resposta final ao usuário de forma clara e concisa.

Exemplo de formato:
<thinking>
O usuário perguntou X. Preciso verificar Y. Vou chamar a tool Z primeiro...
</thinking>

Resposta final para o usuário aqui.
`.trim()

function modelHasNativeThinking(model: string): boolean {
  return NATIVE_THINKING_PATTERNS.some((p) => p.test(model))
}

/**
 * Extract <thinking>...</thinking> block from a message and return both parts.
 * If no thinking tag, returns the whole content as reply and empty thinking.
 */
function extractThinking(content: string): { thinking: string; reply: string } {
  const match = content.match(/<thinking>([\s\S]*?)<\/thinking>\s*/i)
  if (match) {
    return {
      thinking: match[1].trim(),
      reply: content.slice(match[0].length).trim(),
    }
  }
  return { thinking: "", reply: content.trim() }
}

// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o AgentForge — um assistente pessoal inteligente (estilo Jarvis) criado para ajudar o usuário em seu dia a dia.

Diretrizes:
- Responda sempre em português do Brasil, de forma clara e amigável.
- Quando precisar de informações externas (clima, data, cálculos, busca na Wikipedia), USE as ferramentas disponíveis.
- Quando o usuário mencionar um fato importante, compromisso ou preferência, SALVE na memória usando save_to_memory.
- Quando o usuário perguntar sobre algo do passado, USE search_memory antes de responder.
- Seja conciso nas respostas, mas completo. Evite enrolação.
- Se uma ferramenta falhar por falta de chave de API, explique ao usuário como configurar em "API Keys".
- Você pode encadear múltiplas chamadas de ferramentas se necessário.

Sempre pense no que o usuário precisa e use as ferramentas proativamente.`

type OpenRouterMessage = {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  tool_calls?: Array<{
    id: string
    type: "function"
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

type OpenRouterTool = {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

function schemaToOpenRouter(schema: ToolSchema): OpenRouterTool {
  const properties: Record<string, unknown> = {}
  const required: string[] = []
  for (const [key, param] of Object.entries(schema.parameters)) {
    const prop: Record<string, unknown> = {
      type: param.type,
      description: param.description,
    }
    if (param.enum) prop.enum = param.enum
    properties[key] = prop
    if (param.required) required.push(key)
  }
  return {
    type: "function",
    function: {
      name: schema.name,
      description: schema.description,
      parameters: {
        type: "object",
        properties,
        required,
      },
    },
  }
}

export type AgentRunResult = {
  reply: string
  thinking: string
  thinkingSource: "native" | "synthetic" | "none"
  modelUsed: string
  toolCalls: Array<{
    name: string
    args: Record<string, unknown>
    result: unknown
    ok: boolean
  }>
}

export async function runAgent(opts: {
  userId: string
  userMessage: string
  history: OpenRouterMessage[]
  model?: string
  thinking?: boolean // user toggle
}): Promise<AgentRunResult> {
  const { userId, userMessage, history, model, thinking: thinkingEnabled = false } = opts

  const integrations = await db.integration.findMany({ where: { userId } })
  const enabledSchemas = getEnabledTools(integrations)
  const openRouterTools = enabledSchemas.map(schemaToOpenRouter)

  const apiKeyRow = await db.apiKey.findUnique({
    where: { userId_service: { userId, service: "openrouter" } },
  })
  const openRouterKey = apiKeyRow?.keyValue
  if (!openRouterKey) {
    return {
      reply:
        "Você ainda não configurou sua chave da OpenRouter. Vá em 'API Keys' no menu lateral e adicione sua chave gratuita (pegue em https://openrouter.ai/keys).",
      thinking: "",
      thinkingSource: "none",
      modelUsed: model || "google/gemini-2.0-flash-exp:free",
      toolCalls: [],
    }
  }

  const ctx: ToolContext = {
    userId,
    userTimezone: "America/Cuiaba",
    getApiKey: async (service) => {
      const row = await db.apiKey.findUnique({
        where: { userId_service: { userId, service } },
      })
      return row?.keyValue || null
    },
  }

  const selectedModel = model || "google/gemini-2.0-flash-exp:free"
  const nativeThinking = modelHasNativeThinking(selectedModel)

  // Decide thinking strategy:
  // - If user enabled thinking AND model has native: use native (no prompt change, parse reasoning field)
  // - If user enabled thinking AND model has NO native: inject CoT prompt + parse <thinking> tags
  // - If user disabled thinking: just don't try to parse it
  const useSyntheticCoT = thinkingEnabled && !nativeThinking
  const systemPrompt = useSyntheticCoT
    ? `${SYSTEM_PROMPT}\n\n${COT_PROMPT}`
    : SYSTEM_PROMPT

  const messages: OpenRouterMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ]

  const allToolCalls: AgentRunResult["toolCalls"] = []
  let lastNativeReasoning = ""
  let finalContent = ""

  for (let iter = 0; iter < 5; iter++) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://agentforge.local",
        "X-Title": "AgentForge",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        tools: openRouterTools.length ? openRouterTools : undefined,
        tool_choice: openRouterTools.length ? "auto" : undefined,
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return {
        reply: `Erro ao chamar OpenRouter (${res.status}): ${errText}`,
        thinking: "",
        thinkingSource: "none",
        modelUsed: selectedModel,
        toolCalls: allToolCalls,
      }
    }

    const data = await res.json()
    const choice = data.choices?.[0]
    if (!choice) {
      return {
        reply: "Sem resposta do modelo.",
        thinking: "",
        thinkingSource: "none",
        modelUsed: selectedModel,
        toolCalls: allToolCalls,
      }
    }

    const msg = choice.message
    // OpenRouter convention: native reasoning models put thinking in `reasoning` field
    if (msg.reasoning) {
      lastNativeReasoning += (lastNativeReasoning ? "\n" : "") + String(msg.reasoning)
    }
    finalContent = msg.content || ""

    messages.push({
      role: "assistant",
      content: finalContent,
      tool_calls: msg.tool_calls,
    })

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      // Done — extract thinking if any
      let thinking = ""
      let thinkingSource: AgentRunResult["thinkingSource"] = "none"
      let reply = finalContent

      if (thinkingEnabled) {
        if (lastNativeReasoning) {
          thinking = lastNativeReasoning
          thinkingSource = "native"
        } else {
          // Try to parse <thinking> tags (synthetic CoT)
          const parsed = extractThinking(finalContent)
          if (parsed.thinking) {
            thinking = parsed.thinking
            reply = parsed.reply
            thinkingSource = "synthetic"
          }
        }
      } else {
        // Even if user disabled thinking, strip any <thinking> tags from the reply
        // (some models leak them)
        const parsed = extractThinking(finalContent)
        reply = parsed.reply
      }

      return {
        reply,
        thinking,
        thinkingSource,
        modelUsed: selectedModel,
        toolCalls: allToolCalls,
      }
    }

    // Execute each tool call
    for (const tc of msg.tool_calls) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(tc.function.arguments || "{}")
      } catch {
        args = {}
      }
      const result = await executeTool(tc.function.name, args, ctx)
      allToolCalls.push({
        name: tc.function.name,
        args,
        result: result.result ?? result.error,
        ok: result.ok,
      })
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(result.ok ? result.result : { error: result.error }),
      })
    }
  }

  return {
    reply: "Cheguei ao limite de iterações de ferramentas. Tente reformular sua mensagem.",
    thinking: lastNativeReasoning,
    thinkingSource: lastNativeReasoning ? "native" : "none",
    modelUsed: selectedModel,
    toolCalls: allToolCalls,
  }
}
