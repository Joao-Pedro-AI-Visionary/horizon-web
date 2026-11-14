import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'

describe('newsletter api client', () => {
  const calls: Array<{ url: string; init: RequestInit }> = []

  beforeEach(() => {
    calls.length = 0
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ status: 'pending', message: 'ok' }), { status: 200 })
    })
  })

  it('calls public subscribe, confirm and unsubscribe endpoints with clean JSON payloads', async () => {
    await api.subscribeNewsletter('reader@example.com')
    await api.confirmNewsletter('conf_123')
    await api.unsubscribeNewsletter('unsub_456')

    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      'POST /api/newsletter/subscribe',
      'POST /api/newsletter/confirm',
      'POST /api/newsletter/unsubscribe',
    ])
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ email: 'reader@example.com' })
    expect(JSON.parse(String(calls[1]?.init.body))).toEqual({ token: 'conf_123' })
    expect(JSON.parse(String(calls[2]?.init.body))).toEqual({ token: 'unsub_456' })
  })
})
