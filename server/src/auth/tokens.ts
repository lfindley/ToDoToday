import { SignJWT, jwtVerify } from 'jose'
import { createHash, randomBytes } from 'node:crypto'

const ACCESS_TTL = '15m'
const REFRESH_TTL_DAYS = 30

export interface NewRefreshToken {
  token: string // opaque secret sent to the client (only stored hashed)
  tokenHash: string
  expiresAt: Date
}

export interface Tokens {
  signAccess(userId: string): Promise<string>
  /** Returns the userId if the access token is valid, else null. */
  verifyAccess(token: string): Promise<string | null>
  newRefreshToken(): NewRefreshToken
  hashRefresh(token: string): string
}

function sha256(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createTokens(secret: string): Tokens {
  const key = new TextEncoder().encode(secret)
  return {
    signAccess(userId) {
      return new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime(ACCESS_TTL)
        .sign(key)
    },
    async verifyAccess(token) {
      try {
        const { payload } = await jwtVerify(token, key)
        return typeof payload.sub === 'string' ? payload.sub : null
      } catch {
        return null
      }
    },
    newRefreshToken() {
      const token = randomBytes(32).toString('base64url')
      return {
        token,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
      }
    },
    hashRefresh: sha256,
  }
}
