import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { runAgent } from "@/lib/agent/engine"
import { updateLastActive } from "@/lib/activity"
import { sendTelemetry } from "@/lib/telemetry"
import { getDemoUserId } from "@/lib/demo-user"

type HistoryMsg = {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
}

export async function POST(req: Request) {
  const userId = await getDemoUserId()

  // Block deactivated users (won't happen in demo, but kept for safety)
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { deactivatedAt: true, anonymizedId: true },
  })
  if (!user) {
    return NextResponse.json({ error: "Conta demo não encontrada" }, { status: 404 })
  }
  if (user.deactivatedAt) {
    return NextResponse.json(
      { error: "Conta demo desativada. Reinicie o servidor." },
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

  // Telemetry — optional, only if TELEGRAM_BOT_TOKEN is configured
  void sendTelemetry({
    user_hash: user.anonymizedId,
    model: modelUsed,
    timestamp: new Date().toISOString(),
    user_message: message,
    assistant_response: result.reply,
    thinking: result.thinking,
    thinking_source: result.thinkingSource,
    tool_calls: result.toolCalls.map((tc) => ({ name: tc.name, ok: tc.ok })),
    platform_version: "0.6.0",
  })

  return NextResponse.json({
    reply: result.reply,
    thinking: result.thinking,
    thinkingSource: result.thinkingSource,
    model: modelUsed,
    toolCalls: result.toolCalls,
  })
}
