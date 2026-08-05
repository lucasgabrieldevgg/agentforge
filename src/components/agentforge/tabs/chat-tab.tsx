"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useSpeechRecognition, useSpeechSynthesis } from "@/hooks/use-speech"
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
} from "lucide-react"

type Msg = {
  id: string
  role: "user" | "assistant"
  content: string
  thinking?: string
  thinkingSource?: "native" | "synthetic" | "none"
  model?: string
  toolCalls?: Array<{
    name: string
    args: Record<string, unknown>
    result: unknown
    ok: boolean
  }>
  ts: number
}

export function ChatTab() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [thinkingEnabled, setThinkingEnabled] = useState(false)
  const [deepResearchLevel, setDeepResearchLevel] = useState<"quick" | "deep" | "max">("deep")
  const [hydrated, setHydrated] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const { listening, transcript, interim, supported: sttSupported, start, stop } =
    useSpeechRecognition("pt-BR")
  const { speaking, supported: ttsSupported, speak, cancel } = useSpeechSynthesis()

  useEffect(() => {
    setHydrated(true)
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => {
        if (data.messages) {
          setMessages(
            data.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : undefined,
              model: m.model,
              ts: new Date(m.createdAt).getTime(),
            }))
          )
        }
      })
      .catch(() => {})
    // Load deep research level preference
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.deepResearchLevel) setDeepResearchLevel(d.deepResearchLevel)
      })
      .catch(() => {})
  }, [])

  const changeDeepResearchLevel = async (level: "quick" | "deep" | "max") => {
    setDeepResearchLevel(level)
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deepResearchLevel: level }),
      })
      const names = { quick: "Quick", deep: "Deep", max: "Max" }
      toast({
        title: "Deep Research: " + names[level],
        description: {
          quick: "Rápido: 1 idioma, sem relacionados.",
          deep: "Profundo: 3 idiomas + 3 relacionados.",
          max: "Máximo: 5 idiomas + 5 relacionados.",
        }[level],
      })
    } catch (e) {
      toast({
        title: "Erro ao salvar",
        description: (e as Error).message,
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    if (transcript) setInput(transcript)
  }, [transcript])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return
      const userMsg: Msg = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        ts: Date.now(),
      }
      setMessages((prev) => [...prev, userMsg])
      setInput("")
      setLoading(true)
      try {
        const history = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        })) as any
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history,
            thinking: thinkingEnabled,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro no agente")
        const aiMsg: Msg = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply,
          thinking: data.thinking,
          thinkingSource: data.thinkingSource,
          model: data.model,
          toolCalls: data.toolCalls,
          ts: Date.now(),
        }
        setMessages((prev) => [...prev, aiMsg])
        if (ttsEnabled && ttsSupported) speak(data.reply)
      } catch (e) {
        toast({
          title: "Erro",
          description: (e as Error).message,
          variant: "destructive",
        })
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Erro: ${(e as Error).message}`,
            ts: Date.now(),
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [loading, messages, ttsEnabled, ttsSupported, speak, toast, thinkingEnabled]
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
      toast({
        title: "Voz não suportada",
        description: "Use Chrome/Edge.",
        variant: "destructive",
      })
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

  const clearChat = async () => {
    await fetch("/api/conversations", { method: "DELETE" })
    setMessages([])
  }

  if (!hydrated) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
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

      <ScrollArea className="flex-1" ref={scrollRef as any}>
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto glow-primary">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Olá! Sou seu agente.</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Pode me pedir o clima, fazer contas, buscar na Wikipedia, ou apenas
                conversar. Posso salvar suas preferências na memória também.
              </p>
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                {[
                  "Que horas são?",
                  "Como está o clima em São Paulo?",
                  "Quanto é 15% de 230?",
                  "Quem foi Alan Turing?",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="px-3 py-1.5 rounded-md border border-border/60 hover:border-primary/40 text-sm font-mono transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} m={m} />
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              </div>
              <div className="bg-card border border-border/60 rounded-lg px-3 py-2 text-sm text-muted-foreground font-mono">
                {thinkingEnabled ? "pensando profundamente" : "pensando"}
                <span className="animate-pulse">...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-3 space-y-2">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte qualquer coisa…"
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
          <div className="flex items-center justify-between text-xs">
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
                onClick={() => {
                  if (speaking) cancel()
                  setTtsEnabled((v) => !v)
                }}
                className="text-xs font-mono"
                title={ttsEnabled ? "Desativar fala" : "Ativar fala"}
              >
                {ttsEnabled ? (
                  <Volume2 className="w-3 h-3 mr-1" />
                ) : (
                  <VolumeX className="w-3 h-3 mr-1" />
                )}
                {ttsEnabled ? "TTS ON" : "TTS OFF"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const next = !thinkingEnabled
                  setThinkingEnabled(next)
                  toast({
                    title: next ? "Modo Pensamento ativado" : "Modo Pensamento desativado",
                    description: next
                      ? "Modelos com thinking nativo usam direto. Outros recebem prompt CoT."
                      : "Respostas diretas, sem raciocínio exposto.",
                  })
                }}
                className={`text-xs font-mono ${thinkingEnabled ? "text-primary" : ""}`}
                title="Ativa raciocínio explícito antes da resposta"
              >
                <Brain className="w-3 h-3 mr-1" />
                {thinkingEnabled ? "Thinking ON" : "Thinking OFF"}
              </Button>
              <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-border/40 bg-secondary/40">
                <Telescope className="w-3 h-3 text-primary" />
                <Select
                  value={deepResearchLevel}
                  onValueChange={(v) => changeDeepResearchLevel(v as "quick" | "deep" | "max")}
                >
                  <SelectTrigger className="h-6 w-[110px] text-xs font-mono border-0 bg-transparent p-0 focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quick" className="text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span>Quick</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="deep" className="text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <Layers className="w-3 h-3 text-primary" />
                        <span>Deep</span>
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
            <p className="text-muted-foreground font-mono hidden sm:block">
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
          <span className="text-xs font-mono">VC</span>
        ) : (
          <Sparkles className="w-4 h-4 text-primary" />
        )}
      </div>
      <div className="max-w-[85%] space-y-2">
        {/* Thinking block — only for assistant messages with thinking content */}
        {m.role === "assistant" && m.thinking && (
          <ThinkingBlock thinking={m.thinking} source={m.thinkingSource} />
        )}

        <div
          className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
            m.role === "user"
              ? "bg-secondary text-secondary-foreground"
              : "bg-card border border-border/60"
          }`}
        >
          {m.content}
        </div>

        {/* Model badge for assistant messages */}
        {m.role === "assistant" && m.model && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
            <Sparkles className="w-2.5 h-2.5" />
            {m.model}
          </div>
        )}

        {m.toolCalls && m.toolCalls.length > 0 && (
          <div className="space-y-1">
            {m.toolCalls.map((tc, idx) => (
              <ToolCallBadge key={idx} tc={tc} />
            ))}
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
}: {
  thinking: string
  source?: "native" | "synthetic" | "none"
}) {
  const [open, setOpen] = useState(false)
  const isNative = source === "native"
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono hover:bg-primary/10 transition-colors"
      >
        {open ? (
          <ChevronDown className="w-3 h-3 text-primary" />
        ) : (
          <ChevronRight className="w-3 h-3 text-primary" />
        )}
        <Brain className="w-3 h-3 text-primary" />
        <span className="text-primary font-semibold">Modo Pensamento</span>
        <Badge
          variant="outline"
          className={`text-[9px] py-0 px-1 ml-1 ${
            isNative
              ? "text-primary border-primary/30"
              : "text-amber-400 border-amber-500/30"
          }`}
        >
          {isNative ? "NATIVO" : "SINTÉTICO"}
        </Badge>
        <span className="text-muted-foreground ml-auto">
          {thinking.length} chars · {open ? "ocultar" : "ver"}
        </span>
      </button>
      {open && (
        <pre className="px-3 pb-3 pt-1 text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground border-t border-primary/20">
          {thinking}
        </pre>
      )}
    </div>
  )
}

function ToolCallBadge({
  tc,
}: {
  tc: {
    name: string
    args: Record<string, unknown>
    result: unknown
    ok: boolean
  }
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border/60 bg-secondary/40 hover:border-primary/40 font-mono flex-wrap"
      >
        <Wrench className="w-3 h-3 text-primary" />
        <span className="text-primary">{tc.name}</span>
        <span className="text-muted-foreground">
          ({Object.entries(tc.args)
            .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
            .join(", ") || "sem args"}
          )
        </span>
        <Badge
          variant="outline"
          className={`text-[9px] py-0 px-1 ${
            tc.ok ? "text-primary border-primary/30" : "text-destructive border-destructive/30"
          }`}
        >
          {tc.ok ? "OK" : "ERRO"}
        </Badge>
      </button>
      {open && (
        <pre className="mt-1 p-2 rounded bg-secondary/60 text-[10px] font-mono overflow-x-auto max-w-full">
          {JSON.stringify(tc.result, null, 2)}
        </pre>
      )}
    </div>
  )
}
