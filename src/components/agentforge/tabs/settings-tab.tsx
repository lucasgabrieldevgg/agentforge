"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSession, signOut } from "next-auth/react"
import {
  User,
  Bell,
  Globe,
  Clock,
  Github,
  LogOut,
  Code2,
  Server,
  BookOpen,
} from "lucide-react"

export function SettingsTab() {
  const { data: session } = useSession()
  const user = session?.user

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground text-sm">
          Configurações da sua conta e do agente.
        </p>
      </div>

      {/* Account */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Conta</h3>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Nome</span>
            <span className="font-mono">{user?.name || "—"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Email</span>
            <span className="font-mono">{user?.email}</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-destructive hover:text-destructive"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair da conta
        </Button>
      </Card>

      {/* Agente */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Agente</h3>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Modelo LLM</p>
              <p className="text-xs text-muted-foreground">
                Padrão: google/gemini-2.0-flash-exp:free
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              OpenRouter
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Idioma</p>
              <p className="text-xs text-muted-foreground">Português (Brasil)</p>
            </div>
            <Globe className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Fuso horário</p>
              <p className="text-xs text-muted-foreground">America/Cuiaba (BRT)</p>
            </div>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </Card>

      {/* Stack técnica */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Stack técnica</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          {[
            ["Frontend", "Next.js 16"],
            ["Styling", "Tailwind 4 + shadcn/ui"],
            ["Auth", "NextAuth.js"],
            ["DB", "Prisma (SQLite dev / Supabase prod)"],
            ["LLM", "OpenRouter (multi-model)"],
            ["Voz", "Web Speech API"],
            ["Cron", "Vercel Cron"],
            ["License", "MIT"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="p-2 rounded border border-border/40 bg-secondary/20"
            >
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
                {k}
              </p>
              <p className="text-foreground">{v}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Notificações placeholder */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Próximos passos (roadmap)</h3>
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span>
              <strong>Wake word</strong> — ativar microfone por palavra-chave
              (&ldquo;Jarvis&hellip;&rdquo;).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span>
              <strong>Gmail real</strong> — OAuth2 do Google pra enviar/ler emails.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span>
              <strong>WhatsApp</strong> — integração com Twilio ou WhatsApp Business API.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span>
              <strong>Modo thinking</strong> — chain-of-thought antes da resposta final.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span>
              <strong>Deploy</strong> — guia de subir na Vercel + Supabase.
            </span>
          </li>
        </ul>
      </Card>

      {/* Links */}
      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Recursos</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" asChild className="font-mono text-xs">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              <Github className="w-3.5 h-3.5 mr-1" />
              Código-fonte
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild className="font-mono text-xs">
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
              Pegar chave OpenRouter
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild className="font-mono text-xs">
            <a
              href="https://openweathermap.org/api"
              target="_blank"
              rel="noopener noreferrer"
            >
              Pegar chave OpenWeather
            </a>
          </Button>
        </div>
      </Card>

      <p className="text-center text-xs text-muted-foreground font-mono pt-4">
        AgentForge v0.1.0 — feito com ☕ e Next.js · MIT License
      </p>
    </div>
  )
}
