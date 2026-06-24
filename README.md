# Ltron-api

A lightweight, local-first desktop API client. Compose, send, and save HTTP requests — no accounts, no cloud, no bloat.

> Think Postman, minus the Electron overhead and forced sign-in.

---

## Download

**[→ Latest release](https://github.com/lokeshvyavhare1805/ltron-api/releases/latest)**

| Platform | File | Notes |
|---|---|---|
| Linux (Ubuntu/Debian) | `.deb` | Recommended for Ubuntu 22.04+ |
| Linux (any distro) | `.AppImage` | Self-contained, no install needed |
| macOS | `.dmg` | Universal binary — Intel + Apple Silicon |
| Windows | `.msi` | Windows 10/11, WebView2 required |

---

## Installation

### Linux — .deb (Ubuntu / Debian)

```sh
sudo dpkg -i Ltron-api_*.deb
```

Then launch from your application menu or run `ltron-api`.

### Linux — .AppImage (any distro)

```sh
chmod +x Ltron-api_*.AppImage
./Ltron-api_*.AppImage
```

No installation needed. Move it anywhere on your PATH to launch it by name.

### macOS

1. Download the `.dmg`
2. Open it and drag **Ltron-api** to Applications
3. First launch: if Gatekeeper blocks it, right-click the app → **Open** → **Open**

### Windows

1. Download the `.msi`
2. Run it and follow the installer
3. If Windows SmartScreen warns you, click **More info** → **Run anyway**

> Windows requires [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) — it is pre-installed on Windows 10 (20H2+) and Windows 11.

---

## Features

- **Send HTTP requests** — GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- **Organize with collections and folders** — unlimited nesting, like Postman
- **Environment variables** — global variables always active; switch environments to override per-project
- **`{{variable}}` syntax** — use variables in URLs, headers, body, anywhere; autocomplete as you type
- **Multiple body types** — JSON, form data, raw text, binary
- **Auth support** — Bearer token, Basic auth, API key, and more
- **Response viewer** — syntax-highlighted JSON/XML, raw, headers, status, latency
- **Export / Import** — back up everything to a single JSON file; restore on any machine
- **Dark, Light, and System theme**
- **100% local** — all data is stored as JSON files under your home directory; no accounts, no telemetry

---

## Where is my data stored?

All data lives locally on your machine:

| OS | Path |
|---|---|
| Linux | `~/.local/share/ltron-api/` |
| macOS | `~/Library/Application Support/ltron-api/` |
| Windows | `%APPDATA%\ltron-api\` |

You can back it up, diff it with git, or copy it to another machine manually. The **Export** button in the app creates a single portable `.json` bundle.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Enter` / `Cmd+Enter` | Send request |
| `Ctrl+Enter` (while loading) | Cancel request |

---

## Tech stack

Built with [Tauri 2](https://tauri.app) (Rust + system WebView), [Svelte 5](https://svelte.dev), and [Vite](https://vitejs.dev). Installed size is ~7–20 MB depending on platform.

For architecture and development docs see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## License

TBD.
