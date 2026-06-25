import { PrismaClient, Prisma } from '@prisma/client'
import type { Repo } from './repo'
import { EMPTY_PLANNER } from './repo'

export const prisma = new PrismaClient()

/** Postgres-backed implementation of Repo (used in production via index.ts). */
export function prismaRepo(): Repo {
  return {
    createUser(email, passwordHash) {
      return prisma.user.create({ data: { email, passwordHash } })
    },
    findUserByEmail(email) {
      return prisma.user.findUnique({ where: { email } })
    },
    findUserById(id) {
      return prisma.user.findUnique({ where: { id } })
    },

    async createRefreshToken(userId, tokenHash, expiresAt) {
      await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } })
    },
    findRefreshToken(tokenHash) {
      return prisma.refreshToken.findUnique({ where: { tokenHash } })
    },
    async revokeRefreshToken(tokenHash) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    },

    async getPlanner(userId) {
      const s = await prisma.plannerState.findUnique({ where: { userId } })
      return s ? { data: s.data, version: s.version, updatedAt: s.updatedAt } : null
    },

    upsertPlanner(userId, data, expectedVersion) {
      return prisma.$transaction(async (tx) => {
        const existing = await tx.plannerState.findUnique({ where: { userId } })
        const currentVersion = existing?.version ?? 0
        if (expectedVersion !== currentVersion) {
          return {
            ok: false as const,
            current: existing
              ? { data: existing.data, version: existing.version, updatedAt: existing.updatedAt }
              : EMPTY_PLANNER,
          }
        }
        const version = currentVersion + 1
        const json = (data ?? Prisma.JsonNull) as Prisma.InputJsonValue
        const saved = existing
          ? await tx.plannerState.update({ where: { userId }, data: { data: json, version } })
          : await tx.plannerState.create({ data: { userId, data: json, version } })
        return {
          ok: true as const,
          state: { data: saved.data, version: saved.version, updatedAt: saved.updatedAt },
        }
      })
    },
  }
}
