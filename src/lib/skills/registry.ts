// Skills registry — inspired by Slack slash commands, Discord, MCP, and Raycast.
//
// A Skill is a higher-level capability than a Tool:
// - Tools are low-level API calls the agent can make (search_wikipedia, calculate)
// - Skills are user-facing capabilities that may compose multiple tools or use prompts
//
// Skills can be:
//   1. Invoked explicitly by the user via /skill-name in the chat (like Slack/Discord)
//   2. Invoked automatically by the AI when relevant (like ChatGPT/MCP function calling)
//
// Each skill has:
//   - slash_command: the /name users type
//   - aliases: alternative names
//   - auto_trigger: can the AI use it without explicit /command?
//   - requires_consent: should we ask the user before running? (destructive ops)
//   - parameters: typed args (string/number/enum)
//   - executor: builtin function that runs the skill

export type SkillParameter = {
  key: string
  type: "string" | "number" | "boolean"
  description: string
  required?: boolean
  default?: string | number | boolean
  enum?: string[]
  placeholder?: string
}

export type SkillSchema = {
  name: string
  display_name: string
  description: string
  long_description: string
  icon: string
  category: "writing" | "dev" | "knowledge" | "productivity" | "fun" | "utility"
  slash_command: string
  aliases?: string[]
  auto_trigger: boolean
  requires_consent: boolean
  parameters: SkillParameter[]
  builtin: string
  version?: string
}

export const SKILLS: SkillSchema[] = [
  {
    name: "translate",
    display_name: "Traduzir",
    description:
      "Traduz um texto para outro idioma. Detecta o idioma de origem automaticamente. " +
      "Use quando o usuário pedir para traduzir algo.",
    long_description:
      "Traduz texto entre qualquer par de idiomas. Detecta a origem automaticamente. " +
      "Use /translate [texto] para [idioma] ou deixe a IA decidir.",
    icon: "Languages",
    category: "writing",
    slash_command: "translate",
    aliases: ["tr", "traduzir"],
    auto_trigger: true,
    requires_consent: false,
    parameters: [
      { key: "text", type: "string", description: "Texto a traduzir", required: true, placeholder: "Hello world" },
      { key: "to", type: "string", description: "Idioma de destino (ex: en, pt, es, fr, de, ja)", required: true, placeholder: "pt" },
      { key: "from", type: "string", description: "Idioma de origem (auto-detecta se omitido)", required: false, placeholder: "auto" },
    ],
    builtin: "translate",
    version: "1.0.0",
  },
  {
    name: "summarize",
    display_name: "Resumir",
    description:
      "Resume um texto longo em pontos principais. Use quando o usuário colar um texto " +
      "longo ou pedir um resumo.",
    long_description:
      "Resume textos longos em bullets ou parágrafo. Estilo TL;DR disponível. " +
      "Use /summarize [texto].",
    icon: "FileText",
    category: "writing",
    slash_command: "summarize",
    aliases: ["resumo", "tldr"],
    auto_trigger: true,
    requires_consent: false,
    parameters: [
      { key: "text", type: "string", description: "Texto a resumir", required: true },
      { key: "style", type: "string", description: "Estilo do resumo", enum: ["bullets", "paragraph", "tldr"], default: "bullets", required: false },
    ],
    builtin: "summarize",
    version: "1.0.0",
  },
  {
    name: "rewrite",
    display_name: "Reescrever",
    description:
      "Reescreve um texto em outro tom (formal, casual, técnico, simples). " +
      "Útil para melhorar clareza ou adaptar audiência.",
    long_description:
      "Reescreve textos mantendo o sentido mas mudando o tom. " +
      "Use /rewrite [texto] tom=[formal|casual|tecnico|simples].",
    icon: "PenLine",
    category: "writing",
    slash_command: "rewrite",
    aliases: ["reescrever"],
    auto_trigger: false,
    requires_consent: false,
    parameters: [
      { key: "text", type: "string", description: "Texto a reescrever", required: true },
      { key: "tone", type: "string", description: "Tom desejado", enum: ["formal", "casual", "tecnico", "simples", "persuasivo"], default: "simples", required: false },
    ],
    builtin: "rewrite",
    version: "1.0.0",
  },
  {
    name: "code",
    display_name: "Código",
    description:
      "Gera, explica, refatora ou debuga código. Use quando o usuário pedir ajuda com " +
      "programação.",
    long_description:
      "Assistente de código completo. Gera código do zero, explica código existente, " +
      "refatora para melhorar, ou ajuda a debugar erros. " +
      "Use /code [ação] [linguagem] [prompt].",
    icon: "Code2",
    category: "dev",
    slash_command: "code",
    aliases: ["codigo", "dev"],
    auto_trigger: true,
    requires_consent: false,
    parameters: [
      { key: "action", type: "string", description: "Ação", enum: ["write", "explain", "refactor", "debug"], default: "write", required: true },
      { key: "language", type: "string", description: "Linguagem (ex: python, javascript, rust)", required: false, placeholder: "python" },
      { key: "prompt", type: "string", description: "O que fazer", required: true },
    ],
    builtin: "code",
    version: "1.0.0",
  },
  {
    name: "explain",
    display_name: "Explicar",
    description:
      "Explica um conceito em diferentes níveis (criança, estudante, especialista). " +
      "Use quando o usuário pedir para explicar algo.",
    long_description:
      "Explica conceitos em 3 níveis: ELI5 (criança), estudante, especialista. " +
      "Use /explain [conceito] nivel=[child|student|expert].",
    icon: "GraduationCap",
    category: "knowledge",
    slash_command: "explain",
    aliases: ["explicar"],
    auto_trigger: true,
    requires_consent: false,
    parameters: [
      { key: "topic", type: "string", description: "Conceito a explicar", required: true },
      { key: "level", type: "string", description: "Nível", enum: ["child", "student", "expert"], default: "student", required: false },
    ],
    builtin: "explain",
    version: "1.0.0",
  },
  {
    name: "define",
    display_name: "Definir",
    description:
      "Define uma palavra ou termo (dicionário). Retorna definição, sinônimos e exemplos.",
    long_description:
      "Dicionário inteligente. Define palavras, termos técnicos ou expressões. " +
      "Use /define [palavra].",
    icon: "BookOpen",
    category: "knowledge",
    slash_command: "define",
    aliases: ["definir", "dicionario"],
    auto_trigger: true,
    requires_consent: false,
    parameters: [
      { key: "term", type: "string", description: "Palavra ou termo a definir", required: true },
      { key: "lang", type: "string", description: "Idioma (padrão: pt)", default: "pt", required: false },
    ],
    builtin: "define",
    version: "1.0.0",
  },
  {
    name: "todo",
    display_name: "Lista de Tarefas",
    description:
      "Adiciona, lista ou marca tarefas como concluídas. As tarefas duram a sessão atual.",
    long_description:
      "Lista de tarefas simples pra sessão atual. " +
      "Use /todo add [tarefa], /todo list, /todo done [número].",
    icon: "ListTodo",
    category: "productivity",
    slash_command: "todo",
    aliases: ["tarefa", "task"],
    auto_trigger: true,
    requires_consent: false,
    parameters: [
      { key: "action", type: "string", description: "Ação", enum: ["add", "list", "done", "clear"], default: "list", required: true },
      { key: "task", type: "string", description: "Texto da tarefa (para add) ou número (para done)", required: false },
    ],
    builtin: "todo",
    version: "1.0.0",
  },
  {
    name: "joke",
    display_name: "Piada",
    description: "Conta uma piada. Pode especificar o tema.",
    long_description:
      "Conta uma piada. Tema opcional. Use /joke ou /joke tema=[programação].",
    icon: "Smile",
    category: "fun",
    slash_command: "joke",
    aliases: ["piada"],
    auto_trigger: false,
    requires_consent: false,
    parameters: [
      { key: "topic", type: "string", description: "Tema da piada (opcional)", required: false },
    ],
    builtin: "joke",
    version: "1.0.0",
  },
  {
    name: "uuid",
    display_name: "Gerar UUID",
    description: "Gera um UUID v4 aleatório. Útil para IDs únicos.",
    long_description:
      "Gera um ou mais UUIDs v4. Use /uuid ou /uuid count=5.",
    icon: "Fingerprint",
    category: "utility",
    slash_command: "uuid",
    aliases: ["guid"],
    auto_trigger: false,
    requires_consent: false,
    parameters: [
      { key: "count", type: "number", description: "Quantos UUIDs gerar (1-100)", default: 1, required: false },
    ],
    builtin: "uuid",
    version: "1.0.0",
  },
  {
    name: "hash",
    display_name: "Hash",
    description:
      "Calcula hash de um texto (SHA-256, SHA-1, MD5). Útil para verificar integridade.",
    long_description:
      "Calcula hash criptográfico. Use /hash [texto] algoritmo=[sha256|sha1|md5].",
    icon: "Hash",
    category: "utility",
    slash_command: "hash",
    auto_trigger: false,
    requires_consent: false,
    parameters: [
      { key: "text", type: "string", description: "Texto para hashear", required: true },
      { key: "algorithm", type: "string", description: "Algoritmo", enum: ["sha256", "sha1", "md5"], default: "sha256", required: false },
    ],
    builtin: "hash",
    version: "1.0.0",
  },
]

export const SKILL_MAP: Record<string, SkillSchema> = Object.fromEntries(
  SKILLS.map((s) => [s.name, s])
)

export function getAutoTriggerSkills(enabledSkillNames: string[]): SkillSchema[] {
  return SKILLS.filter(
    (s) => enabledSkillNames.includes(s.name) && s.auto_trigger
  )
}

export function findSkillByCommand(command: string): SkillSchema | undefined {
  return SKILLS.find(
    (s) => s.slash_command === command || s.aliases?.includes(command)
  )
}

export function skillToToolSchema(skill: SkillSchema) {
  const properties: Record<string, unknown> = {}
  const required: string[] = []
  for (const param of skill.parameters) {
    const prop: Record<string, unknown> = {
      type: param.type,
      description: param.description,
    }
    if (param.enum) prop.enum = param.enum
    if (param.default !== undefined) prop.default = param.default
    properties[param.key] = prop
    if (param.required) required.push(param.key)
  }
  return {
    type: "function" as const,
    function: {
      name: `skill_${skill.name}`,
      description: `[SKILL] ${skill.description}`,
      parameters: {
        type: "object",
        properties,
        required,
      },
    },
  }
}
