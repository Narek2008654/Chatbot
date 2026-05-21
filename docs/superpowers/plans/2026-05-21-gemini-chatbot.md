# Gemini Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web chatbot using Gemini with email/password auth (with verification), persistent chat threads, and cross-conversation semantic memory.

**Architecture:** npm-workspaces monorepo. `server/` = Express + TS, Better Auth, Prisma/Postgres+pgvector, Gemini via `@google/genai`, SSE streaming. `client/` = Vite + React + TS + Tailwind + shadcn/ui. Memory = facts embedded with `text-embedding-004`, retrieved by pgvector cosine similarity, injected into the prompt; new facts extracted after each turn.

**Tech Stack:** Node 24, Express, TypeScript, Prisma, PostgreSQL + pgvector, Better Auth, nodemailer, @google/genai, Vite, React, Tailwind, shadcn/ui, React Router, TanStack Query, Vitest, supertest, React Testing Library.

---

## Conventions

- Backend tests: Vitest + supertest. Run with `npm test -w server`.
- Frontend tests: Vitest + RTL. Run with `npm test -w client`.
- Commit after each task with the message shown.
- External services (Gemini) are accessed through a thin interface so tests can inject fakes — never call the real API in tests.

---

## Phase 0 — Scaffolding & Infra

### Task 0.1: Root workspace + Postgres/pgvector + README

**Files:**
- Create: `package.json`, `.gitignore`, `docker-compose.yml`, `README.md`, `.env.example`

- [ ] **Step 1: Root `package.json`** (workspaces + orchestration scripts)

```json
{
  "name": "chatbot",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev": "concurrently -n server,client -c blue,green \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "npm run dev -w server",
    "dev:client": "npm run dev -w client",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "test": "npm test -w server && npm test -w client"
  },
  "devDependencies": { "concurrently": "^9.1.0" }
}
```

- [ ] **Step 2: `docker-compose.yml`** (Postgres with pgvector preinstalled)

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: chatbot
      POSTGRES_PASSWORD: chatbot
      POSTGRES_DB: chatbot
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
volumes:
  pgdata:
```

- [ ] **Step 3: `.gitignore`**

```
node_modules/
dist/
.env
*.local
```

- [ ] **Step 4: `.env.example`** documenting all env vars (DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, CLIENT_URL, GEMINI_API_KEY, CHAT_MODEL, EMBEDDING_MODEL, SMTP_*; VITE_API_URL for client).

- [ ] **Step 5: `README.md`** with prerequisites (Docker, Node 24, Gemini key) and run steps (`npm install`, `npm run db:up`, migrate, `npm run dev`).

- [ ] **Step 6: Commit** — `chore: root workspace, docker postgres+pgvector, docs`

### Task 0.2: Server scaffold

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`, `server/src/env.ts`, `server/src/index.ts`, `server/src/app.ts`

- [ ] **Step 1:** `server/package.json` — deps: `express`, `cors`, `zod`, `better-auth`, `@prisma/client`, `@google/genai`, `nodemailer`, `dotenv`. devDeps: `typescript`, `tsx`, `vitest`, `supertest`, `@types/*`, `prisma`. Scripts: `dev` (`tsx watch src/index.ts`), `build`, `start`, `test` (`vitest run`), `test:watch`, `db:migrate` (`prisma migrate dev`), `db:generate`.
- [ ] **Step 2:** `tsconfig.json` (NodeNext, strict, `outDir dist`), `vitest.config.ts` (node environment).
- [ ] **Step 3:** `src/env.ts` — load dotenv, validate required env with zod, export typed `env`.
- [ ] **Step 4:** `src/app.ts` — export a `createApp()` returning the Express app (so tests can import it without binding a port). Add `cors({ origin: env.CLIENT_URL, credentials: true })` and `express.json()`. Add `GET /api/health` → `{ ok: true }`.
- [ ] **Step 5:** `src/index.ts` — `createApp().listen(PORT)`.
- [ ] **Step 6: Test** `src/__tests__/health.test.ts`:

```ts
import request from "supertest";
import { createApp } from "../app";
test("health check returns ok", async () => {
  const res = await request(createApp()).get("/api/health");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
});
```

- [ ] **Step 7:** Run `npm test -w server` → PASS.
- [ ] **Step 8: Commit** — `feat(server): express scaffold with health check`

### Task 0.3: Client scaffold + Tailwind + shadcn

**Files:** `client/` via Vite.

- [ ] **Step 1:** Scaffold: `npm create vite@latest client -- --template react-ts`.
- [ ] **Step 2:** Install Tailwind v4 + shadcn deps; configure `tailwind` and path alias `@/*` in `tsconfig` + `vite.config.ts`.
- [ ] **Step 3:** `npx shadcn@latest init` (neutral base color). Add components: `button input card form label sonner scroll-area avatar dropdown-menu dialog textarea`.
- [ ] **Step 4:** Add deps: `react-router-dom`, `@tanstack/react-query`, `better-auth`, `react-markdown`. Configure Vitest + RTL (`client/vitest.config.ts` jsdom, `src/test/setup.ts`).
- [ ] **Step 5: Smoke test** `src/__tests__/smoke.test.tsx` rendering a shadcn `<Button>Hi</Button>` and asserting text present. Run → PASS.
- [ ] **Step 6: Commit** — `feat(client): vite react + tailwind + shadcn scaffold`

---

## Phase 1 — Database & Prisma

### Task 1.1: Prisma schema + Better Auth + app models

**Files:** `server/prisma/schema.prisma`, migration under `server/prisma/migrations/`.

- [ ] **Step 1:** `prisma init`. Set datasource `postgresql` from `DATABASE_URL`, `previewFeatures = ["postgresqlExtensions"]`, and `extensions = [vector]`.
- [ ] **Step 2:** Define Better Auth models (`User`, `Session`, `Account`, `Verification`) per Better Auth's Prisma schema (fields: User.id/email/emailVerified/name/image/timestamps; Session token/expiresAt/userId; Account providerId/accountId/password/userId; Verification identifier/value/expiresAt).
- [ ] **Step 3:** App models:

```prisma
model Chat {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String    @default("New chat")
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  messages  Message[]
}

model Message {
  id        String   @id @default(cuid())
  chatId    String
  chat      Chat     @relation(fields: [chatId], references: [id], onDelete: Cascade)
  role      String   // "user" | "assistant"
  content   String
  createdAt DateTime @default(now())
}

model Memory {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  content   String
  createdAt DateTime @default(now())
  // embedding column added via raw SQL in migration (vector(768))
}
```

- [ ] **Step 4:** `prisma migrate dev --name init` (requires `npm run db:up` first).
- [ ] **Step 5: Commit** — `feat(server): prisma schema for auth + chat + memory`

### Task 1.2: pgvector column + index (manual migration)

**Files:** new migration `server/prisma/migrations/<ts>_memory_vector/migration.sql`.

- [ ] **Step 1:** Create an empty migration: `prisma migrate dev --create-only --name memory_vector`.
- [ ] **Step 2:** Add SQL:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "Memory" ADD COLUMN "embedding" vector(768);
CREATE INDEX IF NOT EXISTS memory_embedding_idx
  ON "Memory" USING hnsw ("embedding" vector_cosine_ops);
```

- [ ] **Step 3:** Apply: `prisma migrate dev`.
- [ ] **Step 4: Commit** — `feat(server): add pgvector embedding column + hnsw index`

---

## Phase 2 — Authentication (Better Auth)

### Task 2.1: Mailer (dev console + pluggable SMTP)

**Files:** Create `server/src/mailer.ts`; Test `server/src/__tests__/mailer.test.ts`.

- [ ] **Step 1: Test** — when `SMTP_HOST` is unset, `sendMail` resolves and invokes a console logger with the recipient + body (inject the logger for assertion).

```ts
import { makeMailer } from "../mailer";
test("dev mailer logs instead of sending", async () => {
  const logs: string[] = [];
  const mailer = makeMailer({ smtp: undefined, log: (m) => logs.push(m) });
  await mailer.sendMail({ to: "a@b.com", subject: "Verify", html: "<a href='x'>x</a>" });
  expect(logs.join("\n")).toContain("a@b.com");
});
```

- [ ] **Step 2:** Run → FAIL (no module).
- [ ] **Step 3:** Implement `makeMailer({ smtp, log })`: if `smtp` provided, build a nodemailer transport and send; else call `log(...)` with the message. Export a default `mailer` built from `env`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(server): pluggable mailer with dev console fallback`

### Task 2.2: Better Auth config

**Files:** Create `server/src/auth.ts`.

- [ ] **Step 1:** Configure `betterAuth({ database: prismaAdapter(prisma, { provider: "postgresql" }), emailAndPassword: { enabled: true, requireEmailVerification: true }, emailVerification: { sendOnSignUp: true, sendVerificationEmail: async ({ user, url }) => mailer.sendMail({ to: user.email, subject: "Verify your email", html: link(url) }) }, trustedOrigins: [env.CLIENT_URL], secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL })`.
- [ ] **Step 2:** Export `auth`. (Better Auth generates/uses the Prisma models from Task 1.1.)
- [ ] **Step 3: Commit** — `feat(server): better-auth config with email verification`

### Task 2.3: Mount auth + session middleware

**Files:** Modify `server/src/app.ts`; Create `server/src/middleware/requireAuth.ts`; Test `server/src/__tests__/auth.test.ts`.

- [ ] **Step 1:** Mount `app.all("/api/auth/*", toNodeHandler(auth))` BEFORE `express.json()` per Better Auth express guide (json parser added after, or scoped).
- [ ] **Step 2:** `requireAuth`: read session via `auth.api.getSession({ headers })`; if none → `401`; else attach `req.user` and `next()`.
- [ ] **Step 3: Test** (integration, real test DB): sign up via `POST /api/auth/sign-up/email` → 200 and user `emailVerified=false`; sign-in before verification → rejected; a protected probe route returns 401 without a session.

```ts
test("signup creates an unverified user", async () => {
  const app = createApp();
  const res = await request(app).post("/api/auth/sign-up/email")
    .send({ email: "u@test.com", password: "password123", name: "U" });
  expect(res.status).toBe(200);
  const u = await prisma.user.findUnique({ where: { email: "u@test.com" } });
  expect(u?.emailVerified).toBe(false);
});
```

- [ ] **Step 4:** Add a temporary `GET /api/me` guarded by `requireAuth` returning `req.user`; test it returns 401 unauthenticated.
- [ ] **Step 5:** Run → PASS (ensure test DB reset between runs).
- [ ] **Step 6: Commit** — `feat(server): mount better-auth + requireAuth middleware`

---

## Phase 3 — Gemini & Memory Services

### Task 3.1: Gemini client wrapper

**Files:** Create `server/src/ai/gemini.ts` (interface `AiClient` + real impl); Test `server/src/ai/__tests__/fakeAi.test.ts` (verifies the fake conforms).

- [ ] **Step 1:** Define interface:

```ts
export interface AiClient {
  embed(text: string): Promise<number[]>;            // 768-dim
  streamChat(input: { system: string; messages: {role:"user"|"model"; text:string}[] })
    : AsyncIterable<string>;                          // yields text chunks
  complete(prompt: string): Promise<string>;          // non-streamed, for extraction
}
```

- [ ] **Step 2:** Implement `createGeminiClient(apiKey)` using `@google/genai`: `embed` → `models.embedContent({ model: EMBEDDING_MODEL, contents: text })`; `streamChat` → `models.generateContentStream`; `complete` → `models.generateContent`.
- [ ] **Step 3:** Create `server/src/ai/fakeAi.ts` — deterministic fake: `embed` returns a seeded 768-vector from the text hash; `streamChat` yields canned chunks; `complete` returns a fixed string. Used by all service tests.
- [ ] **Step 4: Test** the fake satisfies the interface (embed length 768, streamChat yields, complete returns string).
- [ ] **Step 5: Commit** — `feat(server): gemini ai client interface + fake`

### Task 3.2: Memory store (embed + insert + similarity search)

**Files:** Create `server/src/memory/store.ts`; Test `server/src/memory/__tests__/store.test.ts` (real test DB + fake AI).

- [ ] **Step 1: Test** — `addMemory(userId, "User likes hiking")` then `searchMemories(userId, "outdoor activities", 5)` returns the inserted fact; memories are scoped per user.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement:
  - `addMemory(userId, content)`: `embed(content)`, then raw insert `INSERT INTO "Memory"(id,"userId",content,embedding,"createdAt") VALUES (...,$emb::vector,...)`.
  - `searchMemories(userId, query, k)`: `embed(query)`, then `SELECT content FROM "Memory" WHERE "userId"=$1 ORDER BY embedding <=> $2::vector LIMIT $3`.
  - Use `prisma.$executeRawUnsafe` / `$queryRawUnsafe` with the vector serialized as `'[a,b,...]'`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(server): pgvector memory store (add + search)`

### Task 3.3: Prompt builder (pure function)

**Files:** Create `server/src/chat/prompt.ts`; Test `server/src/chat/__tests__/prompt.test.ts`.

- [ ] **Step 1: Test** — `buildPrompt({ facts, history, message })` returns a `system` string containing each fact under a "What you know about the user" header, and `messages` ending with the new user message in `{role:"user", text}` form.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement pure function: base system instructions + (if facts) a memory section listing facts + maps history `Message[]` to `{role, text}` (`assistant`→`model`), appends new user message.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(server): prompt builder with memory injection`

### Task 3.4: Memory extraction

**Files:** Create `server/src/memory/extract.ts`; Test `server/src/memory/__tests__/extract.test.ts` (fake AI).

- [ ] **Step 1: Test** — `extractFacts(ai, userMsg, assistantMsg)` parses the fake's JSON-array `complete()` output into `string[]`; returns `[]` on unparseable output (no throw).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement: build an extraction prompt asking for a JSON array of durable user facts (or `[]`); call `ai.complete`; parse JSON defensively; return `string[]`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(server): memory extraction from a chat exchange`

---

## Phase 4 — Chat API

### Task 4.1: Chat CRUD + ownership

**Files:** Create `server/src/routes/chats.ts`; Modify `server/src/app.ts`; Test `server/src/__tests__/chats.test.ts`.

- [ ] **Step 1: Test** (authenticated via a sign-in helper that returns the session cookie): create chat → 200 with id; list → includes it; another user cannot GET/DELETE it (404/403); delete works for owner.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement router under `requireAuth`: `POST /` create; `GET /` list user's chats (newest first); `GET /:id` (owner-scoped, 404 otherwise); `DELETE /:id` (owner-scoped); `GET /:id/messages`. zod-validate bodies.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(server): chat CRUD routes with ownership checks`

### Task 4.2: SSE streaming chat turn

**Files:** Create `server/src/routes/stream.ts`; Modify `server/src/app.ts`; Test `server/src/__tests__/stream.test.ts` (fake AI injected).

- [ ] **Step 1: Test** — `POST /api/chats/:id/stream` with `{ content }` for an owned chat: responds `text/event-stream`, body contains the fake's streamed chunks and a final `done` event; afterward a `user` and an `assistant` Message row exist for the chat.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement (inject `AiClient` + memory store via app factory for testability):
  1. validate session + chat ownership;
  2. save user message;
  3. `searchMemories(userId, content, k)`; load recent history;
  4. `buildPrompt(...)`; set SSE headers; iterate `streamChat`, writing `data:` chunk events; accumulate text;
  5. on end: save assistant message, write `done`; fire-and-forget `extractFacts` → `addMemory` for each;
  6. on error: write an `error` event and end.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(server): SSE chat streaming with memory recall + capture`

### Task 4.3: Memory management route

**Files:** Create `server/src/routes/memory.ts`; Modify `app.ts`; Test `server/src/__tests__/memory.route.test.ts`.

- [ ] **Step 1: Test** — `GET /api/memory` lists the user's facts; `DELETE /api/memory/:id` removes one (owner-scoped).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement under `requireAuth`: list (id, content, createdAt) for user; delete by id owner-scoped.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(server): memory list/delete routes`

---

## Phase 5 — Frontend

### Task 5.1: API + auth client + router shell

**Files:** Create `client/src/lib/authClient.ts`, `client/src/lib/api.ts`, `client/src/main.tsx` (router + QueryClient), `client/src/components/ProtectedRoute.tsx`.

- [ ] **Step 1:** `authClient.ts` — `createAuthClient({ baseURL: import.meta.env.VITE_API_URL })`; export `signIn/signUp/signOut/useSession`.
- [ ] **Step 2:** `api.ts` — `fetch` wrapper that always sends `credentials: "include"` and throws on non-2xx; helpers `getChats/createChat/getMessages/deleteChat/getMemories/deleteMemory`.
- [ ] **Step 3:** `ProtectedRoute` — uses `useSession`; loading → spinner; no session → `<Navigate to="/login">`; else render children.
- [ ] **Step 4:** `main.tsx` — QueryClientProvider + RouterProvider with routes (`/login`,`/signup`,`/verify-email`, protected `/` and `/memory`), `<Toaster/>`.
- [ ] **Step 5: Test** `ProtectedRoute` redirects when unauthenticated (mock `useSession`). Run → PASS.
- [ ] **Step 6: Commit** — `feat(client): auth client, api wrapper, protected router`

### Task 5.2: Auth pages

**Files:** Create `client/src/pages/Login.tsx`, `Signup.tsx`, `VerifyEmail.tsx`.

- [ ] **Step 1:** Signup form (name/email/password) using shadcn Form+Input+Button → `signUp.email`; on success route to `/verify-email` with an "email sent" message.
- [ ] **Step 2:** Login form → `signIn.email`; on the "email not verified" error show a toast + resend option; on success → `/`.
- [ ] **Step 3:** `VerifyEmail` — instructional page + "resend verification" button.
- [ ] **Step 4: Test** Signup renders fields and calls `signUp.email` with entered values (mock authClient). Run → PASS.
- [ ] **Step 5: Commit** — `feat(client): login, signup, verify-email pages`

### Task 5.3: Chat UI with streaming

**Files:** Create `client/src/pages/Chat.tsx`, `client/src/components/ChatSidebar.tsx`, `client/src/components/MessageList.tsx`, `client/src/components/MessageInput.tsx`, `client/src/lib/streamChat.ts`.

- [ ] **Step 1:** `streamChat.ts` — POST to `/api/chats/:id/stream` with `credentials:"include"`, read the response body reader, parse SSE `data:` lines, invoke `onChunk`, `onDone`, `onError` callbacks.
- [ ] **Step 2:** `ChatSidebar` — TanStack Query list of chats, "New chat" button (createChat → select), select/delete.
- [ ] **Step 3:** `MessageList` — renders messages with `react-markdown`, shadcn `ScrollArea`, autoscroll; shows the in-progress streaming assistant bubble.
- [ ] **Step 4:** `MessageInput` — textarea + send (Enter to send, Shift+Enter newline), disabled while streaming.
- [ ] **Step 5:** `Chat.tsx` — composes the three; manages selected chat, message state, streaming buffer; on send: optimistic user message → `streamChat` appends chunks → on done refetch messages/chats.
- [ ] **Step 6: Test** `streamChat` parses a mocked SSE stream into ordered chunks + done (mock `fetch` with a ReadableStream). Run → PASS.
- [ ] **Step 7: Commit** — `feat(client): streaming chat UI (sidebar, messages, input)`

### Task 5.4: Memory page + nav

**Files:** Create `client/src/pages/Memory.tsx`; Modify chat header for nav + sign-out.

- [ ] **Step 1:** `Memory.tsx` — list facts (TanStack Query `getMemories`), delete each (Dialog confirm), empty state.
- [ ] **Step 2:** Header: app title, link to Memory, user menu (DropdownMenu) with sign-out → `signOut()` → `/login`.
- [ ] **Step 3: Test** Memory page renders fetched facts (mock api). Run → PASS.
- [ ] **Step 4: Commit** — `feat(client): memory management page + nav/sign-out`

---

## Phase 6 — Wiring, Docs, Verification

### Task 6.1: End-to-end manual verification

- [ ] **Step 1:** `npm run db:up`, run migrations, set `GEMINI_API_KEY`, `npm run dev`.
- [ ] **Step 2:** Sign up → copy verification link from server console → verify → log in.
- [ ] **Step 3:** Create a chat, confirm streaming reply renders. State a fact ("My name is X, I like Y"). In a NEW chat, ask about it → confirm recall. Check `/memory` lists the fact.
- [ ] **Step 4:** Fix any defects found via the systematic-debugging skill.

### Task 6.2: README finalize

- [ ] **Step 1:** Document full setup, env vars, scripts, and the architecture overview. Commit — `docs: finalize README`.

---

## Self-Review Notes

- **Spec coverage:** auth+verification (Phase 2), Gemini streaming (4.2), threads (4.1), semantic memory store+recall+extraction (3.2–3.4, 4.2), pgvector (1.2), shadcn UI (5.x), dev-console email (2.1), tests throughout — all mapped.
- **Type consistency:** `AiClient.embed/streamChat/complete` used uniformly in 3.x and 4.2; `addMemory/searchMemories` names consistent (3.2 ↔ 4.2/4.3); `buildPrompt` shape consistent (3.3 ↔ 4.2).
- **Embedding dim:** 768 everywhere (schema 1.2, interface 3.1, store 3.2).
