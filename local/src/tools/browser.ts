// AgentForge Local — F4: catálogo das tools de BROWSER do agente
// Manuais curtos: entram no system prompt (o LLM decide quando usar).
import type { ToolDef } from "./registry";

export const BROWSER_TOOLS: ToolDef[] = [
  {
    name: "browser_open",
    description: "Abre uma página web no navegador do agente (visual, com render) e devolve o mapa do DOM com elementos clicáveis (seletor + coordenada).",
    parameters: {
      url: { type: "string", description: "URL completa (ex: 'https://exemplo.com')", required: true },
      mode: { type: "string", description: "'visual' (render completo, default) ou 'lite' (só texto/DOM, sem navegador — mais rápido e leve)" },
      device: { type: "string", description: "'desktop' (default) ou 'android' (viewport mobile + touch)" },
    },
    manual: "abre a página e já devolve title + elementos clicáveis com x/y pra você clicar. Use mode:'lite' para LER páginas (artigos, docs) sem custo de render; use visual quando for interagir (cliques/forms) ou precisar de screenshot. Na primeira vez no modo visual o download do navegador (~200MB, único) pode demorar.",
  },
  {
    name: "browser_click",
    description: "Clica numa coordenada (x, y) da página atual — o clique visual, como um humano faria.",
    parameters: {
      x: { type: "number", description: "Coordenada X (px) do centro do elemento", required: true },
      y: { type: "number", description: "Coordenada Y (px) do centro do elemento", required: true },
    },
    manual: "use as coordenadas do mapa do DOM (browser_open/browser_get_dom_map devolvem x/y de cada elemento). Se o clique não surtir efeito, confira com browser_read ou browser_screenshot.",
  },
  {
    name: "browser_click_selector",
    description: "Clica num elemento por seletor CSS (ex: '#submit', 'a.nav-link').",
    parameters: {
      selector: { type: "string", description: "Seletor CSS do elemento", required: true },
    },
    manual: "mais confiável que coordenada quando você sabe o id/classe. Combine: use o seletor do mapa do DOM.",
  },
  {
    name: "browser_type",
    description: "Preenche um campo de texto por seletor CSS e opcionalmente envia (Enter).",
    parameters: {
      selector: { type: "string", description: "Seletor CSS do input/textarea", required: true },
      text: { type: "string", description: "Texto a digitar", required: true },
      submit: { type: "boolean", description: "true para apertar Enter depois de digitar (enviar form/busca)" },
    },
    manual: "para buscas e forms: preencha o campo e submit:true. Depois confira o resultado com browser_read ou o mapa do DOM.",
  },
  {
    name: "browser_scroll",
    description: "Rola a página atual (up/down) e devolve a nova posição.",
    parameters: {
      direction: { type: "string", description: "'down' (default) ou 'up'" },
      amount: { type: "number", description: "Pixels (default 600, máx 5000)" },
    },
    manual: "use para revelar conteúdo abaixo da dobra antes de ler o mapa do DOM de novo.",
  },
  {
    name: "browser_read",
    description: "Devolve o texto visível da página atual (até 12KB).",
    parameters: {},
    manual: "use depois de navegar/clique para conferir o conteúdo. É a forma barata de verificar estado da página.",
  },
  {
    name: "browser_get_dom_map",
    description: "Devolve o mapa do DOM da página atual: elementos clicáveis com seletor, texto, coordenadas e tamanho.",
    parameters: {},
    manual: "chame antes de clicar quando a página mudou (após scroll, submit ou clique) — coordenadas antigas podem estar defasadas.",
  },
  {
    name: "browser_screenshot",
    description: "Tira um screenshot PNG da página atual e anexa como evidência no job.",
    parameters: {
      name: { type: "string", description: "Nome curto do arquivo (ex: 'pos-clique')" },
    },
    manual: "use como PROVA de estado: depois de ações importantes (página carregada, form enviado, resultado visível). O usuário vê a imagem no painel do navegador.",
  },
  {
    name: "browser_wait",
    description: "Espera um tempo (ms) ou até um seletor aparecer na página.",
    parameters: {
      ms: { type: "number", description: "Milissegundos (100–15000)" },
      selector: { type: "string", description: "Seletor CSS a aguardar (alternativa ao ms)" },
    },
    manual: "use selector quando a página carrega conteúdo dinâmico (SPA) — mais confiável que esperar tempo fixo.",
  },
  {
    name: "browser_back",
    description: "Volta pra página anterior no histórico do navegador do agente.",
    parameters: {},
    manual: "use para voltar após abrir um link de um resultado de busca.",
  },
];
