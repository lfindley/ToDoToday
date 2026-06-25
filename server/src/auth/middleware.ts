import type { RequestHandler } from 'express'
import type { Tokens } from './tokens'

/** Express middleware that requires a valid Bearer access token and sets req.userId. */
export function requireAuth(tokens: Tokens): RequestHandler {
  return async (req, res, next) => {
    const match = (req.header('authorization') ?? '').match(/^Bearer (.+)$/i)
    if (!match) {
      res.status(401).json({ error: 'Missing bearer token' })
      return
    }
    const userId = await tokens.verifyAccess(match[1])
    if (!userId) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }
    req.userId = userId
    next()
  }
}
