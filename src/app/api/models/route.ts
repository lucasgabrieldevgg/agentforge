import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getDemoUserId } from "@/lib/demo-user"

export async function GET() {
  const userId = await getDemoUserId()
  const apiKeyRow = await db.apiKey.findUnique({
    where: { userId_service: { userId, service: "openrouter" } },
  })

  if (!apiKeyRow?.keyValue) {
    return NextResponse.json({ error: "OpenRouter key não configurada", models: [] })
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKeyRow.keyValue}` },
    })
    if (!res.ok) {
      return NextResponse.json({ error: `OpenRouter ${res.status}`, models: [] })
    }
    const data = await res.json()
    const models = (data.data || []).map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      contextLength: m.context_length || 0,
      description: (m.description || "").slice(0, 120),
      isFree: m.pricing?.prompt === "0" && m.pricing?.completion === "0",
    }))
    models.sort((a: any, b: any) => {
      if (a.isFree !== b.isFree) return a.isFree ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return NextResponse.json({ models })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, models: [] })
  }
}
