// Capacity limits + Waitlist logic
//
// Supabase Free Tier: 500MB database
// After reserving space for indices/logs/buffer (~100MB), we have ~400MB usable.
// Each active user takes ~442KB on average (mostly DailyLogs + Conversations).
// → Safe capacity: ~786 users
// → Waitlist kicks in at 85% of that = 668 users
//
// When a user is deleted (inactivity or self-delete), the cron automatically
// offers the freed slot to the next person on the waitlist via Telegram + email.

import { db } from "@/lib/db"
import { sendWaitlistOffer } from "@/lib/telemetry"

// Conservative limits based on Supabase free tier math
export const MAX_ACTIVE_USERS = 668 // waitlist activates above this
export const HARD_USER_LIMIT = 786 // absolute block on signups

// Waitlist offer expiration: 72 hours
export const WAITLIST_OFFER_TTL_HOURS = 72

export type CapacityStatus = {
  activeUsers: number
  waitingUsers: number
  maxActive: number
  hardLimit: number
  isFull: boolean
  isWaitlistMode: boolean
  slotsAvailable: number
}

export async function getCapacityStatus(): Promise<CapacityStatus> {
  const activeUsers = await db.user.count({
    where: { deactivatedAt: null },
  })
  const waitingUsers = await db.waitlistEntry.count({
    where: { status: "waiting" },
  })
  return {
    activeUsers,
    waitingUsers,
    maxActive: MAX_ACTIVE_USERS,
    hardLimit: HARD_USER_LIMIT,
    isFull: activeUsers >= HARD_USER_LIMIT,
    isWaitlistMode: activeUsers >= MAX_ACTIVE_USERS,
    slotsAvailable: Math.max(0, MAX_ACTIVE_USERS - activeUsers),
  }
}

export async function canSignupDirectly(): Promise<{ allowed: boolean; reason?: string }> {
  const status = await getCapacityStatus()
  if (status.isFull) {
    return {
      allowed: false,
      reason: "Capacidade máxima atingida. Você pode entrar na lista de espera.",
    }
  }
  if (status.isWaitlistMode) {
    return {
      allowed: false,
      reason: "Estamos em modo lista de espera devido à alta demanda. Entre na fila — avisaremos quando houver vaga.",
    }
  }
  return { allowed: true }
}

export async function addToWaitlist(email: string, name?: string): Promise<{
  entry: { id: string; position: number; status: string }
  alreadyExists?: boolean
}> {
  const normalizedEmail = email.toLowerCase().trim()
  const existing = await db.waitlistEntry.findUnique({
    where: { email: normalizedEmail },
  })
  if (existing) {
    return {
      entry: {
        id: existing.id,
        position: existing.position,
        status: existing.status,
      },
      alreadyExists: true,
    }
  }

  // Compute next position: max position among active waiters + 1
  const maxPos = await db.waitlistEntry.aggregate({
    where: { status: "waiting" },
    _max: { position: true },
  })
  const position = (maxPos._max.position || 0) + 1

  const entry = await db.waitlistEntry.create({
    data: { email: normalizedEmail, name, position },
  })

  return {
    entry: {
      id: entry.id,
      position: entry.position,
      status: entry.status,
    },
  }
}

export async function getWaitlistPosition(email: string): Promise<{
  found: boolean
  position?: number
  status?: string
  totalWaiting?: number
  estimatedWaitDays?: number
}> {
  const entry = await db.waitlistEntry.findUnique({
    where: { email: email.toLowerCase().trim() },
  })
  if (!entry) return { found: false }

  const totalWaiting = await db.waitlistEntry.count({
    where: { status: "waiting" },
  })

  // Rough estimate: assume 5% churn per month → ~33 users freed per month
  // → if you're at position N, ETA = N / 33 * 30 days
  const monthlyChurnRate = 0.05
  const monthlySlotsFreed = Math.ceil(MAX_ACTIVE_USERS * monthlyChurnRate)
  const estimatedWaitDays = Math.ceil(entry.position / monthlySlotsFreed * 30)

  return {
    found: true,
    position: entry.position,
    status: entry.status,
    totalWaiting,
    estimatedWaitDays,
  }
}

/**
 * Process the waitlist: find expired offers (offered but not accepted within TTL)
 * and offer freed slots to next-in-line.
 * Called by the daily cron.
 */
export async function processWaitlist(): Promise<{
  expired: number
  offered: number
}> {
  const now = new Date()

  // 1. Mark expired offers as expired
  const expired = await db.waitlistEntry.updateMany({
    where: {
      status: "offered",
      offerExpiresAt: { lt: now },
    },
    data: { status: "expired" },
  })

  // 2. Compute how many slots are available right now
  const status = await getCapacityStatus()
  const slotsAvailable = status.slotsAvailable

  // 3. Offer to next-in-line (oldest waiting, ordered by position)
  if (slotsAvailable > 0) {
    const nextInLine = await db.waitlistEntry.findMany({
      where: { status: "waiting" },
      orderBy: { position: "asc" },
      take: slotsAvailable,
    })

    const offerExpiresAt = new Date(
      now.getTime() + WAITLIST_OFFER_TTL_HOURS * 60 * 60 * 1000
    )

    for (const entry of nextInLine) {
      await db.waitlistEntry.update({
        where: { id: entry.id },
        data: {
          status: "offered",
          notifiedAt: now,
          offerExpiresAt,
        },
      })
      // Fire-and-forget notification (Telegram)
      void sendWaitlistOffer(entry.email, entry.position, offerExpiresAt)
    }

    return { expired: expired.count, offered: nextInLine.length }
  }

  return { expired: expired.count, offered: 0 }
}

/**
 * When a user signs up with an email that has an "offered" waitlist entry,
 * mark that entry as accepted. Returns true if found.
 */
export async function acceptWaitlistOffer(email: string): Promise<boolean> {
  const entry = await db.waitlistEntry.findUnique({
    where: { email: email.toLowerCase().trim() },
  })
  if (!entry || entry.status !== "offered") return false
  await db.waitlistEntry.update({
    where: { id: entry.id },
    data: { status: "accepted" },
  })
  return true
}
