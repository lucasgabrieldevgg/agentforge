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

// Demo deployments run on Vercel Hobby (60s function limit), so generated code
// must stay short. Self-hosters set DEMO_MODE=false to lift the cap.
const isDemoMode = () => process.env.DEMO_MODE !== "false"

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  pt: "Portuguese (Brazil)",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  ja: "Japanese",
  zh: "Chinese (Simplified)",
}

function languageDirective(language: string): string {
  if (language === "auto") {
    return "- 🌍 Idioma: responda SEMPRE no mesmo idioma em que o usuário escreveu."
  }
  const name = LANGUAGE_NAMES[language] || language
  return `- 🌍 Idioma: responda SEMPRE em ${name}.`
}

const SYSTEM_PROMPT_BASE = `Você é o AgentForge — um assistente pessoal inteligente e autônomo. 🤖

Você é autônomo: decide sozinho quando usar ferramentas, skills e pesquisas.

## 🛠️ Ferramentas
- 🕐 get_current_datetime — data e hora
- 🧮 calculate — matemática
- 📚 search_wikipedia — busca rápida
- 🔬 deep_research — pesquisa aprofundada (pesquise QUALQUER coisa)
- 🌤️ get_weather — clima
- 💱 get_exchange_rate — moedas
- 🌍 get_country_info — países
- 📏 convert_units — unidades
- 🔑 generate_password — senhas

## ⚡ Skills (/comando)
/translate /summarize /rewrite /code /explain /define /todo /joke /uuid /hash /color /regex /time /ascii

**⚠️ NÃO use skill_code para gerar sites ou código grande!**
- skill_code é apenas para snippets curtos e específicos
- Para sites completos, scripts, etc: gere o código DIRETAMENTE na resposta
- NÃO chame skill_code múltiplas vezes — se precisar de código, escreva você mesmo

## 📝 COMO RESPONDER — REGRAS CRÍTICAS

### REGRA #1: NUNCA inclua raciocínio na resposta
Seu raciocínio interno é capturado automaticamente pelo sistema. NÃO escreva frases como:
- "De acordo com as regras..." ou "Devo pensar sobre..."
- "Vou pensar primeiro..." ou listas de planejamento
- Tags <thinking> ou qualquer metacognição visível

Simplesmente RESPONDA direto. O usuário não quer ver seu processo de pensamento.

### Para perguntas normais:
Responda direto, com emojis e formatação visual.

### Para pedidos de CÓDIGO (site, script, função):

1. **Narração MUITO curta** (1-2 linhas MÁXIMO):
   \
   🍕 Site de pizzaria: header, menu, sobre, contato. HTML + CSS responsivo.
   \

2. **Código no FINAL, num ÚNICO bloco:**
   - Use \`\`\`html para HTML (CSS embutido)
   - NUNCA gere mais de um bloco

3. **🚫 NÃO coloque código no texto** — só no bloco final.

4. **QUALIDADE:**
   - CSS moderno: use variáveis CSS, flexbox
   - Cores harmoniosas (não use #FF0000 puro)
   - 1 imagem Unsplash no máximo (hero background)
   - Responsivo com 1 media query simples

O código será extraído como arquivo anexo automaticamente. O usuário vê a narração no chat e o código como arquivo.

## 🎨 Estilo
- Emojis com moderação 🎯
- **Negrito** pra destacar
- Listas pra organizar

## 🌍 Diretrizes
- USE ferramentas proativamente
- Se uma ferramenta falhar, explique
- Seja conciso`

// Demo-only constraints: the hosted demo runs on Vercel Hobby's 60s function
// limit, so long code gets cut mid-stream. Kept out of self-hosted instances.
const DEMO_CODE_LIMITS = `### ⚠️ REGRAS OBRIGATÓRIAS — TEMPO LIMITADO! (modo demo)

Você tem aproximadamente 60 SEGUNDOS no total — incluindo thinking e Deep Research. Se os modos Thinking/Deep Research Max estiverem ativos, reduza a profundidade sozinho pra caber no tempo. Se o código for muito longo, será CORTADO. Por isso:

- **Narração de 1 linha.**
- **Código MÁXIMO 80 LINHAS** — isso é CRÍTICO:
  - Use CSS INLINE (style dentro do head, sem comentários)
  - 3-4 seções apenas (header, 1 seção de conteúdo, footer)
  - SEM JavaScript desnecessário (só se for essencial)
  - SEM comentários no código
  - CSS enxuto: 1 linha por regra quando possível
  - NUNCA corte no meio — se não couber em 80 linhas, simplifique o design`

// Self-hosted instances have no time limit: the agent works transparently,
// narrating each step while it works (tools, research, code structure).
const SELF_HOSTED_NARRATION = `## 🎬 Transparência enquanto trabalha

Você não tem limite de tempo. Enquanto trabalha, NARRE brevemente o que está fazendo:
- Antes de usar uma ferramenta, diga em 1 linha o que vai buscar ("Vou pesquisar X na Wikipedia...")
- Antes de gerar código, liste em 1-2 linhas a estrutura que pretende criar
- Depois de cada passo relevante, comente o resultado em 1 linha
- Seja conciso: narração curtinha, trabalho completo. Nada de parágrafos longos.

O usuário acompanha seu trabalho em tempo real — como ver um agente pensando em voz alta.`

function buildSystemPrompt(language: string, budgetLine = ""): string {
  const parts = [SYSTEM_PROMPT_BASE, languageDirective(language)]
  if (isDemoMode()) parts.push(DEMO_CODE_LIMITS)
  else parts.push(SELF_HOSTED_NARRATION)
  if (budgetLine) parts.push(budgetLine)
  return parts.join("\n\n")
}

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
  deepResearchLevel?: "quick" | "high" | "max"
  language?: string
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
  const { userId, userMessage, history, model, onEvent } = opts
  // In the hosted demo (60s function limit), Max levels risk running out of
  // time mid-generation — clamp them to High. Self-hosted keeps full Max.
  const thinkingLevel: "quick" | "high" | "max" =
    isDemoMode() && opts.thinkingLevel === "max" ? "high" : (opts.thinkingLevel ?? "quick")
  const deepResearchLevel: "quick" | "high" | "max" | undefined =
    isDemoMode() && opts.deepResearchLevel === "max" ? "high" : opts.deepResearchLevel

  // ── Time budget manager (demo only) ─────────────────────────────────────
  // The Vercel Hobby function dies at 60s. We plan against a 55s deadline so
  // there is always room to persist the conversation and emit `done`.
  // The deadline itself is the judge: generations run free and are only cut
  // when the time is truly gone. Token budgets keep a generous floor because
  // reasoning tokens share the same budget as content — starving them is what
  // produced empty code artifacts.
  const DEMO_BUDGET_MS = 55_000
  const deadline = isDemoMode() ? Date.now() + DEMO_BUDGET_MS : 0
  const remainingMs = () => (deadline ? deadline - Date.now() : Number.POSITIVE_INFINITY)
  const tokensForRemaining = () => {
    if (!deadline) return 16000
    const sec = Math.max(0, Math.floor(remainingMs() / 1000))
    // ~40 tok/s is closer to real free-model throughput; the 1200 floor
    // guarantees room for actual content even after reasoning tokens.
    return Math.max(1200, Math.min(4000, sec * 40))
  }
  const TIME_OUT_NOTE =
    "\n\n⏱️ **Resposta encurtada** pra caber no limite de 60s da demo. Baixe/rode o projeto localmente pra respostas sem limite."

  // ── Phase budget plan: how the remaining time is split per level ────────
  // Deterministic and told to the model, so it can calibrate how much it
  // thinks, researches and writes. The deadline remains the final judge.
  const budgetLine = (() => {
    if (!deadline) return ""
    const totalS = 52
    const think = thinkingLevel === "quick" ? 4 : thinkingLevel === "high" ? 8 : 12
    const research = (deepResearchLevel ?? "high") === "quick" ? 4 : (deepResearchLevel ?? "high") === "high" ? 8 : 12
    const gen = Math.max(20, totalS - think - research)
    return `### ⏱️ Seu orçamento de tempo (demo)

Você tem ~${totalS}s no TOTAL, dividido assim:
- 🧠 Pensar: no máximo ~${think}s (seja direto no raciocínio)
- 🔍 Pesquisar: no máximo ~${research}s (1-2 ferramentas, sem aprofundar)
- ✍️ Escrever a resposta/código: reserve pelo menos ~${gen}s

Regra de ouro: se o código não couber no tempo que sobrou, SIMPLIFIQUE o design e entregue completo — NUNCA pare no meio de uma tag ou função.`
  })()
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
    deepResearchLevel: (deepResearchLevel || userRow?.deepResearchLevel || "high") as "quick" | "high" | "max",
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
  const languageValue = opts.language || "auto"
  const basePrompt = buildSystemPrompt(languageValue, budgetLine)
  const systemPrompt = useSyntheticCoT ? `${basePrompt}\n\n${cotPrompt}` : basePrompt

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
  // Parts already delivered by previous rounds of a length-cut generation —
  // stitched together with the final round for the complete answer.
  let deliveredParts = ""
  // Continuation rounds don't re-think: every token goes into content.
  let isContinuation = false

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
    // ── Budget gate: is there still time for another full generation? ──
    if (remainingMs() < 10_000) {
      // Deliver whatever we already have; if nothing, explain gracefully
      // instead of dying to the platform's hard 60s cutoff.
      if (!finalReply) {
        finalReply =
          "⏱️ O tempo da demo (60s) acabou antes de eu conseguir responder completely. Tente um pedido mais simples, ou baixe o projeto pra rodar sem limite." +
          TIME_OUT_NOTE
        onEvent("content", { chunk: finalReply })
      }
      break
    }

    // Scenario management: tools invite another generation round-trip — only
    // offer them while there is comfortable time left.
    const toolsForThisRound = remainingMs() > 30_000 ? allTools : []

    const streamResult = await streamLLM(
      messages,
      selectedModel,
      openRouterKey,
      toolsForThisRound,
      onEvent,
      isContinuation ? undefined : reasoningEffort,
      {
        maxTokens: isContinuation ? 2000 : tokensForRemaining(),
        // Hard stop just before the true deadline — this is the last-resort
        // cut, not a prediction. Partial content survives it.
        timeoutMs: deadline ? Math.max(3_000, remainingMs() - 3_000) : undefined,
      }
    )

    // Generation was cut by the real deadline — deliver the partial answer
    // (only when there is actual content worth delivering).
    if (streamResult.aborted && streamResult.content.trim().length > 150) {
      finalReply = deliveredParts + streamResult.content + TIME_OUT_NOTE
      onEvent("content", { chunk: TIME_OUT_NOTE })
      break
    }

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

    // ── Continuation rescue: the model hit its token limit mid-answer (the
    // silent "stopped in the middle" failure). If there is still time, ask it
    // to continue EXACTLY where it stopped and stitch the parts together.
    if (streamResult.finishReason === "length" && finalReply.trim() && remainingMs() > 12_000) {
      deliveredParts += finalReply
      messages.push({ role: "assistant", content: finalReply })
      messages.push({
        role: "user",
        content:
          "Continue EXATAMENTE de onde você parou. Não repita nada do que já escreveu, não reexplique, não peça desculpas — apenas retome o texto/código no caractere seguinte ao último que você escreveu.",
      })
      onEvent("content", { chunk: "" })
      isContinuation = true
      continue
    }

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

    // Empty generation (e.g. reasoning tokens ate the whole budget): retry
    // while there is still comfortable time instead of delivering nothing.
    if (!finalReply.trim() && remainingMs() > 15_000) {
      continue
    }
    finalReply = deliveredParts + finalReply
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
  reasoningEffort?: "low" | "medium" | "high",
  budget?: { maxTokens?: number; timeoutMs?: number }
): Promise<{
  content: string
  reasoning: string
  toolCalls: Array<{ id: string; name: string; arguments: string }>
  finishReason?: string | null
  aborted?: boolean
  error?: string
}> {
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    tools: tools.length ? tools : undefined,
    tool_choice: tools.length ? "auto" : undefined,
    temperature: 0.7,
    max_tokens: budget?.maxTokens ?? (isDemoMode() ? 4000 : 16000),
  }
  // Add reasoning controls for models that support them (OpenRouter
  // extension). OpenRouter rejects effort + max_tokens together, so pick one:
  // demo uses the hard token cap (thinking can't devour the content budget —
  // the "thought a lot, delivered empty code" failure); self-hosted uses the
  // effort level since there is no time pressure.
  if (reasoningEffort) {
    body.reasoning = isDemoMode() ? { max_tokens: 600 } : { effort: reasoningEffort }
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
    // Time guard: abort slightly before the budget ends so whatever has
    // streamed so far can still be delivered to the user.
    signal: budget?.timeoutMs ? AbortSignal.timeout(budget.timeoutMs) : undefined,
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
  let aborted = false
  let finishReason: string | null = null
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
          const choice = parsed.choices?.[0]
          const delta = choice?.delta
          if (choice?.finish_reason) finishReason = choice.finish_reason
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
  } catch {
    // Our own AbortSignal fired (or the connection dropped): salvage whatever
    // streamed so far instead of losing the whole answer.
    aborted = true
  } finally {
    reader.releaseLock?.()
  }

  const toolCalls = aborted ? [] : Array.from(toolCallAccumulators.values()).filter((tc) => tc.name)
  return { content: fullContent, reasoning: fullReasoning, toolCalls, aborted, finishReason }
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
