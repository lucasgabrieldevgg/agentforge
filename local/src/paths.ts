// AgentForge Local — resolução de caminhos (XDG) e workspace
import { mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

function xdg(envVar: string, fallback: string): string {
  const v = process.env[envVar];
  if (v && v.trim().length > 0) return v;
  return join(homedir(), ".local", "share", "AgentForge");
}

export const DATA_DIR = xdg("AGENTFORGE_HOME", "");
export const DB_PATH = join(DATA_DIR, "forge.db");
export const DEFAULT_WORKSPACE = join(DATA_DIR, "workspace");

export function ensureDirs(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(DEFAULT_WORKSPACE, { recursive: true });
}

// ---------- projeto ativo (dados reunidos e gerenciados) ----------
// Projeto != "geral" → workspace próprio em workspace/projects/<id>/
// (jail, terminal, evidências do browser e /api/file seguem junto)
let activeProjectId: string | null = null;
export function setActiveProject(id: string | null): string {
  activeProjectId = id && id !== "geral" ? id : null;
  const root = workspaceRoot();
  mkdirSync(root, { recursive: true });
  return root;
}
export function activeProject(): string | null {
  return activeProjectId;
}

/** Resolve o workspace configurado (com fallback pro padrão). */
export function workspaceRoot(): string {
  const base = resolve(process.env.AGENTFORGE_WORKSPACE || DEFAULT_WORKSPACE);
  if (activeProjectId) return join(base, "projects", activeProjectId);
  return base;
}

/** Resolve web dir: env → relativo ao binário → cwd. */
export function webRoot(): string {
  const env = process.env.AGENTFORGE_WEB;
  if (env) return resolve(env);
  const exeDir = join(process.execPath, "..");
  const candidates = [
    join(exeDir, "..", "share", "agentforge", "web"), // layout do AppDir
    join(exeDir, "web"),                                // dev: dist/web ao lado do binário
    join(process.cwd(), "web"),                          // dev: rodando do fonte
    join(process.cwd(), "local", "web"),                 // dev: raiz do repo
  ];
  for (const c of candidates) if (existsSync(c)) return resolve(c);
  return resolve(candidates[0]);
}
