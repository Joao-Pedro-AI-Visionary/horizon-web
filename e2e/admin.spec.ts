import { expect, test } from '@playwright/test'
import { trackErrors } from './helpers.ts'

// Admin unlock. The API decides: POST /api/auth/check answers 204 for a valid
// token (or when writes are open in local dev) and 401 otherwise. These tests
// stub that one route so they run the same against a dev or a protected API.

const TOKEN = 'e2e-admin-token'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"mode":"token"}' }))
  await page.route('**/api/auth/check', (route) => {
    const ok = route.request().headers()['authorization'] === `Bearer ${TOKEN}`
    return route.fulfill(ok ? { status: 204 } : { status: 401, contentType: 'application/json', body: '{"error":"admin token required"}' })
  })
})

test('read-only visitors see sources and settings but no write controls', async ({ page }) => {
  const t = trackErrors(page)
  await page.goto('/')
  await expect(page.getByTestId('feed-card').first()).toBeVisible()
  await expect(page.getByTestId('run-pipeline')).toHaveCount(0)
  await page.goto('/sources')
  await expect(page.getByTestId('admin-state')).toHaveText('Somente leitura')
  await expect(page.getByTestId('source-card').first()).toBeVisible()
  await expect(page.getByTestId('source-new')).toHaveCount(0)
  await expect(page.getByTestId('source-actions')).toHaveCount(0)
  await expect(page.getByTestId('source-toggle').first()).toBeDisabled()
  await expect(page.getByTestId('settings-threshold')).toBeDisabled()
  await expect(page.getByTestId('settings-cron')).toBeDisabled()
  await expect(page.getByTestId('settings-readonly')).toBeVisible()
  // The header CTA leads to the token field.
  await page.getByTestId('source-unlock-cta').click()
  await expect(page.getByTestId('admin-token')).toBeFocused()
  t.assertClean()
})

test('a wrong token is refused, the right one unlocks and survives a reload, lock clears it', async ({ page }) => {
  const t = trackErrors(page, [401])
  await page.goto('/sources')
  await expect(page.getByTestId('admin-state')).toHaveText('Somente leitura')
  await page.getByTestId('admin-token').fill('wrong')
  await page.getByTestId('admin-submit').click()
  await expect(page.getByTestId('admin-error')).toContainText('Token inválido')
  await expect(page.getByTestId('admin-token')).toHaveAttribute('aria-invalid', 'true')

  await page.getByTestId('admin-token-toggle').click()
  await expect(page.getByTestId('admin-token')).toHaveAttribute('type', 'text')
  await page.getByTestId('admin-token').fill(TOKEN)
  await page.getByTestId('admin-submit').click()
  await expect(page.getByTestId('admin-state')).toHaveText('Edição liberada')
  await expect(page.getByTestId('source-new')).toBeVisible()
  await expect(page.getByTestId('settings-save')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('admin-state')).toHaveText('Edição liberada')
  expect(await page.evaluate(() => localStorage.getItem('horizon.adminToken'))).toBe(TOKEN)

  await page.getByTestId('admin-lock').click()
  await expect(page.getByTestId('admin-state')).toHaveText('Somente leitura')
  expect(await page.evaluate(() => localStorage.getItem('horizon.adminToken'))).toBeNull()
  t.assertClean()
})

test('a stored token the API refuses locks the page again', async ({ page }) => {
  const t = trackErrors(page, [401])
  await page.addInitScript(() => localStorage.setItem('horizon.adminToken', 'revoked'))
  await page.goto('/sources')
  await expect(page.getByTestId('admin-expired')).toBeVisible()
  await expect(page.getByTestId('admin-state')).toHaveText('Somente leitura')
  t.assertClean()
})
