# AgentForge

> Open-source AI agent platform — build your personal Jarvis.

> **Live demo:** https://agentforge-blue-zeta.vercel.app

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-indigo.svg)](https://www.prisma.io/)

[Leia em Português](README.pt-BR.md)

AgentForge turns free APIs into tools and skills for a smart agent. You paste your own API keys (OpenRouter, etc.) and the agent does the rest — it talks, researches and executes. It even runs on an old phone.

## ✨ Features

- 🤖 **AI agent** — LLM chat via OpenRouter (free models available)
- 🌍 **Multilingual** — reply in the user's language (Auto) or force one of 8 languages
- 🐍 **In-browser Python execution** — Python artifacts run client-side via Pyodide/WASM; send the output back to the agent to close the generate → run → fix loop
- 📊 **Benchmark harness** — run a fixed battery of tasks through the real agent engine and score models on tool choice, answer correctness and latency
- 📄 **Auto-save to workspace** — generated code is saved to the project workspace automatically (upsert by filename), with HTML preview and download
- 🧠 **Thinking mode** — supports models with native reasoning (GPT-OSS, Nemotron Reasoning) + synthetic chain-of-thought for the rest
- 🔬 **Deep Research** — in-depth multilingual Wikipedia research (3 levels: Quick / High / Max)
- ✨ **Skills with /commands** — Slack/Discord style: `/translate`, `/summarize`, `/code`, `/explain`, `/joke` and more
- 🔧 **Plug-and-play tools** — weather, calculator, exchange rates, countries, unit converter, password generator (all free, no key)
- 🎨 **Jarvis-style dark theme** — emerald green with glow and grid effects

## 🚀 Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4 + shadcn/ui (New York)
- **Database:** Prisma ORM (SQLite in dev, Postgres/Supabase in prod)
- **State:** Zustand
- **LLM:** OpenRouter (multi-model)
- **Telemetry (optional):** Telegram Bot API

## 📦 Local installation

### Prerequisites

- Node.js 18+ or Bun
- A free OpenRouter key ([get one here](https://openrouter.ai/keys))

### Step by step

```bash
# 1. Clone the repository
git clone https://github.com/lucasgabrieldevgg/agentforge.git
cd agentforge

# 2. Install dependencies
bun install
# or: npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env and add your OpenRouter key (optional — you can also do it in the UI)

# 4. Set up the database (local SQLite)
bun run db:push

# 5. Run the development server
bun run dev
```

Open http://localhost:3000. Tip: set `DEMO_MODE=false` in `.env` to remove the demo's 80-line code cap and generate longer code with no time limit.

## 🐳 Run with Docker (no limits)

```bash
docker compose up --build
```

Open http://localhost:3000 — that's it. The container runs with `DEMO_MODE=false`
automatically: no 60s limit, no code-length caps, full Max thinking/deep
research, and the agent narrates each step while it works. The SQLite database
lives in a Docker volume, so your projects survive restarts.



## 🔑 Configuration

### Environment variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Database connection string (local SQLite or Postgres/Supabase in prod) |
| `DIRECT_DATABASE_URL` | ⚠️ | Prod with Supabase only (session pooler for migrations) |
| `TELEGRAM_BOT_TOKEN` | ❌ | Telegram bot token for telemetry (optional) |
| `TELEGRAM_CHAT_ID` | ❌ | Chat ID to send telemetry to (optional) |
| `CRON_SECRET` | ❌ | Secret to protect the `/api/cron/daily` endpoint |
| `DEMO_MODE` | ❌ | `true` by default — keeps generated code short so responses fit Vercel Hobby's 60s limit. Set to `false` when self-hosting to lift the cap and raise `max_tokens` |

### User API keys

API keys (OpenRouter, etc.) are configured **through the UI** in the "API Keys" tab. They are stored in the database. Each user pastes their own.

**A full tutorial on how to get an OpenRouter key** is available inside the API Keys tab in the app itself.

## 🎯 How to use

### Basic chat

1. Go to the **Agent** tab
2. Type a message and hit Enter
3. The agent replies using the selected model

### Skills (/ commands)

Enable skills in the **Skills** tab, then use them in chat:

```
/translate text="hello world" to=pt
/summarize [paste a long text]
/code write python "fibonacci sequence"
/explain quantum entanglement level=expert
/joke
/uuid count=5
```

Skills with the **AUTO** badge can also be invoked automatically by the AI when relevant.

### Tools

Enable tools in the **Tools** tab. The agent uses them automatically when needed:

- **Date & Time** — knows the current time
- **Calculator** — does the math
- **Multilingual Wikipedia** — fetches knowledge (PT/EN/ES/FR/DE/JA/ZH)
- **Deep Research** — in-depth research (3 levels)
- **Weather forecast** (Open-Meteo, no key)
- **Exchange rates** (Frankfurter, no key)
- **Country data** (REST Countries, no key)
- **Unit converter** (temperature, length, weight, etc.)
- **Password generator** (crypto-secure)

### Language

A language selector sits next to the Think and Deep Research selectors in the chat toolbar.
Pick **Auto** (default) and the agent replies in whatever language you write in, or force
one of 8 languages (EN, PT-BR, ES, FR, DE, IT, JA, ZH). The choice is saved per project.

### Thinking mode

- Toggle "Thinking ON" in chat
- Models with native reasoning (GPT-OSS, Nemotron Reasoning): used directly
- Other models: a chain-of-thought prompt is injected

## 🚀 Deploy to Vercel

### Option 1: CLI

```bash
npm i -g vercel
vercel login
vercel link
vercel --prod
```

### Option 2: Dashboard

1. Fork this repository
2. Go to https://vercel.com/new
3. Import the repository
4. Configure the environment variables
5. Deploy

### Production database

For production, use **Supabase** (500MB free tier):

1. Create an account at https://supabase.com
2. Create a new project
3. Go to Settings → Database → Connection string → URI
4. Configure in Vercel:
   - `DATABASE_URL` = transaction pooler URI (port 6543, with `?pgbouncer=true`)
   - `DIRECT_DATABASE_URL` = session pooler URI (port 5432)
5. Run `bunx prisma db push --schema=prisma/schema.prod.prisma` locally with `DIRECT_DATABASE_URL` pointing to Supabase

## ⚠️ Demo mode

This repository ships in **demo mode**: a single shared demo user with no login screen. Anyone visiting your deployment shares that user's settings and API keys — deploy it for personal use or behind your own auth.

The demo also runs against Vercel Hobby's 60-second function limit. A built-in **time budget manager** plans each answer against a 55s deadline: tools are dropped when time runs low, `max_tokens` scales to the time left, Max thinking/research levels are clamped to High, and if a generation still can't finish, whatever streamed is delivered with a "shortened by the demo limit" note instead of a hard cutoff. Set `DEMO_MODE=false` to disable all of it — self-hosted instances have no limits and get transparent step-by-step narration from the agent.

## 📁 Project structure

```
agentforge/
├── prisma/
│   ├── schema.prisma          # SQLite schema (dev)
│   └── schema.prod.prisma     # Postgres schema (prod)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   │   ├── conversations/ # Conversation history
│   │   │   ├── cron/daily/    # Daily cron job
│   │   │   ├── integrations/  # Tool toggles
│   │   │   ├── keys/          # User API keys
│   │   │   ├── settings/      # Preferences (model, deep research level)
│   │   │   └── skills/        # Skill toggles
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── agentforge/
│   │   │   ├── tabs/          # Dashboard tabs
│   │   │   ├── agent-forge.tsx
│   │   │   ├── dashboard.tsx
│   │   │   └── landing-view.tsx
│   │   └── ui/                # shadcn/ui components
│   ├── lib/
│   │   ├── agent/
│   │   │   └── engine.ts      # LLM + tools + skills + thinking orchestration
│   │   ├── skills/
│   │   │   ├── registry.ts    # Skill catalog
│   │   │   └── executor.ts    # Skill executors
│   │   ├── tools/
│   │   │   ├── registry.ts    # Tool catalog
│   │   │   └── executor.ts    # Tool executors
│   │   ├── activity.ts
│   │   ├── demo-user.ts       # Demo user (no auth)
│   │   ├── models.ts          # OpenRouter model catalog
│   │   ├── telemetry.ts       # Optional telemetry (Telegram)
│   │   └── db.ts
│   ├── hooks/
│   │   └── use-toast.ts
│   └── stores/
│       └── app-store.ts       # Zustand
├── scripts/
│   └── vercel-build.sh        # Vercel build script
├── vercel.json                # Vercel config (cron jobs)
└── .env.example
```

## 🤝 Contributing

Contributions are welcome! Open an issue or a PR.

## 📝 License

MIT — see [LICENSE](LICENSE).

## 🙏 Acknowledgements

- [OpenRouter](https://openrouter.ai/) — access to multiple LLMs
- [Open-Meteo](https://open-meteo.com/) — free weather without a key
- [Frankfurter](https://frankfurter.app/) — free exchange rates
- [REST Countries](https://restcountries.com/) — country data
- [Wikipedia](https://www.wikipedia.org/) — free knowledge
- [shadcn/ui](https://ui.shadcn.com/) — beautiful components
- [Vercel](https://vercel.com/) — free hosting
- [Supabase](https://supabase.com/) — free database
