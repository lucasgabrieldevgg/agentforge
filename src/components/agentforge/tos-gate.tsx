"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bot, Loader2, ShieldCheck, FileText } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAppStore } from "@/stores/app-store"
import ReactMarkdown from "react-markdown"

type ToSData = {
  version: string
  date: string
  title: string
  text: string
  acceptedAt: string | null
  acceptedVersion: string | null
  needsAcceptance: boolean
}

export function ToSGate({ onAccepted }: { onAccepted: () => void }) {
  const [data, setData] = useState<ToSData | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [checked, setChecked] = useState(false)
  const { toast } = useToast()
  const { setView } = useAppStore()

  useEffect(() => {
    fetch("/api/tos")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [])

  const handleAccept = async () => {
    if (!checked) {
      toast({
        title: "Você precisa confirmar",
        description: "Marque a caixa para aceitar os termos.",
        variant: "destructive",
      })
      return
    }
    setAccepting(true)
    try {
      const res = await fetch("/api/tos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept: true }),
      })
      if (!res.ok) throw new Error("Falha ao aceitar")
      toast({ title: "Termos aceitos!", description: "Bem-vindo ao AgentForge." })
      onAccepted()
    } catch (e) {
      toast({
        title: "Erro",
        description: (e as Error).message,
        variant: "destructive",
      })
    } finally {
      setAccepting(false)
    }
  }

  const handleDecline = () => {
    toast({
      title: "Termos recusados",
      description: "Você precisa aceitar os termos para usar a plataforma.",
      variant: "destructive",
    })
    setView("landing")
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 jarvis-grid">
      <div className="w-full max-w-3xl space-y-4">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto glow-primary">
            <Bot className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-mono">{data.title}</h1>
          <p className="text-sm text-muted-foreground">
            Para usar o AgentForge, você precisa aceitar os termos abaixo.
          </p>
        </div>

        <Card className="p-3 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold">Resumo rápido</p>
              <ul className="text-muted-foreground list-disc list-inside space-y-0.5 text-xs">
                <li>Você traz suas próprias chaves de API (OpenRouter, etc).</li>
                <li>Coleta anônima de conversas é <strong>obrigatória</strong> para usar a plataforma.</li>
                <li>Sem login por 14 dias → conta desativada. 30 dias → deletada.</li>
                <li>Sem PII (sem email, nome, senhas, chaves de API).</li>
              </ul>
            </div>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="border-b border-border/50 px-4 py-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Termos completos</h3>
          </div>
          <ScrollArea className="h-[40vh]">
            <div className="p-4 prose prose-sm prose-invert max-w-none">
              <ReactMarkdown>{data.text}</ReactMarkdown>
            </div>
          </ScrollArea>
        </Card>

        <Card className="p-4 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              className="mt-1"
            />
            <div className="text-sm">
              <p className="font-medium">
                Eu li e aceito os Termos de Uso (versão {data.version}), incluindo a
                coleta anônima de dados.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Você precisará aceitar novamente se os termos mudarem.
              </p>
            </div>
          </label>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              onClick={handleAccept}
              disabled={!checked || accepting}
              className="flex-1 font-mono glow-primary"
            >
              {accepting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Aceitar e continuar
            </Button>
            <Button
              onClick={handleDecline}
              variant="outline"
              className="font-mono"
            >
              Recusar e sair
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
