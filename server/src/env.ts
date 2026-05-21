import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgresql://chatbot:chatbot@localhost:5432/chatbot"),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  OPENAI_API_KEY: z.string().optional(),
  CHAT_MODEL: z.string().default("gpt-4o-mini"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.string().default("development"),
});

export const env = envSchema.parse(process.env);
