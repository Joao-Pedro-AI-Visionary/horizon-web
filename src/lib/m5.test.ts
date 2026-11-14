import type { ObjectDirective } from 'vue'
import { describe, expect, it } from 'vitest'
import { staggerDelay, vReveal } from './motion'
import { applyTheme, initTheme, theme, toggleTheme } from './theme'

describe('M5 Theme & LCP-safe motion helpers', () => {
  it('defaults to light theme and toggles light/dark cleanly', () => {
    const attrs = new Map<string, string>()
    const metaAttrs: Record<string, string> = { content: '#eef2ee' }
    const storage = new Map<string, string>()

    const g = globalThis as { document?: unknown; localStorage?: unknown }
    const prevDoc = g.document
    const prevLS = g.localStorage

    g.document = {
      documentElement: {
        setAttribute: (k: string, v: string) => attrs.set(k, v),
        removeAttribute: (k: string) => attrs.delete(k),
      },
      head: {
        querySelector: () => ({
          setAttribute: (k: string, v: string) => {
            metaAttrs[k] = v
          },
        }),
      },
    }
    g.localStorage = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    }

    try {
      expect(initTheme()).toBe('light')
      expect(theme.value).toBe('light')
      expect(attrs.has('data-theme')).toBe(false)
      expect(metaAttrs.content).toBe('#eef2ee')

      expect(toggleTheme()).toBe('dark')
      expect(theme.value).toBe('dark')
      expect(attrs.get('data-theme')).toBe('dark')
      expect(metaAttrs.content).toBe('#0d130f')
      expect(storage.get('horizon:theme')).toBe('dark')

      expect(initTheme()).toBe('dark')
      expect(toggleTheme()).toBe('light')
      expect(attrs.has('data-theme')).toBe(false)
      applyTheme('light')
    } finally {
      if (prevDoc === undefined) delete g.document
      else g.document = prevDoc
      if (prevLS === undefined) delete g.localStorage
      else g.localStorage = prevLS
    }
  })

  it('keeps the first card static (value=false) while staggering subsequent cards', () => {
    const firstEl = {
      dataset: {} as Record<string, string>,
      style: { setProperty: () => {} },
      classList: { add: () => {} },
      parentElement: null,
    } as unknown as HTMLElement

    const revealObj = vReveal as ObjectDirective<HTMLElement, number | false | undefined>
    const mount = revealObj.mounted as (el: HTMLElement, binding: { value: number | false | undefined }) => void
    mount(firstEl, { value: false })
    expect(firstEl.dataset.reveal).toBeUndefined()

    const setProps: Record<string, string> = {}
    const secondEl = {
      dataset: {} as Record<string, string>,
      style: {
        setProperty: (k: string, v: string) => {
          setProps[k] = v
        },
      },
      classList: { add: () => {} },
      parentElement: null,
    } as unknown as HTMLElement

    mount(secondEl, { value: 2 })
    expect(secondEl.dataset.reveal).toBe('')
    expect(setProps['--d']).toBe(staggerDelay(2))
  })
})
