// Streaming version of the agent engine.
// Single streaming call per iteration — supports both content streaming and tool_calls.

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
  /deepseek-r[0-9]/i,
  /(^|[\/-])qwq/i,
  /(^|[\/-])reasoning/i,
  /thinking/i,
  /(^|[\/-])gpt-oss(-|:)?(120|70|20)/i,
]

function modelHasNativeThinking(model: string): boolean {
  return NATIVE_THINKING_PATTERNS.some((p) => p.test(model))
}

const COT_PROMPT_HIGH = `
Antes de responder, você DEVE raciocinar passo a passo dentro de uma tag <thinking>...</thinking>.
Dentro da tag, explore o problema, considere alternativas, decida que ferramentas usar.
Depois de fechar a tag </thinking>, forneça a resposta final ao usuário de forma clara e concisa.
`.trim()

const COT_PROMPT_MAX = `
Antes de responder, você DEVE raciocinar profundamente dentro de uma tag <thinking>...</thinking>.
Dentro da tag:
1. Analise o problema de múltiplas perspectivas
2. Liste possíveis abordagens e escolha a melhor com justificativa
3. Considere edge cases e possíveis erros
4. Decida que ferramentas usar e por quê
5. Só depois forneça a resposta final após </thinking>

Seja rigoroso e completo no raciocínio. Pense como um especialista.
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

const SYSTEM_PROMPT = `Você é o AgentForge — um assistente pessoal inteligente e autônomo.

Você é autônomo: decide sozinho quando usar ferramentas, skills e pesquisas.

## Ferramentas disponíveis
- **get_current_datetime**, **calculate**, **search_wikipedia**, **deep_research**
- **get_weather**, **get_exchange_rate**, **get_country_info**, **convert_units**, **generate_password**

## Skills (via /comando ou automático)
- /translate, /summarize, /rewrite, /code, /explain, /define, /todo, /joke, /uuid, /hash

## Como responder — MUITO IMPORTANTE

### Para perguntas normais (não-code):
- Responda direto, em português, claro e amigável.
- Use ferramentas quando precisar de dados externos.

### Para pedidos de código (site, script, função, etc):

**NÃO coloque código no meio do texto.** Em vez disso:

1. **Narre o que você está fazendo** — como se fosse um desenvolvedor trabalhando:
   - "Vou criar um site de restaurante com header, cardápio e contato."
   - "Primeiro, estruturando o HTML com seções semânticas..."
   - "Adicionando CSS para deixar responsivo e bonito..."
   - "Incluindo JavaScript para interatividade..."
   - Seja breve mas informativo. Mostre que você pensou na estrutura.

2. **Depois da narração, coloque TODO o código num único bloco** no final da resposta.
   - Use \`\`\`html para HTML (com CSS e JS embutidos)
   - Use \`\`\`python para Python, \`\`\`javascript para JS, etc.
   - O código DEVE ser completo e funcional.
   - NUNCA corte no meio. NUNCA use "..." ou "resto do código".

3. **Formato da resposta** (exemplo):
   \
   Vou criar um site de restaurante completo com:
   - Header com logo e navegação
   - Seção "Sobre" com história do restaurante
   - Cardápio com pratos e preços
   - Seção de contato com mapa
   - Footer com redes sociais

   Estruturando o HTML com tags semânticas, adicionando CSS responsivo e JavaScript para o menu mobile.
   \

   \`\`\`html
   <!DOCTYPE html>
   ... código completo ...
   </html>
   \`\`\`

4. **NUNCA misture texto com código**. Texto primeiro, código no final.

5. **Se forem múltiplos arquivos**, coloque cada um num bloco separado no final, com um comentário antes indicando o nome:
   \
   \`\`\`html
   ... index.html ...
   \`\`\`
   \`\`\`css
   ... styles.css ...
   \`\`\`

O código que você gerar será extraído automaticamente como arquivo anexo. O usuário verá a narração no chat e o código como arquivo pra baixar e ver preview.

## Diretrizes gerais
- Responda sempre em português do Brasil.
- USE ferramentas proativamente quando precisar de dados externos.
- Se uma ferramenta falhar, explique e sugira alternativa.
- Seja conciso nas respostas diretas, mas completo em explicações.`

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
  thinkingLevel?: "quick" | "high" | "max"
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
  const { userId, userMessage, history, model, thinkingLevel = "quick", onEvent } = opts
  const thinkingEnabled = thinkingLevel !== "quick"
  const isMaxThinking = thinkingLevel === "max"

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
  // Determine thinking strategy based on level:
  // - quick: no thinking injection (native models still reason naturally)
  // - high: inject CoT for non-native models; native models use their own reasoning
  // - max: inject deep CoT for ALL models (even native ones get extra reasoning prompt)
  const useSyntheticCoT = thinkingEnabled && (!nativeThinking || isMaxThinking)
  const cotPrompt = isMaxThinking ? COT_PROMPT_MAX : COT_PROMPT_HIGH
  const systemPrompt = useSyntheticCoT ? `${SYSTEM_PROMPT}\n\n${cotPrompt}` : SYSTEM_PROMPT

  // For models that support reasoning effort parameter (OpenRouter extension)
  const reasoningEffort = thinkingLevel === "max" ? "high" : thinkingLevel === "high" ? "medium" : "low"

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

      // LLM-powered skill — stream it (no tools, just prompt + system override)
      const skillMessages: OpenRouterMessage[] = [
        { role: "system", content: result.systemOverride || systemPrompt },
        { role: "user", content: result.prompt || userMessage },
      ]
      const skillResult = await streamLLM(skillMessages, selectedModel, openRouterKey, [], onEvent, reasoningEffort)
      finalReply = skillResult.content
      if (skillResult.reasoning) lastNativeReasoning = skillResult.reasoning

      return {
        reply: finalReply,
        thinking: thinkingEnabled ? lastNativeReasoning : "",
        thinkingSource: lastNativeReasoning ? "native" : "none",
        modelUsed: selectedModel,
        toolCalls: allToolCalls,
      }
    }
  }

  // ── Normal flow with tools + streaming ──
  const messages: OpenRouterMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ]

  for (let iter = 0; iter < 5; iter++) {
    // Single streaming call WITH tools
    const streamResult = await streamLLM(
      messages,
      selectedModel,
      openRouterKey,
      allTools,
      onEvent,
      reasoningEffort
    )

    if (streamResult.error) {
      return {
        reply: `Erro ao chamar OpenRouter: ${streamResult.error}`,
        thinking: "",
        thinkingSource: "none",
        modelUsed: selectedModel,
        toolCalls: allToolCalls,
      }
    }

    if (streamResult.reasoning && thinkingEnabled) {
      lastNativeReasoning += (lastNativeReasoning ? "\n" : "") + streamResult.reasoning
    }

    // If there are tool_calls, execute them and loop
    if (streamResult.toolCalls.length > 0) {
      // Add assistant message with tool_calls to history
      messages.push({
        role: "assistant",
        content: streamResult.content || null,
        tool_calls: streamResult.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      })

      // Execute each tool call
      for (const tc of streamResult.toolCalls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(tc.arguments || "{}")
        } catch {
          args = {}
        }

        onEvent("tool_start", { name: tc.name, args })

        if (tc.name.startsWith("skill_")) {
          const skillName = tc.name.replace("skill_", "")
          const skill = autoTriggerSkills.find((s) => s.name === skillName)
          if (skill) {
            const skillCtx: SkillContext = { userId, userTimezone: "America/Cuiaba" }
            const skillResult = await executeSkill(skill.builtin, args, skillCtx)
            const resultContent = skillResult.ok
              ? (skillResult.result || skillResult.prompt || "Skill executada.")
              : { error: skillResult.error }
            allToolCalls.push({
              name: tc.name,
              args,
              result: skillResult.result ?? skillResult.error ?? skillResult.prompt,
              ok: skillResult.ok,
            })
            onEvent("tool_result", {
              name: tc.name,
              args,
              result: typeof resultContent === "string" ? resultContent : resultContent,
              ok: skillResult.ok,
            })
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              name: tc.name,
              content: typeof resultContent === "string" ? resultContent : JSON.stringify(resultContent),
            })
          }
        } else {
          const result = await executeTool(tc.name, args, ctx)
          allToolCalls.push({
            name: tc.name,
            args,
            result: result.result ?? result.error,
            ok: result.ok,
          })
          onEvent("tool_result", {
            name: tc.name,
            args,
            result: result.result ?? result.error,
            ok: result.ok,
          })
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.name,
            content: JSON.stringify(result.ok ? result.result : { error: result.error }),
          })
        }
      }
      // Loop continues — LLM will see tool results and either call more tools or give final answer
      continue
    }

    // No tool_calls — this is the final answer
    finalReply = streamResult.content

    // Extract synthetic thinking if present
    if (thinkingEnabled && !nativeThinking) {
      const parsed = extractThinking(finalReply)
      if (parsed.thinking) {
        onEvent("thinking", { content: parsed.thinking, source: "synthetic" })
        finalReply = parsed.reply
      }
    } else {
      const parsed = extractThinking(finalReply)
      finalReply = parsed.reply
    }
    break
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

// ── Helper: stream a single LLM call WITH tools support ──
async function streamLLM(
  messages: OpenRouterMessage[],
  model: string,
  apiKey: string,
  tools: unknown[],
  onEvent: StreamCallback,
  reasoningEffort?: "low" | "medium" | "high"
): Promise<{
  content: string
  reasoning: string
  toolCalls: Array<{ id: string; name: string; arguments: string }>
  error?: string
}> {
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    tools: tools.length ? tools : undefined,
    tool_choice: tools.length ? "auto" : undefined,
    temperature: 0.7,
    max_tokens: 16000,
  }
  // Add reasoning effort for models that support it (OpenRouter extension)
  if (reasoningEffort) {
    body.reasoning = { effort: reasoningEffort }
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://agentforge.local",
      "X-Title": "AgentForge",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    return { content: "", reasoning: "", toolCalls: [], error: `OpenRouter ${res.status}: ${errText}` }
  }

  const reader = res.body?.getReader()
  if (!reader) {
    return { content: "", reasoning: "", toolCalls: [] }
  }

  const decoder = new TextDecoder()
  let buffer = ""
  let fullContent = ""
  let fullReasoning = ""
  // Tool calls come in chunks — we need to accumulate them by index
  const toolCallAccumulators: Map<number, { id: string; name: string; arguments: string }> = new Map()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

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
          // Accumulate tool_calls (they come in pieces)
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              if (!toolCallAccumulators.has(idx)) {
                toolCallAccumulators.set(idx, {
                  id: tc.id || `call_${idx}_${Date.now()}`,
                  name: "",
                  arguments: "",
                })
              }
              const acc = toolCallAccumulators.get(idx)!
              if (tc.id) acc.id = tc.id
              if (tc.function?.name) acc.name += tc.function.name
              if (tc.function?.arguments) acc.arguments += tc.function.arguments
            }
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  } finally {
    reader.releaseLock?.()
  }

  const toolCalls = Array.from(toolCallAccumulators.values()).filter((tc) => tc.name)
  return { content: fullContent, reasoning: fullReasoning, toolCalls }
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
