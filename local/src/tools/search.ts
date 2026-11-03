// AgentForge Local — tools de BUSCA grátis (F5 do roadmap)
// ─────────────────────────────────────────────────────────────
// 👥 RESPONSABILIDADE: Z.ai (líder) — assumida do Agente 1 em 2026-11-03
//    (DECISÃO na sala: A1 não executou; branch feat/agente1-search inexistente).
//
// CONTRATO (não mexa no resto do app, só aqui):
//   1. Cada tool nova = uma entrada em SEARCH_TOOLS abaixo (schema + manual).
//   2. A execução fica em ./search-impl.ts (case do switch).
//   3. O registry e o executor já importam daqui — nada mais precisa mudar.
//   4. Manual curto e direto: o LLM lê isso pra decidir quando usar.
//   5. Zero dependências: use fetch nativo (Bun). Sem API keys.
//   6. Timeout curto (10s) e resultado cortado em ~12KB.
//
// As 9 tools (ordem = prioridade de uso geral):
//   web_search       — DuckDuckGo Lite (busca web geral, o fallback universal)
//   arxiv_search     — pré-prints de CS/física/matemática
//   openalex_search  — papers acadêmicos com contagem de citações
//   hn_search        — Hacker News (reação da comunidade tech)
//   stack_search     — Stack Overflow (dúvidas de código pontuais)
//   github_search    — repositórios por estrelas/descrição
//   weather_lookup   — previsão do tempo real por cidade (Open-Meteo)
//   gdelt_search     — notícias globais em tempo quase-real
//   wikipedia_search — enciclopédia PT/EN (grounding de conceitos)
//
// CRITÉRIO DE ACEITE: bun test src/tools/search.test.ts verde +
// relato FEITO na sala com o output de um job real usando web_search.
// ─────────────────────────────────────────────────────────────
import type { ToolDef } from "./registry";

export const SEARCH_TOOLS: ToolDef[] = [
  {
    name: "web_search",
    description: "Busca web geral (DuckDuckGo) com títulos, snippets e links. Sem chave, sem renderização.",
    parameters: {
      query: { type: "string", description: "Termo de busca (ex: 'bun javascript runtime')", required: true },
    },
    manual: "primeira escolha pra quase qualquer pesquisa na web. Se rate-limitar (429), caia pra wikipedia_search (conceitos), hn_search (tech) ou gdelt_search (notícias).",
  },
  {
    name: "arxiv_search",
    description: "Busca pré-prints científicos no arXiv (CS, física, matemática...) com resumos e datas.",
    parameters: {
      query: { type: "string", description: "Termo científico (ex: 'transformer attention')", required: true },
      max: { type: "number", description: "Quantidade de resultados (default 5, máx 10)" },
    },
    manual: "use para estado-da-arte técnico e pré-prints. Cruze com openalex_search quando precisar de impacto (citações).",
  },
  {
    name: "openalex_search",
    description: "Busca trabalhos acadêmicos no OpenAlex (milhões de papers) com ano, citações e DOI.",
    parameters: {
      query: { type: "string", description: "Tema/termo acadêmico (ex: 'large language models')", required: true },
    },
    manual: "melhor fonte para impacto acadêmico (cited_by_count) e temas interdisciplinares. Complementa o arxiv com papers revisados.",
  },
  {
    name: "hn_search",
    description: "Busca discussões e links no Hacker News (via Algolia) com pontos e número de comentários.",
    parameters: {
      query: { type: "string", description: "Assunto tech (ex: 'bun 1.0 release')", required: true },
    },
    manual: "use para sentir a reação da comunidade tech sobre ferramentas, lançamentos e debates antes de recomendar algo.",
  },
  {
    name: "stack_search",
    description: "Busca perguntas do Stack Overflow por relevância, com score, respostas e link direto.",
    parameters: {
      query: { type: "string", description: "Dúvida técnica ou mensagem de erro (ex: 'python list index out of range')", required: true },
    },
    manual: "use para erros de código e dúvidas técnicas pontuais — coloque a mensagem de erro na query. Priorize resultados com resposta aceita.",
  },
  {
    name: "github_search",
    description: "Busca repositórios no GitHub por estrelas, descrição e link (sem token).",
    parameters: {
      query: { type: "string", description: "Nome/tema do projeto (ex: 'headless browser automation')", required: true },
    },
    manual: "use para achar projetos, exemplos e libraries. Sem token são 10 req/min — evite rajadas; se der 403, espere ou use web_search.",
  },
  {
    name: "weather_lookup",
    description: "Previsão do tempo real por cidade (Open-Meteo): condições atuais + máx/mín dos próximos dias.",
    parameters: {
      city: { type: "string", description: "Nome da cidade (ex: 'Manaus', 'São Paulo')", required: true },
      days: { type: "number", description: "Dias de previsão (default 3, máx 7)" },
    },
    manual: "clima de qualquer cidade do mundo — passe o NOME da cidade, o geocoding é automático. Não use para clima histórico.",
  },
  {
    name: "gdelt_search",
    description: "Busca notícias globais recentes (GDELT) com data, veículo e país de origem.",
    parameters: {
      query: { type: "string", description: "Assunto noticioso (ex: 'inteligência artificial regulação')", required: true },
    },
    manual: "use para manchetes e acontecimentos em tempo quase-real. O serviço às vezes volta vazio/instável — reformule a query ou caia pra web_search.",
  },
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
