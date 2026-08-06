import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { db } from "@/lib/db"
import { TOS_VERSION, TOS_DATE, TOS_TITLE, TOS_TEXT } from "@/lib/tos"
import { updateLastActive } from "@/lib/activity"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { tosAcceptedAt: true, tosVersion: true },
  })
  return NextResponse.json({
    version: TOS_VERSION,
    date: TOS_DATE,
    title: TOS_TITLE,
    text: TOS_TEXT,
    acceptedAt: user?.tosAcceptedAt,
    acceptedVersion: user?.tosVersion,
    needsAcceptance: !user?.tosVersion || user.tosVersion !== TOS_VERSION,
  })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const { accept } = body as { accept?: boolean }
  if (!accept) {
    return NextResponse.json({ error: "Você precisa aceitar os termos" }, { status: 400 })
  }
  await db.user.update({
    where: { id: session.user.id },
    data: {
      tosAcceptedAt: new Date(),
      tosVersion: TOS_VERSION,
      // Telemetry is mandatory, always on
      telemetryOptIn: true,
    },
  })
  await updateLastActive(session.user.id)
  return NextResponse.json({ ok: true, version: TOS_VERSION })
}
