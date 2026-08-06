// Activity + auto-deletion helpers
// - updateLastActive(userId): called on every authenticated API call
// - runAutoDeletion(): called by cron, deactivates/deletes inactive users

import { db } from "@/lib/db"

const DEACTIVATE_AFTER_DAYS = 14
const DELETE_AFTER_DAYS = 30

export async function updateLastActive(userId: string): Promise<void> {
  try {
    await db.user.update({
      where: { id: userId },
      data: {
        lastActiveAt: new Date(),
        // If they were deactivated and came back, reactivate them.
        deactivatedAt: null,
      },
    })
  } catch (e) {
    console.warn("[activity] Failed to update lastActiveAt:", (e as Error).message)
  }
}

export async function runAutoDeletion(): Promise<{
  deactivated: number
  deleted: number
}> {
  const now = new Date()
  const deactivateThreshold = new Date(now.getTime() - DEACTIVATE_AFTER_DAYS * 24 * 60 * 60 * 1000)
  const deleteThreshold = new Date(now.getTime() - DELETE_AFTER_DAYS * 24 * 60 * 60 * 1000)

  // 1. Deactivate users inactive for > 30 days (but not yet deactivated)
  const toDeactivate = await db.user.findMany({
    where: {
      lastActiveAt: { lt: deactivateThreshold },
      deactivatedAt: null,
    },
    select: { id: true },
  })
  if (toDeactivate.length > 0) {
    await db.user.updateMany({
      where: { id: { in: toDeactivate.map((u) => u.id) } },
      data: { deactivatedAt: now },
    })
  }

  // 2. Delete users inactive for > 90 days (cascade deletes all their data)
  const toDelete = await db.user.findMany({
    where: {
      lastActiveAt: { lt: deleteThreshold },
    },
    select: { id: true },
  })
  if (toDelete.length > 0) {
    // Cascade relations will handle ApiKey, Integration, DailyLog, Conversation
    await db.user.deleteMany({
      where: { id: { in: toDelete.map((u) => u.id) } },
    })
  }

  return { deactivated: toDeactivate.length, deleted: toDelete.length }
}
