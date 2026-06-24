# Ltron-api — IPC Command Contracts

**Companion to:** [`../plan.md`](../plan.md) §3
**Status:** Draft v2 (thin native shell)

This is the **entire** catalog of Tauri commands. There are no domain-CRUD commands — workspace/collection/folder/request/environment/example/history/import/export operations all happen in the frontend, composing the native primitives below.

Naming: `snake_case` Rust → `camelCase` TS via Tauri.

---

## 1. HTTP

### `http_send`
Fire an HTTP request. Returns an `ExecutionId` immediately; results stream via the supplied `Channel<ExecutionEvent>`.

```ts
http_send(req: NativeRequest, channel: Channel<ExecutionEvent>) -> ExecutionId
```

`NativeRequest` (transport-only; the frontend interpolates variables before sending):
```ts
type NativeRequest = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS"
  url: string
  headers: Array<{ key: string; value: string }>     // enabled rows only, resolved
  query_params: Array<{ key: string; value: string }>
  body:
    | { kind: "none" }
    | { kind: "raw"; content_type: string; text: string }
    | { kind: "urlencoded"; fields: Array<{ key: string; value: string }> }
    | { kind: "multipart"; parts: Array<MultipartPart> }
    | { kind: "binary"; path: string; content_type: string }
  auth: AuthSpec                                      // resolved
  timeout_ms: number | null                            // null = default 30s, 0 = none
  follow_redirects: boolean
  verify_tls: boolean
}

type MultipartPart =
  | { kind: "text"; key: string; value: string }
  | { kind: "file"; key: string; path: string; content_type: string }

type AuthSpec =
  | { kind: "none" }
  | { kind: "bearer"; token: string }
  | { kind: "basic"; username: string; password: string }
  | { kind: "api_key"; key: string; value: string; in: "header" | "query" }
  | { kind: "raw_headers"; headers: Array<{ key: string; value: string }> }

type ExecutionId = string  // UUIDv7
```

**Errors:** `Validation`, `NetworkDns`, `NetworkTls`, `NetworkTimeout`, `NetworkOther`, `Io` (file part read fail).
**Streaming:** see [`events.md`](events.md) §1.

### `http_cancel`
```ts
http_cancel(execution_id: ExecutionId) -> ()
```

**Errors:** `NotFound` (unknown execution_id; idempotent — also acceptable to return `()`).

---

## 2. Filesystem

All paths are absolute. Tauri capabilities scope these commands to the app's data/config/cache directories (no arbitrary filesystem access).

### `fs_read`
Read a UTF-8 text file (for JSON files).
```ts
fs_read(path: string) -> string
```
**Errors:** `NotFound`, `Io`, `Permission`, `Validation` (not valid UTF-8).

### `fs_read_bytes`
Read a binary file (for blob loads).
```ts
fs_read_bytes(path: string) -> Uint8Array
```
**Errors:** `NotFound`, `Io`, `Permission`.

### `fs_write`
Atomic write of UTF-8 content. Implementation: write to `<path>.tmp`, fsync, rename over `<path>`.
```ts
fs_write(path: string, content: string) -> ()
```
**Errors:** `Io`, `Permission`.

### `fs_write_bytes`
Atomic write of bytes (same semantics as `fs_write`).
```ts
fs_write_bytes(path: string, bytes: Uint8Array) -> ()
```
**Errors:** `Io`, `Permission`.

### `fs_list`
List directory entries (non-recursive).
```ts
fs_list(path: string) -> Array<DirEntry>

type DirEntry = { name: string; is_dir: boolean }
```
**Errors:** `NotFound`, `Io`, `Permission`, `Validation` (not a directory).

### `fs_delete`
Delete a file or directory. `recursive: true` deletes a directory and all its contents; `recursive: false` requires an empty directory or fails.
```ts
fs_delete(path: string, recursive: boolean) -> ()
```
**Errors:** `NotFound`, `Io`, `Permission`, `Validation` (non-empty dir with `recursive: false`).

### `fs_mkdir`
Create directory (recursive — equivalent to `mkdir -p`).
```ts
fs_mkdir(path: string) -> ()
```
**Errors:** `Io`, `Permission`.

### `fs_rename`
Rename / move a file or directory.
```ts
fs_rename(from: string, to: string) -> ()
```
**Errors:** `NotFound`, `Io`, `Permission`.

### `fs_exists`
Check if a path exists.
```ts
fs_exists(path: string) -> boolean
```
(Never errors — non-existence is a `false`, not an error.)

### `fs_stat`
Get file metadata.
```ts
fs_stat(path: string) -> FileStat

type FileStat = {
  size: number       // bytes; 0 for directories
  modified_ms: number
  is_dir: boolean
}
```
**Errors:** `NotFound`, `Io`, `Permission`.

---

## 3. Dialogs

### `dialog_open_file`
Show a native "Open File" dialog. Returns `null` if the user cancels.
```ts
dialog_open_file(filters?: Array<DialogFilter>) -> string | null

type DialogFilter = { name: string; extensions: Array<string> }
```
**Errors:** none (cancellation is `null`, not an error).

### `dialog_save_file`
Show a native "Save File" dialog. Returns `null` if the user cancels.
```ts
dialog_save_file(default_name?: string, filters?: Array<DialogFilter>) -> string | null
```
**Errors:** none.

---

## 4. Path lookup

These return absolute paths (created if missing). Cached in `ui/src/lib/ipc/paths.ts` after first call.

### `app_data_dir`
Returns `$XDG_DATA_HOME/ltron-api/` (Linux), `%APPDATA%\ltron-api\` (Windows), `~/Library/Application Support/ltron-api/` (macOS).
```ts
app_data_dir() -> string
```

### `app_config_dir`
Returns `$XDG_CONFIG_HOME/ltron-api/` (or platform equivalent).
```ts
app_config_dir() -> string
```

### `app_cache_dir`
Returns `$XDG_CACHE_HOME/ltron-api/` (or platform equivalent).
```ts
app_cache_dir() -> string
```

**Errors:** `Io` (rare — base dir creation failure).

---

## 5. Common error contract

All commands return `Result<T, AppError>`. Serialized to JSON as:

```json
{
  "kind": "NotFound",
  "message": "no such file: /path/to/file.json",
  "detail": { "path": "/path/to/file.json" }
}
```

`kind` is one of:
`Io`, `NotFound`, `Permission`, `Validation`, `Cancelled`,
`NetworkDns`, `NetworkTls`, `NetworkTimeout`, `NetworkOther`.

The frontend matches on `kind` to render targeted UI (red field for `Validation`, recovery dialog for `Io` in critical paths, etc.).

---

## 6. What lives in the frontend (NOT in this contract)

Every higher-level concept is composed in TypeScript using the primitives above. None of these are IPC commands:

- `workspace.*` — `ui/src/lib/storage/` reads `workspaces/<ws-uuid>/workspace.json` etc. via `fs_*`.
- `collection.*`, `folder.*`, `request.*`, `example.*` — same.
- `environment.*`, `variable.*`, `globals.*` — same.
- `history.*` — append to `history/<date>.jsonl` via `fs_write`/`fs_read`.
- `io.export_workspace` / `io.import` — `ui/src/lib/storage/export.ts` and `import.ts` walk the tree and use `fs_*` + `dialog_save_file`/`dialog_open_file`.
- `settings.*` — `ui/src/lib/state/app.svelte.ts` + `fs_read`/`fs_write` on `app.json`.
- Variable interpolation — pure TS in `ui/src/lib/interpolation.ts`; no IPC needed.

This is by design: the IPC surface stays tiny (12 commands), and domain logic stays in one language.
