"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useSession, signOut } from "next-auth/react"
import {
  User,
  Bell,
  Globe,
  Clock,
  Github,
  LogOut,
  Code2,
  Server,
  BookOpen,
  ShieldCheck,
  FlaskConical,
  Send,
  Loader2,
  Trash2,
  AlertTriangle,
} from "lucide-react"
import { TOS_VERSION, TOS_DATE } from "@/lib/tos"

type ToSInfo = {
  acceptedAt: string | null
  acceptedVersion: string | null
  telemetryOptIn: boolean
  needsAcceptance: boolean
}

export function SettingsTab() {
  const { data: session } = useSession()
  const user = session?.user
  const { toast } = useToast()
  const [tosInfo, setTosInfo] = useState<ToSInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingOptIn, setSavingOptIn] = useState(false)
  const [testingTelegram, setTestingTelegram] = useState(false)

  const load = () => {
    setLoading(true)
    fetch("/api/tos")
      .then((r) => r.json())
      .then((d) => setTosInfo(d))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const updateOptIn = async (optIn: boolean) => {
    setSavingOptIn(true)
    try {
      // Use the tos POST endpoint with current accept status + new optIn
      const res = await fetch("/api/tos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept: true, telemetryOptIn: optIn }),
      })
      if (!res.ok) throw new Error("Falha ao atualizar")
      setTosInfo((prev) => (prev ? { ...prev, telemetryOptIn: optIn } : prev))
      toast({
        title: optIn ? "Telemetria ativada" : "Telemetria desativada",
        description: optIn
          ? "Suas conversas vão alimentar a pesquisa da Noesis Labs (anônimas)."
          : "Suas conversas não serão mais coletadas.",
      })
    } catch (e) {
      toast({
        title: "Erro",
        description: (e as Error).message,
        variant: "destructive",
      })
    } finally {
      setSavingOptIn(false)
    }
  }

  const testTelegram = async () => {
    setTestingTelegram(true)
    try {
      const res = await fetch("/api/telemetry/test", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Falha no teste")
      toast({
        title: "Teste enviado!",
        description: "Verifique o bot @NoesisGGBot no Telegram.",
      })
    } catch (e) {
      toast({
        title: "Erro no teste",
        description: (e as Error).message,
        variant: "destructive",
      })
    } finally {
      setTestingTelegram(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground text-sm">
          Configurações da sua conta, privacidade e do agente.
        </p>
      </div>

      {/* Account */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Conta</h3>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Nome</span>
            <span className="font-mono">{user?.name || "—"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Email</span>
            <span className="font-mono">{user?.email}</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-destructive hover:text-destructive"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair da conta
        </Button>
      </Card>

      {/* Noesis Labs — privacy + telemetry */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Noesis Labs — Telemetria & Privacidade</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          O AgentForge é mantido pela <strong>Noesis Labs</strong> para pesquisa de IA
          (projeto <strong>Noema</strong>). Coletamos conversas de forma anônima para
          treinar modelos melhores.
        </p>
        <div className="text-xs text-muted-foreground bg-secondary/40 p-3 rounded-md border border-border/40 space-y-1 font-mono">
          <p><strong className="text-foreground">Coletamos:</strong> mensagens, respostas, modelo usado, tools chamadas, hash anônimo</p>
          <p><strong className="text-foreground">NÃO coletamos:</strong> email, nome, senhas, chaves de API</p>
          <p><strong className="text-foreground">Destino:</strong> bot @NoesisGGBot no Telegram</p>
        </div>

        {loading ? (
          <Skeleton className="h-12" />
        ) : tosInfo && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-secondary/40 border border-border/40">
            <div className="flex items-start gap-3">
              {savingOptIn ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin mt-0.5" />
              ) : (
                <ShieldCheck className={`w-4 h-4 mt-0.5 ${tosInfo.telemetryOptIn ? "text-primary" : "text-muted-foreground"}`} />
              )}
              <div>
                <p className="text-sm font-medium">
                  Telemetria {tosInfo.telemetryOptIn ? "ativada" : "desativada"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tosInfo.telemetryOptIn
                    ? "Suas conversas alimentam a pesquisa (anônimas)."
                    : "Suas conversas não são coletadas."}
                </p>
              </div>
            </div>
            <Switch
              checked={tosInfo.telemetryOptIn}
              disabled={savingOptIn}
              onCheckedChange={updateOptIn}
            />
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={testTelegram}
          disabled={testingTelegram}
          className="text-xs font-mono"
        >
          {testingTelegram ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Send className="w-3 h-3 mr-1" />
          )}
          Testar conexão Telegram
        </Button>
        <p className="text-[10px] text-muted-foreground">
          Envia uma mensagem de teste pro bot @NoesisGGBot. Só funciona se a Noesis Labs já
          configurou o token do bot.
        </p>
      </Card>

      {/* About Noesis Labs */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Sobre a Noesis Labs</h3>
        </div>
        <div className="space-y-2 text-sm">
          <p>
            A <strong>Noesis Labs</strong> é uma iniciativa de pesquisa e desenvolvimento
            de IA focada em criar modelos mais inteligentes e úteis para o dia a dia.
          </p>
          <p className="text-muted-foreground">
            Nosso projeto principal é o <strong>Noema</strong> — um modelo de linguagem
            em treinamento contínuo, alimentado por dados de uso real (com consentimento)
            de plataformas como esta.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded border border-primary/30 bg-primary/5">
            <p className="text-primary font-mono text-[10px] uppercase tracking-wider mb-1">Público</p>
            <ul className="space-y-1 text-foreground">
              <li>• Nome: Noesis Labs</li>
              <li>• Projeto: Noema</li>
              <li>• Bot Telegram: @NoesisGGBot</li>
              <li>• Plataforma: AgentForge</li>
              <li>• License: MIT (código aberto)</li>
              <li>• Stack: Next.js + Supabase + OpenRouter</li>
            </ul>
          </div>
          <div className="p-2 rounded border border-border/40 bg-secondary/20">
            <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-1">Privado</p>
            <ul className="space-y-1 text-muted-foreground italic">
              <li>• Detalhes da arquitetura do Noema</li>
              <li>• Métodos de treinamento</li>
              <li>• Datasets curados</li>
              <li>• Parcerias e clientes</li>
              <li>• Roadmap interno</li>
              <li>• Métricas de performance</li>
            </ul>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground italic">
          Informações públicas podem ser compartilhadas livremente. Privadas são internas
          da Noesis Labs e podem ser reveladas no futuro conforme projetos amadurecem.
        </p>
      </Card>

      {/* Terms of Service */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Termos de Uso</h3>
        </div>
        {loading ? (
          <Skeleton className="h-12" />
        ) : tosInfo ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Versão atual</span>
              <span className="font-mono">{TOS_VERSION} ({TOS_DATE})</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Você aceitou</span>
              <span className="font-mono">
                {tosInfo.acceptedVersion ? (
                  `${tosInfo.acceptedVersion} — ${tosInfo.acceptedAt ? new Date(tosInfo.acceptedAt).toLocaleDateString("pt-BR") : "—"}`
                ) : (
                  "—"
                )}
              </span>
            </div>
            {tosInfo.needsAcceptance && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>Há uma versão nova dos termos. Você precisará aceitar na próxima tela.</span>
              </div>
            )}
          </div>
        ) : null}
      </Card>

      {/* Inactivity policy */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Política de inatividade</h3>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span><strong>14 dias sem login</strong> → conta desativada (login bloqueado, dados preservados).</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span><strong>30 dias sem login</strong> → conta e todos os dados <strong>permanentemente deletados</strong>.</span>
          </div>
          <div className="flex items-start gap-2">
            <Trash2 className="w-3 h-3 text-muted-foreground mt-2 shrink-0" />
            <span className="text-xs text-muted-foreground">
              Política necessária pra caber no free tier do Supabase (~668 usuários ativos).
              Faça login 1x a cada 30 dias pra manter sua conta.
            </span>
          </div>
        </div>
      </Card>

      {/* Capacity / Waitlist */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Capacidade da plataforma</h3>
        </div>
        <CapacityInfo />
      </Card>

      {/* Agente */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Agente</h3>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Modelo LLM</p>
              <p className="text-xs text-muted-foreground">
                Escolha no chat (dropdown ao lado do Deep Research). Recomendado:{" "}
                <span className="font-mono text-primary">openai/gpt-oss-20b:free</span>
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-xs">OpenRouter</Badge>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Idioma</p>
              <p className="text-xs text-muted-foreground">Português (Brasil)</p>
            </div>
            <Globe className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Fuso horário</p>
              <p className="text-xs text-muted-foreground">America/Cuiaba (BRT)</p>
            </div>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </Card>

      {/* Stack técnica */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Stack técnica</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          {[
            ["Frontend", "Next.js 16"],
            ["Styling", "Tailwind 4 + shadcn/ui"],
            ["Auth", "NextAuth.js"],
            ["DB", "Prisma + Postgres (Supabase)"],
            ["LLM", "OpenRouter"],
            ["Voz", "Web Speech API"],
            ["Telemetria", "Telegram Bot API"],
            ["License", "MIT"],
          ].map(([k, v]) => (
            <div key={k} className="p-2 rounded border border-border/40 bg-secondary/20">
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider">{k}</p>
              <p className="text-foreground">{v}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Roadmap */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Próximos passos (roadmap)</h3>
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span><strong>Wake word</strong> — ativar microfone por palavra-chave (&ldquo;Jarvis…&rdquo;).</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span><strong>Gmail real</strong> — OAuth2 do Google pra enviar/ler emails.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span><strong>WhatsApp</strong> — integração com Twilio ou WhatsApp Business API.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span><strong>Modo thinking</strong> — chain-of-thought antes da resposta final.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span><strong>Dashboard Noesis</strong> — agregação de telemetria no bot.</span>
          </li>
        </ul>
      </Card>

      {/* Links */}
      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Recursos</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" asChild className="font-mono text-xs">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              <Github className="w-3.5 h-3.5 mr-1" />
              Código-fonte
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild className="font-mono text-xs">
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
              Pegar chave OpenRouter
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild className="font-mono text-xs">
            <a href="https://t.me/NoesisGGBot" target="_blank" rel="noopener noreferrer">
              @NoesisGGBot
            </a>
          </Button>
        </div>
      </Card>

      <p className="text-center text-xs text-muted-foreground font-mono pt-4">
        AgentForge v0.4.0 · Noesis Labs · MIT License
      </p>
    </div>
  )
}

function CapacityInfo() {
  const [data, setData] = useState<{
    activeUsers: number
    waitingUsers: number
    maxActive: number
    isWaitlistMode: boolean
    slotsAvailable: number
  } | null>(null)

  useEffect(() => {
    fetch("/api/capacity")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  if (!data) return <Skeleton className="h-12" />

  const pct = Math.min(100, Math.round((data.activeUsers / data.maxActive) * 100))
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Usuários ativos</span>
        <span className="font-mono">
          {data.activeUsers} / {data.maxActive}
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full transition-all ${
            pct > 90 ? "bg-destructive" : pct > 75 ? "bg-amber-500" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Pessoas na fila</span>
        <span className="font-mono">{data.waitingUsers}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Modo atual</span>
        <span className={`font-mono ${data.isWaitlistMode ? "text-amber-400" : "text-primary"}`}>
          {data.isWaitlistMode ? "LISTA DE ESPERA" : "ABERTO"}
        </span>
      </div>
    </div>
  )
}
