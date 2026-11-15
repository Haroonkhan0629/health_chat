import { test, expect } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

/**
 * Smoke tests covering both page kinds:
 *   - '/'      → landing page with auth but no records WebSocket on load.
 *   - '/home'  → a dynamic page (under src/pages/(app)/): the providers mount,
 *                the nav shell renders, and the records WebSocket connects.
 *
 */

/** Wait for the React app shell (present on every page). */
async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 15000 })
}

test.describe('Smoke tests', () => {
  test('static landing loads without JS errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/')
    await waitForApp(page)
    await expect(page.getByTestId('static-landing')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('landing carries one title, one description, one canonical', async ({ page }) => {
    // <Seo> (src/pages/index.tsx, values from src/seo.ts) hoists these into
    // <head>. Exactly one of each: index.html ships no static description or
    // canonical, because React 19 would not dedupe against them on mount.
    await page.goto('/')
    await expect(page.getByTestId('static-landing')).toBeVisible()
    await expect(page).toHaveTitle(/\S/)
    expect(await page.locator('head meta[name="description"]').count()).toBe(1)
    expect(await page.locator('head link[rel="canonical"]').count()).toBe(1)
  })

  test('landing opens no records websocket', async ({ page }) => {
    const offenders: string[] = []
    // Only the DO room route counts — vite's own HMR socket is a dev artifact.
    page.on('websocket', (ws) => {
      if (new URL(ws.url()).pathname.startsWith('/ws/')) offenders.push(`ws: ${ws.url()}`)
    })
    await page.goto('/')
    await expect(page.getByTestId('static-landing')).toBeVisible()
    await page.waitForTimeout(1500)
    expect(offenders).toEqual([])
  })

  test('signed-out landing shows sign-in instead of the search form', async ({ page }) => {
    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }))
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Sign in with DeepSpace' })).toBeVisible()
    await expect(page.getByLabel('Body part or exercise goal')).toHaveCount(0)
    await page.getByRole('button', { name: 'Sign in with DeepSpace' }).click()
    await expect(page.getByText('Sign in to Health Chat')).toBeVisible()
  })

  test('sign-in and sign-out switch the landing page state', async ({ page }) => {
    let signedIn = false
    const user = { id: 'test-user', name: 'Test User', email: 'test@example.test' }
    const session = { id: 'test-session', userId: 'test-user', expiresAt: '2099-01-01T00:00:00.000Z' }
    await page.route('**/api/auth/get-session', (route) =>
      route.fulfill({ json: signedIn ? { user, session } : null }))
    await page.route('**/api/auth/sign-in/email', (route) => {
      signedIn = true
      return route.fulfill({ json: { user, token: 'mock-session', redirect: false } })
    })
    await page.route('**/api/auth/sign-out', (route) => {
      signedIn = false
      return route.fulfill({ json: { success: true } })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Sign in with DeepSpace' }).click()
    await page.getByTestId('auth-email-toggle').click()
    await page.getByPlaceholder('Email').fill('test@example.test')
    await page.getByPlaceholder('Password').fill('test-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByLabel('Body part or exercise goal')).toBeVisible()
    await expect(page.getByTestId('auth-overlay')).toHaveCount(0)
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Sign in with DeepSpace' })).toBeVisible()
    await expect(page.getByLabel('Body part or exercise goal')).toHaveCount(0)
    await expect(page.getByTestId('auth-overlay')).toHaveCount(0)
  })

  test('workout form displays a plan and an invalid-input error', async ({ page }) => {
    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: {
      user: { id: 'test-user', name: 'Test User', email: 'test@example.test' },
      session: { id: 'test-session', userId: 'test-user', expiresAt: '2099-01-01T00:00:00.000Z' },
    } }))
    await page.route('**/api/auth/token', (route) => route.fulfill({ json: { token: 'test-token' } }))
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      .map((day, i) => ({
        day, title: i === 0 ? 'Chest' : 'Rest', note: 'Take your time.',
        exercises: i === 0 ? [{ id: 'barbell-bench-press', sets: '3', reps: '8-12' }] : [],
      }))
    await page.route('**/api/workout', async (route) => {
      expect(route.request().headers().authorization).toBe('Bearer test-token')
      const body = route.request().postDataJSON()
      if (body.input === 'chest') {
        await route.fulfill({ json: { valid: true, days } })
      } else {
        await route.fulfill({ status: 422, json: { error: 'Invalid input: please enter a muscle group.' } })
      }
    })
    await page.goto('/')
    await page.getByLabel('Body part or exercise goal').fill('chest')
    await page.getByRole('button', { name: /create my plan/i }).click()
    await expect(page.getByRole('heading', { name: 'Your week, mapped out.' })).toBeVisible()
    await expect(page.getByText('Barbell Bench Press')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Illustration of Barbell Bench Press' }))
      .toHaveAttribute('src', '/images/exercises/barbell-bench-press.jpg')
    await page.getByLabel('Body part or exercise goal').fill('how do i look bigger')
    await page.getByRole('button', { name: /create my plan/i }).click()
    await expect(page.getByRole('alert')).toContainText('Invalid input')
    await expect(page.getByText('Barbell Bench Press')).toHaveCount(0)
  })

  test('dynamic app boundary mounts on /home', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByTestId('app-navigation')).toBeVisible({ timeout: 15000 })
  })

  test('sign-in button visible when logged out', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByTestId('nav-sign-in-button')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('nav-user-name')).toHaveCount(0)
  })

  test('unknown route shows 404', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz')
    await waitForApp(page)
    await expect(page.locator('text=404')).toBeVisible()
  })
})
