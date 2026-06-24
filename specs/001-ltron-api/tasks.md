# Ltron-api — Tasks

**Companion to:** [`spec.md`](spec.md), [`plan.md`](plan.md)
**Status:** Draft v2 (frontend-driven architecture)

Tasks are ordered by milestone. Each task has an ID, one-line description, dependencies, effort (S ≤ 0.5d, M ≤ 2d, L ≤ 5d), and the FR/NFR IDs it satisfies.

Format: `T-XYZ | description | deps | effort | satisfies`

## Legend
- **S** ≤ 0.5d, **M** ≤ 2d, **L** ≤ 5d
- `deps` = prerequisite task IDs; `-` = none.

---

## M0 — Scaffolding

Goal: A Tauri app that launches an empty 3-pane shell. No real features. Single Rust crate + Svelte 5 UI.

| ID    | Description                                                                                                                | Deps  | Effort | Satisfies        |
|-------|----------------------------------------------------------------------------------------------------------------------------|-------|--------|------------------|
| T-001 | Initialize `src-tauri/` (single Rust crate, no workspace) and `ui/` (Svelte 5 + Vite + UnoCSS) via `pnpm create tauri-app` | -     | S      | (foundation)     |
| T-002 | Wire `pnpm tauri dev` so changes hot-reload                                                                                | T-001 | S      | (foundation)     |
| T-003 | Release profile in `src-tauri/Cargo.toml` (`lto=fat / opt-level=z / strip / panic=abort`)                                  | T-001 | S      | SM-2             |
| T-004 | App shell: 3-pane layout (sidebar / center / response) with resizable splitters                                            | T-002 | M      | FR-016 (layout)  |
| T-005 | `app_data_dir` / `app_config_dir` / `app_cache_dir` commands + `ui/src/lib/ipc/paths.ts` wrapper                           | T-001 | S      | FR-035           |
| T-006 | Settings module: `ui/src/lib/state/app.svelte.ts` + load/save `app.json` on boot/quit                                      | T-005 | S      | FR-030, FR-035   |
| T-007 | `tauri-plugin-single-instance` wired                                                                                       | T-001 | S      | R-3c             |
| T-008 | Tracing setup (Rust side, dev-only, compiled out in release)                                                               | T-001 | S      | FR-036           |
| T-009 | CodeMirror 6 lazy chunk wired in `vite.config.ts`; verify it's in a separate JS bundle                                     | T-002 | S      | SM-2             |

## M1 — Single-request flow (no persistence yet)

Goal: User can compose a request, send it, see streaming response. Nothing saved.

| ID    | Description                                                                                                                  | Deps         | Effort | Satisfies                |
|-------|------------------------------------------------------------------------------------------------------------------------------|--------------|--------|--------------------------|
| T-101 | TS models in `ui/src/lib/models/`: `Request`, `NativeRequest`, `ExecutionEvent`, body/auth tagged unions                     | T-001        | M      | data-model §3 / §4       |
| T-102 | `src-tauri/src/http.rs`: shared `reqwest::Client` with rustls-tls-native-roots, default 30s timeout, redirect limit 10        | T-001        | S      | R-4                       |
| T-103 | `src-tauri/src/http.rs`: `http_send` async fn that streams events via Tauri `Channel<ExecutionEvent>`                         | T-102, T-101 | M      | FR-012, R-5              |
| T-104 | `src-tauri/src/http.rs`: `http_cancel` + `DashMap<ExecutionId, CancellationToken>` on AppState                               | T-103        | S      | FR-014                    |
| T-105 | `ui/src/lib/ipc/http.ts`: TS wrapper that opens a Channel, invokes `http_send`, dispatches events to a callback              | T-103        | S      | (foundation)              |
| T-106 | Request panel UI: method dropdown, URL bar, headers table, query params table (URL ↔ params live sync)                      | T-004        | L      | FR-001 / FR-002 / FR-003 |
| T-107 | Body editors: none / raw (JSON/XML/HTML/Text) / urlencoded / multipart / binary. Multipart file paths via `dialog_open_file` | T-106, T-009 | L      | FR-004, FR-005           |
| T-108 | Auth panel: none / Bearer / Basic / API key (header or query) / raw headers                                                  | T-106        | M      | FR-006                    |
| T-109 | Multipart streaming: `Part::stream(tokio::fs::File)` for file parts; manual test with 100 MB file                            | T-103        | M      | FR-005                    |
| T-110 | Response pane skeleton: status / latency / size / final URL                                                                  | T-105        | S      | FR-010                    |
| T-111 | Response body viewers: pretty JSON (collapsible), pretty XML, raw text, hex                                                  | T-110, T-009 | L      | FR-011                    |
| T-112 | Response body: image preview (png/jpg/gif/webp/svg) via blob URL                                                             | T-111        | S      | FR-011                    |
| T-113 | Response: PDF preview behind opt-in button (`<embed>`, no bundled renderer)                                                  | T-111        | S      | FR-011                    |
| T-114 | Streaming render: headers as soon as available, body progressively, virtualized viewer for > 10 MB                            | T-105, T-111 | M      | FR-012                    |
| T-115 | Cancel button wired to `http_cancel`; UI confirms within 200 ms                                                              | T-104, T-110 | S      | FR-014                    |
| T-116 | Per-request timeout / follow-redirects / verify-TLS toggles                                                                  | T-106        | S      | FR-007 / 008 / 009       |
| T-117 | Response headers table; cookies parsed from `Set-Cookie`                                                                     | T-110        | S      | FR-013                    |
| T-118 | Response actions: copy-body, save-to-disk (`dialog_save_file` + `fs_write_bytes`)                                            | T-110        | S      | FR-015                    |
| T-119 | Gzip/br/deflate auto-decompression in Rust shell; expose encoded vs decoded size                                             | T-111        | S      | EC-3                      |
| T-120 | Large response (> 100 MB): prompt to save to disk instead of rendering                                                       | T-111        | S      | EC-4                      |
| T-121 | Distinct error variants surfaced in UI (DNS / TLS / Timeout / Other) with actionable hints                                   | T-105        | S      | EC-1, EC-2               |

## M2 — Persistence (JSON files)

Goal: Workspaces, collections, folders, requests, environments persist as JSON files. History logs every send.

| ID    | Description                                                                                                                                              | Deps         | Effort | Satisfies              |
|-------|----------------------------------------------------------------------------------------------------------------------------------------------------------|--------------|--------|------------------------|
| T-201 | `src-tauri/src/fs.rs`: `fs_read`, `fs_read_bytes`, `fs_write` (atomic), `fs_write_bytes` (atomic), `fs_list`, `fs_delete`, `fs_mkdir`, `fs_rename`, `fs_exists`, `fs_stat` | T-005        | M      | R-3b, plan §3.1          |
| T-202 | `ui/src/lib/ipc/fs.ts`: TS wrappers for all `fs_*` commands                                                                                              | T-201        | S      | (foundation)             |
| T-203 | `ui/src/lib/storage/paths.ts`: tree → file path mapping; helpers for derive-path-from-entity                                                              | T-202        | M      | data-model §2            |
| T-204 | `ui/src/lib/storage/loader.ts`: boot-time walk reads metadata files only (no request bodies); populates `state/tree.svelte.ts`                            | T-203        | M      | SM-5                     |
| T-205 | `ui/src/lib/state/tree.svelte.ts`: in-memory tree state                                                                                                  | T-001        | S      | (foundation)             |
| T-206 | `ui/src/lib/storage/reader.ts`: lazy load request file on open; cache in `state/cache.svelte.ts`                                                          | T-203, T-205 | S      | (perf)                   |
| T-207 | `ui/src/lib/storage/writer.ts`: `$effect`-driven dirty tracking + 500 ms debounce + atomic write-back queue                                              | T-205, T-202 | M      | R-3a                     |
| T-208 | Flush write queue on `before_quit`; await completion before allowing exit                                                                                | T-207        | S      | (data integrity)         |
| T-209 | First-run bootstrap: create default workspace + "Scratch" collection + one example request                                                               | T-207        | S      | US-1, AC-1.1            |
| T-210 | History append to `history/YYYY-MM-DD.jsonl` after every send (success or error)                                                                          | T-202, T-105 | S      | FR-029                   |
| T-211 | History LRU cap: delete oldest day-file when total exceeds limit                                                                                         | T-210        | S      | FR-030, R-16            |
| T-212 | Blob storage helper: bodies < 1 MB inline in example JSON; ≥ 1 MB → `blobs/<sha256>.bin`                                                                  | T-202        | M      | data-model §6            |
| T-213 | Quarantine corrupted JSON on boot (move to `quarantine/<ts>/`, show notice)                                                                              | T-204        | M      | EC-8                     |
| T-214 | Tab session restore on launch: read `app.json:open_tabs`, reopen each                                                                                    | T-006, T-206 | M      | US-6, AC-6.1/2/3        |
| T-215 | Quit guard: warn if dirty entities are still pending write before app close (writer flushes, but UI should reassure)                                     | T-208        | S      | (UX)                     |

## M3 — Collections / Folders / UI tree

| ID    | Description                                                                                  | Deps         | Effort | Satisfies          |
|-------|----------------------------------------------------------------------------------------------|--------------|--------|--------------------|
| T-301 | Virtualized sidebar tree (`@tanstack/svelte-virtual`) bound to `state/tree.svelte.ts`        | T-204/T-205  | M      | FR-016/017/018     |
| T-302 | Drag-and-drop reorder + move across parents; updates `sort_index`; writer persists           | T-301, T-207 | M      | FR-018             |
| T-303 | "Save" / "Save as" from active request panel (collection + folder + name picker)             | T-301, T-106 | S      | FR-019, US-3      |
| T-304 | Duplicate / rename / delete with confirm; writer removes file + cleans empty parent dirs    | T-301, T-207 | S      | FR-020             |
| T-305 | Restore-into-panel from a history entry                                                      | T-210, T-106 | S      | FR-031             |
| T-306 | Depth-5 invariant check on folder create/move (FR-017)                                       | T-302        | S      | FR-017             |

## M4 — Environments & Variables

| ID    | Description                                                                                                  | Deps         | Effort | Satisfies                |
|-------|--------------------------------------------------------------------------------------------------------------|--------------|--------|--------------------------|
| T-401 | `environments/<env-uuid>.json` CRUD via storage layer; unique `name` per workspace, unique `key` per env     | T-207        | M      | FR-024                    |
| T-402 | `globals.json` CRUD; unique `key` per workspace                                                              | T-207        | S      | FR-025                    |
| T-403 | Environment switcher in header bar; updates `workspace.json:active_environment_id`                           | T-401, T-204 | S      | FR-024, US-4              |
| T-404 | `ui/src/lib/interpolation.ts`: state-machine resolver (~80 LOC), escape `\{{ ... \}}`                       | T-101        | M      | R-7, FR-026               |
| T-405 | Live resolved preview pane (synchronous, no IPC call — pure TS)                                              | T-404        | S      | FR-028                    |
| T-406 | Apply resolver at all interpolation sites in `http_send` payload construction                                | T-404, T-105 | M      | FR-026                    |
| T-407 | Unresolved → `VarUnresolvedError` (TS); UI highlights offending field                                        | T-406        | S      | FR-026, EC-5              |
| T-408 | Hover tooltip on variable references showing resolved value                                                  | T-405        | M      | FR-028                    |
| T-409 | Secret type: mask in UI (•••), don't log, exclude from default export                                        | T-401        | S      | FR-027                    |
| T-410 | Globals editor pane (workspace-scoped table)                                                                 | T-402        | S      | FR-025                    |
| T-411 | Environments editor pane (per-env table; rename, duplicate)                                                  | T-401        | M      | FR-024                    |

## M5 — Examples

| ID    | Description                                                                                                          | Deps                  | Effort | Satisfies         |
|-------|----------------------------------------------------------------------------------------------------------------------|-----------------------|--------|-------------------|
| T-501 | Inline example storage in `requests/<req-uuid>.json` under `examples: [...]`                                         | T-207                 | S      | FR-021/022       |
| T-502 | "Save as Example" action: snapshot request + response; store via writer                                              | T-501, T-110, T-212   | S      | FR-021, US-5     |
| T-503 | Examples shown as children of request in sidebar tree                                                                | T-301, T-501          | S      | FR-022            |
| T-504 | Spill examples to sidecar files (`requests/<req-id>.examples/<example-id>.json`) when request file > 256 KB         | T-501                 | M      | data-model §3.7   |
| T-505 | Read-only example viewer pane (request + response, no edit affordances)                                              | T-502                 | M      | FR-023            |
| T-506 | "Promote to request" duplicates the example as a new editable request in the same parent                            | T-505                 | S      | FR-023            |

## M6 — Import / Export

| ID    | Description                                                                                                                | Deps           | Effort | Satisfies        |
|-------|----------------------------------------------------------------------------------------------------------------------------|----------------|--------|------------------|
| T-601 | `ui/src/lib/storage/export.ts`: walk tree (lazy-load any unloaded requests), emit single bundle JSON via `fs_write` (atomic) | T-204..T-501  | M      | FR-032, R-20    |
| T-602 | Honor `include_secrets` flag (strip secret values when false)                                                              | T-601, T-409  | S      | FR-027           |
| T-603 | Atomic export write (writer already provides this via `fs_write`); disk-full produces clean error                          | T-601         | S      | EC-9             |
| T-604 | `ui/src/lib/storage/import.ts`: parse bundle, regenerate UUIDs, write folder tree                                          | T-601         | M      | FR-033           |
| T-605 | Conflict resolution dialog on workspace-name collision (skip / overwrite / rename)                                          | T-604         | S      | FR-033           |
| T-606 | Refuse import if `ltron_export_version` newer than supported; show supported range                                         | T-604         | S      | EC-10            |
| T-607 | **(Stretch)** Postman v2.1 collection import mapper; surface unmapped fields in import report                              | T-604         | L      | FR-034           |

## M7 — Polish & Packaging

| ID    | Description                                                                                                  | Deps  | Effort | Satisfies     |
|-------|--------------------------------------------------------------------------------------------------------------|-------|--------|---------------|
| T-701 | Benchmark scripts: idle RAM (SM-1), installed size (SM-2), cold-start (SM-3), 1000-request open (SM-5), drift (SM-6) | all   | M      | SM-1..6      |
| T-702 | CI gate: benchmarks fail the build on regression                                                             | T-701 | S      | SM-1..6      |
| T-703 | Linux: AppImage + `.deb` bundler config in `tauri.conf.json`; verify installed size ≤ 20 MB                  | all   | M      | R-9, SM-2    |
| T-704 | Windows: WebView2 bootstrapper + NSIS installer config                                                       | all   | M      | (cross-plat) |
| T-705 | macOS: universal binary + .dmg; document signing/notarization deferral                                       | all   | M      | (cross-plat) |
| T-706 | Concurrent-edit toast on stale read (defense in depth even with single-instance plugin)                      | T-207 | S      | EC-7         |
| T-707 | Keyboard shortcuts: Ctrl+Enter send, Ctrl+S save, Ctrl+T new tab, Ctrl+W close tab                           | T-106 | S      | (UX)         |
| T-708 | A11y pass: keyboard nav, ARIA labels, contrast                                                               | T-004 | M      | (UX)         |
| T-709 | Theme: light + dark with `prefers-color-scheme` + manual override persisted in `app.json`                    | T-006 | S      | plan §5.7    |
| T-710 | Docs: README expanded, user guide, JSON export schema doc                                                    | all   | M      | (docs)       |
| T-711 | Send-overhead benchmark vs curl (SM-4) — record baseline, gate at +15 ms                                     | T-701 | S      | SM-4         |

---

## Dependency snapshot

- **M0** is independent (scaffold).
- **M1** depends on M0; can land standalone (no persistence).
- **M2** depends on M0 (paths/settings) and is independent of M1's UI work.
- **M3** depends on M2 (data layer) + M1 (request panel).
- **M4** depends on M2 (env files) + M1 (interpolation applied at send).
- **M5** depends on M2 (storage) + M1 (response pane).
- **M6** depends on M2..M5.
- **M7** is final.

Realistic v1.0 timeline (single dev, focused): **2.5–3.5 months** (slightly faster than the prior plan because no Rust workspace setup, no sqlx migrations, no domain types on two sides).
