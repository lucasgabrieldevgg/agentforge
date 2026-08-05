"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Brain, Calendar, Download, FileText, Inbox } from "lucide-react"

type Log = {
  id: string
  date: string
  content: string
  isClosed: boolean
  updatedAt: string
}

export function MemoryTab() {
  const [logs, setLogs] = useState<Log[]>([])
  const [selected, setSelected] = useState<Log | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const load = () => {
    setLoading(true)
    fetch("/api/logs")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  const selectLog = (log: Log) => {
    setSelected(log)
  }

  const downloadTxt = (log: Log) => {
    const blob = new Blob([log.content || "(memória vazia)"], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `memoria-${log.date}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "Download iniciado", description: `memoria-${log.date}.txt` })
  }

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-")
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date)
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-6 space-y-1">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          Memória Diária
        </h2>
        <p className="text-muted-foreground text-sm">
          Tudo que o agente salva vai para um arquivo TXT por dia. À meia-noite o
          arquivo é fechado e um novo começa. O agente pode buscar no passado com{" "}
          <code className="text-primary font-mono">search_memory</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sidebar list */}
        <Card className="p-3 md:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
              Dias
            </h3>
            <span className="text-xs text-muted-foreground font-mono">
              {logs.length} {logs.length === 1 ? "arquivo" : "arquivos"}
            </span>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground space-y-2">
              <Inbox className="w-8 h-8 mx-auto opacity-50" />
              <p>Nenhuma memória ainda.</p>
              <p className="text-xs">
                Converse com o agente e peça pra ele lembrar de algo.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="space-y-1 pr-2">
                {logs.map((log) => (
                  <button
                    key={log.id}
                    onClick={() => selectLog(log)}
                    className={`w-full text-left p-2 rounded-md border transition-colors ${
                      selected?.id === log.id
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/40 hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="font-mono text-sm truncate">{log.date}</span>
                      </div>
                      {log.isClosed && (
                        <span className="text-[9px] font-mono text-muted-foreground shrink-0">
                          FECHADO
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {(log.content || "(vazio)").slice(0, 60)}
                    </p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </Card>

        {/* Main content */}
        <Card className="p-4 md:col-span-2 min-h-[400px]">
          {selected ? (
            <div className="space-y-3 h-full flex flex-col">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="font-semibold capitalize">
                    {formatDate(selected.date)}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {selected.date}.txt · {selected.content.length} caracteres ·{" "}
                    {selected.isClosed ? "fechado" : "aberto"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTxt(selected)}
                  className="text-xs font-mono"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Baixar TXT
                </Button>
              </div>
              <ScrollArea className="flex-1 max-h-[60vh]">
                <pre className="text-sm font-mono whitespace-pre-wrap break-words p-3 rounded-md bg-secondary/30 border border-border/40">
                  {selected.content || "(memória vazia para este dia)"}
                </pre>
              </ScrollArea>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-12">
              <Calendar className="w-10 h-10 text-muted-foreground opacity-50" />
              <div>
                <p className="font-semibold">Selecione um dia</p>
                <p className="text-sm text-muted-foreground">
                  Clique em um arquivo na lista para ver o conteúdo.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
