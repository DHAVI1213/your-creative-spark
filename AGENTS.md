# Architecture rules
- Keep the owner panel isolated under /admin, with Cloud sessions and server-validated roles through the fail-closed admin-access predicate; the legacy client login must never grant administrative privileges, and “view as client” navigates out of the admin layout.
- Use existing subscriptions and Kiwify events as revenue sources alongside manual purchases, deduplicating external order IDs; simulated checkout is never a revenue source.
- Expose only allowlisted public settings through a read-only function; administrative tables remain admin-only under RLS.
- Track authenticated tool workspace openings as usage sessions and heartbeat activity separately; do not imply completed processing or anonymous users are tracked.
- Keep shared client presentation unchanged and apply published settings through a provider and route boundary.
- Keep the browser batch editor isolated in lib/editor and tools/editor with a single shared layout/filter model, a sequential cancellable wasm worker and owner-scoped profiles; this preserves reference fidelity without importing desktop code.
- `referencia-pc/` holds the owner's original desktop tools as read-only reference; never import from it or edit it.
- Cortes Virais, animated captions and AI phrases run in the client browser (lib/cortes, lib/ia, lib/editor/legendas): ffmpeg.wasm reads big files through WORKERFS, Whisper runs in a Web Worker (transformers.js) or via the client's own Groq/OpenAI key, and AI keys stay in the client's browser; there is no server proxy for these calls.
