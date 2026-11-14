<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { api, errorMessage } from '../api/client'
import type { FeedItem } from '../api/types'
import { fmtRelative, fmtScore } from '../lib/format'
import { useAdmin } from '../stores/admin'
import AppIcon from './AppIcon.vue'

interface QuickLink {
  label: string
  hint: string
  to: RouteLocationRaw
  icon: 'feed' | 'flame' | 'digest' | 'metrics' | 'sources'
}

const emit = defineEmits<{ close: [] }>()
const router = useRouter()
const admin = useAdmin()

const query = ref('')
const results = ref<FeedItem[]>([])
const loading = ref(false)
const errText = ref('')
const activeIndex = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let ctrl: AbortController | undefined

const quickLinks = computed<QuickLink[]>(() => {
  const links: QuickLink[] = [
    { label: 'Feed principal', hint: 'Mais recentes', to: { path: '/' }, icon: 'feed' },
    { label: 'Em alta', hint: 'Tendências com decaimento', to: { path: '/', query: { sort: 'trending' } }, icon: 'flame' },
    { label: 'Digests diários', hint: 'Edições resumidas pela IA', to: { path: '/digests' }, icon: 'digest' },
    { label: 'Métricas', hint: 'Saúde e volume das fontes', to: { path: '/metrics' }, icon: 'metrics' },
  ]
  if (admin.canEdit) {
    links.push({ label: 'Fontes & Config', hint: 'Administração', to: { path: '/sources' }, icon: 'sources' })
  }
  return links
})

async function runSearch(term: string) {
  ctrl?.abort()
  const clean = term.trim()
  if (!clean) {
    results.value = []
    loading.value = false
    errText.value = ''
    activeIndex.value = 0
    return
  }
  const myCtrl = (ctrl = new AbortController())
  loading.value = true
  errText.value = ''
  try {
    const page = await api.feed({ q: clean, page: 1, page_size: 7 }, myCtrl.signal)
    if (ctrl !== myCtrl) return
    results.value = page.items ?? []
    activeIndex.value = 0
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    errText.value = errorMessage(err)
  } finally {
    if (ctrl === myCtrl) loading.value = false
  }
}

watch(query, (val) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    runSearch(val)
  }, 200)
})

const hasQuery = computed(() => query.value.trim().length > 0)
const optionCount = computed(() => (hasQuery.value ? results.value.length : quickLinks.value.length))

function selectActive() {
  if (hasQuery.value) {
    const item = results.value[activeIndex.value]
    if (item) {
      router.push(`/items/${item.item_id}`)
    } else {
      router.push({ path: '/', query: { q: query.value.trim() } })
    }
    emit('close')
    return
  }
  const link = quickLinks.value[activeIndex.value]
  if (link) {
    router.push(link.to)
    emit('close')
  }
}

function openAllInFeed() {
  const q = query.value.trim()
  router.push(q ? { path: '/', query: { q } } : '/')
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
    return
  }
  if (e.key === 'ArrowDown' && optionCount.value > 0) {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % optionCount.value
    return
  }
  if (e.key === 'ArrowUp' && optionCount.value > 0) {
    e.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + optionCount.value) % optionCount.value
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    selectActive()
  }
}

onMounted(async () => {
  await nextTick()
  inputEl.value?.focus()
})

onUnmounted(() => {
  clearTimeout(debounceTimer)
  ctrl?.abort()
})
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[min(12vh,5.5rem)] pb-6 backdrop-blur-xs"
    role="dialog"
    aria-modal="true"
    aria-label="Busca rápida"
    data-testid="command-search-dialog"
    @click.self="emit('close')"
    @keydown="onKeydown"
  >
    <div class="w-full max-w-xl overflow-hidden rounded-[24px] border border-line bg-surface shadow-[var(--shadow-lift)]">
      <div class="flex items-center gap-2 border-b border-line px-4 py-2">
        <AppIcon name="search" :size="18" class="text-muted" />
        <input
          ref="inputEl"
          v-model="query"
          type="search"
          class="min-h-11 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted"
          placeholder="Buscar notícias, fontes ou ir para seção…"
          aria-label="Buscar notícias"
          data-testid="cmdk-input"
        />
        <button
          type="button"
          class="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-raised hover:text-fg"
          aria-label="Fechar busca"
          data-testid="cmdk-close"
          @click="emit('close')"
        >
          <AppIcon name="close" :size="18" />
        </button>
      </div>

      <div class="max-h-[min(60vh,26rem)] overflow-y-auto p-2">
        <template v-if="!hasQuery">
          <p class="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">Navegação rápida</p>
          <ul class="space-y-1">
            <li v-for="(link, idx) in quickLinks" :key="link.label">
              <button
                type="button"
                class="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 text-left transition-colors"
                :class="activeIndex === idx ? 'bg-tint text-fg' : 'text-fg/85 hover:bg-raised'"
                @mouseenter="activeIndex = idx"
                @click="router.push(link.to); emit('close')"
              >
                <span class="flex items-center gap-3">
                  <AppIcon :name="link.icon" :size="17" class="text-accent" />
                  <span class="font-display text-sm font-semibold">{{ link.label }}</span>
                </span>
                <span class="text-xs text-muted">{{ link.hint }}</span>
              </button>
            </li>
          </ul>
        </template>

        <template v-else>
          <p v-if="loading" class="px-3 py-4 text-sm text-muted">Buscando no Radar…</p>
          <p v-else-if="errText" class="px-3 py-4 text-sm text-danger">{{ errText }}</p>
          <p v-else-if="results.length === 0" class="px-3 py-4 text-sm text-muted">Nenhuma notícia encontrada para “{{ query.trim() }}”.</p>
          <ul v-else class="space-y-1">
            <li v-for="(it, idx) in results" :key="it.item_id">
              <button
                type="button"
                class="flex min-h-12 w-full cursor-pointer items-start justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors"
                :class="activeIndex === idx ? 'bg-tint text-fg' : 'text-fg hover:bg-raised'"
                data-testid="cmdk-result"
                @mouseenter="activeIndex = idx"
                @click="router.push(`/items/${it.item_id}`); emit('close')"
              >
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-display text-sm font-semibold">{{ it.title }}</span>
                  <span class="mt-0.5 block text-xs text-muted">{{ it.source_name }} · {{ fmtRelative(it.published_at ?? it.projected_at) }}</span>
                </span>
                <span class="shrink-0 rounded-full border border-line bg-ink px-2.5 py-0.5 font-mono text-xs font-semibold text-accent tabular-nums">
                  {{ fmtScore(it.score) }}
                </span>
              </button>
            </li>
          </ul>
          <button
            type="button"
            class="mt-2 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-line text-xs font-semibold text-accent transition-colors hover:bg-tint"
            data-testid="cmdk-see-feed"
            @click="openAllInFeed"
          >
            Filtrar feed completo por “{{ query.trim() }}”
          </button>
        </template>
      </div>

      <div class="hidden items-center justify-between border-t border-line px-4 py-2 text-[11px] text-muted sm:flex">
        <span>↑↓ navegar · Enter abrir</span>
        <span>Esc fechar</span>
      </div>
    </div>
  </div>
</template>
