<div align="center">

<img src="public/logo.svg" width="88" alt="Logo do AgentForge" />

# AgentForge

**Plataforma open source de agentes com IA — construa seu Jarvis particular.**

[![CI](https://github.com/lucasgabrieldevgg/agentforge/actions/workflows/ci.yml/badge.svg)](https://github.com/lucasgabrieldevgg/agentforge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.22.1-blue.svg)](package.json)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-indigo.svg)](https://www.prisma.io/)
[![Demo ao vivo](https://img.shields.io/badge/demo-online-10b981.svg)](https://agentforge-blue-zeta.vercel.app)

[Read in English](README.md)

</div>

## Sobre o projeto

O AgentForge transforma APIs gratuitas em ferramentas e skills para um agente inteligente. Você cola as suas próprias chaves de API (OpenRouter, etc.) e o agente faz o resto — conversa, pesquisa e executa. Roda até num celular velho.

A interface segue uma identidade de engenharia: tipografia IBM Plex Sans + IBM Plex Mono, paleta verde-Jarvis e textura de grid blueprint — nada de padrões de template.

**Demo ao vivo:** <https://agentforge-blue-zeta.vercel.app>

## Funcionalidades

- **Agente com IA** — chat com LLM via OpenRouter (modelos gratuitos disponíveis)
- **Skills com /comandos** — estilo Slack/Discord: `/translate`, `/summarize`, `/code`, `/explain`, `/joke` e mais
- **Ferramentas plug-and-play** — clima, calculadora, cotação de moedas, países, conversor de unidades, gerador de senhas (todas grátis, sem chave)
- **Execução de Python no navegador** — artifacts Python rodam client-side via Pyodide/WASM; mande a saída de volta pro agente para fechar o loop gerar → rodar → corrigir
- **Deep Research** — pesquisa aprofundada na Wikipédia multi-idioma (3 níveis: Quick / High / Max)
- **Modo Pensamento** — modelos com reasoning nativo (GPT-OSS, Nemotron Reasoning) são usados diretamente; para os demais, é injetado um chain-of-thought sintético
- **Multi-idioma** — responde no idioma do usuário (Auto) ou força um dos 8 idiomas, salvo por projeto
- **Benchmark harness** — rode uma bateria fixa de tarefas pelo motor real do agente e pontue modelos por escolha de ferramenta, correção da resposta e latência
- **Auto-save no workspace** — o código gerado é salvo automaticamente no workspace do projeto (upsert por nome), com preview de HTML e download
- **Tema dark estilo Jarvis** — verde esmeralda com efeitos de glow e grid

## Stack

| Camada | Tecnologia |
|----------------------|-------------------------------------------------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Linguagem | TypeScript 5 |
| Estilo | Tailwind CSS 4 + shadcn/ui (New York) |
| Banco de dados | Prisma ORM — SQLite em dev, Postgres/Supabase em prod |
| Estado | Zustand |
| LLM | OpenRouter (multi-modelo) |
| Telemetria (opcional) | Telegram Bot API |

## Primeiros passos

### Pré-requisitos

- Node.js 18+ ou Bun
- Uma chave gratuita da OpenRouter ([pegue aqui](https://openrouter.ai/keys))

### Instalação local

```bash
# 1. Clone o repositório
git clone https://github.com/lucasgabrieldevgg/agentforge.git
cd agentforge

# 2. Instale as dependências
bun install
# ou: npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env e adicione sua chave OpenRouter (opcional — dá para fazer pela UI também)

# 4. Prepare o banco de dados (SQLite local)
bun run db:push

# 5. Rode o servidor de desenvolvimento
bun run dev
```

Acesse <http://localhost:3000>. Dica: configure `DEMO_MODE=false` no `.env` para remover o limite de 80 linhas da demo e gerar código maior, sem limite de tempo.

### Rodar com Docker (sem limites)

```bash
docker compose up --build
```

Abra <http://localhost:3000> — só isso. O container sobe com `DEMO_MODE=false` automático: sem limite de 60s, sem teto de linhas de código, thinking e deep research Max completos, e o agente narrando cada passo enquanto trabalha. O banco SQLite fica num volume do Docker, então seus projetos sobrevivem a restarts.

## Configuração

### Variáveis de ambiente

Copie `.env.example` para `.env` e configure:

| Variável | Obrigatória | Descrição |
|-----------------------|--------------------|-------------|
| `DATABASE_URL` | Sim | String de conexão do banco (SQLite local ou Postgres/Supabase em prod) |
| `DIRECT_DATABASE_URL` | Só em prod com Supabase | URI do session pooler, usada para migrations |
| `TELEGRAM_BOT_TOKEN` | Não | Token do bot do Telegram para telemetria opcional |
| `TELEGRAM_CHAT_ID` | Não | Chat ID para envio da telemetria |
| `CRON_SECRET` | Não | Secret que protege o endpoint `/api/cron/daily` |
| `DEMO_MODE` | Não | `true` por padrão — mantém o código gerado curto para caber no limite de 60s do Vercel Hobby. Use `false` ao hospedar por conta própria para liberar o teto e elevar o `max_tokens` |

### Chaves de API do usuário

As chaves de API (OpenRouter, etc.) são configuradas **pela UI**, na aba "API Keys". Elas ficam salvas no banco de dados; cada usuário cola as suas.

O tutorial completo de como obter uma chave OpenRouter está dentro da aba API Keys, no próprio app.

## Como usar

### Chat básico

1. Vá para a aba **Agente**
2. Digite uma mensagem e tecle Enter
3. O agente responde usando o modelo selecionado

### Skills (comandos /)

Ative skills na aba **Skills** e use no chat:

```
/translate text="hello world" to=pt
/summarize [cole um texto longo]
/code write python "fibonacci sequence"
/explain quantum entanglement level=expert
/joke
/uuid count=5
```

Skills com o selo **AUTO** também podem ser invocadas automaticamente pela IA, quando relevante.

### Ferramentas

Ative ferramentas na aba **Ferramentas**. O agente as usa automaticamente quando precisa:

- **Data & Hora** — sabe a hora atual
- **Calculadora** — faz as contas
- **Wikipédia multi-idioma** — busca conhecimento (PT/EN/ES/FR/DE/JA/ZH)
- **Deep Research** — pesquisa aprofundada (3 níveis)
- **Previsão do tempo** (Open-Meteo, sem chave)
- **Cotação de moedas** (Frankfurter, sem chave)
- **Dados de países** (REST Countries, sem chave)
- **Conversor de unidades** (temperatura, comprimento, peso, etc.)
- **Gerador de senhas** (criptograficamente seguro)

### Idioma

Um seletor de idioma fica ao lado dos seletores Think e Deep Research, na barra do chat. Escolha **Auto** (padrão) e o agente responde no idioma em que você escrever, ou force um dos 8 idiomas (PT-BR, EN, ES, FR, DE, IT, JA, ZH). A escolha fica salva por projeto.

### Modo Pensamento

- Ative "Thinking ON" no chat
- Modelos com reasoning nativo (GPT-OSS, Nemotron Reasoning): usados diretamente
- Outros modelos: um prompt de chain-of-thought é injetado

## Deploy na Vercel

### Opção 1: CLI

```bash
npm i -g vercel
vercel login
vercel link
vercel --prod
```

### Opção 2: Dashboard

1. Faça fork deste repositório
2. Acesse <https://vercel.com/new>
3. Importe o repositório
4. Configure as variáveis de ambiente
5. Deploy

### Banco de dados em produção

Para produção, use **Supabase** (free tier de 500 MB):

1. Crie uma conta em <https://supabase.com>
2. Crie um novo projeto
3. Vá em Settings → Database → Connection string → URI
4. Configure na Vercel:
   - `DATABASE_URL` = URI do transaction pooler (porta 6543, com `?pgbouncer=true`)
   - `DIRECT_DATABASE_URL` = URI do session pooler (porta 5432)
5. Rode `bunx prisma db push --schema=prisma/schema.prod.prisma` localmente, com `DIRECT_DATABASE_URL` apontando para o Supabase

Um guia completo de deploy passo a passo está disponível em [docs/DEPLOY-SUPABASE.md](docs/DEPLOY-SUPABASE.md).

## Modo demo

Este repositório é distribuído em **modo demo**: um único usuário demo compartilhado, sem tela de login. Qualquer visitante do seu deploy compartilha as configurações e as chaves desse usuário — use de forma pessoal ou atrás da sua própria autenticação.

A demo também roda contra o limite de 60 segundos de função do Vercel Hobby. Um **gerenciador de orçamento de tempo** planeja cada resposta contra um deadline de 55s: ferramentas são descartadas quando o tempo aperta, o `max_tokens` escala com o tempo restante, os níveis Max de thinking/research viram High e, se uma geração ainda assim não terminar, o que já foi transmitido é entregue com a nota "encurtada pelo limite da demo", em vez de um corte seco. Configure `DEMO_MODE=false` para desativar tudo isso — instâncias self-hosted não têm limites e ganham narração passo a passo transparente do agente.

## Estrutura do projeto

```
agentforge/
├── prisma/
│   ├── schema.prisma          # Schema SQLite (dev)
│   └── schema.prod.prisma     # Schema Postgres (prod)
├── public/
│   └── logo.svg               # Logo do projeto
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── conversations/ # Histórico de conversas
│   │   │   ├── cron/daily/    # Cron job diário
│   │   │   ├── integrations/  # Toggle de ferramentas
│   │   │   ├── keys/          # API keys do usuário
│   │   │   ├── settings/      # Preferências (modelo, nível de deep research)
│   │   │   └── skills/        # Toggle de skills
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── agentforge/
│   │   │   ├── tabs/          # Tabs do dashboard
│   │   │   ├── agent-forge.tsx
│   │   │   ├── dashboard.tsx
│   │   │   └── landing-view.tsx
│   │   └── ui/                # Componentes shadcn/ui
│   ├── lib/
│   │   ├── agent/
│   │   │   └── engine.ts      # Orquestração LLM + tools + skills + thinking
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
│   │   └── use-toast.ts
│   └── stores/
│       └── app-store.ts       # Zustand
├── docs/
│   └── DEPLOY-SUPABASE.md     # Guia de deploy em produção passo a passo
├── scripts/
│   └── vercel-build.sh        # Script de build da Vercel
├── vercel.json                # Config da Vercel (cron jobs)
└── .env.example
```

## Desenvolvimento e CI

```
bun install && bunx prisma generate && bun run lint && bun run build
```

O CI roda o pipeline completo a cada push (lockfile congelado → cliente Prisma → ESLint → build do Next como smoke test real, além de uma etapa de higiene contra segredos).

## Contribuindo

Contribuições são bem-vindas! Abra uma issue ou um pull request.

## Licença

Distribuído sob a Licença MIT — veja [LICENSE](LICENSE).

## Agradecimentos

- [OpenRouter](https://openrouter.ai/) — acesso a múltiplos LLMs
- [Open-Meteo](https://open-meteo.com/) — clima gratuito sem chave
- [Frankfurter](https://frankfurter.app/) — cotação de moedas gratuita
- [REST Countries](https://restcountries.com/) — dados de países
- [Wikipedia](https://www.wikipedia.org/) — conhecimento livre
- [shadcn/ui](https://ui.shadcn.com/) — biblioteca de componentes
- [Vercel](https://vercel.com/) — hospedagem
- [Supabase](https://supabase.com/) — banco de dados
