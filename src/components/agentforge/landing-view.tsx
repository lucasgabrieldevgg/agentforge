"use client"

import { useAppStore } from "@/stores/app-store"
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
} from "lucide-react"

const FREE_APIS = [
  { name: "Vercel", desc: "Hospedagem + cron", limit: "100GB/mês" },
  { name: "Supabase", desc: "Banco + arquivos", limit: "500MB" },
  { name: "OpenRouter", desc: "LLM gratuito", limit: "Free tier" },
  { name: "Web Speech API", desc: "Voz nativa", limit: "Ilimitado" },
  { name: "Gmail API", desc: "Emails", limit: "Grátis" },
  { name: "OpenWeatherMap", desc: "Clima", limit: "1000/dia" },
]

const FEATURES = [
  {
    icon: Brain,
    title: "Memória diária estilo Jarvis",
    desc: "O agente salva tudo que conversam em arquivos TXT diários. À meia-noite, fecha o arquivo e começa um novo — mas continua conseguindo acessar o passado.",
  },
  {
    icon: Mic,
    title: "Voz nativa do navegador",
    desc: "Usa a Web Speech API: fala e escuta direto no browser. Sem custo, sem API key. Perfeito pra um celular velho virar seu assistente.",
  },
  {
    icon: Plug,
    title: "Integrações plug-and-play",
    desc: "Ative ferramentas com 1 clique: clima, calculadora, Wikipedia, Gmail, WhatsApp. Adicione suas próprias chaves — seus dados ficam com você.",
  },
  {
    icon: Zap,
    title: "Agente que usa ferramentas",
    desc: "O LLM decide sozinho qual tool chamar pra responder. Pode encadear várias chamadas. Mode pensamento (thinking) em breve.",
  },
  {
    icon: ShieldCheck,
    title: "Suas chaves, seu controle",
    desc: "Cada usuário cola a própria API key. A plataforma não paga nem armazena LLM em nome de ninguém. Privacidade total.",
  },
  {
    icon: Code2,
    title: "Open source no GitHub",
    desc: "Suba no seu GitHub, faça fork, modifique. Construído com Next.js, Prisma e shadcn/ui — stack moderna e documentada.",
  },
]

export function LandingView() {
  const { setView, setAuthMode } = useAppStore()

  const goLogin = () => {
    setAuthMode("login")
    setView("auth")
  }
  const goSignup = () => {
    setAuthMode("signup")
    setView("auth")
  }

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
              <p className="text-[10px] text-muted-foreground font-mono">v0.1.0 — open source</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={goLogin}
              className="font-mono"
            >
              Entrar
            </Button>
            <Button
              size="sm"
              onClick={goSignup}
              className="font-mono glow-primary"
            >
              Criar conta
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
            Plataforma de agentes pessoais — grátis e open source
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            Construa seu{" "}
            <span className="text-primary text-glow">Jarvis</span>{" "}
            particular
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Uma plataforma que transforma APIs gratuitas em ferramentas para um agente
            inteligente. Você cola suas chaves, ele faz o resto — fala, lembra, executa.
            Roda até num celular velho.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button
              size="lg"
              onClick={goSignup}
              className="font-mono text-base px-8 glow-primary"
            >
              Começar agora
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="font-mono text-base px-8"
            >
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="w-4 h-4 mr-2" />
                Ver no GitHub
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground font-mono pt-2">
            Stack: Next.js 16 · Prisma · shadcn/ui · OpenRouter · Web Speech API
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
            O que ele faz por você
          </h3>
          <p className="text-center text-muted-foreground mb-10">
            Features do MVP — e tem mais vindo aí.
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

      {/* Footer */}
      <footer className="mt-auto border-t border-border/40 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground font-mono">
          <p>AgentForge — feito com ☕ e Next.js</p>
          <p>MIT License · 2026</p>
        </div>
      </footer>
    </div>
  )
}
