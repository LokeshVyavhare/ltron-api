# Ltron-api — Technical Plan

**Companion to:** [`spec.md`](spec.md)
**Status:** Draft v2 (frontend-driven architecture)
**Last updated:** 2026-06-18

This document is the technical architecture: how we'll implement the requirements in `spec.md`. Rejected alternatives live in [`research.md`](research.md).

## 1. Stack at a glance

| Layer            | Choice                                                                                              |
|------------------|-----------------------------------------------------------------------------------------------------|
| Native shell     | Tauri 2 with a **thin Rust crate** (~12 commands, no domain logic)                                  |
| Backend language | Rust (in the shell only — for HTTP firing + filesystem + dialogs + XDG path lookup)                 |
| Frontend         | Svelte 5 (runes) + Vite + esbuild — **owns all app logic, models, validation, state**               |
| Editor           | CodeMirror 6 (lazy-loaded language modes)                                                           |
| Styling          | UnoCSS (no Tailwind runtime)                                                                        |
| HTTP client      | `reqwest` + `rustls-tls-native-roots` (lives in the Rust shell — browser CORS rules out a TS HTTP) |
| Storage          | **Folder tree of JSON files** at `$XDG_DATA_HOME/ltron-api/` + atomic writes (tempfile + rename)    |
| State management | Svelte 5 `$state` runes in memory; debounced (~500 ms) write-back to disk; flush on quit            |
| Async runtime    | `tokio` (multi-thread, minimal features) — Rust shell only                                          |
| TS bindings      | Small hand-written set for the ~12 native commands. **No ts-rs** (no domain types cross IPC)        |
| Packaging        | AppImage (primary), `.deb` (secondary), Flatpak (later)                                             |

## 2. Repository layout

A single Rust crate for the native shell, sibling `ui/` for all app code. **No Rust workspace, no sub-crates.**

```
ltron-api/
├── src-tauri/                       # thin Rust shell — only native primitives
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/default.json
│   └── src/
│       ├── main.rs                  # AppState, command registry
│       ├── http.rs                  # http_send, http_cancel, response streaming
│       ├── fs.rs                    # fs_read/write/list/delete/rename/mkdir/stat/exists
│       ├── dialog.rs                # dialog_open_file, dialog_save_file
│       ├── paths.rs                 # app_data_dir, app_config_dir, app_cache_dir
│       └── error.rs                 # AppError enum (small surface)
├── ui/                              # everything else — Svelte 5 app
│   ├── package.json
│   ├── vite.config.ts
│   ├── uno.config.ts
│   ├── index.html
│   └── src/
│       ├── main.ts
│       ├── App.svelte
│       └── lib/
│           ├── ipc/                 # thin wrappers over Tauri invoke
│           │   ├── http.ts          # http_send + ExecutionEvent channel subscribe
│           │   ├── fs.ts            # fs_*
│           │   ├── dialog.ts        # dialog_*
│           │   └── paths.ts         # app_data_dir cache
│           ├── models/              # TS interfaces — the domain model lives here
│           │   ├── workspace.ts
│           │   ├── collection.ts
│           │   ├── folder.ts
│           │   ├── request.ts
│           │   ├── example.ts
│           │   ├── environment.ts
│           │   ├── variable.ts
│           │   ├── history.ts
│           │   └── settings.ts
│           ├── storage/             # filesystem persistence orchestrator
│           │   ├── paths.ts         # tree → file path mapping
│           │   ├── loader.ts        # boot-time metadata walk
│           │   ├── reader.ts        # lazy load request files
│           │   ├── writer.ts        # debounced atomic write-back
│           │   ├── export.ts        # tree → single bundle JSON
│           │   └── import.ts        # bundle → tree with conflict resolution
│           ├── interpolation.ts     # {{var}} resolver in TS (~80 LOC)
│           ├── state/               # Svelte 5 $state modules
│           │   ├── app.svelte.ts    # active workspace, theme, tabs, settings
│           │   ├── tree.svelte.ts   # in-memory tree of loaded metadata
│           │   └── cache.svelte.ts  # Map<requestId, Request> opened-request cache
│           ├── components/          # RequestPanel, ResponsePane, SidebarTree, etc.
│           └── editor/              # CodeMirror 6 setup (its own Vite chunk)
└── README.md, .gitignore, specs/
```

## 3. The thin Rust shell

The full catalog of native commands lives in [`contracts/commands.md`](contracts/commands.md). Highlights:

### 3.1 What lives in Rust
- **HTTP fire/cancel** — `http_send` and `http_cancel`. The browser can't fire arbitrary cross-origin requests because of CORS; the Rust side acts as the user's user agent.
- **Filesystem primitives** — `fs_read`, `fs_write`, `fs_list`, `fs_delete`, `fs_mkdir`, `fs_rename`, `fs_exists`, `fs_stat`, plus byte-oriented variants for blob files. All writes are atomic (write to `.tmp`, fsync, rename).
- **Native dialogs** — `dialog_open_file`, `dialog_save_file`. Used for picking multipart file uploads and choosing export destinations.
- **XDG-aware path lookup** — `app_data_dir`, `app_config_dir`, `app_cache_dir`. Returns OS-appropriate paths via Tauri's path API (XDG on Linux, `%APPDATA%` on Windows, `~/Library/Application Support` on macOS).

### 3.2 What does NOT live in Rust
- **No domain types.** No `Workspace`, `Collection`, `Folder`, `Request`, `Example`, `Environment` in Rust.
- **No business rules.** The Rust side never knows that requests have headers, that folders nest, or that variables interpolate. It reads/writes opaque strings and bytes.
- **No SQL, no SQLite, no ORM.** Storage is files; the FS primitives do everything we need.
- **No app-specific path knowledge.** The frontend tells Rust the absolute path; Rust just operates on it. (Tauri capabilities scope filesystem access to the app's data/config/cache dirs.)

### 3.3 IPC payloads

For HTTP firing, the frontend interpolates variables in TS and sends a `NativeRequest` — a flat transport shape with already-resolved values:

```ts
type NativeRequest = {
  method: "GET" | "POST" | ...
  url: string
  headers: Array<{ key: string; value: string }>   // enabled rows only, resolved
  query_params: Array<{ key: string; value: string }>
  body:
    | { kind: "none" }
    | { kind: "raw"; content_type: string; text: string }
    | { kind: "urlencoded"; fields: Array<{ key: string; value: string }> }
    | { kind: "multipart"; parts: Array<MultipartPart> }
    | { kind: "binary"; path: string; content_type: string }
  auth: AuthSpec                                    // resolved
  timeout_ms: number | null
  follow_redirects: boolean
  verify_tls: boolean
}
```

Rust does no further validation beyond what `reqwest` requires.

### 3.4 Errors

Small `AppError` enum with variants the frontend can branch on:
`Io`, `NotFound`, `Permission`, `Validation`, `Cancelled`,
`NetworkDns`, `NetworkTls`, `NetworkTimeout`, `NetworkOther`.

Serialized as `{ "kind": "...", "message": "...", "detail"?: { ... } }`.

## 4. HTTP execution engine

(Implemented in `src-tauri/src/http.rs`.)

### 4.1 Client
One process-wide `reqwest::Client` built with:
- `rustls-tls-native-roots` (no OpenSSL system dep; reads OS trust store)
- `pool_idle_timeout(90s)`, `tcp_nodelay(true)`
- HTTP/2 negotiated
- Default `timeout(30s)` per request, overridden by `NativeRequest.timeout_ms`
- Redirect policy default `limited(10)`, overridden per request
- Cookie jar: **per-execution, in-memory only** for v1 (see `research.md` R-15)

### 4.2 Body construction
- `none` → omit body
- `raw` → `.body(text)` + `Content-Type` header
- `urlencoded` → `serde_urlencoded::to_string(&pairs)`
- `multipart` → `reqwest::multipart::Form` with file parts as `Part::stream(tokio::fs::File)` so 100 MB stays off-heap
- `binary` → `Body::wrap_stream` over `tokio::fs::File`

### 4.3 Response handling
- Iterate `response.bytes_stream()` into a buffer until the 50 MB cap (configurable).
- Beyond cap: spill new bytes to `$XDG_CACHE_HOME/ltron-api/responses/{execution_id}.bin`; emit `body_path` on `complete`.
- Decode for preview (text rendering in WebView) only for content-types `text/*`, `application/json`, `application/xml`, `application/x-yaml`, `application/javascript`, and only the first ~1 MB.

### 4.4 Timings (v1: coarse)
Capture via `tokio::time::Instant`: `t_start`, `t_headers` (first chunk), `t_done`. Emit `ttfb_ms` and `latency_ms`. Fine-grained DNS/TCP/TLS deferred to v1.1.

### 4.5 Streaming to the WebView
Via Tauri 2 scoped `Channel<ExecutionEvent>` passed in to `http_send`. Variants: `started`, `headers`, `chunk` (≤ 64 KB), `progress`, `complete`, `error`, `cancelled`. Backpressure threshold = 1 MB buffered before pausing the upstream stream.

### 4.6 Cancellation
`AppState::executions: Arc<DashMap<ExecutionId, CancellationToken>>`. Inserted on `http_send`, removed on terminal event. Executor uses `tokio::select!` over the response future and `token.cancelled()`. `http_cancel(id)` calls `.cancel()`.

## 5. Frontend architecture

Everything except the seven concerns above lives in `ui/src/lib/`.

### 5.1 Models (`lib/models/`)
Plain TS interfaces. UUIDv7 IDs generated client-side via the `uuidv7` package. Body and auth are tagged unions matching the `NativeRequest` payload (so converting Request → NativeRequest is a near-identity transform after interpolation). See [`data-model.md`](data-model.md) for exact shapes.

### 5.2 Storage orchestrator (`lib/storage/`)

This module is the entire "database layer," implemented in TypeScript.

- **`paths.ts`** — deterministic mapping from in-app tree to absolute filesystem path. Stable UUIDs in paths so renames never touch disk (only the JSON contents change). Examples:
  - workspace `<ws-id>` → `$DATA/workspaces/<ws-id>/workspace.json`
  - collection `<c-id>` in workspace `<ws-id>` → `$DATA/workspaces/<ws-id>/collections/<c-id>/collection.json`
  - request `<r-id>` in folder path `[<f1>, <f2>]` of that collection → `$DATA/workspaces/<ws-id>/collections/<c-id>/folders/<f1>/folders/<f2>/requests/<r-id>.json`
- **`loader.ts`** — boot-time walk. Reads `app.json`, then for the active workspace: `workspace.json`, `globals.json`, every `environments/*.json`, every `collections/*/collection.json`, every nested `folder.json`. **Does not read request bodies.** Populates `state/tree.svelte.ts`. Estimate: 50–100 small files for a typical workspace.
- **`reader.ts`** — lazy load a request file on open. Cache the parsed `Request` in `state/cache.svelte.ts`. Invalidate on edit.
- **`writer.ts`** — observe `$state` mutations via `$effect` watchers. Mark touched entities dirty; debounce 500 ms; flush queue with atomic `fs_write` calls. Subscribe to Tauri's `before_quit` to flush the queue on app close.
- **`export.ts`** — walk the in-memory tree (lazy-load any unloaded requests), emit a single versioned JSON bundle:
  ```ts
  {
    ltron_export_version: 1,
    exported_at: "2026-06-18T12:34:56.000Z",
    workspaces: [
      {
        id, name, active_environment_id?,
        globals: [...],
        environments: [...],
        collections: [
          { id, name, description?, sort_index,
            folders: [...recursive...],
            requests: [...with inline examples...] }
        ]
      }
    ]
  }
  ```
- **`import.ts`** — reverse: parse the bundle, regenerate UUIDs (so an imported workspace doesn't collide with an existing one), write the folder tree. Conflict resolution dialog (skip / overwrite / rename) on workspace-name collisions only — collections/folders/requests cannot collide because we always regenerate IDs.

### 5.3 Variable interpolation (`lib/interpolation.ts`)
A ~80-LOC state-machine tokenizer. Same syntax as Postman: `{{var_name}}` with optional whitespace, escape via `\{{...\}}`. Precedence (highest first):
1. Per-request temporary overrides (UI-only, not persisted)
2. Active environment variables (one active per workspace)
3. Workspace global variables
4. *(deferred to v1.1)* Process env via `{{$env.NAME}}` namespace

Unresolved → throw `VarUnresolvedError(name)`. No nested resolution (resolved values are not re-scanned). Same function reused at every interpolation site: URL, headers (k+v), query params (k+v), auth fields, raw body, form-data text parts, urlencoded fields, file part paths.

### 5.4 State (`lib/state/`)
- **`app.svelte.ts`** — `$state` for active workspace ID, theme, open tabs, app-level settings.
- **`tree.svelte.ts`** — in-memory mirror of the on-disk tree's metadata. Mutating this triggers writes via `writer.ts`.
- **`cache.svelte.ts`** — `Map<requestId, Request>` for opened request bodies. Bounded LRU (e.g., last 50).

No external store library. Svelte runes do everything.

### 5.5 Editor
CodeMirror 6 in its own Vite chunk: `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/lang-json`, `@codemirror/lang-xml`, `@codemirror/lang-html`. Total ~250 KB gzipped, lazy-loaded on first editor render.

### 5.6 Layout
Three-pane (left sidebar / center request panel / right response). Splitter widths persisted in `app.json`. On narrow screens, right pane collapses to a bottom pane (toggle).

### 5.7 Theme
CSS custom properties for tokens (`--bg-1`, `--fg-1`, …). `prefers-color-scheme` listener at boot; manual override persisted in `app.json`. UnoCSS for utility classes; zero runtime, on-demand emit.

## 6. Storage layout on disk

See [`data-model.md`](data-model.md) §2 for the full layout. Quick reference:

```
$XDG_DATA_HOME/ltron-api/
├── app.json                                    # last active workspace, theme, settings
└── workspaces/
    └── <ws-uuid>/
        ├── workspace.json
        ├── globals.json
        ├── environments/
        │   └── <env-uuid>.json
        ├── collections/
        │   └── <coll-uuid>/
        │       ├── collection.json
        │       ├── folders/
        │       │   └── <folder-uuid>/
        │       │       ├── folder.json
        │       │       ├── folders/...         # recursive
        │       │       └── requests/<req-uuid>.json
        │       ├── requests/<req-uuid>.json    # requests at collection root
        │       └── blobs/<sha256>.bin          # large response bodies
        └── history/
            └── 2026-06-18.jsonl                # one JSONL per UTC day
```

## 7. Concurrency model

- **Single-instance enforcement** via Tauri's `tauri-plugin-single-instance`. A second launch focuses the existing window instead of starting another process. Eliminates concurrent-write file corruption without needing file locks.
- **Atomic writes** via tempfile + rename (`<path>.tmp` → `<path>`). No half-written file is ever visible to a subsequent read. Implemented once in `fs_write` / `fs_write_bytes`.
- **No advisory locks in v1.** If multi-window editing becomes a feature in v1.1+, we'll add an advisory lock file (`<workspace>/.lock`) checked at workspace open.

## 8. Lightweight optimizations

### 8.1 Cargo release profile (`src-tauri/Cargo.toml`)
```toml
[profile.release]
lto = "fat"
codegen-units = 1
opt-level = "z"
strip = "symbols"
panic = "abort"
incremental = false
```

### 8.2 Tauri
- Capabilities whitelist: `core:event:default`, `core:window:default`, `dialog:allow-open`, `dialog:allow-save`. Filesystem access goes through **our own** `fs_*` commands, not Tauri's `fs:` allowlist, so we control the path-scoping policy.
- No tray icon, no updater plugin in v1.
- `bundle.targets = ["deb", "appimage"]` on Linux.
- `bundle.resources = []`.

### 8.3 Frontend
- Vite + esbuild minify. `build.cssCodeSplit = true`. Manual chunk for CodeMirror.
- UnoCSS in pre-build mode (zero runtime).
- Icons inline via SVG sprites; if a kit is needed, `lucide-svelte` tree-shaken.
- Response bodies > 1 MB stay in Rust spillover files; the WebView gets only the preview slice.
- Lists virtualized via `@tanstack/svelte-virtual` (sidebar tree, history, JSON tree).

### 8.4 Realistic estimate
Binary 8–12 MB (smaller than the prior plan because no SQLite/sqlx). Idle RAM 60–80 MB. WebKit baseline (~50 MB) is the dominant floor.

## 9. Packaging

### 9.1 Linux (primary)
- **AppImage** — primary deliverable, single-file.
- **`.deb`** — secondary, for apt-savvy users.
- **Flatpak** — follow-up; Flathub manifest later.

### 9.2 Identifiers
- App ID: `dev.tricog.ltron-api`
- Binary name: `ltron-api`
- Desktop file: `dev.tricog.ltron-api.desktop`

### 9.3 Filesystem layout (XDG-compliant)
| Purpose      | Path                                                                       |
|--------------|----------------------------------------------------------------------------|
| Data         | `$XDG_DATA_HOME/ltron-api/` (folder tree of JSON files; see §6)            |
| Config       | `$XDG_CONFIG_HOME/ltron-api/config.toml` (optional CLI-overridable prefs)  |
| Cache        | `$XDG_CACHE_HOME/ltron-api/responses/` (response spillover blobs)          |
| Logs         | `$XDG_STATE_HOME/ltron-api/logs/`                                          |

### 9.4 Auto-update
Skipped in v1. AppImage users use `appimageupdate`, Flatpak users get Flathub updates, .deb users update via apt repo (deferred infra).

## 10. Cross-platform (secondary)

- **Windows:** WebView2 via bootstrapper (downloads first run), NSIS installer.
- **macOS:** Universal binary via `--target universal-apple-darwin`. Code signing + notarization deferred.
- **All:** `rustls-tls-native-roots` and `tauri::path::BaseDirectory::AppData` work uniformly.

## 11. Testing strategy

- **TS unit tests** (Vitest): variable resolver, body/auth normalization, storage round-trip (write → read → diff), bundle export/import round-trip, path discipline.
- **Rust unit tests**: atomic-write semantics, dir-listing edge cases, HTTP fire (via `wiremock` or `mockito`).
- **E2E smoke**: Tauri WebDriver harness in M7 for cold-start + send-and-render.
- **NFR gates** in CI (M7): idle RAM (SM-1), installed size (SM-2), cold start (SM-3), 1000-request workspace open (SM-5), RSS drift after 1000 sends (SM-6).

## 12. Open hooks for v1.1+

- OS keyring for secrets via `keyring` crate (replaces plaintext storage flagged in R-11).
- Per-environment cookie jar.
- Fine-grained DNS/TCP/TLS timings via custom hyper connector.
- Postman v2.1 importer (M6 stretch).
- Pre/post-request scripting via an in-WebView sandbox (no Rust-side scripting story needed since scripts would be TS-native).
