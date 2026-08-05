"use client"

import { useSession, signOut } from "next-auth/react"
import { useAppStore, type DashboardTab } from "@/stores/app-store"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Bot,
  MessageSquare,
  Plug,
  KeyRound,
  Brain,
  Settings,
  LogOut,
  Github,
  Clock,
} from "lucide-react"
import { useEffect, useState } from "react"
import { ChatTab } from "@/components/agentforge/tabs/chat-tab"
import { IntegrationsTab } from "@/components/agentforge/tabs/integrations-tab"
import { KeysTab } from "@/components/agentforge/tabs/keys-tab"
import { MemoryTab } from "@/components/agentforge/tabs/memory-tab"
import { SettingsTab } from "@/components/agentforge/tabs/settings-tab"

const TABS: { id: DashboardTab; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Agente", icon: MessageSquare },
  { id: "integrations", label: "Integrações", icon: Plug },
  { id: "keys", label: "API Keys", icon: KeyRound },
  { id: "memory", label: "Memória", icon: Brain },
  { id: "settings", label: "Settings", icon: Settings },
]

export function Dashboard() {
  const { data: session } = useSession()
  const { activeTab, setActiveTab } = useAppStore()
  const [now, setNow] = useState<string>("")
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const tick = () => {
      setNow(
        new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Cuiaba",
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date())
      )
    }
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [])

  const user = session?.user
  const initials = (user?.name || user?.email || "?").slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-40">
        <div className="h-14 px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden p-2 -ml-2 rounded-md hover:bg-secondary"
              aria-label="Toggle menu"
            >
              <Bot className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-mono font-bold text-sm leading-none">AgentForge</h1>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {TABS.find((t) => t.id === activeTab)?.label}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-md border border-border/60 bg-card/40 font-mono text-xs text-muted-foreground">
              <Clock className="w-3 h-3 text-primary" />
              {now}
            </div>
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary font-mono text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-xs font-medium leading-none">{user?.name || "Você"}</p>
                <p className="text-[10px] text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-muted-foreground hover:text-destructive"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex flex-col w-60 border-r border-border/50 bg-sidebar/30">
          <nav className="flex-1 p-3 space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="p-3 border-t border-border/40 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="w-full justify-start font-mono text-xs"
            >
              <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                <Github className="w-3.5 h-3.5 mr-2" />
                Ver código
              </a>
            </Button>
          </div>
        </aside>

        {/* Sidebar — mobile drawer */}
        {mobileOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          >
            <aside
              className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-border/50 p-3"
              onClick={(e) => e.stopPropagation()}
            >
              <nav className="space-y-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id)
                      setMobileOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${
                      activeTab === tab.id
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-hidden">
          {activeTab === "chat" && <ChatTab />}
          {activeTab === "integrations" && <IntegrationsTab />}
          {activeTab === "keys" && <KeysTab />}
          {activeTab === "memory" && <MemoryTab />}
          {activeTab === "settings" && <SettingsTab />}
        </main>
      </div>
    </div>
  )
}
