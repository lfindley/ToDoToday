/** Small stable id generator (uses crypto.randomUUID when available). */
export function uid(prefix = ''): string {
  const rnd =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  return prefix ? `${prefix}_${rnd}` : rnd
}
