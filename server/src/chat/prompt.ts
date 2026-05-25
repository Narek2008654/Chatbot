import type { ChatMessage } from "../ai/client.js";

const BASE_SYSTEM = `You are a helpful, friendly assistant. Answer clearly and concisely.

You can create voice agents on RetellAI. When the user asks you to create one, interview them ONE question at a time until you know all of: a name, its purpose, how it should behave, the greeting it speaks first, when it should end the call, and which voice (offer these: retell-Cimo, retell-Adrian). Do not assume answers — ask. Only once you have every field, call the create_retell_voice_agent tool, then tell the user the result.`;

export function buildPrompt(input: {
  facts: string[];
  history: ChatMessage[];
  message: string;
  /** Data URLs of images attached to the new user message (for vision). */
  images?: string[];
}): { system: string; messages: ChatMessage[] } {
  const { facts, history, message, images } = input;

  let system = BASE_SYSTEM;
  if (facts.length > 0) {
    const bullets = facts.map((f) => `- ${f}`).join("\n");
    system += `\n\nWhat you know about the user:\n${bullets}`;
  }

  const userMessage: ChatMessage = { role: "user", content: message };
  if (images && images.length > 0) {
    userMessage.imageDataUrls = images;
  }

  return { system, messages: [...history, userMessage] };
}
