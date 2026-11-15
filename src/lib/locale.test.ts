import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { detectLocale, displayText, hasTranslation, initLocale, locale, setLocale, toggleLocale, useItemLocale } from './locale'

function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    data,
  }
}

describe('detectLocale', () => {
  it('defaults to pt when the browser language starts with pt', () => {
    expect(detectLocale('pt-BR')).toBe('pt')
    expect(detectLocale('pt')).toBe('pt')
    expect(detectLocale('PT-pt')).toBe('pt')
  })
  it('falls back to original otherwise', () => {
    expect(detectLocale('en-US')).toBe('original')
    expect(detectLocale('')).toBe('original')
    expect(detectLocale(undefined)).toBe('original')
  })
})

describe('locale store', () => {
  let storage: ReturnType<typeof fakeStorage>
  beforeEach(() => {
    storage = fakeStorage()
    vi.stubGlobal('localStorage', storage)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the navigator language when nothing is saved', () => {
    vi.stubGlobal('navigator', { language: 'pt-BR' })
    expect(initLocale()).toBe('pt')
    expect(locale.value).toBe('pt')
    vi.stubGlobal('navigator', { language: 'en-US' })
    expect(initLocale()).toBe('original')
  })

  it('a saved choice wins over the navigator language', () => {
    vi.stubGlobal('navigator', { language: 'pt-BR' })
    storage.setItem('horizon:locale', 'original')
    expect(initLocale()).toBe('original')
  })

  it('ignores an invalid saved value', () => {
    vi.stubGlobal('navigator', { language: 'pt-BR' })
    storage.setItem('horizon:locale', 'fr')
    expect(initLocale()).toBe('pt')
  })

  it('toggle flips and persists under horizon:locale', () => {
    setLocale('pt')
    expect(toggleLocale()).toBe('original')
    expect(storage.getItem('horizon:locale')).toBe('original')
    expect(toggleLocale()).toBe('pt')
    expect(storage.getItem('horizon:locale')).toBe('pt')
  })

  it('survives a storage that throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    })
    vi.stubGlobal('navigator', { language: 'pt-BR' })
    expect(initLocale()).toBe('pt')
    expect(toggleLocale()).toBe('original')
  })
})

describe('displayText', () => {
  const item = { title: 'Rust 2.0 released', summary: 'The Rust team shipped.', title_pt: 'Rust 2.0 lançado', summary_pt: 'O time do Rust lançou.' }

  it('shows the translation in pt mode', () => {
    expect(displayText(item, 'pt')).toEqual({ title: 'Rust 2.0 lançado', summary: 'O time do Rust lançou.', translated: true })
  })

  it('shows the original in original mode', () => {
    expect(displayText(item, 'original')).toEqual({ title: 'Rust 2.0 released', summary: 'The Rust team shipped.', translated: false })
  })

  it('falls back to the original when there is no translation', () => {
    expect(displayText({ title: 'Only EN', summary: 'Body' }, 'pt')).toEqual({ title: 'Only EN', summary: 'Body', translated: false })
    expect(displayText({ title: 'Only EN', summary: 'Body', title_pt: '  ', summary_pt: '' }, 'pt')).toEqual({ title: 'Only EN', summary: 'Body', translated: false })
  })

  it('falls back per field', () => {
    expect(displayText({ title: 'T', summary: 'S', title_pt: 'T-pt' }, 'pt')).toEqual({ title: 'T-pt', summary: 'S', translated: true })
    expect(displayText({ title: 'T', summary: 'S', summary_pt: 'S-pt' }, 'pt')).toEqual({ title: 'T', summary: 'S-pt', translated: true })
  })

  it('tolerates a missing summary', () => {
    expect(displayText({ title: 'T' }, 'pt')).toEqual({ title: 'T', summary: '', translated: false })
  })

  it('hasTranslation only when some PT text exists', () => {
    expect(hasTranslation(item)).toBe(true)
    expect(hasTranslation({ title: 'T', title_pt: ' ' })).toBe(false)
    expect(hasTranslation({ title: 'T', summary_pt: 'x' })).toBe(true)
  })
})

describe('useItemLocale', () => {
  beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('follows the global locale and toggles per item', async () => {
    setLocale('pt')
    const it = { title: 'EN', summary: 'en body', title_pt: 'PT', summary_pt: 'corpo' }
    const s = useItemLocale(() => it)
    expect(s.text.value.title).toBe('PT')
    expect(s.toggleLabel.value).toBe('Ver original')
    expect(s.canToggle.value).toBe(true)
    s.toggle()
    expect(s.text.value).toEqual({ title: 'EN', summary: 'en body', translated: false })
    expect(s.toggleLabel.value).toBe('Ver tradução')
    expect(locale.value).toBe('pt') // the global choice is untouched
    setLocale('original')
    await nextTick()
    expect(s.override.value).toBeNull()
    expect(s.mode.value).toBe('original')
  })

  it('hides the per-item control when there is no translation', () => {
    setLocale('pt')
    const s = useItemLocale(() => ({ title: 'EN', summary: 'x' }))
    expect(s.canToggle.value).toBe(false)
    expect(s.text.value.title).toBe('EN')
  })
})
