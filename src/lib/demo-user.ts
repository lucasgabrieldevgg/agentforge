// Demo user helper — for the GitHub demo version of AgentForge.
// Since there's no auth, we use a single shared "demo" user.
// The demo user is auto-created on first API call.

import { db } from "@/lib/db"

const DEMO_USER_EMAIL = "demo@agentforge.local"
const DEMO_USER_NAME = "Demo User"

let cachedDemoUserId: string | null = null

export async function getDemoUserId(): Promise<string> {
  if (cachedDemoUserId) return cachedDemoUserId

  // Try to find existing demo user
  let user = await db.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
  })

  if (!user) {
    // Create demo user with all built-in tools enabled
    user = await db.user.create({
      data: {
        email: DEMO_USER_EMAIL,
        name: DEMO_USER_NAME,
        password: "demo-no-auth",
      },
    })
    // Enable all built-in tools by default
    await db.integration.createMany({
      data: [
        { userId: user.id, service: "time", enabled: true, config: "{}" },
        { userId: user.id, service: "wikipedia", enabled: true, config: "{}" },
        { userId: user.id, service: "calculator", enabled: true, config: "{}" },
        { userId: user.id, service: "open-meteo", enabled: true, config: "{}" },
        { userId: user.id, service: "frankfurter", enabled: true, config: "{}" },
        { userId: user.id, service: "rest-countries", enabled: true, config: "{}" },
        { userId: user.id, service: "unit-converter", enabled: true, config: "{}" },
        { userId: user.id, service: "password-gen", enabled: true, config: "{}" },
      ],
    })
  }

  cachedDemoUserId = user.id
  return user.id
}
