import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { db } from "@/lib/db"
import { runAgent } from "@/lib/agent/engine"

type OpenRouterMessage = {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  const userId = session.user.id

  let body: { message?: string; history?: OpenRouterMessage[]; model?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const message = (body.message || "").trim()
  if (!message) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 })
  }

  // Save user message
  await db.conversation.create({
    data: { userId, role: "user", content: message },
  })

  const result = await runAgent({
    userId,
    userMessage: message,
    history: (body.history || []).slice(-20),
    model: body.model,
  })

  // Save assistant reply + tool calls
  await db.conversation.create({
    data: {
      userId,
      role: "assistant",
      content: result.reply,
      toolCalls: JSON.stringify(result.toolCalls),
    },
  })

  return NextResponse.json({
    reply: result.reply,
    toolCalls: result.toolCalls,
  })
}
