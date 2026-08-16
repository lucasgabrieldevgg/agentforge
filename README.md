# AgentForge

> Open-source AI agent platform — build your personal Jarvis. Chat, voice, deep research, skills and tools, all in one app. Bring your own OpenRouter key.

**Live demo:** https://agentforge-blue-zeta.vercel.app · **License:** MIT

## ✨ Features

- 🤖 **Multi-model chat** via OpenRouter (GPT, Gemini, DeepSeek, Llama, free models and more)
- 🗣️ **Native voice** — speech-to-text and text-to-speech using the browser Web Speech API (no extra API key)
- 🧠 **Thinking mode** — reasoning models show their thought process (GPT-OSS, Nemotron) plus synthetic chain-of-thought
- 🔎 **Deep research** — multilingual Wikipedia research with 3 intensity levels
- ⚡ **Skills** — slash commands like `/translate`, `/summarize`, `/code`, `/joke`
- 🛠️ **Free built-in tools** — weather (Open-Meteo), exchange rates (Frankfurter), country data, calculator, unit converter, password generator
- 🗂️ **Workspace** — conversations, projects, memory and integrations tabs
- 🔑 **BYOK** — paste your own OpenRouter key in the UI (stored per user, masked on read)

## 🚀 Stack

Next.js (App Router) · TypeScript · Tailwind CSS + shadcn/ui · Prisma (SQLite in dev, Postgres/Supabase in prod) · Zustand · OpenRouter · Web Speech API

## 📦 Quick start

```bash
git clone https://github.com/lucasgabrieldevgg/agentforge.git
cd agentforge
bun install          # or npm install
cp .env.example .env # set DATABASE_URL
bunx prisma db push
bun run dev
```

Open http://localhost:3000, go to **Keys** and paste your OpenRouter key (get one at openrouter.ai/keys). Production deploys on Vercel with Supabase — see the deploy notes in `download/DEPLOY-SUPABASE.md`.

## ⚠️ Demo mode

This repository ships in **demo mode**: a single shared demo user with no login screen. Anyone visiting your deployment shares that user's settings and API keys — deploy it for personal use or behind your own auth.

---

# 🇧🇷 Português (original)

# AgentForge

> Plataforma open source de agentes com IA — construa seu Jarvis particular.
>
> **Demo ao vivo:** https://agentforge-blue-zeta.vercel.app

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-indigo.svg)](https://www.prisma.io/)

AgentForge é uma plataforma que transforma APIs gratuitas em ferramentas e skills para um agente inteligente. Você cola suas próprias chaves de API (OpenRouter, etc), o agente faz o resto — fala, pesquisa, executa. Roda até num celular velho.

## ✨ Features

- 🤖 **Agente com IA** — chat com LLM via OpenRouter (modelos gratuitos disponíveis)
- 🎙️ **Voz nativa** — Web Speech API para STT e TTS (sem custo, sem API key)
- 🧠 **Modo Pensamento** — suporta modelos com reasoning nativo (GPT-OSS, Nemotron Reasoning) + CoT sintético para os demais
- 🔬 **Deep Research** — pesquisa aprofundada na Wikipedia multi-idioma (3 níveis: Quick / High / Max)
- ✨ **Skills com /comandos** — estilo Slack/Discord: `/translate`, `/summarize`, `/code`, `/explain`, `/joke` e mais
- 🔧 **Ferramentas plug-and-play** — clima, calculadora, cotação de moedas, países, conversor de unidades, gerador de senhas (todas grátis, sem chave)
- 🎨 **Tema dark estilo Jarvis** — verde esmeralda com efeitos de glow e grid

## 🚀 Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Linguagem:** TypeScript 5
- **Styling:** Tailwind CSS 4 + shadcn/ui (New York)
- **Database:** Prisma ORM (SQLite em dev, Postgres/Supabase em prod)
- **State:** Zustand
- **LLM:** OpenRouter (multi-modelo)
- **Voz:** Web Speech API (nativa do navegador)
- **Telemetria (opcional):** Telegram Bot API

## 📦 Instalação local

### Pré-requisitos

- Node.js 18+ ou Bun
- Uma chave gratuita da OpenRouter ([pegue aqui](https://openrouter.ai/keys))

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/lucasgabrieldevgg/agentforge.git
cd agentforge

# 2. Instale as dependências
bun install
# ou: npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env e adicione sua chave OpenRouter (opcional — pode fazer pelo UI também)

# 4. Configure o banco de dados (SQLite local)
bun run db:push

# 5. Rode o servidor de desenvolvimento
bun run dev
```

Acesse http://localhost:3000

## 🔑 Configuração

### Variáveis de ambiente

Copie `.env.example` para `.env` e configure:

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | ✅ | String de conexão do banco (SQLite local ou Postgres/Supabase em prod) |
| `DIRECT_DATABASE_URL` | ⚠️ | Apenas em prod com Supabase (session pooler para migrations) |
| `TELEGRAM_BOT_TOKEN` | ❌ | Token do bot do Telegram para telemetria (opcional) |
| `TELEGRAM_CHAT_ID` | ❌ | Chat ID para enviar telemetria (opcional) |
| `CRON_SECRET` | ❌ | Secret para proteger o endpoint `/api/cron/daily` |

### Chaves de API do usuário

As chaves de API (OpenRouter, etc) são configuradas **pelo UI** na aba "API Keys". Elas ficam salvas no banco de dados. Cada usuário cola as suas.

**Tutorial completo de como obter a chave OpenRouter** está dentro da aba API Keys no próprio app.

## 🎯 Como usar

### Chat básico

1. Vá na aba **Agente**
2. Digite uma mensagem e tecle Enter
3. O agente responde usando o modelo selecionado

### Skills (comandos /)

Ative skills na aba **Skills**, depois use no chat:

```
/translate text="hello world" to=pt
/summarize [cole um texto longo]
/code write python "fibonacci sequence"
/explain quantum entanglement level=expert
/joke
/uuid count=5
```

Skills com badge **AUTO** também podem ser invocadas automaticamente pela IA quando relevante.

### Ferramentas

Ative ferramentas na aba **Ferramentas**. O agente as usa automaticamente quando precisa:

- **Data & Hora** — sabe a hora atual
- **Calculadora** — faz contas
- **Wikipedia Multi-idioma** — busca conhecimento (PT/EN/ES/FR/DE/JA/ZH)
- **Deep Research** — pesquisa aprofundada (3 níveis)
- **Previsão do Tempo** (Open-Meteo, sem chave)
- **Cotação de Moedas** (Frankfurter, sem chave)
- **Dados de Países** (REST Countries, sem chave)
- **Conversor de Unidades** (temperatura, comprimento, peso, etc)
- **Gerador de Senhas** (cripto seguro)

### Voz

- Clique no 🎤 para falar (Chrome/Edge recomendado)
- Ative "Modo voz" para escuta contínua
- TTS (text-to-speech) ligado por padrão

### Modo Pensamento

- Ative "Thinking ON" no chat
- Para modelos com reasoning nativo (GPT-OSS, Nemotron Reasoning): usa direto
- Para outros modelos: injeta prompt de chain-of-thought

## 🚀 Deploy na Vercel

### Opção 1: CLI

```bash
npm i -g vercel
vercel login
vercel link
vercel --prod
```

### Opção 2: Dashboard

1. Faça fork deste repositório
2. Acesse https://vercel.com/new
3. Importe o repositório
4. Configure as variáveis de ambiente
5. Deploy

### Banco de dados em produção

Para produção, use **Supabase** (free tier 500MB):

1. Crie conta em https://supabase.com
2. Crie um novo projeto
3. Vá em Settings → Database → Connection string → URI
4. Configure no Vercel:
   - `DATABASE_URL` = URI do transaction pooler (porta 6543, com `?pgbouncer=true`)
   - `DIRECT_DATABASE_URL` = URI do session pooler (porta 5432)
5. Rode `bunx prisma db push --schema=prisma/schema.prod.prisma` localmente com `DIRECT_DATABASE_URL` apontando pro Supabase

## 📁 Estrutura do projeto

```
agentforge/
├── prisma/
│   ├── schema.prisma          # Schema SQLite (dev)
│   └── schema.prod.prisma     # Schema Postgres (prod)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agent/chat/    # Endpoint do agente (LLM + tools + skills)
│   │   │   ├── conversations/ # Histórico de conversas
│   │   │   ├── cron/daily/    # Cron job diário
│   │   │   ├── integrations/  # Toggle de ferramentas
│   │   │   ├── keys/          # API keys do usuário
│   │   │   ├── settings/      # Preferências (modelo, deep research level)
│   │   │   └── skills/        # Toggle de skills
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── agentforge/
│   │   │   ├── tabs/          # Tabs do dashboard
│   │   │   ├── agent-forge.tsx
│   │   │   ├── dashboard.tsx
│   │   │   └── landing-view.tsx
│   │   └── ui/                # shadcn/ui components
│   ├── lib/
│   │   ├── agent/
│   │   │   └── engine.ts      # Orquestração do LLM + tools + skills + thinking
│   │   ├── skills/
│   │   │   ├── registry.ts    # Catálogo de skills
│   │   │   └── executor.ts    # Executores de skills
│   │   ├── tools/
│   │   │   ├── registry.ts    # Catálogo de ferramentas
│   │   │   └── executor.ts    # Executores de ferramentas
│   │   ├── activity.ts
│   │   ├── demo-user.ts       # Usuário demo (sem auth)
│   │   ├── models.ts          # Catálogo de modelos OpenRouter
│   │   ├── telemetry.ts       # Telemetria opcional (Telegram)
│   │   └── db.ts
│   ├── hooks/
│   │   ├── use-speech.ts      # Web Speech API (STT + TTS)
│   │   └── use-toast.ts
│   └── stores/
│       └── app-store.ts       # Zustand
├── scripts/
│   └── vercel-build.sh        # Script de build da Vercel
├── vercel.json                # Config da Vercel (cron jobs)
└── .env.example
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Abra uma issue ou PR.

## 📝 License

MIT — veja [LICENSE](LICENSE).

## 🙏 Agradecimentos

- [OpenRouter](https://openrouter.ai/) — acesso a múltiplos LLMs
- [Open-Meteo](https://open-meteo.com/) — clima gratuito sem chave
- [Frankfurter](https://frankfurter.app/) — cotação de moedas gratuita
- [REST Countries](https://restcountries.com/) — dados de países
- [Wikipedia](https://www.wikipedia.org/) — conhecimento livre
- [shadcn/ui](https://ui.shadcn.com/) — componentes lindos
- [Vercel](https://vercel.com/) — hospedagem gratuita
- [Supabase](https://supabase.com/) — banco gratuito
