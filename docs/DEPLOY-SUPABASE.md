# 🚀 Deploy do AgentForge — Passo a Passo

## ✅ O que já está pronto
- Site publicado: https://agentforge-blue-zeta.vercel.app
- Cron de meia-noite configurado: `/api/cron/daily`
- Env vars já setadas na Vercel: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `CRON_SECRET`

## ❌ O que falta (15 minutos)
Conectar o banco de dados. Sem isso, login/signup não funcionam.

---

## Passo 1 — Criar conta no Supabase (2 min)
1. Acesse: https://supabase.com/
2. Clique em "Start your project" e faça login com GitHub
3. Clique em "New Project"
4. Preencha:
   - **Name:** AgentForge
   - **Database Password:** gere uma senha forte (anote!)
   - **Region:** South America (São Paulo)
   - **Plan:** Free
5. Clique "Create new project" e espere ~2 min

---

## Passo 2 — Pegar a string de conexão (1 min)
1. No painel do Supabase, vá em **Project Settings** (engrenagem no canto inferior esquerdo)
2. Clique em **Database**
3. Role até **Connection string** → selecione **URI**
4. Copie a URI. Vai parecer com:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxx.supabase.co:5432/postgres
   ```
5. Substitua `[YOUR-PASSWORD]` pela senha que você criou no passo 1

---

## Passo 3 — Adicionar DATABASE_URL na Vercel (3 min)
1. Acesse: https://vercel.com/lukepalys-projects/agentforge/settings/environment-variables
2. Clique em "Add New"
3. Preencha:
   - **Key:** `DATABASE_URL`
   - **Value:** cole a URI do Supabase (com a senha preenchida)
   - **Environment:** marque **Production**, **Preview** e **Development**
4. Repita pra outra variável:
   - **Key:** `DIRECT_DATABASE_URL`
   - **Value:** mesma URI do passo acima
   - **Environments:** todas as 3
5. Clique em "Save"

---

## Passo 4 — Re-deploy (2 min)
1. Acesse: https://vercel.com/lukepalys-projects/agentforge/deployments
2. Clique nos 3 pontinhos (⋯) do deploy mais recente
3. Clique em **Redeploy**
4. Marque "Use existing Build Cache" → DESLIGADO
5. Clique em **Redeploy**
6. Espere ~1 minuto até o status ficar "Ready"

---

## Passo 5 — Testar (2 min)
1. Acesse: https://agentforge-blue-zeta.vercel.app
2. Clique em **Criar conta**
3. Preencha email + senha
4. Deve logar e mostrar o dashboard
5. Vá em **API Keys** e cole sua chave do OpenRouter (pegue em https://openrouter.ai/keys)
6. Volte no **Agente** e teste uma mensagem!

---

## 🚨 IMPORTANTE: Rotate o token da Vercel
O token `vcp_2kM12...` foi compartilhado no chat e está comprometido.
1. Vá em: https://vercel.com/account/tokens
2. Delete ele
3. Crie um novo se precisar usar a CLI novamente
4. **Nunca** cole tokens em chats

---

## 🔧 Comandos úteis (se quiser editar o código depois)

```bash
# Rodar localmente
cd /home/z/my-project
bun run dev

# Re-deploy via CLI
vercel --prod --token="SEU_NOVO_TOKEN"

# Ver logs do cron
# https://vercel.com/lukepalys-projects/agentforge/crons
```

## 📌 URLs importantes
- **Site:** https://agentforge-blue-zeta.vercel.app
- **Painel Vercel:** https://vercel.com/lukepalys-projects/agentforge
- **Logs:** https://vercel.com/lukepalys-projects/agentforge/logs
- **Cron jobs:** https://vercel.com/lukepalys-projects/agentforge/crons
- **Env vars:** https://vercel.com/lukepalys-projects/agentforge/settings/environment-variables

## 🎯 Próximos passos recomendados
1. Configure o banco (passos acima) ← prioridade
2. Suba o código no GitHub e conecte à Vercel pra auto-deploy em cada push
3. Implementar wake word "Jarvis" (já temos a base de voz)
4. Integração real do Gmail (OAuth2)
5. Twilio WhatsApp
