"use client"

import { useSession, signOut } from "next-auth/react"
import { useEffect, useState } from "react"
import { useAppStore } from "@/stores/app-store"
import { LandingView } from "@/components/agentforge/landing-view"
import { AuthView } from "@/components/agentforge/auth-view"
import { Dashboard } from "@/components/agentforge/dashboard"
import { ToSGate } from "@/components/agentforge/tos-gate"

export function AgentForge() {
  const { data: session, status } = useSession()
  const { view, setView } = useAppStore()
  const [needsToS, setNeedsToS] = useState(false)
  const [checkingToS, setCheckingToS] = useState(true)

  useEffect(() => {
    if (status === "loading") return
    if (session?.user) {
      setView("dashboard")
      // Check if user needs to accept ToS
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCheckingToS(true)
      fetch("/api/tos")
        .then((r) => r.json())
        .then((d) => {
          setNeedsToS(d.needsAcceptance === true)
        })
        .catch(() => setNeedsToS(false))
        .finally(() => setCheckingToS(false))
    } else if (view === "dashboard") {
      setView("landing")
    }
  }, [session, status, setView, view])

  if (status === "loading" || (session?.user && checkingToS)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-primary voice-pulse" />
          <span className="font-mono text-sm">Inicializando AgentForge…</span>
        </div>
      </div>
    )
  }

  if (view === "auth" && !session?.user) {
    return <AuthView />
  }

  if (view === "dashboard" && session?.user) {
    if (needsToS) {
      return <ToSGate onAccepted={() => setNeedsToS(false)} />
    }
    return <Dashboard />
  }

  return <LandingView />
}
