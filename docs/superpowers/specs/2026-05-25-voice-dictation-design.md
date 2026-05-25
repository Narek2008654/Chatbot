# Voice Dictation (Speech-to-Text) — Design Spec

**Date:** 2026-05-25
**Status:** Approved (build after image uploads)

## Summary

Add a microphone button to the chat input so the user can **speak and have it transcribed into
the message box** (dictation). The transcript fills the textarea; the user reviews and sends it
manually. Replies stay text (no spoken output). Frontend-only — no backend, no new dependencies.

Decisions (approved): **dictation only** (not two-way) + **browser-native Web Speech API**
(`SpeechRecognition`), not OpenAI Whisper. Fills the input, does **not** auto-send.

## Scope

- **In:** a mic toggle in `MessageInput`; live (interim) transcription appended to the textarea;
  graceful no-op when the browser lacks Web Speech support.
- **Out:** text-to-speech / spoken replies, OpenAI Whisper, realtime voice, audio storage.

## Component / behavior

- New hook **`client/src/lib/useDictation.ts`** wrapping the Web Speech API:
  - Resolve `window.SpeechRecognition ?? window.webkitSpeechRecognition`.
  - Expose `{ supported, listening, start(), stop() }` and an `onTranscript(text)` callback.
  - Config: `interimResults = true`, `continuous = true`, `lang = navigator.language`.
  - On a `result` event, emit the concatenated transcript (interim while speaking, finalized on
    pause); the consumer appends finalized text to the input value and can show interim live.
  - Stop on a second toggle, on `end`, or on `error` (emit a friendly message).
- **`MessageInput`** gains a mic button (lucide `MicIcon`): toggles `start()`/`stop()`, shows a
  "listening" state (e.g. pulsing/red mic). Transcribed text is appended to the current input
  value (preserving anything already typed). Hidden or disabled with a tooltip when `!supported`.
  Disabled while a stream is in progress (consistent with the send button).

## Error / edge handling

- Unsupported browser → mic button shows a disabled state / "Voice input isn't supported in this
  browser" tooltip; typing still works.
- Mic permission denied or recognition error → stop listening, toast a short message, leave any
  typed text intact.

## Testing

- Mock `window.SpeechRecognition` with a fake that lets the test fire a `result` event. Assert:
  starting sets `listening`, a result appends the transcript to the input, and a second toggle
  stops. Assert the button is disabled/hidden when the global is absent.

## Notes

- Chrome/Edge have the best support; Firefox/Safari are partial — acceptable since it degrades to
  plain typing. Can upgrade to OpenAI Whisper later for cross-browser accuracy if desired.
