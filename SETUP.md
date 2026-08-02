# Preyansh ERP — Setup Guide

Offline-first desktop ERP for stock, dispatch, and reel tracking.

## Prerequisites

Install these before proceeding:

| Tool | Version | Download |
|------|---------|----------|
| Node.js | 18+ | https://nodejs.org |
| Rust | latest stable | https://rustup.rs |
| Visual Studio Build Tools | 2022+ | https://visualstudio.microsoft.com/visual-cpp-build-tools/ (select "Desktop development with C++") |
| WebView2 | latest | Pre-installed on Windows 10/11. If missing: https://developer.microsoft.com/en-us/microsoft-edge/webview2/ |

## Quick Setup (Windows PowerShell)

Run from the project root:

```powershell
.\setup.ps1
```

This will install npm dependencies, verify Rust is available, and offer to launch the app.

## Manual Setup

```bash
# 1. Install frontend dependencies
npm install

# 2. Verify Rust toolchain
rustc --version
cargo --version

# 3. Run in development mode (opens desktop window)
npm run tauri dev

# 4. Build release installer (MSI + NSIS)
npm run tauri build
```

## Project Structure

```
├── crates/
│   ├── erp-core/        # Business logic, entities, services (Rust)
│   ├── erp-migration/   # SQLite schema migrations (SeaORM)
│   └── erp-server/      # Axum HTTP API (routes, extractors, state)
├── src/                  # React frontend (TypeScript)
│   ├── features/        # Feature modules (inventory, products, etc.)
│   ├── lib/api/         # API client, hooks, types
│   ├── routes/          # TanStack Router file-based routes
│   └── components/      # Shared UI (shadcn/ui)
├── src-tauri/           # Tauri shell (embeds the Axum server)
├── docs/                # Architecture documentation
└── target/release/      # Built artifacts (after `npm run tauri build`)
```

## Default Admin Credentials

On first launch, the app creates a default admin account and displays the credentials in a one-time dialog. The default is:

- **Username:** `admin`
- **Password:** (auto-generated, shown once on first run)

You can change both from **Settings > My Profile** after logging in.

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run tauri dev` | Launch app in development mode (hot-reload) |
| `npm run tauri build` | Build release installer (MSI + NSIS setup.exe) |
| `npm run build` | Build frontend only (TypeScript + Vite) |
| `cargo test --workspace` | Run all Rust tests |
| `cargo clippy --workspace` | Lint Rust code |
| `npx tsc --noEmit` | TypeScript type-check without emitting |

## Database Location

SQLite database is stored per-install at:
```
%APPDATA%\com.preyanshindustries.erp\preyansh-erp.db
```

Backups can be created/restored from **Settings > Backup & Restore**.

## Troubleshooting

- **Port 47932 already in use:** Another instance of the app is running. Close it or kill the process.
- **Port 1420 already in use:** A previous Vite dev server didn't shut down. Run `Get-Process -Name node | Stop-Process -Force`.
- **Rust compilation slow on first run:** Normal — 600+ crates need to compile. Subsequent runs are incremental and fast.
- **WebView2 missing:** Download from https://developer.microsoft.com/en-us/microsoft-edge/webview2/
