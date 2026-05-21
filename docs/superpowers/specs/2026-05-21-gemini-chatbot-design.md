# OpenAI Chatbot with Auth + Memory — Design Spec

**Date:** 2026-05-21
**Status:** Approved (revised 2026-05-21: switched provider Gemini → OpenAI; removed email verification)

## Summary

A web chatbot that talks to OpenAI's API, with email/password authentication,
persistent chat threads, and long-term semantic memory about the user that carries
across conversations.

> **Revision note:** Originally specced for Google Gemini with email verification.
> Per a mid-build change request, the AI provider is now OpenAI and email verification
> has been removed — users can sign in immediately after signing up. Email/password
> auth itself is unchanged. Verification can be re-enabled later via Better Auth.

## Locked Decisions

| Area | Choice |
| --- | --- |
| Frontend | Vite + React + TypeScript, Tailwind, shadcn/ui |
| Backend | Node + Express + TypeScript |
| Database | PostgreSQL + Prisma |
| Vector search | pgvector extension |
| Auth | Better Auth (email/password, **no email verification**) |
| AI | OpenAI via the `openai` SDK |
| Chat model | `gpt-4o-mini` (configurable via `CHAT_MODEL`) |
| Embedding model | `text-embedding-3-small` (1536-dim, configurable via `EMBEDDING_MODEL`) |
| Streaming | Yes — Server-Sent Events (SSE) |
| Memory | Persistent threads **and** cross-conversation semantic facts |

## Project Structure

npm workspaces monorepo:

```
chatbot/
├─ client/              # Vite + React + TS + Tailwind + shadcn/ui
├─ server/              # Express + TS + Prisma + Better Auth + OpenAI
├─ docker-compose.yml   # Postgres + pgvector (one-command DB)
├─ package.json         # workspaces + root scripts
└─ README.md
```

## Backend (`server/`)

- Express + TypeScript. CORS configured for the client origin with `credentials: true`.
- **Better Auth** mounted at `/api/auth/*` via its Prisma adapter. Email/password enabled,
  `requireEmailVerification: false` (no verification step).
- **OpenAI** via the `openai` SDK: `gpt-4o-mini` for streaming chat completions;
  `text-embedding-3-small` (1536-dim) for embeddings.
- **Routes** (chat/memory routes behind a session-check middleware):
  - `GET/POST /api/chats`, `GET/DELETE /api/chats/:id`
  - `GET /api/chats/:id/messages`
  - `POST /api/chats/:id/stream` — send a message, stream the reply via SSE
  - `GET/DELETE /api/memory` — view/forget stored facts
- **Validation**: zod on all request bodies.

## Database (Postgres + Prisma, pgvector)

Better Auth tables: `user`, `session`, `account`, `verification`
(the `verification` table is part of Better Auth's standard schema and is harmless to keep
even with verification disabled).

App tables:

- `Chat(id, userId → user, title, createdAt, updatedAt)`
- `Message(id, chatId → Chat, role: user|assistant, content, createdAt)`
- `Memory(id, userId → user, content, embedding vector(1536), createdAt)`
  — pgvector column with an HNSW cosine index; similarity query via raw SQL (`<=>`).

## Auth Flow

1. Sign up (email + password) → user created and an active session is established
   immediately (no verification email).
2. Login with email + password → session cookie set.
3. Protected API routes and protected client routes both check the session.

## Chat Turn Data Flow (streaming + memory)

1. Client `POST`s the message → server validates session + chat ownership, saves user message.
2. Server embeds the message → pgvector similarity search over the user's `Memory` → top-K facts.
3. Prompt = system prompt + retrieved facts + recent thread messages + new message.
4. OpenAI streams tokens → SSE → UI renders live.
5. On completion: save assistant message, then run an async memory-extraction LLM call on the
   exchange; new durable facts are embedded and stored (with light dedup).

## Frontend (`client/`)

- Vite + React + TS, Tailwind, shadcn/ui, React Router, TanStack Query, Better Auth React client.
- Pages: `/signup`, `/login`; protected `/` chat app (sidebar thread list + message pane +
  input, live streaming, markdown rendering); protected `/memory` (view/delete facts).
- After signup the user is taken straight into the app (no verify-email page).
- shadcn components: Form/Input/Button, Card, ScrollArea, Sonner, Avatar, DropdownMenu, Dialog.

## Error Handling

- SSE emits an `error` event on OpenAI failures; UI shows a toast and keeps the user message.
- 401 → redirect to login.
- zod rejects malformed input.

## Testing (TDD)

- **Backend**: Vitest + supertest — auth protection, chat CRUD, ownership checks; unit tests
  for prompt-building and memory retrieval with the OpenAI client mocked. Test DB via Docker Postgres.
- **Frontend**: Vitest + React Testing Library for key components; optional Playwright
  happy-path e2e (sign up → chat).

## Configuration

- `server/.env`: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CLIENT_URL`,
  `OPENAI_API_KEY`, `CHAT_MODEL`, `EMBEDDING_MODEL`.
- `client/.env`: `VITE_API_URL`.

## Prerequisites

- Docker (bundled Postgres+pgvector) or local Postgres with pgvector.
- An OpenAI API key.
- Node 20+.

## Out of Scope (v1)

- Email verification (removed for now; re-enableable via Better Auth), password reset, OAuth/social login.
- Multi-user sharing of chats.
- File/image attachments.
