import { z } from 'zod'

// Load a local .env if present (Node >= 20.12 / 21.7 has process.loadEnvFile).
// In production the platform injects real env vars, so a missing file is fine.
try {
  ;(process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.()
} catch {
  /* no .env file — rely on the process environment */
}

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (get one from Neon)'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  ENCRYPTION_KEY: z.string().min(1, 'ENCRYPTION_KEY is required'),
  PORT: z.coerce.number().int().positive().default(8787),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
})

export type Env = z.infer<typeof schema>

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    console.error('✖ Invalid environment configuration:')
    for (const [key, msgs] of Object.entries(parsed.error.flatten().fieldErrors)) {
      console.error(`  - ${key}: ${msgs?.join(', ')}`)
    }
    console.error('Copy server/.env.example to server/.env and fill in the values.')
    process.exit(1)
  }
  return parsed.data
}
