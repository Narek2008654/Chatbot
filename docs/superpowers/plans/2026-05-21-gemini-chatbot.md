# OpenAI Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Revision (2026-05-21):** AI provider changed Gemini → OpenAI; email verification removed.
> Embedding dimension is 1536 (`text-embedding-3-small`). Chat model default `gpt-4o-mini`.

**Goal:** Build a web chatbot using OpenAI with email/password auth, persistent chat threads, and cross-conversation semantic memory.

**Architecture:** npm-workspaces monorepo. `server/` = Express + TS, Better Auth, Prisma/Postgres+pgvector, OpenAI via the `openai` SDK, SSE streaming. `client/` = Vite + React + TS + Tailwind + shadcn/ui. Memory = facts embedded with `text-embedding-3-small`, retrieved by pgvector cosine similarity, injected into the prompt; new facts extracted after each turn.

**Tech Stack:** Node 24, Express, TypeScript, Prisma, PostgreSQL + pgvector, Better Auth, openai, Vite, React, Tailwind, shadcn/ui, React Router, TanStack Query, Vitest, supertest, React Testing Library.

---

## Conventions

- Backend tests: Vitest + supertest. Run with `npm test -w server`.
- Frontend tests: Vitest + RTL. Run with `npm test -w client`.
- Commit after each task with the message shown.
- OpenAI is accessed through a thin `AiClient` interface so tests inject a deterministic fake — never call the real API in tests.

---

## Phase 0 — Scaffolding & Infra  ✅ COMPLETE

### Task 0.1: Root workspace + Postgres/pgvector + README — DONE
npm-workspaces root, `docker-compose.yml` (pgvector/pgvector:pg16), `.gitignore`, `.env.example` (OpenAI keys, no SMTP), `README.md`.

### Task 0.2: Server scaffold — DONE
Express + TS, `createApp()` + `GET /api/health`, env via zod, Vitest. Deps: express, cors, zod, better-auth, @prisma/client, **openai**, dotenv (no nodemailer, no @google/genai). Health test passes.

### Task 0.3: Client scaffold — DONE
Vite React TS + Tailwind v4 + shadcn/ui + React Router + TanStack Query + better-auth + react-markdown; Vitest + RTL; smoke test passes.

---

## Phase 1 — Database & Prisma

### Task 1.1: Prisma schema + Better Auth + app models

**Files:** `server/prisma/schema.prisma`, migration under `server/prisma/migrations/`.

- [ ] **Step 1:** `prisma init`. Set datasource `postgresql` from `DATABASE_URL`, `previewFeatures = ["postgresqlExtensions"]`, and `extensions = [vector]`.
- [ ] **Step 2:** Define Better Auth models (`User`, `Session`, `Account`, `Verification`) per Better Auth's Prisma schema (User.id/email/emailVerified/name/image/timestamps; Session token/expiresAt/userId; Account providerId/accountId/password/userId; Verification identifier/value/expiresAt). The `Verification` model stays in the schema even though verification is disabled — it's part of Better Auth's standard schema.
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
  // embedding column added via raw SQL in migration (vector(1536))
}
```

- [ ] **Step 4:** `prisma migrate dev --name init` (requires `npm run db:up` first).
- [ ] **Step 5: Commit** — `feat(server): prisma schema for auth + chat + memory`

### Task 1.2: pgvector column + index (manual migration)

**Files:** new migration `server/prisma/migrations/<ts>_memory_vector/migration.sql`.

- [ ] **Step 1:** `prisma migrate dev --create-only --name memory_vector`.
- [ ] **Step 2:** Add SQL:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "Memory" ADD COLUMN "embedding" vector(1536);
CREATE INDEX IF NOT EXISTS memory_embedding_idx
  ON "Memory" USING hnsw ("embedding" vector_cosine_ops);
```

- [ ] **Step 3:** Apply: `prisma migrate dev`.
- [ ] **Step 4: Commit** — `feat(server): add pgvector(1536) embedding column + hnsw index`

---

## Phase 2 — Authentication (Better Auth, no email verification)

### Task 2.1: Better Auth config

**Files:** Create `server/src/auth.ts`, `server/src/db.ts` (shared Prisma client).

- [ ] **Step 1:** `db.ts` exports a singleton `PrismaClient`.
- [ ] **Step 2:** Configure `betterAuth({ database: prismaAdapter(prisma, { provider: "postgresql" }), emailAndPassword: { enabled: true, requireEmailVerification: false }, trustedOrigins: [env.CLIENT_URL], secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL })`. No `emailVerification` block, no mailer.
- [ ] **Step 3:** Export `auth`.
- [ ] **Step 4: Commit** — `feat(server): better-auth config (email/password, no verification)`

### Task 2.2: Mount auth + session middleware

**Files:** Modify `server/src/app.ts`; Create `server/src/middleware/requireAuth.ts`; Test `server/src/__tests__/auth.test.ts`.

- [ ] **Step 1:** Mount `app.all("/api/auth/*", toNodeHandler(auth))` BEFORE `express.json()` per the Better Auth express guide (json parser applies to the other routes).
- [ ] **Step 2:** `requireAuth`: read session via `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`; if none → `401 { error: "unauthorized" }`; else attach `req.user` and `next()`.
- [ ] **Step 3: Test** (integration, real test DB): sign up via `POST /api/auth/sign-up/email` → 200 and a `user` row exists; an authenticated `GET /api/me` (guarded by `requireAuth`) returns the user when called with the signup's session cookie, and returns 401 with no cookie.

```ts
test("signup creates a user and establishes a session", async () => {
  const app = createApp();
  const res = await request(app).post("/api/auth/sign-up/email")
    .send({ email: "u@test.com", password: "password123", name: "U" });
  expect(res.status).toBe(200);
  const u = await prisma.user.findUnique({ where: { email: "u@test.com" } });
  expect(u).not.toBeNull();
});

test("protected route is 401 without a session", async () => {
  const res = await request(createApp()).get("/api/me");
  expect(res.status).toBe(401);
});
```

- [ ] **Step 4:** Add `GET /api/me` guarded by `requireAuth` returning `req.user` (used by the tests above; kept as a lightweight session probe).
- [ ] **Step 5:** Run → PASS (reset test DB between runs).
- [ ] **Step 6: Commit** — `feat(server): mount better-auth + requireAuth middleware`

---

## Phase 3 — AI & Memory Services

### Task 3.1: OpenAI client wrapper

**Files:** Create `server/src/ai/client.ts` (interface `AiClient` + real impl); `server/src/ai/fakeAi.ts`; Test `server/src/ai/__tests__/fakeAi.test.ts`.

- [ ] **Step 1:** Define interface:

```ts
export interface ChatMessage { role: "user" | "assistant"; content: string }

export interface AiClient {
  embed(text: string): Promise<number[]>;            // 1536-dim
  streamChat(input: { system: string; messages: ChatMessage[] }): AsyncIterable<string>; // yields text chunks
  complete(prompt: string): Promise<string>;          // non-streamed, for extraction
}
```

- [ ] **Step 2:** Implement `createOpenAiClient(apiKey)` using `openai`:
  - `embed` → `openai.embeddings.create({ model: EMBEDDING_MODEL, input: text })` → `res.data[0].embedding`.
  - `streamChat` → `openai.chat.completions.create({ model: CHAT_MODEL, messages: [{role:"system",content:system}, ...messages], stream: true })`; for-await yield `chunk.choices[0]?.delta?.content ?? ""` (skip empty).
  - `complete` → `openai.chat.completions.create({ model: CHAT_MODEL, messages: [{role:"user", content: prompt}] })` → `res.choices[0].message.content ?? ""`.
- [ ] **Step 3:** `fakeAi.ts` — deterministic fake: `embed` returns a seeded 1536-length number array derived from a hash of the text (stable for the same input); `streamChat` yields a few canned chunks (e.g. `["Hello", " from", " the", " fake", " AI."]`); `complete` returns a fixed string (default `"[]"` so extraction parses to an empty array unless a test overrides it).
- [ ] **Step 4: Test** the fake satisfies the interface: `embed` length 1536 and deterministic; `streamChat` yields ≥1 chunk; `complete` returns a string.
- [ ] **Step 5: Commit** — `feat(server): OpenAI ai client interface + deterministic fake`

### Task 3.2: Memory store (embed + insert + similarity search)

**Files:** Create `server/src/memory/store.ts`; Test `server/src/memory/__tests__/store.test.ts` (real test DB + fake AI).

- [ ] **Step 1: Test** — `addMemory(ai, userId, "User likes hiking")` then `searchMemories(ai, userId, "outdoor activities", 5)` returns an array containing "User likes hiking"; a different userId returns none (per-user scoping).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement (functions take the `AiClient` as a parameter for testability):
  - `addMemory(ai, userId, content)`: `await ai.embed(content)`, serialize to `'[a,b,...]'`, raw insert `INSERT INTO "Memory"(id,"userId",content,embedding,"createdAt") VALUES (gen-cuid, $1, $2, $3::vector, now())`.
  - `searchMemories(ai, userId, query, k)`: `await ai.embed(query)`, then `SELECT content FROM "Memory" WHERE "userId"=$1 ORDER BY embedding <=> $2::vector LIMIT $3`.
  - Use `prisma.$queryRawUnsafe` / `$executeRawUnsafe`; generate ids with `crypto.randomUUID()` or cuid.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(server): pgvector memory store (add + search)`

### Task 3.3: Prompt builder (pure function)

**Files:** Create `server/src/chat/prompt.ts`; Test `server/src/chat/__tests__/prompt.test.ts`.

- [ ] **Step 1: Test** — `buildPrompt({ facts, history, message })` returns `{ system, messages }`: `system` contains each fact under a "What you know about the user" header (and base instructions); `messages` is the history mapped to `{role, content}` with the new user message appended as the final `{role:"user", content: message}`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement pure function: base system instructions + (if `facts.length`) a memory section listing the facts; map `history: {role:"user"|"assistant"; content:string}[]` straight through (OpenAI roles match); append the new user message. Return `{ system, messages }`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(server): prompt builder with memory injection`

### Task 3.4: Memory extraction

**Files:** Create `server/src/memory/extract.ts`; Test `server/src/memory/__tests__/extract.test.ts` (fake AI).

- [ ] **Step 1: Test** — `extractFacts(ai, userMsg, assistantMsg)` parses the fake's JSON-array `complete()` output into `string[]`; returns `[]` on unparseable output (no throw). Override the fake's `complete` to return `'["User is named Sam"]'` and assert the parsed result.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement: build an extraction prompt asking for a JSON array of durable user facts worth remembering long-term (or `[]` if none); call `ai.complete`; parse JSON defensively (try/catch, ensure it's an array of strings); return `string[]`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(server): memory extraction from a chat exchange`

---

## Phase 4 — Chat API

### Task 4.1: Chat CRUD + ownership

**Files:** Create `server/src/routes/chats.ts`; Modify `server/src/app.ts`; Test `server/src/__tests__/chats.test.ts`.

- [ ] **Step 1: Test** (authenticated via a sign-in helper returning the session cookie): create chat → 200 with id; list → includes it; a second user cannot GET/DELETE the first user's chat (404); delete works for the owner.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement router under `requireAuth`: `POST /` create; `GET /` list user's chats (newest first); `GET /:id` (owner-scoped, 404 otherwise); `DELETE /:id` (owner-scoped); `GET /:id/messages` (owner-scoped, ordered by createdAt). zod-validate bodies.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(server): chat CRUD routes with ownership checks`

### Task 4.2: SSE streaming chat turn

**Files:** Create `server/src/routes/stream.ts`; Modify `server/src/app.ts` (make `createApp({ ai })` accept an injectable `AiClient`, defaulting to the real one); Test `server/src/__tests__/stream.test.ts` (fake AI injected).

- [ ] **Step 1: Test** — `POST /api/chats/:id/stream` with `{ content }` for an owned chat (fake AI injected): responds `Content-Type: text/event-stream`; body contains the fake's streamed chunks and a final `done` event; afterward exactly one `user` and one `assistant` Message row exist for the chat.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement (AiClient + memory functions reachable via the app factory):
  1. validate session + chat ownership;
  2. zod-validate `{ content }`; save the user message;
  3. `searchMemories(ai, userId, content, k=5)`; load recent history (last N messages);
  4. `buildPrompt({ facts, history, message: content })`; set SSE headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`); flush headers;
  5. iterate `ai.streamChat(...)`, write `data: {json chunk}\n\n` per chunk, accumulate text;
  6. on end: save assistant message; write a final `event: done` / `data: ...`; end response; fire-and-forget `extractFacts(...)` → `addMemory(...)` for each new fact;
  7. on error: write `event: error` then end.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(server): SSE chat streaming with memory recall + capture`

### Task 4.3: Memory management route

**Files:** Create `server/src/routes/memory.ts`; Modify `app.ts`; Test `server/src/__tests__/memory.route.test.ts`.

- [ ] **Step 1: Test** — `GET /api/memory` lists the authenticated user's facts (id, content, createdAt); `DELETE /api/memory/:id` removes one (owner-scoped; a non-owner gets 404 and the row remains).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement under `requireAuth`: list `SELECT id, content, "createdAt" FROM "Memory" WHERE "userId"=$1 ORDER BY "createdAt" DESC`; delete by id scoped to userId.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(server): memory list/delete routes`

---

## Phase 5 — Frontend

### Task 5.1: API + auth client + router shell

**Files:** Create `client/src/lib/authClient.ts`, `client/src/lib/api.ts`, `client/src/main.tsx` (router + QueryClient), `client/src/components/ProtectedRoute.tsx`.

- [ ] **Step 1:** `authClient.ts` — `createAuthClient({ baseURL: import.meta.env.VITE_API_URL })`; export `signIn/signUp/signOut/useSession`.
- [ ] **Step 2:** `api.ts` — `fetch` wrapper that always sends `credentials: "include"` and throws on non-2xx; helpers `getChats/createChat/getMessages/deleteChat/getMemories/deleteMemory`.
- [ ] **Step 3:** `ProtectedRoute` — uses `useSession`; loading → spinner; no session → `<Navigate to="/login">`; else render children.
- [ ] **Step 4:** `main.tsx` — QueryClientProvider + RouterProvider with routes (`/login`, `/signup`, protected `/` and `/memory`), `<Toaster/>`. (No `/verify-email` route.)
- [ ] **Step 5: Test** `ProtectedRoute` redirects when unauthenticated (mock `useSession`). Run → PASS.
- [ ] **Step 6: Commit** — `feat(client): auth client, api wrapper, protected router`

### Task 5.2: Auth pages

**Files:** Create `client/src/pages/Login.tsx`, `client/src/pages/Signup.tsx`.

- [ ] **Step 1:** Signup form (name/email/password) using shadcn Form+Input+Button → `signUp.email`; on success navigate straight to `/` (the user is logged in immediately — no verification).
- [ ] **Step 2:** Login form (email/password) → `signIn.email`; on error show a toast; on success → `/`.
- [ ] **Step 3:** Each page links to the other ("Need an account? Sign up" / "Have an account? Log in").
- [ ] **Step 4: Test** Signup renders the fields and calls `signUp.email` with the entered values (mock authClient). Run → PASS.
- [ ] **Step 5: Commit** — `feat(client): login + signup pages`

### Task 5.3: Chat UI with streaming

**Files:** Create `client/src/pages/Chat.tsx`, `client/src/components/ChatSidebar.tsx`, `client/src/components/MessageList.tsx`, `client/src/components/MessageInput.tsx`, `client/src/lib/streamChat.ts`.

- [ ] **Step 1:** `streamChat.ts` — POST to `${VITE_API_URL}/api/chats/:id/stream` with `credentials:"include"`, read the response body reader, parse SSE `data:`/`event:` lines, invoke `onChunk(text)`, `onDone()`, `onError(err)` callbacks.
- [ ] **Step 2:** `ChatSidebar` — TanStack Query list of chats, "New chat" button (createChat → select), select/delete.
- [ ] **Step 3:** `MessageList` — renders messages with `react-markdown`, shadcn `ScrollArea`, autoscroll; shows the in-progress streaming assistant bubble.
- [ ] **Step 4:** `MessageInput` — textarea + send (Enter to send, Shift+Enter newline), disabled while streaming.
- [ ] **Step 5:** `Chat.tsx` — composes the three; manages selected chat, message list state, streaming buffer; on send: optimistic user message → `streamChat` appends chunks → on done refetch messages/chats.
- [ ] **Step 6: Test** `streamChat` parses a mocked SSE stream into ordered chunks + done (mock `fetch` returning a ReadableStream). Run → PASS.
- [ ] **Step 7: Commit** — `feat(client): streaming chat UI (sidebar, messages, input)`

### Task 5.4: Memory page + nav

**Files:** Create `client/src/pages/Memory.tsx`; Modify the chat header for nav + sign-out.

- [ ] **Step 1:** `Memory.tsx` — list facts (TanStack Query `getMemories`), delete each (Dialog confirm), empty state.
- [ ] **Step 2:** Header: app title, link to Memory, user menu (DropdownMenu) with sign-out → `signOut()` → `/login`.
- [ ] **Step 3: Test** Memory page renders fetched facts (mock api). Run → PASS.
- [ ] **Step 4: Commit** — `feat(client): memory management page + nav/sign-out`

---

## Phase 6 — Wiring, Docs, Verification

### Task 6.1: End-to-end manual verification

- [ ] **Step 1:** `npm run db:up`, run migrations, set `OPENAI_API_KEY` in `server/.env`, `npm run dev`.
- [ ] **Step 2:** Sign up → confirm you land in the app logged in (no verification step).
- [ ] **Step 3:** Create a chat, confirm the streaming reply renders. State a fact ("My name is X, I like Y"). In a NEW chat, ask about it → confirm recall. Check `/memory` lists the fact.
- [ ] **Step 4:** Fix any defects found via the systematic-debugging skill.

### Task 6.2: README finalize

- [ ] **Step 1:** Document full setup, env vars, scripts, and the architecture overview (OpenAI, no verification). Commit — `docs: finalize README`.

---

## Self-Review Notes

- **Spec coverage:** auth without verification (Phase 2), OpenAI streaming (4.2), threads (4.1), semantic memory store+recall+extraction (3.2–3.4, 4.2), pgvector(1536) (1.2), shadcn UI (5.x), tests throughout — all mapped.
- **Type consistency:** `AiClient.embed/streamChat/complete` + `ChatMessage{role,content}` used uniformly in 3.x and 4.2; `addMemory(ai,...)/searchMemories(ai,...)` signatures consistent (3.2 ↔ 4.2/4.3); `buildPrompt → {system, messages}` consistent (3.3 ↔ 4.2).
- **Embedding dim:** 1536 everywhere (migration 1.2, interface 3.1, store 3.2).
- **No mailer / no verify-email page:** removed from Phase 2 and Phase 5.
