import { describe, it, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import { encrypt, decrypt } from '../src/calendar/crypto'

const key = randomBytes(32).toString('base64')

describe('calendar crypto (AES-256-GCM)', () => {
  it('round-trips a secret', () => {
    const secret = 'apple-app-specific-password-abcd'
    expect(decrypt(encrypt(secret, key), key)).toBe(secret)
  })

  it('fails to decrypt with a different key', () => {
    const other = randomBytes(32).toString('base64')
    expect(() => decrypt(encrypt('x', key), other)).toThrow()
  })

  it('rejects a key that is not 32 bytes', () => {
    expect(() => encrypt('x', randomBytes(16).toString('base64'))).toThrow()
  })
})
