// Benchmark endpoint — runs ONE task per request (the UI iterates) so each
// call fits comfortably inside serverless limits even on slow free models.

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { runAgentStream } from "@/lib/agent/stream-engine"
import { getDemoUserId } from "@/lib/demo-user"
import { BENCHMARK_TASKS } from "@/lib/benchmark/tasks"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
export const fetchCache = "force-no-store"

export async function POST(req: Request) {
  const userId = await getDemoUserId()

  const body = await req.json().catch(() => ({}))
  const taskIndex = Number(body.taskIndex)
  const model = typeof body.model === "string" && body.model ? body.model : undefined

  if (!Number.isInteger(taskIndex) || taskIndex < 0 || taskIndex >= BENCHMARK_TASKS.length) {
    return NextResponse.json({ error: "taskIndex inválido" }, { status: 400 })
  }

  const task = BENCHMARK_TASKS[taskIndex]
  const startedAt = Date.now()

  try {
    const result = await runAgentStream({
      userId,
      userMessage: task.prompt,
      history: [],
      model,
      thinkingLevel: "quick",
      onEvent: () => {},
    })
    const latencyMs = Date.now() - startedAt

    const toolsCalled = result.toolCalls.map((tc) => tc.name)
    const toolOk = task.expectNoTool
      ? toolsCalled.length === 0
      : task.expectTool
        ? toolsCalled.some((n) => n === task.expectTool || n.startsWith(task.expectTool!))
        : true
    const replyLower = result.reply.toLowerCase()
    const answerOk = task.expectContains
      ? replyLower.includes(task.expectContains.toLowerCase())
      : true
    const pass = toolOk && answerOk

    return NextResponse.json({
      taskId: task.id,
      label: task.label,
      category: task.category,
      pass,
      toolOk,
      answerOk,
      toolsCalled,
      latencyMs,
      modelUsed: result.modelUsed,
      replyPreview: result.reply.slice(0, 220),
    })
  } catch (e) {
    return NextResponse.json({
      taskId: task.id,
      label: task.label,
      category: task.category,
      pass: false,
      toolOk: false,
      answerOk: false,
      toolsCalled: [],
      latencyMs: Date.now() - startedAt,
      modelUsed: model || "",
      replyPreview: `Erro: ${(e as Error).message}`.slice(0, 220),
    })
  }
}

export async function GET() {
  await getDemoUserId() // ensures demo user exists
  return NextResponse.json({
    total: BENCHMARK_TASKS.length,
    tasks: BENCHMARK_TASKS.map((t, i) => ({
      index: i,
      id: t.id,
      label: t.label,
      category: t.category,
    })),
  })
}
