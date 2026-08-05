// Vercel Cron route — closes the daily memory log at midnight
// Configure in vercel.json:
//   "crons": [{ "path": "/api/cron/daily", "schedule": "0 0 * * *" }]
//
// For dev / testing, also callable manually.

import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  // Optional shared secret to prevent external abuse
  const authHeader = req.headers.get("authorization")
  const expected = process.env.CRON_SECRET
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Close today's log for every user (server timezone = UTC; close by YYYY-MM-DD)
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date())
  await db.dailyLog.updateMany({
    where: { date: todayStr, isClosed: false },
    data: { isClosed: true },
  })
  return NextResponse.json({ ok: true, closedDate: todayStr })
}

export async function GET() {
  return POST(new Request("http://localhost", { method: "POST" }))
}
