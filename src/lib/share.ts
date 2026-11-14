export interface ShareLinks {
  x: string
  linkedin: string
  whatsapp: string
}

export function itemPermalink(itemId: number, origin?: string): string {
  const base = (
    origin ??
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://horizon-web-eight.vercel.app')
  ).replace(/\/+$/, '')
  return `${base}/items/${itemId}`
}

export function buildShareLinks(title: string, pageUrl: string): ShareLinks {
  const cleanTitle = title.trim()
  return {
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(cleanTitle)}&url=${encodeURIComponent(pageUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${cleanTitle} ${pageUrl}`)}`,
  }
}
