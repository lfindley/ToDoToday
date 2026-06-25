// Data-access abstraction. The Express app depends only on this interface, so
// it can run against Postgres (db.ts) in production and an in-memory fake in
// tests — no live database required to exercise the HTTP layer.

export interface UserRecord {
  id: string
  email: string
  passwordHash: string
  createdAt: Date
}

export interface RefreshTokenRecord {
  id: string
  userId: string
  tokenHash: string
  expiresAt: Date
  revokedAt: Date | null
}

export interface PlannerStateRecord {
  data: unknown
  version: number
  updatedAt: Date
}

export type UpsertResult =
  | { ok: true; state: PlannerStateRecord }
  | { ok: false; current: PlannerStateRecord }

export interface Repo {
  createUser(email: string, passwordHash: string): Promise<UserRecord>
  findUserByEmail(email: string): Promise<UserRecord | null>
  findUserById(id: string): Promise<UserRecord | null>

  createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>
  revokeRefreshToken(tokenHash: string): Promise<void>

  getPlanner(userId: string): Promise<PlannerStateRecord | null>
  /**
   * Optimistic upsert: succeeds only when `expectedVersion` equals the stored
   * version (0 when no row exists yet); on success the version is incremented.
   * On mismatch, returns the current state so the caller can reconcile.
   */
  upsertPlanner(userId: string, data: unknown, expectedVersion: number): Promise<UpsertResult>
}

/** The state reported for a user who has never synced (version 0). */
export const EMPTY_PLANNER: PlannerStateRecord = { data: null, version: 0, updatedAt: new Date(0) }
