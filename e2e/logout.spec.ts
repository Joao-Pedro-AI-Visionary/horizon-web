import { expect, test } from '@playwright/test'

// "Sair" on Fontes & Config always lands on the feed with no admin state,
// including a logout while the page is still loading. Needs
// E2E_ADMIN_USER / E2E_ADMIN_PASSWORD.
const USER = process.env.E2E_ADMIN_USER ?? ''
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByTestId('login-username').fill(USER)
  await page.getByTestId('login-password').fill(PASSWORD)
  await page.getByTestId('login-submit').click()
  await expect(page).toHaveURL(/\/sources$/)
  await expect(page.getByTestId('source-card').first()).toBeVisible()
}

async function expectLoggedOutOnFeed(page: import('@playwright/test').Page) {
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('login-link')).toBeVisible()
  await expect(page.getByTestId('source-card')).toHaveCount(0)
  await expect(page.getByTestId('admin-alerts')).toHaveCount(0)
  await expect(page.locator('[data-testid="nav-sources"], [data-testid="bnav-sources"]')).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('horizon.session'))).toBeNull()
}

test.beforeEach(() => {
  test.skip(!USER || !PASSWORD, 'set E2E_ADMIN_USER and E2E_ADMIN_PASSWORD')
})

test('Sair on Fontes & Config goes to the feed', async ({ page }) => {
  await login(page)
  await page.getByTestId('logout').click()
  await expectLoggedOutOnFeed(page)
})

test('Sair while Fontes & Config is still loading never shows the sources', async ({ page }) => {
  await login(page)
  await page.goto('/')
  // Hold the page's chunk so the logout lands mid-navigation.
  let release = () => {}
  const held = new Promise<void>((r) => (release = r))
  await page.route(/\/assets\/SourcesView-[^/]+\.js$/, async (route) => {
    await held
    await route.continue()
  })
  await page.reload()
  await expect(page.getByTestId('logout')).toBeVisible()
  // dispatchEvent: on mobile the feed cards overlap the floating bottom nav
  // for Playwright's hit test; the RouterLink handler is what matters here.
  await page.locator('[data-testid="nav-sources"]:visible, [data-testid="bnav-sources"]:visible').first().dispatchEvent('click')
  await page.getByTestId('logout').click()
  release()
  await page.waitForTimeout(500)
  await expectLoggedOutOnFeed(page)
})
