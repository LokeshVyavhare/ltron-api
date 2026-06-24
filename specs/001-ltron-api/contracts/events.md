# Ltron-api — IPC Event Contracts

**Companion to:** [`commands.md`](commands.md), [`../plan.md`](../plan.md) §4.5
**Status:** Draft v2 (frontend-driven architecture)

The IPC event surface is small. Most "events" in the app are pure frontend state changes (Svelte runes) — they don't cross the IPC boundary at all.

Naming: `<domain>://<verb>/<id?>`.

---

## 1. Execution events (per-request, via `Channel<ExecutionEvent>`)

When the frontend calls `http_send`, it passes a Tauri `Channel<ExecutionEvent>`. The backend emits the variants below. The channel auto-closes when the execution terminates (`complete`, `error`, or `cancelled`) or when the frontend drops it.

```ts
type ExecutionEvent =
  | { kind: "started";   execution_id: string; started_at: number }
  | { kind: "progress";  execution_id: string; bytes_received: number; total_bytes?: number }
  | { kind: "headers";   execution_id: string; status: number; headers: Array<{ key: string; value: string }>; final_url: string }
  | { kind: "chunk";     execution_id: string; data: string; encoding: "utf8" | "base64"; chunk_index: number }
  | { kind: "complete";  execution_id: string; result: ExecutionResult }
  | { kind: "error";     execution_id: string; error: AppErrorJson }
  | { kind: "cancelled"; execution_id: string }

type ExecutionResult = {
  status: number
  headers: Array<{ key: string; value: string }>
  final_url: string
  body_size: number           // bytes (encoded; decoded if auto-decompressed)
  body_path: string | null    // set only if body exceeded the 50 MB in-memory cap → spilled to cache file
  body_preview: string | null // first ~1 MB if content-type is text-ish; null otherwise
  latency_ms: number
  ttfb_ms: number
}
```

### Variants in detail
- **`started`** — emitted once, immediately after the channel is opened. UI flips into "in-flight" state.
- **`progress`** — emitted periodically (~every 50 ms or every 64 KB) while body streams. `total_bytes` set only if `Content-Length` was present.
- **`headers`** — exactly once, when status + headers are available. `final_url` reflects redirects.
- **`chunk`** — emitted per body chunk (~64 KB cap). `encoding`: `"utf8"` for previewable text content-types; `"base64"` otherwise. `chunk_index` is monotonic.
- **`complete`** — exactly once on success. Carries `ExecutionResult`.
- **`error`** — exactly once on failure. `AppErrorJson` matches the contract in [`commands.md`](commands.md) §5.
- **`cancelled`** — exactly once when `http_cancel` succeeds. Distinct from `error` so UI can render "Cancelled" instead of "Failed".

### Ordering guarantees
- `started` is always first.
- `headers` precedes any `chunk`.
- All `chunk`s precede `complete`.
- Exactly one of `complete` / `error` / `cancelled` terminates the channel.

### Backpressure
The Rust shell buffers up to **1 MB** of pending events per channel before pausing the upstream `bytes_stream()`. Prevents a slow frontend (busy WebView, GC pause) from blowing memory on a fast response.

---

## 2. Global app events

Emitted with `app.emit(event_name, payload)`. The frontend subscribes at startup.

| Event              | Payload                                                                                              | When                                              |
|--------------------|------------------------------------------------------------------------------------------------------|---------------------------------------------------|
| `app://safe_mode`  | `{ reason: "json_corrupt" \| "permission" \| "disk_full"; details: string }`                          | At boot if a critical file (e.g. `app.json`) can't be read; UI renders a recovery panel (EC-8). |

That's the entire global-event surface in v1.

---

## 3. What is NOT an IPC event (lives in the frontend instead)

For clarity, these are all **pure frontend state changes**, not IPC events:

- **`db://changed`** — eliminated. Svelte's reactivity propagates state changes; there is no separate backend-of-truth.
- **`import://progress` / `import://done`** — handled entirely in `ui/src/lib/storage/import.ts` as Svelte `$state` updates. No IPC.
- **`settings://updated`** — `ui/src/lib/state/app.svelte.ts` is the source; `$effect` writes to `app.json` after debounce. No IPC needed.
- **Per-keystroke autosave** — `writer.ts` debounces 500 ms after `$state` mutation, calls `fs_write`. No event traffic.
- **Variable-resolution preview** — synchronous TS function call; no IPC.

---

## 4. Frontend subscription pattern (reference)

```ts
// Per-execution Channel
import { Channel } from '@tauri-apps/api/core';
import { invoke } from '@tauri-apps/api/core';

const channel = new Channel<ExecutionEvent>();
channel.onmessage = (event) => {
  switch (event.kind) {
    case 'started':   /* flip UI to in-flight */ break;
    case 'headers':   /* render status + headers */ break;
    case 'chunk':     /* append to viewer */ break;
    case 'progress':  /* update bytes counter */ break;
    case 'complete':  /* finalize, write history entry */ break;
    case 'error':     /* render error */ break;
    case 'cancelled': /* render cancelled badge */ break;
  }
};

const executionId = await invoke<string>('http_send', { req, channel });
```

```ts
// Global app events
import { listen } from '@tauri-apps/api/event';

await listen('app://safe_mode', ({ payload }) => {
  showRecoveryPanel(payload);
});
```
