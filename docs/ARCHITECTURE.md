# Architecture

Preyansh ERP is an offline-first desktop application for tracking stock,
dispatches, and reel (spool) movement. This document covers the shape of
the system as built, why certain infrastructure was deliberately deferred,
and what would need to change to support scenarios beyond a single
computer.

## Stack

| Layer            | Choice                                    |
|------------------|--------------------------------------------|
| Shell            | Tauri 2                                    |
| Frontend         | React 19 + TypeScript + Vite               |
| Styling          | Tailwind CSS 4 + shadcn/ui (Radix primitives) |
| Frontend state   | Zustand (client state) + TanStack Query (server state) |
| Routing          | TanStack Router (file-based, type-safe)    |
| Backend          | Rust + Axum                                |
| ORM              | SeaORM                                     |
| Database         | SQLite (single file, per-install)          |

## Process model

The app is a single OS process. Tauri's Rust host embeds an Axum HTTP
server that binds to `127.0.0.1` on a fixed port
(`src-tauri/src/server.rs::API_PORT = 47932`), and the React frontend --
running inside the Tauri webview -- talks to it exclusively over
`fetch()`, the same way it would talk to any REST API. There is no
Tauri IPC (`invoke`) bridge for application data; IPC commands
(`src-tauri/src/commands.rs`) are reserved for OS-level concerns that
can't be modeled as HTTP (reading a one-time first-run credentials file,
and restoring a backup, which requires swapping the live SQLite file out
from under the running connection pool and restarting the process).

```
┌─────────────────────────── OS process ───────────────────────────┐
│                                                                    │
│   ┌────────────────┐   fetch() over        ┌───────────────────┐  │
│   │  React webview  │──  http://127.0.0.1  ─▶│   Axum server     │  │
│   │  (TanStack Query)│◀─  :47932/api/*     ──│   (erp-server)    │  │
│   └────────────────┘                        └─────────┬─────────┘  │
│                                                        │            │
│                                              ┌─────────▼─────────┐  │
│                                              │  erp-core services │  │
│                                              │  (business logic,  │  │
│                                              │   RBAC, audit)     │  │
│                                              └─────────┬─────────┘  │
│                                                        │            │
│                                              ┌─────────▼─────────┐  │
│                                              │  SQLite (SeaORM)   │  │
│                                              │  one file per      │  │
│                                              │  install           │  │
│                                              └────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

Why an HTTP API instead of the frontend talking to SQLite directly (e.g.
via `tauri-plugin-sql`): every request passes through `erp-core`'s
services, which is the single place role checks (`CurrentUser` /
`OperatorUser` / `AdminUser` extractors), input validation, and audit
logging (`audit_service`) are enforced. A frontend with direct DB access
would need to reimplement or bypass all three, or trust the renderer
process to enforce its own permissions -- which it can't, since anything
running in a webview is inspectable and modifiable by the end user.

## Why "offline-first" instead of a client/server product

The brief called for a strict, minimal stack: Tauri + React + TypeScript
+ Vite + Tailwind + shadcn/ui + Rust/Axum + SQLite/SeaORM. Everything below
was intentionally left out of the initial 25-task build, in favor of
shipping a single-computer desktop app first:

| Deferred            | Where it would fit                                             |
|----------------------|------------------------------------------------------------------|
| PostgreSQL           | Replaces SQLite once multiple app instances need to share one database over a network. |
| Redis                | Shared cache / session store across multiple server instances; not needed when there's exactly one process and one in-memory cache is trivially consistent. |
| Meilisearch          | Full-text/fuzzy search at a scale SQLite's `LIKE`-based queries (`search_service.rs`) stop being fast enough for -- irrelevant at single-warehouse row counts. |
| RabbitMQ             | Cross-process/cross-machine async messaging (e.g. "notify warehouse B a dispatch left warehouse A"); meaningless with one process. |
| Docker / Kubernetes  | Deployment/orchestration for a fleet of server instances; a desktop app installs as a native binary, not a container. |
| Traefik              | Reverse proxy / TLS termination / routing across multiple backend instances; there is exactly one backend, bound to loopback only. |
| Sentry               | Remote error aggregation. Deferred because it requires an outbound network call and a decision about what data leaves the machine, which is out of scope for an "offline-first" v1. Local file logging (`tracing_subscriber`, see `lib.rs`) covers debugging today. |
| Prometheus           | Metrics scraping assumes a long-running server with a `/metrics` endpoint reachable by a collector; not meaningful for a single-user desktop process. |

None of this is "we didn't think about it" -- it's "this class of
infrastructure solves multi-node problems, and the v1 product has exactly
one node." Adding any of it now would be speculative complexity with no
current user-facing benefit, and every one of them is a genuine drop-in
addition later rather than a rewrite, provided the seams below are kept
in mind.

## The specific seam: `127.0.0.1`-only bind

The one place the "single computer" assumption is hard-coded, rather than
just "true for now", is `erp-server::serve()`:

```rust
// crates/erp-server/src/lib.rs
let listener = TcpListener::bind(("127.0.0.1", port)).await?;
```

and the matching frontend constant (`API_PORT` mirrored in
`src/lib/api/config.ts`). Everything else in the request path -- the
route handlers, the RBAC extractors, the SeaORM queries -- has no
awareness of "local vs. remote" baked in; they just handle an
`AppState` and a validated user. That means the realistic path to
multi-computer support is additive, not a rewrite:

1. **Swap the bind address.** Change the loopback bind to `0.0.0.0` (or a
   configurable interface) and pick a real port story (static port +
   firewall rule, or OS-assigned + a discovery mechanism). This alone
   makes the existing API reachable from other machines on the LAN.
2. **Swap SQLite for Postgres.** SQLite's single-writer model is fine for
   one process; concurrent writers from multiple machines need a real
   client/server database. SeaORM already abstracts the SQL dialect, so
   this is a connection-string and migration-compatibility change, not a
   rewrite of `erp-core`'s services -- though the migrations in
   `crates/erp-migration` would need a pass for SQLite-specific column
   types.
3. **Add authentication hardening for a networked service.** The current
   JWT setup (`erp-core::auth::JwtService`) assumes the signing key lives
   on the same machine as every client (see `JwtService::load_or_create`
   writing/reading a local key file). Once the API is reachable from other
   machines, the key needs to be provisioned/rotated centrally instead of
   generated per-install.
4. **Decide what "backup/restore" means.** The current restore flow
   (`src-tauri/src/commands.rs::restore_backup`) works by replacing a
   local file and restarting the whole process -- it assumes there's
   exactly one process to restart. A shared Postgres instance would need
   a database-level backup/restore story (e.g. `pg_dump`/`pg_restore` or
   managed snapshots) instead.
5. **Only then does the phase-2 infra table above start being relevant**:
   Postgres as the shared store, Redis if multiple API instances need a
   shared cache, RabbitMQ/similar if warehouses need to notify each other
   asynchronously, Traefik/Docker/K8s if there end up being multiple
   backend instances to route across and deploy, Sentry/Prometheus once
   there's a fleet worth centrally monitoring instead of one person's
   desktop.

## Data model summary

SQLite schema lives in `crates/erp-migration/src/m20260725_*.rs`, applied
via SeaORM migrations on startup. Entities (`crates/erp-core/src/entities/`):
`user`, `role`, `unit`, `product`, `customer`, `dispatch`, `dispatch_item`,
`reel`, `reel_movement`, `stock_movement`, `stock_balance`, `audit_log`,
`backup`. Every mutating action that matters for accountability
(stock adjustments today; the audit log's schema supports more entity
types than are currently emitted) writes an `audit_log` row with a
`performed_by` foreign key to `user`, enforced `ON DELETE RESTRICT` so
history can never be silently orphaned by a deleted user account.

## Known gaps (not part of the original 25-task scope)

Two frontend routes (`src/features/settings/user-management-page.tsx` and
`profile-page.tsx`) are still placeholder screens. Unlike the audit log
viewer (which had a complete backend and was just unwired until task 24),
these have **no backend at all** -- no `user_service.rs`, no `/users`
routes, no profile-update endpoint. Admin user creation today happens
only via the auto-generated first-run admin account
(`auth_service::ensure_default_admin`); there is no in-app flow for
creating additional users or editing roles. Building that out is a
legitimate follow-up feature, not a bug fix, since it wasn't one of the
11 named modules in the original spec.
