import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _resetPwaForTest,
  canInstall,
  dismissInstall,
  handleAppInstalled,
  handleBeforeInstallPrompt,
  installDismissed,
  installed,
  triggerInstall,
} from './pwa'

describe('PWA install prompt helpers', () => {
  beforeEach(() => {
    _resetPwaForTest()
  })

  it('captures beforeinstallprompt and exposes install trigger', async () => {
    const promptSpy = vi.fn().mockResolvedValue(undefined)
    const fakeEvent = {
      preventDefault: vi.fn(),
      prompt: promptSpy,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    } as unknown as Event

    handleBeforeInstallPrompt(fakeEvent)
    expect(canInstall.value).toBe(true)

    const outcome = await triggerInstall()
    expect(promptSpy).toHaveBeenCalledTimes(1)
    expect(outcome).toBe('accepted')
    expect(installed.value).toBe(true)
    expect(canInstall.value).toBe(false)
  })

  it('hides banner when dismissed or installed', () => {
    handleBeforeInstallPrompt({ preventDefault: vi.fn() } as unknown as Event)
    expect(canInstall.value).toBe(true)

    dismissInstall()
    expect(installDismissed.value).toBe(true)
    expect(canInstall.value).toBe(false)

    handleBeforeInstallPrompt({ preventDefault: vi.fn() } as unknown as Event)
    expect(canInstall.value).toBe(false)

    _resetPwaForTest()
    handleAppInstalled()
    expect(installed.value).toBe(true)
    expect(canInstall.value).toBe(false)
  })
})
