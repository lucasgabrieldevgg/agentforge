"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  KeyRound,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  DollarSign,
  Zap,
  AlertCircle,
} from "lucide-react"

export function OpenRouterTutorial() {
  return (
    <Card className="p-4 space-y-4 border-primary/30 bg-primary/5">
      <div className="flex items-start gap-3">
        <KeyRound className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="font-semibold">Como obter sua chave OpenRouter (passo a passo)</h3>
          <p className="text-sm text-muted-foreground">
            A OpenRouter é um agregador de LLMs. Você cria uma chave lá e usa aqui.
            Tem modelos gratuitos e pagos.
          </p>
        </div>
      </div>

      <ol className="space-y-3 text-sm">
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-mono text-primary shrink-0">
            1
          </span>
          <div className="space-y-1">
            <p className="font-medium">Criar conta</p>
            <p className="text-muted-foreground text-xs">
              Acesse{" "}
              <a
                href="https://openrouter.ai/signin"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-mono inline-flex items-center gap-1"
              >
                openrouter.ai/signin <ExternalLink className="w-3 h-3" />
              </a>{" "}
              e faça login com Google ou GitHub (gratuito).
            </p>
          </div>
        </li>

        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-mono text-primary shrink-0">
            2
          </span>
          <div className="space-y-1">
            <p className="font-medium">Ir em Keys (Chaves)</p>
            <p className="text-muted-foreground text-xs">
              Clique no seu avatar (canto superior direito) →{" "}
              <code className="text-foreground font-mono">Keys</code>. Ou acesse direto:{" "}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-mono inline-flex items-center gap-1"
              >
                openrouter.ai/keys <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </li>

        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-mono text-primary shrink-0">
            3
          </span>
          <div className="space-y-1">
            <p className="font-medium">Criar nova chave</p>
            <p className="text-muted-foreground text-xs">
              Clique em <code className="text-foreground font-mono">Create Key</code>.
              Dê um nome (ex: "AgentForge"). Copie a chave que aparece — ela começa com{" "}
              <code className="text-foreground font-mono">sk-or-v1-...</code>
            </p>
            <div className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>
                <strong>Importante:</strong> a chave aparece só uma vez. Copie e guarde em local seguro.
              </span>
            </div>
          </div>
        </li>

        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-mono text-primary shrink-0">
            4
          </span>
          <div className="space-y-1">
            <p className="font-medium">Colar a chave aqui em cima</p>
            <p className="text-muted-foreground text-xs">
              Cole no campo <code className="text-foreground font-mono">Cole sua chave aqui</code>{" "}
              logo acima deste tutorial e clique em <strong>Salvar</strong>.
            </p>
          </div>
        </li>

        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-mono text-primary shrink-0">
            5
          </span>
          <div className="space-y-1">
            <p className="font-medium">Testar no chat</p>
            <p className="text-muted-foreground text-xs">
              Volte para a aba <strong>Agente</strong> e mande uma mensagem. Se tudo
              estiver certo, o agente vai responder em poucos segundos.
            </p>
          </div>
        </li>
      </ol>

      <div className="border-t border-primary/20 pt-3 space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Modelos disponíveis na OpenRouter
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="p-3 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-primary" />
              <p className="font-semibold text-sm">Modelos Gratuitos</p>
              <Badge variant="outline" className="text-[9px] py-0 px-1 text-primary border-primary/30">
                FREE
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Não custam nada. Têm limites de uso (rate limits) mas funcionam pra testar e uso leve.
            </p>
            <ul className="text-xs space-y-1">
              <li className="flex items-start gap-1">
                <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                <span><code className="font-mono">openai/gpt-oss-20b:free</code> — recomendado (tem thinking)</span>
              </li>
              <li className="flex items-start gap-1">
                <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                <span><code className="font-mono">google/gemma-4-31b-it:free</code></span>
              </li>
              <li className="flex items-start gap-1">
                <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                <span><code className="font-mono">nvidia/nemotron-3-ultra-550b-a55b:free</code></span>
              </li>
              <li className="flex items-start gap-1">
                <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                <span>E vários outros (veja no chat)</span>
              </li>
            </ul>
          </Card>

          <Card className="p-3 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-amber-400" />
              <p className="font-semibold text-sm">Modelos Pagos</p>
              <Badge variant="outline" className="text-[9px] py-0 px-1 text-amber-400 border-amber-500/30">
                PAGO
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Você precisa adicionar créditos na OpenRouter. Custam frações de centavos por requisição.
            </p>
            <ul className="text-xs space-y-1">
              <li className="flex items-start gap-1">
                <DollarSign className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                <span><code className="font-mono">anthropic/claude-sonnet-4</code></span>
              </li>
              <li className="flex items-start gap-1">
                <DollarSign className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                <span><code className="font-mono">openai/gpt-5</code></span>
              </li>
              <li className="flex items-start gap-1">
                <DollarSign className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                <span><code className="font-mono">google/gemini-pro-2.5</code></span>
              </li>
              <li className="flex items-start gap-1">
                <DollarSign className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                <span>E muitos outros</span>
              </li>
            </ul>
          </Card>
        </div>

        <div className="text-xs text-muted-foreground bg-secondary/40 p-2 rounded-md border border-border/40">
          <strong className="text-foreground">Como adicionar créditos (opcional):</strong>{" "}
          na OpenRouter, clique em <code className="font-mono">Credits</code> no menu e
          adicione via cartão. Mínimo $5. Você pode definir limites de gasto para evitar
          surpresas.
        </div>

        <Button variant="outline" size="sm" asChild className="font-mono text-xs">
          <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-3 h-3 mr-1" />
            Abrir OpenRouter Keys
          </a>
        </Button>
      </div>
    </Card>
  )
}
