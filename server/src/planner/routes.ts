import { Router } from 'express'
import { z } from 'zod'
import type { Repo } from '../repo'
import type { Tokens } from '../auth/tokens'
import { requireAuth } from '../auth/middleware'

// `data` is the opaque planner snapshot (the frontend store blob). `version` is
// the version the client last saw — used for optimistic concurrency.
const putBody = z.object({
  data: z.unknown(),
  version: z.number().int().nonnegative(),
})

export function plannerRouter(repo: Repo, tokens: Tokens): Router {
  const router = Router()
  router.use(requireAuth(tokens))

  router.get('/', async (req, res) => {
    const state = await repo.getPlanner(req.userId!)
    if (!state) {
      res.json({ data: null, version: 0 })
      return
    }
    res.json({ data: state.data, version: state.version })
  })

  router.put('/', async (req, res) => {
    const parsed = putBody.safeParse(req.body)
    if (!parsed.success || parsed.data.data === undefined) {
      res.status(400).json({ error: 'Body must be { data, version }' })
      return
    }
    const result = await repo.upsertPlanner(req.userId!, parsed.data.data, parsed.data.version)
    if (!result.ok) {
      res.status(409).json({
        error: 'Version conflict — fetch the latest state and retry',
        current: { data: result.current.data, version: result.current.version },
      })
      return
    }
    res.json({ data: result.state.data, version: result.state.version })
  })

  return router
}
