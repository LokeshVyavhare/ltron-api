# Ltron-api — User Guide

A lightweight, local-first desktop API client. This guide covers the v0 release.

## Launching the app

After installing the `.deb`:

```sh
ltron-api &
```

Or find **Ltron-api** in your application launcher (GNOME Activities, KDE Kickoff, etc.).

On first launch, the app:
- Creates `~/.local/share/dev.tricog.ltron-api/` (or your `$XDG_DATA_HOME` equivalent) for storage.
- Bootstraps a `Default` workspace with a `Scratch` collection and one example request pointed at `https://httpbin.org/get`.

Nothing is sent to the network unless you click **Send**.

## The window

```
┌──────────────────────┬─────────────────────────────────────────────┐
│  Default       { } ⋯ │   [GET ▼] https://api.example.com/users/1  [Send]
│                      ├─────────────────────────────────────────────┤
│  ▾ SCRATCH  + 📁 ×   │   Params (0)   Headers (0)   Body   Auth   │
│    ▾ 📁 Auth + ×     │   ─────────────                             │
│      GET  login    × │   ☑  key                value      ×        │
│    GET  httpbin    × │   ☐  …                                       │
│  ▸ APIs             │├─────────────────────────────────────────────┤
│  + New Collection    │   200   87 ms   1.2 KB   https://…          │
│                      │   Body   Headers (12)                        │
│                      │   {                                          │
│                      │     "args": { ... }                          │
│                      │   }                                          │
└──────────────────────┴─────────────────────────────────────────────┘
```

- **Left sidebar** — tree of all your collections, folders, and requests.
  - Click `▸`/`▾` to collapse/expand a collection or folder.
  - Hover a row to reveal `+` (new request), `📁` (new folder), `×` (delete) action buttons.
  - Double-click a collection or folder name to rename it inline.
- **Top right** — method dropdown, URL bar, **Send** button.
- **Middle area** — four tabs: query **Params**, request **Headers**, **Body**, **Auth**.
- **Bottom** — response. Status + latency + size, then a tabbed view of **Body** and response **Headers**.

## Collections and Folders (v0.1+)

Ltron-api now supports multiple collections and folders within each collection.

### Collections

- **Create** — click **+ New Collection** at the bottom of the sidebar. It opens in rename mode so you can type a name immediately.
- **Rename** — double-click the collection name.
- **Delete** — hover the collection row and click `×`. This permanently deletes all requests inside.
- **Collapse/Expand** — click the `▸`/`▾` caret.

### Folders

Folders live directly inside a collection (one level deep in v0.1).

- **Create** — hover a collection row and click the `📁` icon. The new folder opens in rename mode.
- **Rename** — double-click the folder name.
- **Delete** — hover the folder row and click `×`. Requests inside are moved back to the collection root.
- **Collapse/Expand** — click the `▸`/`▾` caret next to the folder.

### Requests in folders

- **Add to a folder** — hover the folder row and click `+`.
- **Add to collection root** — hover the collection row and click `+`.
- Requests show their HTTP method (coloured) and name. Click to select, hover to reveal `×` (delete).

## Sending a request

1. Pick a method (GET / POST / PUT / PATCH / DELETE / HEAD / OPTIONS).
2. Type or paste the URL. Variables (`{{name}}`) are allowed — see [Variables](#variables).
3. Add **headers** in the Headers tab. Toggle the checkbox to enable/disable a row without deleting it.
4. Add **query params** in the Params tab. The bottom row is always a blank one for adding.
5. Switch to the **Body** tab if you need a request body:
   - **none** — no body sent (default for GET / HEAD).
   - **raw** — type any text. Pick subtype JSON / XML / HTML / Text — that controls the `Content-Type` header automatically.
   - **x-www-form-urlencoded** — key/value pairs sent as a URL-encoded form body.
6. Click **Send** (or press **Ctrl+Enter**).

The response panel shows status, latency in milliseconds, body size, and the final URL after any redirects. Click **Headers** to see all response headers; click **Body** for the body. JSON responses are pretty-printed automatically.

## Saving requests

Every edit (name, URL, headers, body, …) is saved automatically as soon as you make it. No "Save" button — the file on disk is always up to date.

- **Name** the request by clicking the title at the top of the request panel.
- **Create** a new one with the `+` button in the sidebar header.
- **Delete** with the `×` next to a request name in the sidebar.

Requests live as JSON files under `~/.local/share/dev.tricog.ltron-api/workspaces/<id>/collections/<id>/requests/<id>.json`. You can `cat`, `grep`, or back them up with normal tools.

## Variables

Click the `{ }` button in the top-left to open the **Global Variables** editor.

- **Key** is the name you reference as `{{key}}`.
- **Value** is what gets substituted at send time.
- Tick **Secret** to mask the value in the UI. Secret values are stored in plain text on disk in v0 — see [Limitations](#limitations).
- Tick the leftmost checkbox to enable/disable a variable without deleting it.

You can use `{{var}}` in:
- The URL
- Header keys and values
- Query param keys and values
- Raw body text (and form-urlencoded keys/values)

Example:
- Globals: `base_url = https://api.staging.example.com`, `token = sk_test_…`
- Request URL: `{{base_url}}/users/42`
- Header: `Authorization: Bearer {{token}}`

If you reference a variable that isn't defined, you'll see a red **VarUnresolvedError** in the response panel — fix the reference or define the variable.

Escape a literal `{{` with `\{{...\}}`.

## Keyboard shortcuts

| Shortcut       | Action          |
|----------------|-----------------|
| Ctrl + Enter   | Send request    |

## Where your data lives

- **Data:** `$XDG_DATA_HOME/dev.tricog.ltron-api/` (typically `~/.local/share/dev.tricog.ltron-api/`)
  - `workspaces/<id>/workspace.json`
  - `workspaces/<id>/globals.json`
  - `workspaces/<id>/collections/<id>/collection.json`
  - `workspaces/<id>/collections/<id>/requests/<id>.json`
  - `workspaces/<id>/history/<date>.jsonl`
- **Config:** `$XDG_CONFIG_HOME/dev.tricog.ltron-api/`
- **Cache:** `$XDG_CACHE_HOME/dev.tricog.ltron-api/`

To **back up**, just copy the data directory. To **restore on another machine**, copy it back to the same path.

## Authentication (v0.1+)

Switch to the **Auth** tab on the request panel. Pick a type:

- **No Auth** — nothing added.
- **Bearer Token** — adds `Authorization: Bearer <token>` header. Use `{{var}}` to pull from globals/env.
- **Basic Auth** — username + password → `Authorization: Basic base64(user:pass)` header.
- **API Key** — adds a key/value pair, either as a header or a query parameter (your choice).

Auth values support variable interpolation, so `{{access_token}}` works.

## Environments (v0.1+)

Click the dropdown in the request panel header (next to the request name). It lists `No Environment` plus every environment you've created. The active environment's variables take precedence over globals at send time.

Click the **⚙** button next to the dropdown to open the environment editor:

- Add / rename / delete environments.
- Each environment has its own key/value table with the same Secret toggle as globals.
- Switching environments is instant; no restart needed.

Use case: define `base_url = https://api.dev.example.com` in a `dev` env and `base_url = https://api.prod.example.com` in a `prod` env. Your request URL is `{{base_url}}/users/{{id}}` — flip the dropdown to switch targets.

**Precedence (highest first):** active environment → global. Disabled variables in either scope are skipped.

## Import / Export (v0.1+)

Click the **⋯** menu in the sidebar top bar:

- **Export…** — saves all workspaces to a single JSON file. By default, **secret values are stripped** from the export. You can edit the JSON before importing it elsewhere.
- **Import…** — reads a JSON bundle and creates new workspaces / collections / requests / environments. UUIDs are regenerated, so importing the same bundle twice gives you two copies (no collisions).

The export format is a self-describing JSON document:
```json
{
  "ltron_export_version": 1,
  "exported_at": "2026-06-18T17:45:00.000Z",
  "workspaces": [ { "id": "...", "name": "...", "globals": [...], "environments": [...], "collections": [...] } ]
}
```

## Cancel a request (v0.1+)

While a request is in flight, the **Send** button turns into a red **Cancel** button. Click it (or press **Ctrl+Enter** again) to abort the in-flight request.

## Limitations (v0.1)

These are intentionally deferred — see `specs/001-ltron-api/tasks.md` for the roadmap.

- **No** multipart / binary request bodies (only `none`, raw, x-www-form-urlencoded).
- **No** nested folders (folders are one level deep per collection in v0.1).
- **No** save-as-example or response replay.
- **No** Postman v2.1 collection import.
- **No** drag-and-drop reorder (requests sort by creation time).
- **Secrets** stored as plain text on disk (file permissions default to `0700` on Linux). OS keyring integration lands in v0.2.

## Troubleshooting

**"Variable {{X}} not found"** — open the globals editor (`{ }` button) and define `X`.

**The window opens but is blank** — your WebKitGTK runtime may be missing. Run:
```sh
sudo apt install libwebkit2gtk-4.1-0
```

**App data path** — if you suspect data corruption, the app won't touch broken files; it'll log to stderr. Run from a terminal to see logs:
```sh
ltron-api
```

**Uninstall** removes only the binary. Your data stays under `~/.local/share/dev.tricog.ltron-api/`. Delete that folder to wipe everything.

## Reporting issues

This is alpha-quality software. File issues with reproduction steps + your Ubuntu version + the contents of the failing JSON file (if relevant).
