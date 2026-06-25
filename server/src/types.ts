// Augment Express's Request so authenticated handlers can read `req.userId`.
import 'express'

declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export {}
