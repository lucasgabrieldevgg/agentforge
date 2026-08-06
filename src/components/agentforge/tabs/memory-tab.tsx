"use client"

import { Card } from "@/components/ui/card"
import { Brain, Clock, AlertTriangle, Code2 } from "lucide-react"

export function MemoryTab() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6 space-y-1">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          Memória Diária
        </h2>
        <p className="text-muted-foreground text-sm">
          Este recurso estava planejado mas foi removido.
        </p>
      </div>

      <Card className="p-6 border-amber-500/30 bg-amber-500/5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Recurso removido</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A <strong>Memória Diária</strong> foi um módulo planejado que permitiria
              ao agente salvar conversas em arquivos TXT diários, lembrando de
              informações entre sessões.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Foi <strong>removido pelo desenvolvedor</strong> por aumentar
              significativamente a complexidade do projeto — tanto em termos de
              armazenamento (cada usuário geraria um arquivo por dia) quanto em
              lógica de rotação, busca e limpeza.
            </p>
          </div>
        </div>

        <div className="border-t border-amber-500/20 pt-4 space-y-2 text-sm">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            Status
          </p>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>Planejado → implementado → removido (v0.5.0)</span>
          </div>
        </div>

        <div className="border-t border-amber-500/20 pt-4 space-y-2 text-sm">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Code2 className="w-3 h-3" />
            O que isso muda
          </p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
              <span>O agente <strong>não lembra</strong> de conversas entre sessões.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
              <span>Cada conversa começa "do zero" (mas mantém o histórico da sessão atual).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
              <span>Menos complexidade no banco de dados (modelos <code className="text-foreground font-mono">DailyLog</code> não são mais criados).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
              <span>Skills e Tools continuam funcionando normalmente.</span>
            </li>
          </ul>
        </div>

        <div className="border-t border-amber-500/20 pt-4 text-xs text-muted-foreground italic">
          Esta aba permanece visível para informar usuários sobre a remoção.
          Pode ser reposta no futuro se a complexidade for justificada.
        </div>
      </Card>
    </div>
  )
}
