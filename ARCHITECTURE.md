# ToDoToday — Architecture

A reference for how the whole repository fits together: the local-only planning
app, the optional sync backend, and the data flows that connect them. For
day-to-day conventions and commands see [`CLAUDE.md`](CLAUDE.md); for backend
setup see [`server/SETUP.md`](server/SETUP.md).

---

## 1. The big picture

ToDoToday is **two independent npm projects** in one repo:

| Project | Path | Stack | Role |
|---|---|---|---|
| **Frontend** | repo root | React 18, Vite, TypeScript, Zustand, Tailwind | The whole app. Runs 100% in the browser, persists to `localStorage`. |
| **Backend** | `server/` | Node, Express, Prisma, Postgres, TypeScript | **Optional, additive.** Accounts + cross-device planner sync. |

The frontend is fully functional with the backend switched off. Signing in (which
requires a running backend) layers cross-device sync *on top* without changing
how planning works.

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Browser (the app)                            │
│                                                                        │
│   components/ (React views)                                            │
│        │  read state / dispatch actions                               │
│        ▼                                                               │
│   store/useStore.ts  ──calls──►  engine/ + utils/ (pure)  ──► DayPlans │
│   (Zustand, persisted)                                                 │
│        │ persist (partialize)                                         │
│        ▼                                                               │
│   localStorage["todotoday"]                                           │
│                                                                        │
│   store/useAuth.ts + sync/useSync.ts ───┐  (active only when signed in)│
└──────────────────────────────────────────┼────────────────────────────┘
                                           │  HTTPS fetch, Bearer access token
                                           ▼
                              ┌──────────────────────────────┐
                              │   Backend API (Express)       │   hosted on Render
                              │   /auth/*  ·  /planner  · /me  │
                              │   depends on Repo interface    │
                              └───────────────┬───────────────┘
                                              │  Prisma client
                                              ▼
                              ┌──────────────────────────────┐
                              │   Postgres (Neon)             │
                              │   User · RefreshToken ·       │
                              │   PlannerState · CalendarConn │
                              └──────────────────────────────┘
```

---

## 2. Frontend

### 2.1 The layering invariant

The single most important rule: **framework-free logic is separated from React.**

```
src/components/        React views — only read/write the store
        │
        ▼
src/store/useStore.ts  Zustand store — owns all data; the ONLY caller of the engine
        │
        ▼
src/engine/  +  src/utils/   Pure functions — no React, no store imports (unit-tested)
```

- Components never import from `engine/`. They call **store actions**, which call
  the engine, which returns new data the store saves.
- Everything testable lives in `engine/`/`utils/` and is covered by `src/test/`.

### 2.2 Directory map

```
src/
├── main.tsx                 App bootstrap (ReactDOM.createRoot)
├── App.tsx                  Shell: header, <Nav>, view switch, alert toasts, useSync()
├── types.ts                 All domain types (Task, RecurringTask, CalendarEvent, …)
│
├── engine/                  ── PURE planning logic ──
│   ├── scheduler.ts         planSingleDay / planHorizon — the heart of the app
│   ├── recurrence.ts        which weekdays a recurring item lands on
│   ├── alerts.ts            computeAlerts — feasibility + deadline reminders
│   ├── suggestions.ts       suggestActivities — season/interest free-time ideas
│   ├── suggestionProposals.ts  suggestForGap — pick a task/activity for a window
│   ├── season.ts            date → season (+ emoji/label), hemisphere-aware
│   └── daySummary.ts        summariseDay / daySegments — Week & Month overviews
│
├── utils/                   ── PURE helpers ──
│   ├── time.ts              minutes↔"HH:mm", gaps, reserve, displayTime/displayHour
│   ├── date.ts              ISO date helpers (date-fns wrappers)
│   ├── id.ts                uid() id generator
│   ├── ics.ts               parseICS — calendar import
│   └── icsExport.ts         plansToICS — calendar export
│
├── data/                    Static seed data (interest categories, activity ideas)
│
├── store/
│   ├── useStore.ts          Domain store (persisted key "todotoday")
│   └── useAuth.ts           Auth + sync orchestration store (persisted "todotoday-auth")
│
├── sync/
│   ├── core.ts              Pure reconciliation: planSync, hashSnapshot, snapshotOf
│   └── useSync.ts           App-shell hook: restore session, debounce push, flush
│
├── api/
│   └── client.ts            Typed fetch wrapper for the backend
│
├── download.ts              DOM file-download helper (kept out of utils/)
├── notifications.ts         Browser Notification helpers
│
└── components/              Today, Week, Month, Tasks, Recurring, Settings,
                             Nav, Timeline, BlockCard, AlertsBell, CalendarImport,
                             Account, SyncConflictModal, ui.tsx (shared primitives)
```

### 2.3 Domain model (`types.ts`)

The model distinguishes four kinds of "thing on your schedule":

- **`Task`** — one-off work. Has `estimatedMinutes`, a decrementing
  `remainingMinutes`, optional `deadline`, optional `maxPerDayMinutes`, and an
  optional `TimeWindow` (`earliest`/`latest`). This is what spreads across days.
- **`RecurringTask`** — repeats weekly. Either `scheduleType: 'fixed'` (an
  immovable anchor with explicit `days` + `startTime`/`endTime`, e.g. a job) or
  `'flexible'` (`timesPerWeek` × `durationMinutes`, fitted into free gaps, e.g.
  gym 3×/week).
- **`CalendarEvent`** — a dated one-off appointment with a fixed time.
  `source: 'manual' | 'import'` distinguishes hand-entered vs `.ics`-imported.
- **`Meal`** + **sleep** — part of the `DayTemplate`; daily anchors.

The scheduler's **output** is a `DayPlan` = `{ date, blocks: ScheduledBlock[],
warnings }`. A `ScheduledBlock` has a `type` (`sleep|meal|task|recurring|free|
buffer|event`), `start`/`end` ("HH:mm"), and flags like `locked`, `done`,
`proposed`.

### 2.4 The scheduler (`engine/scheduler.ts`)

Everything works in **minutes-from-midnight** integers internally; `parseTime`
/`formatTime` convert to/from `"HH:mm"`.

**`planSingleDay(date, ctx, tasks, remaining, locked)`** fills one day in strict
priority order, carving time out of a list of free "gaps":

```
1. Hard anchors (placed first, in this order):
   a. carried-over locked blocks (user edits from a previous plan)
   b. one-off events on this date
   c. meals               — split around events
   d. fixed recurring     — split around events + meals
2. Compute free gaps = waking window − all hard anchors
3. Flexible recurring due today → reserve() into a gap (honouring its window)
4. Tasks → fill the daily "productive" budget, in taskOrder
   (deadline → priority → age), each capped by maxPerDayMinutes + TimeWindow;
   decrements `remaining[taskId]` as it places time
5. Free time → fill up to the "free" budget; each block tagged with a
   season/interest suggestion
6. Emit warnings (couldn't fit X; budgets exceed waking hours), sort by start
```

**`planHorizon(from, days, input)`** is the multi-day engine. It seeds a shared
`remaining` `Map<taskId, minutesLeft>` and calls `planSingleDay` for each
consecutive day **reusing the same map** — so a task's leftover minutes carry
into the next day. This is the mechanism by which a 6-hour task with a deadline
in 3 days spreads across those days.

**Locked blocks:** when the user drags/edits a block, the store marks it
`locked: true`. On the next replan, the store groups locked blocks by date into
`lockedByDate` and feeds them back as hard anchors (step 1a), so manual edits
survive a replan. A `freshStart` replan ignores them.

### 2.5 The time model

- **Storage/compute is always 24h** `"HH:mm"`. The engine parses and *compares*
  these strings, so they must stay 24h.
- **Display is a separate concern.** `settings.timeFormat` (`'24h' | '12h'`) only
  affects rendering, via `displayTime(hhmm, fmt)` and `displayHour(mins, fmt)` in
  `utils/time.ts`. Native `<input type="time">` pickers are left alone (they use
  the OS locale and need raw `"HH:mm"`). Never feed a 12h/localized string back
  into the scheduler.

### 2.6 State management (`store/useStore.ts`)

A single Zustand store, persisted to `localStorage["todotoday"]` via the
`persist` middleware. It is the system's source of truth and the **only** code
that calls the engine.

- **Owns:** `tasks`, `recurring`, `events`, `interests`, `template`, `budgets`,
  `settings`, `dayPlans`, `alerts`.
- **Actions** mutate that data and, where relevant, re-derive: most write actions
  call `recompute()` (alerts) and/or `replan()`.
- **`replan(fromISO?, freshStart?)`** → `buildHorizon()` sizes the horizon to
  reach the furthest task deadline (clamped **7–60 days**), gathers `lockedByDate`,
  and calls `planHorizon`. The resulting `DayPlan`s are merged into `dayPlans`.
- **`partialize`** defines the persisted/synced slice (`PersistedState`).
  **`hydrate(data)`** replaces that whole slice — used by sync when adopting a
  remote snapshot.

> When adding a persisted field you must update four things together:
> `partialize`, the `PersistedState` pick, `hydrate`, and `PERSISTED_KEYS` in
> `sync/core.ts`.

### 2.7 Derived features

- **Alerts (`engine/alerts.ts`)** — `computeAlerts` does an earliest-deadline-first
  cumulative capacity check to flag **infeasible** tasks (work that can't fit
  before its deadline given the daily productive budget), plus **reminders** at 2
  days / 1 day / on the deadline. It preserves `dismissed`/`notified` flags across
  recomputes by matching on `taskId|kind|forDate`. Shown via `AlertsBell`; can
  fire browser notifications (`notifications.ts`).
- **Suggestions (`engine/suggestions.ts` + `suggestionProposals.ts`)** — free-time
  ideas tailored to the user's interests and the current season/hemisphere.
  `suggestForGap` powers the "propose something for this window" flow, which drops
  a `proposed: true` block into the plan for the user to accept/dismiss.
- **Day summaries (`engine/daySummary.ts`)** — `summariseDay` computes committed /
  recurring / task / free / slack minutes for a date; `daySegments` turns that
  into the stacked capacity bars used in Week and Month.

### 2.8 Calendar import & export

Two pure, symmetric utilities:

- **Import — `utils/ics.ts`** (`parseICS`): a pragmatic RFC-5545 subset — VEVENT
  with SUMMARY/UID/DTSTART/DTEND, UTC/TZID/all-day times, and DAILY/WEEKLY RRULEs
  (INTERVAL/COUNT/UNTIL/BYDAY) expanded within ~60 days. Never throws on bad input.
  The store's `importEvents` de-dupes on `externalId` (iCal UID) so re-imports
  replace rather than duplicate.
- **Export — `utils/icsExport.ts`** (`plansToICS`): turns one or more `DayPlan`s
  into a VCALENDAR — CRLF endings, TEXT escaping, 75-char line folding, stable
  UIDs, and **floating-local** times so the output round-trips back through
  `parseICS` (covered by a test). Triggered from Today (one day) and Week (the
  visible week) via the `download.ts` helper.

### 2.9 Components

`App.tsx` is the shell: a header (`AlertsBell`, `Account`), the `Nav` tab bar, and
a view switch. It calls `useSync()` once and fires deadline notifications.

Tabs (`components/Nav.tsx`): **Today · Week · Month · Tasks · Recurring · Settings**.

- **Today** — stat bars, add-event / suggest-window forms, the draggable
  `Timeline` (hour gridlines + `BlockCard`s), season ideas, and `.ics` export.
- **Week** — a 7-column hourly calendar grid (shared vertical scale, hour gutter,
  per-day capacity bar, "now" line, `.ics` export).
- **Month** — a 6-week grid of capacity bars + deadline/commitment markers.
- **Tasks / Recurring** — CRUD forms for tasks and recurring items.
- **Settings** — sleep, meals, budgets, interests, clock format, hemisphere,
  notifications, calendar import, and data reset/seed.
- **Account / SyncConflictModal** — sign-in/out UI and conflict prompts (sync).
- **ui.tsx** — shared primitives (`Card`, `Button`, `Field`, `CapacityBar`,
  `Legend`, `BLOCK_STYLES`, …).

---

## 3. Cross-device sync

Sync is **opt-in and additive**. Signed out, none of this runs and the app is
pure-local. The design keeps the hard decisions in a pure, unit-tested module and
the side effects in thin orchestration.

### 3.1 The pieces

| File | Responsibility |
|---|---|
| `sync/core.ts` | **Pure.** `snapshotOf` (extract synced slice), `hashSnapshot` (FNV-1a over key-sorted JSON), `isEmptyPlanner`, and `planSync` (the decision function). No network, no React. |
| `store/useAuth.ts` | Second Zustand store. Auth (`register`/`login`/`logout`), session restore, and sync orchestration (`reconcile`, `pushNow`, `resolveConflict`). |
| `sync/useSync.ts` | App-shell hook. Restores the session **once** on load, debounces a push **1.5 s** after any store change, and flushes pending changes on tab-hide. |
| `api/client.ts` | Typed `fetch` wrapper. Base URL from `VITE_API_URL` (default `http://localhost:8787`). |

**What is synced:** exactly the `PersistedState` slice of `useStore` — sent to the
backend as **opaque JSON**. The backend never interprets it.

**Token handling:** the **access token is in-memory only**; `useAuth` persists
just the **refresh token** plus `lastSyncedVersion` and `lastSyncedHash` (to
`localStorage["todotoday-auth"]`). `withAccess()` transparently refreshes the
access token once on a 401 and retries.

### 3.2 The reconciliation decision (`planSync`)

On sign-in (and session restore) the client fetches the server's `version`,
hashes its local snapshot, and asks `planSync` what to do:

| Synced here before? | Server state | Local state | Decision |
|---|---|---|---|
| No | empty (v0) | anything | **push** (adopt local) |
| No | has data | local empty | **adoptRemote** |
| No | has data | local has data | **conflict** (`first-signin`) |
| Yes | not newer than last sync | unchanged | **noop** |
| Yes | not newer | changed | **push** |
| Yes | newer | unchanged | **adoptRemote** |
| Yes | newer | changed | **conflict** (`remote-newer`) |

`localChanged` is detected by comparing the current snapshot hash against the
stored `lastSyncedHash` — so the app knows whether to push without keeping a full
copy of the last-synced state.

### 3.3 Flow: sign in / restore session

```
useSync (on load) ─► useAuth.init()
  refreshToken present? ── no ─► status "offline" (local-only)
            │ yes
            ▼
  api.refresh(refreshToken)  ─► new access token (+ rotated refresh token)
            │
            ▼
  reconcile():
     server = GET /planner            (version + data)
     decision = planSync({ lastSyncedVersion, localChanged, localEmpty, serverVersion })
     ├─ push        → PUT /planner (data, expectedVersion) → save new version+hash
     ├─ adoptRemote → useStore.hydrate(server.data); recomputeAlerts; save version+hash
     ├─ conflict    → open SyncConflictModal (user picks local or remote)
     └─ noop        → done
```

### 3.4 Flow: local edit → push

```
user edits → useStore changes
        │  (useStore.subscribe fires)
        ▼
useSync schedulePush()  ── debounce 1.5 s ──►  useAuth.pushNow()
        │                                          │
   (also: tab hidden → flush immediately)          ▼
                                   hash unchanged? → skip
                                   else PUT /planner(data, lastSyncedVersion)
                                        ├─ 200 → save {version, hash}
                                        └─ 409 → open conflict (server moved on)
```

### 3.5 Conflict resolution

When `planSync` returns `conflict`, or a `PUT` loses the optimistic race (409),
`SyncConflictModal` asks the user to keep **local** or **remote**:

- **remote** → `hydrate` the server snapshot locally.
- **local** → re-`PUT` the local snapshot at the server's current version,
  overwriting it.

---

## 4. Backend (`server/`)

A small Express API whose defining trait is a **repository abstraction** that lets
the entire HTTP layer be tested with no database.

### 4.1 Layering & dependency injection

```
src/index.ts     Composition root: loadEnv() → prismaRepo() → createApp() → listen()
     │
     ▼
src/app.ts       createApp({ repo, jwtSecret, corsOrigin }) — pure factory
     │              mounts /health, /auth/*, /planner, /me
     ▼
routes           auth/routes.ts · planner/routes.ts  (depend only on Repo + Tokens)
     │
     ▼
src/repo.ts      Repo interface  ◄── implemented by ──►  src/db.ts (Prisma/Postgres)
                                                          test/memoryRepo.ts (in-memory)
```

Because `createApp` takes its dependencies as arguments, tests inject a fake repo
and a throwaway secret — `npm test` runs the real routes against an in-memory
store with **no Postgres** required.

### 4.2 Auth subsystem (`src/auth/`)

| File | Role |
|---|---|
| `password.ts` | argon2id hashing (`@node-rs/argon2`, prebuilt binaries — no native build). |
| `tokens.ts` | `createTokens(secret)`: signs **JWT access tokens** (HS256, `sub=userId`, **15 min**); mints **refresh tokens** (32 random bytes, base64url) stored only as a **sha256 hash**, **30-day** expiry. |
| `routes.ts` | `/register`, `/login`, `/refresh`, `/logout`. |
| `middleware.ts` | `requireAuth(tokens)` — validates the `Bearer` access token and sets `req.userId`. |

Token lifecycle:

- **register/login** → validate (zod; password ≥ 8, email lowercased), then
  `issueSession` returns `{ user, accessToken, refreshToken }` and stores the
  refresh token's hash.
- **refresh** → look up by hash; reject if missing/revoked/expired; otherwise
  **rotate** (revoke the used token, issue a fresh pair). Refresh tokens are
  single-use.
- **logout** → revoke the presented refresh token. Local planner data is kept.

The client only ever holds the opaque refresh token; the server only ever stores
its hash, so a database leak doesn't expose usable tokens.

### 4.3 Planner sync (`src/planner/routes.ts`)

- `GET /planner` → `{ data, version }` (`{ data: null, version: 0 }` if never synced).
- `PUT /planner` `{ data, version }` → **optimistic concurrency**: the write
  succeeds only if `version` equals the stored version (0 when no row exists);
  on success the version is incremented; on mismatch it returns **409** with the
  current server state so the client can reconcile.

The body is stored as **opaque JSON** (`PlannerState.data`). In `db.ts` the upsert
runs inside a Prisma `$transaction` that re-checks the version, so concurrent
writers can't both win.

### 4.4 Calendar foundation (`src/calendar/crypto.ts`)

`encrypt`/`decrypt` helpers (AES-256-GCM; iv + auth tag + ciphertext packed into
one base64 string) for storing calendar provider credentials at rest. **Schema +
crypto only** — no Outlook/Apple/Google routes or OAuth are wired yet. This is the
seam for the next roadmap step (live calendar sync).

### 4.5 Data model (`prisma/schema.prisma`)

```
User ───┬───< RefreshToken      (hashed, revocable; one row per active session)
        ├───── PlannerState      (1:1; the opaque JSON snapshot + version)
        └───< CalendarConnection (provider + encrypted creds; foundation only)
```

`PlannerState.data` is `Json`; `version` drives the optimistic-concurrency check.
Cascading deletes clean up a user's tokens/state/connections.

### 4.6 Config & validation (`src/env.ts`)

zod validates the environment at startup and exits with a clear message if
anything is missing: `DATABASE_URL`, `JWT_SECRET` (≥16 chars), `ENCRYPTION_KEY`
(32-byte base64), `PORT` (default 8787), `CORS_ORIGIN`.

---

## 5. End-to-end traces

**Add a task with a deadline (local-only):**

```
Tasks form → useStore.addTask()
   → push Task (remainingMinutes = estimate)
   → recompute() → computeAlerts() (may flag infeasible)
   → (replan happens on next plan view / Re-plan)
buildHorizon() sizes days to the deadline → planHorizon()
   → planSingleDay × N, carrying remainingMinutes across days
   → dayPlans updated → Today/Week re-render
```

**Same task, signed in:**

```
…store changes as above…
useStore.subscribe → useSync debounce 1.5 s → useAuth.pushNow()
   → snapshot + hash → PUT /planner(data, lastSyncedVersion)
      → requireAuth → repo.upsertPlanner (version check) → 200 {version}
   → save lastSyncedVersion/Hash
On another device: sign in → reconcile → planSync → adoptRemote → hydrate()
```

---

## 6. Build, test & deploy topology

| Concern | Frontend | Backend |
|---|---|---|
| Dev | `npm run dev` (Vite :5173) | `cd server && npm run dev` (tsx :8787) |
| Type-check / build | `npm run build` (tsc + vite → `dist/`) | `npm run build` (tsc → `dist/`) |
| Tests | `npm test` (vitest, `src/test/`) | `npm test` (vitest, `server/test/`, in-memory repo) |
| Deploy | static host — `netlify.toml` (Netlify) or Vercel (zero-config); set `VITE_API_URL` | `render.yaml` Blueprint (Render); `prisma db push` creates tables; secrets in dashboard |
| Data | `localStorage` | Postgres (Neon) |

There is no linter; **`npm run build` (tsc) is the type-check gate** in both
projects.

```
Netlify/Vercel  ──serves──►  Browser app  ──fetch──►  Render (Express)  ──Prisma──►  Neon (Postgres)
   (frontend, static)                         (VITE_API_URL)        (CORS_ORIGIN)
```

---

## 7. Where to add things

- **New scheduling behavior** → a pure function in `engine/`, exposed through a
  `useStore` action. Don't compute in components. Add a test in `src/test/`.
- **New persisted field** → update `partialize`, `PersistedState`, `hydrate`, and
  `PERSISTED_KEYS` (`sync/core.ts`) together.
- **New API endpoint** → add a route that depends only on `Repo`/`Tokens`, extend
  the `Repo` interface, implement it in both `db.ts` and `test/memoryRepo.ts`,
  and add a typed wrapper in `api/client.ts`.
- **Live calendar sync** (next roadmap item) → build provider logic on the
  `CalendarConnection` + `crypto.ts` foundation: OAuth/token storage, a sync
  route, and event mapping to `CalendarEvent`.
```
