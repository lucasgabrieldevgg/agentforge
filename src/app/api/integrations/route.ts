import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { db } from "@/lib/db"
import { INTEGRATIONS } from "@/lib/tools/registry"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  const userId = session.user.id
  const userIntegrations = await db.integration.findMany({ where: { userId } })
  const userMap = Object.fromEntries(userIntegrations.map((i) => [i.service, i]))

  const catalog = INTEGRATIONS.map((def) => ({
    service: def.service,
    name: def.name,
    description: def.description,
    category: def.category,
    icon: def.icon,
    needsApiKey: def.needsApiKey,
    isFree: def.isFree,
    setupUrl: def.setupUrl,
    enabled: userMap[def.service]?.enabled ?? false,
    hasApiKey: false as boolean, // fill below
  }))

  // check api keys
  const apiKeys = await db.apiKey.findMany({ where: { userId } })
  const keySet = new Set(apiKeys.map((k) => k.service))
  for (const item of catalog) {
    const def = INTEGRATIONS.find((d) => d.service === item.service)
    if (def?.apiService) {
      item.hasApiKey = keySet.has(def.apiService)
    }
  }

  return NextResponse.json({ catalog })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  const userId = session.user.id
  const body = await req.json().catch(() => ({}))
  const { service, enabled } = body as { service: string; enabled: boolean }
  if (!service) return NextResponse.json({ error: "service obrigatório" }, { status: 400 })

  const existing = await db.integration.findUnique({
    where: { userId_service: { userId, service } },
  })
  if (existing) {
    await db.integration.update({
      where: { id: existing.id },
      data: { enabled },
    })
  } else {
    await db.integration.create({
      data: { userId, service, enabled, config: "{}" },
    })
  }
  return NextResponse.json({ ok: true })
}
