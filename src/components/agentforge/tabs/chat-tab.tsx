"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useSpeechRecognition, useSpeechSynthesis } from "@/hooks/use-speech"
import { useProjectStore } from "@/stores/project-store"
import { useAppStore } from "@/stores/app-store"
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Trash2,
  Wrench,
  Loader2,
  Sparkles,
  AlertCircle,
  Brain,
  ChevronDown,
  ChevronRight,
  Telescope,
  Zap,
  Layers,
  Crown,
  Cpu,
  Search,
  FolderOpen,
} from "lucide-react"

type StreamingTool = {
  name: string
  args: Record<string, unknown>
  result?: unknown
  ok?: boolean
  status: "running" | "done"
}

type Msg = {
  id: string
  role: "user" | "assistant"
  content: string
  thinking?: string
  thinkingSource?: "native" | "synthetic" | "none"
  model?: string
  toolCalls?: StreamingTool[]
  streaming?: boolean
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
  const [voiceMode, setVoiceMode] = useState(false)
  const [models, setModels] = useState<Array<{
    id: string
    name: string
    description: string
    contextLength: number
    hasNativeThinking: boolean
    recommended?: boolean
  }>>([])
  const [hydrated, setHydrated] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load settings from active project (or defaults)
  const ttsEnabled = activeProject?.settings.ttsEnabled ?? true
  const thinkingEnabled = activeProject?.settings.thinkingEnabled ?? false
  const deepResearchLevel = activeProject?.settings.deepResearchLevel ?? "high"
  const preferredModel = activeProject?.settings.model ?? "openai/gpt-oss-20b:free"

  const { listening, transcript, interim, supported: sttSupported, start, stop } =
    useSpeechRecognition("pt-BR")
  const { speaking, supported: ttsSupported, speak, cancel } = useSpeechSynthesis()

  useEffect(() => {
    setHydrated(true)
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.models) setModels(d.models)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (transcript) setInput(transcript)
  }, [transcript])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

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
            thinking: thinkingEnabled,
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
        const liveToolCalls: StreamingTool[] = []

        const persistAiMsg = (updates: Partial<Msg>) => {
          updateMessage(projectId!, aiMsgId, updates)
        }

        const addToolCallLive = (tool: StreamingTool) => {
          liveToolCalls.push(tool)
          persistAiMsg({ toolCalls: [...liveToolCalls] })
        }

        const updateToolCallLive = (name: string, updates: Partial<StreamingTool>) => {
          const idx = liveToolCalls.findIndex(
            (t) => t.name === name && t.status === "running"
          )
          if (idx >= 0) {
            liveToolCalls[idx] = { ...liveToolCalls[idx], ...updates }
            persistAiMsg({ toolCalls: [...liveToolCalls] })
          }
        }

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

        if (ttsEnabled && ttsSupported && fullReply) {
          speak(fullReply)
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
    [loading, messages, ttsEnabled, ttsSupported, speak, toast, thinkingEnabled, preferredModel, activeProjectId, addMessage, updateMessage, createProject]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleMicClick = () => {
    if (!sttSupported) {
      toast({
        title: "Navegador não suporta voz",
        description: "Use Chrome/Edge para reconhecimento de fala.",
        variant: "destructive",
      })
      return
    }
    if (listening) stop()
    else start()
  }

  const handleVoiceModeToggle = () => {
    if (!sttSupported) {
      toast({ title: "Voz não suportada", description: "Use Chrome/Edge.", variant: "destructive" })
      return
    }
    setVoiceMode((prev) => {
      const next = !prev
      if (next) {
        toast({ title: "Modo voz ativo", description: "Fale quando o microfone acender." })
      } else {
        stop()
      }
      return next
    })
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

  const toggleThinking = () => {
    if (activeProjectId) {
      updateSettings(activeProjectId, { thinkingEnabled: !thinkingEnabled })
    }
    toast({
      title: !thinkingEnabled ? "Modo Pensamento ativado" : "Modo Pensamento desativado",
      description: !thinkingEnabled
        ? "Modelos com thinking nativo usam direto. Outros recebem prompt CoT."
        : "Respostas diretas, sem raciocínio exposto.",
    })
  }

  const toggleTts = () => {
    if (speaking) cancel()
    if (activeProjectId) {
      updateSettings(activeProjectId, { ttsEnabled: !ttsEnabled })
    }
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
      {voiceMode && (
        <div className="border-b border-primary/30 bg-primary/5 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-primary">
            <div className="w-2 h-2 rounded-full bg-primary voice-pulse" />
            <span className="font-mono">Ouvindo…</span>
            {interim && (
              <span className="text-muted-foreground italic truncate max-w-md">
                &ldquo;{interim}&rdquo;
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleVoiceModeToggle}>
            Sair do modo voz
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
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
            <MessageBubble key={m.id} m={m} />
          ))}
        </div>
      </div>

      {/* Input area — ALWAYS visible, fixed at bottom */}
      <div className="border-t border-border/50 bg-background/95 backdrop-blur-sm shrink-0">
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
              type="button"
              size="icon"
              variant={listening ? "default" : "outline"}
              onClick={handleMicClick}
              className={`shrink-0 ${listening ? "glow-primary" : ""}`}
              title={listening ? "Parar" : "Falar"}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleVoiceModeToggle}
                className="text-xs font-mono"
              >
                {voiceMode ? (
                  <span className="text-primary">● Modo voz ON</span>
                ) : (
                  "Modo voz OFF"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleTts}
                className="text-xs font-mono"
                title={ttsEnabled ? "Desativar fala" : "Ativar fala"}
              >
                {ttsEnabled ? <Volume2 className="w-3 h-3 mr-1" /> : <VolumeX className="w-3 h-3 mr-1" />}
                {ttsEnabled ? "TTS ON" : "TTS OFF"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleThinking}
                className={`text-xs font-mono ${thinkingEnabled ? "text-primary" : ""}`}
                title="Ativa raciocínio explícito antes da resposta"
              >
                <Brain className="w-3 h-3 mr-1" />
                {thinkingEnabled ? "Thinking ON" : "Thinking OFF"}
              </Button>
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
                <Cpu className="w-3 h-3 text-primary shrink-0" />
                <Select
                  value={preferredModel}
                  onValueChange={changeModel}
                >
                  <SelectTrigger className="h-6 w-[140px] text-xs font-mono border-0 bg-transparent p-0 focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {models.length === 0 ? (
                      <SelectItem value={preferredModel} className="text-xs font-mono">
                        {preferredModel}
                      </SelectItem>
                    ) : (
                      models.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs font-mono py-2">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              {m.hasNativeThinking && <Brain className="w-3 h-3 text-primary shrink-0" />}
                              {m.recommended && <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />}
                              <span className="font-semibold">{m.name}</span>
                              <span className="text-[9px] text-muted-foreground">
                                {Math.round(m.contextLength / 1000)}K
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                              {m.description.slice(0, 70)}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
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
          {!sttSupported && (
            <div className="flex items-center gap-2 text-xs text-amber-400 font-mono">
              <AlertCircle className="w-3 h-3" />
              Voz não suportada neste navegador (use Chrome/Edge).
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

function MessageBubble({ m }: { m: Msg }) {
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
          <span className="text-xs font-mono">USER</span>
        ) : m.streaming && !m.content ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4 text-primary" />
        )}
      </div>
      <div className="max-w-[85%] space-y-2 min-w-0">
        {/* Thinking block — shown while streaming or after */}
        {m.role === "assistant" && m.thinking && (
          <ThinkingBlock thinking={m.thinking} source={m.thinkingSource} streaming={m.streaming} />
        )}

        {/* Tool calls — shown in real-time as they happen */}
        {m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0 && (
          <div className="space-y-1">
            {m.toolCalls.map((tc, idx) => (
              <ToolCallBadge key={idx} tc={tc} />
            ))}
          </div>
        )}

        {/* Main content */}
        {m.content && (
          <div
            className={`rounded-lg px-3 py-2 text-sm leading-relaxed break-words ${
              m.role === "user"
                ? "bg-secondary text-secondary-foreground"
                : "bg-card border border-border/60"
            }`}
          >
            {m.content}
            {m.streaming && m.content && (
              <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse align-middle" />
            )}
          </div>
        )}

        {/* "Pesquisando..." indicator when only thinking/tools are showing */}
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

        <p className="text-[10px] text-muted-foreground font-mono">
          {new Date(m.ts).toLocaleTimeString("pt-BR")}
        </p>
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
  const [open, setOpen] = useState(true) // open by default while streaming
  const isNative = source === "native"
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
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
          {thinking}
          {streaming && <span className="inline-block w-2 h-3 bg-primary animate-pulse align-middle ml-1" />}
        </pre>
      )}
    </div>
  )
}

function ToolCallBadge({ tc }: { tc: StreamingTool }) {
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
