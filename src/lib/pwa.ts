import { ref } from 'vue'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'horizon:pwa:dismissed'
let deferredPrompt: BeforeInstallPromptEvent | null = null
let attached = false

export const canInstall = ref(false)
export const installed = ref(false)
export const installDismissed = ref(false)

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches || nav.standalone)
}

function readDismissed(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function handleBeforeInstallPrompt(event: Event): void {
  const promptEvent = event as BeforeInstallPromptEvent
  promptEvent.preventDefault?.()
  deferredPrompt = promptEvent
  if (!installed.value && !installDismissed.value) {
    canInstall.value = true
  }
}

export function handleAppInstalled(): void {
  installed.value = true
  canInstall.value = false
  deferredPrompt = null
}

export function initPwaInstall(): void {
  if (typeof window === 'undefined' || attached) return
  attached = true
  installDismissed.value = readDismissed()
  if (isStandalone()) {
    installed.value = true
    return
  }
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)
}

export async function triggerInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  const promptEvent = deferredPrompt
  deferredPrompt = null
  canInstall.value = false
  try {
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') {
      installed.value = true
    } else {
      dismissInstall()
    }
    return choice.outcome
  } catch {
    return 'dismissed'
  }
}

export function dismissInstall(): void {
  installDismissed.value = true
  canInstall.value = false
  deferredPrompt = null
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* ignore quota/private-mode storage errors */
  }
}

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener(
    'load',
    () => {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
        /* non-fatal if registration is blocked in private mode */
      })
    },
    { once: true },
  )
}

export function _resetPwaForTest(): void {
  deferredPrompt = null
  attached = false
  canInstall.value = false
  installed.value = false
  installDismissed.value = false
}
