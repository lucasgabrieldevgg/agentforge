import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCapacityStatus, canSignupDirectly } from "@/lib/waitlist"

export async function GET() {
  const status = await getCapacityStatus()
  const signup = await canSignupDirectly()
  return NextResponse.json({
    ...status,
    canSignup: signup.allowed,
    reason: signup.reason,
  })
}
