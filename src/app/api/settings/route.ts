import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { db } from "@/lib/db"
import { updateLastActive } from "@/lib/activity"

const VALID_LEVELS = ["quick", "deep", "max"] as const
type DeepResearchLevel = (typeof VALID_LEVELS)[number]

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { deepResearchLevel: true },
  })
  return NextResponse.json({
    deepResearchLevel: user?.deepResearchLevel || "deep",
    levels: [
      {
        id: "quick",
        name: "Quick",
        description: "1 idioma (pt), sem artigos relacionados. ~1s.",
        icon: "Zap",
      },
      {
        id: "deep",
        name: "Deep",
        description: "3 idiomas em paralelo (pt, en, es) + 3 relacionados. ~3s. (padrão)",
        icon: "Layers",
      },
      {
        id: "max",
        name: "Max",
        description: "5 idiomas em paralelo + 5 relacionados. ~5s. Mais completo.",
        icon: "Crown",
      },
    ],
  })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const { deepResearchLevel } = body as { deepResearchLevel?: string }
  if (!deepResearchLevel || !VALID_LEVELS.includes(deepResearchLevel as DeepResearchLevel)) {
    return NextResponse.json(
      { error: "deepResearchLevel inválido. Use: quick, deep ou max." },
      { status: 400 }
    )
  }
  await db.user.update({
    where: { id: session.user.id },
    data: { deepResearchLevel: deepResearchLevel as DeepResearchLevel },
  })
  void updateLastActive(session.user.id)
  return NextResponse.json({ ok: true, deepResearchLevel })
}
