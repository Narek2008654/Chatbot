import OpenAI from "openai";
import { env } from "../env.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Data URLs of images attached to this (user) message, for vision. */
  imageDataUrls?: string[];
}

type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface OpenAiMessage {
  role: "system" | "user" | "assistant";
  content: string | OpenAiContentPart[];
}

/**
 * Map our messages to OpenAI chat format. A user message carrying images is
 * expanded into multimodal content parts (text + image_url) for vision.
 */
export function toOpenAiMessages(system: string, messages: ChatMessage[]): OpenAiMessage[] {
  const out: OpenAiMessage[] = [{ role: "system", content: system }];
  for (const m of messages) {
    if (m.role === "user" && m.imageDataUrls && m.imageDataUrls.length > 0) {
      const parts: OpenAiContentPart[] = [{ type: "text", text: m.content }];
      for (const url of m.imageDataUrls) {
        parts.push({ type: "image_url", image_url: { url } });
      }
      out.push({ role: "user", content: parts });
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}

export interface AiClient {
  embed(text: string): Promise<number[]>;
  streamChat(input: {
    system: string;
    messages: ChatMessage[];
  }): AsyncIterable<string>;
  complete(prompt: string): Promise<string>;
}

export function createOpenAiClient(apiKey: string): AiClient {
  const openai = new OpenAI({ apiKey });

  return {
    async embed(text: string): Promise<number[]> {
      const res = await openai.embeddings.create({
        model: env.EMBEDDING_MODEL,
        input: text,
      });
      return res.data[0].embedding;
    },

    async *streamChat({
      system,
      messages,
    }: {
      system: string;
      messages: ChatMessage[];
    }): AsyncGenerator<string> {
      const stream = await openai.chat.completions.create({
        model: env.CHAT_MODEL,
        messages: toOpenAiMessages(system, messages) as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        stream: true,
      });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          yield delta;
        }
      }
    },

    async complete(prompt: string): Promise<string> {
      const res = await openai.chat.completions.create({
        model: env.CHAT_MODEL,
        messages: [{ role: "user", content: prompt }],
      });
      return res.choices[0].message.content ?? "";
    },
  };
}
