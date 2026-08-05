"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useAppStore } from "@/stores/app-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Bot, ArrowLeft, Loader2, Mail, Lock, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function AuthView() {
  const { authMode, setAuthMode, setView } = useAppStore()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: "", password: "", name: "" })
  const [waitlistReason, setWaitlistReason] = useState<string | null>(null)

  const isSignup = authMode === "signup"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setWaitlistReason(null)
    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: form.email,
        password: form.password,
        name: form.name,
        mode: authMode,
      })
      if (res?.error) {
        // NextAuth wraps thrown errors as "CredentialsSignin" — but the message we threw
        // (including our `WAITLIST:` prefix) comes through. Detect that and redirect.
        // Unfortunately NextAuth strips custom messages. We need to check via a side-channel:
        // re-fetch capacity to see if waitlist is in effect.
        if (isSignup) {
          // Check capacity to see if this was a waitlist rejection
          try {
            const capRes = await fetch("/api/capacity")
            const capData = await capRes.json()
            if (!capData.canSignup) {
              setWaitlistReason(capData.reason || "Capacidade cheia")
              toast({
                title: "Capacidade cheia",
                description: "Direcionando para a lista de espera...",
                variant: "destructive",
              })
              // Slight delay so user sees the toast
              setTimeout(() => setView("waitlist" as any), 1500)
              return
            }
          } catch {
            // ignore
          }
        }
        toast({
          title: "Erro",
          description:
            res.error === "CredentialsSignin"
              ? "Credenciais inválidas"
              : res.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: isSignup ? "Conta criada!" : "Bem-vindo de volta!",
          description: isSignup ? "Sua conta está pronta." : "Login realizado.",
        })
        setView("dashboard")
      }
    } catch (e) {
      toast({
        title: "Erro inesperado",
        description: (e as Error).message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 jarvis-grid">
      <button
        onClick={() => setView("landing")}
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto glow-primary">
            <Bot className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-mono">
            {isSignup ? "Criar sua conta" : "Entrar no AgentForge"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSignup
              ? "Sua chave do reino. Grátis, sempre."
              : "Bem-vindo de volta, chefe."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <div className="space-y-2">
              <Label htmlFor="name">Nome (opcional)</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Como devo te chamar?"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="pl-10 font-mono"
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                required
                placeholder="voce@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="pl-10 font-mono"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="pl-10 font-mono"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full font-mono glow-primary"
            size="lg"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isSignup ? "Criar conta" : "Entrar"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          {isSignup ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
          <button
            onClick={() => setAuthMode(isSignup ? "login" : "signup")}
            className="text-primary hover:underline font-mono"
          >
            {isSignup ? "Entrar" : "Criar agora"}
          </button>
        </div>
      </div>
    </div>
  )
}
