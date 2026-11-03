// AgentForge Local — entrypoint
// Uso: agentforge-local [--port 3174] [--no-open] [--data DIR]
import { ensureDirs } from "./paths";
import { recoverOrphans } from "./supervisor";
import { makeServer } from "./server";

const args = process.argv.slice(2);
const portIdx = args.indexOf("--port");
const portArg = portIdx >= 0 ? parseInt(args[portIdx + 1], 10) : NaN;
const noOpen = args.includes("--no-open");

ensureDirs();

// porta: flag → env → 3174 (com fallback automático se ocupada)
const basePort = !isNaN(portArg) ? portArg : parseInt(process.env.AGENTFORGE_PORT || "3174", 10);

let server: ReturnType<typeof makeServer> | null = null;
for (let port = basePort; port < basePort + 8; port++) {
  try {
    server = makeServer(port);
    break;
  } catch (e: any) {
    if (String(e?.message ?? e).includes("in use") || String(e?.errno ?? "") === "EADDRINUSE") continue;
    throw e;
  }
}
if (!server) { console.error("nenhuma porta livre no range", basePort, "-", basePort + 7); process.exit(1); }

const url = `http://localhost:${server.port}`;
console.log(`\n  ⬡ AgentForge Local v0.1.0`);
console.log(`  → ${url}`);
console.log(`  → dados: ${process.env.AGENTFORGE_HOME ?? "~/.local/share/AgentForge"}`);
console.log(`  → Ctrl+C encerra\n`);

// retoma jobs órfãos de um crash anterior
const orphans = recoverOrphans((e) => { /* eventos pós-boot vão pro log; SSE ainda não tem clientes */ });
if (orphans > 0) console.log(`  ⚠ ${orphans} job(s) órfão(s) marcados como pausados`);

// abre o navegador (a menos que --no-open)
if (!noOpen && process.env.AGENTFORGE_NO_OPEN !== "1") {
  const opener =
    process.env.XDG_CURRENT_DESKTOP?.length ? "xdg-open" :
    process.platform === "darwin" ? "open" : "xdg-open";
  Bun.spawn([opener, url], { stdout: "ignore", stderr: "ignore", stdin: "ignore" }).catch?.(() => {});
}

// shutdown gracioso
const shutdown = () => { console.log("\n  encerrando…"); process.exit(0); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
