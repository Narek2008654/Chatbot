import { createApp } from "./app.js";
import { env } from "./env.js";
import { createOpenAiClient } from "./ai/client.js";
import { createRetellClient } from "./retell/client.js";
import { createTwilioClient } from "./twilio/client.js";
import { reconcileMissedCalls } from "./retell/reconcile.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});

// Recover from missed webhook deliveries (ngrok blips, restarts, older agents
// with no webhook_url): periodically reconcile against Retell's call list and
// replay anything we don't already have. Runs once shortly after startup, then
// every RECONCILE_INTERVAL_MS.
const RECONCILE_INTERVAL_MS = 5 * 60_000;
const retell = createRetellClient(env.RETELL_API_KEY ?? "", { webhookUrl: env.RETELL_WEBHOOK_URL });
const ai = createOpenAiClient(env.OPENAI_API_KEY ?? "", retell);
const twilio = createTwilioClient(env.TWILIO_ACCOUNT_SID ?? "", env.TWILIO_AUTH_TOKEN ?? "");

async function tickReconcile(): Promise<void> {
  try {
    const r = await reconcileMissedCalls({ ai, twilio });
    if (r.replayed > 0) console.log(`[reconcile] replayed ${r.replayed} of ${r.checked} recent calls`);
  } catch (err) {
    console.error("[reconcile] failed:", err instanceof Error ? err.message : err);
  }
}

setTimeout(tickReconcile, 10_000);
setInterval(tickReconcile, RECONCILE_INTERVAL_MS);
