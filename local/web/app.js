// AgentForge Local — UI (vanilla, sem build step)
"use strict";

const $ = (id) => document.getElementById(id);
const chatInner = $("chatInner"), chatScroll = $("chatScroll"), activityBar = $("activityBar");
const input = $("input"), sendBtn = $("sendBtn"), stopBtn = $("stopBtn"), statusLine = $("statusLine");
const modelSel = $("modelSel"), thinkSel = $("thinkSel"), continuousBtn = $("continuousBtn");
const projectSel = $("projectSel"), newProjectBtn = $("newProjectBtn");
const projectPanel = $("projectPanel"), ppActive = $("ppActive"), ppList = $("ppList"), ppArtifacts = $("ppArtifacts");
const jobPanel = $("jobPanel"), jpId = $("jpId"), jpStatus = $("jpStatus"), jpMeta = $("jpMeta"), jpGoal = $("jpGoal"), jpTimeline = $("jpTimeline");
const settingsModal = $("settingsModal"), emptyState = $("emptyState");

let state = {
  models: [], providers: [], hasKey: false, continuous: false,
  projects: [], activeProject: null,
  jobId: null, running: false,
  streamEl: null,        // elemento .msg-body que recebe deltas
  thinkEl: null,         // thinking block do turno atual
  autoScroll: true,
};

const fmtTime = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ───────────────────────── estado ─────────────────────────
async function loadState() {
  const r = await fetch("/api/state").then((r) => r.json());
  state.models = r.models; state.hasKey = r.settings.has_key; state.continuous = r.settings.continuous_mode;
  // select agrupado por provider (OpenRouter + diretos configurados)
  const groups = new Map();
  for (const m of r.models) {
    const g = m.providerLabel || m.provider || "outros";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(m);
  }
  modelSel.innerHTML = [...groups.entries()].map(([g, ms]) =>
    `<optgroup label="${esc(g)}">${ms.map((m) =>
      `<option value="${esc(m.id)}" ${m.id === r.settings.preferred_model ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</optgroup>`).join("");
  state.providers = r.providers || [];
  thinkSel.value = r.settings.thinking_mode;
  continuousBtn.setAttribute("aria-pressed", String(state.continuous));
  $("setWorkspace").value = r.workspace;
  $("setAllow").value = r.allowlist.join(", ");
  $("setMaxIter").value = r.settings.max_iterations;
  $("verLine").textContent = `agentforge local v${r.version}`;
  $("wsPath").textContent = (r.workspace || "").split(/[\\/]/).filter(Boolean).pop() || "workspace";
  const note = $("emptyKeyNote");
  if (!state.hasKey) { note.textContent = "configure sua chave da OpenRouter nas configurações (engrenagem na barra lateral) pra começar"; note.classList.add("warn"); }
  else { note.textContent = "chave configurada · pronto pra trabalhar"; note.classList.remove("warn"); }
  setStatus("parado");
}

async function loadHistory() {
  const r = await fetch("/api/history").then((r) => r.json());
  if (!r.messages.length) return;
  emptyState.style.display = "none";
  for (const m of r.messages) {
    if (m.role === "user") addMsg("user", m.content, m.created_at);
    else if (m.role === "assistant" && m.content) {
      if (m.thinking) addThinking(m.thinking, false);
      addMsg("agent", m.content, m.created_at, m.model);
    }
  }
}

// ───────────────────────── mensagens ──────────────────────
function ensureEmptyHidden() { if (emptyState) emptyState.style.display = "none"; }

// avatares (SVG inline — sem emoji, sem imagem externa)
const AVA_AGENT = `<svg viewBox="0 0 32 32" width="17" height="17" aria-hidden="true"><g stroke="#3adc9c" stroke-width="3.4" stroke-linecap="square" fill="none"><path d="M15.2 8.2 L8 24.8"/><path d="M16.8 8.2 L24 24.8"/><path d="M11.9 19.4 L26.2 19.4"/></g><rect x="12.2" y="6.2" width="7.6" height="3.4" rx="1.2" fill="#3adc9c"/></svg>`;

function addMsg(role, text, ts, model) {
  ensureEmptyHidden();
  const el = document.createElement("div");
  const who = role === "user" ? "você" : "forja";
  if (role === "user") {
    el.className = "msg user";
    el.innerHTML = `
      <div class="msg-card">
        <div class="msg-head"><span class="msg-author">${who}</span><span class="msg-time mono">${fmtTime(ts || Date.now())}</span></div>
        <div class="msg-body">${esc(text)}</div>
      </div>`;
  } else {
    el.className = "msg agent";
    el.innerHTML = `
      <div class="ava">${AVA_AGENT}</div>
      <div class="msg-card">
        <div class="msg-head"><span class="msg-author">${who}</span><span class="msg-time mono">${fmtTime(ts || Date.now())}${model ? " · " + esc(model.split("/").pop()) : ""}</span></div>
        <div class="msg-body">${esc(text)}</div>
      </div>`;
  }
  chatInner.appendChild(el);
  scrollBottom();
  return el.querySelector(".msg-body");
}

function addThinking(text, live) {
  const el = document.createElement("div");
  el.className = "thinking" + (live ? " open live" : "");
  el.innerHTML = `
    <button class="thinking-head" type="button">
      <span class="t-label">raciocínio</span>
      <span class="t-badge">ao vivo</span>
      <span class="t-chevron"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 1.5L7 5L3 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    </button>
    <div class="thinking-body">${esc(text || "")}</div>`;
  el.querySelector(".thinking-head").addEventListener("click", () => el.classList.toggle("open"));
  chatInner.appendChild(el);
  scrollBottom();
  return el;
}

function scrollBottom() {
  if (state.autoScroll) chatScroll.scrollTop = chatScroll.scrollHeight;
}
chatScroll.addEventListener("scroll", () => {
  state.autoScroll = chatScroll.scrollHeight - chatScroll.scrollTop - chatScroll.clientHeight < 60;
});

// ───────────────────────── activity bar efêmera ───────────
const chips = new Map(); // name → {el, timer, running}
function chipFor(name) {
  let c = chips.get(name);
  if (c && c.el.isConnected) return c;
  const el = document.createElement("span");
  el.className = "chip running";
  el.innerHTML = `<span class="c-dot"></span><b>${esc(name)}</b><span class="c-target"></span><svg class="c-check" width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6.5L5 9.5L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  activityBar.appendChild(el);
  activityBar.classList.add("has-chips");
  c = { el, timer: null };
  chips.set(name, c);
  return c;
}
function chipUpdate(name, target) {
  const c = chipFor(name);
  c.el.className = "chip running";
  c.el.querySelector(".c-target").textContent = target ? "→ " + target : "";
}
function chipDone(name, ok = true) {
  const c = chips.get(name);
  if (!c) return;
  clearTimeout(c.timer);
  c.el.className = "chip " + (ok ? "done" : "running");
  // efêmero: some 3.5s depois de terminar
  c.timer = setTimeout(() => {
    c.el.classList.add("fading");
    setTimeout(() => { c.el.remove(); if (!activityBar.children.length) activityBar.classList.remove("has-chips"); }, 420);
  }, 3500);
}

// ───────────────────────── painel do job ──────────────────
// ícones SVG (11px, stroke 1.5) — um sistema só, sem glifos de texto
const TL_SVG = {
  play: `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3.2 2.2l6.4 3.8-6.4 3.8V2.2z" fill="currentColor"/></svg>`,
  refresh: `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M10.2 6a4.2 4.2 0 1 1-1.3-3M10.2 1.6v2.2H8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  gear: `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="1.7" stroke="currentColor" stroke-width="1.3"/><path d="M6 1.2v1.4M6 9.4v1.4M1.2 6h1.4M9.4 6h1.4M2.6 2.6l1 1M8.4 8.4l1 1M9.4 2.6l-1 1M3.6 8.4l-1 1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  check: `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6.4L5 9.4L10 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  swap: `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M1.5 3.8h7.6M6.9 1.5l2.3 2.3-2.3 2.3M10.5 8.2H2.9M5.1 5.9L2.8 8.2l2.3 2.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  alert: `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1.5l4.6 8H1.4l4.6-8z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M6 5v2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="6" cy="9" r="0.7" fill="currentColor"/></svg>`,
  corner: `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 2v5.5a2 2 0 0 0 2 2h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  diamond: `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1.5L10.5 6 6 10.5 1.5 6 6 1.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
  square: `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="2.2" y="2.2" width="7.6" height="7.6" rx="1.6" fill="currentColor"/></svg>`,
  x: `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.8 2.8l6.4 6.4M9.2 2.8l-6.4 6.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  pause: `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M4.2 2.4v7.2M7.8 2.4v7.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  dot: `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="1.6" fill="currentColor"/></svg>`,
};
const TL_ICONS = {
  job_started: [TL_SVG.play, "ok"], iteration: [TL_SVG.refresh, "dim"], tool_start: [TL_SVG.gear, "ok"], tool_result: [TL_SVG.check, "ok"],
  failover: [TL_SVG.swap, "warn"], auto_resume: [TL_SVG.refresh, "warn"], stall_detected: [TL_SVG.alert, "warn"],
  continuation: [TL_SVG.corner, "dim"], declare_done: [TL_SVG.diamond, "ok"], job_done: [TL_SVG.square, "ok"],
  job_failed: [TL_SVG.x, "err"], job_paused: [TL_SVG.pause, "warn"], notice: [TL_SVG.dot, "dim"], content_final: [TL_SVG.check, "ok"],
};
function tlAdd(type, data, ts) {
  const [ico, cls] = TL_ICONS[type] || ["·", "dim"];
  const li = document.createElement("li");
  let text = "";
  switch (type) {
    case "job_started": text = `job iniciado · <span class="mono">${esc(data.model || "")}</span>${data.continuous ? " · contínuo" : ""}`; break;
    case "iteration": text = `iteração ${data.n}/${data.max}`; break;
    case "tool_start": text = `tool <b>${esc(data.name)}</b> <span class="mono">${esc(JSON.stringify(data.args || {}).slice(0, 80))}</span>`; break;
    case "tool_result": text = `${data.ok ? "✓" : "✕"} ${esc(data.name)} → <span class="mono">${esc(String(data.result || data.error || "").slice(0, 110))}</span>`; break;
    case "failover": text = `API <span class="mono">${esc(data.from)}</span> falhou → troquei pra <span class="mono">${esc(data.to)}</span>`; break;
    case "auto_resume": text = esc(data.why || "retomando…"); break;
    case "stall_detected": text = `parada detectada: <span class="mono">${esc(data.error || "")}</span>`; break;
    case "continuation": text = esc(data.why || ""); break;
    case "declare_done": text = `<span class="tl-done">declarou conclusão</span> — ${esc(data.summary || "")}`; break;
    case "job_done": text = "job concluído"; break;
    case "job_failed": text = `falhou: ${esc(data.error || "")}`; break;
    case "job_paused": text = `pausado: ${esc(data.reason || "")}`; break;
    case "content_final": text = "resposta final"; break;
    default: text = esc(data.text || data.why || type);
  }
  li.innerHTML = `<span class="tl-node ${cls}">${ico}</span><div class="tl-content"><span class="tl-text">${text}</span><span class="tl-time">${fmtTime(ts || Date.now())}</span></div>`;
  jpTimeline.appendChild(li);
  jpTimeline.scrollTop = jpTimeline.scrollHeight;
}
function setJobStatus(txt, cls) { jpStatus.textContent = txt; jpStatus.className = "jp-status " + (cls || ""); }

// ───────────────────────── painel do navegador (F4) ───────
const browserPanel = $("browserPanel"), bpUrl = $("bpUrl"), bpStatus = $("bpStatus"), bpShot = $("bpShot"), bpShotWrap = $("bpShotWrap"), bpSteps = $("bpSteps");

async function loadBrowserStatus() {
  try {
    const st = await fetch("/api/browser/status").then((r) => r.json());
    renderBrowserStatus(st);
  } catch { /* painel fecha sem status */ }
}
function renderBrowserStatus(st) {
  if (st.installed) {
    bpStatus.innerHTML = `<span class="bp-ok">navegador pronto</span> <span class="mono dim">headless-shell r${st.revision}</span>`;
  } else if (st.installing) {
    bpStatus.innerHTML = `<span class="bp-warn">baixando navegador…</span> <span class="mono dim" id="bpProg"></span>`;
  } else {
    bpStatus.innerHTML = `<span class="bp-warn">navegador não instalado</span>
      <button class="mini" id="bpInstall">instalar (~200MB, uma vez)</button>
      <p class="field-help">o modo lite (browser_open mode:'lite') funciona sem navegador</p>`;
    const b = $("bpInstall");
    if (b) b.addEventListener("click", async () => {
      b.disabled = true; b.textContent = "baixando…";
      await fetch("/api/browser/install", { method: "POST" });
    });
  }
}
$("browserBtn").addEventListener("click", () => {
  browserPanel.hidden = !browserPanel.hidden;
  $("browserBtn").classList.toggle("active", !browserPanel.hidden);
  if (!browserPanel.hidden) { loadBrowserStatus(); }
});
$("browserPanelClose").addEventListener("click", () => { browserPanel.hidden = true; $("browserBtn").classList.remove("active"); });

// tool_result de browser_* → alimenta painel (url, screenshot, passos)
function feedBrowserPanel(name, resultText) {
  if (!name.startsWith("browser_")) return;
  let d = null;
  try { d = JSON.parse(resultText); } catch { d = null; }
  const li = document.createElement("li");
  li.innerHTML = `<span class="tl-node dim">${TL_SVG.dot}</span><div class="tl-content"><span class="tl-text"><b>${esc(name)}</b>${d?.title ? " · " + esc(d.title) : ""}</span><span class="tl-time">${fmtTime(Date.now())}</span></div>`;
  if (d?.screenshot) {
    li.innerHTML = `<span class="tl-node ok">${TL_SVG.check}</span><div class="tl-content"><span class="tl-text"><b>${esc(name)}</b> · <span class="mono">${esc(d.screenshot)}</span></span><span class="tl-time">${fmtTime(Date.now())}</span></div>`;
  }
  bpSteps.prepend(li);
  if (d?.url) bpUrl.textContent = String(d.url).replace(/^https?:\/\//, "").slice(0, 40);
  if (d?.screenshot) {
    bpShot.src = `/api/file?path=${encodeURIComponent(d.screenshot)}`;
    bpShotWrap.hidden = false;
    // abre o painel sozinho na primeira evidência
    if (browserPanel.hidden) { browserPanel.hidden = false; $("browserBtn").classList.add("active"); loadBrowserStatus(); }
  }
  if (name === "browser_open" && d?.mode === "lite" && d?.text) {
    const li2 = document.createElement("li");
    li2.innerHTML = `<span class="tl-node dim">${TL_SVG.corner}</span><div class="tl-content"><span class="tl-text">lite: ${esc(String(d.text).slice(0, 90))}…</span></div>`;
    bpSteps.prepend(li2);
  }
}

// ───────────────────────── projetos (dados gerenciados) ──
async function loadProjects() {
  const r = await fetch("/api/projects").then((r) => r.json());
  state.projects = r.projects || [];
  state.activeProject = r.active;
  projectSel.innerHTML = state.projects.map((p) =>
    `<option value="${esc(p.id)}" ${p.id === r.active ? "selected" : "">}${esc(p.name)} <span class='dim'>(${p.jobs}j/${p.artifacts}a)</span></option>`).join("");
  const act = state.projects.find((p) => p.id === r.active);
  ppActive.textContent = act ? act.name : "";
  if (state.projects.find((p) => p.id === r.active)) renderProjectDetail(r.active);
}
async function renderProjectDetail(id) {
  const r = await fetch(`/api/projects/${id}`).then((r) => r.json());
  if (!r.project) return;
  ppActive.textContent = r.project.name;
  const stMap = { done: ["✓", "ok"], failed: ["✕", "err"], paused: ["⏸", "warn"], running: ["●", "live"], queued: ["·", "dim"] };
  ppList.innerHTML = (r.jobs || []).slice(0, 20).map((j) => {
    const [ico, cls] = stMap[j.status] || ["·", "dim"];
    return `<div class="pp-job" data-job="${esc(j.id)}" title="${esc(j.goal).slice(0, 120)}">
      <span class="pp-job-st ${cls}">${ico}</span>
      <span class="pp-job-goal">${esc(j.goal.slice(0, 60))}</span>
      <span class="pp-job-meta mono">${new Date(j.updated_at).toLocaleDateString("pt-BR")}</span>
    </div>`;
  }).join("") || "<p class='field-help'>nenhum job neste projeto ainda</p>";
  ppList.querySelectorAll(".pp-job").forEach((el) =>
    el.addEventListener("click", () => {
      state.jobId = el.dataset.job;
      jobPanel.hidden = false;
      refreshJobPanel(state.jobId);
    }));
  ppArtifacts.innerHTML = (r.artifacts || []).map((a) => {
    const isImg = /\.(png|jpe?g|svg)$/i.test(a.path);
    return `<li class="pp-art" data-path="${esc(a.path)}" data-img="${isImg}">
      <span class="pp-art-ico">${isImg ? TL_SVG.square : TL_SVG.check}</span>
      <span class="pp-art-path mono">${esc(a.path)}</span>
      <span class="pp-art-meta mono">${a.op === "screenshot" ? "evidência" : "arquivo"} · ${Math.max(1, Math.round(a.bytes / 1024))}KB</span>
    </li>`;
  }).join("") || "<p class='field-help'>nada produzido ainda</p>";
  ppArtifacts.querySelectorAll(".pp-art").forEach((el) =>
    el.addEventListener("click", () => {
      if (el.dataset.img === "true") {
        bpShot.src = `/api/file?path=${encodeURIComponent(el.dataset.path)}`;
        bpShotWrap.hidden = false;
        browserPanel.hidden = false;
        $("browserBtn").classList.add("active");
      } else {
        fetch(`/api/file?path=${encodeURIComponent(el.dataset.path)}`).then((r) => r.text()).then((t) => {
          addMsg("agent", `📄 ${el.dataset.path}\n\n${t.slice(0, 2000)}`, Date.now());
        });
      }
    }));
}
projectSel.addEventListener("change", async () => {
  await fetch("/api/projects/active", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: projectSel.value }) });
  await loadState();
  await loadProjects();
});
newProjectBtn.addEventListener("click", async () => {
  const name = prompt("Nome do novo projeto (workspace próprio):", "");
  if (!name || !name.trim()) return;
  await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
  await loadState();
  await loadProjects();
});
$("projectsBtn").addEventListener("click", () => {
  projectPanel.hidden = !projectPanel.hidden;
  $("projectsBtn").classList.toggle("active", !projectPanel.hidden);
  if (!projectPanel.hidden) loadProjects();
});
$("projectPanelClose").addEventListener("click", () => { projectPanel.hidden = true; $("projectsBtn").classList.remove("active"); });

// ───────────────────────── status line ────────────────────
function setStatus(txt, live) {
  statusLine.innerHTML = `<span class="s-dot${live ? " live" : ""}"></span><span class="s-txt ${live ? "s-live" : ""}">${esc(txt)}</span><span class="s-sep">·</span><span>localhost</span><span class="s-sep">·</span><span>dados locais</span>`;
}

// ───────────────────────── SSE ────────────────────────────
let es = null;
function connectSSE() {
  if (es) es.close();
  es = new EventSource("/api/events");
  es.onopen = () => $("daemonDot").classList.add("on");
  es.addEventListener("hello", () => { $("daemonDot").classList.add("on"); setStatus(state.running ? "trabalhando…" : "pronto", state.running); });
  es.onerror = () => { $("daemonDot").classList.remove("on"); setStatus("reconectando…", true); };
  for (const t of ["job_started", "iteration", "tool_start", "tool_result", "failover", "auto_resume",
    "stall_detected", "continuation", "declare_done", "job_done", "job_failed", "job_paused", "notice"]) {
    es.addEventListener(t, (e) => handleEvent(t, JSON.parse(e.data)));
  }
  es.addEventListener("project_switch", () => { loadState(); loadProjects(); });
  es.addEventListener("browser_install", (e) => {
    const d = JSON.parse(e.data);
    if (d.done) { loadBrowserStatus(); }
    else {
      const el = $("bpProg");
      if (el) el.textContent = `${d.pct}% · ${d.mb}MB`;
    }
  });
  es.addEventListener("content_delta", (e) => {
    const d = JSON.parse(e.data);
    if (!state.streamEl) state.streamEl = addMsg("agent", "", Date.now());
    const body = state.streamEl;
    const cur = body.querySelector(".cursor");
    if (cur) cur.remove();
    body.textContent += d.delta;
    body.insertAdjacentHTML("beforeend", '<span class="cursor"></span>');
    scrollBottom();
  });
  es.addEventListener("thinking_delta", (e) => {
    const d = JSON.parse(e.data);
    if (!state.thinkEl) state.thinkEl = addThinking("", true);
    state.thinkEl.querySelector(".thinking-body").textContent += d.delta;
    scrollBottom();
  });
  es.addEventListener("content_final", (e) => {
    const d = JSON.parse(e.data);
    if (state.thinkEl) { state.thinkEl.classList.remove("live"); state.thinkEl.classList.remove("open"); }
    if (state.streamEl && d.content) { state.streamEl.textContent = d.content; }
    state.streamEl = null; state.thinkEl = null;
  });
}

function handleEvent(type, d) {
  // adota job que começou (mesmo se foi iniciado fora da UI — ex.: outra aba/reload)
  if (type === "job_started" && !state.running) {
    state.jobId = d._job;
    jobPanel.hidden = false;
    $("jobsBtn").classList.add("active");
  }
  if (d._job && d._job !== state.jobId) return;
  if (type === "job_started") jpTimeline.innerHTML = ""; // limpa antes de registrar o início
  tlAdd(type, d, d._ts);
  switch (type) {
    case "job_started":
      state.running = true; sendBtn.disabled = true; stopBtn.hidden = false;
      jpId.textContent = d._job; jpGoal.textContent = d.goal;
      setJobStatus("EM ANDAMENTO"); jpMeta.textContent = "";
      setStatus("trabalhando…", true); break;
    case "iteration":
      jpMeta.textContent = `iter ${d.n}/${d.max}`; break;
    case "tool_start":
      chipUpdate(d.name, d.args && d.args.path ? d.args.path : d.args && d.args.command ? String(d.args.command).slice(0, 40) : "");
      setStatus(`executando ${d.name}…`, true); break;
    case "tool_result":
      chipDone(d.name, d.ok);
      feedBrowserPanel(d.name, String(d.result || ""));
      break;
    case "failover":
      chipUpdate("router", `${d.from.split("/").pop()}→${d.to.split("/").pop()}`); chipDone("router"); break;
    case "auto_resume":
      chipUpdate("supervisor", "retomou"); chipDone("supervisor"); setStatus("retomando sozinho…", true); break;
    case "stall_detected":
      chipUpdate("supervisor", "parada detectada"); break;
    case "declare_done":
      setJobStatus("DECLARADO CONCLUÍDO PELO AGENTE"); jpGoal.textContent = d.summary || jpGoal.textContent; break;
    case "job_done":
      state.running = false; sendBtn.disabled = false; stopBtn.hidden = true;
      setJobStatus("CONCLUÍDO"); setStatus("pronto"); break;
    case "job_failed":
      state.running = false; sendBtn.disabled = false; stopBtn.hidden = true;
      setJobStatus("FALHOU", "err"); setStatus("falhou", false); break;
    case "job_paused":
      state.running = false; sendBtn.disabled = false; stopBtn.hidden = true;
      setJobStatus("PAUSADO", "warn"); setStatus("pausado"); break;
  }
}

// ───────────────────────── enviar ─────────────────────────
async function send() {
  const text = input.value.trim();
  if (!text || state.running) return;
  input.value = ""; autoGrow();
  addMsg("user", text, Date.now());
  state.streamEl = null; state.thinkEl = null;
  setStatus("começando job…", true);
  try {
    const r = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    }).then((r) => r.json());
    if (r.jobId) state.jobId = r.jobId;
    jobPanel.hidden = false;
  } catch (e) {
    addMsg("agent", "erro ao iniciar o job: " + e.message, Date.now());
    state.running = false; sendBtn.disabled = false;
  }
}
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
});
sendBtn.addEventListener("click", send);
stopBtn.addEventListener("click", async () => {
  if (state.jobId) await fetch("/api/stop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: state.jobId }) });
});
function autoGrow() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
}
input.addEventListener("input", autoGrow);

// sugestões do estado vazio
document.querySelectorAll(".sug").forEach((b) =>
  b.addEventListener("click", () => { input.value = b.dataset.fill; input.focus(); autoGrow(); }));

// ───────────────────────── controles ──────────────────────
$("chatNav").addEventListener("click", () => {
  jobPanel.hidden = true;
  $("jobsBtn").classList.remove("active");
  $("chatNav").classList.add("active");
  input.focus();
});
modelSel.addEventListener("change", () => save({ preferred_model: modelSel.value }));
thinkSel.addEventListener("change", () => save({ thinking_mode: thinkSel.value }));
continuousBtn.addEventListener("click", async () => {
  state.continuous = !state.continuous;
  continuousBtn.setAttribute("aria-pressed", String(state.continuous));
  await save({ continuous_mode: state.continuous });
});
async function save(patch) { await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); }

$("jobsBtn").addEventListener("click", () => {
  jobPanel.hidden = !jobPanel.hidden;
  $("jobsBtn").classList.toggle("active", !jobPanel.hidden);
  $("chatNav").classList.toggle("active", jobPanel.hidden);
  if (!jobPanel.hidden && state.jobId) refreshJobPanel(state.jobId);
});
$("jobPanelClose").addEventListener("click", () => { jobPanel.hidden = true; $("jobsBtn").classList.remove("active"); $("chatNav").classList.add("active"); });

async function refreshJobPanel(id) {
  const r = await fetch(`/api/jobs/${id}`).then((r) => r.json());
  if (!r.job) return;
  jpId.textContent = r.job.id;
  jpGoal.textContent = r.job.goal;
  jpMeta.textContent = `iter ${r.job.iterations}`;
  const map = { done: ["CONCLUÍDO", ""], failed: ["FALHOU", "err"], paused: ["PAUSADO", "warn"], running: ["EM ANDAMENTO", ""] };
  const [txt, cls] = map[r.job.status] || [r.job.status, ""];
  setJobStatus(txt, cls);
  jpTimeline.innerHTML = "";
  for (const ev of r.events) tlAdd(ev.type, JSON.parse(ev.data), ev.created_at);
}

// ───────────────────────── settings ───────────────────────
$("settingsBtn").addEventListener("click", async () => {
  const r = await fetch("/api/state").then((r) => r.json());
  $("setKey").value = ""; $("setKey").placeholder = r.settings.has_key ? r.settings.key_masked : "sk-or-v1-…";
  const ph = (id, prov, ph) => { $(id).value = ""; $(id).placeholder = prov.has_key ? prov.key_masked : ph; };
  const prov = (id) => (r.providers || []).find((p) => p.setting_key === id) || { has_key: false, key_masked: "" };
  ph("setGroq", prov("groq_key"), "Groq · gsk_…");
  ph("setGoogle", prov("google_ai_key"), "Google AI Studio · AIza…");
  ph("setGithub", prov("github_models_key"), "GitHub Models · ghp_… (PAT)");
  $("setMaxIter").value = r.settings.max_iterations;
  settingsModal.showModal();
});
$("settingsClose").addEventListener("click", () => settingsModal.close());
$("setKeyEye").addEventListener("click", () => {
  const k = $("setKey"); k.type = k.type === "password" ? "text" : "password";
});
$("settingsSave").addEventListener("click", async () => {
  const patch = {
    preferred_model: modelSel.value,
    thinking_mode: thinkSel.value,
    max_iterations: parseInt($("setMaxIter").value, 10) || 12,
  };
  const key = $("setKey").value.trim();
  if (key) patch.openrouter_key = key;
  for (const [id, k] of [["setGroq", "groq_key"], ["setGoogle", "google_ai_key"], ["setGithub", "github_models_key"]]) {
    const v = $(id).value.trim();
    if (v) patch[k] = v;
  }
  const allow = $("setAllow").value.split(",").map((s) => s.trim()).filter(Boolean);
  if (allow.length) patch.allowlist = allow;
  await save(patch);
  settingsModal.close();
  loadState();
});
$("clearBtn").addEventListener("click", async () => {
  if (!confirm("Apagar toda a conversa? (arquivos do workspace não são apagados)")) return;
  await fetch("/api/history", { method: "DELETE" });
  location.reload();
});
$("shutdownBtn").addEventListener("click", async () => {
  if (!confirm("Encerrar o AgentForge Local?")) return;
  await fetch("/api/shutdown", { method: "POST" });
  document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;font-family:monospace;color:#10b981">app encerrado — pode fechar esta aba</div>';
});

// ───────────────────────── boot ───────────────────────────
loadState().then(() => {
  loadHistory();
  loadProjects();
  connectSSE();
  // retoma o job mais recente se ainda estiver ativo (ex.: reload no meio do trabalho)
  fetch("/api/jobs").then((r) => r.json()).then(({ jobs }) => {
    const active = jobs?.find((j) => j.status === "running" || j.status === "queued");
    if (active) {
      state.jobId = active.id;
      state.running = active.status === "running";
      sendBtn.disabled = state.running;
      stopBtn.hidden = !state.running;
      jobPanel.hidden = false;
      $("jobsBtn").classList.add("active");
      refreshJobPanel(active.id);
      if (state.running) setStatus("trabalhando…", true);
    }
  });
});
