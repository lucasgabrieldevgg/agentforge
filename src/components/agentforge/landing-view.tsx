"use client"

import { Button } from "@/components/ui/button"
import {
  Bot,
  Mic,
  Brain,
  Plug,
  Github,
  ArrowRight,
  Zap,
  ShieldCheck,
  Code2,
  Sparkles,
  Gauge,
  Languages,
  FolderOpen,
} from "lucide-react"

const FREE_APIS = [
  { name: "Vercel", desc: "Hospedagem + cron", limit: "100GB/mês" },
  { name: "Supabase", desc: "Banco + arquivos", limit: "500MB" },
  { name: "OpenRouter", desc: "LLM gratuito", limit: "Free tier" },
  { name: "Pyodide (WASM)", desc: "Python no navegador", limit: "Grátis" },
  { name: "Open-Meteo", desc: "Clima", limit: "Grátis" },
  { name: "Frankfurter", desc: "Cotação de moedas", limit: "Grátis" },
]

const FEATURES = [
  {
    icon: Mic,
    title: "Executa código no navegador",
    desc: "Artifacts Python rodam direto no seu browser (Pyodide/WASM): vê a saída, corrige, e manda o resultado de volta pro agente fechar o loop gerar → rodar → corrigir.",
  },
  {
    icon: Gauge,
    title: "Benchmark de modelos",
    desc: "Rode uma bateria de tarefas pelo motor real do agente e compare modelos: usou a ferramenta certa? respondeu certo? qual latência? Tudo medido no próprio site.",
  },
  {
    icon: Brain,
    title: "Thinking em 3 níveis",
    desc: "Quick, High e Max. Suporta modelos com reasoning nativo (GPT-OSS, Nemotron) e injeta raciocínio sintético nos que não têm — mostrado em tempo real enquanto pensa.",
  },
  {
    icon: Zap,
    title: "Deep Research multi-idioma",
    desc: "Pesquisa aprofundada na Wikipedia: Quick (1 idioma), High (3 + relacionados), Max (5 + 5 relacionados). O agente decide sozinho quando pesquisar.",
  },
  {
    icon: Languages,
    title: "Multilíngue",
    desc: "No modo Auto, o agente responde no idioma em que você escrever — ou força um dos 8 idiomas suportados (PT-BR, EN, ES, FR, DE, IT, JA, ZH).",
  },
  {
    icon: FolderOpen,
    title: "Projetos & Workspace com auto-save",
    desc: "Cada projeto tem mensagens, configurações e workspace próprios. Código gerado é salvo automaticamente no Workspace, com preview de HTML, execução de Python e download.",
  },
  {
    icon: Plug,
    title: "Ferramentas plug-and-play",
    desc: "Clima, calculadora, Wikipedia, cotação de moedas, países, conversor de unidades, gerador de senhas — todas grátis, sem chave, e cada uso aparece em tempo real no chat.",
  },
  {
    icon: Sparkles,
    title: "Skills com /comandos",
    desc: "15 skills estilo Slack/Discord: /translate, /summarize, /code, /explain, /joke e mais. Digite / pra ver o menu — a IA também invoca skills sozinha quando faz sentido.",
  },
  {
    icon: Code2,
    title: "Open source no GitHub",
    desc: "Faça fork, modifique, rode no seu PC sem limite de tempo (DEMO_MODE=false). Next.js 16, Prisma, Tailwind 4, shadcn/ui — stack moderna e documentada.",
  },
]

export function LandingView({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="min-h-screen flex flex-col jarvis-grid">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-40 bg-background/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-mono font-bold text-lg leading-none">AgentForge</h1>
              <p className="text-[10px] text-muted-foreground font-mono">v0.21.0 — open source demo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="font-mono"
            >
              <a
                href="https://github.com/lucasgabrieldevgg/agentforge"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="w-4 h-4 mr-1" />
                GitHub
              </a>
            </Button>
            <Button
              size="sm"
              onClick={onEnter}
              className="font-mono glow-primary"
            >
              Abrir demo
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24 relative">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-primary voice-pulse" />
            Plataforma open source de agentes com IA
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            Construa seu{" "}
            <span className="text-primary text-glow">Jarvis</span>{" "}
            particular
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Uma plataforma que transforma APIs gratuitas em ferramentas e skills para um
            agente inteligente. Você cola suas chaves, ele faz o resto — pesquisa,
            executa e cria. Roda até num celular velho.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button
              size="lg"
              onClick={onEnter}
              className="font-mono text-base px-8 glow-primary"
            >
              Experimentar a demo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="font-mono text-base px-8"
            >
              <a
                href="https://github.com/lucasgabrieldevgg/agentforge"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="w-4 h-4 mr-2" />
                Ver no GitHub
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground font-mono pt-2">
            Stack: Next.js 16 · Prisma · Tailwind 4 · shadcn/ui · OpenRouter
          </p>
          <p className="text-[10px] text-amber-400/70 font-mono pt-1">
            ⚠️ Demo gratuita: 60s por resposta — o agente adapta thinking, ferramentas e tamanho do código ao tempo que tem. Clone o repo pra rodar sem limite.
          </p>
        </div>
      </section>

      {/* Free APIs table */}
      <section className="px-4 py-12 sm:py-16 border-t border-border/40">
        <div className="max-w-5xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-2">
            Tudo grátis. De verdade.
          </h3>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
            Aproveite os free tiers desses serviços. Você insere suas próprias chaves —
            a plataforma não tem custo pra rodar.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FREE_APIS.map((api) => (
              <div
                key={api.name}
                className="p-4 rounded-lg border border-border/60 bg-card/50 backdrop-blur-sm hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-semibold text-primary">{api.name}</p>
                    <p className="text-sm text-muted-foreground">{api.desc}</p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20">
                    {api.limit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16 border-t border-border/40">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-2">
            O que ele faz
          </h3>
          <p className="text-center text-muted-foreground mb-10">
            Features da demo — tem mais no GitHub.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feat) => (
              <div
                key={feat.title}
                className="p-5 rounded-lg border border-border/60 bg-card/40 hover:border-primary/40 transition-colors"
              >
                <div className="w-10 h-10 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center mb-3">
                  <feat.icon className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold mb-1">{feat.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-4 py-16 border-t border-border/40">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h3 className="text-3xl font-bold">
            Pronto pra testar?
          </h3>
          <p className="text-muted-foreground">
            A demo roda direto no navegador. Pra conversar com o agente, você precisa
            colar uma chave gratuita da OpenRouter (tem tutorial dentro).
          </p>
          <Button
            size="lg"
            onClick={onEnter}
            className="font-mono text-base px-8 glow-primary"
          >
            Abrir demo agora
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/40 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground font-mono">
          <p>AgentForge — feito com Next.js</p>
          <p>MIT License · 2026</p>
        </div>
      </footer>
    </div>
  )
}
