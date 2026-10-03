"use client"

import { useState } from "react"
import { LandingView } from "@/components/agentforge/landing-view"
import { Dashboard } from "@/components/agentforge/dashboard"

export function AgentForge() {
  // Demo mode — no auth. Either show landing or dashboard.
  const [view, setView] = useState<"landing" | "dashboard">("landing")

  if (view === "dashboard") {
    return <Dashboard onExit={() => setView("landing")} />
  }

  return <LandingView onEnter={() => setView("dashboard")} />
}
