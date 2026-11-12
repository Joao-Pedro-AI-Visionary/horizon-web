<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { api, errorMessage } from '../api/client'
import type { AdminAlert, AlertKind } from '../api/types'
import AppIcon from './AppIcon.vue'

// Admin-only error badge. AppShell mounts it only while logged in, so a
// visitor never triggers the request nor gets any of this in the DOM.
const REFRESH_MS = 3 * 60_000

const alerts = ref<AdminAlert[]>([])
const count = ref(0)
const open = ref(false)
const loading = ref(false)
const error = ref('')
const root = ref<HTMLElement | null>(null)
const button = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
let timer: ReturnType<typeof setInterval> | undefined
let ctrl: AbortController | undefined

async function refresh() {
  ctrl?.abort()
  ctrl = new AbortController()
  loading.value = true
  try {
    const r = await api.adminAlerts(ctrl.signal)
    alerts.value = r.alerts ?? []
    count.value = r.count ?? alerts.value.length
    error.value = ''
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') return
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

async function toggle() {
  open.value = !open.value
  if (open.value) {
    refresh()
    await nextTick()
    panel.value?.focus()
  }
}

function close(focusButton = true) {
  if (!open.value) return
  open.value = false
  if (focusButton) button.value?.focus()
}

function onDocClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) close(false)
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) close()
}

onMounted(() => {
  refresh()
  timer = setInterval(refresh, REFRESH_MS)
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  clearInterval(timer)
  ctrl?.abort()
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})

const kindLabel: Record<AlertKind, string> = { source: 'Fonte', scoring: 'Pontuação', digest: 'Digest', collection: 'Coleta' }
const brt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const fmtBRT = (iso: string) => `${brt.format(new Date(iso))} BRT`

// "rss GET https://host/feed: status 429" -> "status 429"; long text is cut.
function shortMessage(m: string): string {
  const s = m.replace(/^\w+ GET \S+: /, '').replace(/https?:\/\/\S+/g, (u) => {
    try {
      return new URL(u).host
    } catch {
      return u
    }
  })
  return s.length > 140 ? `${s.slice(0, 139)}…` : s
}

const label = computed(() => (count.value === 1 ? '1 alerta de erro' : `${count.value} alertas de erro`))
</script>

<template>
  <div v-if="count > 0 || open" ref="root" class="relative" data-testid="admin-alerts">
    <button
      ref="button"
      type="button"
      class="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-danger px-3 text-xs font-bold text-white shadow-sm transition-transform duration-150 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger motion-reduce:transition-none"
      :aria-expanded="open"
      aria-controls="admin-alerts-panel"
      :aria-label="`${label}. ${open ? 'Fechar' : 'Ver'} lista`"
      data-testid="alerts-badge"
      @click.stop="toggle"
    >
      <AppIcon name="alert" :size="15" />
      <span class="num" data-testid="alerts-count">{{ count }}</span>
    </button>

    <section
      v-if="open"
      id="admin-alerts-panel"
      ref="panel"
      tabindex="-1"
      role="region"
      aria-labelledby="admin-alerts-h"
      class="card-float fixed top-20 right-[max(1rem,env(safe-area-inset-right))] left-[max(1rem,env(safe-area-inset-left))] z-50 max-h-[70dvh] overflow-y-auto overscroll-contain p-4 outline-none max-md:top-[calc(5rem+env(safe-area-inset-top))] max-md:max-h-[calc(100dvh-6rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:absolute md:top-full md:right-0 md:left-auto md:mt-2 md:w-[24rem]"
      data-testid="alerts-panel"
    >
      <header class="mb-3 flex items-center justify-between gap-3">
        <h2 id="admin-alerts-h" class="font-display text-base font-bold">Erros recentes <span class="text-muted">· 48 h</span></h2>
        <button type="button" class="grid size-11 place-items-center rounded-full text-muted hover:bg-ink hover:text-fg" aria-label="Fechar alertas" @click="close()">
          <AppIcon name="close" :size="16" />
        </button>
      </header>
      <p v-if="error" class="rounded-2xl bg-tint p-3 text-sm text-danger" role="alert">{{ error }}</p>
      <p v-else-if="!loading && alerts.length === 0" class="text-sm text-muted" role="status">Nenhum erro aberto.</p>
      <p class="sr-only" aria-live="polite">{{ loading ? 'Atualizando alertas…' : '' }}</p>
      <ul class="grid gap-2" data-testid="alerts-list">
        <li v-for="(a, i) in alerts" :key="`${a.kind}-${a.source_id ?? a.name}-${i}`" class="rounded-2xl border border-line bg-surface p-3" data-testid="alert-item">
          <div class="flex items-baseline justify-between gap-3 text-xs">
            <span class="font-semibold text-danger">{{ kindLabel[a.kind] ?? a.kind }}</span>
            <time class="num shrink-0 text-muted" :datetime="a.at">{{ fmtBRT(a.at) }}</time>
          </div>
          <RouterLink
            v-if="a.source_id"
            :to="{ path: '/sources', hash: `#source-${a.source_id}` }"
            class="mt-1 block font-display text-sm font-semibold underline-offset-4 hover:underline"
            data-testid="alert-source-link"
            @click="close(false)"
            >{{ a.name }}</RouterLink
          >
          <p v-else class="mt-1 font-display text-sm font-semibold">{{ a.name }}</p>
          <p class="mt-1 text-xs break-words text-muted" :title="a.message">{{ shortMessage(a.message) }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>
