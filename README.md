# 🗓️ ToDoToday

ToDoToday turns the things in your life into a concrete, minute-by-minute plan for each day. You describe your routine once — sleep, meals, fixed commitments, recurring activities, one-off tasks with deadlines, and the things you enjoy — and ToDoToday automatically lays out a realistic schedule, spreads long tasks across multiple days to hit their deadlines, and warns you when a deadline won't fit.

It runs entirely in your browser — no account required, and your data is stored locally on your device. An **optional account** adds cross-device sync if you want it; signed out, the app stays fully local.

## Features

- **Automatic day planning** — a scheduler places your tasks, commitments, meals, and free time into a clear timeline for each day.
- **Deadline-aware scheduling** — long tasks are split across days so they finish before their deadline, respecting an optional daily cap per task.
- **Priorities & time windows** — order work by deadline and priority, and constrain tasks to time windows (e.g. "after 7pm", "before 11am").
- **Recurring activities** — fixed weekly commitments (work, classes) and flexible goals (e.g. gym 3×/week) that the planner fits into your free gaps.
- **One-off events** — dated appointments that anchor the day around them.
- **Calendar import** — import appointments from an `.ics` file exported from Outlook or Apple Calendar (Settings → Import calendar). Imported events become anchors the planner schedules around, with de-duplication on re-import and support for all-day and basic recurring events.
- **Calendar export** — download any day (Today) or week (Week) as an `.ics` file and import the generated plan into Outlook / Apple / Google Calendar.
- **Interactive suggestions** — when you have free time (or you pick a window), ToDoToday proposes either one of your pending tasks or a season/interest activity; approve it to drop it into your plan, or dismiss it. Free-time activity ideas are tailored to your interests and the current season.
- **Feasibility alerts** — get warned when there isn't enough time to finish a task before its deadline, plus reminders 2 days / 1 day / on the day.
- **Week & month overviews** — capacity bars showing how committed, busy, or free each day is.
- **Drag to adjust** — drag a block to reschedule it; edited blocks are locked so they survive a replan.
- **12/24-hour clock** — switch between 24-hour and 12-hour time display (Settings → Clock format).
- **Cross-device sync (optional)** — create an account to sync your planner across devices; conflicts are detected and you choose which copy wins. Requires running the [backend](server/SETUP.md); without it the app is fully local.
- **Optional browser notifications** — deadline toasts while the app is open.

## Tech stack

- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) for dev/build
- [Zustand](https://github.com/pmndrs/zustand) for state, persisted to `localStorage`
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [@dnd-kit](https://dndkit.com/) for drag-and-drop
- [date-fns](https://date-fns.org/) for date math
- [Vitest](https://vitest.dev/) for tests

## Getting started

Requires [Node.js](https://nodejs.org/) (18+).

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
```

### Other commands

```bash
npm run build    # type-check and build for production (output in dist/)
npm run preview  # preview the production build locally
npm test         # run the test suite once
npm run test:watch
```

## How it works

The app is split into two layers:

- **A pure scheduling engine** (`src/engine/`, `src/utils/`) — framework-free logic for planning days, computing alerts, resolving recurrence, and generating suggestions. This is where the core algorithms live, and what the tests cover.
- **State + UI** (`src/store/`, `src/components/`) — a Zustand store that holds your data and calls into the engine, plus React components for the Today / Week / Month / Tasks / Recurring / Settings views.

The planner works internally in minutes-from-midnight. For each day it places hard anchors first (locked blocks, events, meals, fixed commitments), then fits flexible recurring activities, then fills a daily "productive" budget with your highest-priority tasks, and finally fills free time up to your "free" budget. Across a multi-day horizon it carries each task's leftover minutes from one day to the next, so big tasks naturally spread out and land before their deadlines.

## Data & privacy

By default all data lives in your browser's `localStorage` (key: `todotoday`) and nothing is sent anywhere. Clearing your browser data, or using a different browser or device, starts you fresh.

If you opt in to an **account** (by running the optional [backend](server/SETUP.md) and signing in), your planner is synced to that server so it follows you across devices; passwords are hashed and sessions use short-lived access tokens with rotating refresh tokens. Signed out, the app remains entirely local. (Calendar import reads `.ics` files locally in the browser; live two-way calendar service sync is still on the roadmap.)

## Roadmap

Planned, roughly in order. The backend and cross-device planner sync now exist; the next big step is live, two-way calendar service sync.

- [x] **Calendar import (`.ics` file)** — pull Outlook/Apple appointments in.
- [x] **Interactive suggestions** — suggest a task or activity for free time and approve it into the plan.
- [x] **Calendar export (`.ics`)** — download the generated plan and import it into your calendar.
- [x] **Personal backend** — a small, single-user backend (accounts + server-side planner sync), with schema/encryption foundations for calendar credentials. See [`server/`](server/SETUP.md).
- [x] **Cross-device sync** — optional account that syncs the planner across devices, with conflict resolution.
- [ ] **Live Outlook sync** — automatic, refreshing sync via the Microsoft Graph API.
- [ ] **Live Apple sync** — via CalDAV (using an app-specific password and a server-side proxy).
- [ ] **Two-way sync** — edits flow in both directions for Outlook and Apple.

Google Calendar isn't a current priority but would be a straightforward add alongside Outlook.

### Known limitations (current)

- Calendar import treats `TZID` times as local wall-clock (no full timezone/VTIMEZONE parsing).
- Only `DAILY`/`WEEKLY` recurring events are expanded, within ~60 days of import.

## Project status

Early and actively evolving (v0.1.0). The core is a local-only, single-user app; an optional backend adds accounts and cross-device planner sync. Live two-way calendar service sync is still on the [roadmap](#roadmap).
