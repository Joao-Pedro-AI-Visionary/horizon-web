import { describe, expect, it } from 'vitest'
import { resolveUpstreamPath } from './seo-proxy.ts'

describe('SEO proxy path resolution', () => {
  it('resolves valid OG, sitemap and RSS proxy targets and rejects invalid inputs', () => {
    expect(resolveUpstreamPath('og', '42')).toEqual({
      path: '/api/og/items/42.png',
      defaultContentType: 'image/png',
    })
    expect(resolveUpstreamPath('og', 'abc')).toBeNull()
    expect(resolveUpstreamPath('og', '0')).toBeNull()
    expect(resolveUpstreamPath('sitemap', null)?.path).toBe('/api/sitemap.xml')
    expect(resolveUpstreamPath('rss-feed', null)?.path).toBe('/api/rss/feed.xml')
    expect(resolveUpstreamPath('rss-digests', null)?.path).toBe('/api/rss/digests.xml')
    expect(resolveUpstreamPath('unknown', null)).toBeNull()
  })
})
