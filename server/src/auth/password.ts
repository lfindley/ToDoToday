import { hash, verify } from '@node-rs/argon2'

// argon2id with library defaults. @node-rs/argon2 ships prebuilt binaries, so
// there's no native compile step (works cleanly on Windows/macOS/Linux).

export function hashPassword(plain: string): Promise<string> {
  return hash(plain)
}

export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain)
  } catch {
    return false
  }
}
