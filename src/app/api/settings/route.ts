import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { RECOMMENDED_MODELS, DEFAULT_MODEL } from "@/lib/models"
import { getDemoUserId } from "@/lib/demo-user"
import { updateLastActive } from "@/lib/activity"

const VALID_LEVELS = ["quick", "high", "max"] as const
type DeepResearchLevel = (typeof VALID_LEVELS)[number]

export async function GET() {
  const userId = await getDemoUserId()
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { deepResearchLevel: true, preferredModel: true },
  })
  return NextResponse.json({
    deepResearchLevel: user?.deepResearchLevel || "high",
    preferredModel: user?.preferredModel || DEFAULT_MODEL,
    demoMode: process.env.DEMO_MODE !== "false",
    models: RECOMMENDED_MODELS,
    levels: [
      { id: "quick", name: "Quick", description: "1 idioma (pt), sem artigos relacionados. ~1s.", icon: "Zap" },
      { id: "high", name: "High", description: "3 idiomas em paralelo (pt, en, es) + 3 relacionados. ~3s. (padrão)", icon: "Layers" },
      { id: "max", name: "Max", description: "5 idiomas em paralelo + 5 relacionados. ~5s. Mais completo.", icon: "Crown" },
    ],
  })
}

export async function POST(req: Request) {
  const userId = await getDemoUserId()
  const body = await req.json().catch(() => ({}))
  const { deepResearchLevel, preferredModel } = body as {
    deepResearchLevel?: string
    preferredModel?: string
  }

  const data: { deepResearchLevel?: DeepResearchLevel; preferredModel?: string } = {}

  if (deepResearchLevel !== undefined) {
    if (!VALID_LEVELS.includes(deepResearchLevel as DeepResearchLevel)) {
      return NextResponse.json(
        { error: "deepResearchLevel inválido. Use: quick, high ou max." },
        { status: 400 }
      )
    }
    data.deepResearchLevel = deepResearchLevel as DeepResearchLevel
  }

  if (preferredModel !== undefined) {
    if (typeof preferredModel !== "string" || preferredModel.length > 200) {
      return NextResponse.json({ error: "preferredModel inválido." }, { status: 400 })
    }
    data.preferredModel = preferredModel
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 })
  }

  await db.user.update({
    where: { id: userId },
    data,
  })
  void updateLastActive(userId)
  return NextResponse.json({ ok: true, ...data })
}
