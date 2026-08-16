// Streaming chat endpoint — streams the agent's response, thinking, and tool calls
// in real-time using Server-Sent Events (SSE).
//
// Events emitted:
// - thinking: { content, source } — reasoning from the model (native or synthetic)
// - tool_start: { name, args } — agent is calling a tool/skill
// - tool_result: { name, args, result, ok } — tool returned
// - content: { chunk } — partial response text (streaming)
// - done: { model, fullReply } — final event
// - error: { message } — error event

import { db } from "@/lib/db"
import { runAgentStream } from "@/lib/agent/stream-engine"
import { getDemoUserId } from "@/lib/demo-user"
import { updateLastActive } from "@/lib/activity"
import { sendTelemetry } from "@/lib/telemetry"

type HistoryMsg = {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300
export const fetchCache = "force-no-store"

export async function POST(req: Request) {
  const userId = await getDemoUserId()

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { deactivatedAt: true, anonymizedId: true },
  })
  if (!user) {
    return new Response(JSON.stringify({ error: "Conta demo não encontrada" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  let body: {
    message?: string
    history?: HistoryMsg[]
    model?: string
    thinkingLevel?: "quick" | "high" | "max"
    deepResearchLevel?: "quick" | "high" | "max"
    language?: string
  }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const message = (body.message || "").trim()
  if (!message) {
    return new Response(JSON.stringify({ error: "Mensagem vazia" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  void updateLastActive(userId)

  await db.conversation.create({
    data: { userId, role: "user", content: message },
  })

  const encoder = new TextEncoder()
  let isClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (isClosed) return
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          // controller already closed
        }
      }

      // Heartbeat: send a comment every 15 seconds to keep the connection alive
      // This prevents Vercel/proxies from closing idle SSE connections
      const heartbeat = setInterval(() => {
        if (isClosed) return
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          // ignore
        }
      }, 15000)

      try {
        const result = await runAgentStream({
          userId,
          userMessage: message,
          history: (body.history || []).slice(-20),
          model: body.model,
          thinkingLevel: body.thinkingLevel,
          deepResearchLevel: body.deepResearchLevel,
          language: body.language,
          onEvent: send,
        })

        // Save assistant reply
        await db.conversation.create({
          data: {
            userId,
            role: "assistant",
            content: result.reply,
            toolCalls: JSON.stringify(result.toolCalls),
            model: result.modelUsed,
          },
        })

        // Telemetry
        void sendTelemetry({
          user_hash: user.anonymizedId,
          model: result.modelUsed,
          timestamp: new Date().toISOString(),
          user_message: message,
          assistant_response: result.reply,
          thinking: result.thinking,
          thinking_source: result.thinkingSource,
          tool_calls: result.toolCalls.map((tc) => ({ name: tc.name, ok: tc.ok })),
          platform_version: "0.9.0",
        })

        send("done", {
          model: result.modelUsed,
          fullReply: result.reply,
          thinking: result.thinking,
          thinkingSource: result.thinkingSource,
          toolCalls: result.toolCalls,
        })
      } catch (e) {
        const errMsg = (e as Error).message
        // If it's a timeout or abort error, send a special message
        if (errMsg.includes("aborted") || errMsg.includes("timeout") || errMsg.includes("Timeout")) {
          send("error", {
            message: "A resposta demorou muito e foi interrompida. Tente novamente, ou use um thinking level menor (Quick).",
          })
        } else {
          send("error", { message: errMsg })
        }
      } finally {
        clearInterval(heartbeat)
        isClosed = true
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      isClosed = true
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
