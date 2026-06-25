import { randomUUID } from 'node:crypto'
import type { Repo, UserRecord, RefreshTokenRecord, PlannerStateRecord } from '../src/repo'
import { EMPTY_PLANNER } from '../src/repo'

/** In-memory Repo implementation for tests — no database required. */
export function memoryRepo(): Repo {
  const usersById = new Map<string, UserRecord>()
  const idByEmail = new Map<string, string>()
  const refreshByHash = new Map<string, RefreshTokenRecord>()
  const plannerByUser = new Map<string, PlannerStateRecord>()

  return {
    async createUser(email, passwordHash) {
      const user: UserRecord = { id: randomUUID(), email, passwordHash, createdAt: new Date() }
      usersById.set(user.id, user)
      idByEmail.set(email, user.id)
      return user
    },
    async findUserByEmail(email) {
      const id = idByEmail.get(email)
      return id ? (usersById.get(id) ?? null) : null
    },
    async findUserById(id) {
      return usersById.get(id) ?? null
    },

    async createRefreshToken(userId, tokenHash, expiresAt) {
      refreshByHash.set(tokenHash, { id: randomUUID(), userId, tokenHash, expiresAt, revokedAt: null })
    },
    async findRefreshToken(tokenHash) {
      return refreshByHash.get(tokenHash) ?? null
    },
    async revokeRefreshToken(tokenHash) {
      const rec = refreshByHash.get(tokenHash)
      if (rec && !rec.revokedAt) rec.revokedAt = new Date()
    },

    async getPlanner(userId) {
      return plannerByUser.get(userId) ?? null
    },
    async upsertPlanner(userId, data, expectedVersion) {
      const existing = plannerByUser.get(userId)
      const currentVersion = existing?.version ?? 0
      if (expectedVersion !== currentVersion) {
        return { ok: false, current: existing ?? EMPTY_PLANNER }
      }
      const state: PlannerStateRecord = { data, version: currentVersion + 1, updatedAt: new Date() }
      plannerByUser.set(userId, state)
      return { ok: true, state }
    },
  }
}
