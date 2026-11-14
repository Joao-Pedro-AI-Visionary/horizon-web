import type { IncomingMessage, ServerResponse } from 'node:http'

const DEFAULT_API = 'https://horizon-api-bzpg.onrender.com'

function apiBase(): string {
  return (process.env.HORIZON_API_URL || process.env.VITE_API_URL || DEFAULT_API).replace(/\/+$/, '')
}

export function resolveUpstreamPath(kind: string | null, rawId: string | null): { path: string; defaultContentType: string } | null {
  switch (kind) {
    case 'og': {
      const id = Number.parseInt(rawId ?? '', 10)
      if (!Number.isInteger(id) || id <= 0) return null
      return { path: `/api/og/items/${id}.png`, defaultContentType: 'image/png' }
    }
    case 'sitemap':
      return { path: '/api/sitemap.xml', defaultContentType: 'application/xml; charset=utf-8' }
    case 'rss-feed':
      return { path: '/api/rss/feed.xml', defaultContentType: 'application/rss+xml; charset=utf-8' }
    case 'rss-digests':
      return { path: '/api/rss/digests.xml', defaultContentType: 'application/rss+xml; charset=utf-8' }
    default:
      return null
  }
}

const FALLBACK_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://horizon-web-eight.vercel.app/</loc></url>
  <url><loc>https://horizon-web-eight.vercel.app/digests</loc></url>
  <url><loc>https://horizon-web-eight.vercel.app/metrics</loc></url>
</urlset>`

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const reqUrl = new URL(req.url ?? '/', 'http://localhost')
  const kind = reqUrl.searchParams.get('kind')
  const target = resolveUpstreamPath(kind, reqUrl.searchParams.get('id'))
  if (!target) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'invalid seo proxy request' }))
    return
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10000)

  try {
    const upstream = await fetch(`${apiBase()}${target.path}`, {
      signal: ctrl.signal,
    })
    if (!upstream.ok) {
      if (kind === 'sitemap') {
        res.statusCode = 200
        res.setHeader('Content-Type', target.defaultContentType)
        res.setHeader('Cache-Control', 'public, s-maxage=60')
        res.end(FALLBACK_SITEMAP)
        return
      }
      res.statusCode = upstream.status === 404 ? 404 : 502
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(upstream.status === 404 ? 'not found' : 'upstream error')
      return
    }
    const contentType = upstream.headers.get('content-type') || target.defaultContentType
    const body = Buffer.from(await upstream.arrayBuffer())
    res.statusCode = 200
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    res.end(body)
  } catch {
    if (kind === 'sitemap') {
      res.statusCode = 200
      res.setHeader('Content-Type', target.defaultContentType)
      res.setHeader('Cache-Control', 'public, s-maxage=60')
      res.end(FALLBACK_SITEMAP)
      return
    }
    res.statusCode = 502
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('upstream unavailable')
  } finally {
    clearTimeout(timer)
  }
}
