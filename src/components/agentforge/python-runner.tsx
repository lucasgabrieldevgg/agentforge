"use client"

// Python runner — executes Python artifacts in the browser via Pyodide (WASM).
// No server round-trip, no API key, no cost: the harness loop (generate → run →
// feed output back to the agent) closes entirely on the client.

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Play, Loader2, Send, TerminalSquare, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<any>
    __agentforgePyodide?: Promise<any>
  }
}

const PYODIDE_VERSION = "0.26.4"
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

function getPyodide(): Promise<any> {
  if (window.__agentforgePyodide) return window.__agentforgePyodide
  const promise = new Promise<any>((resolve, reject) => {
    const existing = document.querySelector(`script[data-pyodide="${PYODIDE_VERSION}"]`)
    const finish = () => {
      if (!window.loadPyodide) return reject(new Error("Pyodide não carregou"))
      resolve(window.loadPyodide({ indexURL: PYODIDE_URL }))
    }
    if (existing) {
      finish()
      return
    }
    const script = document.createElement("script")
    script.src = `${PYODIDE_URL}pyodide.js`
    script.dataset.pyodide = PYODIDE_VERSION
    script.onload = finish
    script.onerror = () => reject(new Error("Falha ao baixar o Pyodide (CDN)"))
    document.head.appendChild(script)
  })
  window.__agentforgePyodide = promise
  return promise
}

export function PythonRunner({
  open,
  onOpenChange,
  initialCode,
  filename,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialCode: string
  filename: string
}) {
  const [code, setCode] = useState(initialCode)
  const [running, setRunning] = useState(false)
  const [loadingRuntime, setLoadingRuntime] = useState(false)
  const [output, setOutput] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (open) setCode(initialCode)
  }, [open, initialCode])

  const run = async () => {
    if (running) return
    setRunning(true)
    setOutput("")
    let stdout = ""
    let stderr = ""
    try {
      setLoadingRuntime(true)
      const pyodide = await getPyodide()
      setLoadingRuntime(false)
      pyodide.setStdout({ batched: (s: string) => (stdout += s + "\n") })
      pyodide.setStderr({ batched: (s: string) => (stderr += s + "\n") })
      // Yield once so the "running" state paints before the sync execution.
      await new Promise((r) => setTimeout(r, 30))
      const result = await pyodide.runPythonAsync(code)
      let out = stdout
      if (stderr) out += (out ? "\n" : "") + stderr
      if (result !== undefined && result !== null) out += (out ? "\n" : "") + `→ ${String(result)}`
      setOutput(out.trim() || "(sem saída)")
    } catch (e) {
      setLoadingRuntime(false)
      const msg = (e as Error).message || String(e)
      setOutput((stdout ? stdout + "\n" : "") + `❌ ${msg}`.trim())
    } finally {
      setRunning(false)
    }
  }

  const sendToAgent = () => {
    if (!output) return
    const text = `Rodei o arquivo ${filename} no executor Python da plataforma. Saída:\n\`\`\`\n${output.slice(0, 4000)}\n\`\`\`\n`
    window.dispatchEvent(new CustomEvent("agentforge:prefill", { detail: text }))
    toast({
      title: "Saída enviada pro chat",
      description: "O agente vai receber o resultado da execução como contexto.",
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2">
            <TerminalSquare className="w-4 h-4 text-primary" />
            {filename}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Roda localmente no seu navegador (Pyodide/WASM) — sem servidor, sem chave, sem custo.
          Stdin e bibliotecas nativas não são suportados.
        </p>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="w-full h-52 p-3 rounded-md border border-border bg-secondary/30 font-mono text-xs resize-y focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={run} disabled={running} className="font-mono">
            {running ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-1" />
            )}
            {running ? (loadingRuntime ? "Carregando Python…" : "Executando…") : "Executar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="font-mono"
            onClick={() => {
              setCode(initialCode)
              setOutput(null)
            }}
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Restaurar
          </Button>
          {output !== null && (
            <Button
              size="sm"
              variant="outline"
              className="font-mono text-primary"
              onClick={sendToAgent}
            >
              <Send className="w-3 h-3 mr-1" />
              Enviar saída pro agente
            </Button>
          )}
        </div>
        {output !== null && (
          <pre className="p-3 rounded-md border border-border bg-zinc-950 text-zinc-100 font-mono text-xs whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
            <code>{output}</code>
          </pre>
        )}
      </DialogContent>
    </Dialog>
  )
}
