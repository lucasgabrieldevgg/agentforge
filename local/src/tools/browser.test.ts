// F4 — testes do browser do agente (visual + LITE) contra servidor local
// Requer: playwright-core instalado (node_modules) e o chromium-headless-shell
// em PLAYWRIGHT_BROWSERS_PATH (download on-demand replicado pelo próprio app).
process.env.AGENTFORGE_HOME = "/tmp/af-browser-test";
process.env.AGENTFORGE_WORKSPACE = "/tmp/af-browser-test/workspace";
process.env.PLAYWRIGHT_BROWSERS_PATH = "/tmp/pw-browsers";

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, existsSync, statSync, rmSync } from "node:fs";

const HTML = `<!DOCTYPE html><html><head><title>Demo AF</title></head><body>
<h1 id="t">Demo</h1>
<button id="btn" onclick="document.getElementById('t').textContent='clicado'">clique aqui</button>
<form onsubmit="event.preventDefault(); document.getElementById('t').textContent='buscou:'+document.getElementById('q').value">
<input id="q" name="q" placeholder="buscar"></form>
<a href="/outra">um link</a></body></html>`;

const server = Bun.serve({ port: 0, fetch: () => new Response(HTML, { headers: { "Content-Type": "text/html" } }) });
const URL_ = `http://localhost:${server.port}`;

let browser: typeof import("./browser-impl");
const parse = (r: { ok: boolean; result?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return JSON.parse(r.result!);
};

beforeAll(async () => {
  mkdirSync(process.env.AGENTFORGE_WORKSPACE!, { recursive: true });
  browser = await import("./browser-impl");
});
afterAll(() => { server.stop(true); try { browser?.closeSession?.("desktop"); browser?.closeSession?.("android"); } catch {} rmSync("/tmp/af-browser-test", { recursive: true, force: true }); });

describe("F4 · status e instalador", () => {
  test("playwright-core resolvível + navegador instalado (marker)", () => {
    const st = browser.browserStatus();
    expect(st.runtime).toBe(true);
    expect(st.installed).toBe(true);
    expect(st.revision).toBeGreaterThan(1000);
  });
  test("installBrowser é idempotente (já instalado → 0MB, sem download)", async () => {
    const r = await browser.installBrowser();
    expect(r.mb).toBe(0);
  });
});

describe("F4 · fluxo visual (DSL)", () => {
  test("browser_open: title + mapa do DOM com coords do #btn", async () => {
    const d = parse(await browser.executeBrowserTool("browser_open", { url: URL_ }));
    expect(d.mode).toBe("visual");
    expect(d.title).toBe("Demo AF");
    const btn = d.elements.find((e: any) => e.tag.includes("#btn"));
    expect(btn).toBeDefined();
    expect(btn.x).toBeGreaterThan(0);
    expect(btn.y).toBeGreaterThan(0);
  });

  test("browser_click_selector: clica no botão e o estado muda", async () => {
    parse(await browser.executeBrowserTool("browser_open", { url: URL_ }));
    parse(await browser.executeBrowserTool("browser_click_selector", { selector: "#btn" }));
    const d = parse(await browser.executeBrowserTool("browser_read", {}));
    expect(d.text).toContain("clicado");
  });

  test("browser_click por COORDENADA (x,y) do mapa do DOM", async () => {
    const open = parse(await browser.executeBrowserTool("browser_open", { url: URL_ }));
    const btn = open.elements.find((e: any) => e.tag.includes("#btn"));
    parse(await browser.executeBrowserTool("browser_click", { x: btn.x, y: btn.y }));
    const d = parse(await browser.executeBrowserTool("browser_read", {}));
    expect(d.text).toContain("clicado");
  });

  test("browser_type com submit: form processa o valor", async () => {
    parse(await browser.executeBrowserTool("browser_open", { url: URL_ }));
    parse(await browser.executeBrowserTool("browser_type", { selector: "#q", text: "playwright", submit: true }));
    const d = parse(await browser.executeBrowserTool("browser_read", {}));
    expect(d.text).toContain("buscou:playwright");
  });

  test("browser_get_dom_map depois do scroll", async () => {
    parse(await browser.executeBrowserTool("browser_open", { url: URL_ }));
    parse(await browser.executeBrowserTool("browser_scroll", { direction: "down", amount: 200 }));
    const d = parse(await browser.executeBrowserTool("browser_get_dom_map", {}));
    expect(d.elements.length).toBeGreaterThan(0);
  });

  test("browser_screenshot: PNG salvo no workspace/.evidence", async () => {
    parse(await browser.executeBrowserTool("browser_open", { url: URL_ }));
    const d = parse(await browser.executeBrowserTool("browser_screenshot", { name: "prova-demo" }));
    expect(d.screenshot).toContain(".evidence/browser/");
    const abs = `${process.env.AGENTFORGE_WORKSPACE}/${d.screenshot}`;
    expect(existsSync(abs)).toBe(true);
    expect(statSync(abs).size).toBeGreaterThan(1000); // PNG real, não vazio
  });

  test("device android: abre com viewport mobile", async () => {
    const d = parse(await browser.executeBrowserTool("browser_open", { url: URL_, device: "android" }));
    expect(d.mode).toBe("visual");
    expect(d.title).toBe("Demo AF");
  });
});

describe("F4 · modo LITE (sem navegador)", () => {
  test("browser_open lite: texto + links extraídos sem render", async () => {
    const d = parse(await browser.executeBrowserTool("browser_open", { url: URL_, mode: "lite" }));
    expect(d.mode).toBe("lite");
    expect(d.title).toBe("Demo AF");
    expect(d.text).toContain("clique aqui");
    expect(d.links.some((l: any) => l.text === "um link")).toBe(true);
  });
  test("url inválida → erro limpo (sem crash)", async () => {
    const r = await browser.executeBrowserTool("browser_open", { url: "" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("url obrigatória");
  });
});
