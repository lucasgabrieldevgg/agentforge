// Skills executor — runs the actual skill logic.
//
// Two types of skills:
// 1. Computational skills (uuid, hash) — run pure code, return result
// 2. LLM-powered skills (translate, summarize, code, etc.) — build a specialized prompt
//    and return it. The agent engine will call the LLM with this prompt.

import crypto from "crypto"

export type SkillContext = {
  userId: string
  userTimezone?: string
}

export type SkillResult = {
  ok: boolean
  // For computational skills: the final result (string)
  // For LLM skills: a specialized prompt + system instruction that the engine
  // should send to the LLM instead of the normal flow
  result?: string
  prompt?: string
  systemOverride?: string
  error?: string
}

// ─────────────────────────────────────────────────────────────
// Computational skills
// ─────────────────────────────────────────────────────────────

async function skill_uuid(args: Record<string, unknown>): Promise<SkillResult> {
  const count = Math.min(100, Math.max(1, Number(args.count) || 1))
  const uuids: string[] = []
  for (let i = 0; i < count; i++) {
    uuids.push(crypto.randomUUID())
  }
  return {
    ok: true,
    result: uuids.join("\n"),
  }
}

async function skill_hash(args: Record<string, unknown>): Promise<SkillResult> {
  const text = String(args.text || "")
  const algorithm = String(args.algorithm || "sha256").toLowerCase()
  if (!text) return { ok: false, error: "text vazio" }
  const validAlgos = ["sha256", "sha1", "md5"]
  if (!validAlgos.includes(algorithm)) {
    return { ok: false, error: `Algoritmo inválido. Use: ${validAlgos.join(", ")}` }
  }
  const hash = crypto.createHash(algorithm).update(text).digest("hex")
  return {
    ok: true,
    result: `${algorithm.toUpperCase()}(${text}):\n${hash}`,
  }
}

// ─────────────────────────────────────────────────────────────
// LLM-powered skills — return a prompt + system override
// ─────────────────────────────────────────────────────────────

async function skill_translate(args: Record<string, unknown>): Promise<SkillResult> {
  const text = String(args.text || "").trim()
  const to = String(args.to || "").trim()
  const from = String(args.from || "auto").trim()
  if (!text || !to) return { ok: false, error: "text e to são obrigatórios" }
  return {
    ok: true,
    systemOverride:
      "Você é um tradutor profissional. Traduza o texto fornecido mantendo o tom, estilo e formatação. " +
      "Responda APENAS com a tradução, sem comentários ou explicações.",
    prompt: `Traduza o seguinte texto${from !== "auto" ? ` do ${from}` : ""} para ${to}:\n\n${text}`,
  }
}

async function skill_summarize(args: Record<string, unknown>): Promise<SkillResult> {
  const text = String(args.text || "").trim()
  const style = String(args.style || "bullets")
  if (!text) return { ok: false, error: "text é obrigatório" }
  const styleInstructions = {
    bullets: "Resuma em bullets concisos (máx 7 pontos), cada um começando com •",
    paragraph: "Resuma em um único parágrafo coeso (3-5 frases)",
    tldr: "Resuma em UMA frase (TL;DR)",
  }[style] || "Resuma em bullets"
  return {
    ok: true,
    systemOverride:
      "Você é um especialista em resumir textos. Capture os pontos essenciais sem perder contexto. " +
      styleInstructions +
      ". Responda APENAS com o resumo.",
    prompt: `Resuma o seguinte texto:\n\n${text}`,
  }
}

async function skill_rewrite(args: Record<string, unknown>): Promise<SkillResult> {
  const text = String(args.text || "").trim()
  const tone = String(args.tone || "simples")
  if (!text) return { ok: false, error: "text é obrigatório" }
  const toneInstructions = {
    formal: "tom formal e acadêmico, vocabulário cuidado",
    casual: "tom casual e descontraído, como uma conversa entre amigos",
    tecnico: "tom técnico e preciso, com terminologia da área",
    simples: "tom simples e direto, fácil de entender para qualquer pessoa",
    persuasivo: "tom persuasivo e convincente, com apelo emocional",
  }[tone] || "tom simples"
  return {
    ok: true,
    systemOverride:
      "Você é um editor profissional. Reescreva o texto mantendo o sentido mas mudando o tom. " +
      `Use ${toneInstructions}. Responda APENAS com o texto reescrito.`,
    prompt: `Reescreva o seguinte texto:\n\n${text}`,
  }
}

async function skill_code(args: Record<string, unknown>): Promise<SkillResult> {
  const action = String(args.action || "write")
  const language = String(args.language || "")
  const prompt = String(args.prompt || "").trim()
  if (!prompt) return { ok: false, error: "prompt é obrigatório" }
  const actionInstructions = {
    write: `Escreva código ${language ? `em ${language} ` : ""}que resolva o pedido. Use boas práticas, comente partes complexas.`,
    explain: `Explique o código fornecido ${language ? `(${language}) ` : ""}linha por linha, de forma didática.`,
    refactor: `Refatore o código fornecido ${language ? `(${language}) ` : ""}melhorando legibilidade, performance e boas práticas. Explique as mudanças.`,
    debug: `Debug o código fornecido ${language ? `(${language}) ` : ""}. Identifique erros, explique a causa e forneça a versão corrigida.`,
  }[action] || "Escreva código"
  return {
    ok: true,
    systemOverride:
      "Você é um engenheiro de software sênior. " +
      actionInstructions +
      ". Use blocos de código markdown com a linguagem apropriada.",
    prompt,
  }
}

async function skill_explain(args: Record<string, unknown>): Promise<SkillResult> {
  const topic = String(args.topic || "").trim()
  const level = String(args.level || "student")
  if (!topic) return { ok: false, error: "topic é obrigatório" }
  const levelInstructions = {
    child: "explique como se fosse para uma criança de 10 anos, use analogias simples do dia a dia",
    student: "explique em nível de estudante do ensino médio, com exemplos práticos",
    expert: "explique em nível técnico avançado, com detalhes, referências e nuances",
  }[level] || "explique em nível intermediário"
  return {
    ok: true,
    systemOverride:
      `Você é um professor didático. ${levelInstructions}. ` +
      "Use exemplos práticos e analogias quando ajudar.",
    prompt: `Explique: ${topic}`,
  }
}

async function skill_define(args: Record<string, unknown>): Promise<SkillResult> {
  const term = String(args.term || "").trim()
  const lang = String(args.lang || "pt")
  if (!term) return { ok: false, error: "term é obrigatório" }
  return {
    ok: true,
    systemOverride:
      `Você é um dicionário inteligente em ${lang}. Para o termo fornecido, retorne: ` +
      "1) definição clara (1-2 frases), 2) classe gramatical, 3) 2-3 sinônimos, 4) exemplo de uso. " +
      "Formate em markdown.",
    prompt: `Defina: ${term}`,
  }
}

async function skill_todo(args: Record<string, unknown>, ctx: SkillContext): Promise<SkillResult> {
  const action = String(args.action || "list")
  const task = String(args.task || "").trim()
  // Note: todos are session-only, stored in memory on the client side.
  // This skill returns instructions for the user; the actual list is managed client-side.
  // For simplicity, return a message that the agent can show.
  if (action === "add") {
    if (!task) return { ok: false, error: "task é obrigatório para add" }
    return {
      ok: true,
      result: `✅ Tarefa adicionada: "${task}"\n\n(Nota: as tarefas duram apenas a sessão atual. Anote em outro lugar se precisar persistir.)`,
    }
  }
  if (action === "list") {
    return {
      ok: true,
      result: "📋 Para ver suas tarefas, verifique a lista que você está mantendo. As tarefas desta sessão não são persistidas entre logins.",
    }
  }
  if (action === "done") {
    return {
      ok: true,
      result: `🎉 Tarefa ${task} marcada como concluída!`,
    }
  }
  if (action === "clear") {
    return {
      ok: true,
      result: "🧹 Lista de tarefas limpa.",
    }
  }
  return { ok: false, error: "ação inválida" }
}

async function skill_joke(args: Record<string, unknown>): Promise<SkillResult> {
  const topic = String(args.topic || "").trim()
  return {
    ok: true,
    systemOverride:
      "Você é um comediante. Conte UMA piada curta e engraçada. " +
      (topic ? `Sobre: ${topic}. ` : "") +
      "Responda APENAS com a piada, sem introdução.",
    prompt: topic ? `Conte uma piada sobre ${topic}` : "Conte uma piada",
  }
}

// ─────────────────────────────────────────────────────────────
// Skill router
// ─────────────────────────────────────────────────────────────

export const SKILL_IMPLEMENTATIONS: Record<
  string,
  (args: Record<string, unknown>, ctx: SkillContext) => Promise<SkillResult>
> = {
  uuid: skill_uuid,
  hash: skill_hash,
  translate: skill_translate,
  summarize: skill_summarize,
  rewrite: skill_rewrite,
  code: skill_code,
  explain: skill_explain,
  define: skill_define,
  todo: skill_todo,
  joke: skill_joke,
}

export async function executeSkill(
  builtin: string,
  args: Record<string, unknown>,
  ctx: SkillContext
): Promise<SkillResult> {
  const fn = SKILL_IMPLEMENTATIONS[builtin]
  if (!fn) return { ok: false, error: `Skill builtin desconhecido: ${builtin}` }
  try {
    return await fn(args, ctx)
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
