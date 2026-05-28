# Agent for Retell Agent Creation

A chat-driven control plane for RetellAI voice agents. You talk to an OpenAI
assistant; it interviews you to **create** voice agents, **places outbound
phone calls** through them, **tracks each person you've spoken to** by email
with a rolling engagement summary, and follows up via **SMS when the call
doesn't connect**. Post-call summaries land back in your chat and in a
dedicated **Calls** view.

## What it does

- **Chat assistant** — streams replies token-by-token, persistent threads,
  durable memory about you across chats (pgvector semantic search).
- **Voice-agent creation** — a structured interview (interaction type, goal,
  questions, persona, voice, greeting, no-pickup SMS) drafts a complete agent
  prompt with `{{dynamic variables}}` baked in, then creates the agent on
  Retell after your review.
- **Outbound calls** — place / hang up calls from chat, pick the agent from
  `list_agents`, and have the assistant ask the callee's email + the
  position/details up front.
- **Per-person engagement** — `Person` records keyed by email accumulate a
  rolling summary built from each call's transcript; the next call walks in
  pre-briefed via `{{caller_context}}`.
- **Calls page** — every logged call, newest first; click one to see the
  person's engagement summary and the full history timeline (each entry
  expandable to its transcript).
- **Retell webhook receiver** — `call_ended` events log the full call, fold it
  into the person's summary, post a notification into the originating chat,
  and (if configured) send a no-pickup follow-up SMS via Twilio.
- **Image uploads** (vision) and **voice dictation** for the chat input.

## Architecture

npm-workspaces monorepo:

```
.
├─ client/   React + Vite + TypeScript, Tailwind + shadcn/ui, React Router, TanStack Query
├─ server/   Express + TypeScript, Clerk, Prisma, OpenAI tool-calling, SSE streaming
├─ scripts/  One-off Node scripts (e.g. sync-calls, create-emma-nontech)
└─ docker-compose.yml   Postgres 16 + pgvector
```

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind, shadcn/ui, React Router, TanStack Query |
| Backend | Node/Express 5, TypeScript, Clerk, Prisma 6, OpenAI tool-calling |
| Database | PostgreSQL 16 + pgvector |
| Voice | RetellAI (agent + LLM + outbound phone calls + post-call webhooks) |
| SMS | Twilio Programmable Messaging (for no-pickup follow-ups) |
| AI | OpenAI (`gpt-4o` chat, `text-embedding-3-small` embeddings) — both configurable |

### Data model

- **Chat** / **Message** / **Attachment** — chat threads with images.
- **Memory** — durable facts about the operator (embedded into pgvector).
- **Person** — a contact keyed by `(userId, email)`; holds `name`, `background`
  (your initial notes), and a rolling `summary` built from each call.
- **Call** — one row per logged outbound call (id = Retell `call_id`,
  idempotent on webhook retries); transcript, per-call summary, duration,
  disconnection reason, linked to the `Person`.
- **AgentSettings** — per-agent extras we manage outside Retell (currently
  the no-pickup SMS template).

### Tool-calling surface

The chat model is given five tools (`server/src/ai/client.ts`):

- `create_retell_voice_agent` — write a prompt with placeholders + greeting,
  pick a voice, optionally set a no-pickup SMS, and create on Retell.
- `place_phone_call` — outbound call with `caller_name`, `caller_context`,
  `position`, `position_details`, `company_name`, `questions`, all passed as
  `retell_llm_dynamic_variables` and substituted into the agent's prompt at
  call time.
- `end_phone_call` — hang up a specific `call_id`, or the most recent live
  call if none given.
- `list_agents` — fetch the real agents on the Retell account.
- `lookup_person` — DB-backed; tells the model whether this email is a first
  interaction or a returning contact.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (Postgres + pgvector)
- [Node.js](https://nodejs.org/) v20+
- [OpenAI](https://platform.openai.com/api-keys) API key
- Free [Clerk](https://dashboard.clerk.com) application (publishable + secret keys)
- [RetellAI](https://dashboard.retellai.com) account (API key + at least one phone number)
- [Twilio](https://console.twilio.com) account (the same one Retell uses for the trunk) — for SMS
- For local webhook delivery: [ngrok](https://ngrok.com/download) or another HTTPS tunnel

## Getting started

```bash
# 1. Install (both workspaces)
npm install

# 2. Configure env
cp .env.example server/.env
cp .env.example client/.env
# then edit them — see "Environment variables" below

# 3. Start Postgres
npm run db:up

# 4. Run migrations
npm run db:migrate -w server

# 5. Start the dev servers
npm run dev
```

- API server: <http://localhost:3000>
- Client: <http://localhost:5173>

Sign up via Clerk, ask the bot to *"create an interview agent"*, then *"call
+1… using that agent for the Senior Engineer role"*. Post-call summaries
appear in the chat and on `/calls`.

### Receiving Retell webhooks locally

Calls only log to your DB if Retell can reach your server. For local dev,
start an ngrok tunnel:

```bash
ngrok http 3000
```

Then set the **Webhook URL** on your Retell account (or per-agent) to the
forwarding URL + `/api/retell/webhook`, e.g.:

```
https://<random>.ngrok-free.app/api/retell/webhook
```

If a webhook is missed (tunnel down, agent without `webhook_url`, etc.), run
the reconciliation script to backfill from Retell:

```bash
node --env-file=server/.env scripts/sync-calls.mjs
```

It's idempotent — already-logged calls are no-ops.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | server | Postgres connection (matches docker-compose defaults) |
| `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` | server | Clerk identity verification |
| `CLIENT_URL` | server | Allowed CORS origin (default `http://localhost:5173`) |
| `OPENAI_API_KEY` | server | OpenAI key (chat + memory + post-call summaries) |
| `CHAT_MODEL` | server | Chat model (default `gpt-4o-mini`; **strongly recommend `gpt-4o`** for reliable tool-calling) |
| `EMBEDDING_MODEL` | server | Embedding model (default `text-embedding-3-small`, 1536-dim) |
| `RETELL_API_KEY` | server | RetellAI key |
| `RETELL_FROM_NUMBER` | server | Default caller number (E.164, your Retell-registered Twilio number) |
| `RETELL_WEBHOOK_SECRET` | server | Optional shared secret; if set, webhook URL must include `?secret=…` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | server | Twilio creds for sending the no-pickup SMS |
| `VITE_CLERK_PUBLISHABLE_KEY` | client | Clerk publishable key (for `<ClerkProvider>`) |
| `VITE_API_URL` | client | Base URL of the API server |

Trial-account caveats: Twilio trials can only **call** and **SMS** verified
numbers — upgrade to remove this restriction. Also enable the
**Geographic Permissions** for any non-US destination.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start server + client together |
| `npm run dev:server` / `npm run dev:client` | Start one side only |
| `npm run db:up` / `npm run db:down` | Start / stop the Postgres container |
| `npm run db:migrate -w server` | Apply Prisma migrations |
| `npm test` | Run all test suites (server + client) |
| `npm test -w server` / `npm test -w client` | Run one workspace's tests |
| `node --env-file=server/.env scripts/sync-calls.mjs` | Backfill any calls Retell delivered (or missed delivering) into the DB |
| `node --env-file=server/.env scripts/create-emma-nontech.mjs` | One-off: create a sample non-technical interviewer agent with proper `{{placeholders}}` |

## Testing

- **Server** — Vitest + supertest. Unit tests for the prompt builder, memory
  store, fact extraction, Retell client, Twilio client, and the tool-calling
  dispatch (with deterministic fakes — no real network calls). Integration
  tests for the auth guard, chat CRUD/ownership, the SSE streaming turn, the
  Calls API, and the webhook (including the no-pickup SMS path) run against
  the Docker Postgres. The fake auth guard is header-based, so no Clerk keys
  are needed for tests. The database must be running (`npm run db:up`).
- **Client** — Vitest + React Testing Library for the SSE parser, the
  token-binding `useApi` hook, the Memory page, and the Calls page.

## Notes

- **Streaming + tools.** `chat()` is an async generator that yields content
  deltas while a bounded loop reassembles `tool_calls` fragments by `index`,
  runs them, and re-asks the model. The SSE route forwards each chunk to the
  browser.
- **Idempotency.** `Call.id` is Retell's `call_id`; the webhook handler skips
  re-processing on retries.
- **DB-free AI client.** The AI client never touches Postgres directly. The
  stream route supplies it small DB-backed callbacks (`lookupPerson`,
  `saveAgentSettings`), bundled into a `ToolDeps` object scoped to the
  current Clerk user.
- **Agent prompts must use `{{double_brace}}` placeholders**, never `[Insert
  …]` bracket blanks — Retell substitutes the former, ignores the latter. The
  system prompt for the chat model enforces this on every drafted agent.
- **No real-time push of webhook events** to the browser yet — call summaries
  land in the chat and the Calls page; you'll see them on refresh / next open.
