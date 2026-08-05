import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { db } from "@/lib/db"
import { runAgent } from "@/lib/agent/engine"
import { updateLastActive } from "@/lib/activity"
import { sendTelemetry } from "@/lib/telemetry"

type HistoryMsg = {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  const userId = session.user.id

  // Block deactivated users
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      deactivatedAt: true,
      tosVersion: true,
      telemetryOptIn: true,
      anonymizedId: true,
    },
  })
  if (!user) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 })
  }
  if (user.deactivatedAt) {
    return NextResponse.json(
      { error: "Sua conta foi desativada por inatividade. Faça login novamente para reativá-la." },
      { status: 403 }
    )
  }

  let body: {
    message?: string
    history?: HistoryMsg[]
    model?: string
    thinking?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const message = (body.message || "").trim()
  if (!message) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 })
  }

  void updateLastActive(userId)

  await db.conversation.create({
    data: { userId, role: "user", content: message },
  })

  const result = await runAgent({
    userId,
    userMessage: message,
    history: (body.history || []).slice(-20),
    model: body.model,
    thinking: body.thinking === true,
  })

  const modelUsed = result.modelUsed
  await db.conversation.create({
    data: {
      userId,
      role: "assistant",
      content: result.reply,
      toolCalls: JSON.stringify(result.toolCalls),
      model: modelUsed,
    },
  })

  // Telemetry — include thinking if present (super valuable for Noema training)
  if (user.telemetryOptIn) {
    void sendTelemetry({
      user_hash: user.anonymizedId,
      model: modelUsed,
      timestamp: new Date().toISOString(),
      user_message: message,
      assistant_response: result.reply,
      thinking: result.thinking,
      thinking_source: result.thinkingSource,
      tool_calls: result.toolCalls.map((tc) => ({ name: tc.name, ok: tc.ok })),
      platform_version: "0.3.0",
    })
  }

  return NextResponse.json({
    reply: result.reply,
    thinking: result.thinking,
    thinkingSource: result.thinkingSource,
    model: modelUsed,
    toolCalls: result.toolCalls,
  })
}
