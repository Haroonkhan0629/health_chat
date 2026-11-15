import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppContext, Env } from '../../worker'
import { registerAuthAndIntegrationRoutes } from './http-routes'

const app = new Hono<AppContext>()
registerAuthAndIntegrationRoutes(app)
const env = { AUTH_WORKER_URL: 'https://auth.example.test' } as Env

afterEach(() => vi.unstubAllGlobals())

describe('social sign-in callback', () => {
  it('exchanges the code, sets the session cookie, and returns to the workout page', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sessionToken: 'test-session' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const response = await app.request('https://app.example.test/api/auth/oauth-complete?code=test-code', {}, env)
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('https://app.example.test/')
    expect(response.headers.get('Set-Cookie')).toContain('test-session')
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly')
    expect(response.headers.get('Set-Cookie')).toContain('Secure')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('returns to the workout page without setting a session when exchange fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))
    const response = await app.request('https://app.example.test/api/auth/oauth-complete?code=bad-code', {}, env)
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('https://app.example.test/')
    expect(response.headers.get('Set-Cookie')).toBeNull()
  })
})
