import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { useAdmin } from './admin'

type Call = { url: string; init: RequestInit }
type Reply = { status: number; body?: unknown }

function mockFetch(handler: (c: Call) => Reply) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const c = { url, init }
    calls.push(c)
    const r = handler(c)
    return new Response(r.status === 204 ? null : JSON.stringify(r.body ?? { error: 'x' }), { status: r.status })
  })
  return calls
}

const auth = (c: Call) => (c.init.headers as Record<string, string>).Authorization
const future = () => new Date(Date.now() + 3600_000).toISOString()

function api401unless(token: string) {
  return (c: Call): Reply => {
    if (c.url.endsWith('/api/auth')) return { status: 200, body: { mode: 'login' } }
    if (c.url.endsWith('/api/auth/login')) {
      const b = JSON.parse(String(c.init.body))
      return b.password === 'right' ? { status: 200, body: { token, username: 'joao', expires_at: future() } } : { status: 401 }
    }
    if (c.init.method === 'GET' && !c.url.endsWith('/api/auth/me')) return { status: 200, body: {} }
    return auth(c) === `Bearer ${token}` ? { status: c.url.endsWith('/me') ? 200 : 204, body: { username: 'joao' } } : { status: 401 }
  }
}

describe('admin session', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const mem = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => mem.set(k, v),
      removeItem: (k: string) => mem.delete(k),
    })
  })

  it('starts logged out with a single public GET', async () => {
    const calls = mockFetch(api401unless('t'))
    const a = useAdmin()
    await a.init()
    expect(a.status).toBe('out')
    expect(a.canEdit).toBe(false)
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual(['GET /api/auth'])
  })

  it('is open when the local API accepts writes without credentials', async () => {
    mockFetch(() => ({ status: 200, body: { mode: 'open' } }))
    const a = useAdmin()
    await a.init()
    expect(a.status).toBe('open')
    expect(a.canEdit).toBe(true)
  })

  it('refuses a wrong password, logs in with the right one and sends the session on writes only', async () => {
    const calls = mockFetch(api401unless('sess'))
    const a = useAdmin()
    await a.init()
    await expect(a.login('joao', 'wrong')).rejects.toThrow('Usuário ou senha inválidos')
    expect(a.status).toBe('out')
    await a.login(' joao ', 'right')
    expect(a.status).toBe('in')
    expect(a.username).toBe('joao')
    expect(JSON.parse(sessionStorage.getItem('horizon.session')!).token).toBe('sess')
    await api.runPipeline()
    await api.sources()
    const [write, read] = calls.slice(-2)
    expect(auth(write)).toBe('Bearer sess')
    expect(auth(read)).toBeUndefined()
  })

  it('restores a stored session after checking /api/auth/me', async () => {
    sessionStorage.setItem('horizon.session', JSON.stringify({ token: 'kept', username: 'joao', expiresAt: future() }))
    mockFetch(api401unless('kept'))
    const a = useAdmin()
    await a.init()
    expect(a.status).toBe('in')
  })

  it('logs out when a write answers 401', async () => {
    mockFetch(api401unless('sess'))
    const a = useAdmin()
    await a.init()
    await a.login('joao', 'right')
    mockFetch(() => ({ status: 401 }))
    await expect(api.runPipeline()).rejects.toMatchObject({ status: 401 })
    expect(a.status).toBe('out')
    expect(a.expired).toBe(true)
    expect(sessionStorage.getItem('horizon.session')).toBeNull()
  })

  it('ignores an expired stored session', async () => {
    sessionStorage.setItem('horizon.session', JSON.stringify({ token: 'old', username: 'joao', expiresAt: new Date(Date.now() - 1000).toISOString() }))
    const calls = mockFetch(api401unless('x'))
    const a = useAdmin()
    await a.init()
    expect(a.status).toBe('out')
    expect(calls.some((c) => c.url.endsWith('/api/auth/me'))).toBe(false)
  })
})
