// AgentForge Local — executor de tools: tudo local, com path jail e allowlist de terminal
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve, dirname, isAbsolute } from "node:path";
import { workspaceRoot, activeProject } from "../paths";
import { addArtifact } from "../db";
import { executeSearchTool } from "./search-impl";
import { executeBrowserTool } from "./browser-impl";

export type ToolResult = { ok: boolean; result?: string; error?: string };
export type ToolCtx = { jobId?: string; projectId?: string }; // p/ indexar artefatos

const MAX_READ = 200 * 1024;

/** Jail: resolve caminho relativo ao workspace e garante que não escapa. */
function jailed(rel: string): string {
  const root = workspaceRoot();
  const abs = isAbsolute(rel) ? resolve(rel) : resolve(join(root, rel));
  if (abs !== root && !abs.startsWith(root + "/") && !abs.startsWith(root + "\\")) {
    throw new Error(`caminho fora do workspace: ${rel} (workspace: ${root})`);
  }
  return abs;
}

// ---------- allowlist de terminal ----------
const DEFAULT_ALLOWLIST = [
  "git", "ls", "cat", "head", "tail", "mkdir", "cp", "mv", "touch", "echo",
  "node", "bun", "npm", "npx", "python3", "pip3", "vercel", "grep", "find",
  "wc", "tree", "sed", "awk", "curl", "diff", "chmod", "which", "pwd",
];
export function allowlist(): string[] {
  const custom = process.env.AGENTFORGE_ALLOWLIST;
  if (custom !== undefined) return custom.split(",").map(s => s.trim()).filter(Boolean);
  return DEFAULT_ALLOWLIST;
}

export async function executeTerminal(command: string, timeoutS = 60): Promise<ToolResult> {
  const first = command.trim().split(/\s+/)[0]?.replace(/^.*\//, "");
  const list = allowlist();
  if (!first || !list.includes(first)) {
    return { ok: false, error: `binário '${first}' fora da allowlist [${list.join(", ")}]. Peça ao usuário para liberar nas configurações.` };
  }
  const timeout = Math.min(Math.max(5, timeoutS || 60), 300) * 1000;
  try {
    const proc = Bun.spawn(["bash", "-lc", command], {
      cwd: workspaceRoot(),
      stdout: "pipe", stderr: "pipe", stdin: "ignore",
      env: { ...process.env, TERM: "dumb", NO_COLOR: "1", GIT_TERMINAL_PROMPT: "0" },
    });
    const timer = setTimeout(() => proc.kill(), timeout);
    const [out, err] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const code = await proc.exited;
    clearTimeout(timer);
    const output = (out + (err ? (out ? "\n" : "") + err : "")).slice(0, 20_000);
    return { ok: true, result: `exit=${code}\n${output || "(sem output)"}` };
  } catch (e: any) {
    return { ok: false, error: `falha ao executar: ${e?.message ?? e}` };
  }
}

// ---------- dispatcher ----------
export async function executeTool(name: string, args: Record<string, unknown>, ctx: ToolCtx = {}): Promise<ToolResult> {
  try {
    switch (name) {
      case "fs_write": {
        const path = String(args.path ?? "");
        if (!path) return { ok: false, error: "path obrigatório" };
        const abs = jailed(path);
        mkdirSync(dirname(abs), { recursive: true });
        const content = String(args.content ?? "");
        writeFileSync(abs, content, "utf8");
        indexArtifact(ctx, path, Buffer.byteLength(content), "write");
        return { ok: true, result: `salvo: ${path} (${content.length} bytes)` };
      }
      case "fs_read": {
        const abs = jailed(String(args.path ?? ""));
        if (!existsSync(abs)) return { ok: false, error: `arquivo não existe: ${args.path}` };
        const st = statSync(abs);
        if (st.size > MAX_READ) return { ok: false, error: `arquivo grande demais (${Math.round(st.size / 1024)}KB, máx 200KB)` };
        return { ok: true, result: readFileSync(abs, "utf8") };
      }
      case "fs_list": {
        const abs = jailed(String(args.path ?? "."));
        if (!existsSync(abs)) return { ok: false, error: `diretório não existe: ${args.path}` };
        const entries = readdirSync(abs, { withFileTypes: true })
          .map(e => `${e.isDirectory() ? "d" : "-"} ${e.name}`)
          .sort();
        return { ok: true, result: entries.join("\n") || "(vazio)" };
      }
      case "terminal": {
        const cmd = String(args.command ?? "").trim();
        if (!cmd) return { ok: false, error: "command obrigatório" };
        return await executeTerminal(cmd, Number(args.timeout_s ?? 60));
      }
      case "get_datetime": {
        const tz = process.env.AGENTFORGE_TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const now = new Date();
        const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "long", timeZone: tz });
        return { ok: true, result: `${fmt.format(now)} (${tz})` };
      }
      case "declare_done": {
        // o supervisor intercepta antes; chegar aqui é fallback
        return { ok: true, result: "recebido" };
      }
      default: {
        // tools de busca (Agente 1) — implementadas em search-impl.ts
        const r = await executeSearchTool(name, args);
        if (r !== null) return r;
        // tools de browser (F4) — runtime Playwright on-demand + modo LITE
        const b = await executeBrowserTool(name, args);
        if (b !== null) {
          // screenshot → artefato indexado (evidência do projeto)
          if (b.ok && name === "browser_screenshot") {
            try {
              const d = JSON.parse(b.result ?? "{}");
              if (d.screenshot) indexArtifact(ctx, d.screenshot, d.bytes ?? 0, "screenshot");
            } catch {}
          }
          return b;
        }
        return { ok: false, error: `tool desconhecida: ${name}` };
      }
    }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/** Indexa artefato produzido pelo agente (dados reunidos por projeto). */
function indexArtifact(ctx: ToolCtx, path: string, bytes: number, op: string): void {
  try {
    addArtifact({
      project_id: ctx.projectId ?? activeProject() ?? "geral",
      job_id: ctx.jobId,
      path, bytes, op,
    });
  } catch { /* índice nunca derruba a tool */ }
}
