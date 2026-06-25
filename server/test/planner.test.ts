import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { memoryRepo } from './memoryRepo'

const JWT_SECRET = 'test-secret-0123456789abcdef'

async function authed() {
  const app = createApp({ repo: memoryRepo(), jwtSecret: JWT_SECRET, corsOrigin: '*' })
  const reg = await request(app).post('/auth/register').send({ email: 'a@b.com', password: 'password1' })
  return { app, token: reg.body.accessToken as string }
}

describe('planner sync', () => {
  it('reports empty state before the first sync', async () => {
    const { app, token } = await authed()
    const res = await request(app).get('/planner').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: null, version: 0 })
  })

  it('PUT then GET round-trips and increments the version', async () => {
    const { app, token } = await authed()
    const put = await request(app)
      .put('/planner')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: { tasks: [1, 2] }, version: 0 })
    expect(put.status).toBe(200)
    expect(put.body.version).toBe(1)

    const get = await request(app).get('/planner').set('Authorization', `Bearer ${token}`)
    expect(get.body).toEqual({ data: { tasks: [1, 2] }, version: 1 })
  })

  it('rejects a stale version with 409 and returns the current state', async () => {
    const { app, token } = await authed()
    await request(app).put('/planner').set('Authorization', `Bearer ${token}`).send({ data: { a: 1 }, version: 0 })
    const stale = await request(app)
      .put('/planner')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: { a: 2 }, version: 0 })
    expect(stale.status).toBe(409)
    expect(stale.body.current).toEqual({ data: { a: 1 }, version: 1 })
  })

  it('requires authentication', async () => {
    const { app } = await authed()
    expect((await request(app).get('/planner')).status).toBe(401)
    expect((await request(app).put('/planner').send({ data: {}, version: 0 })).status).toBe(401)
  })
})
