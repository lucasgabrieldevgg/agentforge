"use client"

import { useSession, signOut } from "next-auth/react"
import { useEffect } from "react"
import { useAppStore } from "@/stores/app-store"
import { LandingView } from "@/components/agentforge/landing-view"
import { AuthView } from "@/components/agentforge/auth-view"
import { Dashboard } from "@/components/agentforge/dashboard"
import { useToast } from "@/hooks/use-toast"

export function AgentForge() {
  const { data: session, status } = useSession()
  const { view, setView } = useAppStore()
  const { toast } = useToast()

  useEffect(() => {
    if (status === "loading") return
    if (session?.user) {
      setView("dashboard")
    } else if (view === "dashboard") {
      setView("landing")
    }
  }, [session, status, setView, view])

  // show nothing while session is loading to avoid flicker
  if (status === "loading") {
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
    return <Dashboard />
  }

  return <LandingView />
}
