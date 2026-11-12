import { expect, request as pwRequest, test, type APIRequestContext } from '@playwright/test'
import { trackErrors } from './helpers.ts'

// Admin alerts badge against the real API. Creates a source whose feed is a
// 404, fetches it once so it fails (non-2xx), checks the badge, then deletes the source
// (its fetch runs go with it). Needs E2E_ADMIN_USER / E2E_ADMIN_PASSWORD.
const USER = process.env.E2E_ADMIN_USER ?? ''
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
const API = process.env.HORIZON_API_URL ?? 'http://localhost:8080'
const NAME = `E2E · fonte quebrada ${Date.now()}`

let api: APIRequestContext
let sourceId = 0

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({}, info) => {
  test.skip(!USER || !PASSWORD, 'set E2E_ADMIN_USER and E2E_ADMIN_PASSWORD')
  // One failing fetch per run: collections share a 10 min cooldown.
  test.skip(info.project.name !== 'desktop', 'needs a fresh collection; desktop only')
  test.setTimeout(12 * 60_000)
  const anon = await pwRequest.newContext({ baseURL: API })
  const login = await anon.post('/api/auth/login', { data: { username: USER, password: PASSWORD } })
  expect(login.status()).toBe(200)
  const { token } = await login.json()
  await anon.dispose()
  api = await pwRequest.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } })
  const created = await api.post('/api/sources', {
    data: { kind: 'rss', name: NAME, enabled: true, config: { url: 'https://lobste.rs/t/e2e-does-not-exist.rss', limit: 1 } },
  })
  expect(created.status(), await created.text()).toBe(201)
  sourceId = (await created.json()).id
  // Wait out the collection cooldown if one ran recently.
  for (let i = 0; i < 44; i++) {
    const r = await api.post(`/api/sources/${sourceId}/fetch`)
    if (r.status() !== 429) break
    await new Promise((res) => setTimeout(res, 15_000))
  }
  await expect
    .poll(async () => ((await (await api.get('/api/admin/alerts')).json()).alerts as { source_id?: number }[]).some((a) => a.source_id === sourceId), { timeout: 30_000 })
    .toBe(true)
})

test.afterAll(async () => {
  if (sourceId) await api.delete(`/api/sources/${sourceId}`)
  await api?.dispose()
})

test('public API refuses alerts and visitors get no badge', async ({ page, request }) => {
  expect((await request.get(`${API}/api/admin/alerts`)).status()).toBe(401)
  const t = trackErrors(page)
  const calls: string[] = []
  page.on('request', (r) => r.url().includes('/api/admin/') && calls.push(r.url()))
  await page.goto('/')
  await expect(page.getByTestId('open-item').first()).toBeVisible()
  await expect(page.getByTestId('login-link')).toBeVisible()
  await expect(page.getByTestId('admin-alerts')).toHaveCount(0)
  await expect(page.getByTestId('alerts-badge')).toHaveCount(0)
  expect(calls).toEqual([])
  t.assertClean()
})

test('after login the red badge counts errors and lists the failing source', async ({ page }) => {
  const t = trackErrors(page)
  await page.goto('/login')
  await page.getByTestId('login-username').fill(USER)
  await page.getByTestId('login-password').fill(PASSWORD)
  await page.getByTestId('login-submit').click()
  await expect(page).toHaveURL(/\/sources$/)

  const badge = page.getByTestId('alerts-badge')
  await expect(badge).toBeVisible()
  expect(Number(await page.getByTestId('alerts-count').textContent())).toBeGreaterThan(0)
  await expect(badge).toHaveAttribute('aria-expanded', 'false')
  await badge.click()
  await expect(badge).toHaveAttribute('aria-expanded', 'true')
  const panel = page.getByTestId('alerts-panel')
  await expect(panel).toBeVisible()
  const item = panel.getByTestId('alert-item').filter({ hasText: NAME })
  await expect(item).toContainText(/status \d{3}/)
  await expect(item.locator('time')).toContainText('BRT')
  // Optional: E2E_ALERTS_SHOT=/path/alerts.png saves the open panel.
  if (process.env.E2E_ALERTS_SHOT) await page.screenshot({ path: process.env.E2E_ALERTS_SHOT })
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(badge).toBeFocused()

  await badge.click()
  await item.getByTestId('alert-source-link').click()
  await expect(page).toHaveURL(new RegExp(`/sources#source-${sourceId}$`))
  await expect(page.locator(`#source-${sourceId}`)).toBeInViewport()

  await page.getByTestId('logout').click()
  await expect(page.getByTestId('admin-alerts')).toHaveCount(0)
  t.assertClean()
})
