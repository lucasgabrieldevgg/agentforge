// AgentForge Local — SUPERVISOR: operação contínua (R05)
// Detecta parada → retoma sozinho com contexto salvo → só encerra quando a IA declara conclusão.
import {
  addEvent, addMessage, getJob, recentMessages, updateJob, getSetting, type JobRow,
} from "./db";
import { workspaceRoot } from "./paths";
import { buildSystemPrompt, historyToMessages, extractThinking } from "./engine";
import { streamWithFailover, recordOk, healthSnapshot, DEFAULT_MODEL, type Auth, type ChatMessage, type StreamEvent, type ToolCall } from "./providers";
import { toolSchemas } from "./tools/registry";
import { executeTool, allowlist } from "./tools/executor";

export type UiEvent = { type: string; jobId: string | null; data: Record<string, unknown>; ts: number };
type Emit = (e: UiEvent) => void;

const running = new Map<string, AbortController>();

function cfg(key: string, def: string): string { return getSetting(key) ?? def; }

export function stopJob(jobId: string): boolean {
  const ac = running.get(jobId);
  if (ac) { ac.abort(); return true; }
  return false;
}

export class Supervisor {
  constructor(private emit: Emit) {}

  private ev(jobId: string, type: string, data: Record<string, unknown> = {}) {
    addEvent(jobId, type, data);
    this.emit({ type, jobId, data, ts: Date.now() });
  }

  /** Inicia o job (fire-and-forget). */
  start(job: JobRow, userMessage: string) {
    const ac = new AbortController();
    running.set(job.id, ac);
    this.run(job, userMessage, ac).finally(() => running.delete(job.id));
      // .catch já tratado dentro do run
  }

  private async run(job: JobRow, userMessage: string, ac: AbortController) {
    const jobId = job.id;
    const maxIter = parseInt(cfg("max_iterations", "12"), 10);
    const continuous = cfg("continuous_mode", "false") === "true";
    const thinkingMode = (cfg("thinking_mode", "high") as "off" | "quick" | "high");
    // F2: auth misto — OpenRouter + providers diretos (Groq, Google AI, GitHub Models)
    const auth: Auth = {
      openrouter: cfg("openrouter_key", "").trim() || undefined,
      groq: cfg("groq_key", "").trim() || undefined,
      "google-ai": cfg("google_ai_key", "").trim() || undefined,
      "github-models": cfg("github_models_key", "").trim() || undefined,
    };
    let model = cfg("preferred_model", DEFAULT_MODEL);

    const hasAnyKey = !!(auth.openrouter || auth.groq || auth["google-ai"] || auth["github-models"]);
    if (!hasAnyKey) {
      this.ev(jobId, "job_failed", { error: "Configure ao menos uma chave nas configurações (⚙): OpenRouter, Groq, Google AI Studio ou GitHub Models — todas têm tier gratuito." });
      updateJob(jobId, { status: "failed", error: "sem API key" });
      return;
    }

    updateJob(jobId, { status: "running", model });
    this.ev(jobId, "job_started", { goal: job.goal, model, continuous });

    // contexto: system + histórico + mensagem atual
    const system = buildSystemPrompt({
      continuous, thinkingMode, workspace: workspaceRoot(), allowlist: allowlist(),
    });
    let usedTools = false;
    let declaredDone = false;
    let doneSummary = "";
    let retryDelayMs = 2000;

    try {
      for (let iter = 1; iter <= maxIter; iter++) {
        if (ac.signal.aborted) throw new DOMException("abortado", "AbortError");
        updateJob(jobId, { iterations: iter });
        this.ev(jobId, "iteration", { n: iter, max: maxIter, model });

        const history = historyToMessages(recentMessages(30));
        const messages: ChatMessage[] = [
          { role: "system", content: system },
          ...history,
          ...(iter === 1 ? [{ role: "user" as const, content: userMessage }] : []),
        ];
        if (iter > 1 && continuous && !declaredDone) {
          // nudge do supervisor entre iterações de um job contínuo
          messages.push({ role: "system", content: "Continue o trabalho. Quando TUDO estiver cumprido e verificado, chame declare_done." });
        }

        let content = "";
        let reasoning = "";
        let toolCalls: ToolCall[] = [];
        let finish = "";

        try {
          for await (const ev of streamWithFailover(auth, model, {
            messages, tools: toolSchemas(), signal: ac.signal,
            stallTimeoutMs: 45_000,
            maxTokens: 8192,
            reasoningEffort: thinkingMode === "off" ? "low" : "medium",
          })) {
            const se = ev as StreamEvent;
            if (se.t === "content") { content += se.delta; this.emit({ type: "content_delta", jobId, data: { delta: se.delta }, ts: Date.now() }); }
            else if (se.t === "reasoning") { reasoning += se.delta; this.emit({ type: "thinking_delta", jobId, data: { delta: se.delta, source: "native" }, ts: Date.now() }); }
            else if (se.t === "tool_calls") toolCalls = se.calls;
            else if (se.t === "finish") finish = se.reason;
            else if (se.t === "failover") {
              model = se.to;
              this.ev(jobId, "failover", { from: se.from, to: se.to, error: se.error });
              this.ev(jobId, "auto_resume", { why: `API "${se.from}" falhou (${se.error.slice(0, 120)}). Troquei para "${se.to}" e continuo de onde parei.` });
            }
          }
          retryDelayMs = 2000; // sucesso reseta o backoff
        } catch (err: any) {
          // ---- DETECÇÃO DE PARADA → AUTO-RESUME (R05) ----
          if (ac.signal.aborted) throw new DOMException("abortado pelo usuário", "AbortError");
          const msg = String(err?.message ?? err);
          this.ev(jobId, "stall_detected", { error: msg.slice(0, 200), attempt: iter });
          this.ev(jobId, "auto_resume", { why: `Detectei parada (${msg.slice(0, 120)}). Retomando automaticamente em ${Math.round(retryDelayMs / 1000)}s com o contexto salvo…` });
          await Bun.sleep(retryDelayMs);
          retryDelayMs = Math.min(retryDelayMs * 2, 15_000);
          iter--; // repete a iteração atual
          continue;
        }

        // CoT sintético
        const { thinking, clean } = extractThinking(content);
        const thinkingFinal = reasoning || thinking || null;

        // continuation: resposta cortada
        if (finish === "length" && iter < maxIter) {
          addMessage({ job_id: jobId, role: "assistant", content: clean, thinking: thinkingFinal, model });
          this.ev(jobId, "continuation", { why: "resposta cortada — continuando de onde parou" });
          messages.push({ role: "assistant", content: clean });
          messages.push({ role: "user", content: "Continue EXATAMENTE de onde parou, sem repetir nada." });
          continue;
        }

        // ---- tool calls ----
        if (toolCalls.length > 0) {
          usedTools = true;
          addMessage({ job_id: jobId, role: "assistant", content: clean, tool_calls: toolCalls, thinking: thinkingFinal, model });
          for (const tc of toolCalls) {
            // declare_done interceptado pelo supervisor
            if (tc.function.name === "declare_done") {
              let args: any = {};
              try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
              declaredDone = true;
              doneSummary = String(args.summary ?? "");
              this.ev(jobId, "declare_done", { summary: args.summary ?? "", criteria_met: args.criteria_met ?? "" });
              addMessage({ job_id: jobId, role: "tool", tool_call_id: tc.id, name: "declare_done", content: "OK — job encerrado pelo agente." });
              continue;
            }
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tc.function.arguments || "{}"); }
            catch { this.ev(jobId, "tool_result", { name: tc.function.name, ok: false, error: "argumentos JSON inválidos" }); }

            this.ev(jobId, "tool_start", { name: tc.function.name, args });
            const res = await executeTool(tc.function.name, args, { jobId, projectId: job.project_id ?? undefined });
            this.ev(jobId, "tool_result", { name: tc.function.name, ok: res.ok, result: (res.result ?? res.error ?? "").slice(0, 4000), args });
            addMessage({
              job_id: jobId, role: "tool", tool_call_id: tc.id, name: tc.function.name,
              content: JSON.stringify(res).slice(0, 8000),
            });
          }
          // o agente declarou conclusão — encerra o job AGORA
          if (declaredDone) {
            this.finish(jobId, "done", doneSummary || clean.slice(0, 500));
            return;
          }
          continue; // próxima iteração com os resultados
        }

        // ---- resposta final desta iteração (sem tools) ----
        addMessage({ job_id: jobId, role: "assistant", content: clean, thinking: thinkingFinal, model });
        this.ev(jobId, "content_final", { content: clean, thinking: thinkingFinal });

        if (continuous && usedTools && !declaredDone) {
          // modo contínuo: agente ainda não declarou — supervisor pergunta de novo
          this.ev(jobId, "notice", { text: "Trabalho com ferramentas em modo contínuo — verificando se o agente declara conclusão…" });
          addMessage({ job_id: null, role: "user", content: "[supervisor] O objetivo foi totalmente cumprido e verificado? Se sim, chame declare_done. Se não, continue trabalhando." });
          continue;
        }

        // conclusão natural (chat simples ou declarada)
        this.finish(jobId, "done", clean.slice(0, 500));
        return;
      }

      // maxIter esgotado
      this.ev(jobId, "job_paused", { reason: `limite de ${maxIter} iterações atingido` });
      updateJob(jobId, { status: "paused" });
    } catch (e: any) {
      if (e?.name === "AbortError") {
        this.ev(jobId, "job_failed", { error: "cancelado pelo usuário" });
        updateJob(jobId, { status: "failed", error: "cancelado" });
      } else {
        this.ev(jobId, "job_failed", { error: String(e?.message ?? e).slice(0, 300) });
        updateJob(jobId, { status: "failed", error: String(e?.message ?? e).slice(0, 300) });
      }
    }
  }

  private finish(jobId: string, status: "done", summary: string) {
    updateJob(jobId, { status, summary });
    this.ev(jobId, "job_done", { summary });
  }
}

/** Retoma jobs órfãos (crash do daemon) no boot — marca como pausados p/ decisão do usuário. */
export function recoverOrphans(emit: Emit): number {
  const { orphanedJobs } = require("./db") as typeof import("./db");
  const orphans = orphanedJobs();
  for (const j of orphans) {
    updateJob(j.id, { status: "paused" });
    addEvent(j.id, "job_paused", { reason: "daemon reiniciado — retome pelo painel de jobs" });
    emit({ type: "job_paused", jobId: j.id, data: { reason: "daemon reiniciado" }, ts: Date.now() });
  }
  return orphans.length;
}

export { healthSnapshot };
