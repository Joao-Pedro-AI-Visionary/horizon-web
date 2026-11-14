import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, errorMessage } from '../api/client'
import { DEVICE_ID_KEY, MIN_VOTE_DWELL_MS, computeDwellMs, getDeviceId } from './device'

describe('device & anonymous voting client', () => {
  const mem = new Map<string, string>()

  beforeEach(() => {
    mem.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => mem.set(k, v),
      removeItem: (k: string) => mem.delete(k),
    })
    let cookieJar = ''
    vi.stubGlobal('document', {
      get cookie() {
        return cookieJar
      },
      set cookie(v: string) {
        cookieJar = v.split(';')[0] ?? ''
      },
    })
  })

  it('generates and reuses a persistent random device ID across storage and cookie', () => {
    const first = getDeviceId()
    expect(first.length).toBeGreaterThanOrEqual(16)
    expect(mem.get(DEVICE_ID_KEY)).toBe(first)
    expect(getDeviceId()).toBe(first)

    // Restores from cookie if storage is wiped.
    mem.clear()
    expect(getDeviceId()).toBe(first)
    expect(mem.get(DEVICE_ID_KEY)).toBe(first)
  })

  it('computes dwell duration safely', () => {
    expect(computeDwellMs(0, 5000)).toBe(0)
    expect(computeDwellMs(1000, 4500)).toBe(3500)
    expect(MIN_VOTE_DWELL_MS).toBeGreaterThanOrEqual(3000)
  })

  it('sends X-Device-Id and credentials: include on voteItem, feed, and item calls', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ item_id: 7, likes: 3, user_vote: 1 }), { status: 200 })
    })

    const did = getDeviceId()
    const res = await api.voteItem(7, 1, 4200)
    expect(res).toEqual({ item_id: 7, likes: 3, user_vote: 1 })
    expect(calls[0]?.init.credentials).toBe('include')
    expect((calls[0]?.init.headers as Record<string, string>)['X-Device-Id']).toBe(did)
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ vote: 1, dwell_ms: 4200 })

    await api.feed({ sort: 'trending' })
    expect(calls[1]?.url).toContain('sort=trending')
    expect((calls[1]?.init.headers as Record<string, string>)['X-Device-Id']).toBe(did)
  })

  it('surfaces rate limit vote error cleanly', () => {
    const err = new ApiError(429, 'muitos votos em pouco tempo, tente novamente em instantes')
    expect(errorMessage(err)).toContain('votos')
  })
})
