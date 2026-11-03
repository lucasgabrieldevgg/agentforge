// AgentForge Local — servidor HTTP + SSE + arquivos estáticos
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { webRoot } from "./paths";
import {
  allSettings, setSetting, getSetting, addMessage, allMessages, listJobs, getJob,
  jobEvents, globalEvents, clearConversation, createJob, now,
} from "./db";
import { RANKED_MODELS, DEFAULT_MODEL, healthSnapshot, availableModels, type Auth } from "./providers";
import { DIRECT_PROVIDERS } from "./providers-direct";
import { Supervisor, stopJob, recoverOrphans, type UiEvent } from "./supervisor";
import { allowlist } from "./tools/executor";
import { workspaceRoot } from "./paths";
import { APP_VERSION } from "./engine";

// ---------- event bus (SSE) ----------
const sseClients = new Set<{ jobId: string | null; send: (e: UiEvent) => void }>();

function emit(e: UiEvent) {
  for (const c of [...sseClients]) {
    if (c.jobId === null || c.jobId === e.jobId) {
      try { c.send(e); } catch { sseClients.delete(c); }
    }
  }
}

const supervisor = new Supervisor(emit);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2",
  ".json": "application/json", ".map": "application/json",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function staticFile(rel: string): Response {
  const root = webRoot();
  const abs = join(root, rel);
  if (!abs.startsWith(root) || !existsSync(abs)) return new Response("not found", { status: 404 });
  const type = MIME[extname(abs)] ?? "application/octet-stream";
  const cache = rel.includes("fonts/") ? "public, max-age=31536000, immutable" : "no-cache";
  return new Response(readFileSync(abs), { headers: { "Content-Type": type, "Cache-Control": cache } });
}

function sse(jobId: string | null): Response {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      let client: { jobId: string | null; send: (e: UiEvent) => void } | null = null;
      let hb: ReturnType<typeof setInterval> | null = null;
      client = {
        jobId,
        send: (e: UiEvent) => controller.enqueue(enc.encode(`event: ${e.type}\ndata: ${JSON.stringify({ ...e.data, _job: e.jobId, _ts: e.ts })}\n\n`)),
      };
      sseClients.add(client);
      controller.enqueue(enc.encode(`event: hello\ndata: ${JSON.stringify({ ok: true, _ts: now() })}\n\n`));
      hb = setInterval(() => {
        try { controller.enqueue(enc.encode(`: hb\n\n`)); } catch { if (hb) clearInterval(hb); }
      }, 15_000);
    },
    cancel() {
      if (hb) clearInterval(hb);
      if (client) sseClients.delete(client);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" },
  });
}

export function makeServer(port: number) {
  return Bun.serve({
    port,
    idleTimeout: 0,
    async fetch(req): Promise<Response> {
      const url = new URL(req.url);
      const p = url.pathname;

      // ---------- UI ----------
      if (req.method === "GET") {
        if (p === "/" || p === "/index.html") return staticFile("index.html");
        if (p.startsWith("/api")) { /* cai abaixo */ }
        else if (p.startsWith("/fonts/") || p.startsWith("/app.") || p === "/logo.svg") {
          return staticFile(p.slice(1));
        }
      }

      // ---------- API ----------
      if (p === "/api/health") return json({ ok: true, version: APP_VERSION, port });

      if (p === "/api/state" && req.method === "GET") {
        const s = allSettings();
        const key = s.openrouter_key ?? "";
        const auth: Auth = {
          openrouter: key || undefined,
          groq: s.groq_key || undefined,
          "google-ai": s.google_ai_key || undefined,
          "github-models": s.github_models_key || undefined,
        };
        return json({
          version: APP_VERSION,
          settings: {
            has_key: !!(key || s.groq_key || s.google_ai_key || s.github_models_key),
            key_masked: key ? key.slice(0, 7) + "…" + key.slice(-4) : "",
            preferred_model: s.preferred_model ?? DEFAULT_MODEL,
            continuous_mode: (s.continuous_mode ?? "false") === "true",
            thinking_mode: s.thinking_mode ?? "high",
            max_iterations: parseInt(s.max_iterations ?? "12", 10),
          },
          models: availableModels(auth),
          providers: DIRECT_PROVIDERS.map(p => ({
            id: p.id, baseUrl: p.baseUrl, label: p.id,
            has_key: !!(s[p.settingKey] ?? "").trim(),
            key_masked: (s[p.settingKey] ?? "") ? (s[p.settingKey] ?? "").slice(0, 5) + "…" + (s[p.settingKey] ?? "").slice(-3) : "",
            setting_key: p.settingKey,
            models: p.models.map(m => ({ id: m.id, label: m.label, caps: m.caps, context: m.context })),
          })),
          health: healthSnapshot(),
          workspace: workspaceRoot(),
          allowlist: allowlist(),
        });
      }

      if (p === "/api/settings" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const allowed = ["openrouter_key", "groq_key", "google_ai_key", "github_models_key", "preferred_model", "continuous_mode", "thinking_mode", "max_iterations", "allowlist"];
        for (const k of allowed) if (k in body) {
          if (k === "allowlist" && Array.isArray(body[k])) {
            process.env.AGENTFORGE_ALLOWLIST = body[k].join(",");
          } else {
            setSetting(k, String(body[k]));
          }
        }
        return json({ ok: true });
      }

      if (p === "/api/history" && req.method === "GET") {
        return json({ messages: allMessages().map(m => ({
          id: m.id, role: m.role, content: m.content, thinking: m.thinking,
          has_tools: !!m.tool_calls, model: m.model, created_at: m.created_at,
        })) });
      }

      if (p === "/api/history" && req.method === "DELETE") {
        clearConversation();
        return json({ ok: true });
      }

      if (p === "/api/chat" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const message = String(body.message ?? "").trim();
        if (!message) return json({ error: "mensagem vazia" }, 400);
        const model = getSetting("preferred_model") ?? DEFAULT_MODEL;
        const job = createJob(message, model);
        addMessage({ job_id: job.id, role: "user", content: message });
        supervisor.start(job, message);
        return json({ jobId: job.id });
      }

      if (p === "/api/stop" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const ok = stopJob(String(body.jobId ?? ""));
        return json({ ok });
      }

      if (p === "/api/jobs" && req.method === "GET") {
        return json({ jobs: listJobs() });
      }

      if (p.startsWith("/api/jobs/") && req.method === "GET") {
        const id = p.split("/")[3];
        const job = getJob(id);
        if (!job) return json({ error: "job não existe" }, 404);
        return json({ job, events: jobEvents(id) });
      }

      if (p === "/api/events") {
        const jobId = url.searchParams.get("job");
        return sse(jobId ? jobId : null);
      }

      if (p === "/api/replay" && req.method === "GET") {
        const after = parseInt(url.searchParams.get("after") ?? "0", 10);
        return json({ events: globalEvents(after) });
      }

      if (p === "/api/shutdown" && req.method === "POST") {
        setTimeout(() => process.exit(0), 150);
        return json({ ok: true, bye: true });
      }

      return json({ error: `rota desconhecida: ${req.method} ${p}` }, 404);
    },
  });
}
