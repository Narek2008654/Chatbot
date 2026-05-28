import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "../../db.js";
import { reconcileMissedCalls } from "../reconcile.js";
import { createFakeAi } from "../../ai/fakeAi.js";
import { createFakeTwilioClient } from "../../twilio/client.js";

const USER = "user_test_reconcile";
const CHAT_ID = "chat_reconcile_1";
const EXISTING_CALL = "call_already_logged";
const MISSING_CALL = "call_missed_by_webhook";

async function cleanup(): Promise<void> {
  await prisma.call.deleteMany({ where: { userId: USER } });
  await prisma.person.deleteMany({ where: { userId: USER } });
  await prisma.chat.deleteMany({ where: { userId: USER } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.chat.create({ data: { id: CHAT_ID, userId: USER, title: "T" } });
  await prisma.call.create({
    data: { id: EXISTING_CALL, userId: USER, chatId: CHAT_ID, disconnectionReason: "user_hangup", durationSec: 5, transcript: "x" },
  });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("reconcileMissedCalls", () => {
  it("replays only calls our DB is missing, then leaves them logged", async () => {
    process.env.RETELL_API_KEY = "sk_test_reconcile";
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v3/list-calls")) {
        return new Response(
          JSON.stringify({ items: [{ call_id: MISSING_CALL }, { call_id: EXISTING_CALL }] }),
          { status: 200 },
        );
      }
      if (url.includes(`/v2/get-call/${MISSING_CALL}`)) {
        return new Response(
          JSON.stringify({
            call_id: MISSING_CALL,
            start_timestamp: 0,
            end_timestamp: 12_000,
            disconnection_reason: "agent_hangup",
            transcript: "Agent: Hi.\nUser: Hello.",
            metadata: { chatId: CHAT_ID, email: "rec@example.com" },
          }),
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    });

    const ai = createFakeAi({ complete: async () => "Brief summary." });
    const twilio = createFakeTwilioClient();
    const result = await reconcileMissedCalls({ ai, twilio, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(result).toEqual({ checked: 2, replayed: 1 });
    const stored = await prisma.call.findUnique({ where: { id: MISSING_CALL } });
    expect(stored?.disconnectionReason).toBe("agent_hangup");
    expect(stored?.summary).toBe("Brief summary.");
  });
});
