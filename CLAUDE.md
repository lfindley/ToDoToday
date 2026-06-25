# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ToDoToday turns a user's routine (sleep, meals, fixed commitments, recurring activities, deadline-driven tasks, interests) into a concrete minute-by-minute daily plan. The **frontend** is a local-only, single-user React/Vite SPA that runs entirely in the browser with `localStorage` persistence. The **`server/`** subproject is an additive, optional backend (Node/Express/Prisma) that adds accounts and cross-device sync — the frontend works fully offline without it.

These are two separate npm projects with separate `package.json`, `node_modules`, and `tsconfig`. Run `npm` commands from the relevant directory.

See `ARCHITECTURE.md` for a full, diagrammed walkthrough of how everything fits together.

## Commands

Frontend (repo root):

```bash
npm run dev          # Vite dev server at http://localhost:5173
npm run build        # tsc type-check + vite build → dist/
npm test             # vitest run (once)
npm run test:watch   # vitest watch
npx vitest run src/test/scheduler.test.ts   # run a single test file
npx vitest run -t "carries leftover"        # run tests matching a name
```

Backend (`cd server`):

```bash
npm run dev               # tsx watch src/index.ts → http://localhost:8787
npm run build             # tsc → dist/
npm start                 # node dist/index.js (prod)
npm test                  # vitest run (in-memory repo, no database needed)
npm run prisma:generate   # regenerate typed Prisma client after schema change
npm run prisma:migrate    # apply migrations to the Postgres DB
```

There is no linter/formatter configured; `npm run build` (tsc) is the type-check gate. Frontend tests live in `src/test/` (config: `vite.config.ts`); backend tests in `server/test/` (config: `server/vitest.config.ts`).

## Architecture

### Frontend: pure engine + state/UI split

The core invariant is a clean separation between framework-free logic and React:

- **`src/engine/` + `src/utils/`** — pure scheduling/algorithm code with no React or store imports. This is what the tests cover. `scheduler.ts` is the heart of the app.
- **`src/store/useStore.ts`** — the single Zustand store (persisted to `localStorage` key `todotoday`). It owns all domain data and is the *only* thing that calls into the engine. Components never call the engine directly.
- **`src/components/`** — React views (Today / Week / Month / Tasks / Recurring / Settings) that read/write the store.

When adding scheduling/planning logic, put the pure algorithm in `src/engine/` (testable in isolation) and expose it through a store action — don't compute inside components.

### The scheduler (`src/engine/scheduler.ts`)

Everything works internally in **minutes-from-midnight** (`parseTime`/`formatTime` in `src/utils/time.ts`). `planSingleDay` fills a day in priority order:

1. **Hard anchors** placed first: carried-over locked blocks, one-off events, meals (split around events), then fixed recurring commitments (split around events + meals).
2. **Flexible recurring** (e.g. gym 3×/week) fitted into free gaps.
3. **Tasks** fill a daily "productive" budget, ordered by `taskOrder` (deadline → priority → age), respecting per-task `maxPerDayMinutes` and `TimeWindow` constraints.
4. **Free time** fills up to a "free" budget, each block tagged with an interest/season suggestion.

`planHorizon` plans N consecutive days and **carries each task's leftover `remainingMinutes` from one day to the next** via a shared `Map` — this is how long tasks spread across days to hit deadlines. The store's `buildHorizon` sizes the horizon to reach the furthest deadline (clamped 7–60 days).

**Locked blocks**: when a user drags/edits a block (`moveBlock`), it's marked `locked: true`. On replan, locked blocks are re-fed as hard anchors per-date (`lockedByDate`) so user edits survive a replan. A `freshStart` replan discards them.

### Domain model

All types are in `src/types.ts`. Key distinction: `Task` (one-off work with `estimatedMinutes`/`remainingMinutes`/deadline) vs `RecurringTask` (`scheduleType: 'fixed'` = immovable weekly anchor, or `'flexible'` = `timesPerWeek` fitted into gaps) vs `CalendarEvent` (dated one-off appointment, `source: 'manual' | 'import'`). A `DayPlan` is the output: an array of `ScheduledBlock`s plus `warnings`.

### Cross-device sync (frontend side)

Sync is **opt-in and additive** — signed-out users get the unchanged local-only app.

- **`src/sync/core.ts`** — pure, testable reconciliation. `planSync()` decides push / adoptRemote / conflict / noop from `{ lastSyncedVersion, localChanged, localEmpty, serverVersion }`. `hashSnapshot()` (FNV-1a over key-sorted JSON) detects local changes without storing a full copy.
- **`src/store/useAuth.ts`** — second Zustand store for auth + sync orchestration (login/register/logout, `reconcile`, `pushNow`, `resolveConflict`). Persists only the refresh token + last-synced version/hash. Access tokens are in-memory only.
- **`src/sync/useSync.ts`** — app-shell hook: restores the session once on load, debounces a push (1.5s) on any store change, flushes on tab-hide.
- **`src/api/client.ts`** — typed fetch wrapper for the backend; base URL from `VITE_API_URL` (defaults to `http://localhost:8787`).

The synced payload is the `PersistedState` slice of `useStore` (see `partialize`). `useStore.hydrate()` replaces that slice wholesale when adopting a remote snapshot. If you add a new persisted field, update `partialize`, the `PersistedState` pick, `hydrate`, and `PERSISTED_KEYS` in `sync/core.ts` together.

### Backend (`server/`)

Express API with a **repository abstraction** (`server/src/repo.ts`): the app depends only on the `Repo` interface, so tests run against an in-memory fake (`server/test/memoryRepo.ts`) with no database. Production uses Prisma/Postgres (`server/src/db.ts`).

- `createApp(cfg)` (`app.ts`) is a pure factory taking `{ repo, jwtSecret, corsOrigin }` — inject fakes in tests.
- Auth (`server/src/auth/`): argon2 password hashing, JWT access tokens (15 min) + hashed, revocable, rotating refresh tokens (30 days). `requireAuth` middleware populates `req.userId`.
- Planner sync (`server/src/planner/routes.ts`): stores the whole planner state as **opaque JSON** (`PlannerState.data`) — the backend is deliberately decoupled from the frontend domain model. Uses **optimistic concurrency**: `PUT /planner` takes the version the client last saw; a stale version returns `409` with the current server state for the client to reconcile.
- `server/src/calendar/crypto.ts` — AES-256-GCM helpers for calendar credentials at rest. Schema/foundation only; no provider (Outlook/Apple/Google) logic is wired yet.

Backend env is validated by zod at startup (`server/src/env.ts`): `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `PORT`, `CORS_ORIGIN`. See `server/SETUP.md` for full setup (Neon Postgres, key generation, deploy notes). Deploy config: `render.yaml` (API) and `netlify.toml` (frontend) at the repo root.

## Conventions

- Commits: do **not** add a `Co-Authored-By` / Claude trailer (user preference).
- Dates are ISO `yyyy-MM-dd` strings throughout; times are `"HH:mm"`. Use the helpers in `src/utils/date.ts` and `src/utils/time.ts` rather than hand-rolling date math (`date-fns` is available).
- Times are stored and computed in 24h `"HH:mm"` *everywhere* (the engine, blocks, events). The 12/24h user setting (`settings.timeFormat`) is **display-only**: format for the UI with `displayTime`/`displayHour` from `src/utils/time.ts`. Don't change `formatTime`'s output or feed a localized/12h string back into the scheduler — it parses and compares 24h strings.
- Calendar `.ics` is two pure utils: `src/utils/ics.ts` (import/parse) and `src/utils/icsExport.ts` (generate). Export emits floating-local times so a plan round-trips back through `parseICS` (there's a test for this).
- Tests are date-sensitive — anchor relative dates to a fixed "today" rather than `new Date()` to keep them deterministic.
