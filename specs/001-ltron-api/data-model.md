# Ltron-api — Data Model

**Companion to:** [`spec.md`](spec.md), [`plan.md`](plan.md)
**Status:** Draft v2 (folder-tree of JSON files)

This document describes the storage layout and the JSON shapes of every persisted entity. The model lives in TypeScript (`ui/src/lib/models/`) — there are no domain types on the Rust side.

## 1. Entity catalog

| Entity              | Purpose                                              | Parent                  |
|---------------------|------------------------------------------------------|-------------------------|
| `Workspace`         | Top-level container                                  | (root)                  |
| `Collection`        | Group of related requests                            | `Workspace`             |
| `Folder`            | Nested grouping inside a collection                  | `Collection` or `Folder`|
| `Request`           | Reusable HTTP call definition                        | `Collection` or `Folder`|
| `Example`           | Saved (request, response) snapshot                   | `Request`               |
| `Environment`       | Named variable scope                                 | `Workspace`             |
| `EnvironmentVar`    | k/v inside an Environment                            | `Environment`           |
| `GlobalVar`         | k/v in workspace-level global scope                  | `Workspace`             |
| `HistoryEntry`      | Record of one past execution                         | `Workspace`             |
| `AppSettings`       | Singleton user prefs                                 | (root)                  |

## 2. On-disk layout

All IDs are UUIDv7 (sortable, generated in TypeScript via the `uuidv7` package). Paths use the ID, not the name, so renames touch only the file contents.

```
$XDG_DATA_HOME/ltron-api/
├── app.json                                          # singleton AppSettings
└── workspaces/
    └── <ws-uuid>/                                    # one folder per workspace
        ├── workspace.json
        ├── globals.json                              # all global variables for this workspace
        ├── environments/
        │   ├── <env-uuid>.json                       # one env (with its variables inline)
        │   └── …
        ├── collections/
        │   └── <coll-uuid>/
        │       ├── collection.json
        │       ├── folders/                          # OPTIONAL: only present if there are folders
        │       │   └── <folder-uuid>/                # recursive — same structure
        │       │       ├── folder.json
        │       │       ├── folders/…                 # nested folders
        │       │       └── requests/                 # OPTIONAL: requests in this folder
        │       │           ├── <req-uuid>.json
        │       │           └── …
        │       ├── requests/                         # OPTIONAL: requests at collection root (no folder)
        │       │   └── <req-uuid>.json
        │       └── blobs/                            # OPTIONAL: large response bodies
        │           └── <sha256>.bin
        └── history/
            ├── 2026-06-18.jsonl                      # one JSONL per UTC day
            └── 2026-06-17.jsonl
```

**Conventions:**
- Optional directories are not created until needed. A brand-new collection has only `collection.json`.
- Empty `folders/` and `requests/` directories are removed when the last child is deleted (the storage writer takes care of this).
- A folder file (`folder.json`) is always at `…/folders/<folder-uuid>/folder.json` — never at the parent's level.
- Schema versioning: every entity file carries a top-level `"schema_version": 1`. The loader (`ui/src/lib/storage/loader.ts`) upgrades older versions in place.

## 3. JSON shapes

### 3.1 `app.json`
```json
{
  "schema_version": 1,
  "theme": "system",
  "theme_override": null,
  "history_limit": 1000,
  "default_timeout_ms": 30000,
  "last_active_workspace_id": "<ws-uuid>",
  "open_tabs": [
    { "workspace_id": "<ws-uuid>", "request_id": "<req-uuid>", "dirty": false }
  ],
  "splitter_widths": { "sidebar": 280, "response": 480 },
  "window_size": { "w": 1280, "h": 800 },
  "telemetry_enabled": false
}
```
`telemetry_enabled` is always `false` in v1; the field exists so the absence of telemetry is auditable.

### 3.2 `workspace.json`
```json
{
  "schema_version": 1,
  "id": "<ws-uuid>",
  "name": "Default",
  "active_environment_id": "<env-uuid>",
  "created_at": 1750000000000,
  "updated_at": 1750000000000
}
```

**Invariants:**
- At least one workspace always exists (delete blocked when last).
- `active_environment_id` must reference an env in the same workspace, or be `null`.

### 3.3 `globals.json`
```json
{
  "schema_version": 1,
  "workspace_id": "<ws-uuid>",
  "variables": [
    { "key": "base_url", "value": "https://api.example.com", "is_secret": false, "enabled": true },
    { "key": "api_key",  "value": "sk_...",                  "is_secret": true,  "enabled": true }
  ]
}
```

**Invariants:** unique `key` per file.

### 3.4 `environments/<env-uuid>.json`
```json
{
  "schema_version": 1,
  "id": "<env-uuid>",
  "workspace_id": "<ws-uuid>",
  "name": "staging",
  "sort_index": 1.0,
  "variables": [
    { "key": "base_url", "value": "https://api.staging.example.com", "is_secret": false, "enabled": true }
  ]
}
```

**Invariants:** unique `name` per workspace, unique `key` per env.

### 3.5 `collections/<coll-uuid>/collection.json`
```json
{
  "schema_version": 1,
  "id": "<coll-uuid>",
  "workspace_id": "<ws-uuid>",
  "name": "Auth APIs",
  "description": null,
  "sort_index": 1.0,
  "created_at": 1750000000000,
  "updated_at": 1750000000000
}
```

### 3.6 `folders/<folder-uuid>/folder.json`
```json
{
  "schema_version": 1,
  "id": "<folder-uuid>",
  "collection_id": "<coll-uuid>",
  "parent_folder_id": null,
  "name": "Admin",
  "sort_index": 1.0,
  "created_at": 1750000000000,
  "updated_at": 1750000000000
}
```

**Invariants:**
- Max nesting depth = 5 (FR-017). Enforced by `ui/src/lib/storage/writer.ts` on insert/move.
- No cycles. `parent_folder_id` chain terminates at `null`.
- All ancestors share the same `collection_id`.

### 3.7 `requests/<req-uuid>.json`
```json
{
  "schema_version": 1,
  "id": "<req-uuid>",
  "collection_id": "<coll-uuid>",
  "folder_id": "<folder-uuid>",
  "name": "Get user by ID",
  "method": "GET",
  "url": "{{base_url}}/users/{{id}}",
  "headers": [
    { "key": "Accept", "value": "application/json", "enabled": true }
  ],
  "query_params": [
    { "key": "expand", "value": "profile", "enabled": true }
  ],
  "body_mode": "none",
  "body": null,
  "auth": { "kind": "bearer", "token": "{{access_token}}" },
  "timeout_ms": null,
  "follow_redirects": true,
  "verify_tls": true,
  "sort_index": 1.0,
  "examples": [
    {
      "id": "<example-uuid>",
      "name": "happy path",
      "request_snapshot": { /* request as sent, variables resolved */ },
      "response_snapshot": {
        "status": 200,
        "headers": [{ "key": "Content-Type", "value": "application/json" }],
        "body_inline": "{\"user\":{...}}",
        "body_blob_sha256": null,
        "size": 1234,
        "latency_ms": 87,
        "ttfb_ms": 41
      },
      "created_at": 1750000000000
    }
  ],
  "created_at": 1750000000000,
  "updated_at": 1750000000000
}
```

**Example storage heuristic:**
- If the request file (including all inline examples) would exceed **256 KB**, examples spill into sibling files: `requests/<req-uuid>.examples/<example-uuid>.json`. The request file then carries `"examples_external": true` and a slim listing `[{ "id", "name", "created_at" }]` so the UI can show the list without loading each example.
- Inline (the default) is simpler and fits the typical case (small JSON responses).

**Response body size policy:**
- `body_inline` set (string) when the body is ≤ 1 MB and content-type is text-ish.
- `body_blob_sha256` set (and `body_inline` null) when the body is > 1 MB or binary. The blob lives at `collections/<coll-uuid>/blobs/<sha256>.bin`. Multiple examples can share a blob (dedup by hash).

### 3.8 `history/YYYY-MM-DD.jsonl`
One JSON object per line, append-only, UTC date in filename:
```jsonl
{"id":"<h-uuid>","workspace_id":"<ws-uuid>","request_id":"<req-uuid>","method":"GET","url":"https://api.../users/42","status_code":200,"duration_ms":87,"ttfb_ms":41,"error_kind":null,"request_snapshot":{...},"response_meta":{"status":200,"headers":[...],"size":1234},"response_body_path":null,"executed_at":1750000000000}
```

**Retention:**
- Total cap = 1000 entries per workspace (configurable in `app.json`).
- LRU eviction: when total exceeds cap, delete the oldest day-file in full. (Granularity = a whole day; simpler than per-line eviction. With ~30 sends/day average, this loses < a day on a single overflow.)
- `request_id` may dangle (request was deleted); the row remains.

## 4. Tagged JSON unions

### 4.1 `body` (in `requests/*.json`)
```json
// body_mode = "none"
null

// body_mode = "raw"
{ "kind": "raw", "content_type": "application/json", "text": "..." }

// body_mode = "urlencoded"
{ "kind": "urlencoded", "fields": [
  { "key": "k", "value": "v", "enabled": true }
]}

// body_mode = "multipart"
{ "kind": "multipart", "parts": [
  { "kind": "text", "key": "name", "value": "alice", "enabled": true },
  { "kind": "file", "key": "avatar", "path": "/abs/path/to/file", "content_type": "image/png", "enabled": true }
]}

// body_mode = "binary"
{ "kind": "binary", "path": "/abs/path/to/file", "content_type": "application/octet-stream" }
```

### 4.2 `auth`
```json
{ "kind": "none" }
{ "kind": "bearer", "token": "{{access_token}}" }
{ "kind": "basic",  "username": "user", "password": "{{password}}" }
{ "kind": "api_key", "key": "X-API-Key", "value": "{{api_key}}", "in": "header" }
{ "kind": "api_key", "key": "api_key",   "value": "{{api_key}}", "in": "query"  }
{ "kind": "raw_headers", "headers": [
  { "key": "Authorization", "value": "Custom …", "enabled": true }
]}
```

## 5. Variable resolution rules

Same model as v1; implementation moves from Rust to `ui/src/lib/interpolation.ts`.

### 5.1 Precedence (highest first)
1. **Per-request temporary overrides** — UI-only, not persisted.
2. **Active environment variables** — one env active per workspace; skips disabled rows.
3. **Workspace global variables** — skips disabled rows.
4. *(deferred to v1.1)* Process env via `{{$env.NAME}}` namespace.

Folder-level and collection-level variables are **not** in the precedence chain in v1.

### 5.2 Interpolation sites
Applied to: URL; enabled header keys + values; enabled query-param keys + values; auth values; raw body text; enabled urlencoded keys + values; enabled multipart text-part keys + values; multipart file-part `path`. Not applied to file contents.

### 5.3 Errors
- Unresolved variable → `VarUnresolvedError(name)` thrown in TS. UI highlights the offending field; no send.
- Whitespace inside `{{ ... }}` is trimmed.
- Empty key (`{{}}`, `{{ }}`) → validation error.
- Max recursion depth = 10 (defense in depth; v1 doesn't re-scan resolved values, so a depth counter is enough).

## 6. Tricky semantics (decided)

- **Sibling ordering:** fractional `sort_index` (REAL). Reorder = pick midpoint between neighbors → O(1) writes per move. Rebalance pass at workspace load if any neighbor pair drifts within `1e-9`.
- **Folder nesting via physical directories.** Recursive walk on read; mutation cost is O(1) (move one folder + write the moved folder.json). Closure tables / materialized paths are unnecessary at our depth cap of 5.
- **Hard delete.** No soft-delete flag. The user's backup story is JSON export. (`deleted_at` field could be added later without schema break.)
- **Examples are frozen.** They store the resolved request + the response. Editing the parent request never mutates examples.
- **Env switch is workspace-scoped state** (`workspace.json:active_environment_id`), persisted across restarts.
- **Folder / collection variables** are not stored in v1 (no field). They can be added as `folder_vars` / `collection_vars` arrays in the respective JSON file when promoted into the resolver chain.
- **Response body inline-vs-blob threshold = 1 MB.** Below: serialized into the example's `response_snapshot.body_inline`. Above: written to `blobs/<sha256>.bin`, referenced by hash.
- **Blob dedup:** multiple examples can reference the same blob via SHA-256. Blobs are GC'd when no remaining example references them (the writer scans `examples[*].response_snapshot.body_blob_sha256` on collection close).
- **Concurrency:** single-instance plugin + atomic writes (write-tmp + rename). v1 has exactly one writer at any time. No locks.
- **Path stability:** filesystem paths use UUIDs only. Renaming an entity changes only the `name` field in its JSON; no directory rename, no broken cross-references.

## 7. Loader / writer summary

(Implementation lives in `ui/src/lib/storage/`.)

- **Boot:** `loader.ts` reads `app.json`, then for the active workspace: `workspace.json`, `globals.json`, all `environments/*.json`, all `collections/*/collection.json`, all `folder.json` files (recursive). Does **not** read request bodies. Builds the in-memory tree in `state/tree.svelte.ts`. ~50–100 files for a typical workspace.
- **Open a request:** `reader.ts` reads the request file, parses, caches in `state/cache.svelte.ts`.
- **Save / mutate:** edit in `$state`; `writer.ts` observes via `$effect`, marks dirty, debounces 500 ms, atomic-writes the file. On app quit, flushes the queue before allowing exit.
- **Delete:** `writer.ts` removes the file (and any now-empty parent directories like `folders/`, `requests/`, `examples/`).
- **History append:** `writer.ts` appends a single line to `history/<today>.jsonl` after every send. LRU sweep evicts oldest day-files when over cap.
- **Export:** `export.ts` traverses the tree, lazy-loads any unloaded requests, emits a single bundle JSON.
- **Import:** `import.ts` parses bundle, regenerates UUIDs, writes the folder tree.
