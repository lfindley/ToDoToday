import { Router } from 'express'
import { z } from 'zod'
import type { Repo } from '../repo'
import type { Tokens } from './tokens'
import { hashPassword, verifyPassword } from './password'

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
})

const refreshBody = z.object({ refreshToken: z.string().min(1) })

export function authRouter(repo: Repo, tokens: Tokens): Router {
  const router = Router()

  router.post('/register', async (req, res) => {
    const parsed = credentials.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid email or password (min 8 characters)' })
      return
    }
    const email = parsed.data.email.toLowerCase()
    if (await repo.findUserByEmail(email)) {
      res.status(409).json({ error: 'Email already registered' })
      return
    }
    const user = await repo.createUser(email, await hashPassword(parsed.data.password))
    res.status(201).json(await issueSession(repo, tokens, user.id, user.email))
  })

  router.post('/login', async (req, res) => {
    const parsed = credentials.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid credentials' })
      return
    }
    const email = parsed.data.email.toLowerCase()
    const user = await repo.findUserByEmail(email)
    if (!user || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }
    res.json(await issueSession(repo, tokens, user.id, user.email))
  })

  router.post('/refresh', async (req, res) => {
    const parsed = refreshBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing refreshToken' })
      return
    }
    const rec = await repo.findRefreshToken(tokens.hashRefresh(parsed.data.refreshToken))
    if (!rec || rec.revokedAt || rec.expiresAt < new Date()) {
      res.status(401).json({ error: 'Invalid or expired refresh token' })
      return
    }
    // Rotate: revoke the used token and issue a fresh pair.
    await repo.revokeRefreshToken(rec.tokenHash)
    const user = await repo.findUserById(rec.userId)
    if (!user) {
      res.status(401).json({ error: 'Invalid refresh token' })
      return
    }
    res.json(await issueSession(repo, tokens, user.id, user.email))
  })

  router.post('/logout', async (req, res) => {
    const parsed = refreshBody.safeParse(req.body)
    if (parsed.success) {
      await repo.revokeRefreshToken(tokens.hashRefresh(parsed.data.refreshToken))
    }
    res.status(204).end()
  })

  return router
}

async function issueSession(repo: Repo, tokens: Tokens, userId: string, email: string) {
  const accessToken = await tokens.signAccess(userId)
  const refresh = tokens.newRefreshToken()
  await repo.createRefreshToken(userId, refresh.tokenHash, refresh.expiresAt)
  return { user: { id: userId, email }, accessToken, refreshToken: refresh.token }
}
