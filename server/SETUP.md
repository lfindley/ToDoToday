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

## Frontend integration (later)

`src/api/client.ts` (in the frontend) already wraps these endpoints. Point the
app at the API by adding to the **repo-root** `.env`:

```
VITE_API_URL=http://localhost:8787
```

Wiring the store to actually sync (login UI, pull/push) is the next planned step.

## Deploying (later)

- **Database:** Neon (free tier) — already cloud-hosted.
- **API:** Render free web service or Fly.io. Set the same env vars there; run
  `npm run build` then `npm start`. Note free hosts sleep when idle, so
  background sync waits for a small paid tier — on-demand sync works regardless.
- **Frontend:** Vercel/Netlify (set `VITE_API_URL` to the deployed API origin,
  and add that origin to the API's `CORS_ORIGIN`).
