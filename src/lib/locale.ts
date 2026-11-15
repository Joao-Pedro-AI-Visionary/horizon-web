import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

// Display language of item titles/summaries: the PT translation from the API
// (title_pt / summary_pt) or the original text of the source. Same shape as
// lib/theme.ts: one module-level ref, persisted in localStorage.
export type LocaleMode = 'pt' | 'original'

const LOCALE_KEY = 'horizon:locale'
export const locale = ref<LocaleMode>('pt')

export const LOCALE_LABEL: Record<LocaleMode, string> = { pt: 'PT', original: 'Original' }

/** `pt` when the browser language starts with "pt", otherwise `original`. */
export function detectLocale(language: string | null | undefined): LocaleMode {
  return (language ?? '').trim().toLowerCase().startsWith('pt') ? 'pt' : 'original'
}

function readSaved(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_KEY) : null
  } catch {
    return null
  }
}

function persist(mode: LocaleMode): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LOCALE_KEY, mode)
  } catch {
    /* ignore quota/private storage errors */
  }
}

export function initLocale(): LocaleMode {
  const saved = readSaved()
  const initial: LocaleMode =
    saved === 'pt' || saved === 'original'
      ? saved
      : detectLocale(typeof navigator !== 'undefined' ? navigator.language : undefined)
  locale.value = initial
  return initial
}

export function setLocale(mode: LocaleMode): LocaleMode {
  locale.value = mode
  persist(mode)
  return mode
}

export function toggleLocale(): LocaleMode {
  return setLocale(locale.value === 'pt' ? 'original' : 'pt')
}

export function otherLocale(mode: LocaleMode): LocaleMode {
  return mode === 'pt' ? 'original' : 'pt'
}

export interface Translatable {
  title: string
  summary?: string | null
  title_pt?: string | null
  summary_pt?: string | null
}

export interface DisplayText {
  title: string
  summary: string
  /** True when at least one shown field comes from the PT translation. */
  translated: boolean
}

const filled = (s: string | null | undefined): s is string => typeof s === 'string' && s.trim() !== ''

export function hasTranslation(item: Translatable): boolean {
  return filled(item.title_pt) || filled(item.summary_pt)
}

/** Title/summary to show; each PT field falls back to the original when empty. */
export function displayText(item: Translatable, mode: LocaleMode): DisplayText {
  const summary = item.summary ?? ''
  if (mode !== 'pt') return { title: item.title, summary, translated: false }
  const title = filled(item.title_pt) ? item.title_pt : item.title
  const sum = filled(item.summary_pt) ? item.summary_pt : summary
  return { title, summary: sum, translated: hasTranslation(item) }
}

export interface ItemLocale {
  /** Effective mode for this item: the per-item choice, else the global one. */
  mode: ComputedRef<LocaleMode>
  text: ComputedRef<DisplayText>
  /** Whether the per-item "Ver original / Ver tradução" control makes sense. */
  canToggle: ComputedRef<boolean>
  /** Label of the per-item control ("Ver original" or "Ver tradução"). */
  toggleLabel: ComputedRef<string>
  toggle: () => void
  override: Ref<LocaleMode | null>
}

/**
 * Per-card/page language switch. It starts on the global locale and resets
 * whenever the global toggle changes, so the header switch always wins.
 */
export function useItemLocale(source: () => Translatable | null | undefined): ItemLocale {
  const override = ref<LocaleMode | null>(null)
  watch(locale, () => {
    override.value = null
  })
  const mode = computed<LocaleMode>(() => override.value ?? locale.value)
  const text = computed<DisplayText>(() => {
    const it = source()
    return it ? displayText(it, mode.value) : { title: '', summary: '', translated: false }
  })
  const canToggle = computed(() => {
    const it = source()
    return !!it && hasTranslation(it)
  })
  const toggleLabel = computed(() => (mode.value === 'pt' ? 'Ver original' : 'Ver tradução'))
  const toggle = () => {
    override.value = otherLocale(mode.value)
  }
  return { mode, text, canToggle, toggleLabel, toggle, override }
}
