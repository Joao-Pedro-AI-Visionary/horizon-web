export interface PageMetaInput {
  title: string
  description: string
  canonicalPath: string
  ogType?: 'website' | 'article'
  ogImage?: string
}

const DEFAULT_ORIGIN = 'https://horizon-web-eight.vercel.app'
const DEFAULT_DESC = 'Curadoria diária de tecnologia e engenharia pontuada por IA, com digest diário e tendências.'

function siteOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin.replace(/\/+$/, '')
  return DEFAULT_ORIGIN
}

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  if (typeof document === 'undefined') return
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

function setCanonical(url: string) {
  if (typeof document === 'undefined') return
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', url)
}

export function truncateDescription(raw: string, fallback = DEFAULT_DESC): string {
  const clean = raw.replace(/\s+/g, ' ').trim()
  if (!clean) return fallback
  return clean.length > 160 ? `${clean.slice(0, 157).trimEnd()}…` : clean
}

export function buildPageMeta(input: PageMetaInput, origin = siteOrigin()) {
  const cleanOrigin = origin.replace(/\/+$/, '')
  const canonical = `${cleanOrigin}${input.canonicalPath.startsWith('/') ? input.canonicalPath : `/${input.canonicalPath}`}`
  const description = truncateDescription(input.description)
  const ogImage = input.ogImage
    ? input.ogImage.startsWith('http')
      ? input.ogImage
      : `${cleanOrigin}${input.ogImage}`
    : 'https://github.com/Joao-Pedro-AI-Visionary.png'
  return {
    title: input.title,
    description,
    canonical,
    ogType: input.ogType ?? 'website',
    ogImage,
  }
}

export function applyPageMeta(input: PageMetaInput) {
  if (typeof document === 'undefined') return
  const meta = buildPageMeta(input)

  document.title = meta.title
  setMeta('name', 'description', meta.description)
  setCanonical(meta.canonical)
  setMeta('property', 'og:type', meta.ogType)
  setMeta('property', 'og:title', meta.title)
  setMeta('property', 'og:description', meta.description)
  setMeta('property', 'og:url', meta.canonical)
  setMeta('property', 'og:image', meta.ogImage)
  setMeta('name', 'twitter:title', meta.title)
  setMeta('name', 'twitter:description', meta.description)
  setMeta('name', 'twitter:image', meta.ogImage)
}
