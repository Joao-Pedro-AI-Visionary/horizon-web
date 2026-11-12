import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { useAdmin } from './admin'

type Call = { url: string; init: RequestInit }

let mode = 'token'

function mockFetch(handler: (c: Call) => number) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const c = { url, init }
    calls.push(c)
    const status = handler(c)
    if (url.endsWith('/api/auth') && status === 200) return new Response(JSON.stringify({ mode }), { status })
    return new Response(status === 204 ? null : JSON.stringify({ error: 'x' }), { status })
  })
  return calls
}

const auth = (c: Call) => (c.init.headers as Record<string, string>).Authorization

describe('admin store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const mem = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => mem.set(k, v),
      removeItem: (k: string) => mem.delete(k),
    })
  })

  it('starts locked when the API wants a token, without a failing request', async () => {
    mode = 'token'
    const calls = mockFetch((c) => (c.url.endsWith('/api/auth') ? 200 : 401))
    const a = useAdmin()
    await a.init()
    expect(a.status).toBe('locked')
    expect(a.canEdit).toBe(false)
    expect(calls.map((c) => c.init.method)).toEqual(['GET'])
  })

  it('is open when the local API accepts writes without a token', async () => {
    mode = 'open'
    mockFetch((c) => (c.url.endsWith('/api/auth') ? 200 : 204))
    const a = useAdmin()
    await a.init()
    expect(a.status).toBe('open')
    expect(a.canEdit).toBe(true)
  })

  it('flags a server with writes disabled', async () => {
    mode = 'disabled'
    mockFetch(() => 200)
    const a = useAdmin()
    await a.init()
    expect(a.status).toBe('locked')
    expect(a.disabled).toBe(true)
  })

  it('checks a stored token on start', async () => {
    localStorage.setItem('horizon.adminToken', 'kept')
    mockFetch((c) => (auth(c) === 'Bearer kept' ? 204 : 401))
    const a = useAdmin()
    await a.init()
    expect(a.status).toBe('unlocked')
  })

  it('unlocks with a valid token, sends it on writes only, and stores it', async () => {
    mode = 'token'
    const calls = mockFetch((c) => (c.url.endsWith('/api/auth') ? 200 : auth(c) === 'Bearer good' || c.init.method === 'GET' ? 204 : 401))
    const a = useAdmin()
    await a.init()
    await expect(a.unlock('bad')).rejects.toThrow('Token inválido')
    expect(a.status).toBe('locked')
    await a.unlock('  good ')
    expect(a.status).toBe('unlocked')
    expect(localStorage.getItem('horizon.adminToken')).toBe('good')
    await api.runPipeline()
    await api.sources()
    const [write, read] = calls.slice(-2)
    expect(auth(write)).toBe('Bearer good')
    expect(auth(read)).toBeUndefined()
  })

  it('locks again when a write answers 401', async () => {
    let valid = true
    mockFetch(() => (valid ? 204 : 401))
    const a = useAdmin()
    await a.unlock('tok')
    valid = false
    await expect(api.runPipeline()).rejects.toMatchObject({ status: 401 })
    expect(a.status).toBe('locked')
    expect(a.expired).toBe(true)
    expect(localStorage.getItem('horizon.adminToken')).toBeNull()
  })
})
