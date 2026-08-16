// Benchmark harness — a fixed battery of tasks run against the selected model
// through the real agent engine. Scores tool usage and answer correctness.

export type BenchmarkTask = {
  id: string
  label: string
  prompt: string
  // Tool that SHOULD be called (matched by prefix — skills arrive as "skill_x")
  expectTool?: string
  // When true, the model must answer WITHOUT calling any tool
  expectNoTool?: boolean
  // Lowercase substring expected in the final reply
  expectContains?: string
  category: "tool-use" | "restraint" | "knowledge" | "code"
}

export const BENCHMARK_TASKS: BenchmarkTask[] = [
  {
    id: "math-calc",
    label: "Usa a calculadora",
    prompt: "Quanto é 37 vezes 24? Responda apenas o número.",
    expectTool: "calculate",
    expectContains: "888",
    category: "tool-use",
  },
  {
    id: "no-tool",
    label: "Respeita ordem de não usar ferramenta",
    prompt: "Sem usar nenhuma ferramenta ou skill, escreva apenas a palavra: BANANA",
    expectNoTool: true,
    expectContains: "banana",
    category: "restraint",
  },
  {
    id: "wiki-search",
    label: "Pesquisa na Wikipedia",
    prompt: "Quem foi Ada Lovelace? Responda em uma frase curta.",
    expectTool: "search_wikipedia",
    expectContains: "lovelace",
    category: "tool-use",
  },
  {
    id: "skill-translate",
    label: "Skill /translate",
    prompt: '/translate text="good morning" to=pt',
    expectTool: "skill_translate",
    expectContains: "bom dia",
    category: "tool-use",
  },
  {
    id: "convert-units",
    label: "Converte unidades",
    prompt: "Converta 100 quilômetros para milhas. Responda só o número aproximado.",
    expectTool: "convert_units",
    expectContains: "62",
    category: "tool-use",
  },
  {
    id: "datetime",
    label: "Sabe a data atual",
    prompt: "Que dia é hoje? Use a ferramenta de data e hora.",
    expectTool: "get_current_datetime",
    category: "tool-use",
  },
  {
    id: "gen-password",
    label: "Gera senha segura",
    prompt: "Gere uma senha aleatória e segura usando a ferramenta adequada.",
    expectTool: "generate_password",
    category: "tool-use",
  },
  {
    id: "code-python",
    label: "Gera função Python",
    prompt: "Escreva uma função Python chamada fibonacci que recebe n e retorna o n-ésimo número. Apenas o código.",
    expectContains: "def fibonacci",
    category: "code",
  },
]
