# Preyansh ERP — Setup

There are two very different things you might want to do. Pick the right one.

| I want to… | Read |
|---|---|
| **Give this app to someone** so they can use it on their PC | [Sharing the app](#sharing-the-app) |
| **Work on the code** (change features, fix bugs) | [Developer setup](#developer-setup) |

---

## Sharing the app

Recipients need **nothing** installed — no Node.js, no Rust, no admin rights.
They get one installer file.

### Build the installer

```
Build-Installer.bat
```

Double-click it (or run it from a terminal). Takes 3–15 minutes. It produces:

```
Installer/
├── Preyansh-ERP-Setup-v0.1.0.exe   ← the installer (~6.5 MB)
└── README.txt                       ← install guide for the recipient
```

### Send it

Zip the whole `Installer` folder and send it. Or send both files directly.

Tell them to read `README.txt` first — it covers the Windows SmartScreen
warning and, critically, that **the first-run admin password is shown only
once and must be written down**.

### What the recipient gets

- Installs to their user account only (no admin prompt, no UAC)
- Start Menu + Desktop shortcut, both named "Preyansh ERP"
- A private database at `%APPDATA%\com.preyanshindustries.erp\`
- An auto-generated admin account, shown once on first launch
- The five standard products pre-seeded (Plastic Reel, 300/500/630/800 mm Spool)
- Works fully offline

They will need to add their own **customers** before recording inward or
outward entries, since those forms require a customer.

### Releasing a new version

1. Bump `version` in **both** `package.json` and `src-tauri/tauri.conf.json`
2. Update the filename in `Build-Installer.bat` (two places: the `copy` line and the echoed output)
3. Run `Build-Installer.bat`

Installing a newer version over an older one upgrades in place and keeps
all existing data.

---

## Developer setup

### Prerequisites

| Tool | Version | Where |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| Rust | latest stable | https://rustup.rs |
| Visual Studio Build Tools | 2022+ | ["Desktop development with C++"](https://visualstudio.microsoft.com/visual-cpp-build-tools/) |
| WebView2 | latest | Pre-installed on Win 10/11 |

### Run it

```bash
npm install
npm run tauri dev        # hot-reloading dev window
```

First `tauri dev` compiles ~650 Rust crates and takes several minutes.
Subsequent runs are incremental and fast.

### Commands

| Command | What it does |
|---|---|
| `npm run tauri dev` | Dev window with frontend hot-reload |
| `npm run tauri build` | Release build + installer |
| `npx tsc --noEmit` | TypeScript type-check |
| `npx vite build` | Frontend production build |
| `cargo test --workspace` | Rust tests |
| `cargo clippy --workspace --all-targets` | Rust lint (kept at zero warnings) |

### Project layout

```
crates/
  erp-core/        Business logic, entities, services
  erp-migration/   SQLite schema migrations (SeaORM)
  erp-server/      Axum HTTP API — routes, extractors, RBAC
src/
  components/ui/   Shared primitives — SINGLE SOURCE OF TRUTH for styling
  components/layout/
  features/        One folder per module
  lib/api/         API client, hooks, types
  routes/          TanStack Router file-based routes
src-tauri/         Tauri shell; embeds the Axum server
docs/              Architecture notes
```

### Architecture in one paragraph

One OS process. Tauri's Rust host runs an Axum server bound to
`127.0.0.1:47932`; the React webview talks to it over `fetch()`. All
business logic, RBAC, and audit logging live server-side in `erp-core`, so
the frontend can't bypass them. SQLite file per install. See
`docs/ARCHITECTURE.md` for the full rationale and the multi-machine
upgrade path.

### Styling rules

The colour system in `src/index.css` (`:root` / `.dark`) is the single
source of truth — **don't hardcode colours in components**. Brand orange is
reserved for primary actions, the active nav item, focus rings, and exactly
one dashboard accent. Status uses the semantic palette via
`components/ui/status-badge.tsx`.

Restyle shared primitives in `components/ui/`, not individual pages.

### Data locations

| What | Where |
|---|---|
| Database | `%APPDATA%\com.preyanshindustries.erp\preyansh-erp.db` |
| Backups | `…\com.preyanshindustries.erp\backups\` |
| JWT signing key | `…\com.preyanshindustries.erp\jwt_secret.key` |
| First-run creds | `…\com.preyanshindustries.erp\first_run_credentials.json` (deleted after being shown) |

### Troubleshooting

**Port 1420 or 47932 already in use** — a previous dev process didn't shut
down cleanly. Note that stopping the terminal doesn't always kill the child
processes:

```powershell
Get-Process | Where-Object { $_.ProcessName -like "*Preyansh*" } | Stop-Process -Force
Get-NetTCPConnection -LocalPort 1420,47932 -State Listen -ErrorAction SilentlyContinue
```

**`'tauri' is not recognized`** — run `npm install`; `node_modules` is missing or incomplete.

**Want to test the first-run experience** — rename (don't delete) the data
folder, launch, then restore it:

```powershell
$d = "$env:APPDATA\com.preyanshindustries.erp"
Rename-Item $d "$d.backup"
```
