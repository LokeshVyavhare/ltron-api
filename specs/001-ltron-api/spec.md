# Ltron-api — Specification

**Status:** Draft v1 (Phase 0 design)
**Last updated:** 2026-06-18
**Owner:** lokesh.vyavhare@tricog.com

## 1. Overview

Ltron-api is a desktop API client that lets a developer compose, send, save, and re-run HTTP requests without launching a heavy Electron application. It is local-first (no accounts, no sync, no telemetry), Linux-primary, and explicitly targets a fraction of the RAM and disk footprint of mainstream tools.

### 1.1 Primary persona

Backend / full-stack engineer who:
- Works on a Linux laptop (frequently a midrange dev machine with 8–16 GB RAM)
- Has Postman, Insomnia, or similar installed and finds them sluggish to launch and heavy on memory
- Uses an API client several times a day for ad-hoc requests, collection-driven flows, and shared example responses
- Does not need team sync, mocking, or scripted test suites in the same tool

### 1.2 Out of scope (see also §5 Non-Goals)

Ltron-api is not trying to be a Postman replacement for collaboration, mocking, monitoring, or contract testing. It is the request-builder + organizer slice, done lean.

## 2. Functional Requirements

Requirements are grouped by capability and numbered for cross-reference from `plan.md` and `tasks.md`.

### 2.1 Request Composition (FR-Request)

- **FR-001** Support HTTP methods: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS.
- **FR-002** Editable URL bar with inline query-param parsing. The URL field and the params table stay in sync (edit either, the other updates).
- **FR-003** Headers table with per-row enable/disable toggle. Provide autocomplete from a static dictionary of common headers (Content-Type, Accept, Authorization, etc.).
- **FR-004** Request body modes:
  - `none`
  - `raw` with subtype: JSON / XML / HTML / Text (drives Content-Type and syntax highlight)
  - `x-www-form-urlencoded` (key/value table)
  - `multipart/form-data` (text fields + file parts)
  - `binary` (single file from disk)
- **FR-005** Multipart file parts must be streamed from disk during send. Support file parts up to 100 MB without loading the whole file into memory.
- **FR-006** Per-request auth panel with modes: none, Bearer token, Basic (user/pass), API key (header or query), custom raw headers.
- **FR-007** Per-request timeout override. Default timeout = 30 s. `0` = no timeout.
- **FR-008** Per-request "follow redirects" toggle. Default = on, max 10 hops.
- **FR-009** Per-request "verify TLS certificate" toggle. Default = on; explicit warning banner when set off.

### 2.2 Response Handling (FR-Response)

- **FR-010** Response panel shows status code, latency (ms), size (bytes), and final URL after redirects.
- **FR-011** Body viewers:
  - Pretty JSON (collapsible tree)
  - Pretty XML
  - Raw text
  - Hex (for binary)
  - Image preview for png/jpg/gif/webp/svg
  - PDF preview (opt-in via "Preview as PDF" button — not default to avoid renderer cost)
- **FR-012** Streaming response: render headers as soon as available; render text body progressively as bytes arrive. Bodies > 10 MB shown through a virtualized viewer.
- **FR-013** Response headers table; Cookies table parsed from `Set-Cookie`.
- **FR-014** Cancel in-flight request (single click). Cancellation completes within 200 ms.
- **FR-015** "Copy body" and "Save response to disk" actions.

### 2.3 Organization (FR-Org)

- **FR-016** Workspaces are the top-level container. Minimum one workspace always exists. Users can create / rename / delete workspaces (delete blocked if last).
- **FR-017** Collections live inside a workspace. Folders nest within collections to a maximum depth of 5.
- **FR-018** Requests live inside collections or folders. Drag-and-drop reorders siblings within a parent and moves nodes across parents.
- **FR-019** "Save" / "Save as" from the active request panel writes into a collection or folder, with a name and optional description.
- **FR-020** Duplicate, move, and rename actions on requests, folders, and collections.

### 2.4 Examples (FR-Example)

- **FR-021** From any executed request, "Save as Example" captures a snapshot pair: full request as sent + full response as received + timestamp + optional name.
- **FR-022** Examples are children of a request. A request can have N examples.
- **FR-023** Examples open in a read-only viewer. A "Promote to request" action duplicates the example as a new editable request in the same parent.

### 2.5 Environments & Variables (FR-Env)

- **FR-024** Workspace can hold N named environments. Exactly one is active at a time per workspace (or none).
- **FR-025** A single Global scope exists per workspace and is shared across all requests in that workspace.
- **FR-026** Variable substitution syntax: `{{var_name}}`. Whitespace inside the braces is allowed and trimmed (`{{ foo }}` == `{{foo}}`). Substitution applies in: URL, query param keys and values, header keys and values, auth field values, raw body, form-data text fields, urlencoded fields. Does NOT apply to binary file contents.
- **FR-027** Variables are typed: `text` or `secret`. Secrets are masked in the UI (•••), never logged, and excluded from JSON export unless the user explicitly opts in via `include_secrets`.
- **FR-028** Live preview of the resolved URL, headers, and body before send (hover or dedicated "Preview" tab).

### 2.6 History (FR-History)

- **FR-029** Every send is logged to History with: timestamp, method, URL, status code, latency, error (if any).
- **FR-030** History is capped per workspace. Default cap = 1000 entries; user-configurable in settings. Eviction policy: LRU (oldest first).
- **FR-031** Any history entry can be restored into the active request panel.

### 2.7 Import / Export (FR-IO)

- **FR-032** Export a workspace as a single JSON file (Ltron native format). File carries `{ "ltron_export_version": 1, "data": {...} }` so the schema can evolve.
- **FR-033** Import a Ltron JSON. On name collisions, the user picks per-conflict: skip / overwrite / rename.
- **FR-034** **Stretch (non-MVP)** Import a Postman v2.1 collection. Best-effort mapping; unmapped fields surfaced in an import report.

### 2.8 Persistence & Privacy (FR-Priv)

- **FR-035** All data is stored locally under XDG-compliant paths:
  - Data: `$XDG_DATA_HOME/ltron-api/` as a folder tree of JSON files — one file per workspace, collection, folder, request, environment, and global-vars set; history as date-rotated JSONL files; large response bodies as sidecar blob files under `…/blobs/`. See [`data-model.md`](data-model.md) for the full on-disk layout.
  - Config (user prefs): `$XDG_CONFIG_HOME/ltron-api/config.toml`
  - Cache (large response spillover during streaming, before save-as-example): `$XDG_CACHE_HOME/ltron-api/responses/`
  - Logs: `$XDG_STATE_HOME/ltron-api/logs/`
- **FR-036** Zero telemetry. No crash reporting upload. No update-check pings. No analytics.
- **FR-037** Zero network egress except for HTTP requests explicitly fired by the user via the request panel.

## 3. User Stories

Each story includes acceptance criteria (AC).

### US-1 — First-run experience
**As a** new user, **I want** to start sending a request within seconds of launch, **so that** the tool earns its keep immediately.

- **AC-1.1** On first launch, a default workspace exists with one scratch request preloaded.
- **AC-1.2** The user can change the URL to `https://httpbin.org/get` and click Send in ≤ 3 clicks from launch.
- **AC-1.3** A response is rendered within 2 s (excluding network latency).

### US-2 — Compose & send
**As a** developer, **I want** to compose a POST with a JSON body and custom headers, **so that** I can hit my service's API.

- **AC-2.1** Method dropdown changes to POST.
- **AC-2.2** Headers `Content-Type: application/json` is auto-suggested when raw-JSON body mode is selected.
- **AC-2.3** Response body is pretty-printed JSON, collapsible.

### US-3 — Save & organize
**As a** developer, **I want** to save the current request into a folder structure, **so that** I can re-run it later.

- **AC-3.1** "Save" prompts for collection > folder > name.
- **AC-3.2** Saved request appears in the sidebar tree immediately.
- **AC-3.3** Closing and reopening the app preserves the tree.

### US-4 — Env-switch reuse
**As a** developer, **I want** to switch from `dev` to `staging` environment, **so that** the same request hits a different base URL.

- **AC-4.1** URL contains `{{base_url}}/users/{{id}}`.
- **AC-4.2** Env switcher in the header bar changes the active env.
- **AC-4.3** Send uses the new resolution; live preview confirms before send.

### US-5 — Snapshot as example
**As a** developer, **I want** to save a known-good response as a named example, **so that** I can compare future runs against it.

- **AC-5.1** "Save as Example" on response panel prompts for name.
- **AC-5.2** Example appears under the request node in the sidebar.
- **AC-5.3** Opening the example shows the original request and response read-only.

### US-6 — Resume on restart
**As a** developer, **I want** my last open tabs and active workspace restored on launch, **so that** I don't lose context.

- **AC-6.1** On launch, last-active workspace is selected.
- **AC-6.2** Tabs that were open on last clean shutdown reopen.
- **AC-6.3** Unsaved request state from a tab is restored (best-effort, persisted on tab change and on quit).

## 4. Success Metrics

These are testable and gated in CI for M7.

| ID    | Metric                                                                | Target                  |
|-------|-----------------------------------------------------------------------|-------------------------|
| SM-1  | Idle RAM (1 workspace, 0 in-flight requests, RSS via `ps`)            | ≤ 100 MB                |
| SM-2  | Installed footprint (extracted `.deb` content size)                   | ≤ 20 MB                 |
| SM-3  | Cold start to interactive request panel (Intel i5-8xxx, 8 GB RAM)     | ≤ 500 ms                |
| SM-4  | Send-to-first-byte overhead added by app vs raw `curl`                | ≤ 15 ms                 |
| SM-5  | Open a workspace containing 1000 saved requests                       | ≤ 1 s                   |
| SM-6  | RSS drift after 1000 sequential sends                                 | < 10 MB                 |

## 5. Non-Goals

What we are explicitly **not** building in v1:

- **NG-1** No cloud sync, accounts, teams, or sharing.
- **NG-2** No mocking server. Examples are user-saved snapshots, not mock responses.
- **NG-3** No pre-request / post-request scripting (no JS sandbox).
- **NG-4** No test runner or Newman equivalent.
- **NG-5** No dedicated WebSocket / gRPC / GraphQL / SSE UIs. Raw HTTP only.
- **NG-6** No telemetry. No remote crash reporting.
- **NG-7** No plugin or extension system.

## 6. Edge Cases & Error Scenarios

The implementation must handle each of these explicitly (not via generic "network error" toasts).

- **EC-1** DNS resolution failure → distinct error variant + actionable message.
- **EC-2** TLS handshake failure → message includes hint (`expired`, `self-signed`, `hostname mismatch`).
- **EC-3** Server returns `gzip` / `br` / `deflate` → auto-decompress; show both encoded and decoded size.
- **EC-4** Response body > 100 MB → prompt to save to disk instead of rendering in WebView.
- **EC-5** Variable referenced but unresolved → send-time hard error naming the offending variable. Never silently substitute empty string.
- **EC-6** Circular variable reference (`a -> b -> a`) → detected pre-send; both keys flagged.
- **EC-7** Two windows / tabs editing the same saved request → last-write-wins, toast notifies the loser.
- **EC-8** A corrupted or unreadable JSON file on startup → that file is quarantined (moved aside to `…/quarantine/<timestamp>/`) and the app launches with a notice; user can attempt to restore from the most recent export. Other files load normally.
- **EC-9** Disk full during JSON export → atomic write via tempfile + rename; original file untouched on failure.
- **EC-10** Importing a JSON with `ltron_export_version` newer than what the running app supports → refuse, show the supported range, do not partially import.
