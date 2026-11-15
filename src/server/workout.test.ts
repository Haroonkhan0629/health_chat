import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppContext, Env } from '../../worker'
import { registerWorkoutRoute } from './workout'
import { resolveAuth } from './http-routes'

const app = new Hono<AppContext>()
registerWorkoutRoute(app, resolveAuth)
let env: Env
let token: string
let expiredToken: string
let wrongIssuerToken: string

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

beforeAll(async () => {
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('spki', keys.publicKey))
  const publicPem = `-----BEGIN PUBLIC KEY-----\n${btoa(String.fromCharCode(...publicKey))}\n-----END PUBLIC KEY-----`
  const issuer = 'https://auth.example.test'
  env = { GROQ_API_KEY: 'test-key', AUTH_JWT_PUBLIC_KEY: publicPem, AUTH_JWT_ISSUER: issuer } as Env
  async function signedToken(iss: string, exp: number) {
    const encode = (value: object) => base64url(new TextEncoder().encode(JSON.stringify(value)))
    const message = `${encode({ alg: 'ES256', typ: 'JWT' })}.${encode({ sub: 'user-1', iss, exp })}`
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, new TextEncoder().encode(message))
    return `${message}.${base64url(new Uint8Array(signature))}`
  }
  const now = Math.floor(Date.now() / 1000)
  token = await signedToken(issuer, now + 300)
  expiredToken = await signedToken(issuer, now - 60)
  wrongIssuerToken = await signedToken('https://wrong.example.test', now + 300)
})

function request(body: string, bindings = env, authorization = `Bearer ${token}`) {
  return app.request('/api/workout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization },
    body,
  }, bindings)
}

function groqReply(content: unknown) {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(content) } }],
  }), { headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('workout API', () => {
  it('rejects malformed, empty, and oversized requests without calling Groq', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect((await request('{')).status).toBe(400)
    expect((await request(JSON.stringify({ input: '  ' }))).status).toBe(400)
    expect((await request(JSON.stringify({ input: 'x'.repeat(301) }))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a missing key', async () => {
    const response = await request(JSON.stringify({ input: 'chest' }), { ...env, GROQ_API_KEY: '' })
    expect(response.status).toBe(503)
  })

  it('rejects missing, invalid, expired, and wrong-issuer tokens before calling Groq', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    for (const authorization of ['', 'Bearer invalid', `Bearer ${expiredToken}`, `Bearer ${wrongIssuerToken}`]) {
      const response = await request(JSON.stringify({ input: 'chest' }), env, authorization)
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Please sign in to create a workout.' })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the system instructions and returns an invalid-input error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(groqReply({ valid: false }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await request(JSON.stringify({ input: 'how do i look bigger' }))
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: expect.stringMatching(/invalid input/i) })
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.model).toBe('openai/gpt-oss-120b')
    expect(sent.messages[0].role).toBe('system')
    expect(sent.messages[0].content).toContain('how do i look bigger')
    expect(sent.messages[0].content).toContain('never include more than five exercises per day')
    expect(sent.messages[0].content).toContain('"id":"barbell-bench-press"')
    expect(sent.messages[0].content).toContain('"group":"Chest"')
    expect(sent.messages[0].content).not.toContain('/images/exercises/')
    expect(sent.messages[1].content).toBe('how do i look bigger')
  })

  it('returns a seven-day schedule with catalog exercise IDs', async () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      .map((day, i) => ({
        day, title: i === 0 ? 'Chest' : 'Rest', note: 'Take your time.',
        exercises: i === 0 ? [
          'barbell-bench-press', 'pushup', 'incline-push-up', 'cable-fly', 'machine-fly',
        ].map((id) => ({ id, sets: '3', reps: '8-12' })) : [],
      }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(groqReply({ valid: true, days })))
    const response = await request(JSON.stringify({ input: 'chest' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ valid: true, days })
  })

  it('rejects malformed model output and upstream failures', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(groqReply({ valid: true, days: [] }))
      .mockResolvedValueOnce(new Response('', { status: 429 }))
    vi.stubGlobal('fetch', fetchMock)
    expect((await request(JSON.stringify({ input: 'chest' }))).status).toBe(502)
    expect((await request(JSON.stringify({ input: 'chest' }))).status).toBe(502)
  })

  it('rejects a schedule with more than five exercises on a day', async () => {
    const exercise = { id: 'barbell-bench-press', sets: '3', reps: '8-12' }
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      .map((day, i) => ({
        day, title: i === 0 ? 'Chest' : 'Rest', note: 'Take your time.',
        exercises: i === 0 ? Array.from({ length: 6 }, () => exercise) : [],
      }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(groqReply({ valid: true, days })))
    const response = await request(JSON.stringify({ input: 'chest' }))
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'Could not generate a workout. Please try again.' })
  })
})
