"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  Clock,
  CloudSun,
  BookOpen,
  Calculator,
  Mail,
  MessageCircle,
  DollarSign,
  Globe,
  Ruler,
  KeyRound,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"

const ICONS: Record<string, typeof Clock> = {
  Clock,
  CloudSun,
  BookOpen,
  Calculator,
  Mail,
  MessageCircle,
  DollarSign,
  Globe,
  Ruler,
  KeyRound,
}

type CatalogItem = {
  service: string
  name: string
  description: string
  category: string
  icon: string
  needsApiKey: boolean
  isFree: boolean
  setupUrl?: string
  enabled: boolean
  hasApiKey: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  "built-in": "Embutido",
  weather: "Clima",
  information: "Informação",
  utility: "Utilitários",
  communication: "Comunicação",
  productivity: "Produtividade",
  knowledge: "Conhecimento",
  automation: "Automação",
}

export function IntegrationsTab() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const { toast } = useToast()

  const load = () => {
    setLoading(true)
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((d) => setItems(d.catalog || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const toggle = async (service: string, enabled: boolean) => {
    setToggling(service)
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, enabled }),
      })
      if (!res.ok) throw new Error("Falha ao atualizar")
      setItems((prev) =>
        prev.map((i) => (i.service === service ? { ...i, enabled } : i))
      )
      toast({
        title: enabled ? "Integração ativada" : "Integração desativada",
        description: service,
      })
    } catch (e) {
      toast({
        title: "Erro",
        description: (e as Error).message,
        variant: "destructive",
      })
    } finally {
      setToggling(null)
    }
  }

  const grouped = items.reduce<Record<string, CatalogItem[]>>((acc, item) => {
    ;(acc[item.category] ||= []).push(item)
    return acc
  }, {})

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6 space-y-1">
        <h2 className="text-2xl font-bold">Integrações</h2>
        <p className="text-muted-foreground text-sm">
          Ative as ferramentas que o agente pode usar. As embutidas são grátis e não
          precisam de chave. As outras exigem que você adicione sua API key na aba
          &ldquo;API Keys&rdquo;.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat} className="space-y-3">
              <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
                {CATEGORY_LABELS[cat] || cat}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {list.map((item) => {
                  const Icon = ICONS[item.icon] || Clock
                  const needsKeyMissing = item.needsApiKey && !item.hasApiKey
                  return (
                    <Card
                      key={item.service}
                      className="p-4 flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold">{item.name}</h4>
                              {item.isFree ? (
                                <Badge variant="outline" className="text-[9px] py-0 px-1 text-primary border-primary/30">
                                  GRÁTIS
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] py-0 px-1">
                                  PAGO
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={item.enabled}
                          disabled={toggling === item.service}
                          onCheckedChange={(v) => toggle(item.service, v)}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        {item.enabled ? (
                          <span className="flex items-center gap-1 text-primary font-mono">
                            <CheckCircle2 className="w-3 h-3" />
                            Ativo
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-mono">Inativo</span>
                        )}
                        {needsKeyMissing && (
                          <span className="flex items-center gap-1 text-amber-400 font-mono">
                            <AlertTriangle className="w-3 h-3" />
                            Precisa de API key
                          </span>
                        )}
                        {item.setupUrl && (
                          <a
                            href={item.setupUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline font-mono"
                          >
                            Pegar chave
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
