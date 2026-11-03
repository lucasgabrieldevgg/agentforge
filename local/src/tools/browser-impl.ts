// AgentForge Local — F4: BROWSER DO AGENTE (runtime)
// ─────────────────────────────────────────────────────────────
// DSL visual (Playwright + chromium-headless-shell on-demand) + modo LITE
// (DOM/texto denso SEM render, fetch puro). R08–R14 da visão.
//
// ARQUITETURA:
//   • playwright-core é EXTERNO ao binário (resolve em runtime de
//     node_modules ao lado do executável — AppDir/usr/share/agentforge) —
//     14MB, zero deps; NUNCA é bundlado (chromium-bidi quebra o bundle).
//   • O BINÁRIO do navegador (~200MB) NÃO vem no AppImage: download
//     on-demand na primeira chamada (cdn.playwright.dev) p/ DATA/browsers.
//   • Singleton: 1 browser + 1 page por device profile; fecha após 3min
//     de idle (RAM volta prozero).
//   • LITE mode: browser_open(url, {mode:"lite"}) → fetch + extração
//     regex (zero browser, zero download) — a busca barata de sempre.
//   • Screenshots → workspace/.evidence/browser/*.png (jail respeitada).
// ─────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { DATA_DIR, workspaceRoot } from "../paths";

// precisa vir ANTES de qualquer require do playwright
const BROWSERS_DIR = process.env.PLAYWRIGHT_BROWSERS_PATH || join(DATA_DIR, "browsers");
process.env.PLAYWRIGHT_BROWSERS_PATH = BROWSERS_DIR;

export type BrowserStatus = {
  runtime: boolean;       // playwright-core resolvível
  installed: boolean;     // binário do navegador baixado
  revision: number | null;
  installing: boolean;
  path: string | null;    // executável
  error?: string;
};

let installing = false;

// ---------- resolução do playwright-core (externo) ----------
function resolvePlaywrightDir(): string | null {
  const exeDir = dirname(process.execPath);
  const candidates = [
    join(exeDir, "..", "share", "agentforge", "node_modules", "playwright-core"), // AppDir
    join(exeDir, "node_modules", "playwright-core"),
    join(process.cwd(), "node_modules", "playwright-core"),
    join(process.cwd(), "local", "node_modules", "playwright-core"),
  ];
  return candidates.find(c => existsSync(join(c, "package.json"))) ?? null;
}

/** Revisão do chromium-headless-shell exigida pelo playwright-core instalado. */
function headlessRevision(): number | null {
  const dir = resolvePlaywrightDir();
  if (!dir) return null;
  try {
    const json = JSON.parse(readFileSync(join(dir, "browsers.json"), "utf8"));
    const b = (json.browsers as any[]).find(x => x.name === "chromium-headless-shell");
    return b?.revision != null ? Number(b.revision) : null;
  } catch { return null; }
}

function shellDir(rev: number): string {
  return join(BROWSERS_DIR, `chromium_headless_shell-${rev}`);
}
function shellBinary(rev: number): string {
  return join(shellDir(rev), "chrome-headless-shell-linux64", "chrome-headless-shell");
}

export function browserStatus(): BrowserStatus {
  const runtime = !!resolvePlaywrightDir();
  const rev = headlessRevision();
  const installed = !!(rev && existsSync(join(shellDir(rev), "INSTALLATION_COMPLETE")) && existsSync(shellBinary(rev)));
  return {
    runtime, installed, revision: rev, installing,
    path: installed && rev ? shellBinary(rev) : null,
    error: runtime ? undefined : "playwright-core não encontrado nesta instalação",
  };
}

/** Download on-demand do chromium-headless-shell (~200MB, uma vez só). */
export async function installBrowser(onProgress?: (pct: number, mb: number) => void): Promise<{ rev: number; mb: number }> {
  const dir = resolvePlaywrightDir();
  if (!dir) throw new Error("playwright-core não encontrado — reinstale o AgentForge");
  const rev = headlessRevision();
  if (!rev) throw new Error("browsers.json inválido no playwright-core");
  if (existsSync(join(shellDir(rev), "INSTALLATION_COMPLETE"))) return { rev, mb: 0 };

  installing = true;
  try {
    const url = `https://cdn.playwright.dev/dbazure/download/playwright/builds/chromium/${rev}/chromium-headless-shell-linux.zip`;
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`download falhou: HTTP ${res.status}`);
    const total = +(res.headers.get("content-length") ?? 0);
    const zipPath = join(BROWSERS_DIR, `chromium-headless-shell-${rev}.zip`);
    mkdirSync(BROWSERS_DIR, { recursive: true });

    // stream → disco com progresso
    const reader = res.body.getReader();
    const file = Bun.file(zipPath).writer();
    let got = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await file.write(value);
      got += value.length;
      if (total) onProgress?.(Math.round((got / total) * 100), Math.round(got / 1048576));
    }
    await file.end();

    // extrai: unzip → fallback python3 (Mint sempre tem)
    const dest = shellDir(rev);
    mkdirSync(dest, { recursive: true });
    let ok = Bun.spawnSync(["unzip", "-q", "-o", zipPath, "-d", dest]);
    if (!ok.success) {
      ok = Bun.spawnSync(["python3", "-m", "zipfile", "-e", zipPath, dest]);
    }
    if (!ok.success) throw new Error("extração falhou (unzip e python3 indisponíveis)");
    chmodSync(shellBinary(rev), 0o755);
    writeFileSync(join(dest, "INSTALLATION_COMPLETE"), "");
    writeFileSync(join(dest, "DEPENDENCIES_VALIDATED"), "");
    // zip temporário fora
    Bun.spawnSync(["rm", "-f", zipPath]);
    return { rev, mb: Math.round(got / 1048576) };
  } finally {
    installing = false;
  }
}

// ---------- singleton browser/page ----------
type Pw = typeof import("playwright-core");
let _pw: Pw | null = null;
function loadPlaywright(): Pw {
  if (_pw) return _pw;
  const dir = resolvePlaywrightDir();
  if (!dir) throw new Error("playwright-core não encontrado nesta instalação");
  const req = require; // indireção: bundler não segue
  _pw = req(join(dir, "index.js")) as Pw;
  return _pw;
}

export type Device = "desktop" | "android";
const DEVICES: Record<Device, { viewport: { width: number; height: number }; userAgent: string; isMobile: boolean; hasTouch: boolean }> = {
  desktop: { viewport: { width: 1280, height: 800 }, userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", isMobile: false, hasTouch: false },
  android: { viewport: { width: 412, height: 915 }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36", isMobile: true, hasTouch: true },
};

type Session = { browser: any; page: any; device: Device };
const sessions = new Map<Device, Session>();
const IDLE_MS = 180_000;
const idleTimers = new Map<Device, Timer>();

function touchIdle(device: Device) {
  clearTimeout(idleTimers.get(device));
  idleTimers.set(device, setTimeout(() => { closeSession(device); }, IDLE_MS));
}
export function closeSession(device: Device = "desktop") {
  const s = sessions.get(device);
  sessions.delete(device);
  clearTimeout(idleTimers.get(device));
  idleTimers.delete(device);
  if (s) s.browser.close().catch(() => {});
}

async function ensureSession(device: Device = "desktop") {
  const st = browserStatus();
  if (!st.installed) {
    throw new Error("navegador do agente não instalado — peça ao usuário para instalar no painel do navegador (download único de ~200MB) ou use browser_open com mode:'lite' (sem navegador)");
  }
  let s = sessions.get(device);
  if (!s || !s.browser.isConnected()) {
    const { chromium } = loadPlaywright();
    let browser: any;
    try {
      browser = await chromium.launch({ headless: true });
    } catch {
      // sandbox do kernel indisponível (container/WSL) → tenta sem sandbox
      browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    }
    const page = await browser.newPage({ ...DEVICES[device] });
    page.setDefaultTimeout(20_000);
    s = { browser, page, device };
    sessions.set(device, s);
  }
  touchIdle(device);
  return s;
}

// ---------- mapa do DOM (seletor + coordenada) ----------
export type DomEl = { i: number; tag: string; text: string; x: number; y: number; w: number; h: number; type: string };
async function domMap(page: any): Promise<DomEl[]> {
  return page.evaluate(() => {
    const sel = "a[href], button, input, textarea, select, summary, [role='button'], [onclick], [contenteditable='true']";
    const els = Array.from(document.querySelectorAll(sel))
      .filter((el: Element) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return r.width > 1 && r.height > 1 && style.visibility !== "hidden" && style.display !== "none";
      })
      .slice(0, 60) as HTMLElement[];
    return els.map((el, i) => {
      const r = el.getBoundingClientRect();
      const tag = el.tagName.toLowerCase()
        + (el.id ? `#${el.id}` : "")
        + ((typeof el.className === "string" && el.className.trim()) ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
      return {
        i, tag,
        text: ((el.textContent || "").trim() || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("name") || "").slice(0, 60),
        x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
        w: Math.round(r.width), h: Math.round(r.height),
        type: el.getAttribute("type") ?? "",
      };
    });
  });
}

// ---------- LITE: fetch + extração sem render ----------
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}
function extractLinks(html: string): { text: string; href: string }[] {
  const out: { text: string; href: string }[] = [];
  const re = /<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 30) {
    const text = stripHtml(m[2]).slice(0, 80);
    if (text) out.push({ text, href: m[1] });
  }
  return out;
}
function htmlTitle(html: string): string {
  return (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim().slice(0, 120);
}

// ---------- execução das tools ----------
export async function executeBrowserTool(name: string, args: Record<string, unknown>): Promise<{ ok: boolean; result?: string; error?: string } | null> {
  if (!name.startsWith("browser_")) return null;
  const device: Device = args.device === "android" ? "android" : "desktop";

  try {
    switch (name) {
      case "browser_open": {
        const url = String(args.url ?? "").trim();
        if (!url) return { ok: false, error: "url obrigatória" };
        let full: string;
        if (/^https?:\/\//i.test(url)) full = url;
        else if (url.startsWith("file://")) {
          // jail: file:// só dentro do workspace (screenshots não vazam conteúdo fora)
          const p = resolve(url.slice(7));
          const root = workspaceRoot();
          if (p !== root && !p.startsWith(root + "/")) {
            return { ok: false, error: `file:// fora do workspace (jail de segurança) — só arquivos de ${root}` };
          }
          full = "file://" + p;
        }
        else if (/^(localhost|127\.0\.0\.1)(:\d+)?/i.test(url)) full = `http://${url}`;
        else full = `https://${url}`;
        if (args.mode === "lite") {
          const ctl = new AbortController();
          const t = setTimeout(() => ctl.abort(), 20_000);
          try {
            const res = await fetch(full, { signal: ctl.signal, headers: { "User-Agent": DEVICES.desktop.userAgent, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5" }, redirect: "follow" });
            if (!res.ok) return { ok: false, error: `HTTP ${res.status} ao abrir (modo lite)` };
            const html = (await res.text()).slice(0, 2_000_000);
            const text = stripHtml(html).slice(0, 12_000);
            const links = extractLinks(html).slice(0, 15);
            return { ok: true, result: JSON.stringify({ mode: "lite", url: full, title: htmlTitle(html), text, links }) };
          } finally { clearTimeout(t); }
        }
        const { page } = await ensureSession(device);
        const res = await page.goto(full, { waitUntil: "domcontentloaded", timeout: 25_000 });
        const status = res?.status() ?? 0;
        const title = (await page.title()).slice(0, 120);
        const map = await domMap(page);
        return { ok: true, result: JSON.stringify({ mode: "visual", url: page.url(), status, title, elements: map }) };
      }
      case "browser_click": {
        const { page } = await ensureSession(device);
        await page.mouse.click(Number(args.x ?? 0), Number(args.y ?? 0));
        await page.waitForLoadState("networkidle").catch(() => {});
        const title = (await page.title()).slice(0, 120);
        return { ok: true, result: JSON.stringify({ clicked: [Number(args.x ?? 0), Number(args.y ?? 0)], url: page.url(), title }) };
      }
      case "browser_click_selector": {
        const { page } = await ensureSession(device);
        const sel = String(args.selector ?? "");
        if (!sel) return { ok: false, error: "selector obrigatório" };
        await page.click(sel, { timeout: 10_000 });
        await page.waitForLoadState("networkidle").catch(() => {});
        return { ok: true, result: JSON.stringify({ clicked: sel, url: page.url(), title: (await page.title()).slice(0, 120) }) };
      }
      case "browser_type": {
        const { page } = await ensureSession(device);
        const sel = String(args.selector ?? "");
        const text = String(args.text ?? "");
        if (!sel) return { ok: false, error: "selector obrigatório" };
        await page.fill(sel, text, { timeout: 10_000 });
        if (args.submit) {
          await page.press(sel, "Enter");
          await page.waitForLoadState("networkidle").catch(() => {});
        }
        return { ok: true, result: JSON.stringify({ typed: text.slice(0, 80), selector: sel, url: page.url() }) };
      }
      case "browser_scroll": {
        const { page } = await ensureSession(device);
        const amount = Math.min(Math.max(Number(args.amount ?? 600), 50), 5000);
        const dir = args.direction === "up" ? -amount : amount;
        if (device === "android") await page.touchscreen.tap(206, 450).catch(() => {});
        await page.mouse.wheel(0, dir);
        await page.waitForTimeout(400);
        const pos = await page.evaluate(() => ({ y: Math.round(window.scrollY), h: document.body.scrollHeight }));
        return { ok: true, result: JSON.stringify({ scrolled: dir, position: pos }) };
      }
      case "browser_read": {
        const { page } = await ensureSession(device);
        const text = (await page.evaluate(() => document.body?.innerText ?? "")).slice(0, 12_000);
        return { ok: true, result: JSON.stringify({ url: page.url(), title: (await page.title()).slice(0, 120), text }) };
      }
      case "browser_get_dom_map": {
        const { page } = await ensureSession(device);
        const map = await domMap(page);
        return { ok: true, result: JSON.stringify({ url: page.url(), elements: map }) };
      }
      case "browser_screenshot": {
        const { page } = await ensureSession(device);
        const buf: Buffer = await page.screenshot({ type: "png" });
        const rel = await saveEvidence(buf, String(args.name ?? "shot"));
        return { ok: true, result: JSON.stringify({ screenshot: rel, url: page.url(), title: (await page.title()).slice(0, 120), bytes: buf.length }) };
      }
      case "browser_wait": {
        const { page } = await ensureSession(device);
        if (args.selector) { await page.waitForSelector(String(args.selector), { timeout: 15_000 }); return { ok: true, result: `seletor apareceu: ${args.selector}` }; }
        const ms = Math.min(Math.max(Number(args.ms ?? 1000), 100), 15_000);
        await page.waitForTimeout(ms);
        return { ok: true, result: `esperou ${ms}ms` };
      }
      case "browser_back": {
        const { page } = await ensureSession(device);
        await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
        return { ok: true, result: JSON.stringify({ url: page.url() }) };
      }
      default:
        return { ok: false, error: `tool de browser desconhecida: ${name}` };
    }
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e).slice(0, 400) };
  }
}

/** Screenshot → workspace/.evidence/browser/ (jail). */
async function saveEvidence(buf: Buffer, name: string): Promise<string> {
  const relDir = ".evidence/browser";
  const absDir = join(workspaceRoot(), relDir);
  mkdirSync(absDir, { recursive: true });
  const safe = name.replace(/[^\w.-]+/g, "_").slice(0, 40) || "shot";
  const rel = `${relDir}/${Date.now().toString(36)}-${safe}.png`;
  writeFileSync(join(workspaceRoot(), rel), buf);
  return rel;
}
