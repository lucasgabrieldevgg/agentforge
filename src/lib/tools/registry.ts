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
  category: "built-in" | "weather" | "information" | "utility" | "communication" | "productivity" | "knowledge" | "automation"
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
          "Níveis: 'quick' (1 idioma, sem relacionados), 'high' (3 idiomas + 3 relacionados, padrão), " +
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
              "Nível de profundidade: 'quick', 'high' ou 'max'. " +
              "Se omitido, usa o padrão do usuário (configurável em Settings).",
            required: false,
            enum: ["quick", "high", "max"],
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
    service: "open-meteo",
    name: "Previsão do Tempo (Open-Meteo)",
    description:
      "Consulta clima atual e previsão para qualquer cidade. Gratuito, sem chave de API.",
    category: "weather",
    icon: "CloudSun",
    needsApiKey: false,
    isFree: true,
    tools: [
      {
        name: "get_weather",
        description:
          "Retorna o clima atual de uma cidade (temperatura, vento, chuva, umidade, UV). " +
          "Útil quando o usuário pergunta sobre tempo/clima em qualquer lugar.",
        parameters: {
          city: {
            type: "string",
            description: "Nome da cidade (ex: 'São Paulo', 'Tokyo', 'New York').",
            required: true,
          },
        },
      },
    ],
  },
  {
    service: "frankfurter",
    name: "Cotação de Moedas (Frankfurter)",
    description:
      "Cotação atual e conversão entre moedas (USD, EUR, BRL, etc). Gratuito, sem chave de API.",
    category: "information",
    icon: "DollarSign",
    needsApiKey: false,
    isFree: true,
    tools: [
      {
        name: "get_exchange_rate",
        description:
          "Converte um valor de uma moeda para outra. Use quando o usuário perguntar sobre " +
          "cotação de moedas ou conversão de valores. Dados do Banco Central Europeu.",
        parameters: {
          amount: {
            type: "number",
            description: "Valor a converter (ex: 100).",
            required: true,
          },
          from: {
            type: "string",
            description: "Moeda de origem (código ISO 4217: USD, EUR, BRL, GBP, JPY, etc).",
            required: true,
          },
          to: {
            type: "string",
            description: "Moeda de destino (código ISO 4217).",
            required: true,
          },
        },
      },
    ],
  },
  {
    service: "rest-countries",
    name: "Dados de Países (REST Countries)",
    description:
      "Informações sobre qualquer país: capital, idiomas, moeda, bandeira, população, fronteiras. Gratuito, sem chave.",
    category: "information",
    icon: "Globe",
    needsApiKey: false,
    isFree: true,
    tools: [
      {
        name: "get_country_info",
        description:
          "Retorna dados de um país: capital, idiomas, moeda, população, bandeira, região, fronteiras. " +
          "Use quando o usuário perguntar sobre um país específico.",
        parameters: {
          country: {
            type: "string",
            description: "Nome do país (ex: 'Brazil', 'Japan', 'France') ou código ISO (BR, JP, FR).",
            required: true,
          },
        },
      },
    ],
  },
  {
    service: "unit-converter",
    name: "Conversor de Unidades",
    description:
      "Converte unidades (comprimento, peso, temperatura, volume, velocidade, dados, tempo). Gratuito, sem API.",
    category: "utility",
    icon: "Ruler",
    needsApiKey: false,
    isFree: true,
    tools: [
      {
        name: "convert_units",
        description:
          "Converte entre unidades. Suporta: comprimento (m, km, mi, ft, in), peso (kg, g, lb, oz), " +
          "temperatura (C, F, K), volume (l, ml, gal, qt), velocidade (m/s, km/h, mph), " +
          "dados (B, KB, MB, GB, TB), tempo (s, min, h, day). " +
          "Use quando o usuário pedir conversão de unidades.",
        parameters: {
          value: {
            type: "number",
            description: "Valor a converter (ex: 100).",
            required: true,
          },
          from: {
            type: "string",
            description: "Unidade de origem (ex: 'F', 'mi', 'GB').",
            required: true,
          },
          to: {
            type: "string",
            description: "Unidade de destino (ex: 'C', 'km', 'MB').",
            required: true,
          },
        },
      },
    ],
  },
  {
    service: "password-gen",
    name: "Gerador de Senhas",
    description:
      "Gera senhas seguras aleatórias com critérios personalizáveis. Gratuito, sem API.",
    category: "utility",
    icon: "KeyRound",
    needsApiKey: false,
    isFree: true,
    tools: [
      {
        name: "generate_password",
        description:
          "Gera uma senha aleatória segura. Use quando o usuário pedir uma senha. " +
          "Por padrão gera senha de 16 chars com letras, números e símbolos.",
        parameters: {
          length: {
            type: "number",
            description: "Tamanho da senha (padrão: 16, máx: 128).",
            required: false,
          },
          include_symbols: {
            type: "boolean",
            description: "Incluir símbolos (!@#$%&*). Padrão: true.",
            required: false,
          },
          include_numbers: {
            type: "boolean",
            description: "Incluir números. Padrão: true.",
            required: false,
          },
          count: {
            type: "number",
            description: "Quantas senhas gerar (padrão: 1, máx: 20).",
            required: false,
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
