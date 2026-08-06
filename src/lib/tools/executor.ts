import crypto from "crypto"

export type ToolContext = {
  userId: string
  userTimezone?: string
  deepResearchLevel?: "quick" | "high" | "max"
  getApiKey: (service: string) => Promise<string | null>
}

export type ToolCallResult = {
  ok: boolean
  result?: unknown
  error?: string
}

// ----- Individual tool implementations -----

async function tool_get_current_datetime(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolCallResult> {
  const tz = ctx.userTimezone || "America/Cuiaba"
  const now = new Date()
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  return { ok: true, result: { datetime: formatter.format(now), iso: now.toISOString() } }
}

// Supported Wikipedia languages (ISO 639-1)
const WIKI_FALLBACK_LANGS = ["pt", "en", "es", "fr", "de", "ja", "zh"]

async function fetchWikiSummary(
  query: string,
  lang: string
): Promise<{ found: boolean; title?: string; extract?: string; url?: string; lang?: string }> {
  // Step 1: search for best matching article in this language
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query
  )}&format=json&origin=*&srlimit=1`
  const searchRes = await fetch(searchUrl)
  if (!searchRes.ok) return { found: false }
  const searchData = await searchRes.json()
  const first = searchData.query?.search?.[0]
  if (!first) return { found: false }

  // Step 2: fetch summary via REST API
  const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    first.title.replace(/ /g, "_")
  )}`
  const sumRes = await fetch(summaryUrl)
  if (!sumRes.ok) return { found: false }
  const sum = await sumRes.json()
  if (!sum.extract) return { found: false }
  return {
    found: true,
    title: sum.title,
    extract: sum.extract,
    url: sum.content_urls?.desktop?.page,
    lang,
  }
}

async function tool_search_wikipedia(
  args: Record<string, unknown>,
  _ctx: ToolContext
): Promise<ToolCallResult> {
  const query = String(args.query || "").trim()
  if (!query) return { ok: false, error: "query vazio" }
  const requestedLang = String(args.lang || "pt").toLowerCase().trim().slice(0, 5)

  // Try requested language first, then fall back through others
  const orderedLangs = [
    requestedLang,
    ...WIKI_FALLBACK_LANGS.filter((l) => l !== requestedLang),
  ]

  for (const lang of orderedLangs) {
    const result = await fetchWikiSummary(query, lang)
    if (result.found) {
      return {
        ok: true,
        result: {
          found: true,
          title: result.title,
          extract: result.extract,
          url: result.url,
          lang: result.lang,
          langs_tried: orderedLangs.slice(0, orderedLangs.indexOf(lang) + 1),
        },
      }
    }
  }

  return {
    ok: true,
    result: {
      found: false,
      query,
      langs_tried: orderedLangs,
      message: `Nenhum artigo encontrado para "${query}" em nenhum dos idiomas tentados.`,
    },
  }
}

// Deep Research levels — configurable per user
// - "quick": 1 language only (pt), no related articles. Fastest.
// - "high":  3 languages in parallel (pt, en, es) + 3 related articles. Default.
// - "max":   5 languages in parallel (pt, en, es, fr, de) + 5 related articles.
//            Slowest but most comprehensive.
type DeepResearchLevel = "quick" | "high" | "max"

const DEEP_RESEARCH_CONFIG: Record<
  DeepResearchLevel,
  { langs: string[]; relatedCount: number; description: string }
> = {
  quick: {
    langs: ["pt"],
    relatedCount: 0,
    description: "Rápido: 1 idioma (pt), sem artigos relacionados. ~1s.",
  },
  high: {
    langs: ["pt", "en", "es"],
    relatedCount: 3,
    description: "Profundo: 3 idiomas em paralelo (pt, en, es) + 3 relacionados. ~3s. (padrão)",
  },
  max: {
    langs: ["pt", "en", "es", "fr", "de"],
    relatedCount: 5,
    description: "Máximo: 5 idiomas em paralelo + 5 relacionados. ~5s. Mais completo.",
  },
}

async function tool_deep_research(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolCallResult> {
  const query = String(args.query || "").trim()
  if (!query) return { ok: false, error: "query vazio" }

  // Determine level: explicit arg > user setting > default
  const argLevel = String(args.level || "").toLowerCase()
  const userLevel = (ctx.deepResearchLevel || "high") as DeepResearchLevel
  const level: DeepResearchLevel =
    argLevel === "quick" || argLevel === "high" || argLevel === "max"
      ? argLevel
      : ["quick", "high", "max"].includes(userLevel)
      ? userLevel
      : "high"

  const config = DEEP_RESEARCH_CONFIG[level]

  // Allow explicit override of langs (still capped at 5)
  const argLangs = String(args.langs || "")
    .split(",")
    .map((l) => l.trim().toLowerCase().slice(0, 5))
    .filter(Boolean)
    .slice(0, 5)
  const langs = argLangs.length > 0 ? argLangs : config.langs

  // Step 1: Search across all requested languages IN PARALLEL
  const searchPromises = langs.map(async (lang) => {
    const result = await fetchWikiSummary(query, lang)
    return { lang, ...result }
  })
  const results = await Promise.all(searchPromises)
  const found = results.filter((r) => r.found)

  if (found.length === 0) {
    return {
      ok: true,
      result: {
        query,
        level,
        langs_searched: langs,
        found: false,
        message: `Nenhum artigo encontrado para "${query}" em ${langs.join(", ")}.`,
      },
    }
  }

  // Step 2: For the primary language found, also fetch related articles
  const primary = found[0]
  let related: Array<{ title: string; extract: string; url?: string }> = []

  if (config.relatedCount > 0) {
    try {
      // Search for (relatedCount + 1) articles in primary lang (first is primary itself)
      const searchUrl = `https://${primary.lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        query
      )}&format=json&origin=*&srlimit=${config.relatedCount + 1}`
      const searchRes = await fetch(searchUrl)
      if (searchRes.ok) {
        const searchData = await searchRes.json()
        const relatedTitles = (searchData.query?.search || [])
          .slice(1) // skip first (already got it)
          .slice(0, config.relatedCount)
          .map((r: { title: string }) => r.title)

        // Fetch summaries for related articles in parallel
        const relatedPromises = relatedTitles.map(async (title: string) => {
          const sumUrl = `https://${primary.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
            title.replace(/ /g, "_")
          )}`
          const sumRes = await fetch(sumUrl)
          if (!sumRes.ok) return null
          const sum = await sumRes.json()
          if (!sum.extract) return null
          return {
            title: sum.title,
            extract: sum.extract,
            url: sum.content_urls?.desktop?.page,
          }
        })
        related = (await Promise.all(relatedPromises)).filter(
          (r): r is { title: string; extract: string; url?: string } => r !== null
        )
      }
    } catch {
      // ignore — related articles are nice-to-have
    }
  }

  return {
    ok: true,
    result: {
      query,
      level,
      level_description: config.description,
      found: true,
      langs_searched: langs,
      langs_found: found.map((r) => r.lang),
      primary: {
        title: primary.title,
        extract: primary.extract,
        url: primary.url,
        lang: primary.lang,
      },
      translations: found.slice(1).map((r) => ({
        title: r.title,
        extract: r.extract,
        url: r.url,
        lang: r.lang,
      })),
      related,
      summary: `[Nível ${level.toUpperCase()}] Encontrado em ${found.length} idioma(s): ${found
        .map((r) => r.lang)
        .join(", ")}. ${related.length} artigo(s) relacionado(s) adicionais.`,
    },
  }
}

async function tool_calculate(
  args: Record<string, unknown>,
  _ctx: ToolContext
): Promise<ToolCallResult> {
  const expression = String(args.expression || "").trim()
  if (!expression) return { ok: false, error: "expression vazio" }
  // very strict calculator: only digits, operators, parens, dots, spaces, math funcs
  const safe = /^[\d\s+\-*/%().,a-zA-Z_]+$/.test(expression)
  if (!safe) return { ok: false, error: "Expressão contém caracteres inválidos" }
  try {
    // whitelist functions
    const cleaned = expression
      .replace(/,/g, ".")
      .replace(/\bMath\./g, "")
    const allowed = /^[\d\s+\-*/%.()a-zA-Z_]+$/.test(cleaned)
    if (!allowed) return { ok: false, error: "Expressão não permitida" }
    // provide common Math funcs
    const fn = new Function(
      "Math",
      `with(Math){return (${cleaned})}`
    )
    const result = fn(Math as any)
    return { ok: true, result: { expression, result } }
  } catch (e) {
    return { ok: false, error: `Erro ao calcular: ${(e as Error).message}` }
  }
}

// ----- New tools: Weather (Open-Meteo), Currency (Frankfurter), Countries, Units, Passwords -----

async function tool_get_weather(args: Record<string, unknown>): Promise<ToolCallResult> {
  const city = String(args.city || "").trim()
  if (!city) return { ok: false, error: "city vazio" }
  // Step 1: geocode city name → coordinates via Open-Meteo's geocoding API
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    city
  )}&count=1&language=pt`
  const geoRes = await fetch(geoUrl)
  if (!geoRes.ok) return { ok: false, error: "Geocoding falhou" }
  const geoData = await geoRes.json()
  const place = geoData.results?.[0]
  if (!place) return { ok: false, error: `Cidade não encontrada: ${city}` }
  // Step 2: fetch weather from Open-Meteo
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,uv_index&timezone=auto`
  const wRes = await fetch(weatherUrl)
  if (!wRes.ok) return { ok: false, error: "Weather API falhou" }
  const w = await wRes.json()
  const c = w.current || {}
  // WMO weather code → description (simplified)
  const codeMap: Record<number, string> = {
    0: "Céu limpo", 1: "Predominantemente limpo", 2: "Parcialmente nublado",
    3: "Nublado", 45: "Neblina", 48: "Neblina com geada",
    51: "Garoa leve", 53: "Garoa moderada", 55: "Garoa intensa",
    61: "Chuva leve", 63: "Chuva moderada", 65: "Chuva intensa",
    71: "Neve leve", 73: "Neve moderada", 75: "Neve intensa",
    80: "Pancadas de chuva", 81: "Pancadas moderadas", 82: "Pancadas violentas",
    95: "Tempestade", 96: "Tempestade com granizo leve", 99: "Tempestade com granizo intenso",
  }
  return {
    ok: true,
    result: {
      city: place.name,
      country: place.country,
      temperature: c.temperature_2m,
      feels_like: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      precipitation: c.precipitation,
      wind_speed: c.wind_speed_10m,
      uv_index: c.uv_index,
      description: codeMap[c.weather_code] || "Desconhecido",
      weather_code: c.weather_code,
    },
  }
}

async function tool_get_exchange_rate(args: Record<string, unknown>): Promise<ToolCallResult> {
  const amount = Number(args.amount)
  const from = String(args.from || "").toUpperCase().trim()
  const to = String(args.to || "").toUpperCase().trim()
  if (!amount || !from || !to) return { ok: false, error: "amount, from e to são obrigatórios" }
  const url = `https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: `Frankfurter ${res.status}: ${text}` }
  }
  const data = await res.json()
  const converted = data.rates?.[to]
  if (converted === undefined) return { ok: false, error: `Moeda não suportada: ${to}` }
  return {
    ok: true,
    result: {
      amount,
      from,
      to,
      converted,
      rate: converted / amount,
      date: data.date,
    },
  }
}

async function tool_get_country_info(args: Record<string, unknown>): Promise<ToolCallResult> {
  const country = String(args.country || "").trim()
  if (!country) return { ok: false, error: "country vazio" }
  const url = `https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fields=name,capital,languages,currencies,population,region,subregion,borders,flag,flags,timezones,area`
  const res = await fetch(url)
  if (!res.ok) return { ok: false, error: `País não encontrado: ${country}` }
  const data = await res.json()
  const c = Array.isArray(data) ? data[0] : data
  return {
    ok: true,
    result: {
      name: c.name?.common || c.name,
      official_name: c.name?.official,
      capital: c.capital?.[0],
      languages: c.languages ? Object.values(c.languages) : [],
      currencies: c.currencies ? Object.keys(c.currencies) : [],
      population: c.population,
      region: c.region,
      subregion: c.subregion,
      borders: c.borders || [],
      area_km2: c.area,
      timezones: c.timezones || [],
      flag_emoji: c.flag,
      flag_url: c.flags?.png,
    },
  }
}

// Unit conversion tables (to base unit)
const UNIT_FACTORS: Record<string, { category: string; toBase: number }> = {
  // length (base: meter)
  m: { category: "length", toBase: 1 },
  km: { category: "length", toBase: 1000 },
  cm: { category: "length", toBase: 0.01 },
  mm: { category: "length", toBase: 0.001 },
  mi: { category: "length", toBase: 1609.344 },
  ft: { category: "length", toBase: 0.3048 },
  in: { category: "length", toBase: 0.0254 },
  yd: { category: "length", toBase: 0.9144 },
  // weight (base: gram)
  g: { category: "weight", toBase: 1 },
  kg: { category: "weight", toBase: 1000 },
  mg: { category: "weight", toBase: 0.001 },
  lb: { category: "weight", toBase: 453.592 },
  oz: { category: "weight", toBase: 28.3495 },
  // volume (base: liter)
  l: { category: "volume", toBase: 1 },
  ml: { category: "volume", toBase: 0.001 },
  gal: { category: "volume", toBase: 3.78541 },
  qt: { category: "volume", toBase: 0.946353 },
  // speed (base: m/s)
  "m/s": { category: "speed", toBase: 1 },
  "km/h": { category: "speed", toBase: 0.277778 },
  mph: { category: "speed", toBase: 0.44704 },
  // data (base: byte)
  B: { category: "data", toBase: 1 },
  KB: { category: "data", toBase: 1024 },
  MB: { category: "data", toBase: 1024 ** 2 },
  GB: { category: "data", toBase: 1024 ** 3 },
  TB: { category: "data", toBase: 1024 ** 4 },
  // time (base: second)
  s: { category: "time", toBase: 1 },
  min: { category: "time", toBase: 60 },
  h: { category: "time", toBase: 3600 },
  day: { category: "time", toBase: 86400 },
}

async function tool_convert_units(args: Record<string, unknown>): Promise<ToolCallResult> {
  const value = Number(args.value)
  const from = String(args.from || "").trim()
  const to = String(args.to || "").trim()
  if (isNaN(value) || !from || !to) return { ok: false, error: "value, from e to são obrigatórios" }
  // Special case: temperature
  const tempUnits = ["C", "F", "K"]
  if (tempUnits.includes(from) || tempUnits.includes(to)) {
    if (!tempUnits.includes(from) || !tempUnits.includes(to)) {
      return { ok: false, error: "Conversão de temperatura requer unidades C, F ou K" }
    }
    let celsius: number
    if (from === "C") celsius = value
    else if (from === "F") celsius = (value - 32) * 5 / 9
    else celsius = value - 273.15
    let result: number
    if (to === "C") result = celsius
    else if (to === "F") result = celsius * 9 / 5 + 32
    else result = celsius + 273.15
    return { ok: true, result: { value, from, to, converted: result } }
  }
  const fromUnit = UNIT_FACTORS[from]
  const toUnit = UNIT_FACTORS[to]
  if (!fromUnit) return { ok: false, error: `Unidade não suportada: ${from}` }
  if (!toUnit) return { ok: false, error: `Unidade não suportada: ${to}` }
  if (fromUnit.category !== toUnit.category) {
    return {
      ok: false,
      error: `Não é possível converter ${from} (${fromUnit.category}) para ${to} (${toUnit.category})`,
    }
  }
  const baseValue = value * fromUnit.toBase
  const converted = baseValue / toUnit.toBase
  return { ok: true, result: { value, from, to, converted, category: fromUnit.category } }
}

async function tool_generate_password(args: Record<string, unknown>): Promise<ToolCallResult> {
  const length = Math.min(128, Math.max(4, Number(args.length) || 16))
  const includeSymbols = args.include_symbols !== false
  const includeNumbers = args.include_numbers !== false
  const count = Math.min(20, Math.max(1, Number(args.count) || 1))
  const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const numbers = "0123456789"
  const symbols = "!@#$%&*?-_"
  let charset = letters
  if (includeNumbers) charset += numbers
  if (includeSymbols) charset += symbols
  const passwords: string[] = []
  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(length)
    let pwd = ""
    for (let j = 0; j < length; j++) {
      pwd += charset[bytes[j] % charset.length]
    }
    passwords.push(pwd)
  }
  return {
    ok: true,
    result: {
      passwords,
      count: passwords.length,
      length,
      includes_symbols: includeSymbols,
      includes_numbers: includeNumbers,
    },
  }
}

// ----- Tool router -----

export const TOOL_IMPLEMENTATIONS: Record<
  string,
  (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolCallResult>
> = {
  get_current_datetime: tool_get_current_datetime,
  search_wikipedia: tool_search_wikipedia,
  deep_research: tool_deep_research,
  calculate: tool_calculate,
  get_weather: tool_get_weather,
  get_exchange_rate: tool_get_exchange_rate,
  get_country_info: tool_get_country_info,
  convert_units: tool_convert_units,
  generate_password: tool_generate_password,
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolCallResult> {
  const fn = TOOL_IMPLEMENTATIONS[name]
  if (!fn) return { ok: false, error: `Tool desconhecida: ${name}` }
  try {
    return await fn(args, ctx)
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
