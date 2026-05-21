import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgresql://chatbot:chatbot@localhost:5432/chatbot"),
  BETTER_AUTH_SECRET: z.string().default("test-secret-do-not-use-in-production"),
  BETTER_AUTH_URL: z.string().default("http://localhost:3000"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  OPENAI_API_KEY: z.string().optional(),
  CHAT_MODEL: z.string().default("gpt-4o-mini"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.string().default("development"),
});

export const env = envSchema.parse(process.env);
