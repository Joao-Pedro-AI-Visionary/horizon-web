import { ref } from 'vue'

export type ThemeMode = 'light' | 'dark'

const THEME_KEY = 'horizon:theme'
export const theme = ref<ThemeMode>('light')

const THEME_COLORS: Record<ThemeMode, string> = {
  light: '#eef2ee',
  dark: '#0d130f',
}

export function applyTheme(mode: ThemeMode): void {
  theme.value = mode
  if (typeof document !== 'undefined') {
    if (mode === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    const meta = document.head?.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', THEME_COLORS[mode])
  }
}

export function initTheme(): ThemeMode {
  let saved: string | null = null
  try {
    saved = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_KEY) : null
  } catch {
    saved = null
  }
  const initial: ThemeMode = saved === 'dark' ? 'dark' : 'light'
  applyTheme(initial)
  return initial
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = theme.value === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_KEY, next)
  } catch {
    /* ignore quota/private storage errors */
  }
  return next
}
