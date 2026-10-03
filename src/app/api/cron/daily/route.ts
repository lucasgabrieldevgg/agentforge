// Vercel Cron route — runs daily at midnight
// In demo mode (no accounts), this just closes daily logs if any exist.
//
// Configure in vercel.json:
//   "crons": [{ "path": "/api/cron/daily", "schedule": "0 0 * * *" }]

import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")
  const expected = process.env.CRON_SECRET
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date())
  const closedLogs = await db.dailyLog.updateMany({
    where: { date: todayStr, isClosed: false },
    data: { isClosed: true },
  })

  return NextResponse.json({
    ok: true,
    date: todayStr,
    closedLogs: closedLogs.count,
  })
}

export async function GET() {
  return POST(new Request("http://localhost", { method: "POST" }))
}
