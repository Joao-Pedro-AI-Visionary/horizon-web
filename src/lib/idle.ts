type IdleDeadlineLike = { didTimeout: boolean; timeRemaining: () => number }
type IdleCallback = (deadline: IdleDeadlineLike) => void
type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleCallback, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

/** Schedule non-critical UI work after the first paint, with a timer fallback. */
export function scheduleIdle(work: () => void, timeout = 1200): () => void {
  if (typeof window === 'undefined') return () => undefined
  const idleWindow = window as IdleWindow
  if (idleWindow.requestIdleCallback) {
    const handle = idleWindow.requestIdleCallback(() => work(), { timeout })
    return () => idleWindow.cancelIdleCallback?.(handle)
  }
  const handle = window.setTimeout(work, 0)
  return () => window.clearTimeout(handle)
}
