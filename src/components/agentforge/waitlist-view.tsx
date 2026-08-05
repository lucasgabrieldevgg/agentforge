"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useAppStore } from "@/stores/app-store"
import {
  Bot,
  ArrowLeft,
  Loader2,
  Mail,
  User,
  Ticket,
  Clock,
  CheckCircle2,
  Users,
  AlertCircle,
} from "lucide-react"

type WaitlistResult = {
  entry: { id: string; position: number; status: string }
  alreadyExists?: boolean
}

type PositionResult = {
  found: boolean
  position?: number
  status?: string
  totalWaiting?: number
  estimatedWaitDays?: number
}

export function WaitlistView({ reason }: { reason: string }) {
  const { setView } = useAppStore()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [form, setForm] = useState({ email: "", name: "" })
  const [submitted, setSubmitted] = useState<WaitlistResult | null>(null)
  const [position, setPosition] = useState<PositionResult | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email.includes("@")) {
      toast({ title: "Email inválido", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Falha ao entrar na fila")
      setSubmitted(data)
      toast({
        title: data.alreadyExists ? "Você já está na fila!" : "Você entrou na fila!",
        description: `Posição #${data.entry.position}`,
      })
      // Fetch estimated wait time
      setChecking(true)
      const posRes = await fetch(`/api/waitlist?email=${encodeURIComponent(form.email)}`)
      const posData = await posRes.json()
      setPosition(posData)
      setChecking(false)
    } catch (e) {
      toast({
        title: "Erro",
        description: (e as Error).message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 jarvis-grid">
      <button
        onClick={() => setView("landing")}
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold font-mono">Lista de Espera</h1>
          <p className="text-sm text-muted-foreground">
            Estamos em capacidade máxima no momento. Entre na fila — quando uma vaga
            liberar, você será o próximo a receber acesso.
          </p>
        </div>

        <Card className="p-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold">Por que isso aconteceu?</p>
              <p className="text-muted-foreground text-xs">{reason}</p>
            </div>
          </div>
        </Card>

        {!submitted ? (
          <Card className="p-4 space-y-3">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="wl-name">Nome (opcional)</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="wl-name"
                    type="text"
                    placeholder="Como te chamar"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="pl-10 font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wl-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="wl-email"
                    type="email"
                    required
                    placeholder="voce@email.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="pl-10 font-mono"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full font-mono glow-primary"
                size="lg"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Entrar na fila
              </Button>
            </form>
          </Card>
        ) : (
          <Card className="p-4 space-y-3 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                <Ticket className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-mono text-sm text-muted-foreground">Sua posição na fila</p>
                <p className="text-2xl font-bold font-mono text-primary">
                  #{submitted.entry.position}
                </p>
              </div>
            </div>

            {checking ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Calculando tempo estimado...
              </div>
            ) : position?.found ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total na fila</span>
                  <span className="font-mono">{position.totalWaiting}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tempo estimado</span>
                  <span className="font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    ~{position.estimatedWaitDays} dias
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-mono text-primary capitalize">
                    {position.status === "waiting" ? "Aguardando" : position.status}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="p-2 rounded-md bg-secondary/40 text-xs text-muted-foreground">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                <span>
                  Quando sua vaga chegar, você receberá uma notificação no Telegram
                  (@NoesisGGBot) e terá <strong>72 horas</strong> para se cadastrar. Se não
                  aceitar, a vaga vai para o próximo.
                </span>
              </p>
            </div>
          </Card>
        )}

        <Card className="p-4 space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            Como funciona a fila
          </h3>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span>
                <strong>Capacidade atual:</strong> ~668 usuários ativos (limite do Supabase
                Free Tier).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span>
                <strong>Vagas liberam</strong> quando usuários são deletados por inatividade
                (30 dias sem login) ou deletam a própria conta.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span>
                <strong>Notificação</strong> chega no Telegram. Você tem 72h pra aceitar.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span>
                <strong>Estimativa</strong> baseada em ~5% de churn mensal (33 vagas/mês).
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
