import { expect, test } from '@playwright/test'
import { trackErrors } from './helpers.ts'

// Admin login against the real API. Needs E2E_ADMIN_USER and
// E2E_ADMIN_PASSWORD (never commit them); skipped otherwise. Uses one wrong
// attempt, well under the 5-per-minute limit.
const USER = process.env.E2E_ADMIN_USER ?? ''
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''

const adminOnly = ['source-new', 'source-actions', 'source-toggle', 'settings-form', 'source-fetch-note', 'run-pipeline', 'generate-digest', 'logout', 'sources-logout']

async function expectNoAdminUI(page: import('@playwright/test').Page) {
  for (const id of adminOnly) await expect(page.getByTestId(id), id).toHaveCount(0)
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
  await expect(page.getByText(/HORIZON_ADMIN_TOKEN|token de admin/i)).toHaveCount(0)
}

test('visitors get only Feed, Digests and Métricas; config redirects to /login', async ({ page }) => {
  const t = trackErrors(page)
  await page.goto('/')
  await expect(page.getByTestId('open-item').first()).toBeVisible()
  await expectNoAdminUI(page)
  await expect(page.locator('[data-testid="nav-sources"], [data-testid="bnav-sources"]')).toHaveCount(0)
  for (const name of ['feed', 'digests', 'metrics']) {
    await expect(page.locator(`[data-testid="nav-${name}"], [data-testid="bnav-${name}"]`).first()).toBeAttached()
  }
  await expect(page.getByTestId('login-link')).toBeVisible()

  await page.goto('/sources')
  await expect(page).toHaveURL(/\/login\?next=(%2F|\/)sources$/)
  await expect(page.getByTestId('login-form')).toBeVisible()
  await expect(page.getByTestId('source-card')).toHaveCount(0)
  await expect(page.getByText('Digest e nota de corte')).toHaveCount(0)
  t.assertClean()
})

test('wrong password fails, right one shows admin controls, Sair hides them', async ({ page }, info) => {
  test.skip(!USER || !PASSWORD, 'set E2E_ADMIN_USER and E2E_ADMIN_PASSWORD')
  test.skip(info.project.name !== 'desktop' && info.project.name !== 'mobile', 'login rate limit: run on two viewports')
  const t = trackErrors(page, [401])
  await page.goto('/')
  await page.getByTestId('login-link').click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByTestId('login-username').fill(USER)
  await page.getByTestId('login-password').fill('definitely-wrong-password')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('login-error')).toHaveText('Usuário ou senha inválidos.')
  await expect(page.getByTestId('login-password')).toHaveValue('')

  await page.getByTestId('login-password').fill(PASSWORD)
  await page.getByTestId('login-submit').click()
  await expect(page).toHaveURL(/\/sources$/)
  await expect(page.locator('[data-testid="nav-sources"]:visible, [data-testid="bnav-sources"]:visible')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Digest e nota de corte' })).toBeVisible()
  await expect(page.getByTestId('source-new')).toBeVisible()
  await expect(page.getByTestId('settings-form')).toBeVisible()
  await expect(page.getByTestId('source-actions').first()).toBeVisible()
  await expect(page.getByTestId('logout')).toBeVisible()
  await expect(page.getByTestId('source-actions').first()).toBeVisible()

  // The session survives a reload (sessionStorage) and unlocks the feed button.
  await page.reload()
  await expect(page.getByTestId('source-new')).toBeVisible()
  await page.goto('/')
  await expect(page.getByTestId('run-pipeline')).toBeVisible()

  await page.goto('/sources')
  await page.getByTestId('logout').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('login-link')).toBeVisible()
  await expectNoAdminUI(page)
  await expect(page.locator('[data-testid="nav-sources"], [data-testid="bnav-sources"]')).toHaveCount(0)
  await page.goto('/sources')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByTestId('source-card')).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('horizon.session'))).toBeNull()
  t.assertClean()
})
