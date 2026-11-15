import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('admin route guards', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/router/index.ts'), 'utf8')

  it('marks Fontes and Métricas as admin-only and keeps the public feed open', () => {
    expect(source).toMatch(/path: '\/metrics'[^\n]*admin: true/)
    expect(source).toMatch(/path: '\/sources'[^\n]*admin: true/)
    expect(source).not.toMatch(/path: '\/'[^\n]*admin: true/)
    expect(source).not.toMatch(/path: '\/digests\/:date\?'[^\n]*admin: true/)
    expect(source).not.toMatch(/path: '\/items\/:id[^\n]*admin: true/)
    expect(source).toContain('if (!to.meta.admin) return true')
    expect(source).toContain('admin.canEdit')
  })
})
