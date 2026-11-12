import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalOverflow, revealAll, trackErrors } from './helpers.ts'

// The news-app redesign (Dribbble "Modern News App UI Design" by Imran Jakir /
// Kites Design) against the real API: category chips, search, the "Em alta"
// deck, the article screen, the floating mobile nav and the responsive widths.

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768

async function apiFeed(page: Page, query: string) {
  const res = await page.request.get(`/api/feed?${query}`)
  expect(res.ok()).toBe(true)
  return (await res.json()) as { total: number; items: { item_id: number; score: number; tags: string[] | null; title: string }[] | null }
}

test.describe('news feed', () => {
  test('chips filter by real tags; "Todas" clears', async ({ page }) => {
    const t = trackErrors(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Central de notícias' })).toBeVisible()
    await expect(page.getByTestId('chip-all')).toHaveAttribute('aria-pressed', 'true')
    const chip = page.getByTestId('chip-tag').first()
    await expect(chip).toBeVisible()
    const tag = (await chip.getAttribute('data-tag'))!
    const res = page.waitForResponse((r) => r.url().includes('/api/feed?') && r.url().includes('tag=') && r.url().includes('page_size=12'))
    await chip.click()
    expect((await res).status()).toBe(200)
    await expect(page).toHaveURL(/tag=/)
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('chip-all')).toHaveAttribute('aria-pressed', 'false')
    // The page shows exactly what the API returns for that tag.
    const api = await apiFeed(page, `period=all&sort=recent&page=1&page_size=12&tag=${encodeURIComponent(tag)}`)
    expect(api.total).toBeGreaterThan(0)
    await expect(page.getByTestId('feed-total').locator('[data-value]')).toHaveAttribute('data-value', String(api.total))
    await expect(page.getByTestId('feed-card')).toHaveCount(api.items!.length)
    for (const it of api.items!) expect(it.tags ?? []).toContain(tag)
    // Pressing it again, or "Todas", clears the filter.
    await page.getByTestId('chip-all').click()
    await expect(page).not.toHaveURL(/tag=/)
    await expect(page.getByTestId('chip-all')).toHaveAttribute('aria-pressed', 'true')
    t.assertClean()
  })

  test('search button opens a real search; Esc closes and clears it', async ({ page }) => {
    const t = trackErrors(page)
    await page.goto('/')
    await expect(page.getByTestId('feed-card').first()).toBeVisible()
    const first = await apiFeed(page, 'period=all&sort=recent&page=1&page_size=1')
    const word = first.items![0]!.title.split(/\s+/).find((w) => /^[\p{L}\d]{5,}$/u.test(w)) ?? first.items![0]!.title.split(/\s+/)[0]!
    await page.getByTestId('open-search').click()
    await expect(page.getByTestId('open-search')).toHaveAttribute('aria-expanded', 'true')
    const search = page.getByTestId('filter-search')
    await expect(search).toBeFocused()
    await search.fill(word)
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(word)
    const api = await apiFeed(page, `period=all&sort=recent&page=1&page_size=12&q=${encodeURIComponent(word)}`)
    expect(api.total).toBeGreaterThan(0)
    await expect(page.getByTestId('feed-total').locator('[data-value]')).toHaveAttribute('data-value', String(api.total))
    await search.press('Escape')
    await expect(page).not.toHaveURL(/q=/)
    await expect(page.getByTestId('filter-search')).toHaveCount(0)
    t.assertClean()
  })

  test('"Em alta" deck: top scores, rotates, "Ver todas" sorts the list by score', async ({ page }) => {
    const t = trackErrors(page)
    await page.goto('/')
    const deck = page.getByTestId('popular-deck')
    await expect(deck).toBeVisible()
    const top = await apiFeed(page, 'period=all&sort=score&page=1&page_size=5')
    const ids = top.items!.map((i) => String(i.item_id))
    const front = page.getByTestId('popular-card')
    await expect(front).toHaveAttribute('data-item-id', ids[0]!)
    if (ids.length > 1) {
      await page.getByTestId('popular-next').click()
      await expect(front).toHaveAttribute('data-item-id', ids[1]!)
      await expect(page.getByTestId('popular-position')).toContainText(`2 de ${ids.length}`)
      await page.getByTestId('popular-prev').click()
      await expect(front).toHaveAttribute('data-item-id', ids[0]!)
    }
    await page.getByTestId('popular-see-all').click()
    await expect(page).toHaveURL(/sort=score/)
    await expect(page.getByTestId('list-heading')).toHaveText('Maior nota')
    await expect(page.getByTestId('list-heading')).toBeFocused()
    await expect(page.getByTestId('feed-card').first()).toHaveAttribute('data-item-id', ids[0]!)
    t.assertClean()
  })

  test('card opens the article screen with real fields', async ({ page }) => {
    const t = trackErrors(page)
    await page.goto('/')
    const card = page.getByTestId('feed-card').first()
    const id = await card.getAttribute('data-item-id')
    const title = await card.getByTestId('open-item').innerText()
    await card.getByTestId('open-item').click()
    await expect(page).toHaveURL(new RegExp(`/items/${id}$`))
    const detail = await (await page.request.get(`/api/items/${id}`)).json()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    await expect(page.getByTestId('item-reason')).toHaveText(detail.score_reason || 'A notícia ainda não recebeu nota do LLM.')
    await expect(page.getByTestId('item-original')).toHaveAttribute('href', detail.url)
    await expect(page.getByTestId('item-share')).toBeEnabled()
    await expectNoHorizontalOverflow(page)
    await page.getByTestId('back').click()
    await expect(page.getByTestId('feed-list')).toBeVisible()
    t.assertClean()
  })

  test('navigation: floating pill on mobile, top pill nav on md+', async ({ page }) => {
    const t = trackErrors(page)
    await page.goto('/')
    const mobile = isMobile(page)
    await expect(page.getByTestId('bnav-feed')).toBeVisible({ visible: mobile })
    await expect(page.getByTestId('nav-feed')).toBeVisible({ visible: !mobile })
    if (mobile) {
      // The active round item shows its label; the others only an icon.
      await expect(page.getByTestId('bnav-feed')).toHaveAttribute('aria-current', 'page')
      await expect(page.getByTestId('bnav-feed')).toContainText('Feed')
      await expect(page.getByTestId('bnav-metrics')).toHaveAttribute('aria-label', 'Métricas')
      await page.getByTestId('bnav-metrics').click()
      await expect(page).toHaveURL(/\/metrics$/)
      await expect(page.getByTestId('bnav-metrics')).toContainText('Métricas')
      for (const n of ['feed', 'digests', 'sources', 'metrics']) {
        const box = (await page.getByTestId(`bnav-${n}`).boundingBox())!
        expect(box.height).toBeGreaterThanOrEqual(48) // Fitts: 48px touch targets
      }
    }
    t.assertClean()
  })
})

test('sources: a skipped fetch shows "pulada" in a neutral colour', async ({ page }) => {
  const t = trackErrors(page)
  await page.goto('/sources')
  await expect(page.getByTestId('source-card').first()).toBeVisible()
  const sources = (await (await page.request.get('/api/sources')).json()).sources as { name: string; last_fetch: { status: string } | null }[]
  for (const s of sources) {
    const status = page.getByTestId('source-card').filter({ hasText: s.name }).first().getByTestId('source-status')
    if (s.last_fetch?.status === 'skipped') {
      await expect(status).toContainText('pulada')
      await expect(status).not.toHaveClass(/text-danger/)
    } else if (s.last_fetch?.status === 'ok') {
      await expect(status).toContainText('ok')
    }
  }
  t.assertClean()
})

// 375 / 768 / 1280: no horizontal scroll and a screenshot of feed and article
// per width (docs/screenshots/news-<width>-<screen>.png). Desktop project only,
// since it sets its own viewports.
test('responsive widths: 375, 768 and 1280', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'sets its own viewports')
  const t = trackErrors(page)
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 })
    await page.goto('/')
    await expect(page.getByTestId('feed-card').first()).toBeVisible()
    await expect(page.getByTestId('popular-card')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: `docs/screenshots/news-${width}-feed.png` })
    await revealAll(page)
    await page.screenshot({ path: `docs/screenshots/news-${width}-feed-full.png`, fullPage: true })
    await page.getByTestId('feed-card').first().getByTestId('open-item').click()
    await expect(page.getByTestId('item-detail')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: `docs/screenshots/news-${width}-article.png`, fullPage: true })
  }
  t.assertClean()
})
