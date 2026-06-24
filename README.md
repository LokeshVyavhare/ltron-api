# Ltron-api

A lightweight, local-first desktop API client for Linux (with Windows/macOS as secondary targets). Think Postman, minus the Electron bloat, accounts, and cloud sync.

## Status

**Phase 0 — Design.** No code yet. The architecture and feature set live as a spec-kit document set under [`specs/001-ltron-api/`](specs/001-ltron-api/).

Read in this order:
1. [`spec.md`](specs/001-ltron-api/spec.md) — what we're building and why (user-facing requirements, success metrics, non-goals)
2. [`plan.md`](specs/001-ltron-api/plan.md) — how we're building it (Tauri 2 with a thin Rust shell + Svelte 5 frontend, JSON-file storage, architectural decisions)
3. [`data-model.md`](specs/001-ltron-api/data-model.md) — entities, on-disk layout, JSON shapes
4. [`research.md`](specs/001-ltron-api/research.md) — decisions with rationale and rejected alternatives
5. [`tasks.md`](specs/001-ltron-api/tasks.md) — ordered implementation milestones (M0 → M7)
6. [`contracts/`](specs/001-ltron-api/contracts/) — Tauri IPC primitives and event channels

## Non-functional targets

| Metric                      | Target                                      |
|-----------------------------|---------------------------------------------|
| Idle RAM                    | ≤ 100 MB RSS                                |
| Installed footprint         | ≤ 20 MB                                     |
| Cold start to interactive   | ≤ 500 ms (midrange Linux laptop)            |
| Send overhead vs curl       | ≤ 15 ms                                     |
| Open 1000-request workspace | ≤ 1 s                                       |

## Principles

- **Frontend-driven.** The Rust side of Tauri is a thin native shell — it only fires HTTP requests, reads/writes files, and shows OS dialogs. All app logic, models, validation, variable interpolation, and state live in TypeScript / Svelte 5.
- **Local-only.** No accounts, no cloud, no telemetry. Your data is a folder of JSON files under `$XDG_DATA_HOME/ltron-api/` — inspectable, diff-able, and yours.
- **Lightweight.** Tauri (system WebView) over Electron, CodeMirror over Monaco, UnoCSS over Tailwind runtime, hand-rolled `{{variable}}` resolver instead of pulling in Handlebars. No SQLite, no ORM.
- **Backup-friendly.** Export any workspace as a single versioned JSON bundle. Import the same bundle to restore or transplant to another machine.
- **Postman-compatible where it's cheap.** `{{variable}}` syntax, collection / folder / example concepts. Postman v2.1 import is a stretch goal.

## License

TBD.
