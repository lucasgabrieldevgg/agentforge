import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { db } from "@/lib/db"
import { INTEGRATION_MAP } from "@/lib/tools/registry"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  const keys = await db.apiKey.findMany({ where: { userId: session.user.id } })
  // mask keys
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
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  const userId = session.user.id
  const body = await req.json().catch(() => ({}))
  const { service, keyValue } = body as { service: string; keyValue: string }
  if (!service || !keyValue) {
    return NextResponse.json({ error: "service e keyValue obrigatórios" }, { status: 400 })
  }
  // upsert
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
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  const userId = session.user.id
  const { searchParams } = new URL(req.url)
  const service = searchParams.get("service")
  if (!service) return NextResponse.json({ error: "service obrigatório" }, { status: 400 })
  await db.apiKey.deleteMany({ where: { userId, service } })
  return NextResponse.json({ ok: true })
}
