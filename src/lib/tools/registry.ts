// Central registry of all integrations the platform supports.
// Each entry describes: display info, what API key it needs, and the tool
// schema exposed to the LLM. To add a new integration, just append here.

export type ToolParam = {
  type: "string" | "number" | "boolean"
  description: string
  enum?: string[]
  required?: boolean
}

export type ToolSchema = {
  name: string
  description: string
  parameters: Record<string, ToolParam>
}

export type IntegrationDef = {
  service: string
  name: string
  description: string
  category: "built-in" | "weather" | "communication" | "productivity" | "knowledge" | "automation"
  icon: string // lucide icon name
  needsApiKey: boolean
  apiService?: string // which ApiKey.service to look up
  isFree: boolean
  setupUrl?: string
  tools: ToolSchema[]
}

export const INTEGRATIONS: IntegrationDef[] = [
  {
    service: "time",
    name: "Data & Hora",
    description: "Permite ao agente saber a data e hora atuais. Gratuito e sempre disponível.",
    category: "built-in",
    icon: "Clock",
    needsApiKey: false,
    isFree: true,
    tools: [
      {
        name: "get_current_datetime",
        description: "Retorna a data e hora atuais no fuso do usuário.",
        parameters: {},
      },
    ],
  },
  {
    service: "memory",
    name: "Memória Diária (Jarvis)",
    description:
      "Salva e recupera conversas em arquivos TXT diários. O agente lembra de dias anteriores. Gratuito.",
    category: "built-in",
    icon: "Brain",
    needsApiKey: false,
    isFree: true,
    tools: [
      {
        name: "save_to_memory",
        description:
          "Salva um trecho de informação no arquivo TXT do dia atual. Use para lembrar fatos importantes que o usuário mencionou.",
        parameters: {
          content: {
            type: "string",
            description: "Texto a ser guardado na memória do dia.",
            required: true,
          },
        },
      },
      {
        name: "search_memory",
        description:
          "Busca nas memórias de dias anteriores por palavras-chave. Use quando o usuário perguntar algo sobre o passado.",
        parameters: {
          query: {
            type: "string",
            description: "Termo de busca.",
            required: true,
          },
        },
      },
      {
        name: "read_today_memory",
        description: "Lê todo o conteúdo salvo na memória do dia atual.",
        parameters: {},
      },
    ],
  },
  {
    service: "openweather",
    name: "Previsão do Tempo",
    description:
      "Consulta clima atual e previsão para qualquer cidade. Requer chave gratuita da OpenWeatherMap (1000 chamadas/dia).",
    category: "weather",
    icon: "CloudSun",
    needsApiKey: true,
    apiService: "openweather",
    isFree: true,
    setupUrl: "https://openweathermap.org/api",
    tools: [
      {
        name: "get_weather",
        description: "Retorna o clima atual de uma cidade.",
        parameters: {
          city: {
            type: "string",
            description: "Nome da cidade (ex: 'São Paulo', 'Rio de Janeiro').",
            required: true,
          },
        },
      },
      {
        name: "get_forecast",
        description: "Retorna a previsão de 5 dias para uma cidade.",
        parameters: {
          city: {
            type: "string",
            description: "Nome da cidade.",
            required: true,
          },
        },
      },
    ],
  },
  {
    service: "wikipedia",
    name: "Wikipedia Multi-idioma",
    description:
      "Busca resumos na Wikipedia em qualquer idioma (PT, EN, ES, FR, DE, etc). Gratuito, sem chave de API.",
    category: "knowledge",
    icon: "BookOpen",
    needsApiKey: false,
    isFree: true,
    tools: [
      {
        name: "search_wikipedia",
        description:
          "Busca um resumo na Wikipedia sobre qualquer assunto. " +
          "Você pode especificar o idioma (padrão: pt). Use EN para tópicos técnicos, PT para tópicos brasileiros, etc. " +
          "Se o artigo não existir no idioma pedido, a ferramenta tenta automaticamente outros idiomas.",
        parameters: {
          query: {
            type: "string",
            description: "Termo de busca (no idioma de preferência).",
            required: true,
          },
          lang: {
            type: "string",
            description: "Código do idioma ISO 639-1 (ex: pt, en, es, fr, de, ja, zh). Padrão: pt.",
            required: false,
          },
        },
      },
      {
        name: "deep_research",
        description:
          "Pesquisa aprofundada: busca em múltiplos idiomas, coleta resumos de artigos relacionados " +
          "e sintetiza um relatório completo. Use para perguntas complexas que exigem contexto de várias fontes. " +
          "Mais lento que search_wikipedia, mas muito mais completo. " +
          "Níveis: 'quick' (1 idioma, sem relacionados), 'deep' (3 idiomas + 3 relacionados, padrão), " +
          "'max' (5 idiomas + 5 relacionados). O usuário pode configurar o padrão nas Settings.",
        parameters: {
          query: {
            type: "string",
            description: "Tópico a pesquisar a fundo.",
            required: true,
          },
          level: {
            type: "string",
            description:
              "Nível de profundidade: 'quick', 'deep' ou 'max'. " +
              "Se omitido, usa o padrão do usuário (configurável em Settings).",
            required: false,
            enum: ["quick", "deep", "max"],
          },
          langs: {
            type: "string",
            description:
              "Lista de idiomas para pesquisar, separados por vírgula (ex: 'pt,en,es'). " +
              "Sobrescreve o nível. Máximo 5 idiomas.",
            required: false,
          },
        },
      },
    ],
  },
  {
    service: "calculator",
    name: "Calculadora",
    description: "Realiza cálculos matemáticos. Gratuito, sem chave de API.",
    category: "built-in",
    icon: "Calculator",
    needsApiKey: false,
    isFree: true,
    tools: [
      {
        name: "calculate",
        description: "Avalia uma expressão matemática e retorna o resultado. Suporta + - * / % parênteses e funções básicas.",
        parameters: {
          expression: {
            type: "string",
            description: "Expressão matemática (ex: '2 + 2 * 3', '(10 + 5) / 3').",
            required: true,
          },
        },
      },
    ],
  },
  {
    service: "gmail",
    name: "Gmail",
    description:
      "Envia e lê emails pelo Gmail. Requer OAuth2 do Google (em breve). Demonstração de integração.",
    category: "communication",
    icon: "Mail",
    needsApiKey: true,
    apiService: "gmail",
    isFree: true,
    setupUrl: "https://console.cloud.google.com/",
    tools: [
      {
        name: "send_email",
        description: "Envia um email pelo Gmail.",
        parameters: {
          to: { type: "string", description: "Email do destinatário.", required: true },
          subject: { type: "string", description: "Assunto.", required: true },
          body: { type: "string", description: "Corpo do email.", required: true },
        },
      },
    ],
  },
  {
    service: "whatsapp",
    name: "WhatsApp",
    description:
      "Envia mensagens no WhatsApp via Twilio. Requer conta Twilio (em breve). Demonstração de integração.",
    category: "communication",
    icon: "MessageCircle",
    needsApiKey: true,
    apiService: "twilio",
    isFree: false,
    setupUrl: "https://www.twilio.com/",
    tools: [
      {
        name: "send_whatsapp",
        description: "Envia uma mensagem de WhatsApp.",
        parameters: {
          to: { type: "string", description: "Número no formato internacional (ex: 5511999999999).", required: true },
          message: { type: "string", description: "Mensagem.", required: true },
        },
      },
    ],
  },
]

export const INTEGRATION_MAP: Record<string, IntegrationDef> = Object.fromEntries(
  INTEGRATIONS.map((i) => [i.service, i])
)

export function getEnabledTools(integrations: { service: string; enabled: boolean }[]) {
  const enabled = integrations.filter((i) => i.enabled).map((i) => i.service)
  const tools: ToolSchema[] = []
  for (const svc of enabled) {
    const def = INTEGRATION_MAP[svc]
    if (def) tools.push(...def.tools)
  }
  return tools
}
