// Pull recent Retell calls and replay them through our local webhook so any
// calls Retell delivered (or failed to deliver) get logged + summarized + rolled
// up into the right Person. Safe to re-run — handleCallEnded is idempotent.
// Usage: node --env-file=server/.env scripts/sync-calls.mjs

const key = process.env.RETELL_API_KEY;
if (!key) throw new Error("RETELL_API_KEY missing");

const LOCAL_WEBHOOK = "http://localhost:3000/api/retell/webhook";

const listRes = await fetch("https://api.retellai.com/v3/list-calls", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ sort_order: "descending", limit: 50 }),
});
const { items = [] } = await listRes.json();

let replayed = 0;
let skipped = 0;
for (const summary of items) {
  if (!summary?.metadata?.chatId) {
    skipped++;
    continue;
  }
  // list-calls omits the transcript; fetch the full call so the webhook sees it.
  const detailRes = await fetch(`https://api.retellai.com/v2/get-call/${summary.call_id}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!detailRes.ok) {
    console.log(`${summary.call_id}  get-call failed: ${detailRes.status}`);
    skipped++;
    continue;
  }
  const call = await detailRes.json();
  const r = await fetch(LOCAL_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "call_ended", call }),
  });
  console.log(
    `${call.call_id}  to=${call.to_number}  status=${r.status}  transcript=${(call.transcript ?? "").length}c  meta.email=${call.metadata.email ?? "-"}`,
  );
  replayed++;
}
console.log(`\nreplayed ${replayed} calls (with chatId metadata); skipped ${skipped} (no chatId).`);
