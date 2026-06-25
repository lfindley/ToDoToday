import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { memoryRepo } from './memoryRepo'

const JWT_SECRET = 'test-secret-0123456789abcdef'
const newApp = () => createApp({ repo: memoryRepo(), jwtSecret: JWT_SECRET, corsOrigin: '*' })
const creds = { email: 'a@b.com', password: 'password1' }

describe('auth', () => {
  it('registers and returns a session', async () => {
    const res = await request(newApp()).post('/auth/register').send(creds)
    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe('a@b.com')
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.refreshToken).toBeTruthy()
  })

  it('rejects a duplicate email', async () => {
    const app = newApp()
    await request(app).post('/auth/register').send(creds)
    const res = await request(app).post('/auth/register').send(creds)
    expect(res.status).toBe(409)
  })

  it('rejects a too-short password', async () => {
    const res = await request(newApp()).post('/auth/register').send({ email: 'a@b.com', password: 'short' })
    expect(res.status).toBe(400)
  })

  it('logs in with the right password and rejects the wrong one', async () => {
    const app = newApp()
    await request(app).post('/auth/register').send(creds)
    expect((await request(app).post('/auth/login').send(creds)).status).toBe(200)
    const bad = await request(app).post('/auth/login').send({ ...creds, password: 'wrongpass' })
    expect(bad.status).toBe(401)
  })

  it('guards /me and accepts a valid access token', async () => {
    const app = newApp()
    const reg = await request(app).post('/auth/register').send(creds)
    expect((await request(app).get('/me')).status).toBe(401)
    const me = await request(app).get('/me').set('Authorization', `Bearer ${reg.body.accessToken}`)
    expect(me.status).toBe(200)
    expect(me.body.email).toBe('a@b.com')
  })

  it('rotates refresh tokens — the used one stops working', async () => {
    const app = newApp()
    const reg = await request(app).post('/auth/register').send(creds)
    const rotated = await request(app).post('/auth/refresh').send({ refreshToken: reg.body.refreshToken })
    expect(rotated.status).toBe(200)
    const reuse = await request(app).post('/auth/refresh').send({ refreshToken: reg.body.refreshToken })
    expect(reuse.status).toBe(401)
  })

  it('logout revokes the refresh token', async () => {
    const app = newApp()
    const reg = await request(app).post('/auth/register').send(creds)
    expect((await request(app).post('/auth/logout').send({ refreshToken: reg.body.refreshToken })).status).toBe(204)
    const after = await request(app).post('/auth/refresh').send({ refreshToken: reg.body.refreshToken })
    expect(after.status).toBe(401)
  })
})
