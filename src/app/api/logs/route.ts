import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  const userId = session.user.id
  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date") // YYYY-MM-DD

  if (date) {
    const log = await db.dailyLog.findUnique({
      where: { userId_date: { userId, date } },
    })
    return NextResponse.json({ log })
  }

  const logs = await db.dailyLog.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 60,
  })
  return NextResponse.json({ logs })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  const userId = session.user.id
  const body = await req.json().catch(() => ({}))
  const { date, content } = body as { date: string; content: string }
  if (!date) return NextResponse.json({ error: "date obrigatório" }, { status: 400 })

  const existing = await db.dailyLog.findUnique({
    where: { userId_date: { userId, date } },
  })
  let log
  if (existing) {
    log = await db.dailyLog.update({
      where: { id: existing.id },
      data: { content },
    })
  } else {
    log = await db.dailyLog.create({ data: { userId, date, content } })
  }
  return NextResponse.json({ log })
}
