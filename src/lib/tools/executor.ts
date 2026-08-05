import { db } from "@/lib/db"
import type { ToolSchema } from "@/lib/tools/registry"

export type ToolContext = {
  userId: string
  userTimezone?: string
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

async function tool_save_to_memory(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolCallResult> {
  const content = String(args.content || "").trim()
  if (!content) return { ok: false, error: "content vazio" }
  const tz = ctx.userTimezone || "America/Cuiaba"
  const now = new Date()
  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now)
  const timeStr = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(now)

  const existing = await db.dailyLog.findUnique({
    where: { userId_date: { userId: ctx.userId, date: dateStr } },
  })
  const newEntry = `\n[${timeStr}] ${content}\n`
  if (existing) {
    await db.dailyLog.update({
      where: { id: existing.id },
      data: { content: existing.content + newEntry },
    })
  } else {
    await db.dailyLog.create({
      data: { userId: ctx.userId, date: dateStr, content: newEntry.trim() },
    })
  }
  return { ok: true, result: { saved: true, date: dateStr } }
}

async function tool_search_memory(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolCallResult> {
  const query = String(args.query || "").toLowerCase().trim()
  if (!query) return { ok: false, error: "query vazio" }
  const logs = await db.dailyLog.findMany({
    where: { userId: ctx.userId, content: { contains: query } },
    orderBy: { date: "desc" },
    take: 10,
  })
  const matches = logs.map((l) => ({
    date: l.date,
    snippet: l.content
      .split("\n")
      .filter((line) => line.toLowerCase().includes(query))
      .join(" | "),
  }))
  return { ok: true, result: { count: matches.length, matches } }
}

async function tool_read_today_memory(
  _args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolCallResult> {
  const tz = ctx.userTimezone || "America/Cuiaba"
  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date())
  const log = await db.dailyLog.findUnique({
    where: { userId_date: { userId: ctx.userId, date: dateStr } },
  })
  return { ok: true, result: { date: dateStr, content: log?.content || "" } }
}

async function tool_get_weather(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolCallResult> {
  const city = String(args.city || "").trim()
  if (!city) return { ok: false, error: "city vazio" }
  const apiKey = await ctx.getApiKey("openweather")
  if (!apiKey) {
    return {
      ok: false,
      error: "Chave da OpenWeatherMap não configurada. Peça ao usuário para adicioná-la em API Keys.",
    }
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
    city
  )}&appid=${apiKey}&units=metric&lang=pt_br`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: `OpenWeather ${res.status}: ${text}` }
  }
  const data = await res.json()
  return {
    ok: true,
    result: {
      city: data.name,
      temp: data.main?.temp,
      feels_like: data.main?.feels_like,
      description: data.weather?.[0]?.description,
      humidity: data.main?.humidity,
      wind: data.wind?.speed,
    },
  }
}

async function tool_get_forecast(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolCallResult> {
  const city = String(args.city || "").trim()
  if (!city) return { ok: false, error: "city vazio" }
  const apiKey = await ctx.getApiKey("openweather")
  if (!apiKey) {
    return { ok: false, error: "Chave da OpenWeatherMap não configurada." }
  }
  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
    city
  )}&appid=${apiKey}&units=metric&lang=pt_br`
  const res = await fetch(url)
  if (!res.ok) return { ok: false, error: `OpenWeather ${res.status}` }
  const data = await res.json()
  const list = (data.list || []).slice(0, 8).map((item: any) => ({
    time: item.dt_txt,
    temp: item.main?.temp,
    description: item.weather?.[0]?.description,
  }))
  return { ok: true, result: { city: data.city?.name, forecast: list } }
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

async function tool_deep_research(
  args: Record<string, unknown>,
  _ctx: ToolContext
): Promise<ToolCallResult> {
  const query = String(args.query || "").trim()
  if (!query) return { ok: false, error: "query vazio" }

  // Parse langs (comma-separated), default to pt,en,es. Max 5.
  const langsArg = String(args.langs || "pt,en,es")
    .split(",")
    .map((l) => l.trim().toLowerCase().slice(0, 5))
    .filter(Boolean)
    .slice(0, 5)
  const langs = langsArg.length > 0 ? langsArg : ["pt", "en", "es"]

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
        langs_searched: langs,
        found: false,
        message: `Nenhum artigo encontrado para "${query}" em ${langs.join(", ")}.`,
      },
    }
  }

  // Step 2: For the primary language found, also fetch related articles
  const primary = found[0]
  let related: Array<{ title: string; extract: string; url?: string }> = []

  try {
    // Use the "search" API to get up to 3 more related articles in primary lang
    const searchUrl = `https://${primary.lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&format=json&origin=*&srlimit=4`
    const searchRes = await fetch(searchUrl)
    if (searchRes.ok) {
      const searchData = await searchRes.json()
      const relatedTitles = (searchData.query?.search || [])
        .slice(1) // skip first (already got it)
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

  return {
    ok: true,
    result: {
      query,
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
      summary: `Encontrado em ${found.length} idioma(s): ${found
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

// ----- Tool router -----

export const TOOL_IMPLEMENTATIONS: Record<
  string,
  (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolCallResult>
> = {
  get_current_datetime: tool_get_current_datetime,
  save_to_memory: tool_save_to_memory,
  search_memory: tool_search_memory,
  read_today_memory: tool_read_today_memory,
  get_weather: tool_get_weather,
  get_forecast: tool_get_forecast,
  search_wikipedia: tool_search_wikipedia,
  deep_research: tool_deep_research,
  calculate: tool_calculate,
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
