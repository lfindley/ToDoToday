import express from 'express'
import cors from 'cors'
import type { Repo } from './repo'
import { createTokens } from './auth/tokens'
import { authRouter } from './auth/routes'
import { plannerRouter } from './planner/routes'
import { requireAuth } from './auth/middleware'
import './types' // Express.Request augmentation (req.userId)

export interface AppConfig {
  repo: Repo
  jwtSecret: string
  corsOrigin: string | string[]
}

/** Build the Express app. Pure factory so tests can inject a fake repo/secret. */
export function createApp(cfg: AppConfig) {
  const app = express()
  app.use(cors({ origin: cfg.corsOrigin }))
  // Planner snapshots can be sizeable (a full plan horizon), so allow some room.
  app.use(express.json({ limit: '5mb' }))

  const tokens = createTokens(cfg.jwtSecret)

  app.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.use('/auth', authRouter(cfg.repo, tokens))
  app.use('/planner', plannerRouter(cfg.repo, tokens))

  app.get('/me', requireAuth(tokens), async (req, res) => {
    const user = await cfg.repo.findUserById(req.userId!)
    if (!user) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    res.json({ id: user.id, email: user.email })
  })

  return app
}
