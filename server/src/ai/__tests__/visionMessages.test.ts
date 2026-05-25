import { describe, it, expect } from "vitest";
import { toOpenAiMessages } from "../client.js";

describe("toOpenAiMessages", () => {
  it("keeps text-only messages as a string content", () => {
    const out = toOpenAiMessages("sys", [{ role: "user", content: "hello" }]);
    expect(out[0]).toEqual({ role: "system", content: "sys" });
    expect(out[1]).toEqual({ role: "user", content: "hello" });
  });

  it("expands a user message with images into vision content parts", () => {
    const url = "data:image/png;base64,AAA";
    const out = toOpenAiMessages("sys", [
      { role: "user", content: "what is this", imageDataUrls: [url] },
    ]);
    const msg = out[1];
    expect(Array.isArray(msg.content)).toBe(true);
    const parts = msg.content as Array<Record<string, unknown>>;
    expect(parts[0]).toEqual({ type: "text", text: "what is this" });
    expect(parts[1]).toEqual({ type: "image_url", image_url: { url } });
  });

  it("never adds image parts to assistant messages", () => {
    const out = toOpenAiMessages("sys", [
      { role: "assistant", content: "prior reply", imageDataUrls: ["data:image/png;base64,X"] },
    ]);
    expect(out[1]).toEqual({ role: "assistant", content: "prior reply" });
  });
});
