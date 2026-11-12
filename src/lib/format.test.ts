import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fmtDateLong, fmtRelative, fmtScore, fmtToday, hostOf } from './format'

const plain = (s: string) => s.replace(/\s/g, ' ')

describe('format (pt-BR)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-12T15:00:00-03:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('relative time reads like the shot ("há 2 horas")', () => {
    expect(plain(fmtRelative('2026-11-12T13:00:00-03:00'))).toBe('há 2 horas')
    expect(plain(fmtRelative('2026-11-04T15:00:00-03:00'))).toBe('há 8 dias')
    expect(fmtRelative(null)).toBe('—')
  })

  it('score uses a decimal comma', () => {
    expect(fmtScore(8)).toBe('8,0')
    expect(fmtScore(null)).toBe('—')
  })

  it('header and article dates are long and capitalised', () => {
    expect(fmtToday(new Date('2026-11-12T15:00:00-03:00'))).toMatch(/^[A-ZÀ-Ú].*12 de novembro de 2026$/)
    expect(fmtDateLong('2026-11-02T14:05:00-03:00')).toMatch(/novembro de 2026/)
    expect(fmtDateLong(null)).toBe('—')
  })

  it('hostOf drops www and survives bad URLs', () => {
    expect(hostOf('https://www.reddit.com/r/golang/')).toBe('reddit.com')
    expect(hostOf('not a url')).toBe('not a url')
  })
})
