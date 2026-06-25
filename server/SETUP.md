# ToDoToday backend — setup

A small Node + Express + TypeScript API providing accounts and cross-device
planner sync, with schema slots for Microsoft/Apple/Google calendar
connections (provider logic comes in a later step).

The frontend (the Vite app at the repo root) is unchanged and still works
fully offline — this server is additive.

## 1. Prerequisites

- **Node.js 20.12+** (uses the built-in `.env` loader).
- A **free Postgres database**. The easiest is [Neon](https://neon.tech):
  1. Sign up and create a project.
  2. Copy the **connection string** (it looks like
     `postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`).

## 2. Configure

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

- `DATABASE_URL` — paste your Neon connection string.
- `JWT_SECRET` — generate one:
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
- `ENCRYPTION_KEY` — generate a 32-byte base64 key:
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- `PORT` (default `8787`) and `CORS_ORIGIN` (default `http://localhost:5173`).

`.env` is gitignored — never commit it.

## 3. Install & create the database tables

```bash
npm install
npm run prisma:generate     # generate the typed Prisma client
npm run prisma:migrate      # create tables in your Neon database (name it e.g. "init")
```

## 4. Run

```bash
npm run dev                 # http://localhost:8787, restarts on change
```

Smoke test:

```bash
curl http://localhost:8787/health         # -> {"ok":true}

# register, then use the returned accessToken:
curl -s -X POST http://localhost:8787/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"supersecret"}'

# push a planner snapshot (version 0 = first write), then read it back:
curl -s -X PUT http://localhost:8787/planner \
  -H "Authorization: Bearer <ACCESS_TOKEN>" -H 'Content-Type: application/json' \
  -d '{"data":{"hello":"world"},"version":0}'
curl -s http://localhost:8787/planner -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## 5. Build & test

```bash
npm run build               # type-check + emit to dist/
npm test                    # auth + planner + crypto suites (no database needed)
```

Tests run against an in-memory repository, so they don't touch Postgres.

## API reference (this step)

| Method | Path             | Auth   | Body / notes |
|--------|------------------|--------|--------------|
| GET    | `/health`        | —      | `{ ok: true }` |
| POST   | `/auth/register` | —      | `{ email, password }` → `{ user, accessToken, refreshToken }` |
| POST   | `/auth/login`    | —      | same shape as register |
| POST   | `/auth/refresh`  | —      | `{ refreshToken }` → new session (rotates the refresh token) |
| POST   | `/auth/logout`   | —      | `{ refreshToken }` → `204` |
| GET    | `/me`            | Bearer | `{ id, email }` |
| GET    | `/planner`       | Bearer | `{ data, version }` (`{ data: null, version: 0 }` if never synced) |
| PUT    | `/planner`       | Bearer | `{ data, version }`; `409 { current }` if `version` is stale |

Access tokens expire after 15 minutes; use `/auth/refresh` with the refresh
token (valid 30 days, revocable) to get a new one.

## Frontend integration

The frontend is already wired to sync against this API (login/register UI,
pull-on-sign-in, debounced push, and conflict resolution — see `src/store/useAuth.ts`
and `src/sync/`). Point the app at the API by adding to the **repo-root** `.env`:

```
VITE_API_URL=http://localhost:8787
```

Signed out, the app stays fully local; signing in turns on cross-device sync.

## Deploying

The repo ships ready-to-use config for a free-tier deploy:

- **Database:** Neon (free tier) — already cloud-hosted.
- **API:** [`render.yaml`](../render.yaml) at the repo root is a Render Blueprint.
  In Render, choose **New + → Blueprint**, point it at the repo, and set the
  secret env vars (`DATABASE_URL`, `ENCRYPTION_KEY`, `CORS_ORIGIN`; `JWT_SECRET`
  is auto-generated). Its build runs `prisma db push` to create the tables from
  `schema.prisma` — no migration history is committed yet, so there's nothing to
  run by hand. (To switch to migrations later, commit a `prisma/migrations/`
  folder and use `prisma migrate deploy` instead.) Note: free hosts sleep when
  idle, so the first request after a lull is slow; on-demand sync still works.
- **Frontend:** [`netlify.toml`](../netlify.toml) sets the build/publish for
  Netlify; Vercel needs no config (it auto-detects Vite). Either way, set
  `VITE_API_URL` to the deployed API origin and add that origin to the API's
  `CORS_ORIGIN`.
