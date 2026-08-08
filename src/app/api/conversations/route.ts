import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getDemoUserId } from "@/lib/demo-user"

export async function GET() {
  const userId = await getDemoUserId()
  const messages = await db.conversation.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 100,
  })
  return NextResponse.json({ messages })
}

export async function DELETE() {
  const userId = await getDemoUserId()
  await db.conversation.deleteMany({ where: { userId } })
  return NextResponse.json({ ok: true })
}
