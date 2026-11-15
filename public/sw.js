const CACHE_NAME = 'horizon-static-v2'
const DYNAMIC_BYPASS_PREFIXES = [
  '/api/',
  '/healthz',
  '/rss.xml',
  '/digests/rss.xml',
  '/sitemap.xml',
  '/og/',
]

function shouldBypassNetwork(url, method) {
  if (method !== 'GET') return true
  if (url.origin !== self.location.origin) return true
  return DYNAMIC_BYPASS_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
}

function isImmutableAsset(pathname) {
  return pathname.startsWith('/assets/')
}

function isStaticIconOrFont(pathname) {
  return (
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/logo') ||
    pathname === '/favicon.ico' ||
    pathname === '/favicon.svg' ||
    pathname === '/favicon-16.png' ||
    pathname === '/favicon-32.png' ||
    pathname === '/apple-touch-icon.png' ||
    pathname === '/jpdev-avatar.webp' ||
    pathname === '/jpdev-logo.png' ||
    pathname === '/manifest.webmanifest'
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (shouldBypassNetwork(url, request.method)) {
    return
  }

  // Network-first for HTML navigations so fresh content and deploys never get stuck behind cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy)).catch(() => {})
          }
          return response
        })
        .catch(async () => {
          const cached = (await caches.match(request)) || (await caches.match('/'))
          return cached || Response.error()
        }),
    )
    return
  }

  // Hashed Vite chunks under /assets/ are immutable and safe for cache-first.
  if (isImmutableAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {})
          }
          return response
        })
      }),
    )
    return
  }

  // Icons & manifest use stale-while-revalidate with fast fallback.
  if (isStaticIconOrFont(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkPromise = fetch(request)
          .then((response) => {
            if (response && response.ok && response.type === 'basic') {
              const copy = response.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {})
            }
            return response
          })
          .catch(() => cached)
        return cached || networkPromise
      }),
    )
  }
})
