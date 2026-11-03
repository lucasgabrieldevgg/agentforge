// AgentForge Local — tools de BUSCA grátis (F5 do roadmap)
// ─────────────────────────────────────────────────────────────
// 👥 RESPONSABILIDADE: Agente 1 (Z) — ver docs/07-plano-v02.md no repo
//    agentforge-brain ou a mensagem de onboarding na sala.
//
// CONTRATO (não mexa no resto do app, só aqui):
//   1. Cada tool nova = uma entrada em SEARCH_TOOLS abaixo (schema + manual).
//   2. A execução fica em ./search-impl.ts (case do switch).
//   3. O registry e o executor já importam daqui — nada mais precisa mudar.
//   4. Manual curto e direto: o LLM lê isso pra decidir quando usar.
//   5. Zero dependências: use fetch nativo (Bun). Sem API keys.
//   6. Timeout curto (10s) e resultado cortado em ~12KB.
//
// TOOL A ENTREGAR (nesta ordem):
//   web_search      — DuckDuckGo Lite HTML (https://lite.duckduckgo.com/lite/?q=…)
//                     parse dos <a class='result-link'> + snippets; é o fallback web geral
//   arxiv_search    — http://export.arxiv.org/api/query?search_query=all:<q>&max_results=10
//   openalex_search — https://api.openalex.org/works?search=<q>&per-page=10&mailto=agentforge@example.com
//   hn_search       — https://hn.algolia.com/api/v1/search?query=<q>&hitsPerPage=15
//   stack_search    — https://api.stackexchange.com/2.3/search/advanced?q=<q>&site=stackoverflow&pagesize=15&sort=relevance
//   github_search   — https://api.github.com/search/repositories?q=<q>&per_page=10 (sem token, 10 req/min)
//   weather_lookup  — https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&daily=temperature_2m_max,temperature_2m_min&timezone=auto
//                     (geocoding grátis: https://geocoding-api.open-meteo.com/v1/search?name=<cidade>)
//   wikipedia_search — ✅ já implementado abaixo como REFERÊNCIA (copie o padrão)
//
// CRITÉRIO DE ACEITE: bun test local/src/tools/search.test.ts verde +
// relato FEITO na sala com o output de um job real usando web_search.
// ─────────────────────────────────────────────────────────────
import type { ToolDef } from "./registry";

export const SEARCH_TOOLS: ToolDef[] = [
  {
    name: "wikipedia_search",
    description: "Busca na Wikipédia (PT e EN) e devolve resumos enciclopédicos com links.",
    parameters: {
      query: { type: "string", description: "Termo de busca (ex: 'redes neurais')", required: true },
      lang: { type: "string", description: "Idioma: 'pt' (default) ou 'en'" },
    },
    manual: "primeira parada pra grounding de conceitos, definições e fatos estabelecidos. Use antes de buscas web gerais.",
  },
];
