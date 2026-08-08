// Streaming version of the agent engine.
// Emits events as the agent thinks, calls tools, and generates the response.

import { db } from "@/lib/db"
import { executeTool, type ToolContext } from "@/lib/tools/executor"
import { getEnabledTools, type ToolSchema } from "@/lib/tools/registry"
import {
  getAutoTriggerSkills,
  skillToToolSchema,
  findSkillByCommand,
  type SkillSchema,
} from "@/lib/skills/registry"
import { executeSkill, type SkillContext } from "@/lib/skills/executor"

type StreamEvent =
  | { type: "thinking"; content: string; source: "native" | "synthetic" }
  | { type: "tool_start"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; args: Record<string, unknown>; result: unknown; ok: boolean }
  | { type: "content"; chunk: string }
  | { type: "skill_invoke"; name: string; args: Record<string, unknown> }

type StreamCallback = (event: string, data: unknown) => void

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

const NATIVE_THINKING_PATTERNS = [
  /(^|[\/-])o[134]($|-|mini)/i,
  /(^|[\/-])o[134]-mini/i,
  /deepseek-r[0-9]/i,
  /(^|[\/-])qwq/i,
  /(^|[\/-])reasoning/i,
  /thinking/i,
  /(^|[\/-])gpt-oss(-|:)?(120|70|20)/i,
]

function modelHasNativeThinking(model: string): boolean {
  return NATIVE_THINKING_PATTERNS.some((p) => p.test(model))
}

const COT_PROMPT = `
Antes de responder, você DEVE raciocinar passo a passo dentro de uma tag <thinking>...</thinking>.
Dentro da tag, explore o problema, considere alternativas, decida que ferramentas usar.
Depois de fechar a tag </thinking>, forneça a resposta final ao usuário de forma clara e concisa.
`.trim()

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

const SYSTEM_PROMPT = `Você é o AgentForge — um assistente pessoal inteligente criado para ajudar o user no dia a dia.

Diretrizes:
- Responda sempre em português do Brasil, de forma clara e amigável.
- Quando precisar de informações externas (clima, data, cálculos, busca na Wikipedia), USE as ferramentas disponíveis.
- Seja conciso nas respostas, mas completo. Evite enrolação.
- Se uma ferramenta falhar por falta de chave de API, explique ao user como configurar em "API Keys".
- Você pode encadear múltiplas chamadas de ferramentas se necessário.

Sempre pense no que o user precisa e use as ferramentas proativamente.`

function schemaToOpenRouter(schema: ToolSchema) {
  const properties: Record<string, unknown> = {}
  const required: string[] = []
  for (const [key, param] of Object.entries(schema.parameters)) {
    const prop: Record<string, unknown> = { type: param.type, description: param.description }
    if (param.enum) prop.enum = param.enum
    properties[key] = prop
    if (param.required) required.push(key)
  }
  return {
    type: "function" as const,
    function: {
      name: schema.name,
      description: schema.description,
      parameters: { type: "object", properties, required },
    },
  }
}

export async function runAgentStream(opts: {
  userId: string
  userMessage: string
  history: OpenRouterMessage[]
  model?: string
  thinking?: boolean
  onEvent: StreamCallback
}): Promise<{
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
}> {
  const { userId, userMessage, history, model, thinking: thinkingEnabled = false, onEvent } = opts

  const integrations = await db.integration.findMany({ where: { userId } })
  const enabledSchemas = getEnabledTools(integrations)
  const openRouterTools = enabledSchemas.map(schemaToOpenRouter)

  const enabledSkillNames = integrations
    .filter((i) => i.service.startsWith("skill:") && i.enabled)
    .map((i) => i.service.replace("skill:", ""))
  const autoTriggerSkills = getAutoTriggerSkills(enabledSkillNames)
  const skillTools = autoTriggerSkills.map(skillToToolSchema)
  const allTools = [...openRouterTools, ...skillTools]

  const apiKeyRow = await db.apiKey.findUnique({
    where: { userId_service: { userId, service: "openrouter" } },
  })
  const openRouterKey = apiKeyRow?.keyValue
  if (!openRouterKey) {
    return {
      reply: "Você ainda não configurou sua chave da OpenRouter. Vá em 'API Keys' no menu lateral e adicione sua chave gratuita (pegue em https://openrouter.ai/keys).",
      thinking: "",
      thinkingSource: "none",
      modelUsed: model || "openai/gpt-oss-20b:free",
      toolCalls: [],
    }
  }

  const userRow = await db.user.findUnique({
    where: { id: userId },
    select: { deepResearchLevel: true, preferredModel: true },
  })

  const ctx: ToolContext = {
    userId,
    userTimezone: "America/Cuiaba",
    deepResearchLevel: (userRow?.deepResearchLevel || "high") as "quick" | "high" | "max",
    getApiKey: async (service) => {
      const row = await db.apiKey.findUnique({
        where: { userId_service: { userId, service } },
      })
      return row?.keyValue || null
    },
  }

  const selectedModel = model || userRow?.preferredModel || "openai/gpt-oss-20b:free"
  const nativeThinking = modelHasNativeThinking(selectedModel)
  const useSyntheticCoT = thinkingEnabled && !nativeThinking
  const systemPrompt = useSyntheticCoT ? `${SYSTEM_PROMPT}\n\n${COT_PROMPT}` : SYSTEM_PROMPT

  const allToolCalls: Array<{
    name: string
    args: Record<string, unknown>
    result: unknown
    ok: boolean
  }> = []
  let lastNativeReasoning = ""
  let finalReply = ""

  // ── Detect /skill invocation ──
  const slashMatch = userMessage.match(/^\/(\w+)\s*([\s\S]*)/)
  if (slashMatch) {
    const cmd = slashMatch[1].toLowerCase()
    const rest = slashMatch[2].trim()
    const skill = findSkillByCommand(cmd)
    if (skill) {
      if (!enabledSkillNames.includes(skill.name)) {
        return {
          reply: `A skill "/${cmd}" existe mas não está ativada. Vá em Skills no menu lateral para ativá-la.`,
          thinking: "",
          thinkingSource: "none",
          modelUsed: selectedModel,
          toolCalls: [],
        }
      }
      onEvent("skill_invoke", { name: skill.name, args: { rest } })
      const args = parseSkillArgs(rest, skill)
      const skillCtx: SkillContext = { userId, userTimezone: "America/Cuiaba" }
      const result = await executeSkill(skill.builtin, args, skillCtx)
      allToolCalls.push({
        name: `skill_${skill.name}`,
        args,
        result: result.result ?? result.error ?? result.prompt,
        ok: result.ok,
      })

      if (!result.ok) {
        return {
          reply: `Erro ao executar skill ${skill.display_name}: ${result.error}`,
          thinking: "",
          thinkingSource: "none",
          modelUsed: selectedModel,
          toolCalls: allToolCalls,
        }
      }

      if (result.result) {
        onEvent("content", { chunk: result.result })
        return {
          reply: result.result,
          thinking: "",
          thinkingSource: "none",
          modelUsed: selectedModel,
          toolCalls: allToolCalls,
        }
      }

      // LLM-powered skill — stream it
      const skillMessages: OpenRouterMessage[] = [
        { role: "system", content: result.systemOverride || systemPrompt },
        { role: "user", content: result.prompt || userMessage },
      ]
      await streamLLM(skillMessages, selectedModel, openRouterKey, [], false, onEvent, (content, reasoning) => {
        finalReply = content
        if (reasoning) lastNativeReasoning = reasoning
      })

      return {
        reply: finalReply,
        thinking: thinkingEnabled ? lastNativeReasoning : "",
        thinkingSource: lastNativeReasoning ? "native" : "none",
        modelUsed: selectedModel,
        toolCalls: allToolCalls,
      }
    }
  }

  // ── Normal flow with tools ──
  const messages: OpenRouterMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ]

  for (let iter = 0; iter < 5; iter++) {
    let iterContent = ""
    let iterReasoning = ""

    await streamLLM(messages, selectedModel, openRouterKey, allTools, true, onEvent, (content, reasoning) => {
      iterContent = content
      iterReasoning = reasoning || ""
      if (reasoning) lastNativeReasoning += (lastNativeReasoning ? "\n" : "") + reasoning
    })

    if (iterReasoning && thinkingEnabled) {
      onEvent("thinking", { content: iterReasoning, source: "native" })
    }

    messages.push({
      role: "assistant",
      content: iterContent,
    })

    // Check if the response contains tool_calls by parsing the raw response
    // We need to make a non-streaming call to get tool_calls reliably
    const toolCheckRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://agentforge.local",
        "X-Title": "AgentForge",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [...messages.slice(0, -1), { role: "assistant", content: iterContent }],
        tools: allTools.length ? allTools : undefined,
        tool_choice: allTools.length ? "auto" : undefined,
        temperature: 0.7,
      }),
    })

    if (!toolCheckRes.ok) {
      const errText = await toolCheckRes.text()
      return {
        reply: `Erro ao chamar OpenRouter (${toolCheckRes.status}): ${errText}`,
        thinking: "",
        thinkingSource: "none",
        modelUsed: selectedModel,
        toolCalls: allToolCalls,
      }
    }

    const toolCheckData = await toolCheckRes.json()
    const toolChoice = toolCheckData.choices?.[0]
    if (!toolChoice) {
      finalReply = iterContent
      break
    }

    const msg = toolChoice.message
    if (iterReasoning && thinkingEnabled) {
      // Already emitted above
    }

    // Replace the last assistant message with the one that has tool_calls
    messages[messages.length - 1] = {
      role: "assistant",
      content: msg.content || iterContent,
      tool_calls: msg.tool_calls,
    }

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      // Done — stream was the final content
      finalReply = iterContent

      // Extract synthetic thinking if present
      if (thinkingEnabled && !nativeThinking) {
        const parsed = extractThinking(finalReply)
        if (parsed.thinking) {
          onEvent("thinking", { content: parsed.thinking, source: "synthetic" })
          finalReply = parsed.reply
        }
      } else {
        // Strip any <thinking> tags
        const parsed = extractThinking(finalReply)
        finalReply = parsed.reply
      }
      break
    }

    // Execute tool calls
    for (const tc of msg.tool_calls) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(tc.function.arguments || "{}")
      } catch {
        args = {}
      }

      onEvent("tool_start", { name: tc.function.name, args })

      if (tc.function.name.startsWith("skill_")) {
        const skillName = tc.function.name.replace("skill_", "")
        const skill = autoTriggerSkills.find((s) => s.name === skillName)
        if (skill) {
          const skillCtx: SkillContext = { userId, userTimezone: "America/Cuiaba" }
          const skillResult = await executeSkill(skill.builtin, args, skillCtx)
          const resultContent = skillResult.ok
            ? (skillResult.result || skillResult.prompt || "Skill executada.")
            : { error: skillResult.error }
          allToolCalls.push({
            name: tc.function.name,
            args,
            result: skillResult.result ?? skillResult.error ?? skillResult.prompt,
            ok: skillResult.ok,
          })
          onEvent("tool_result", {
            name: tc.function.name,
            args,
            result: typeof resultContent === "string" ? resultContent : resultContent,
            ok: skillResult.ok,
          })
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.function.name,
            content: typeof resultContent === "string" ? resultContent : JSON.stringify(resultContent),
          })
        }
      } else {
        const result = await executeTool(tc.function.name, args, ctx)
        allToolCalls.push({
          name: tc.function.name,
          args,
          result: result.result ?? result.error,
          ok: result.ok,
        })
        onEvent("tool_result", {
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
    // Loop continues — LLM will see tool results and either call more tools or give final answer
  }

  if (!finalReply) {
    finalReply = "Cheguei ao limite de iterações. Tente reformular sua mensagem."
  }

  return {
    reply: finalReply,
    thinking: thinkingEnabled ? lastNativeReasoning : "",
    thinkingSource: lastNativeReasoning ? "native" : "none",
    modelUsed: selectedModel,
    toolCalls: allToolCalls,
  }
}

// ── Helper: stream a single LLM call ──
async function streamLLM(
  messages: OpenRouterMessage[],
  model: string,
  apiKey: string,
  tools: unknown[],
  useTools: boolean,
  onEvent: StreamCallback,
  onComplete: (content: string, reasoning: string) => void
): Promise<void> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://agentforge.local",
      "X-Title": "AgentForge",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      tools: useTools && tools.length ? tools : undefined,
      tool_choice: useTools && tools.length ? "auto" : undefined,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    onEvent("error", { message: `OpenRouter ${res.status}: ${errText}` })
    onComplete("", "")
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    onComplete("", "")
    return
  }

  const decoder = new TextDecoder()
  let buffer = ""
  let fullContent = ""
  let fullReasoning = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Process complete SSE lines
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const data = line.slice(6).trim()
        if (data === "[DONE]") continue

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta
          if (!delta) continue

          if (delta.content) {
            fullContent += delta.content
            onEvent("content", { chunk: delta.content })
          }
          if (delta.reasoning) {
            fullReasoning += delta.reasoning
            onEvent("thinking", { content: delta.reasoning, source: "native" })
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  } finally {
    reader.releaseLock?.()
  }

  onComplete(fullContent, fullReasoning)
}

// ── Helper: parse skill args ──
function parseSkillArgs(input: string, skill: SkillSchema): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  if (!input) return args

  const kvPattern = /(\w+)=("[^"]*"|'[^']*'|\S+)/g
  let kvMatch
  let hasKv = false
  while ((kvMatch = kvPattern.exec(input)) !== null) {
    const key = kvMatch[1]
    let value = kvMatch[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    args[key] = value
    hasKv = true
  }

  if (hasKv) return args

  const tokens: string[] = []
  const tokenPattern = /"[^"]*"|'[^']*'|\S+/g
  let tMatch
  while ((tMatch = tokenPattern.exec(input)) !== null) {
    let token = tMatch[0]
    if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
      token = token.slice(1, -1)
    }
    tokens.push(token)
  }

  const requiredParams = skill.parameters.filter((p) => p.required)
  for (let i = 0; i < tokens.length && i < requiredParams.length; i++) {
    const param = requiredParams[i]
    let value: unknown = tokens[i]
    if (param.type === "number") {
      value = Number(tokens[i])
      if (isNaN(value as number)) value = tokens[i]
    }
    args[param.key] = value
  }

  return args
}
