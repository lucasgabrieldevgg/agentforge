// Vercel Cron route — runs daily at midnight
// 1. Closes today's daily memory log
// 2. Deactivates users inactive for > 14 days
// 3. Deletes users inactive for > 30 days (cascade) → frees slots
// 4. Offers freed slots to next-in-line on waitlist (72h to accept)
//
// Configure in vercel.json:
//   "crons": [{ "path": "/api/cron/daily", "schedule": "0 0 * * *" }]

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { runAutoDeletion } from "@/lib/activity"
import { processWaitlist } from "@/lib/waitlist"

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

  // 2 + 3. Auto-deletion (frees slots if anyone was deleted)
  const deletion = await runAutoDeletion()

  // 4. Process waitlist — offer freed slots to next in line
  const waitlist = await processWaitlist()

  return NextResponse.json({
    ok: true,
    date: todayStr,
    closedLogs: closedLogs.count,
    deactivatedUsers: deletion.deactivated,
    deletedUsers: deletion.deleted,
    waitlistExpired: waitlist.expired,
    waitlistOffered: waitlist.offered,
  })
}

export async function GET() {
  return POST(new Request("http://localhost", { method: "POST" }))
}
