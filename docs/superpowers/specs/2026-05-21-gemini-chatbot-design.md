# Gemini Chatbot with Auth + Memory — Design Spec

**Date:** 2026-05-21
**Status:** Approved

## Summary

A web chatbot that talks to Google's Gemini API, with email/password authentication
(including email verification), persistent chat threads, and long-term semantic memory
about the user that carries across conversations.

## Locked Decisions

| Area | Choice |
| --- | --- |
| Frontend | Vite + React + TypeScript, Tailwind, shadcn/ui |
| Backend | Node + Express + TypeScript |
| Database | PostgreSQL + Prisma |
| Vector search | pgvector extension |
| Auth | Better Auth (email/password + email verification) |
| Email delivery | nodemailer; dev = console/Ethereal, prod = pluggable SMTP |
| AI | Gemini via `@google/genai` SDK |
| Chat model | `gemini-2.5-flash` (configurable) |
| Embedding model | `text-embedding-004` (768-dim) |
| Streaming | Yes — Server-Sent Events (SSE) |
| Memory | Persistent threads **and** cross-conversation semantic facts |

## Project Structure

npm workspaces monorepo:

```
chatbot/
├─ client/              # Vite + React + TS + Tailwind + shadcn/ui
├─ server/              # Express + TS + Prisma + Better Auth + Gemini
├─ docker-compose.yml   # Postgres + pgvector (one-command DB)
├─ package.json         # workspaces + root scripts
└─ README.md
```

## Backend (`server/`)

- Express + TypeScript. CORS configured for the client origin with `credentials: true`.
- **Better Auth** mounted at `/api/auth/*` via its Prisma adapter. Email/password enabled,
  `requireEmailVerification: true`. `sendVerificationEmail` hook calls the mailer.
- **Mailer**: nodemailer. Dev logs the verification link to the console (and an Ethereal
  preview URL if available); production uses `SMTP_*` env vars. No email setup needed to start.
- **Gemini** via `@google/genai`: `gemini-2.5-flash` for streaming chat; `text-embedding-004`
  (768-dim) for embeddings.
- **Routes** (chat/memory routes behind a session-check middleware):
  - `GET/POST /api/chats`, `GET/DELETE /api/chats/:id`
  - `GET /api/chats/:id/messages`
  - `POST /api/chats/:id/stream` — send a message, stream the reply via SSE
  - `GET/DELETE /api/memory` — view/forget stored facts
- **Validation**: zod on all request bodies.

## Database (Postgres + Prisma, pgvector)

Better Auth tables: `user`, `session`, `account`, `verification`.

App tables:

- `Chat(id, userId → user, title, createdAt, updatedAt)`
- `Message(id, chatId → Chat, role: user|assistant, content, createdAt)`
- `Memory(id, userId → user, content, embedding vector(768), createdAt)`
  — pgvector column with an HNSW cosine index; similarity query via raw SQL (`<=>`).

## Auth Flow

1. Sign up (email + password) → user created `emailVerified=false`, verification email sent.
2. Click link → Better Auth verify endpoint → `emailVerified=true`.
3. Login blocked until verified; on success a session cookie is set.
4. Protected API routes and protected client routes both check the session.

## Chat Turn Data Flow (streaming + memory)

1. Client `POST`s the message → server validates session + chat ownership, saves user message.
2. Server embeds the message → pgvector similarity search over the user's `Memory` → top-K facts.
3. Prompt = system prompt + retrieved facts + recent thread messages + new message.
4. Gemini streams tokens → SSE → UI renders live.
5. On completion: save assistant message, then run an async memory-extraction LLM call on the
   exchange; new durable facts are embedded and stored (with light dedup).

## Frontend (`client/`)

- Vite + React + TS, Tailwind, shadcn/ui, React Router, TanStack Query, Better Auth React client.
- Pages: `/signup`, `/login`, `/verify-email` (status/resend); protected `/` chat app
  (sidebar thread list + message pane + input, live streaming, markdown rendering);
  protected `/memory` (view/delete facts).
- shadcn components: Form/Input/Button, Card, ScrollArea, Sonner, Avatar, DropdownMenu, Dialog.

## Error Handling

- SSE emits an `error` event on Gemini failures; UI shows a toast and keeps the user message.
- 401 → redirect to login.
- zod rejects malformed input.
- Dev email-send failures log but do not block signup.

## Testing (TDD)

- **Backend**: Vitest + supertest — auth protection, chat CRUD, ownership checks; unit tests
  for prompt-building and memory retrieval with Gemini mocked. Test DB via Docker Postgres.
- **Frontend**: Vitest + React Testing Library for key components; optional Playwright
  happy-path e2e (sign up → verify → chat).

## Configuration

- `server/.env`: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CLIENT_URL`,
  `GEMINI_API_KEY`, `CHAT_MODEL`, `EMBEDDING_MODEL`, optional `SMTP_*`.
- `client/.env`: `VITE_API_URL`.

## Prerequisites

- Docker (bundled Postgres+pgvector) or local Postgres with pgvector.
- A Gemini API key.
- Node 20+.

## Out of Scope (v1)

- OAuth/social login, password reset (can be added via Better Auth later).
- Multi-user sharing of chats.
- File/image attachments.
