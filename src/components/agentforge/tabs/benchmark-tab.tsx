"use client"

// Benchmark harness UI — runs the fixed task battery against a chosen model,
// one request per task, and shows a scorecard (tool use + answer + latency).

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { Gauge, Play, Check, X, Loader2, Cpu } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type TaskInfo = { index: number; id: string; label: string; category: string }

type TaskResult = {
  taskId: string
  label: string
  category: string
  pass: boolean
  toolOk: boolean
  answerOk: boolean
  toolsCalled: string[]
  latencyMs: number
  modelUsed: string
  replyPreview: string
}

export function BenchmarkTab() {
  const [tasks, setTasks] = useState<TaskInfo[]>([])
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([])
  const [model, setModel] = useState("openai/gpt-oss-20b:free")
  const [running, setRunning] = useState(false)
  const [currentTask, setCurrentTask] = useState<number | null>(null)
  const [results, setResults] = useState<TaskResult[]>([])
  const { toast } = useToast()

  useEffect(() => {
    fetch("/api/benchmark")
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .catch(() => {})
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.models) {
          setModels(d.models.map((m: any) => ({ id: m.id, name: m.name })))
          if (d.preferredModel) setModel(d.preferredModel)
        }
      })
      .catch(() => {})
  }, [])

  const runBenchmark = async () => {
    if (running) return
    setRunning(true)
    setResults([])
    const collected: TaskResult[] = []
    for (let i = 0; i < tasks.length; i++) {
      setCurrentTask(i)
      try {
        const res = await fetch("/api/benchmark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskIndex: i, model }),
        })
        const data = await res.json()
        if (data.taskId) {
          collected.push(data)
          setResults([...collected])
        } else {
          collected.push({
            taskId: tasks[i].id,
            label: tasks[i].label,
            category: tasks[i].category,
            pass: false,
            toolOk: false,
            answerOk: false,
            toolsCalled: [],
            latencyMs: 0,
            modelUsed: model,
            replyPreview: data.error || "Falha na requisição",
          })
          setResults([...collected])
        }
      } catch {
        collected.push({
          taskId: tasks[i].id,
          label: tasks[i].label,
          category: tasks[i].category,
          pass: false,
          toolOk: false,
          answerOk: false,
          toolsCalled: [],
          latencyMs: 0,
          modelUsed: model,
          replyPreview: "Erro de rede",
        })
        setResults([...collected])
      }
    }
    setCurrentTask(null)
    setRunning(false)
    const score = collected.filter((r) => r.pass).length
    toast({
      title: `Benchmark concluído: ${score}/${collected.length}`,
      description: `Modelo: ${model}`,
    })
  }

  const passed = results.filter((r) => r.pass).length
  const avgLatency = results.length
    ? Math.round(results.reduce((acc, r) => acc + r.latencyMs, 0) / results.length / 100) / 10
    : 0

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
          <Gauge className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Benchmark</h2>
          <p className="text-xs text-muted-foreground">
            Roda a bateria de tarefas pelo motor real do agente e mede uso de
            ferramentas, resposta correta e latência.
          </p>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex items-center gap-2 flex-1">
            <Cpu className="w-4 h-4 text-primary shrink-0" />
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="text-xs font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs font-mono">
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={runBenchmark} disabled={running || !tasks.length} className="font-mono">
            {running ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-1" />
            )}
            {running ? `Rodando ${currentTask !== null ? currentTask + 1 : 0}/${tasks.length}` : "Rodar benchmark"}
          </Button>
        </div>
        {results.length > 0 && (
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-lg font-bold text-primary">
              {passed}/{results.length}
            </span>
            <span className="text-muted-foreground">aprovadas</span>
            <span className="text-muted-foreground">·</span>
            <span>média {avgLatency}s</span>
          </div>
        )}
      </Card>

      <div className="space-y-2">
        {tasks.map((t) => {
          const r = results.find((x) => x.taskId === t.id)
          const isCurrent = currentTask === t.index
          return (
            <div
              key={t.id}
              className="rounded-lg border border-border/60 bg-secondary/20 px-3 py-2 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isCurrent ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                ) : r ? (
                  r.pass ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-red-400 shrink-0" />
                  )
                ) : (
                  <div className="w-4 h-4 rounded-full border border-border shrink-0" />
                )}
                <span className="text-sm truncate">{t.label}</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                  {t.category}
                </Badge>
              </div>
              {r && (
                <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono text-muted-foreground">
                  {!r.toolOk && <span title="Ferramenta errada">🔧✗</span>}
                  {!r.answerOk && <span title="Resposta incorreta">💬✗</span>}
                  <span>{(r.latencyMs / 1000).toFixed(1)}s</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {results.length > 0 && (
        <Card className="p-3">
          <h3 className="text-xs font-mono font-semibold mb-2 text-muted-foreground">
            DETALHES
          </h3>
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.taskId} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className={r.pass ? "text-emerald-400" : "text-red-400"}>
                    {r.pass ? "✓" : "✗"}
                  </span>
                  <span className="font-mono">{r.taskId}</span>
                  {r.toolsCalled.length > 0 && (
                    <span className="text-muted-foreground font-mono text-[10px]">
                      [{r.toolsCalled.join(", ")}]
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground ml-5 line-clamp-2">{r.replyPreview}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
