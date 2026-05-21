# Chatbot

An OpenAI-powered chat application with authentication and long-term memory.

The assistant streams replies token-by-token, keeps persistent chat threads, and
remembers durable facts about you (your name, preferences, context) across separate
conversations using semantic search over a vector store.

## Architecture

A npm-workspaces monorepo:

```
chatbot/
├─ client/   React + Vite + TypeScript, Tailwind + shadcn/ui, React Router, TanStack Query
├─ server/   Express + TypeScript, Better Auth, Prisma, OpenAI, SSE streaming
└─ docker-compose.yml   Postgres 16 + pgvector
```

- **Auth** — Better Auth (email + password). No email verification: signing up logs you in
  immediately. Sessions are cookie-based and stored in Postgres.
- **Chat** — each turn is streamed from OpenAI to the browser over Server-Sent Events.
  Threads and messages are persisted in Postgres.
- **Memory** — after each exchange the server asks the model to extract durable user facts,
  embeds them with OpenAI `text-embedding-3-small` (1536-dim), and stores them in a pgvector
  column. On every new message it embeds the message and pulls the most relevant facts
  (cosine similarity) into the system prompt, so the bot recalls them in future chats.

| Layer | Tech |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind, shadcn/ui, React Router, TanStack Query |
| Backend | Node/Express, TypeScript, Better Auth, Prisma |
| Database | PostgreSQL + pgvector |
| AI | OpenAI (`gpt-4o-mini` chat, `text-embedding-3-small` embeddings) — both configurable |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (for Postgres + pgvector)
- [Node.js](https://nodejs.org/) v20+ (developed on v24)
- An [OpenAI API key](https://platform.openai.com/api-keys)

## Getting started

1. **Install dependencies** (installs both workspaces)

   ```bash
   npm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example server/.env
   cp .env.example client/.env
   ```

   In `server/.env` set at minimum:
   - `BETTER_AUTH_SECRET` — generate with `openssl rand -hex 32`
   - `OPENAI_API_KEY` — required for chat replies and memory extraction

   `client/.env` only needs `VITE_API_URL` (defaults to `http://localhost:3000`).

3. **Start the database**

   ```bash
   npm run db:up
   ```

4. **Run database migrations**

   ```bash
   npm run db:migrate -w server
   ```

5. **Start both dev servers**

   ```bash
   npm run dev
   ```

   - API server: <http://localhost:3000>
   - Client: <http://localhost:5173>

   Open the client, sign up, and start chatting. Tell the bot something about yourself,
   then start a **new** chat and ask about it — it should recall the fact. Manage stored
   facts on the **Memory** page.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | server | Postgres connection (matches docker-compose defaults) |
| `BETTER_AUTH_SECRET` | server | Signs auth sessions |
| `BETTER_AUTH_URL` | server | Server base URL (default `http://localhost:3000`) |
| `CLIENT_URL` | server | Allowed CORS origin (default `http://localhost:5173`) |
| `OPENAI_API_KEY` | server | OpenAI API key |
| `CHAT_MODEL` | server | Chat model (default `gpt-4o-mini`) |
| `EMBEDDING_MODEL` | server | Embedding model (default `text-embedding-3-small`, 1536-dim) |
| `VITE_API_URL` | client | Base URL of the API server |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start server + client together |
| `npm run dev:server` / `npm run dev:client` | Start one side only |
| `npm run db:up` / `npm run db:down` | Start / stop the Postgres container |
| `npm run db:migrate -w server` | Apply Prisma migrations |
| `npm test` | Run all test suites (server + client) |
| `npm test -w server` / `npm test -w client` | Run one workspace's tests |

## Testing

- **Server** — Vitest + supertest. Unit tests for the prompt builder, memory store, and
  fact extraction (with a deterministic fake AI client — no real API calls); integration
  tests for auth, chat CRUD/ownership, and the SSE streaming turn run against the Docker
  Postgres. The database must be running (`npm run db:up`) for the integration tests.
- **Client** — Vitest + React Testing Library for the SSE parser, protected routing, and
  the auth/memory pages.

## Notes

- If the embedding model changes, the `vector(1536)` dimension in
  `server/prisma/migrations/*_memory_vector/migration.sql` must change to match.
- Email verification is intentionally disabled; it can be re-enabled in
  `server/src/auth.ts` via Better Auth's `requireEmailVerification` + an email sender.
