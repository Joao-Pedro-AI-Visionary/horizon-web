import { expect, test } from '@playwright/test'
import { expectNoHorizontalOverflow, trackErrors } from './helpers.ts'

// The digest preview grows with its content: no fixed height, no scrollbar
// inside the frame, only the page scrolls. Needs at least one digest.
test('digest preview has no inner scroll and fits the viewport width', async ({ page }) => {
  const t = trackErrors(page)
  await page.goto('/digests')
  await expect(page.getByTestId('digest-item').first().or(page.getByTestId('digests-empty'))).toBeVisible()
  test.skip(await page.getByTestId('digests-empty').isVisible(), 'no digest to preview')
  const frame = page.getByTestId('digest-frame')
  await expect(frame).toBeVisible()
  await expect(page.frameLocator('[data-testid="digest-frame"]').locator('h1')).toBeVisible()
  await expect
    .poll(async () =>
      frame.evaluate((f: HTMLIFrameElement) => {
        const d = f.contentDocument!.documentElement
        return Math.abs(d.scrollHeight - f.clientHeight) <= 2 && d.scrollWidth <= f.clientWidth + 1
      }),
    )
    .toBe(true)
  // Light sage theme, not the old dark template.
  const bg = await frame.evaluate((f: HTMLIFrameElement) => getComputedStyle(f.contentDocument!.body).backgroundColor)
  expect(bg).toBe('rgb(238, 242, 238)')
  await expectNoHorizontalOverflow(page)
  t.assertClean()
})
