// Vercel Cron route — runs daily at midnight
// 1. Closes today's daily memory log
// 2. Deactivates users inactive for > 30 days
// 3. Deletes users inactive for > 90 days (cascade)
//
// Configure in vercel.json:
//   "crons": [{ "path": "/api/cron/daily", "schedule": "0 0 * * *" }]

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { runAutoDeletion } from "@/lib/activity"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")
  const expected = process.env.CRON_SECRET
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 1. Close today's log for every user
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date())
  const closedLogs = await db.dailyLog.updateMany({
    where: { date: todayStr, isClosed: false },
    data: { isClosed: true },
  })

  // 2 + 3. Auto-deletion
  const deletion = await runAutoDeletion()

  return NextResponse.json({
    ok: true,
    date: todayStr,
    closedLogs: closedLogs.count,
    deactivatedUsers: deletion.deactivated,
    deletedUsers: deletion.deleted,
  })
}

export async function GET() {
  return POST(new Request("http://localhost", { method: "POST" }))
}
