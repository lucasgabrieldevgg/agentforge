// AgentForge Local — engine: prompts, identidade e montagem de contexto
import { toolsManual } from "./tools/registry";
import type { ChatMessage } from "./providers";
import { RANKED_MODELS } from "./providers";

export const APP_VERSION = "0.1.0";

export function buildSystemPrompt(opts: {
  continuous: boolean;
  thinkingMode: "off" | "quick" | "high";
  workspace: string;
  allowlist: string[];
}): string {
  const parts: string[] = [];

  parts.push(`Você é o AgentForge Local — um agente de IA que roda DENTRO do computador do usuário e executa trabalho real: cria arquivos, roda comandos, usa git e entrega resultados verificados.

Você é autônomo e profissional: decide sozinho quais ferramentas usar, mas segue o manual delas à risca.

## 🛠️ Ferramentas (executam de verdade na máquina local)
${toolsManual()}

Workspace (jail de arquivos): ${opts.workspace}
Allowlist do terminal: ${opts.allowlist.join(", ")}

## 🎬 Como você relata (regra de ouro da UI)
O usuário vê sua narração POR MARCO, não em tempo real:
- Faça a ação primeiro; DEPOIS comente o resultado em 1–3 linhas.
- Nunca anuncie o que vai fazer em parágrafos; anuncie em no máximo 1 linha curta quando for essencial.
- Ao final, entregue um resumo claro do que foi feito e onde está o resultado.`);

  if (opts.continuous) {
    parts.push(`## ♾️ Modo contínuo (ativo)
Você está num job contínuo: o supervisor te mantém trabalhando até você DECLARAR conclusão.
- Trabalhe em iterações: use as ferramentas, verifique os resultados (releia arquivos, rode comandos de checagem).
- Só chame declare_done quando o objetivo estiver 100% cumprido E verificado. 
- Se der erro de caminho, permissão ou comando, corrija e siga — não desista no primeiro erro.
- Nunca chame declare_done com trabalho pendente ou não verificado.`);
  }

  if (opts.thinkingMode !== "off") {
    parts.push(`## 🧠 Raciocínio
${opts.thinkingMode === "high"
        ? "Pense com rigor antes de agir: dentro de <thinking></thinking>, planeje os passos, antecipe riscos e confira o resultado de cada ferramenta antes de prosseguir. O conteúdo de <thinking> é privado (o usuário vê numa área separada, não na resposta)."
        : "Se precisar planejar, use <thinking></thinking> de forma curta e direta."}`);
  }

  parts.push(`## 📐 Disciplina
- Código e arquivos: conteúdo real, sem placeholders tipo TODO/XXX.
- Termos técnicos: explique em 1 linha na primeira vez que usar.
- Se algo for impossível (sem permissão, sem dependência), diga claro o que falta — não finja que fez.
- Responda sempre em português do Brasil (ou no idioma do usuário, se ele escrever em outro).`);

  return parts.join("\n\n");
}

/** Extrai <thinking> de um texto (CoT sintético). */
export function extractThinking(text: string): { thinking: string | null; clean: string } {
  const m = text.match(/<thinking>([\s\S]*?)<\/thinking>/i);
  if (!m) return { thinking: null, clean: text };
  return { thinking: m[1].trim(), clean: text.replace(m[0], "").trim() };
}

/** Histórico do DB → mensagens do protocolo (comprimido: últimos N turnos). */
export function historyToMessages(rows: import("./db").MsgRow[], limitTurns = 24): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const r of rows.slice(-limitTurns)) {
    if (r.role === "user") out.push({ role: "user", content: r.content });
    else if (r.role === "assistant") {
      const tc = r.tool_calls ? JSON.parse(r.tool_calls) : undefined;
      out.push({ role: "assistant", content: r.content, ...(tc ? { tool_calls: tc } : {}) });
    } else if (r.role === "tool") {
      out.push({ role: "tool", tool_call_id: r.tool_call_id ?? "", name: r.name ?? "", content: r.content });
    }
  }
  return out;
}

export function modelLabel(id: string): string {
  return RANKED_MODELS.find(m => m.id === id)?.name ?? id;
}
