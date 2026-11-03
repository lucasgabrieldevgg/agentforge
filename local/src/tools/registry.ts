// AgentForge Local — catálogo de tools locais (schema + manual de uso p/ o agente)
export type ToolParam = { type: "string" | "number" | "boolean"; description: string; required?: boolean };
export type ToolDef = {
  name: string;
  description: string;
  parameters: Record<string, ToolParam>;
  /** Manual de uso — vira parte do system prompt (R06: noção de ferramenta). */
  manual: string;
};

import { SEARCH_TOOLS } from "./search";

/** Tools de núcleo (arquivos/terminal/tempo) — responsabilidade do líder. */
export const CORE_TOOLS: ToolDef[] = [
  {
    name: "fs_write",
    description: "Cria ou sobrescreve um arquivo de texto no workspace com o conteúdo fornecido.",
    parameters: {
      path: { type: "string", description: "Caminho relativo ao workspace (ex: src/app.ts)", required: true },
      content: { type: "string", description: "Conteúdo completo do arquivo", required: true },
    },
    manual: "use quando criar/salvar arquivos. SALVE trabalho relevante ANTES de declarar conclusão. path é sempre relativo ao workspace.",
  },
  {
    name: "fs_read",
    description: "Lê um arquivo de texto do workspace (até 200KB).",
    parameters: {
      path: { type: "string", description: "Caminho relativo ao workspace", required: true },
    },
    manual: "use para reler o que você (ou o usuário) já salvou. Se não existe, o erro diz isso.",
  },
  {
    name: "fs_list",
    description: "Lista arquivos e pastas de um diretório do workspace.",
    parameters: {
      path: { type: "string", description: "Diretório relativo ao workspace (default: raiz)" },
    },
    manual: "use antes de escrever, pra conhecer a estrutura; '.' lista a raiz.",
  },
  {
    name: "terminal",
    description: "Executa um comando no terminal DENTRO do workspace (só binários da allowlist).",
    parameters: {
      command: { type: "string", description: "Comando completo (ex: 'git status' ou 'ls -la')", required: true },
      timeout_s: { type: "number", description: "Timeout em segundos (default 60, máx 300)" },
    },
    manual: "use para git (status/add/commit/diff/log), build, testes, ls/cat etc. Binários fora da allowlist são bloqueados. Cuidado: comandos têm consequências reais — prefira --dry-run quando existir. push/deploy pedem permissão do usuário.",
  },
  {
    name: "declare_done",
    description: "Declara que o objetivo do trabalho foi cumprido. Encerra o job contínuo.",
    parameters: {
      summary: { type: "string", description: "Resumo do que foi feito e entregue", required: true },
      criteria_met: { type: "string", description: "Quais critérios do objetivo foram atendidos", required: true },
    },
    manual: "SÓ chame quando o objetivo estiver 100% cumprido E verificado (arquivos salvos, comandos rodando, output conferido). Se falta algo, continue trabalhando com as outras tools.",
  },
  {
    name: "get_datetime",
    description: "Data e hora atuais no fuso do usuário.",
    parameters: {},
    manual: "use antes de qualquer coisa que dependa de tempo (commits, nomes com data, agendamentos).",
  },
];

/** Catálogo completo: núcleo + busca (Agente 1) — mantenha nesta ordem. */
export const TOOLS: ToolDef[] = [...CORE_TOOLS, ...SEARCH_TOOLS];

/** Schemas no formato OpenAI/OpenRouter function calling. */
export function toolSchemas() {
  return TOOLS.map(t => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object" as const,
        properties: Object.fromEntries(
          Object.entries(t.parameters).map(([k, p]) => [k, { type: p.type, description: p.description }])
        ),
        required: Object.entries(t.parameters).filter(([, p]) => p.required).map(([k]) => k),
      },
    },
  }));
}

/** Manual completo das tools para o system prompt. */
export function toolsManual(): string {
  return TOOLS.map(t => `- **${t.name}** — ${t.description}\n  ↳ ${t.manual}`).join("\n");
}
