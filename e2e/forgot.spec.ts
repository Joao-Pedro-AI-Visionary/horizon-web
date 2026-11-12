import { expect, test } from '@playwright/test'
import { trackErrors } from './helpers.ts'

// "Esqueci minha senha". The API calls are mocked (no e-mail per run) unless
// E2E_REAL_FORGOT=1, which sends one real e-mail from the forgot page.
const REAL = process.env.E2E_REAL_FORGOT === '1'

test('login links to forgot, which sends with one button and a generic reply', async ({ page }) => {
  const t = trackErrors(page)
  let body = ''
  if (!REAL) {
    await page.route('**/api/auth/forgot', async (r) => {
      body = r.request().postData() ?? ''
      await r.fulfill({ json: { ok: true, message: 'Se o e-mail de recuperação estiver configurado, o link chega em instantes.' } })
    })
  }
  await page.goto('/login')
  await page.getByTestId('forgot-link').click()
  await expect(page).toHaveURL(/\/forgot$/)
  await expect(page.locator('input')).toHaveCount(0) // no recipient field
  const waitReply = page.waitForResponse((r) => r.url().includes('/api/auth/forgot'))
  await page.getByRole('button', { name: 'Enviar link para meu e-mail' }).click()
  expect((await waitReply).status()).toBe(200)
  await expect(page.getByTestId('forgot-sent')).toHaveText(/link chega em instantes/)
  if (!REAL) expect(body).toBe('{}')
  t.assertClean()
})

test('reset page checks length and confirmation, then goes to /login', async ({ page }) => {
  test.skip(REAL, 'mocked flow only')
  const t = trackErrors(page)
  let sent: Record<string, string> = {}
  await page.route('**/api/auth/reset', async (r) => {
    sent = JSON.parse(r.request().postData() ?? '{}')
    await r.fulfill({ json: { ok: true } })
  })
  await page.goto('/reset?token=tok-123')
  await expect(page).toHaveURL(/\/reset$/) // token dropped from the address bar
  await page.getByTestId('reset-password').fill('curta')
  await page.getByTestId('reset-confirm').fill('curta')
  await page.getByTestId('reset-submit').click()
  await expect(page.getByTestId('reset-error')).toContainText('pelo menos 10')
  await page.getByTestId('reset-password').fill('uma senha bem longa')
  await page.getByTestId('reset-confirm').fill('outra senha longa')
  await page.getByTestId('reset-submit').click()
  await expect(page.getByTestId('reset-error')).toHaveText('As senhas não conferem.')
  await page.getByTestId('reset-confirm').fill('uma senha bem longa')
  await page.getByTestId('reset-submit').click()
  await expect(page).toHaveURL(/\/login$/)
  expect(sent).toEqual({ token: 'tok-123', new_password: 'uma senha bem longa' })
  t.assertClean()
})

test('an expired link shows the server message', async ({ page }) => {
  test.skip(REAL, 'mocked flow only')
  const t = trackErrors(page, [400])
  await page.route('**/api/auth/reset', (r) => r.fulfill({ status: 400, json: { error: 'link inválido ou expirado' } }))
  await page.goto('/reset?token=old')
  await page.getByTestId('reset-password').fill('uma senha bem longa')
  await page.getByTestId('reset-confirm').fill('uma senha bem longa')
  await page.getByTestId('reset-submit').click()
  await expect(page.getByTestId('reset-error')).toHaveText('Link inválido ou expirado.')
  await expect(page).toHaveURL(/\/reset$/)
  t.assertClean()
})
