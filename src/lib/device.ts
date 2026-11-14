export const DEVICE_ID_KEY = 'horizon_did'
export const MIN_VOTE_DWELL_MS = 3000

const VALID_ID = /^[a-zA-Z0-9_-]{16,128}$/

function readCookie(name: string): string {
  if (typeof document === 'undefined' || !document.cookie) return ''
  for (const part of document.cookie.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const k = part.slice(0, idx).trim()
    if (k === name) return decodeURIComponent(part.slice(idx + 1).trim())
  }
  return ''
}

function writeCookie(name: string, val: string) {
  if (typeof document === 'undefined') return
  const secure = typeof window !== 'undefined' && window.location?.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(val)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
}

function randomDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`
}

/**
 * getDeviceId returns a persistent random per-browser identifier synced
 * between localStorage and a cookie for anonymous 1-vote-per-item state.
 */
export function getDeviceId(): string {
  let stored = ''
  try {
    if (typeof localStorage !== 'undefined') {
      stored = localStorage.getItem(DEVICE_ID_KEY) ?? ''
    }
  } catch {
    stored = ''
  }
  const cookieVal = readCookie(DEVICE_ID_KEY)
  const existing = VALID_ID.test(stored) ? stored : VALID_ID.test(cookieVal) ? cookieVal : ''
  const id = existing || randomDeviceId()
  try {
    if (typeof localStorage !== 'undefined' && stored !== id) {
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
  } catch {
    /* ignore quota/private-mode errors */
  }
  if (cookieVal !== id) writeCookie(DEVICE_ID_KEY, id)
  return id
}

export function computeDwellMs(visibleSinceMs: number, nowMs = Date.now()): number {
  if (!Number.isFinite(visibleSinceMs) || visibleSinceMs <= 0) return 0
  return Math.max(0, Math.round(nowMs - visibleSinceMs))
}
