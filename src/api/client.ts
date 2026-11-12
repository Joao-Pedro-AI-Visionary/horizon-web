import type {
  CollectReport,
  Digest,
  FeedPage,
  FeedParams,
  FeedTimeline,
  ItemDetail,
  Metrics,
  Settings,
  Source,
  SourceInput,
  TimelineParams,
} from './types'

/** ApiError carries the HTTP status and the API's {"error": "..."} message. */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

// Origin of the horizon-go API (e.g. https://api.example.com). Empty (default)
// keeps relative /api and /healthz URLs, served by the Vite dev/preview proxy
// (HORIZON_API_URL in vite.config.ts). See .env.example.
const BASE = String(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

// Admin token for write calls. It is typed by the admin on the Sources page
// and kept in localStorage by the admin store; it is never part of the build.
let adminToken = ''
let onUnauthorized: (() => void) | null = null

/** setAdminToken sets the bearer token sent with every write call. */
export function setAdminToken(token: string) {
  adminToken = token.trim()
}

/** setUnauthorizedHandler is called when a write call answers 401. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

const isWrite = (method: string) => method !== 'GET' && method !== 'HEAD'

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal, token = adminToken): Promise<T> {
  let res: Response
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (isWrite(method) && token) headers.Authorization = `Bearer ${token}`
  try {
    res = await fetch(BASE + path, {
      method,
      signal,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new ApiError(0, 'API indisponível — verifique se o backend (horizon-go, cmd/api) está rodando.')
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  let data: unknown = undefined
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok) {
    if (res.status === 401 && isWrite(method) && token === adminToken) onUnauthorized?.()
    const apiMsg = data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : ''
    throw new ApiError(res.status, apiMsg || `HTTP ${res.status}`, data)
  }
  return data as T
}

function query(params: object): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const api = {
  feed: (p: FeedParams, signal?: AbortSignal) => request<FeedPage>('GET', `/api/feed${query(p)}`, undefined, signal),
  feedTimeline: (p: TimelineParams, signal?: AbortSignal) =>
    request<FeedTimeline>('GET', `/api/feed/timeline${query(p)}`, undefined, signal),
  item: (id: number, signal?: AbortSignal) => request<ItemDetail>('GET', `/api/items/${id}`, undefined, signal),
  digests: () => request<{ digests: Digest[] | null }>('GET', '/api/digests'),
  digest: (date: string) => request<Digest>('GET', `/api/digests/${encodeURIComponent(date)}`),
  digestHtmlUrl: (date: string) => `${BASE}/api/digests/${encodeURIComponent(date)}?format=html`,
  digestMarkdownUrl: (date: string) => `${BASE}/api/digests/${encodeURIComponent(date)}?format=md`,
  generateDigest: (date?: string) => request<Digest>('POST', '/api/digests/generate', date ? { date } : undefined),
  sources: () => request<{ sources: Source[] | null }>('GET', '/api/sources'),
  createSource: (in_: SourceInput) => request<Source>('POST', '/api/sources', in_),
  updateSource: (id: number, in_: SourceInput) => request<Source>('PATCH', `/api/sources/${id}`, in_),
  deleteSource: (id: number) => request<void>('DELETE', `/api/sources/${id}`),
  fetchSource: (id: number) => request<CollectReport>('POST', `/api/sources/${id}/fetch`),
  runPipeline: () => request<CollectReport>('POST', '/api/pipeline/run'),
  settings: () => request<Settings>('GET', '/api/settings'),
  saveSettings: (s: Settings) => request<Settings>('PUT', '/api/settings', s),
  metrics: (days: number) => request<Metrics>('GET', `/api/metrics${query({ days })}`),
  health: () => request<Record<string, string>>('GET', '/healthz'),
  /** authStatus (public): how writes work on this API. */
  authStatus: () => request<{ mode: 'open' | 'token' | 'disabled' }>('GET', '/api/auth'),
  /** authCheck answers (204) only for a valid admin token, or with writes open (local dev). */
  authCheck: (token: string) => request<void>('POST', '/api/auth/check', undefined, undefined, token),
}

/** errorMessage turns any thrown value into a user-facing message. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return 'Já existe uma coleta em andamento. Aguarde terminar.'
    if (err.status === 401) return 'Edição bloqueada: desbloqueie com o token de admin em Fontes & Config.'
    if (err.status === 503 && /HORIZON_ADMIN_TOKEN/.test(err.message)) return 'Edição desligada no servidor: o token de admin não está configurado.'
    if (err.status === 429) return 'Uma coleta acabou de rodar. Tente de novo em alguns minutos.'
    if (err.status === 404) return 'Não encontrado.'
    return err.message
  }
  if (err instanceof Error) return err.message
  return String(err)
}
