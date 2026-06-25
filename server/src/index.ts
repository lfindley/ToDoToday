import { loadEnv } from './env'
import { prismaRepo } from './db'
import { createApp } from './app'

const env = loadEnv()

const app = createApp({
  repo: prismaRepo(),
  jwtSecret: env.JWT_SECRET,
  corsOrigin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
})

app.listen(env.PORT, () => {
  console.log(`ToDoToday API listening on http://localhost:${env.PORT}`)
})
