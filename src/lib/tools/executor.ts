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

async function tool_search_wikipedia(
  args: Record<string, unknown>,
  _ctx: ToolContext
): Promise<ToolCallResult> {
  const query = String(args.query || "").trim()
  if (!query) return { ok: false, error: "query vazio" }
  const searchUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query
  )}&format=json&origin=*`
  const searchRes = await fetch(searchUrl)
  if (!searchRes.ok) return { ok: false, error: "Wikipedia search failed" }
  const searchData = await searchRes.json()
  const first = searchData.query?.search?.[0]
  if (!first) return { ok: true, result: { found: false } }
  // fetch summary
  const summaryUrl = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    first.title
  )}`
  const sumRes = await fetch(summaryUrl)
  if (!sumRes.ok) return { ok: false, error: "Wikipedia summary failed" }
  const sum = await sumRes.json()
  return {
    ok: true,
    result: {
      title: sum.title,
      extract: sum.extract,
      url: sum.content_urls?.desktop?.page,
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
