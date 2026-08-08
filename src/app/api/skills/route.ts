import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { SKILLS } from "@/lib/skills/registry"
import { getDemoUserId } from "@/lib/demo-user"
import { updateLastActive } from "@/lib/activity"

export async function GET() {
  const userId = await getDemoUserId()
  const userIntegrations = await db.integration.findMany({ where: { userId } })
  const skillIntegrations = userIntegrations.filter((i) => i.service.startsWith("skill:"))
  const enabledSet = new Set(
    skillIntegrations.filter((i) => i.enabled).map((i) => i.service.replace("skill:", ""))
  )

  const skills = SKILLS.map((s) => ({
    name: s.name,
    display_name: s.display_name,
    description: s.description,
    long_description: s.long_description,
    icon: s.icon,
    category: s.category,
    slash_command: s.slash_command,
    aliases: s.aliases || [],
    auto_trigger: s.auto_trigger,
    requires_consent: s.requires_consent,
    parameters: s.parameters,
    version: s.version,
    enabled: enabledSet.has(s.name),
  }))

  return NextResponse.json({ skills })
}

export async function POST(req: Request) {
  const userId = await getDemoUserId()
  const body = await req.json().catch(() => ({}))
  const { skillName, enabled } = body as { skillName: string; enabled: boolean }
  if (!skillName) {
    return NextResponse.json({ error: "skillName obrigatório" }, { status: 400 })
  }
  const service = `skill:${skillName}`
  const existing = await db.integration.findUnique({
    where: { userId_service: { userId, service } },
  })
  if (existing) {
    await db.integration.update({
      where: { id: existing.id },
      data: { enabled },
    })
  } else {
    await db.integration.create({
      data: { userId, service, enabled, config: "{}" },
    })
  }
  void updateLastActive(userId)
  return NextResponse.json({ ok: true })
}
