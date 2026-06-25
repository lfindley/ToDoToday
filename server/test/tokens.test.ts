import { describe, it, expect } from 'vitest'
import { createTokens } from '../src/auth/tokens'

describe('tokens', () => {
  it('signs and verifies an access token', async () => {
    const t = createTokens('test-secret-0123456789abcdef')
    const jwt = await t.signAccess('user-1')
    expect(await t.verifyAccess(jwt)).toBe('user-1')
  })

  it('rejects a token signed with a different secret', async () => {
    const a = createTokens('secret-a-0123456789abcdef')
    const b = createTokens('secret-b-0123456789abcdef')
    expect(await b.verifyAccess(await a.signAccess('user-1'))).toBeNull()
  })

  it('hashes refresh tokens deterministically', () => {
    const t = createTokens('test-secret-0123456789abcdef')
    const { token, tokenHash } = t.newRefreshToken()
    expect(t.hashRefresh(token)).toBe(tokenHash)
  })
})
