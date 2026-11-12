import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, api, setAdminToken, setUnauthorizedHandler } from '../api/client'

const STORAGE_KEY = 'horizon.adminToken'

function readStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeStored(token: string) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* private mode: the token lives for this tab only */
  }
}

/**
 * Admin unlock for write calls. Reads are public; every write needs the
 * HORIZON_ADMIN_TOKEN, which the admin types once and the browser keeps in
 * localStorage. Nothing about it is baked into the bundle.
 *
 * status: "checking" on start, "open" when the API accepts writes without a
 * token (local dev), "unlocked" with a token, "locked" otherwise.
 */
export const useAdmin = defineStore('admin', () => {
  const token = ref(readStored())
  const status = ref<'checking' | 'open' | 'unlocked' | 'locked'>('checking')
  const expired = ref(false)
  setAdminToken(token.value)

  const canEdit = computed(() => status.value === 'open' || status.value === 'unlocked')

  function lock(reason: 'manual' | 'expired' = 'manual') {
    token.value = ''
    writeStored('')
    setAdminToken('')
    expired.value = reason === 'expired'
    status.value = 'locked'
  }

  setUnauthorizedHandler(() => {
    if (status.value === 'unlocked') lock('expired')
  })

  /** unlock validates the token against the API before keeping it. */
  async function unlock(candidate: string): Promise<void> {
    const t = candidate.trim()
    if (!t) throw new Error('Cole o token de admin.')
    try {
      await api.authCheck(t)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) throw new Error('Token inválido. Confira e tente de novo.')
      throw err
    }
    token.value = t
    writeStored(t)
    setAdminToken(t)
    expired.value = false
    status.value = 'unlocked'
  }

  let started: Promise<void> | null = null
  /** init checks the stored token once (or whether writes are open). */
  function init(): Promise<void> {
    started ??= (async () => {
      try {
        await api.authCheck(token.value)
        status.value = token.value ? 'unlocked' : 'open'
      } catch (err) {
        if (err instanceof ApiError && err.status === 401 && token.value) lock('expired')
        else status.value = 'locked'
      }
    })()
    return started
  }

  return { status, canEdit, expired, init, unlock, lock }
})
