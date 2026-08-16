"use client"

import { useAppStore, type DashboardTab } from "@/stores/app-store"
import { useProjectStore } from "@/stores/project-store"
import { Button } from "@/components/ui/button"
import {
  Bot,
  MessageSquare,
  Plug,
  KeyRound,
  Brain,
  Sparkles,
  ArrowLeft,
  Github,
  Clock,
  FolderOpen,
  Download,
  Code2,
  Gauge,
} from "lucide-react"
import { useEffect, useState } from "react"
import { ChatTab } from "@/components/agentforge/tabs/chat-tab"
import { ProjectsTab } from "@/components/agentforge/tabs/projects-tab"
import { WorkspaceTab } from "@/components/agentforge/tabs/workspace-tab"
import { SkillsTab } from "@/components/agentforge/tabs/skills-tab"
import { IntegrationsTab } from "@/components/agentforge/tabs/integrations-tab"
import { KeysTab } from "@/components/agentforge/tabs/keys-tab"
import { MemoryTab } from "@/components/agentforge/tabs/memory-tab"
import { BenchmarkTab } from "@/components/agentforge/tabs/benchmark-tab"
import { useToast } from "@/hooks/use-toast"

const TABS: { id: DashboardTab; label: string; icon: typeof MessageSquare }[] = [
  { id: "projects", label: "Projetos", icon: FolderOpen },
  { id: "chat", label: "Agente", icon: MessageSquare },
  { id: "workspace", label: "Workspace", icon: Code2 },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "integrations", label: "Ferramentas", icon: Plug },
  { id: "keys", label: "API Keys", icon: KeyRound },
  { id: "benchmark", label: "Benchmark", icon: Gauge },
  { id: "memory", label: "Memória", icon: Brain },
]

export function Dashboard({ onExit }: { onExit: () => void }) {
  const { activeTab, setActiveTab } = useAppStore()
  const { projects, activeProjectId, exportProject } = useProjectStore()
  const { toast } = useToast()
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

  const activeProject = projects.find((p) => p.id === activeProjectId)

  const handleDownloadAll = () => {
    if (projects.length === 0) {
      toast({ title: "Nenhum projeto para baixar", variant: "destructive" })
      return
    }
    const json = JSON.stringify(
      { type: "agentforge-projects-export", version: 1, exportedAt: new Date().toISOString(), projects },
      null,
      2
    )
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `agentforge-all-projects-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "Projetos baixados", description: `${projects.length} projetos` })
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-40">
        <div className="h-14 px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden p-2 -ml-2 rounded-md hover:bg-secondary shrink-0"
              aria-label="Toggle menu"
            >
              <Bot className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="hidden sm:block min-w-0">
                <h1 className="font-mono font-bold text-sm leading-none">AgentForge</h1>
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  {TABS.find((t) => t.id === activeTab)?.label}
                  {activeProject && activeTab === "chat" && ` · ${activeProject.name}`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-md border border-border/60 bg-card/40 font-mono text-xs text-muted-foreground">
              <Clock className="w-3 h-3 text-primary" />
              {now}
            </div>
            {/* Download button — always visible */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              className="font-mono text-xs shrink-0"
              title="Baixar todos os projetos (JSON)"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">Baixar</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="font-mono text-xs shrink-0"
            >
              <a
                href="https://github.com/lucasgabrieldevgg/agentforge"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="w-3.5 h-3.5" />
                <span className="hidden sm:inline ml-1">GitHub</span>
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExit}
              className="font-mono text-xs shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">Sair</span>
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
            <div className="px-3 py-2 rounded-md bg-secondary/40 text-[10px] text-muted-foreground font-mono">
              <p className="font-semibold text-foreground mb-1">Demo Mode</p>
              <p>Sem contas. Dados salvos no navegador. Baixe antes de limpar.</p>
            </div>
            <div className="px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400/80 font-mono">
              <p className="font-semibold mb-0.5">⚠️ Demo gratuita</p>
              <p>60s por resposta (Vercel Hobby) — o agente se adapta ao tempo disponível. Clone o repo pra rodar sem limite.</p>
            </div>
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
          {activeTab === "projects" && <ProjectsTab />}
          {activeTab === "chat" && <ChatTab />}
          {activeTab === "workspace" && <WorkspaceTab />}
          {activeTab === "skills" && <SkillsTab />}
          {activeTab === "integrations" && <IntegrationsTab />}
          {activeTab === "keys" && <KeysTab />}
          {activeTab === "benchmark" && <BenchmarkTab />}
          {activeTab === "memory" && <MemoryTab />}
        </main>
      </div>
    </div>
  )
}
