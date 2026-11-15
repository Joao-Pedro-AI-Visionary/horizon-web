import { describe, expect, it } from 'vitest'
import { isAdminRouteName } from './access.ts'

describe('admin route access', () => {
  it('treats Fontes and Métricas as admin-only and keeps the public feed open', () => {
    expect(isAdminRouteName('metrics')).toBe(true)
    expect(isAdminRouteName('sources')).toBe(true)
    expect(isAdminRouteName('feed')).toBe(false)
    expect(isAdminRouteName('digests')).toBe(false)
    expect(isAdminRouteName('item')).toBe(false)
  })
})
