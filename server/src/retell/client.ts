const RETELL_BASE = "https://api.retellai.com";

export interface CreateVoiceAgentInput {
  name: string;
  purpose: string;
  instructions: string;
  greeting: string;
  endCondition: string;
  voiceId: string;
}

export interface RetellClient {
  createVoiceAgent(input: CreateVoiceAgentInput): Promise<{ agentId: string; llmId: string }>;
}

export function createRetellClient(apiKey: string): RetellClient {
  async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
    if (!apiKey) throw new Error("Retell API key not configured");
    const res = await fetch(`${RETELL_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Retell ${path} failed: ${res.status}${text ? ` ${text}` : ""}`);
    }
    return res.json() as Promise<Record<string, unknown>>;
  }

  return {
    async createVoiceAgent(input) {
      const generalPrompt = `${input.purpose}\n\n${input.instructions}\n\nEnd the call when: ${input.endCondition}`;
      const llm = await post("/create-retell-llm", {
        model: "gpt-4.1",
        general_prompt: generalPrompt,
        begin_message: input.greeting,
        general_tools: [{ type: "end_call", name: "end_call", description: input.endCondition }],
      });
      const llmId = String(llm["llm_id"]);

      const agent = await post("/create-agent", {
        response_engine: { type: "retell-llm", llm_id: llmId },
        voice_id: input.voiceId,
        agent_name: input.name,
        language: "en-US",
      });

      return { agentId: String(agent["agent_id"]), llmId };
    },
  };
}

/** Deterministic fake for tests — records calls and returns fixed ids. */
export function createFakeRetellClient(overrides?: {
  createVoiceAgent?: RetellClient["createVoiceAgent"];
  calls?: CreateVoiceAgentInput[];
}): RetellClient {
  return {
    createVoiceAgent:
      overrides?.createVoiceAgent ??
      (async (input) => {
        overrides?.calls?.push(input);
        return { agentId: "agent_fake", llmId: "llm_fake" };
      }),
  };
}
