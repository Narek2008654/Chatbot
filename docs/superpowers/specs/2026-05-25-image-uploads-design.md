# Image Uploads (Vision) — Design Spec

**Date:** 2026-05-25
**Status:** Approved

## Summary

Let users attach **images** to a chat message. Images are stored on the server's disk and
sent to OpenAI's vision-capable model (`gpt-4o-mini`) so the assistant can actually see and
answer about them. Attached images render as thumbnails in the chat thread.

Decisions (approved): **1A** images-only (vision, no document parsing) + **2A** disk storage
with an auth-scoped serving URL and metadata in the DB.

## Scope

- **In:** upload image files (png/jpeg/webp/gif), vision understanding, thumbnails in the
  thread, disk storage, ownership-scoped serving.
- **Out:** documents/PDF text extraction (explicitly dropped), cloud storage, image editing,
  generating images.

## Data model (new `Attachment` table)

```prisma
model Attachment {
  id         String   @id @default(cuid())
  userId     String                       // Clerk user id (owner)
  messageId  String?                      // linked when the message is sent (null until then)
  message    Message? @relation(fields: [messageId], references: [id], onDelete: Cascade)
  mimeType   String
  filename   String                       // original filename (display)
  sizeBytes  Int
  storedPath String                       // path on disk under server/uploads/
  createdAt  DateTime @default(now())
}
```
`Message` gains `attachments Attachment[]`.

## Backend

- **`POST /api/uploads`** (auth) — `multipart/form-data`, one `file` field, handled by `multer`
  (disk storage in a gitignored `server/uploads/`). Validates MIME against an image whitelist
  and size ≤ 10 MB. Creates an `Attachment` row (`userId = req.userId`, `messageId = null`).
  Returns `{ id, filename, mimeType }`. Rejects with 400 on bad type/size.
- **`GET /api/files/:id`** (auth) — looks up the attachment, 404 unless `userId === req.userId`,
  streams the file from disk with its `mimeType`. The frontend fetches it as a blob with the
  bearer token (an `<AuthedImage>` component using an object URL) so auth stays in headers.
- **Stream route** — the send body gains optional `attachmentIds: string[]`. The server
  verifies each id belongs to the user and is unlinked, links them to the new user `Message`
  (sets `messageId`), then reads each image from disk → base64 data URL → passes them as the
  current user message's images for the vision call.
- **`getMessages`** returns each message's attachments (`id, filename, mimeType`) so the thread
  re-renders thumbnails.

## AI / prompt changes

- `ChatMessage` gains optional `imageDataUrls?: string[]`.
- The real OpenAI client, when a message has `imageDataUrls`, sends `content` as an array of
  parts: `[{ type: "text", text }, { type: "image_url", image_url: { url } }, …]` (OpenAI
  vision format). Text-only messages keep a plain string `content` (no behavior change).
- `buildPrompt` accepts the current turn's `images: string[]` (data URLs) and attaches them to
  the final user message.
- The **fake AI** records the `streamChat` input it received, so tests can assert images were
  forwarded — without calling OpenAI.

## Frontend

- **`MessageInput`** — a 📎 button + drag-and-drop. Selected images upload immediately via
  `POST /api/uploads`; pending thumbnails show above the input (with a remove ✕); on send,
  their ids are passed to `streamChat`. Disabled while streaming.
- **`streamChat`** — sends `attachmentIds` in the POST body.
- **`MessageList`** — renders a message's image attachments as thumbnails via `<AuthedImage>`.
- **`<AuthedImage>`** (new) — fetches `/api/files/:id` with the Clerk token, turns the blob into
  an object URL, renders an `<img>`, and revokes the URL on unmount.

## Limits / validation

- Image MIME whitelist: `image/png`, `image/jpeg`, `image/webp`, `image/gif`.
- ≤ 10 MB per file; ≤ 5 images per message (frontend-enforced + backend caps links).
- Friendly toast errors on rejected uploads.

## Error handling

- Bad type/size → `POST /api/uploads` returns 400 with a message; UI toasts it.
- Non-owner file access → `GET /api/files/:id` 404.
- An attachment id that isn't owned/already-linked → stream route rejects before streaming.

## Testing

- **Backend:** upload accepts a valid image + rejects bad type/oversize; `GET /api/files/:id`
  ownership 404; stream with `attachmentIds` links them to the message and forwards image data
  URLs to the (fake) AI; `getMessages` includes attachments. Uses a tiny in-repo test image
  buffer; `multer` writes to a temp uploads dir.
- **Frontend:** `streamChat` includes `attachmentIds` in the body; `<AuthedImage>` fetches with
  the token and renders; `MessageInput` uploads a selected file and shows a pending thumbnail.

## New dependencies

- `multer` (+ `@types/multer`) — multipart upload parsing. (No `pdf-parse`; documents are out of scope.)

## Config

- `server/uploads/` is gitignored. Optional `UPLOAD_DIR` env (default `server/uploads`) and
  `MAX_UPLOAD_MB` (default 10) — both optional with defaults.
