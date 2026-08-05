import { db } from "@/lib/db"
import { executeTool, type ToolContext } from "@/lib/tools/executor"
import { getEnabledTools, type ToolSchema } from "@/lib/tools/registry"

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

export async function runAgent(opts: {
  userId: string
  userMessage: string
  history: OpenRouterMessage[]
  model?: string
}): Promise<{
  reply: string
  toolCalls: Array<{
    name: string
    args: Record<string, unknown>
    result: unknown
    ok: boolean
  }>
}> {
  const { userId, userMessage, history, model } = opts

  // Load user's enabled integrations + API keys
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

  const messages: OpenRouterMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userMessage },
  ]

  const allToolCalls: Array<{
    name: string
    args: Record<string, unknown>
    result: unknown
    ok: boolean
  }> = []

  const selectedModel = model || "google/gemini-2.0-flash-exp:free"

  // Loop: call LLM, if it asks for tools, execute and feed back, repeat
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
        toolCalls: allToolCalls,
      }
    }

    const data = await res.json()
    const choice = data.choices?.[0]
    if (!choice) return { reply: "Sem resposta do modelo.", toolCalls: allToolCalls }

    const msg = choice.message
    messages.push({
      role: "assistant",
      content: msg.content || "",
      tool_calls: msg.tool_calls,
    })

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { reply: msg.content || "", toolCalls: allToolCalls }
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
    // continue loop -> call LLM again with tool results
  }

  return {
    reply: "Cheguei ao limite de iterações de ferramentas. Tente reformular sua mensagem.",
    toolCalls: allToolCalls,
  }
}
