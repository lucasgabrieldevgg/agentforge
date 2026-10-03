import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { INTEGRATION_MAP } from "@/lib/tools/registry"
import { getDemoUserId } from "@/lib/demo-user"

export async function GET() {
  const userId = await getDemoUserId()
  const keys = await db.apiKey.findMany({ where: { userId } })
  const masked = keys.map((k) => ({
    id: k.id,
    service: k.service,
    name: INTEGRATION_MAP[k.service]?.name || k.service,
    isActive: k.isActive,
    masked: k.keyValue ? `${k.keyValue.slice(0, 4)}...${k.keyValue.slice(-4)}` : "",
    createdAt: k.createdAt,
  }))
  return NextResponse.json({ keys: masked })
}

export async function POST(req: Request) {
  const userId = await getDemoUserId()
  const body = await req.json().catch(() => ({}))
  const { service, keyValue } = body as { service: string; keyValue: string }
  if (!service || !keyValue) {
    return NextResponse.json({ error: "service e keyValue obrigatórios" }, { status: 400 })
  }
  const existing = await db.apiKey.findUnique({
    where: { userId_service: { userId, service } },
  })
  let row
  if (existing) {
    row = await db.apiKey.update({
      where: { id: existing.id },
      data: { keyValue, isActive: true },
    })
  } else {
    row = await db.apiKey.create({
      data: { userId, service, keyValue, isActive: true },
    })
  }
  return NextResponse.json({ ok: true, id: row.id })
}

export async function DELETE(req: Request) {
  const userId = await getDemoUserId()
  const { searchParams } = new URL(req.url)
  const service = searchParams.get("service")
  if (!service) return NextResponse.json({ error: "service obrigatório" }, { status: 400 })
  await db.apiKey.deleteMany({ where: { userId, service } })
  return NextResponse.json({ ok: true })
}
