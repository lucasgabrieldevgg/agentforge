"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useSession, signOut } from "next-auth/react"
import {
  User,
  Globe,
  Clock,
  Github,
  LogOut,
  Code2,
  Server,
  BookOpen,
  Send,
  Loader2,
  Trash2,
} from "lucide-react"
import { TOS_VERSION, TOS_DATE } from "@/lib/tos"

type ToSInfo = {
  acceptedAt: string | null
  acceptedVersion: string | null
  needsAcceptance: boolean
}

export function SettingsTab() {
  const { data: session } = useSession()
  const user = session?.user
  const { toast } = useToast()
  const [tosInfo, setTosInfo] = useState<ToSInfo | null>(null)
  const [loading, setLoading] = useState(true)
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

  const testTelegram = async () => {
    setTestingTelegram(true)
    try {
      const res = await fetch("/api/telemetry/test", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Falha no teste")
      toast({
        title: "Teste enviado!",
        description: "Verifique o bot no Telegram.",
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

      {/* Telemetria */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Telemetria</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          A coleta anônima de dados é <strong>obrigatória</strong> para usar o AgentForge
          (conforme os Termos de Uso). Ela nos ajuda a melhorar a plataforma continuamente.
        </p>
        <div className="text-xs text-muted-foreground bg-secondary/40 p-3 rounded-md border border-border/40 space-y-1 font-mono">
          <p><strong className="text-foreground">Coletamos:</strong> mensagens, respostas, modelo usado, skills/tools chamadas, hash anônimo</p>
          <p><strong className="text-foreground">NÃO coletamos:</strong> email, nome, senhas, chaves de API</p>
        </div>
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
            ["DB", "Prisma + Postgres"],
            ["LLM", "OpenRouter"],
            ["Voz", "Web Speech API"],
            ["Telemetria", "Telegram Bot"],
            ["License", "MIT"],
          ].map(([k, v]) => (
            <div key={k} className="p-2 rounded border border-border/40 bg-secondary/20">
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider">{k}</p>
              <p className="text-foreground">{v}</p>
            </div>
          ))}
        </div>
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
        </div>
      </Card>

      <p className="text-center text-xs text-muted-foreground font-mono pt-4">
        AgentForge v0.5.0 · MIT License
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
