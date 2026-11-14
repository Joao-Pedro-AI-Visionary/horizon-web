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

    const blocks = [...rendered.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
      (m) => JSON.parse(m[1]) as Record<string, any>,
    )
    const ld = blocks.find((b) => b['@type'] === 'NewsArticle')
    if (!ld) {
      throw new Error('missing NewsArticle JSON-LD')
    }
    expect(ld['@type']).toBe('NewsArticle')
    expect(ld.headline).toBe('Benchmarks <script>alert(1)</script> & Rust')
    expect(ld.description).toBe('Resumo curto e objetivo para motores de busca.')
    expect(ld.inLanguage).toBe('pt-BR')
    expect(ld.url).toBe('https://horizon-web-eight.vercel.app/items/77')
    expect(ld.mainEntityOfPage).toEqual({
      '@type': 'WebPage',
      '@id': 'https://horizon-web-eight.vercel.app/items/77',
    })
    expect(ld.image).toEqual(['https://horizon-web-eight.vercel.app/og/items/77.png'])
    expect(ld.datePublished).toBe('2026-11-14T10:00:00Z')
    expect(ld.dateModified).toBe('2026-11-14T10:00:00Z')
    expect(ld.isBasedOn).toBe('https://example.com/post')
    expect(ld.citation).toEqual({
      '@type': 'CreativeWork',
      name: 'Hacker News',
      url: 'https://example.com/post',
    })
    expect(ld.publisher.name).toBe('Radar by JpDev')
    expect(ld.publisher.alternateName).toBe('Horizon by JpDev')
    expect(ld.publisher.logo.url).toBe('https://github.com/Joao-Pedro-AI-Visionary.png')
    expect(ld.author['@type']).toBe('Organization')
    const rawLd = [...rendered.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((m) => m[1])
      .find((block) => block.includes('NewsArticle'))
    if (!rawLd) {
      throw new Error('missing raw NewsArticle JSON-LD')
    }
    expect(rawLd).toContain('\\u003cscript\\u003e')
    expect(rawLd).not.toContain('<script>')

    const unsafeRendered = renderItemHtml(template, {
      id: 78,
      title: 'Unsafe URL check',
      url: 'javascript:alert(1)',
    })
    expect(unsafeRendered).not.toContain('javascript:alert(1)')
  })

  it('ships valid public robots.txt allowing crawlers and referencing sitemap', () => {
    const robots = readFileSync(resolve(process.cwd(), 'public', 'robots.txt'), 'utf8')
    expect(robots).toMatch(/User-agent:\s*\*/i)
    expect(robots).toMatch(/Allow:\s*\//i)
    expect(robots).toMatch(/Sitemap:\s*https?:\/\/.+\/sitemap\.xml/i)
    expect(robots).toContain('Content-Signal: search=yes, ai-input=yes, ai-train=yes')
    expect(robots).toContain('Disallow: /api/admin')
    expect(robots).toContain('Disallow: /api/pipeline')
    expect(robots).toContain('Disallow: /api/newsletter/send')
    for (const bot of [
      'OAI-SearchBot',
      'ChatGPT-User',
      'GPTBot',
      'Claude-SearchBot',
      'Claude-User',
      'ClaudeBot',
      'PerplexityBot',
      'Perplexity-User',
      'Google-Extended',
      'Applebot-Extended',
    ]) {
      expect(robots).toContain(`User-agent: ${bot}`)
    }
  })

  it('ships llms.txt in the llmstxt.org format', () => {
    const llms = readFileSync(resolve(process.cwd(), 'public', 'llms.txt'), 'utf8')
    expect(llms.startsWith('# Radar by JpDev')).toBe(true)
    expect(llms).toContain('https://horizon-web-eight.vercel.app/rss.xml')
    expect(llms).toContain('https://horizon-web-eight.vercel.app/sitemap.xml')
    expect(llms).toContain('https://horizon-web-eight.vercel.app/llms-full.txt')
    expect(llms).toContain('https://horizon-web-eight.vercel.app/digests')
  })

  it('embeds WebSite and Organization JSON-LD with SearchAction on the home document', () => {
    const home = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    const match = home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    expect(match).toBeTruthy()
    const ld = JSON.parse(match![1]) as Record<string, any>
    const types = (ld['@graph'] as any[]).map((node) => node['@type'])
    expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite']))
    const site = (ld['@graph'] as any[]).find((node) => node['@type'] === 'WebSite')
    if (!site) {
      throw new Error('missing WebSite JSON-LD')
    }
    expect(site.potentialAction['@type']).toBe('SearchAction')
    expect(site.potentialAction.target.urlTemplate).toBe(
      'https://horizon-web-eight.vercel.app/?q={search_term_string}',
    )
    expect(site.inLanguage).toBe('pt-BR')
  })
})
