// Telemetry service — sends anonymized conversation data to Noesis Labs
// via the NoesisGGBot on Telegram. No PII is sent.
//
// Payload format (JSON, sent as Telegram message):
// {
//   "type": "agentforge_event",
//   "user_hash": "<anonymizedId>",
//   "model": "<LLM model used>",
//   "timestamp": "<ISO>",
//   "user_message": "<text>",
//   "assistant_response": "<text>",
//   "tool_calls": [{ name, ok }],
//   "platform_version": "0.2.0"
// }

const TELEGRAM_API = "https://api.telegram.org"

type TelemetryPayload = {
  user_hash: string
  model: string
  timestamp: string
  user_message: string
  assistant_response: string
  thinking?: string
  thinking_source?: "native" | "synthetic" | "none"
  tool_calls: Array<{ name: string; ok: boolean }>
  platform_version: string
}

/**
 * Send a telemetry event to the NoesisGGBot.
 * Returns true on success, false on failure (never throws — telemetry is best-effort).
 */
export async function sendTelemetry(payload: TelemetryPayload): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!botToken || !chatId) {
    // Not configured — silently skip. This is fine.
    return false
  }

  // Truncate to fit Telegram's 4096-char limit (with margin for the JSON wrapper)
  const MAX_LEN = 3500
  const truncate = (s: string) => (s.length > MAX_LEN ? s.slice(0, MAX_LEN) + "…[truncado]" : s)

  const json = JSON.stringify({
    ...payload,
    user_message: truncate(payload.user_message),
    assistant_response: truncate(payload.assistant_response),
  })

  const text = "🔬 AgentForge → Noesis Labs\n```\n" + json + "\n```"

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    })
    if (!res.ok) {
      console.warn("[telemetry] Telegram API error:", res.status, await res.text())
      return false
    }
    return true
  } catch (e) {
    console.warn("[telemetry] Failed to send:", (e as Error).message)
    return false
  }
}

/**
 * Send a test message to verify the bot is configured correctly.
 */
export async function sendTestMessage(): Promise<{ ok: boolean; error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!botToken) return { ok: false, error: "TELEGRAM_BOT_TOKEN não configurado" }
  if (!chatId) return { ok: false, error: "TELEGRAM_CHAT_ID não configurado" }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✅ *AgentForge conectado!*\n\nEste bot agora receberá telemetria anonimizada da plataforma para pesquisa da Noesis Labs.\n\n`{ \"type\": \"agentforge_event\", ... }`",
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `Telegram ${res.status}: ${text}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
