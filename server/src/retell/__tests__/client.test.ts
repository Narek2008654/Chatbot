import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRetellClient } from "../client.js";

describe("createRetellClient", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("creates an LLM then an agent and returns ids", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ llm_id: "llm_1" }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ agent_id: "agent_1" }) } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const client = createRetellClient("sk_test");
    const out = await client.createVoiceAgent({
      name: "Support",
      systemPrompt: "You are a hiring manager.\n\nGuardrails: handle silence, sensitive questions...",
      greeting: "Hi!",
      voiceId: "retell-Cimo",
    });

    expect(out).toEqual({ agentId: "agent_1", llmId: "llm_1" });

    const [llmUrl, llmInit] = fetchMock.mock.calls[0];
    expect(String(llmUrl)).toContain("/create-retell-llm");
    expect((llmInit.headers as Record<string, string>).Authorization).toBe("Bearer sk_test");
    const llmBody = JSON.parse(llmInit.body as string);
    expect(llmBody.begin_message).toBe("Hi!");
    // The model-authored prompt is used verbatim as the general_prompt.
    expect(llmBody.general_prompt).toBe("You are a hiring manager.\n\nGuardrails: handle silence, sensitive questions...");

    const [agentUrl, agentInit] = fetchMock.mock.calls[1];
    expect(String(agentUrl)).toContain("/create-agent");
    const agentBody = JSON.parse(agentInit.body as string);
    expect(agentBody.response_engine).toEqual({ type: "retell-llm", llm_id: "llm_1" });
    expect(agentBody.voice_id).toBe("retell-Cimo");
    expect(agentBody.agent_name).toBe("Support");
  });

  it("throws on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 422, text: async () => "bad voice" } as Response),
    );
    await expect(
      createRetellClient("sk").createVoiceAgent({
        name: "x", systemPrompt: "x", greeting: "x", voiceId: "nope",
      }),
    ).rejects.toThrow(/422/);
  });

  it("throws a clear error when no api key is configured", async () => {
    await expect(
      createRetellClient("").createVoiceAgent({
        name: "x", systemPrompt: "x", greeting: "x", voiceId: "v",
      }),
    ).rejects.toThrow(/api key/i);
  });
});
