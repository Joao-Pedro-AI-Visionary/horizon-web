import { describe, expect, it } from 'vitest'
import { applyPageMeta, buildPageMeta, truncateDescription } from './seo'
import { buildShareLinks, itemPermalink } from './share'

describe('SEO helpers & Share links', () => {
  it('builds item permalink and social share links', () => {
    const url = itemPermalink(42, 'https://horizon-web-eight.vercel.app/')
    expect(url).toBe('https://horizon-web-eight.vercel.app/items/42')

    const links = buildShareLinks('Go 1.25 lançado <hoje>', url)
    expect(links.x).toContain('https://twitter.com/intent/tweet?')
    expect(links.x).toContain(encodeURIComponent(url))
    expect(links.linkedin).toContain('https://www.linkedin.com/sharing/share-offsite/?')
    expect(links.linkedin).toContain(encodeURIComponent(url))
    expect(links.whatsapp).toContain('https://api.whatsapp.com/send?')
    expect(links.whatsapp).toContain(encodeURIComponent(url))
  })

  it('truncates long meta descriptions cleanly to 160 chars', () => {
    const long = 'A'.repeat(200)
    const truncated = truncateDescription(long)
    expect(truncated.length).toBeLessThanOrEqual(160)
    expect(truncated.endsWith('…')).toBe(true)
    expect(truncateDescription('   ')).toContain('Curadoria diária de tecnologia e engenharia')
  })

  it('builds canonical and OG metadata cleanly', () => {
    const meta = buildPageMeta(
      {
        title: 'Item 9 · Radar by JpDev',
        description: 'Análise técnica detalhada.',
        canonicalPath: '/items/9',
        ogType: 'article',
        ogImage: '/og/items/9.png',
      },
      'https://horizon-web-eight.vercel.app/',
    )
    expect(meta.canonical).toBe('https://horizon-web-eight.vercel.app/items/9')
    expect(meta.ogType).toBe('article')
    expect(meta.ogImage).toBe('https://horizon-web-eight.vercel.app/og/items/9.png')
  })

  it('writes document head tags when document is available', () => {
    const tags = new Map<string, Record<string, string>>()
    const fakeDoc = {
      title: '',
      head: {
        querySelector(selector: string) {
          const attrs = tags.get(selector)
          if (!attrs) return null
          return {
            setAttribute(k: string, v: string) {
              attrs[k] = v
            },
          }
        },
        appendChild(el: { attrs: Record<string, string>; tag: string }) {
          if (el.tag === 'link') {
            tags.set(`link[rel="${el.attrs.rel}"]`, el.attrs)
          } else if (el.attrs.name) {
            tags.set(`meta[name="${el.attrs.name}"]`, el.attrs)
          } else if (el.attrs.property) {
            tags.set(`meta[property="${el.attrs.property}"]`, el.attrs)
          }
        },
      },
      createElement(tag: string) {
        const attrs: Record<string, string> = {}
        return {
          tag,
          attrs,
          setAttribute(k: string, v: string) {
            attrs[k] = v
          },
        }
      },
    }

    const g = globalThis as { document?: unknown }
    const prev = g.document
    g.document = fakeDoc
    try {
      applyPageMeta({
        title: 'Item 9 · Radar by JpDev',
        description: 'Análise técnica detalhada.',
        canonicalPath: '/items/9',
        ogType: 'article',
        ogImage: '/og/items/9.png',
      })
      expect(fakeDoc.title).toBe('Item 9 · Radar by JpDev')
      expect(tags.get('meta[name="description"]')?.content).toBe('Análise técnica detalhada.')
      expect(tags.get('link[rel="canonical"]')?.href).toContain('/items/9')
      expect(tags.get('meta[property="og:image"]')?.content).toContain('/og/items/9.png')
      expect(tags.get('meta[name="twitter:image"]')?.content).toContain('/og/items/9.png')
    } finally {
      if (prev === undefined) delete g.document
      else g.document = prev
    }
  })
})
