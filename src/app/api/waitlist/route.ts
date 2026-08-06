import { NextResponse } from "next/server"
import { addToWaitlist, getWaitlistPosition } from "@/lib/waitlist"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { email, name } = body as { email?: string; name?: string }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 })
  }
  try {
    const result = await addToWaitlist(email, name)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email")
  if (!email) {
    return NextResponse.json({ error: "email obrigatório" }, { status: 400 })
  }
  const result = await getWaitlistPosition(email)
  return NextResponse.json(result)
}
