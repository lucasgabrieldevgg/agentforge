// AgentForge Local — UI (vanilla, sem build step)
"use strict";

const $ = (id) => document.getElementById(id);
const chatInner = $("chatInner"), chatScroll = $("chatScroll"), activityBar = $("activityBar");
const input = $("input"), sendBtn = $("sendBtn"), stopBtn = $("stopBtn"), statusLine = $("statusLine");
const modelSel = $("modelSel"), thinkSel = $("thinkSel"), continuousBtn = $("continuousBtn");
const jobPanel = $("jobPanel"), jpId = $("jpId"), jpStatus = $("jpStatus"), jpMeta = $("jpMeta"), jpGoal = $("jpGoal"), jpTimeline = $("jpTimeline");
const settingsModal = $("settingsModal"), emptyState = $("emptyState");

let state = {
  models: [], hasKey: false, continuous: false,
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
  modelSel.innerHTML = r.models.map((m) =>
    `<option value="${esc(m.id)}" ${m.id === r.settings.preferred_model ? "selected" : ""}>${esc(m.name)}</option>`).join("");
  thinkSel.value = r.settings.thinking_mode;
  continuousBtn.setAttribute("aria-pressed", String(state.continuous));
  $("setWorkspace").value = r.workspace;
  $("setAllow").value = r.allowlist.join(", ");
  $("setMaxIter").value = r.settings.max_iterations;
  $("verLine").textContent = `agentforge local v${r.version}`;
  const note = $("emptyKeyNote");
  if (!state.hasKey) { note.textContent = "⚠ configure sua chave da OpenRouter no ⚙ pra começar"; note.classList.add("warn"); }
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

function addMsg(role, text, ts, model) {
  ensureEmptyHidden();
  const el = document.createElement("div");
  el.className = `msg ${role === "user" ? "user" : "agent"}`;
  const who = role === "user" ? "você" : "agente";
  el.innerHTML = `
    <div class="msg-head">
      <span class="msg-author">${who}</span>
      <span class="msg-time mono">${fmtTime(ts || Date.now())}${role === "agent" && model ? " · " + esc(model.split("/").pop()) : ""}</span>
    </div>
    <div class="msg-body">${esc(text)}</div>`;
  chatInner.appendChild(el);
  scrollBottom();
  return el.querySelector(".msg-body");
}

function addThinking(text, live) {
  const el = document.createElement("div");
  el.className = "thinking" + (live ? " open live" : "");
  el.innerHTML = `
    <button class="thinking-head" type="button">
      <span class="t-label">pensamento</span>
      <span class="t-badge">stream</span>
      <span class="t-chevron">▶</span>
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
  el.innerHTML = `<span class="c-dot"></span><b>${esc(name)}</b><span class="c-target"></span>`;
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
const TL_ICONS = {
  job_started: ["▶", "ok"], iteration: ["↻", "dim"], tool_start: ["⚙", "ok"], tool_result: ["✓", "ok"],
  failover: ["⇄", "warn"], auto_resume: ["↻", "warn"], stall_detected: ["⚠", "warn"],
  continuation: ["⤷", "dim"], declare_done: ["◆", "ok"], job_done: ["■", "ok"],
  job_failed: ["✕", "err"], job_paused: ["⏸", "warn"], notice: ["·", "dim"], content_final: ["✓", "ok"],
};
function tlAdd(type, data, ts) {
  const [ico, cls] = TL_ICONS[type] || ["·", "dim"];
  const li = document.createElement("li");
  let text = "";
  switch (type) {
    case "job_started": text = `job iniciado · ${esc(data.model || "")}${data.continuous ? " · contínuo" : ""}`; break;
    case "iteration": text = `iteração ${data.n}/${data.max}`; break;
    case "tool_start": text = `tool <b>${esc(data.name)}</b> ${esc(JSON.stringify(data.args || {}).slice(0, 90))}`; break;
    case "tool_result": text = `${data.ok ? "✓" : "✕"} ${esc(data.name)} → ${esc(String(data.result || data.error || "").slice(0, 120))}`; break;
    case "failover": text = `API ${esc(data.from)} falhou → troquei pra ${esc(data.to)}`; break;
    case "auto_resume": text = esc(data.why || "retomando…"); break;
    case "stall_detected": text = `parada detectada: ${esc(data.error || "")}`; break;
    case "continuation": text = esc(data.why || ""); break;
    case "declare_done": text = `DECLAROU CONCLUSÃO — ${esc(data.summary || "")}`; break;
    case "job_done": text = "job concluído"; break;
    case "job_failed": text = `falhou: ${esc(data.error || "")}`; break;
    case "job_paused": text = `pausado: ${esc(data.reason || "")}`; break;
    case "content_final": text = "resposta final"; break;
    default: text = esc(data.text || data.why || type);
  }
  li.innerHTML = `<span class="tl-ico ${cls}">${ico}</span><span class="tl-text">${text}</span><span class="tl-time">${fmtTime(ts || Date.now())}</span>`;
  jpTimeline.appendChild(li);
  jpTimeline.scrollTop = jpTimeline.scrollHeight;
}
function setJobStatus(txt, cls) { jpStatus.textContent = txt; jpStatus.className = "jp-status " + (cls || ""); }

// ───────────────────────── status line ────────────────────
function setStatus(txt, live) {
  statusLine.innerHTML = `<span class="${live ? "s-live" : ""}">${esc(txt)}</span><span class="dim">· localhost · dados locais</span>`;
}

// ───────────────────────── SSE ────────────────────────────
let es = null;
function connectSSE() {
  if (es) es.close();
  es = new EventSource("/api/events");
  es.addEventListener("hello", () => setStatus(state.running ? "trabalhando…" : "pronto", state.running));
  es.onerror = () => setStatus("reconectando…", true);
  for (const t of ["job_started", "iteration", "tool_start", "tool_result", "failover", "auto_resume",
    "stall_detected", "continuation", "declare_done", "job_done", "job_failed", "job_paused", "notice"]) {
    es.addEventListener(t, (e) => handleEvent(t, JSON.parse(e.data)));
  }
  es.addEventListener("content_delta", (e) => {
    const d = JSON.parse(e.data);
    if (!state.streamEl) state.streamEl = addMsg("agent", "", Date.now());
    const body = state.streamEl;
    body.textContent += d.delta;
    const cursor = body.querySelector(".cursor");
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
  tlAdd(type, d, d._ts);
  switch (type) {
    case "job_started":
      state.running = true; sendBtn.disabled = true; stopBtn.hidden = false;
      jpId.textContent = d._job; jpGoal.textContent = d.goal;
      jpTimeline.innerHTML = ""; setJobStatus("EM ANDAMENTO"); jpMeta.textContent = "";
      setStatus("trabalhando…", true); break;
    case "iteration":
      jpMeta.textContent = `iter ${d.n}/${d.max}`; break;
    case "tool_start":
      chipUpdate(d.name, d.args && d.args.path ? d.args.path : d.args && d.args.command ? String(d.args.command).slice(0, 40) : "");
      setStatus(`executando ${d.name}…`, true); break;
    case "tool_result":
      chipDone(d.name, d.ok); break;
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
    if (!jobPanel.hidden === false) jobPanel.hidden = false;
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
  if (!jobPanel.hidden && state.jobId) refreshJobPanel(state.jobId);
});
$("jobPanelClose").addEventListener("click", () => { jobPanel.hidden = true; $("jobsBtn").classList.remove("active"); });

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
