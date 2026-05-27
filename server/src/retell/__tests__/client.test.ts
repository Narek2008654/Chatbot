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

  it("places an outbound phone call and returns the call id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ call_id: "call_1" }) } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const out = await createRetellClient("sk_test").createPhoneCall({
      fromNumber: "+12182070114",
      toNumber: "+37491452889",
      agentId: "agent_x",
    });

    expect(out).toEqual({ callId: "call_1" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/v2/create-phone-call");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      from_number: "+12182070114",
      to_number: "+37491452889",
      override_agent_id: "agent_x",
    });
  });

  it("sends dynamic variables as retell_llm_dynamic_variables", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ call_id: "call_3" }) } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await createRetellClient("sk_test").createPhoneCall({
      fromNumber: "+12182070114",
      toNumber: "+37491452889",
      dynamicVariables: { position: "Backend Engineer", caller_name: "Colleen" },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.retell_llm_dynamic_variables).toEqual({
      position: "Backend Engineer",
      caller_name: "Colleen",
    });
  });

  it("omits override_agent_id when no agent is given", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ call_id: "call_2" }) } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await createRetellClient("sk_test").createPhoneCall({
      fromNumber: "+12182070114",
      toNumber: "+37491452889",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).not.toHaveProperty("override_agent_id");
  });

  it("stops an ongoing call (POST /v2/stop-call/:id, no body)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 204, text: async () => "" } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await createRetellClient("sk_test").stopCall("call_123");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/v2/stop-call/call_123");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test");
  });

  it("stops the most recent ongoing call when no id is given", async () => {
    const fetchMock = vi
      .fn()
      // list-calls (newest first): first live one is call_2
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { call_id: "call_3", call_status: "ended" },
            { call_id: "call_2", call_status: "ongoing" },
            { call_id: "call_1", call_status: "registered" },
          ],
        }),
      } as Response)
      // stop-call: 204
      .mockResolvedValueOnce({ ok: true, status: 204, text: async () => "" } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const stopped = await createRetellClient("sk_test").stopLatestOngoingCall();
    expect(stopped).toBe("call_2");

    expect(String(fetchMock.mock.calls[0][0])).toContain("/v3/list-calls");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/v2/stop-call/call_2");
  });

  it("throws an informative error (status + reason) when no call is live", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { call_id: "call_9", call_status: "not_connected", disconnection_reason: "dial_failed" },
          ],
        }),
      } as Response),
    );
    await expect(createRetellClient("sk").stopLatestOngoingCall()).rejects.toThrow(/dial_failed/i);
  });

  it("throws when stopping a call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "not found" } as Response),
    );
    await expect(createRetellClient("sk").stopCall("nope")).rejects.toThrow(/404/);
  });

  it("lists agents (name + id), defaulting a missing name", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { agent_id: "agent_1", agent_name: "Valod" },
        { agent_id: "agent_2", agent_name: null },
      ],
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const agents = await createRetellClient("sk_test").listAgents();

    expect(agents).toEqual([
      { agentId: "agent_1", name: "Valod" },
      { agentId: "agent_2", name: "(unnamed)" },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/list-agents");
    expect(init.method).toBe("GET");
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
