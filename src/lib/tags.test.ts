import { describe, expect, it } from 'vitest'
import { rankTags } from './tags'

describe('rankTags', () => {
  it('orders by frequency, then alphabetically, and caps at n', () => {
    const items = [{ tags: ['go', 'ai'] }, { tags: ['go', 'security'] }, { tags: null }, { tags: ['ai', 'go', 'linux'] }]
    expect(rankTags(items, 3)).toEqual(['go', 'ai', 'linux'])
  })
  it('returns nothing for items without tags', () => {
    expect(rankTags([{ tags: null }, { tags: [] }])).toEqual([])
  })
})
