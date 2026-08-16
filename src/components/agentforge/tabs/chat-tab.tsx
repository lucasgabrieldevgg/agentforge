"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useProjectStore } from "@/stores/project-store"
import { useAppStore } from "@/stores/app-store"
import { ArtifactCard, extractArtifacts, stripCodeBlocks } from "@/components/agentforge/artifact-card"
import { ProjectPreview } from "@/components/agentforge/project-preview"
import { SkillsMenu } from "@/components/agentforge/skills-menu"
import {
  Send,
  Trash2,
  Wrench,
  Loader2,
  Sparkles,
  Brain,
  ChevronDown,
  ChevronRight,
  Telescope,
  Zap,
  Layers,
  Crown,
  Search,
  FolderOpen,
  Copy,
  Check,
  Pencil,
  Globe,
  Languages,
  FileCode,
  Cpu,
} from "lucide-react"

type ToolCall = {
  name: string
  args: Record<string, unknown>
  result?: unknown
  ok?: boolean
  status?: "running" | "done"
}

type Msg = {
  id: string
  role: "user" | "assistant"
  content: string
  thinking?: string
  thinkingSource?: "native" | "synthetic" | "none"
  model?: string
  streaming?: boolean
  toolCalls?: ToolCall[]
  ts: number
}

const SUGGESTIONS = [
  "Que horas são?",
  "Quanto é 15% de 230?",
  "Quem foi Alan Turing?",
  "Traduza 'bom dia' para 5 idiomas",
]

export function ChatTab() {
  const {
    projects,
    activeProjectId,
    addMessage,
    updateMessage,
    clearMessages,
    updateSettings,
    createProject,
  } = useProjectStore()
  const { setActiveTab } = useAppStore()
  const { toast } = useToast()

  const activeProject = projects.find((p) => p.id === activeProjectId)
  const messages: Msg[] = (activeProject?.messages || []).map((m) => ({
    ...m,
    toolCalls: m.toolCalls?.map((tc) => ({ ...tc, status: "done" as const })),
  }))

  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [models, setModels] = useState<Array<{
    id: string
    name: string
    description: string
    contextLength: number
    hasNativeThinking: boolean
    recommended?: boolean
  }>>([])
  const [hydrated, setHydrated] = useState(false)
  const [showProjectPreview, setShowProjectPreview] = useState(false)
  const [previewArtifacts, setPreviewArtifacts] = useState<Array<{
    id: string
    filename: string
    language: string
    content: string
    createdAt: number
  }>>([])
  const [skills, setSkills] = useState<Array<{
    name: string
    display_name: string
    description: string
    slash_command: string
    aliases: string[]
    auto_trigger: boolean
    enabled: boolean
  }>>([])
  const [apiModels, setApiModels] = useState<Array<{
    id: string
    name: string
    contextLength: number
    description: string
    isFree: boolean
  }>>([])
  const [modelSearch, setModelSearch] = useState("")
  const [showModelPicker, setShowModelPicker] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load settings from active project (or defaults)
  const thinkingLevel = activeProject?.settings.thinkingLevel ?? "quick"
  const deepResearchLevel = activeProject?.settings.deepResearchLevel ?? "high"
  const preferredModel = activeProject?.settings.model ?? "openai/gpt-oss-20b:free"
  const language = activeProject?.settings.language ?? "auto"

  useEffect(() => {
    setHydrated(true)
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.models) setModels(d.models)
      })
      .catch(() => {})
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => {
        if (d.skills) setSkills(d.skills)
      })
      .catch(() => {})
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        if (d.models) setApiModels(d.models)
      })
      .catch(() => {})

    // Listen for "open project preview" event
    const openPreview = () => {
      setPreviewArtifacts([])
      setShowProjectPreview(true)
    }
    window.addEventListener("agentforge:open-project-preview", openPreview)

    // Listen for "open preview with specific artifact"
    const openPreviewWithArtifact = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.artifact) {
        setPreviewArtifacts([detail.artifact])
        setShowProjectPreview(true)
      }
    }
    window.addEventListener("agentforge:open-preview-with-artifact", openPreviewWithArtifact)

    // Close model picker when clicking outside
    const closeModelPicker = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest("[data-model-picker]")) {
        setShowModelPicker(false)
      }
    }
    document.addEventListener("click", closeModelPicker)

    return () => {
      window.removeEventListener("agentforge:open-project-preview", openPreview)
      window.removeEventListener("agentforge:open-preview-with-artifact", openPreviewWithArtifact)
      document.removeEventListener("click", closeModelPicker)
    }
  }, [])

  // Track if we should auto-scroll: true on new message, false when user scrolls up
  const shouldAutoScrollRef = useRef(true)
  const prevMsgCountRef = useRef(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Only auto-scroll if: user hasn't scrolled up, OR a new message was added (count increased)
    const msgCount = messages.length
    const isNewMessage = msgCount > prevMsgCountRef.current
    prevMsgCountRef.current = msgCount
    if (shouldAutoScrollRef.current || isNewMessage) {
      el.scrollTop = el.scrollHeight
      shouldAutoScrollRef.current = true
    }
  }, [messages])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    // If user scrolled up (more than 100px from bottom), stop auto-scrolling
    if (distanceFromBottom > 100) {
      shouldAutoScrollRef.current = false
    } else {
      shouldAutoScrollRef.current = true
    }
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return

      // If no active project, create one automatically
      let projectId = activeProjectId
      if (!projectId) {
        projectId = createProject()
      }

      const userMsgId = crypto.randomUUID()
      const aiMsgId = crypto.randomUUID()
      const userMsg = {
        id: userMsgId,
        role: "user" as const,
        content: trimmed,
        ts: Date.now(),
      }
      const aiMsg = {
        id: aiMsgId,
        role: "assistant" as const,
        content: "",
        streaming: true,
        toolCalls: [],
        ts: Date.now(),
      }
      addMessage(projectId, userMsg)
      addMessage(projectId, aiMsg)
      setInput("")
      setLoading(true)

      try {
        const history = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        })) as any

        const res = await fetch("/api/agent/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history,
            thinkingLevel,
            deepResearchLevel,
            language,
            model: preferredModel,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Erro no agente" }))
          throw new Error(err.error || "Erro no agente")
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error("Sem stream")

        const decoder = new TextDecoder()
        let buffer = ""
        let fullReply = ""
        let thinking = ""
        let thinkingSource: "native" | "synthetic" | "none" = "none"
        let model = preferredModel
        let finalToolCalls: any[] = []
        const liveToolCalls: ToolCall[] = []

        const persistAiMsg = (updates: Partial<Msg>) => {
          updateMessage(projectId!, aiMsgId, updates)
        }

        const addToolCallLive = (tool: ToolCall) => {
          liveToolCalls.push(tool)
          persistAiMsg({ toolCalls: [...liveToolCalls] })
        }

        const updateToolCallLive = (name: string, updates: Partial<ToolCall>) => {
          const idx = liveToolCalls.findIndex(
            (t) => t.name === name && t.status === "running"
          )
          if (idx >= 0) {
            liveToolCalls[idx] = { ...liveToolCalls[idx], ...updates }
            persistAiMsg({ toolCalls: [...liveToolCalls] })
          }
        }

        let receivedDone = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          let currentEvent = ""
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim()
            } else if (line.startsWith("data: ")) {
              const dataStr = line.slice(6)
              try {
                const data = JSON.parse(dataStr)
                if (currentEvent === "content") {
                  fullReply += data.chunk
                  persistAiMsg({ content: fullReply })
                } else if (currentEvent === "thinking") {
                  thinking += data.content
                  persistAiMsg({ thinking, thinkingSource: data.source })
                } else if (currentEvent === "tool_start") {
                  addToolCallLive({ name: data.name, args: data.args, status: "running" })
                } else if (currentEvent === "tool_result") {
                  updateToolCallLive(data.name, {
                    result: data.result,
                    ok: data.ok,
                    status: "done",
                  })
                  finalToolCalls.push({
                    name: data.name,
                    args: data.args,
                    result: data.result,
                    ok: data.ok,
                  })
                } else if (currentEvent === "done") {
                  receivedDone = true
                  fullReply = data.fullReply || fullReply
                  thinking = data.thinking || thinking
                  thinkingSource = data.thinkingSource || "none"
                  model = data.model || model
                  finalToolCalls = data.toolCalls || finalToolCalls
                  persistAiMsg({
                    content: fullReply,
                    thinking,
                    thinkingSource,
                    model,
                    streaming: false,
                    toolCalls: finalToolCalls.map((tc) => ({ ...tc, status: "done" as const })),
                  })
                } else if (currentEvent === "error") {
                  throw new Error(data.message)
                }
              } catch (e) {
                // ignore parse errors
              }
            }
          }
        }

        // If stream ended without "done" event, the response was likely truncated
        // by a timeout. Mark as done with what we have + warning.
        if (!receivedDone && fullReply) {
          persistAiMsg({
            content: fullReply + "\n\n⚠️ **Aviso:** A resposta foi interrompida por timeout. O código pode estar incompleto. Tente novamente com thinking level Quick, ou peça algo mais simples.",
            streaming: false,
          })
        } else if (!receivedDone) {
          persistAiMsg({
            content: "⚠️ A resposta foi interrompida por timeout. Tente novamente com thinking level Quick, ou simplifique seu pedido.",
            streaming: false,
          })
        }

      } catch (e) {
        updateMessage(projectId, aiMsgId, {
          content: `Erro: ${(e as Error).message}`,
          streaming: false,
        })
        toast({
          title: "Erro",
          description: (e as Error).message,
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    },
    [loading, messages, toast, thinkingLevel, preferredModel, activeProjectId, addMessage, updateMessage, createProject]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const clearChat = () => {
    if (!activeProjectId) return
    clearMessages(activeProjectId)
    toast({ title: "Conversa limpa" })
  }

  const changeDeepResearchLevel = (level: "quick" | "high" | "max") => {
    if (activeProjectId) {
      updateSettings(activeProjectId, { deepResearchLevel: level })
    }
    const names = { quick: "Quick", high: "High", max: "Max" }
    toast({
      title: "Deep Research: " + names[level],
      description: {
        quick: "Rápido: 1 idioma, sem relacionados.",
        high: "Profundo: 3 idiomas + 3 relacionados.",
        max: "Máximo: 5 idiomas + 5 relacionados.",
      }[level],
    })
  }

  const changeModel = (modelId: string) => {
    if (activeProjectId) {
      updateSettings(activeProjectId, { model: modelId })
    }
    const model = models.find((m) => m.id === modelId)
    toast({
      title: "Modelo: " + (model?.name || modelId),
      description: model
        ? `${model.hasNativeThinking ? "🧠 Tem thinking nativo. " : ""}Contexto: ${Math.round(model.contextLength / 1000)}K tokens.`
        : "Modelo customizado.",
    })
  }

  const changeLanguage = (lang: string) => {
    if (activeProjectId) {
      updateSettings(activeProjectId, { language: lang })
    }
    const names: Record<string, string> = {
      auto: "Auto (segue seu idioma)",
      en: "English",
      pt: "Português (BR)",
      es: "Español",
      fr: "Français",
      de: "Deutsch",
      it: "Italiano",
      ja: "日本語",
      zh: "中文",
    }
    toast({
      title: "Idioma: " + names[lang],
      description: lang === "auto" ? "O agente responde no idioma em que você escrever." : "O agente vai responder sempre nesse idioma.",
    })
  }

  const changeThinkingLevel = (level: "quick" | "high" | "max") => {
    if (activeProjectId) {
      updateSettings(activeProjectId, { thinkingLevel: level })
    }
    const names = { quick: "Quick", high: "High", max: "Max" }
    toast({
      title: "Thinking: " + names[level],
      description: {
        quick: "Sem raciocínio explícito. Respostas diretas.",
        high: "Raciocínio nativo ou CoT sintético.",
        max: "Raciocínio profundo + CoT injetado mesmo em modelos nativos.",
      }[level],
    })
  }

  if (!hydrated) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    )
  }

  // If no project is active, prompt user to create one
  if (!activeProject) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto glow-primary">
            <FolderOpen className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Nenhum projeto ativo</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Crie um projeto pra começar a conversar. Cada projeto é um workspace
              independente com suas próprias mensagens e configurações.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              onClick={() => createProject()}
              className="font-mono glow-primary"
            >
              <FolderOpen className="w-4 h-4 mr-1" />
              Criar projeto
            </Button>
            <Button
              variant="outline"
              onClick={() => setActiveTab("projects")}
              className="font-mono"
            >
              Ver projetos
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="flex-1 overflow-y-auto" ref={scrollRef} onScroll={handleScroll}>
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto glow-primary">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Olá! Sou seu agente.</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Pode me fazer perguntas, pedir cálculos, buscar conhecimento, ou
                apenas conversar.
              </p>
            </div>
          )}

          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 justify-center pt-2 pb-4">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-1.5 rounded-md border border-border/60 hover:border-primary/40 text-sm font-mono transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              m={m}
              onEdit={(id, content) => {
                if (activeProjectId) {
                  updateMessage(activeProjectId, id, { content })
                }
              }}
              onResend={(id) => {
                if (!activeProjectId) return
                // Find the user message by id, delete all messages after it, then resend
                const project = useProjectStore.getState().projects.find((p) => p.id === activeProjectId)
                if (!project) return
                const idx = project.messages.findIndex((m) => m.id === id)
                if (idx < 0) return
                const userMsg = project.messages[idx]
                // Delete all messages after this user message (including the old AI reply)
                const newMessages = project.messages.slice(0, idx + 1)
                useProjectStore.setState((state) => ({
                  projects: state.projects.map((p) =>
                    p.id === activeProjectId ? { ...p, messages: newMessages, updatedAt: Date.now() } : p
                  ),
                }))
                // Resend
                sendMessage(userMsg.content)
              }}
            />
          ))}
        </div>
      </div>

      {/* Input area — ALWAYS visible, fixed at bottom */}
      <div className="border-t border-border/50 bg-background/95 backdrop-blur-sm shrink-0 relative">
        {/* Skills menu (appears above input when user types /) */}
        <SkillsMenu
          input={input}
          skills={skills}
          onPick={(cmd) => {
            setInput(`/${cmd} `)
          }}
        />
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-3 space-y-2">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte qualquer coisa… (ou use /skill nome)"
              className="min-h-[44px] max-h-32 resize-none font-mono text-sm"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage(input)
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading || !input.trim()}
              className="shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-border/40 bg-secondary/40">
                <Brain className="w-3 h-3 text-primary shrink-0" />
                <Select
                  value={thinkingLevel}
                  onValueChange={(v) => changeThinkingLevel(v as "quick" | "high" | "max")}
                >
                  <SelectTrigger className="h-6 w-[100px] text-xs font-mono border-0 bg-transparent p-0 focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quick" className="text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span>Think: Quick</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="high" className="text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <Layers className="w-3 h-3 text-primary" />
                        <span>Think: High</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="max" className="text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <Crown className="w-3 h-3 text-purple-400" />
                        <span>Think: Max</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-border/40 bg-secondary/40">
                <Telescope className="w-3 h-3 text-primary shrink-0" />
                <Select
                  value={deepResearchLevel}
                  onValueChange={(v) => changeDeepResearchLevel(v as "quick" | "high" | "max")}
                >
                  <SelectTrigger className="h-6 w-[100px] text-xs font-mono border-0 bg-transparent p-0 focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quick" className="text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span>Quick</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="high" className="text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <Layers className="w-3 h-3 text-primary" />
                        <span>High</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="max" className="text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <Crown className="w-3 h-3 text-purple-400" />
                        <span>Max</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-border/40 bg-secondary/40">
                <Languages className="w-3 h-3 text-primary shrink-0" />
                <Select value={language} onValueChange={changeLanguage}>
                  <SelectTrigger className="h-6 w-[110px] text-xs font-mono border-0 bg-transparent p-0 focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto" className="text-xs font-mono">🌐 Auto</SelectItem>
                    <SelectItem value="en" className="text-xs font-mono">English</SelectItem>
                    <SelectItem value="pt" className="text-xs font-mono">Português (BR)</SelectItem>
                    <SelectItem value="es" className="text-xs font-mono">Español</SelectItem>
                    <SelectItem value="fr" className="text-xs font-mono">Français</SelectItem>
                    <SelectItem value="de" className="text-xs font-mono">Deutsch</SelectItem>
                    <SelectItem value="it" className="text-xs font-mono">Italiano</SelectItem>
                    <SelectItem value="ja" className="text-xs font-mono">日本語</SelectItem>
                    <SelectItem value="zh" className="text-xs font-mono">中文</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("agentforge:open-project-preview"))
                }}
                className="text-xs font-mono text-primary"
                title="Ver preview do projeto"
              >
                <Globe className="w-3 h-3 mr-1" />
                Preview
              </Button>
              {/* Model picker — searchable, fetched from user's OpenRouter API */}
              <div className="relative" data-model-picker>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowModelPicker(!showModelPicker)}
                  className="text-xs font-mono"
                  title="Selecionar modelo"
                >
                  <Cpu className="w-3 h-3 mr-1" />
                  <span className="max-w-[100px] truncate">{preferredModel.split("/").pop()}</span>
                </Button>
                {showModelPicker && (
                  <div className="absolute bottom-full mb-2 left-0 w-80 max-w-[90vw] rounded-lg border border-border/60 bg-card/95 backdrop-blur-sm shadow-lg overflow-hidden z-50">
                    <div className="p-2 border-b border-border/40">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                        <Input
                          placeholder="Buscar modelo..."
                          value={modelSearch}
                          onChange={(e) => setModelSearch(e.target.value)}
                          className="h-7 pl-7 text-xs font-mono"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {apiModels.length === 0 ? (
                        <div className="p-3 text-xs text-muted-foreground font-mono text-center">
                          Configure sua chave OpenRouter em API Keys
                        </div>
                      ) : (
                        apiModels
                          .filter((m) => {
                            if (!modelSearch) return true
                            const q = modelSearch.toLowerCase()
                            return m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
                          })
                          .slice(0, 100)
                          .map((m) => (
                            <button
                              key={m.id}
                              onClick={() => {
                                changeModel(m.id)
                                setShowModelPicker(false)
                                setModelSearch("")
                              }}
                              className={`w-full text-left px-3 py-2 hover:bg-secondary/60 transition-colors ${
                                preferredModel === m.id ? "bg-primary/10 border-l-2 border-primary" : ""
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {m.isFree && (
                                  <span className="text-[9px] font-mono text-primary bg-primary/10 px-1 py-0.5 rounded border border-primary/20 shrink-0">
                                    FREE
                                  </span>
                                )}
                                <span className="text-xs font-mono font-medium truncate">{m.name}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground font-mono truncate">{m.id}</span>
                                {m.contextLength > 0 && (
                                  <span className="text-[9px] text-muted-foreground font-mono shrink-0">
                                    {Math.round(m.contextLength / 1000)}K
                                  </span>
                                )}
                              </div>
                            </button>
                          ))
                      )}
                    </div>
                    {apiModels.length > 0 && (
                      <div className="p-2 border-t border-border/40 text-[10px] text-muted-foreground font-mono text-center">
                        {apiModels.length} modelos disponíveis
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="text-xs font-mono text-muted-foreground"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Limpar
              </Button>
            </div>
            <p className="text-muted-foreground font-mono hidden sm:block text-[10px]">
              Enter envia · Shift+Enter quebra linha
            </p>
          </div>
        </form>
      </div>

      {/* Project Preview modal */}
      {showProjectPreview && activeProject && (
        <ProjectPreview
          artifacts={previewArtifacts.length > 0
            ? previewArtifacts
            : activeProject.messages
                .filter((m) => m.role === "assistant" && m.content)
                .flatMap((m) => extractArtifacts(m.content || ""))}
          workspaceFiles={activeProject.workspace}
          onClose={() => {
            setShowProjectPreview(false)
            setPreviewArtifacts([])
          }}
        />
      )}
    </div>
  )
}

function MessageBubble({ m, onEdit, onResend }: { m: Msg; onEdit?: (id: string, content: string) => void; onResend?: (id: string) => void }) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(m.content)
  const { toast } = useToast()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayContent || m.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: "Mensagem copiada" })
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" })
    }
  }

  const handleSaveEdit = () => {
    if (onEdit && editContent.trim() !== m.content) {
      onEdit(m.id, editContent.trim())
      if (onResend) onResend(m.id)
    }
    setEditing(false)
  }

  // Extract artifacts even during streaming (handles incomplete code blocks)
  const artifacts = m.role === "assistant" && m.content ? extractArtifacts(m.content) : []
  // Show only narration text (code blocks stripped) in the message bubble
  const displayContent = m.role === "assistant" && artifacts.length > 0
    ? stripCodeBlocks(m.content)
    : m.content

  return (
    <div className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
          m.role === "user"
            ? "bg-secondary"
            : "bg-primary/10 border border-primary/30"
        }`}
      >
        {m.role === "user" ? (
          <span className="text-[10px] font-mono">USER</span>
        ) : m.streaming && !m.content ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4 text-primary" />
        )}
      </div>
      <div className="max-w-[85%] space-y-2 min-w-0 group">
        {/* Thinking block */}
        {m.role === "assistant" && (m.thinking || (m.streaming && !m.content)) && (
          <ThinkingBlock thinking={m.thinking || ""} source={m.thinkingSource} streaming={m.streaming} />
        )}

        {/* Tool calls */}
        {m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0 && (
          <div className="space-y-1">
            {m.toolCalls.map((tc, idx) => (
              <ToolCallBadge key={idx} tc={tc} />
            ))}
          </div>
        )}

        {/* Main content or edit textarea */}
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm bg-card border border-primary/40 font-mono resize-y min-h-[80px]"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} className="font-mono text-xs">
                <Check className="w-3 h-3 mr-1" />
                Salvar e reenviar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="font-mono text-xs">
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          displayContent && (
            <div
              className={`rounded-lg px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-card border border-border/60"
              }`}
            >
              {displayContent}
              {m.streaming && m.content && (
                <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse align-middle" />
              )}
            </div>
          )
        )}

        {/* Attached files — code extracted from response */}
        {artifacts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              <FileCode className="w-3 h-3" />
              {artifacts.length === 1 ? "Arquivo gerado" : `${artifacts.length} arquivos gerados`}
            </div>
            {artifacts.map((art) => (
              <ArtifactCard
                key={art.id}
                artifact={art}
                onPreview={(artifact) => {
                  // Open ProjectPreview with just this artifact
                  window.dispatchEvent(
                    new CustomEvent("agentforge:open-preview-with-artifact", {
                      detail: { artifact }
                    })
                  )
                }}
                onAddToWorkspace={(file) => {
                  window.dispatchEvent(
                    new CustomEvent("agentforge:add-to-workspace", { detail: file })
                  )
                }}
              />
            ))}
          </div>
        )}

        {/* "Pesquisando..." indicator */}
        {m.role === "assistant" && m.streaming && !m.content && (
          <div className="bg-card border border-border/60 rounded-lg px-3 py-2 text-sm text-muted-foreground font-mono flex items-center gap-2">
            <Search className="w-3 h-3 animate-pulse" />
            {m.toolCalls && m.toolCalls.some((t) => t.status === "running")
              ? "Executando ferramenta..."
              : m.thinking
              ? "Pensando..."
              : "Processando..."}
          </div>
        )}

        {/* Model badge */}
        {m.role === "assistant" && m.model && !m.streaming && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
            <Sparkles className="w-2.5 h-2.5" />
            {m.model}
          </div>
        )}

        {/* Action buttons — appear on hover (or always on mobile) */}
        {!editing && !m.streaming && m.content && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-[10px] font-mono text-muted-foreground"
              onClick={handleCopy}
            >
              {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
            </Button>
            {m.role === "user" && onEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[10px] font-mono text-muted-foreground"
                onClick={() => {
                  setEditContent(m.content)
                  setEditing(true)
                }}
                title="Editar mensagem"
              >
                <Pencil className="w-3 h-3" />
              </Button>
            )}
            {m.role === "assistant" && artifacts.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[10px] font-mono text-primary"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("agentforge:open-project-preview"))
                }}
                title="Ver preview do projeto"
              >
                <Globe className="w-3 h-3" />
                <span className="ml-1">Preview</span>
              </Button>
            )}
            <span className="text-[10px] text-muted-foreground font-mono ml-1">
              {new Date(m.ts).toLocaleTimeString("pt-BR")}
            </span>
          </div>
        )}

        {/* Timestamp when no actions */}
        {(editing || m.streaming || !m.content) && (
          <p className="text-[10px] text-muted-foreground font-mono">
            {new Date(m.ts).toLocaleTimeString("pt-BR")}
          </p>
        )}
      </div>
    </div>
  )
}

function ThinkingBlock({
  thinking,
  source,
  streaming,
}: {
  thinking: string
  source?: "native" | "synthetic" | "none"
  streaming?: boolean
}) {
  const [open, setOpen] = useState(true)
  const [userToggled, setUserToggled] = useState(false)

  // Auto-open while streaming, unless user manually closed
  useEffect(() => {
    if (streaming && !userToggled) setOpen(true)
  }, [streaming, userToggled])

  const handleToggle = () => {
    setUserToggled(true)
    setOpen((v) => !v)
  }
  const isNative = source === "native"
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono hover:bg-primary/10 transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3 text-primary" /> : <ChevronRight className="w-3 h-3 text-primary" />}
        <Brain className="w-3 h-3 text-primary" />
        <span className="text-primary font-semibold">
          {streaming ? "Pensando..." : "Pensamento"}
        </span>
        <Badge
          variant="outline"
          className={`text-[9px] py-0 px-1 ml-1 ${
            isNative ? "text-primary border-primary/30" : "text-amber-400 border-amber-500/30"
          }`}
        >
          {isNative ? "NATIVO" : "SINTÉTICO"}
        </Badge>
        <span className="text-muted-foreground ml-auto">
          {thinking.length} chars
        </span>
      </button>
      {open && (
        <pre className="px-3 pb-3 pt-1 text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground border-t border-primary/20 max-h-60 overflow-y-auto">
          {thinking || (streaming ? "Aguardando raciocínio do modelo..." : "")}
          {streaming && <span className="inline-block w-2 h-3 bg-primary animate-pulse align-middle ml-1" />}
        </pre>
      )}
    </div>
  )
}

function ToolCallBadge({ tc }: { tc: ToolCall }) {
  const [open, setOpen] = useState(false)
  const isRunning = tc.status === "running"
  return (
    <div className="text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border font-mono flex-wrap transition-colors ${
          isRunning
            ? "border-primary/40 bg-primary/10 animate-pulse"
            : tc.ok
            ? "border-border/60 bg-secondary/40 hover:border-primary/40"
            : "border-destructive/40 bg-destructive/10"
        }`}
      >
        {isRunning ? (
          <Loader2 className="w-3 h-3 text-primary animate-spin" />
        ) : (
          <Wrench className={`w-3 h-3 ${tc.ok ? "text-primary" : "text-destructive"}`} />
        )}
        <span className={isRunning ? "text-primary" : tc.ok ? "text-primary" : "text-destructive"}>
          {tc.name}
        </span>
        <span className="text-muted-foreground">
          ({Object.entries(tc.args)
            .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
            .join(", ") || "sem args"})
        </span>
        {!isRunning && (
          <Badge
            variant="outline"
            className={`text-[9px] py-0 px-1 ${
              tc.ok ? "text-primary border-primary/30" : "text-destructive border-destructive/30"
            }`}
          >
            {tc.ok ? "OK" : "ERRO"}
          </Badge>
        )}
        {isRunning && (
          <span className="text-primary text-[10px]">executando...</span>
        )}
      </button>
      {open && tc.result !== undefined && (
        <pre className="mt-1 p-2 rounded bg-secondary/60 text-[10px] font-mono overflow-x-auto max-w-full">
          {typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result, null, 2)}
        </pre>
      )}
    </div>
  )
}
