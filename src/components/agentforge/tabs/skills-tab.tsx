"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import {
  Languages,
  FileText,
  PenLine,
  Code2,
  GraduationCap,
  BookOpen,
  ListTodo,
  Smile,
  Fingerprint,
  Hash,
  Palette,
  Clock,
  Type,
  Sparkles,
  Zap,
  ShieldCheck,
  Search,
} from "lucide-react"

const ICONS: Record<string, typeof Languages> = {
  Languages,
  FileText,
  PenLine,
  Code2,
  GraduationCap,
  BookOpen,
  ListTodo,
  Smile,
  Fingerprint,
  Hash,
  Palette,
  Clock,
  Type,
}

type SkillItem = {
  name: string
  display_name: string
  description: string
  long_description: string
  icon: string
  category: string
  slash_command: string
  aliases: string[]
  auto_trigger: boolean
  requires_consent: boolean
  parameters: Array<{
    key: string
    type: string
    description: string
    required?: boolean
    default?: string | number | boolean
    enum?: string[]
  }>
  version?: string
  enabled: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  writing: "Escrita",
  dev: "Dev",
  knowledge: "Conhecimento",
  productivity: "Produtividade",
  fun: "Diversão",
  utility: "Utilitários",
}

export function SkillsTab() {
  const [items, setItems] = useState<SkillItem[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const { toast } = useToast()

  const load = () => {
    setLoading(true)
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => setItems(d.skills || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const toggle = async (skillName: string, enabled: boolean) => {
    setToggling(skillName)
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillName, enabled }),
      })
      if (!res.ok) throw new Error("Falha ao atualizar")
      setItems((prev) =>
        prev.map((i) => (i.name === skillName ? { ...i, enabled } : i))
      )
      toast({
        title: enabled ? "Skill ativada" : "Skill desativada",
        description: `/${skillName} ${enabled ? "disponível" : "indisponível"}`,
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

  const filtered = items.filter((i) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      i.name.toLowerCase().includes(q) ||
      i.display_name.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.slash_command.toLowerCase().includes(q) ||
      i.aliases.some((a) => a.toLowerCase().includes(q))
    )
  })

  const grouped = filtered.reduce<Record<string, SkillItem[]>>((acc, item) => {
    ;(acc[item.category] ||= []).push(item)
    return acc
  }, {})

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6 space-y-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Skills
          </h2>
          <p className="text-muted-foreground text-sm">
            Ative as skills que o agente pode usar. Você pode invocá-las no chat com{" "}
            <code className="text-primary font-mono">/nomedaskill</code> ou deixar a IA
            decidir automaticamente.
          </p>
        </div>

        <Card className="p-3 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-2 text-xs">
            <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                <strong>Como usar:</strong> no chat, digite{" "}
                <code className="font-mono text-primary">/translate "hello world" pt</code>{" "}
                ou <code className="font-mono text-primary">/joke</code>.
              </p>
              <p className="text-muted-foreground">
                Skills com <Sparkles className="w-3 h-3 text-primary inline" /> podem ser
                invocadas automaticamente pela IA quando relevante.
              </p>
            </div>
          </div>
        </Card>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar skills por nome, comando ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 font-mono text-sm"
          />
        </div>
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
                {CATEGORY_LABELS[cat] || cat} ({list.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {list.map((skill) => {
                  const Icon = ICONS[skill.icon] || Sparkles
                  return (
                    <Card key={skill.name} className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold">{skill.display_name}</h4>
                              {skill.auto_trigger && (
                                <Badge variant="outline" className="text-[9px] py-0 px-1 text-primary border-primary/30">
                                  <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                                  AUTO
                                </Badge>
                              )}
                              {skill.requires_consent && (
                                <Badge variant="outline" className="text-[9px] py-0 px-1 text-amber-400 border-amber-500/30">
                                  <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                                  CONSENT
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {skill.description}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={skill.enabled}
                          disabled={toggling === skill.name}
                          onCheckedChange={(v) => toggle(skill.name, v)}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/20">
                            /{skill.slash_command}
                          </code>
                          {skill.aliases.map((alias) => (
                            <code key={alias} className="font-mono text-muted-foreground text-[10px]">
                              /{alias}
                            </code>
                          ))}
                        </div>
                        {skill.enabled && (
                          <span className="flex items-center gap-1 text-primary font-mono">
                            <ShieldCheck className="w-3 h-3" />
                            Ativa
                          </span>
                        )}
                      </div>

                      {skill.parameters.length > 0 && (
                        <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-2 space-y-1">
                          <p className="font-mono uppercase tracking-wider">Parâmetros:</p>
                          {skill.parameters.map((p) => (
                            <div key={p.key} className="flex items-center gap-1">
                              <code className="font-mono text-foreground">{p.key}</code>
                              <span className="text-muted-foreground">({p.type})</span>
                              {p.required && <span className="text-amber-400">*</span>}
                              {p.enum && (
                                <span className="text-muted-foreground">
                                  : {p.enum.join("|")}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
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
