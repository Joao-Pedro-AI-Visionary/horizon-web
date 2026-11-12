import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, api, setAdminToken, setUnauthorizedHandler } from '../api/client'

const STORAGE_KEY = 'horizon.session'

interface Stored {
  token: string
  username: string
  expiresAt: string
}

function readStored(): Stored | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Stored
    return s.token && Date.parse(s.expiresAt) > Date.now() ? s : null
  } catch {
    return null
  }
}

function writeStored(s: Stored | null) {
  try {
    if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage blocked: the session lives in memory for this tab */
  }
}

/**
 * Admin session. Reads are public; writes need a session from
 * POST /api/auth/login (username + password), sent as a Bearer token and kept
 * in sessionStorage until it expires (12 h) or a write answers 401.
 *
 * status: "checking" on start, "open" when the API accepts writes without
 * credentials (local dev), "in" with a valid session, "out" otherwise.
 */
export const useAdmin = defineStore('admin', () => {
  const session = ref<Stored | null>(readStored())
  const status = ref<'checking' | 'open' | 'in' | 'out'>('checking')
  const expired = ref(false)
  const username = computed(() => session.value?.username ?? '')
  const canEdit = computed(() => status.value === 'open' || status.value === 'in')
  let expiryTimer: ReturnType<typeof setTimeout> | undefined

  function apply(s: Stored | null) {
    session.value = s
    writeStored(s)
    setAdminToken(s?.token ?? '')
    clearTimeout(expiryTimer)
    if (s) {
      const ms = Date.parse(s.expiresAt) - Date.now()
      expiryTimer = setTimeout(() => logout('expired'), Math.max(0, Math.min(ms, 2 ** 31 - 1)))
    }
  }
  apply(session.value)

  function logout(reason: 'manual' | 'expired' = 'manual') {
    const had = session.value
    apply(null)
    expired.value = reason === 'expired' && !!had
    if (status.value !== 'open') status.value = 'out'
    if (had && reason === 'manual') api.logout().catch(() => {})
  }

  setUnauthorizedHandler(() => {
    if (status.value === 'in') logout('expired')
  })

  /** login exchanges username + password for a session. */
  async function login(user: string, password: string): Promise<void> {
    try {
      const r = await api.login(user.trim(), password)
      apply({ token: r.token, username: r.username, expiresAt: r.expires_at })
      expired.value = false
      status.value = 'in'
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) throw new Error('Usuário ou senha inválidos.')
      if (err instanceof ApiError && err.status === 429) {
        throw new Error('Muitas tentativas. Espere um pouco e tente de novo.')
      }
      throw err
    }
  }

  let started: Promise<void> | null = null
  /** init runs once: validates a stored session, or learns the write mode. */
  function init(): Promise<void> {
    started ??= (async () => {
      try {
        if (session.value) {
          await api.me()
          status.value = 'in'
          return
        }
        const { mode } = await api.authStatus()
        status.value = mode === 'open' ? 'open' : 'out'
      } catch (err) {
        if (err instanceof ApiError && err.status === 401 && session.value) logout('expired')
        else status.value = 'out'
      }
    })()
    return started
  }

  return { status, canEdit, expired, username, init, login, logout }
})
