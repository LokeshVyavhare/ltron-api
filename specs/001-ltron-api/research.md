# Ltron-api — Research & Decisions

**Companion to:** [`spec.md`](spec.md), [`plan.md`](plan.md), [`data-model.md`](data-model.md)
**Status:** Draft v2 (frontend-driven architecture)

Each decision is recorded as **Decision / Rationale / Alternatives rejected**.

---

## R-1 Frontend framework: Svelte 5 (runes)

- **Decision:** Svelte 5 with the runes API (`$state`, `$derived`, `$effect`).
- **Rationale:** Smallest practical runtime. Runes give fine-grained reactivity without JSX. ~3 KB hello-world gzipped. Crucially: since all app state lives in the frontend (no Rust domain types), Svelte's reactivity *is* our state management — no Redux/Zustand needed.
- **Rejected:** SolidJS (larger hello-world, JSX everywhere); React (bundle + re-render cost too high); vanilla + Web Components (productivity loss).

## R-2 Code editor: CodeMirror 6 (lazy-loaded)

- **Decision:** CodeMirror 6 with only `state`, `view`, `commands`, `lang-json`, `lang-xml`, `lang-html`. Lazy-loaded as its own Vite chunk.
- **Rationale:** ~250 KB gzipped vs Monaco's ~5 MB. Sufficient for JSON/XML editing. Lazy chunk keeps cold-start lean.
- **Rejected:** Monaco (binary budget); Ace (older, smaller ecosystem); hand-rolled (loses fold/search).

## R-3' Folder-tree of JSON files (no database)

- **Decision:** Store data as one JSON file per entity in a directory tree under `$XDG_DATA_HOME/ltron-api/workspaces/<ws-uuid>/...`. History as date-rotated JSONL. Large response bodies as sidecar blob files.
- **Rationale:**
  - Smallest possible binary — no SQLite library shipped (~3–5 MB saved).
  - User can `cat`, `grep`, `git diff`, or hand-edit their data with standard tools. This is genuinely valuable for a single-user dev tool.
  - On-disk format and export format share the same JSON dialect (one less mapping to maintain).
  - Lazy-loading is trivial (don't read what you don't open).
  - Matches the user's explicit requirement: "data will be saved in local files."
- **Rejected:**
  - **SQLite + sqlx** (prior plan v1) — over-engineering for this scale; the binary cost (~3–5 MB) is dead weight against our 20 MB footprint target. Migration ceremony for a single-user app is unnecessary.
  - **IndexedDB** (in WebView) — loses the file-on-disk inspectability, complicates backup, and we'd still need Rust for HTTP firing.
  - **Single big JSON file** — load-everything-on-boot doesn't scale to 1000+ requests (SM-5 target).
  - **YAML / TOML files** — JSON is the export format already; using the same format on disk saves a serialization layer.

## R-3a Persistence orchestrator in TypeScript, not Rust

- **Decision:** All "which file does this entity go in," caching, dirty-tracking, and write-back logic lives in `ui/src/lib/storage/`. Rust knows only "given a path, read/write bytes."
- **Rationale:** Keeps domain logic in one language (TS). Makes refactors single-language. Lets Svelte's reactive primitives drive write-back naturally (`$effect` watching dirty entities). Aligns the architecture with the user's "frontend-driven" direction.
- **Rejected:** Putting path mapping in Rust — would split domain logic across languages with no upside.

## R-3b Atomic write strategy

- **Decision:** Every JSON write is `write(<path>.tmp); fsync; rename(<path>.tmp, <path>)`. Implemented once in the Rust shell's `fs_write`/`fs_write_bytes`.
- **Rationale:** No half-written file is ever visible. Survives crashes mid-write. Standard pattern; no novel work.
- **Rejected:** Direct overwrite (corruption risk on crash); WAL/journal (re-inventing what SQLite would give us for free, but we deliberately don't want SQLite).

## R-3c Single-instance enforcement, no file locks (v1)

- **Decision:** Use Tauri's `tauri-plugin-single-instance` to ensure only one process runs at a time (second launch focuses the existing window).
- **Rationale:** Eliminates the concurrent-write problem at the OS level. Simpler than file locks. Affects EC-7 (concurrent edits) — there is only ever one writer in v1.
- **Rejected:** File locks via `fs2`/`fd-lock` (more code, more failure modes, unnecessary for v1).
- **Hook for v1.1+:** If multi-window editing becomes a feature, add an advisory lock file `<workspace>/.lock` checked on workspace open.

## R-3d No `db://changed` event (frontend reactivity is the source of truth)

- **Decision:** Don't emit a global "data changed" event from Rust. Svelte runes propagate state changes through the UI automatically.
- **Rationale:** With all state in TS, there's no separate backend-of-truth that needs to notify the UI. Mutations happen in `$state` and trigger both the UI re-render and the write-back orchestrator.
- **Consequence:** Simplifies the IPC contract significantly (`events.md` shrinks).

## R-3e History as date-rotated JSONL

- **Decision:** Append one JSON line per execution to `history/YYYY-MM-DD.jsonl`. LRU eviction by deleting whole day-files when total entries exceed cap.
- **Rationale:** Append-only writes are cheap and corruption-resistant. Day-granularity eviction is simple (no per-line rewrites). With ~30 sends/day average and a 1000-entry cap, eviction loses less than a day's history on overflow.
- **Rejected:** Single `history.json` (rewrites on every send don't scale); per-entry deletes (would require rewriting the JSONL on eviction).

## R-4 HTTP client: reqwest + rustls-tls-native-roots

- **Decision:** `reqwest` with the `rustls-tls-native-roots` feature, in the Rust shell.
- **Rationale:** Browser CORS rules out a TS-side HTTP client for this product. `rustls-tls-native-roots` avoids OpenSSL system dep (saves ~3–5 MB), reads OS trust store, static linking → reproducible builds.
- **Rejected:** native-tls (platform-variant TLS); ureq (sync, no streaming bytes); hyper direct (lower-level than needed).

## R-5 Streaming response into WebView: Tauri 2 `Channel<T>`

- **Decision:** One scoped `Channel<ExecutionEvent>` per execution, passed into `http_send`. Emits `started`, `headers`, `chunk`, `progress`, `complete`, `error`, `cancelled`. Backpressure threshold = 1 MB buffered.
- **Rationale:** Avoids one giant IPC payload. Channel auto-cleans on drop. Scoped to one execution → no listener leaks.
- **Rejected:** Single buffered response (bad UX for large bodies); global Tauri events (listener leak risk).

## R-6 Binary preview strategy

- **Decision:** Sniff content-type + magic bytes. Images preview inline; PDFs opt-in via `<embed>`; everything else → hex viewer.
- **Rationale:** No bundled renderer cost. Browser-native preview where it's free.
- **Rejected:** Bundling `pdf.js` (~1–2 MB); always-hex (worse UX for image endpoints).

## R-7 Variable interpolation engine: hand-rolled, in TypeScript

- **Decision:** Single-pass state-machine tokenizer in `ui/src/lib/interpolation.ts`. ~80 LOC. No regex. No nested resolution. Escape via `\{{...\}}`.
- **Rationale:** Pulling in a templating engine (Handlebars, MiniJinja) adds 200–500 KB and unwanted features (loops, conditionals, scripting). Postman's `{{var}}` is trivial to parse.
- **Rejected:** Handlebars/MiniJinja/Tera (overkill); regex-based (escaping fragility).

## R-8 State management (frontend): native Svelte 5 runes

- **Decision:** Svelte 5 `$state` runes everywhere. Cross-cutting state in small modules under `ui/src/lib/state/`.
- **Rationale:** No external store dep. Runes give us reactivity without ceremony. Since the storage layer is also in TS, runes can transparently drive write-back via `$effect`.
- **Rejected:** Pinia/Zustand/Jotai (foreign + redundant); original Svelte stores (legacy style, runes are the future).

## R-9 Packaging: AppImage primary, .deb secondary, Flatpak later

- **Decision:** Ship AppImage as the primary deliverable; `.deb` as secondary; Flatpak later via Flathub.
- **Rationale:** AppImage is single-file, distro-agnostic. `.deb` covers apt-savvy Ubuntu/Debian users. Flatpak adds sandboxing investment.
- **Rejected:** Snap (Canonical-centric, slower start-up); tarball (DIY-feeling).

## R-11 Secrets at rest: plaintext JSON for v1

- **Decision:** Variables marked `is_secret: true` are stored as plaintext in the workspace's `globals.json` / `environments/*.json` files. They are masked in the UI, never logged, and excluded from JSON export unless the user opts in via `include_secrets: true`.
- **Rationale:** Local-only app, no sync. Threat model = "another user on the same machine reads my $XDG_DATA_HOME." Default file permissions on `$XDG_DATA_HOME` are 700 on Linux. Adding OS-keychain integration in v1 doubles the storage code path and introduces failure modes (keychain locked, headless support).
- **Documented limitation:** users with stricter threat models should not check `include_secrets` on export and should not use this tool on shared machines.
- **Deferred:** v1.1 — integrate `keyring` crate (Secret Service / Keychain / Credential Manager).
- **Rejected:** Encrypted JSON file with master key (key-storage problem); OS keyring in v1 (complexity).

## R-12 Multipart streaming via `Part::stream(tokio::fs::File)`

- **Decision:** Multipart file parts use `reqwest::multipart::Part::stream(File)` so file bytes never load into RAM.
- **Rationale:** Meets FR-005 (100 MB file parts).
- **Rejected:** Read-whole-file-then-attach (fails the 100 MB requirement).

## R-13 Async runtime: tokio multi-thread

- **Decision:** `tokio` with `rt-multi-thread`, `macros`, `fs`, `time`, `sync`, `signal` features only.
- **Rationale:** Tauri 2 uses tokio. Trimmed feature flags to keep binary lean.
- **Rejected:** async-std/smol (ecosystem fight).

## R-14 IPC payload format: Tauri default JSON

- **Decision:** Default JSON IPC serialization.
- **Rationale:** Frontend-native, debugger-friendly, no setup. Volume is low (per-event ≤ 64 KB chunk).
- **Rejected:** MessagePack / CBOR (premature optimization).

## R-15 Cookie jar: per-execution, in-memory only (v1)

- **Decision:** Each `http_send` constructs a fresh `cookie_store::CookieStore`. No persistence between requests.
- **Rationale:** Cookies in real workflows are usually obtained via a login request and reused immediately. v1 keeps the model simple.
- **Documented gap:** users with cookie-driven session flows must re-send the login before subsequent requests, OR capture and re-pass `Cookie` headers manually.
- **Deferred:** v1.1 — opt-in per-environment cookie jar.
- **Rejected:** Global persistent jar (cross-environment leakage); per-environment jar in v1 (storage + UI cost).

## R-16 History retention: 1000 entries LRU (day-file granularity)

- **Decision:** Default cap = 1000 history entries per workspace. User-configurable in `app.json`. LRU eviction by deleting the oldest day-file in full.
- **Rationale:** 1000 entries × ~1 KB each ≈ 1 MB on disk. Day-file granularity keeps eviction O(1).

## R-17 App ID: `dev.tricog.ltron-api`

- **Decision:** `dev.tricog.ltron-api` for Tauri identifier, desktop file, dbus name.
- **Rationale:** Reverse-DNS, matches Flatpak/Desktop conventions. `tricog.com` is the user's domain.

## R-18 Pre-/post-request scripting: out of scope v1

- **Decision:** No scripting in v1. Architecture leaves room for it in v1.5 — and since the rest of the app is TypeScript, scripting could use the WebView's own JS engine inside an iframe/Worker sandbox without bundling `boa_engine`.
- **Rationale:** Scripting is a feature multiplier with security implications. Ship the basics first.

## R-19 Protocols: HTTP-only in v1

- **Decision:** Plain HTTP/1.1 + HTTP/2. No dedicated WebSocket, gRPC, or SSE panes.
- **Rationale:** Each protocol carries its own UI affordances and dependencies. Doing HTTP well first.

## R-20 Export schema: versioned

- **Decision:** Every JSON export carries `{ "ltron_export_version": 1, "exported_at": "<iso8601>", "workspaces": [ ... ] }`. Import validates the version and refuses anything newer than the running app supports (EC-10).
- **Rationale:** Keeps future schema changes safe. One-line cost up front.

## R-21 IPC type bindings: small hand-written set

- **Decision:** Hand-write a TS interface file for the ~12 native commands' inputs / outputs / error variants in `ui/src/lib/ipc/types.ts`.
- **Rationale:** With **no domain types crossing IPC** (only transport shapes like `NativeRequest` and `DirEntry`), there's no codegen burden to justify pulling in `ts-rs` and a Rust build step. Drift is unlikely because the IPC surface is tiny and stable.
- **Rejected:** `ts-rs` (overkill for ~12 commands); `tauri-specta` (same).

## R-22 Schema versioning per entity file

- **Decision:** Every entity JSON file carries a top-level `"schema_version": 1`. The loader (`ui/src/lib/storage/loader.ts`) upgrades older shapes in place when needed.
- **Rationale:** JSON files don't get migrations for free (unlike SQLite). A version field lets us evolve the model without breaking older user data. Cheap to add now; impossible to add later without a v0 detection heuristic.
- **Documented:** every schema bump appends an upgrade function. Down-migrations are not supported.
