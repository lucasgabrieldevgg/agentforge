"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useAppStore } from "@/stores/app-store"
import { OpenRouterTutorial } from "@/components/agentforge/openrouter-tutorial"
import {
  KeyRound,
  Trash2,
  Save,
  ExternalLink,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"

const SERVICES = [
  {
    service: "openrouter",
    name: "OpenRouter",
    description: "LLM que conversa. Essencial — sem isso o agente não funciona.",
    url: "https://openrouter.ai/keys",
    placeholder: "sk-or-v1-...",
    free: true,
    required: true,
  },
  {
    service: "gmail",
    name: "Gmail API",
    description: "OAuth2 do Google (em breve — só demonstração por enquanto).",
    url: "https://console.cloud.google.com/",
    placeholder: "google-oauth-token",
    free: true,
  },
  {
    service: "twilio",
    name: "Twilio (WhatsApp)",
    description: "Envia mensagens WhatsApp via Twilio (em breve).",
    url: "https://www.twilio.com/",
    placeholder: "AC...",
    free: false,
  },
]

export function KeysTab() {
  const [savedKeys, setSavedKeys] = useState<
    Array<{
      id: string
      service: string
      name: string
      isActive: boolean
      masked: string
      createdAt: string
    }>
  >([])
  const [loading, setLoading] = useState(true)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const { toast } = useToast()
  const { setActiveTab } = useAppStore()

  const load = () => {
    setLoading(true)
    fetch("/api/keys")
      .then((r) => r.json())
      .then((d) => setSavedKeys(d.keys || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const save = async (service: string) => {
    const keyValue = inputs[service]?.trim()
    if (!keyValue) {
      toast({ title: "Chave vazia", variant: "destructive" })
      return
    }
    setSaving(service)
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, keyValue }),
      })
      if (!res.ok) throw new Error("Falha ao salvar")
      toast({ title: "Chave salva", description: service })
      setInputs((prev) => ({ ...prev, [service]: "" }))
      load()
    } catch (e) {
      toast({
        title: "Erro",
        description: (e as Error).message,
        variant: "destructive",
      })
    } finally {
      setSaving(null)
    }
  }

  const remove = async (service: string) => {
    if (!confirm(`Remover a chave de ${service}?`)) return
    await fetch(`/api/keys?service=${service}`, { method: "DELETE" })
    toast({ title: "Chave removida" })
    load()
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6 space-y-1">
        <h2 className="text-2xl font-bold">API Keys</h2>
        <p className="text-muted-foreground text-sm">
          Suas chaves ficam salvas no banco de dados do AgentForge. Em produção,
          recomendamos criptografá-las. Cada usuário usa suas próprias chaves — a
          plataforma não paga por chamadas.
        </p>
      </div>

      <Card className="p-4 mb-6 border-primary/30 bg-primary/5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold">Comece pela OpenRouter</p>
            <p className="text-muted-foreground">
              É a única chave obrigatória. Crie uma conta gratuita em{" "}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-mono"
              >
                openrouter.ai/keys
              </a>{" "}
              e cole abaixo. Depois ative as integrações que quiser.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 text-xs"
              onClick={() => setActiveTab("integrations")}
            >
              Ver integrações
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {SERVICES.map((svc) => {
            const saved = savedKeys.find((k) => k.service === svc.service)
            return (
              <Card key={svc.service} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-primary" />
                        {svc.name}
                      </h4>
                      {svc.required && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1 text-primary border-primary/30">
                          OBRIGATÓRIO
                        </Badge>
                      )}
                      {svc.free ? (
                        <Badge variant="outline" className="text-[9px] py-0 px-1">
                          GRÁTIS
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] py-0 px-1">
                          PAGO
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{svc.description}</p>
                  </div>
                  <a
                    href={svc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline font-mono flex items-center gap-1 shrink-0"
                  >
                    Pegar chave
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {saved ? (
                  <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-secondary/40 border border-border/60">
                    <div className="flex items-center gap-2 text-sm font-mono min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate">{saved.masked}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        · salva em {new Date(saved.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(svc.service)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor={`key-${svc.service}`} className="text-xs font-mono">
                    {saved ? "Atualizar chave (opcional)" : "Cole sua chave aqui"}
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        id={`key-${svc.service}`}
                        type={showKey[svc.service] ? "text" : "password"}
                        placeholder={svc.placeholder}
                        value={inputs[svc.service] || ""}
                        onChange={(e) =>
                          setInputs((prev) => ({
                            ...prev,
                            [svc.service]: e.target.value,
                          }))
                        }
                        className="pr-10 font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowKey((prev) => ({
                            ...prev,
                            [svc.service]: !prev[svc.service],
                          }))
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showKey[svc.service] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <Button
                      onClick={() => save(svc.service)}
                      disabled={saving === svc.service || !inputs[svc.service]?.trim()}
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Salvar
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <OpenRouterTutorial />
    </div>
  )
}
