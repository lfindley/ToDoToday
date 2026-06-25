import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// AES-256-GCM encryption for calendar credentials/tokens stored at rest.
// `keyB64` is the 32-byte ENCRYPTION_KEY, base64-encoded. The output packs
// iv (12 bytes) + auth tag (16 bytes) + ciphertext into one base64 string.
// Not used by any route yet — this is the foundation for the calendar-sync
// follow-up, with a unit test to lock the round-trip behaviour now.

function loadKey(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, 'base64')
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must decode to 32 bytes (base64). See server/.env.example.')
  }
  return key
}

export function encrypt(plaintext: string, keyB64: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', loadKey(keyB64), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

export function decrypt(payloadB64: string, keyB64: string): string {
  const buf = Buffer.from(payloadB64, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ciphertext = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', loadKey(keyB64), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
