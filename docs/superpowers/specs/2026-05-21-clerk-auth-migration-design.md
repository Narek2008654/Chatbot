# Migrate Auth: Better Auth → Clerk — Design Spec

**Date:** 2026-05-21
**Status:** Approved

## Summary

Replace the Better Auth (email/password, self-hosted sessions) identity layer with
**Clerk** (hosted identity). Clerk becomes the source of truth for users; the app stops
storing users/sessions locally and scopes data by Clerk's user ID string. The chat,
streaming, memory, and title features are unchanged — only the identity layer changes.

Decisions (approved):
- **1A** — Drop the local `User`/`Session`/`Account`/`Verification` tables. `Chat.userId`
  and `Memory.userId` store Clerk's user ID string (e.g. `user_abc123`); no user-sync/webhooks.
- **2A** — Use Clerk's prebuilt React components (`<ClerkProvider>`, `<SignIn/>`,
  `<SignUp/>`, `<UserButton/>`, `<SignedIn>`/`<SignedOut>`).
- Keys supplied by the user via env (tests use mocks).

> Supersedes the Better Auth parts of `2026-05-21-gemini-chatbot-design.md`. Also resolves a
> reported "login twice" bug, which lived in the custom Better Auth login flow (a redirect/
> session-propagation race) — that flow is removed; Clerk tracks session state reactively.

## What is removed

- **Backend:** `server/src/auth.ts`, the Better Auth handler mount in `app.ts`, the
  `better-auth` dependency.
- **DB:** `User`, `Session`, `Account`, `Verification` tables.
- **Frontend:** `lib/authClient.ts`, custom `Login`/`Signup` forms, the custom avatar
  dropdown in `AppHeader`, the `better-auth` dependency.

## Backend (Express + `@clerk/express`)

- Mount `clerkMiddleware()` in `createApp()` (production path).
- A guard middleware reads `getAuth(req).userId`; if absent → `401 { error: "unauthorized" }`;
  else set `req.userId = userId` and `next()`.
- **Injectable auth for testability** (mirrors the existing AI-client injection):
  `createApp({ ai?, requireAuth? }: { ai?: AiClient; requireAuth?: RequestHandler })`.
  - Production: no `requireAuth` passed → mount `clerkMiddleware()` + use the Clerk guard.
  - Tests: pass a fake guard that reads `x-test-user-id` and sets `req.userId` (no Clerk keys,
    no network). If the header is missing the fake guard returns 401.
- All chat/memory/stream routes change `req.user!.id` → `req.userId!`.
- Express `Request` augmentation: replace `user?: {...}` with `userId?: string`.
- CORS: continue allowing `CLIENT_URL`; auth now travels as a bearer token (not cookies), so
  `credentials` is no longer required for auth (kept harmless or removed).

## Frontend (React + `@clerk/clerk-react`, prebuilt components)

- `main.tsx`: wrap the tree in `<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>`.
- Routes:
  - `/login` → `<SignIn routing="path" path="/login" signUpUrl="/signup" />`
  - `/signup` → `<SignUp routing="path" path="/signup" signInUrl="/login" />`
  - Protected `/` and `/memory`: gate with Clerk — `<SignedIn>` renders the page,
    `<SignedOut>` renders `<RedirectToSignIn/>`. Replaces `ProtectedRoute`.
  - Configure after-sign-in redirect to `/` (avoids any post-login bounce).
- `AppHeader`: replace the custom avatar `DropdownMenu` + sign-out with Clerk's `<UserButton/>`;
  keep the app title and the Memory/Chat nav link.
- **API authentication (bearer tokens):** client and API are separate origins, so requests
  carry a Clerk session JWT. A `useApi()` hook obtains `getToken()` from Clerk's `useAuth()`
  and returns bound helpers (`getChats`, `createChat`, `deleteChat`, `getMessages`,
  `getMemories`, `deleteMemory`) that send `Authorization: Bearer <token>`. `streamChat` takes
  the token (or a `getToken` fn) and sends the same header. `credentials:"include"` is removed.
  - `lib/api.ts` keeps a low-level `request(path, { token, ...})` that sets the header and
    throws on non-2xx; `useApi()` wraps it with the current token.

## Data flow (unchanged except identity)

A chat turn is identical to today, except `req.userId` comes from Clerk (prod) or the test
header (tests), and the client attaches a bearer token instead of relying on a cookie.

## Database migration

- New Prisma migration:
  - `Chat.userId` and `Memory.userId` → plain `String` (drop relation + FK).
  - Drop `User`, `Session`, `Account`, `Verification` tables.
- `Message`, the pgvector `embedding` column, and the HNSW index are untouched.
- Existing dev rows are discarded (dev only).

## Error handling

- Missing/invalid token → API 401 → Clerk's `<SignedOut>`/`getToken()` path sends the user to
  sign-in. SSE error events, ownership 404s, and zod validation are unchanged.

## Testing

- **Backend:** inject the fake `x-test-user-id` guard. Rewrite `chats.test.ts`, `stream.test.ts`,
  `memory.route.test.ts` to set the header (different ids prove per-user scoping) instead of
  signing up. Replace `auth.test.ts` with a guard test: 401 without the header; `req.userId`
  passed through with it. AI/memory/title unit tests are untouched.
- **Frontend:** mock `@clerk/clerk-react` (`useAuth` → `{ getToken }`, `<SignedIn>`/`<SignedOut>`
  pass-throughs, `<UserButton/>` stub). Keep the `streamChat` parser test (add a token arg).
  Replace the Better-Auth `Signup`/`ProtectedRoute` tests with Clerk-mocked equivalents
  (e.g. an `AppHeader` test that renders `<UserButton/>` stub; a routing/gate test).

## Env / config

- `server/.env`: remove `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`; add `CLERK_SECRET_KEY`,
  `CLERK_PUBLISHABLE_KEY`.
- `client/.env`: add `VITE_CLERK_PUBLISHABLE_KEY`.
- Update `.env.example` and `README.md`.

## Dependencies

- Remove `better-auth` (server + client).
- Add `@clerk/express` (server), `@clerk/clerk-react` (client).

## Out of scope

- Webhook user-sync, storing extra profile data locally (1B — not chosen).
- Organizations/roles, social logins (Clerk supports them later via config, no code change here).
