import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'

export interface ItemPageData {
  id: number
  title: string
  summary?: string
  score_reason?: string
  score?: number | null
  url?: string
  source_name?: string
  author?: string
  published_at?: string | null
  fetched_at?: string
  tags?: string[] | null
}

const DEFAULT_ORIGIN = 'https://horizon-web-eight.vercel.app'
const DEFAULT_API = 'https://horizon-api-bzpg.onrender.com'
const DEFAULT_DESC = 'Curadoria diária de tecnologia e engenharia pontuada por IA, com digest diário e tendências.'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

function truncateDesc(raw: string): string {
  const clean = raw.replace(/\s+/g, ' ').trim()
  if (!clean) return DEFAULT_DESC
  return clean.length > 160 ? `${clean.slice(0, 157).trimEnd()}…` : clean
}

function replaceTag(html: string, pattern: RegExp, replacement: string): string {
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', `    ${replacement}\n  </head>`)
}

function safeHttpUrl(raw?: string): string {
  if (!raw) return ''
  try {
    const parsed = new URL(raw.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : ''
  } catch {
    return ''
  }
}

function requestOrigin(req: IncomingMessage): string {
  const configured = process.env.PUBLIC_SITE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  const rawHost = req.headers['x-forwarded-host'] ?? req.headers.host
  const host = (Array.isArray(rawHost) ? rawHost[0] : rawHost)?.split(',')[0]?.trim()
  if (!host || !/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host)) return DEFAULT_ORIGIN
  const rawProto = req.headers['x-forwarded-proto']
  const protoCand = (Array.isArray(rawProto) ? rawProto[0] : rawProto)?.split(',')[0]?.trim().toLowerCase()
  const proto = protoCand === 'http' || protoCand === 'https' ? protoCand : 'https'
  return `${proto}://${host}`.replace(/\/+$/, '')
}

function apiBase(): string {
  return (process.env.HORIZON_API_URL || process.env.VITE_API_URL || DEFAULT_API).replace(/\/+$/, '')
}

async function loadTemplateHtml(): Promise<string> {
  const candidates = [
    resolve(process.cwd(), 'dist', 'index.html'),
    resolve(process.cwd(), 'index.html'),
  ]
  for (const filePath of candidates) {
    try {
      return await readFile(filePath, 'utf8')
    } catch {
      // Try next candidate
    }
  }
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="description" content="${DEFAULT_DESC}" />
    <link rel="canonical" href="${DEFAULT_ORIGIN}/" />
    <title>Radar by JpDev</title>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`
}

export function renderItemHtml(templateHtml: string, item: ItemPageData, origin = DEFAULT_ORIGIN): string {
  const cleanOrigin = origin.replace(/\/+$/, '')
  const canonical = `${cleanOrigin}/items/${item.id}`
  const ogImage = `${cleanOrigin}/og/items/${item.id}.png`
  const titleText = `${item.title} · Radar by JpDev`
  const desc = truncateDesc(item.summary || item.score_reason || item.title)

  let html = templateHtml
  html = replaceTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(titleText)}</title>`)
  html = replaceTag(html, /<meta\s+name="description"[\s\S]*?\/>/i, `<meta name="description" content="${escapeHtml(desc)}" />`)
  html = replaceTag(html, /<link\s+rel="canonical"[\s\S]*?\/>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`)
  html = replaceTag(html, /<meta\s+property="og:type"[\s\S]*?\/>/i, '<meta property="og:type" content="article" />')
  html = replaceTag(html, /<meta\s+property="og:title"[\s\S]*?\/>/i, `<meta property="og:title" content="${escapeHtml(titleText)}" />`)
  html = replaceTag(html, /<meta\s+property="og:description"[\s\S]*?\/>/i, `<meta property="og:description" content="${escapeHtml(desc)}" />`)
  html = replaceTag(html, /<meta\s+property="og:image"[\s\S]*?\/>/i, `<meta property="og:image" content="${escapeHtml(ogImage)}" />`)
  html = replaceTag(html, /<meta\s+property="og:url"[\s\S]*?\/>/i, `<meta property="og:url" content="${escapeHtml(canonical)}" />`)
  html = replaceTag(html, /<meta\s+name="twitter:title"[\s\S]*?\/>/i, `<meta name="twitter:title" content="${escapeHtml(titleText)}" />`)
  html = replaceTag(html, /<meta\s+name="twitter:description"[\s\S]*?\/>/i, `<meta name="twitter:description" content="${escapeHtml(desc)}" />`)
  html = replaceTag(html, /<meta\s+name="twitter:image"[\s\S]*?\/>/i, `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`)

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: item.title,
    description: desc,
    url: canonical,
    mainEntityOfPage: canonical,
    image: [ogImage],
    datePublished: item.published_at || item.fetched_at || undefined,
    publisher: {
      '@type': 'Organization',
      name: 'Radar by JpDev',
      logo: {
        '@type': 'ImageObject',
        url: 'https://github.com/Joao-Pedro-AI-Visionary.png',
      },
    },
  }
  if (item.source_name || item.author) {
    jsonLd.author = {
      '@type': 'Person',
      name: item.author || item.source_name,
    }
  }
  const extraHead = [
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<script type="application/ld+json">${escapeJsonLd(jsonLd)}</script>`,
  ].join('\n    ')
  html = html.replace('</head>', `    ${extraHead}\n  </head>`)

  const sourceLine = item.source_name ? `<p>${escapeHtml(item.source_name)}</p>` : ''
  const scoreLine = item.score != null ? `<p>Nota IA: ${escapeHtml(item.score.toFixed(1))}</p>` : ''
  const safeOrigUrl = safeHttpUrl(item.url)
  const linkLine = safeOrigUrl ? `<p><a href="${escapeHtml(safeOrigUrl)}" rel="noopener noreferrer">Ler fonte original</a></p>` : ''
  const fallbackBody = `<main style="max-width:720px;margin:2rem auto;padding:0 1rem;font-family:system-ui,sans-serif"><h1>${escapeHtml(item.title)}</h1>${sourceLine}${scoreLine}<p>${escapeHtml(desc)}</p>${linkLine}</main>`
  html = html.replace(/<div id="app"><\/div>/i, `<div id="app">${fallbackBody}</div>`)
  return html
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const reqUrl = new URL(req.url ?? '/', 'http://localhost')
  const rawId = reqUrl.searchParams.get('id') || reqUrl.pathname.split('/').filter(Boolean).pop() || ''
  const id = Number.parseInt(rawId, 10)
  if (!Number.isInteger(id) || id <= 0) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'invalid item id' }))
    return
  }

  const template = await loadTemplateHtml()
  const origin = requestOrigin(req)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)

  try {
    const upstream = await fetch(`${apiBase()}/api/items/${id}`, {
      headers: { Accept: 'application/json' },
      signal: ctrl.signal,
    })
    if (upstream.status === 404) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(template)
      return
    }
    if (!upstream.ok) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(template)
      return
    }
    const item = (await upstream.json()) as ItemPageData
    const rendered = renderItemHtml(template, item, origin)
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    res.end(rendered)
  } catch {
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(template)
  } finally {
    clearTimeout(timer)
  }
}
