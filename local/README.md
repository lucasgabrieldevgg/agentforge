# AgentForge Local v0.1.0 — AppImage

> O agente de IA que roda **no seu PC** e executa ferramentas de verdade: cria arquivos, roda comandos no terminal, usa git — com operação contínua (detecta parada e retoma sozinho até a IA declarar conclusão).

## O que é

Primeira entrega testável da versão local do AgentForge (`feat/local-v0.1-appimage`). Um binário único (daemon Bun) que serve a UI em `localhost` e executa as tools localmente na sua máquina.

## Como usar (Linux x86_64 — Mint 20.04+)

```bash
chmod +x AgentForge-Local-v0.1.0-x86_64.AppImage
./AgentForge-Local-v0.1.0-x86_64.AppImage
```

1. O app abre `http://localhost:3174` no navegador (porta automática se ocupada)
2. Clique no ⚙ e cole sua chave **gratuita** da OpenRouter ([openrouter.ai/keys](https://openrouter.ai/keys))
3. Peça um trabalho: *"Crie notas.md com 3 ideias e commita com git"*

Se o AppImage não abrir (sem FUSE): `./AgentForge-Local-v*.AppImage --appimage-extract-and-run`

## O que já funciona (v0.1)

| Recurso | Status |
|---|---|
| **Tools locais reais** | `fs_write` / `fs_read` / `fs_list` (com path jail no workspace) · `terminal` com **allowlist** de binários · `get_datetime` |
| **Supervisor (operação contínua)** | detecta stall/erro de API → **retoma sozinho** com contexto salvo (backoff 2s→15s) · jobs persistidos em SQLite (WAL) · recuperação pós-crash no boot |
| **Protocolo `declare_done`** | em modo contínuo, o job só encerra quando **a própria IA declara conclusão** (com resumo e critérios) |
| **API Router com failover** | 7 modelos free ranqueados com health score · 429/5xx/timeout → troca automática pro próximo **sem perder o trabalho** |
| **Continuation** | resposta cortada (`finish_reason=length`) → continua exatamente de onde parou |
| **UI da visão** | narração pós-ação · **activity bar efêmera** embaixo (chips de tools que somem) · **área de pensamento separada** e colapsável · painel do job com timeline completa (retomadas e trocas de API visíveis) |
| **Segurança local** | chaves em SQLite `0600` no seu home (nunca saem do PC) · terminal com allowlist (`rm` e afins bloqueados) · auditoria de todo tool call |

## Dados e arquivos

- Dados do app: `~/.local/share/AgentForge/` (banco `forge.db` + `workspace/`)
- Workspace (jail de arquivos do agente): `~/.local/share/AgentForge/workspace/`
- Allowlist do terminal: configurável nas configurações (⚙)

## Requisitos

- Linux 64-bit (glibc ≥ 2.28 — Mint 20.04+, Ubuntu 20.04+, Debian 11+)
- Navegador padrão (o app abre sozinho)
- Chave gratuita da OpenRouter

## Desenvolvimento

```bash
# build do binário + UI
local/scripts/build.sh
# empacotar AppImage
local/scripts/package-appimage.sh 0.1.0
# teste e2e com provider mock (16 verificações)
python3 ../../scripts/test_e2e.py   # fora do repo — ver agentforge-brain
```

Fonte: `local/src/` (daemon: `server.ts`, `supervisor.ts`, `providers.ts`, `tools/`, `db.ts`) · UI: `local/web/` (vanilla, sem build step).

## Próximos passos (roadmap no repo agentforge-brain)

- F4: browser do agente (Playwright + screenshot de prova, visão Android/PC)
- F2: providers diretos além do OpenRouter (Groq, Google AI, GitHub Models)
- F5: camada de busca grátis (Wikipedia, OpenAlex, arXiv, DDG Lite)
- F6: loader de skills SKILL.md dos repos theskill/design/projects/research/security
- Windows (colega do dono) e Android depois do ciclo Linux
