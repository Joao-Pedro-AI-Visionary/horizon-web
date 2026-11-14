import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderItemHtml } from './item-page.ts'

describe('Vercel SEO SSR & static crawler files', () => {
  it('renders item SSR HTML with escaped OG, Twitter, canonical, and JSON-LD', () => {
    const template = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    const rendered = renderItemHtml(
      template,
      {
        id: 77,
        title: 'Benchmarks <script>alert(1)</script> & Rust',
        summary: 'Resumo curto e objetivo para motores de busca.',
        score: 8.6,
        source_name: 'Hacker News',
        url: 'https://example.com/post',
        published_at: '2026-11-14T10:00:00Z',
      },
      'https://horizon-web-eight.vercel.app',
    )

    expect(rendered).toContain('<title>Benchmarks &lt;script&gt;alert(1)&lt;/script&gt; &amp; Rust · Radar by JpDev</title>')
    expect(rendered).toContain('<link rel="canonical" href="https://horizon-web-eight.vercel.app/items/77" />')
    expect(rendered).toContain('<meta property="og:type" content="article" />')
    expect(rendered).toContain('<meta property="og:image" content="https://horizon-web-eight.vercel.app/og/items/77.png" />')
    expect(rendered).toContain('<meta name="twitter:image" content="https://horizon-web-eight.vercel.app/og/items/77.png" />')
    expect(rendered).toContain('application/ld+json')
    expect(rendered).toContain('\\u003cscript\\u003e')
    expect(rendered).not.toContain('<h1>Benchmarks <script>')
    expect(rendered).toContain('<h1>Benchmarks &lt;script&gt;alert(1)&lt;/script&gt; &amp; Rust</h1>')
  })

  it('ships valid public robots.txt allowing crawlers and referencing sitemap', () => {
    const robots = readFileSync(resolve(process.cwd(), 'public', 'robots.txt'), 'utf8')
    expect(robots).toMatch(/User-agent:\s*\*/i)
    expect(robots).toMatch(/Allow:\s*\//i)
    expect(robots).toMatch(/Sitemap:\s*https?:\/\/.+\/sitemap\.xml/i)
  })
})
