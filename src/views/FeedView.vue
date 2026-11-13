<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, api, errorMessage } from '../api/client'
import type { CollectReport, FeedItem, FeedPage, FeedParams, Source, TimelineParams } from '../api/types'
import AppIcon from '../components/AppIcon.vue'
import CountUp from '../components/CountUp.vue'
import DisclosurePanel from '../components/DisclosurePanel.vue'
import NewsCard from '../components/NewsCard.vue'
import PopularDeck from '../components/PopularDeck.vue'
import SegmentedControl from '../components/SegmentedControl.vue'
import StatePanel from '../components/StatePanel.vue'
import TimelineScrubber from '../components/TimelineScrubber.vue'
import { fmtNumber, fmtScore, fmtToday } from '../lib/format'
import { reducedMotion } from '../lib/motion'
import { rankTags } from '../lib/tags'
import { useAdmin } from '../stores/admin'
import { useToasts } from '../stores/toast'

const route = useRoute()
const router = useRouter()
const toasts = useToasts()
const admin = useAdmin()
const PAGE_SIZE = 12

// Filters live in the URL so every view of the feed is a deep link.
const filters = computed<FeedParams>(() => {
  const q = route.query
  const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v))
  // A custom range from the date scrubber (from/to) replaces the period.
  const from = (q.from as string) || undefined
  return {
    q: (q.q as string) || undefined,
    tag: (q.tag as string) || undefined,
    source_id: num(q.source_id),
    // Default: the whole history (the collector may not have run this week).
    period: from ? undefined : (((q.period as string) || 'all') as FeedParams['period']),
    from,
    to: from ? (q.to as string) || undefined : undefined,
    min_score: num(q.min_score),
    // The list is a news feed (most recent first); "Em alta" holds the top scores.
    sort: ((q.sort as string) || 'recent') as FeedParams['sort'],
    page: num(q.page) ?? 1,
    page_size: PAGE_SIZE,
  }
})

function setFilter(patch: Record<string, string | number | undefined>) {
  const next: Record<string, string> = {}
  const merged = { ...route.query, page: undefined, ...patch }
  for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== '' && v !== null) next[k] = String(v)
  router.replace({ query: next })
}

const periods = [
  { v: '24h', l: '24h' },
  { v: '7d', l: '7 dias' },
  { v: '30d', l: '30 dias' },
  { v: 'all', l: 'Tudo' },
] as const
const sorts = [
  { v: 'recent', l: 'Recentes' },
  { v: 'score', l: 'Maior nota' },
] as const

// Source, tag and minimum score sit in a disclosure (progressive
// disclosure); it opens by itself when one of them becomes active.
const advancedCount = computed(() => {
  const f = filters.value
  return [f.tag, f.source_id, f.min_score, f.from].filter(Boolean).length
})
const filtersOpen = ref(advancedCount.value > 0)
watch(advancedCount, (n, old) => {
  if (n > 0 && old === 0) filtersOpen.value = true
})

// Non-time filters shared with the scrubber histogram.
const timelineParams = computed<TimelineParams>(() => {
  const f = filters.value
  return { q: f.q, tag: f.tag, source_id: f.source_id, min_score: f.min_score }
})
function setRange(r: { from: string; to?: string }) {
  setFilter({ from: r.from, to: r.to, period: undefined })
}
function clearRange() {
  setFilter({ from: undefined, to: undefined })
}

// Search (the round search button of the shot): server-side, GET /api/feed?q=.
const searchOpen = ref(!!filters.value.q)
const searchInput = ref<HTMLInputElement | null>(null)
async function openSearch() {
  searchOpen.value = true
  await nextTick()
  searchInput.value?.focus()
}
function closeSearch() {
  searchText.value = ''
  setFilter({ q: undefined })
  searchOpen.value = false
}
const searchText = ref(filters.value.q ?? '')
let debounce: ReturnType<typeof setTimeout> | undefined
watch(searchText, (v) => {
  clearTimeout(debounce)
  debounce = setTimeout(() => setFilter({ q: v.trim() || undefined }), 350)
})
const minScore = ref(filters.value.min_score ?? 0)
const tagText = ref(filters.value.tag ?? '')
watch(
  () => route.query,
  () => {
    tagText.value = filters.value.tag ?? ''
    minScore.value = filters.value.min_score ?? 0
    if ((filters.value.q ?? '') !== searchText.value.trim()) searchText.value = filters.value.q ?? ''
  },
)

const page = ref<FeedPage | null>(null)
const loading = ref(true)
const error = ref('')
let ctrl: AbortController | undefined

async function load() {
  ctrl?.abort()
  ctrl = new AbortController()
  loading.value = true
  error.value = ''
  try {
    page.value = await api.feed(filters.value, ctrl.signal)
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}
// "Em alta" deck: the top-scored items under the same filters.
const popular = ref<FeedItem[]>([])
let pctrl: AbortController | undefined
async function loadPopular() {
  pctrl?.abort()
  pctrl = new AbortController()
  try {
    popular.value = (await api.feed(popularParams(), pctrl.signal)).items ?? []
  } catch (err) {
    if ((err as Error).name !== 'AbortError') popular.value = []
  }
}
// Popular only depends on the filters, not on the list's order or page.
function popularParams(): FeedParams {
  const f = filters.value
  return { q: f.q, tag: f.tag, source_id: f.source_id, period: f.period, from: f.from, to: f.to, min_score: f.min_score, sort: 'score', page: 1, page_size: 5 }
}
const popularKey = computed(() => JSON.stringify(popularParams()))
watch(filters, load, { deep: true })
watch(popularKey, loadPopular)

// Category chips: "Todas" plus the most frequent real tags of the feed.
const topTags = ref<string[]>([])
async function loadTags() {
  try {
    topTags.value = rankTags((await api.feed({ period: 'all', sort: 'score', page: 1, page_size: 100 })).items ?? [], 6)
  } catch {
    topTags.value = []
  }
}
const chips = computed(() => {
  const t = filters.value.tag
  return t && !topTags.value.includes(t) ? [t, ...topTags.value] : topTags.value
})
function toggleTag(t: string | undefined) {
  setFilter({ tag: t && filters.value.tag !== t ? t : undefined })
}

// "Ver todas": the list switches to the highest scores and takes the focus.
const listHeading = ref<HTMLElement | null>(null)
async function seeAllPopular() {
  if (filters.value.sort !== 'score') setFilter({ sort: 'score' })
  await nextTick()
  listHeading.value?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
  listHeading.value?.focus({ preventScroll: true })
}

// Filter changes keep the scroll position (router scrollBehavior); only the
// pagination buttons bring the top of the list back into view.
const results = ref<HTMLElement | null>(null)
function goPage(p: number) {
  setFilter({ page: p })
  results.value?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
}

const sources = ref<Source[]>([])
const threshold = ref(6)
const thresholdLoaded = ref(false)
onMounted(async () => {
  load()
  loadPopular()
  loadTags()
  const [s, st] = await Promise.allSettled([api.sources(), api.settings()])
  if (s.status === 'fulfilled') sources.value = s.value.sources ?? []
  if (st.status === 'fulfilled') {
    threshold.value = st.value.score_threshold
    thresholdLoaded.value = true
  }
})
onUnmounted(() => {
  ctrl?.abort()
  pctrl?.abort()
})

const items = computed<FeedItem[]>(() => page.value?.items ?? [])
const totalPages = computed(() => (page.value ? Math.max(1, Math.ceil(page.value.total / page.value.page_size)) : 1))
const enabledSources = computed(() => sources.value.filter((s) => s.enabled).length)
const hasFilters = computed(() => {
  const f = filters.value
  return !!(f.q || f.tag || f.source_id || f.min_score || f.from || f.period !== 'all')
})

// Pipeline run (POST /api/pipeline/run): collects every enabled source and
// publishes to NATS; the worker scores and dedups before items reach the feed.
const running = ref(false)
const report = ref<CollectReport | null>(null)
async function runPipeline() {
  running.value = true
  try {
    report.value = await api.runPipeline()
    toasts.success(`Coleta concluída: ${report.value.published} novos itens publicados para o worker.`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 502 && err.body && typeof err.body === 'object' && 'run_id' in err.body) {
      report.value = err.body as CollectReport
      toasts.error(`Coleta terminou com erros: ${report.value.error ?? 'veja o relatório'}`)
    } else {
      toasts.error(errorMessage(err))
    }
  } finally {
    running.value = false
  }
  load()
  loadPopular()
  loadTags()
}
const today = fmtToday()
const runLabel: Record<string, string> = { ok: 'ok', skipped: 'pulada', error: 'erro' }
const reportLabels = { fetched: 'Coletados', published: 'Publicados', duplicates: 'Já vistos', invalid: 'Inválidos' } as const
</script>

<template>
  <div class="pt-4 md:pt-6">
    <!-- Header: date line, title, round actions (shot: "News Hub") -->
    <header class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="text-sm font-medium text-muted"><time :datetime="new Date().toISOString().slice(0, 10)">{{ today }}</time></p>
        <h1 class="display-xl mt-1">Central de notícias</h1>
      </div>
      <div class="flex shrink-0 gap-2 pt-1">
        <button
          type="button"
          class="btn-icon"
          :aria-expanded="searchOpen"
          aria-controls="feed-search"
          aria-label="Buscar notícias"
          title="Buscar"
          data-testid="open-search"
          @click="searchOpen ? closeSearch() : openSearch()"
        >
          <AppIcon :name="searchOpen ? 'close' : 'search'" :size="19" />
        </button>
        <button
          type="button"
          class="btn-icon"
          v-if="admin.canEdit"
          :disabled="running"
          :aria-busy="running"
          :aria-label="running ? 'Coletando fontes…' : 'Rodar pipeline (coletar fontes agora)'"
          :title="running ? 'Coletando fontes…' : 'Rodar pipeline'"
          data-testid="run-pipeline"
          @click="runPipeline"
        >
          <AppIcon name="refresh" :size="19" :class="running ? 'animate-spin' : ''" />
        </button>
      </div>
    </header>

    <!-- Search -->
    <Transition name="drop">
      <form v-if="searchOpen" id="feed-search" role="search" class="mt-5" @submit.prevent>
        <label for="f-search" class="sr-only">Buscar no feed</label>
        <div class="relative">
          <AppIcon name="search" :size="18" class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
          <input
            id="f-search"
            ref="searchInput"
            v-model="searchText"
            type="search"
            class="field min-h-12 rounded-full pl-11 text-base shadow-[var(--shadow-float)]"
            placeholder="Buscar por título, resumo ou motivo da nota…"
            maxlength="200"
            enterkeyhint="search"
            data-testid="filter-search"
            @keydown.esc="closeSearch"
          />
        </div>
      </form>
    </Transition>

    <!-- Category chips: real tags (GET /api/feed?tag=) -->
    <div class="chip-row mt-6" role="group" aria-label="Filtrar por tag" data-testid="chips">
      <button type="button" class="news-chip" :aria-pressed="!filters.tag" data-testid="chip-all" @click="toggleTag(undefined)">Todas</button>
      <button v-for="t in chips" :key="t" type="button" class="news-chip" :aria-pressed="filters.tag === t" data-testid="chip-tag" :data-tag="t" @click="toggleTag(t)">
        {{ t }}
      </button>
    </div>

    <!-- Summary (real numbers from /api/feed, /api/sources, /api/settings) -->
    <dl class="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted" aria-label="Resumo do feed">
      <div class="flex items-baseline gap-1.5">
        <dt class="sr-only">Notícias no feed</dt>
        <dd class="font-display text-base font-bold text-fg" data-testid="feed-total"><CountUp v-if="page" :value="page.total" :format="fmtNumber" /><span v-else>—</span></dd>
        <span aria-hidden="true">notícias</span>
      </div>
      <div class="flex items-baseline gap-1.5">
        <dt class="sr-only">Fontes ativas</dt>
        <dd class="font-semibold text-fg tabular-nums">{{ enabledSources }}/{{ sources.length }}</dd>
        <span aria-hidden="true">fontes ativas</span>
      </div>
      <div class="flex items-baseline gap-1.5">
        <dt>Corte do digest</dt>
        <dd class="font-semibold text-accent tabular-nums">{{ thresholdLoaded ? fmtScore(threshold) : '—' }}</dd>
      </div>
    </dl>

    <!-- Last pipeline report -->
    <Transition name="drop">
      <section v-if="report" class="news-card mt-6" aria-labelledby="report-title" data-testid="pipeline-report">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="eyebrow text-accent">Relatório da coleta</p>
            <h2 id="report-title" class="mt-1 font-display text-xl font-bold">Última coleta <span class="num text-xs font-normal text-muted">{{ report.run_id }}</span></h2>
          </div>
          <button type="button" class="btn-icon" aria-label="Fechar relatório" data-testid="close-report" @click="report = null">
            <AppIcon name="close" :size="16" />
          </button>
        </div>
        <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div v-for="k in (['fetched', 'published', 'duplicates', 'invalid'] as const)" :key="k" class="rounded-2xl bg-ink px-4 py-3">
            <dt class="eyebrow">{{ reportLabels[k] }}</dt>
            <dd class="mt-1 font-display text-3xl font-bold"><CountUp :value="report[k]" /></dd>
          </div>
        </dl>
        <ul class="flex flex-wrap gap-2">
          <li
            v-for="s in report.sources"
            :key="s.source_id"
            class="chip"
            :class="s.status === 'ok' ? 'border-accent/30 text-accent' : s.status === 'skipped' ? 'text-muted' : 'border-danger/40 text-danger'"
            :title="s.error || undefined"
            :data-status="s.status"
          >
            {{ s.source_name }} · {{ s.status === 'ok' ? `${s.item_count} itens` : (runLabel[s.status] ?? s.status) }}
          </li>
        </ul>
        <p class="text-xs text-muted">Os itens novos entram no feed depois que o worker dá a nota e faz o dedup.</p>
      </section>
    </Transition>

    <!-- More filters (progressive disclosure) -->
    <section class="mt-5 flex flex-col gap-3" aria-label="Filtros do feed">
      <DisclosurePanel v-model:open="filtersOpen" title="Mais filtros" testid="filters" tone="float" region>
        <template #summary>
          <span class="flex flex-wrap items-center gap-x-2 font-display text-sm font-bold">
            <AppIcon name="filter" :size="16" class="text-muted" /> Mais filtros
            <span class="text-xs font-medium text-muted max-sm:hidden">período · ordem · fonte · tag · nota mínima · linha do tempo</span>
            <span v-if="advancedCount" class="rounded-full bg-primary px-2 text-xs text-ink" data-testid="filters-count">{{ advancedCount }}</span>
          </span>
        </template>
        <div class="dz-group grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <div class="sm:col-span-2 lg:col-span-6">
            <span id="f-period-l" class="label">Período</span>
            <SegmentedControl
              :options="periods"
              :model-value="filters.from ? undefined : filters.period"
              labelledby="f-period-l"
              testid="filter-period"
              block
              @update:model-value="setFilter({ period: $event, from: undefined, to: undefined })"
            />
          </div>
          <div class="sm:col-span-2 lg:col-span-6">
            <span id="f-sort-l" class="label">Ordem da lista</span>
            <SegmentedControl :options="sorts" :model-value="filters.sort" labelledby="f-sort-l" testid="filter-sort" block @update:model-value="setFilter({ sort: $event })" />
          </div>
          <div class="lg:col-span-3">
            <label for="f-source" class="label">Fonte</label>
            <select id="f-source" class="field cursor-pointer" :value="filters.source_id ?? ''" data-testid="filter-source" @change="setFilter({ source_id: ($event.target as HTMLSelectElement).value || undefined })">
              <option value="">Todas</option>
              <option v-for="s in sources" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
          <div class="lg:col-span-3">
            <label for="f-tag" class="label">Tag</label>
            <input
              id="f-tag"
              v-model="tagText"
              class="field"
              placeholder="ex.: ai"
              maxlength="200"
              data-testid="filter-tag"
              @change="setFilter({ tag: tagText.trim() || undefined })"
              @keydown.enter="setFilter({ tag: tagText.trim() || undefined })"
            />
          </div>
          <div class="sm:col-span-2 lg:col-span-6">
            <div class="flex items-center justify-between">
              <label for="f-min" class="label">Nota mínima</label>
              <span class="-mt-1 text-sm font-semibold text-accent tabular-nums" aria-hidden="true">{{ minScore.toFixed(1) }}</span>
            </div>
            <input
              id="f-min"
              v-model.number="minScore"
              type="range"
              min="0"
              max="10"
              step="0.5"
              class="h-11 w-full cursor-pointer accent-accent"
              :aria-valuetext="`${minScore} de 10`"
              data-testid="filter-min-score"
              @change="setFilter({ min_score: minScore > 0 ? minScore : undefined })"
            />
          </div>
          <div class="sm:col-span-2 lg:col-span-12">
            <TimelineScrubber :params="timelineParams" :from="filters.from" :to="filters.to" :period="filters.period" @range="setRange" @clear="clearRange" />
          </div>
        </div>
      </DisclosurePanel>
      <div v-if="hasFilters" class="flex justify-end">
        <button type="button" class="btn-ghost" data-testid="clear-filters" @click="router.replace({ query: {} })">
          <AppIcon name="close" :size="14" /> Limpar filtros
        </button>
      </div>
    </section>

    <StatePanel v-if="error && !page" class="mt-8" kind="error" title="Não foi possível carregar o feed" :detail="error" @retry="load" />

    <div v-else class="mt-8 grid min-h-dvh grid-cols-1 content-start gap-10 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <!-- "Em alta" (shot: Popular News + See All) -->
      <section v-if="popular.length || (loading && !page)" class="min-w-0 lg:sticky lg:top-(--sticky-top) lg:self-start" aria-labelledby="popular-h">
        <div class="mb-3 flex items-center justify-between gap-3">
          <h2 id="popular-h" class="font-display text-xl font-bold tracking-tight">Em alta</h2>
          <button type="button" class="-mr-2 min-h-11 cursor-pointer rounded-full px-3 text-sm font-semibold text-muted hover:text-fg" data-testid="popular-see-all" @click="seeAllPopular">
            Ver todas<span class="sr-only"> as notícias por maior nota</span>
          </button>
        </div>
        <div v-if="!popular.length" class="skeleton h-72" aria-hidden="true" />
        <PopularDeck v-else :items="popular" :threshold="threshold" :active-tag="filters.tag" @tag="toggleTag" />
      </section>

      <!-- List -->
      <section ref="results" class="min-w-0 scroll-mt-2" :class="popular.length || (loading && !page) ? '' : 'lg:col-span-2'" aria-label="Itens do feed" :aria-busy="loading">
        <div class="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="list-h" ref="listHeading" tabindex="-1" class="scroll-mt-2 font-display text-xl font-bold tracking-tight" data-testid="list-heading">
            {{ filters.sort === 'score' ? 'Maior nota' : 'Mais recentes' }}
          </h2>
          <p v-if="page && page.total" class="text-sm text-muted tabular-nums">página {{ filters.page }} de {{ totalPages }}</p>
        </div>

        <div v-if="loading && !page" class="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="feed-loading" aria-hidden="true">
          <div v-for="i in 6" :key="i" class="skeleton h-56" />
        </div>
        <StatePanel
          v-else-if="items.length === 0"
          kind="empty"
          :title="hasFilters ? 'Nenhuma notícia com esses filtros' : 'O feed ainda está vazio'"
          :detail="hasFilters ? 'Afrouxe a nota mínima, troque o período ou limpe os filtros.' : 'Rode o pipeline para coletar as fontes ativas; o worker dá a nota e publica no feed.'"
          testid="feed-empty"
        >
          <button v-if="hasFilters" type="button" class="btn-ghost" data-testid="empty-clear" @click="router.replace({ query: {} })">Limpar filtros</button>
        </StatePanel>

        <template v-else>
          <ul class="grid grid-cols-1 gap-4 transition-opacity duration-200 md:grid-cols-2" :class="[loading ? 'opacity-50' : '', popular.length ? '' : 'xl:grid-cols-3']" data-testid="feed-list">
            <li v-for="(it, i) in items" :key="it.item_id" class="grid min-w-0 grid-cols-1">
              <NewsCard v-reveal="i" :item="it" :threshold="threshold" :active-tag="filters.tag" @tag="toggleTag" />
            </li>
          </ul>

          <nav class="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3" aria-label="Paginação" data-testid="pagination">
            <button type="button" class="btn-ghost group justify-self-start" :disabled="filters.page! <= 1 || loading" data-testid="page-prev" @click="goPage(filters.page! - 1)">
              <AppIcon name="chevronLeft" :size="16" /> Anterior
            </button>
            <p class="text-sm text-muted tabular-nums" aria-live="polite">
              <span class="sr-only">Página {{ filters.page }} de {{ totalPages }}</span>
              <span aria-hidden="true"><span class="font-display text-lg font-bold text-fg">{{ filters.page ?? 1 }}</span> / {{ totalPages }}</span>
            </p>
            <button type="button" class="btn-ghost group justify-self-end" :disabled="filters.page! >= totalPages || loading" data-testid="page-next" @click="goPage(filters.page! + 1)">
              Próxima <AppIcon name="chevronRight" :size="16" class="nudge" />
            </button>
          </nav>
        </template>
      </section>
    </div>
  </div>
</template>
