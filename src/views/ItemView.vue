<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { api, errorMessage } from '../api/client'
import type { ItemDetail } from '../api/types'
import AppIcon from '../components/AppIcon.vue'
import SourceAvatar from '../components/SourceAvatar.vue'
import StatePanel from '../components/StatePanel.vue'
import { fmtDateLong, fmtDateTime, fmtRelative, fmtScore, hostOf, kindLabel } from '../lib/format'
import { useToasts } from '../stores/toast'
import { staggerDelay } from '../lib/motion'

const route = useRoute()
const router = useRouter()
const item = ref<ItemDetail | null>(null)
const loading = ref(true)
const error = ref('')
const notFound = ref(false)
let ctrl: AbortController | undefined

async function load() {
  ctrl?.abort()
  ctrl = new AbortController()
  loading.value = true
  error.value = ''
  notFound.value = false
  try {
    item.value = await api.item(Number(route.params.id), ctrl.signal)
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    notFound.value = (err as { status?: number }).status === 404
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}
watch(() => route.params.id, load, { immediate: true })
onUnmounted(() => ctrl?.abort())

// Digest threshold decides the score colour, like in the feed.
const threshold = ref(6)
onMounted(async () => {
  try {
    threshold.value = (await api.settings()).score_threshold
  } catch {
    /* keep the default colour rule; the score itself comes from the item */
  }
})

const statusLabel: Record<string, string> = { raw: 'Aguardando nota', scored: 'Com nota', deduped: 'Processado', duplicate: 'Duplicado', failed: 'Falhou' }
const duplicates = computed(() => item.value?.duplicates ?? [])

// Summary with bold lead words (the shot's body text), purely typographic.
const lead = computed(() => {
  const words = (item.value?.summary ?? '').split(/\s+/).filter(Boolean)
  const n = Math.min(3, Math.max(0, words.length - 1))
  return { head: words.slice(0, n).join(' '), tail: words.slice(n).join(' ') }
})
const strong = computed(() => item.value?.score != null && item.value.score >= threshold.value)

// Share (the round share button of the shot): native share sheet when the
// browser has one, otherwise copy the original link.
const toasts = useToasts()
async function share() {
  const it = item.value
  if (!it) return
  try {
    if (navigator.share) {
      await navigator.share({ title: it.title, url: it.url })
      return
    }
    await navigator.clipboard.writeText(it.url)
    toasts.success('Link do original copiado.')
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    toasts.error('Não foi possível compartilhar este link.')
  }
}

function back() {
  if (window.history.state?.back) router.back()
  else router.push('/')
}
</script>

<template>
  <div class="pt-4 md:pt-6">
    <!-- Top bar (shot: back · title · action) -->
    <div class="flex items-center justify-between gap-3">
      <button type="button" class="btn-icon" aria-label="Voltar" title="Voltar" data-testid="back" @click="back">
        <AppIcon name="back" :size="18" />
      </button>
      <p class="font-display text-base font-bold">Notícia <span class="font-medium text-muted tabular-nums">#{{ route.params.id }}</span></p>
      <button type="button" class="btn-icon" :disabled="!item" aria-label="Compartilhar link do original" title="Compartilhar" data-testid="item-share" @click="share">
        <AppIcon name="share" :size="18" />
      </button>
    </div>

    <div v-if="loading && !item" class="mt-6 space-y-4" data-testid="item-loading" aria-hidden="true">
      <div class="skeleton h-44" />
      <div class="skeleton -mt-10 h-96" />
    </div>
    <StatePanel v-else-if="notFound" class="mt-8" kind="empty" title="Notícia não encontrada" detail="Ela pode ter sido removida junto com a fonte." testid="item-not-found">
      <RouterLink to="/" class="btn-primary" data-testid="go-feed">Ir para o feed</RouterLink>
    </StatePanel>
    <StatePanel v-else-if="error" class="mt-8" kind="error" title="Não foi possível carregar a notícia" :detail="error" @retry="load" />

    <div v-else-if="item" class="mt-6 grid gap-8 lg:grid-cols-12">
      <article class="min-w-0 lg:col-span-8" data-testid="item-detail">
        <!-- Hero: no images in the API, so the score and the source set the type -->
        <div class="article-hero flex min-h-44 items-end justify-between gap-4 px-6 pt-6 pb-16 md:min-h-56 md:px-8">
          <div>
            <p class="text-sm font-semibold text-fg/75">Nota do LLM</p>
            <p class="font-display text-6xl leading-none font-extrabold tracking-tight md:text-7xl" data-testid="item-score">
              {{ fmtScore(item.score) }}<span class="text-2xl font-bold text-fg/60 md:text-3xl">/10</span>
            </p>
          </div>
          <div class="text-right">
            <p class="inline-flex rounded-full bg-surface/80 px-3 py-1 text-xs font-semibold" :class="strong ? 'text-accent' : 'text-muted'">
              {{ strong ? 'Acima do corte do digest' : 'Abaixo do corte do digest' }}
            </p>
            <p class="mt-2 text-sm font-semibold text-fg/75" data-testid="item-status">{{ statusLabel[item.status] ?? item.status }}</p>
          </div>
        </div>

        <!-- White panel rising over the hero -->
        <div class="article-panel relative -mt-10 p-6 md:p-8">
          <header>
            <div class="flex items-center gap-3">
              <SourceAvatar :kind="item.source_kind" />
              <p class="min-w-0 flex-1 leading-tight">
                <span class="block truncate font-display text-[15px] font-bold">{{ item.source_name }}</span>
                <span class="mt-0.5 block text-xs text-muted"><time :datetime="item.published_at ?? item.fetched_at">{{ fmtRelative(item.published_at ?? item.fetched_at) }}</time></span>
              </p>
            </div>
            <h1 class="display-lg mt-5 break-words">{{ item.title }}</h1>
            <p class="mt-3 text-sm font-medium text-muted">
              <time :datetime="item.published_at ?? item.fetched_at">{{ fmtDateLong(item.published_at ?? item.fetched_at) }}</time>
            </p>
            <!-- Meta row (shot: author · source · likes) -->
            <ul class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-line py-3 text-sm font-semibold" data-testid="item-meta">
              <li v-if="item.author" class="flex items-center gap-1.5"><AppIcon name="user" :size="15" class="text-muted" /> Por {{ item.author }}</li>
              <li>{{ kindLabel[item.source_kind] ?? item.source_kind }} · <span class="font-medium text-muted">{{ hostOf(item.url) }}</span></li>
              <li class="flex items-center gap-1.5"><AppIcon name="layers" :size="15" class="text-muted" /> {{ duplicates.length ? `+${duplicates.length} ${duplicates.length === 1 ? 'fonte' : 'fontes'}` : 'Fonte única' }}</li>
            </ul>
          </header>

          <section v-if="item.summary" class="mt-6" aria-labelledby="sum-h">
            <h2 id="sum-h" class="sr-only">Resumo</h2>
            <p class="text-lg leading-relaxed text-fg/80" data-testid="item-summary"><strong class="font-bold text-fg">{{ lead.head }}</strong> {{ lead.tail }}</p>
          </section>

          <section class="mt-6 rounded-3xl bg-tint p-5" aria-labelledby="reason-h">
            <h2 id="reason-h" class="flex items-center gap-2 text-sm font-bold text-accent"><AppIcon name="star" :size="15" /> Por que essa nota</h2>
            <p class="mt-2 leading-relaxed text-fg/85" data-testid="item-reason">{{ item.score_reason || 'A notícia ainda não recebeu nota do LLM.' }}</p>
          </section>

          <section v-if="item.tags?.length" class="mt-6" aria-labelledby="tags-h">
            <h2 id="tags-h" class="sr-only">Tags</h2>
            <ul class="flex flex-wrap gap-2">
              <li v-for="t in item.tags" :key="t">
                <RouterLink :to="{ path: '/', query: { tag: t } }" class="news-chip min-h-10 px-4 text-xs max-md:min-h-11" data-testid="item-tag">#{{ t }}</RouterLink>
              </li>
            </ul>
          </section>

          <a :href="item.url" target="_blank" rel="noopener noreferrer" class="btn-primary group mt-7 min-h-12 w-full sm:w-auto" data-testid="item-original">
            Abrir original em {{ hostOf(item.url) }} <AppIcon name="external" :size="16" class="nudge" />
          </a>

          <section v-if="item.content" class="mt-8" aria-labelledby="content-h">
            <h2 id="content-h" class="eyebrow">Conteúdo coletado</h2>
            <p class="mt-3 max-h-80 overflow-y-auto border-t border-line pt-4 pr-2 text-sm whitespace-pre-line text-fg/70 break-words" tabindex="0">{{ item.content }}</p>
          </section>
        </div>
      </article>

      <!-- Aside: meta + cluster -->
      <aside class="flex flex-col gap-6 lg:col-span-4">
        <section class="news-card" aria-labelledby="meta-h">
          <h2 id="meta-h" class="font-display text-lg font-bold">Linha do tempo</h2>
          <dl class="text-sm">
            <div v-for="[k, v] in ([['Publicado', item.published_at], ['Coletado', item.fetched_at], ['Nota em', item.scored_at]] as const)" :key="k" class="flex justify-between gap-4 border-t border-line py-3">
              <dt class="text-muted">{{ k }}</dt>
              <dd class="font-medium tabular-nums">{{ fmtDateTime(v) }}</dd>
            </div>
          </dl>
          <p v-if="item.last_error" class="rounded-2xl bg-danger/10 p-3 text-xs break-words text-danger" role="note">{{ item.last_error }}</p>
        </section>

        <section class="news-card" aria-labelledby="cluster-h" data-testid="cluster">
          <div class="flex items-center justify-between gap-2">
            <h2 id="cluster-h" class="flex items-center gap-2 font-display text-lg font-bold"><AppIcon name="layers" :size="18" class="text-accent" /> Cluster</h2>
            <span v-if="item.cluster" class="text-xs text-muted tabular-nums">#{{ item.cluster.id }}</span>
          </div>
          <template v-if="item.cluster">
            <p class="text-sm text-fg/85 break-words">{{ item.cluster.title }}</p>
            <p class="flex items-baseline gap-2">
              <span class="font-display text-4xl font-extrabold">{{ item.cluster.item_count }}</span>
              <span class="text-sm text-muted">{{ item.cluster.item_count === 1 ? 'item' : 'itens' }} · {{ item.is_primary ? 'este é o principal' : 'este é um duplicado' }}</span>
            </p>
            <RouterLink v-if="!item.is_primary && item.cluster.representative_item_id" :to="`/items/${item.cluster.representative_item_id}`" class="btn-ghost w-full" data-testid="open-primary">Ver notícia principal</RouterLink>
          </template>
          <p v-else class="text-sm text-muted">Ainda sem cluster — o dedup roda depois da nota.</p>

          <h3 class="eyebrow mt-2">Mesma notícia em outras fontes ({{ duplicates.length }})</h3>
          <p v-if="duplicates.length === 0" class="text-sm text-muted" data-testid="no-duplicates">Nenhuma outra fonte trouxe esta notícia.</p>
          <ul v-else data-testid="duplicates">
            <li v-for="(d, i) in duplicates" :key="d.id" class="border-t border-line py-3">
              <div class="flex items-start gap-2">
                <RouterLink :to="`/items/${d.id}`" class="min-w-0 flex-1 py-1 text-sm font-semibold break-words hover:text-accent" data-testid="open-duplicate">{{ d.title }}</RouterLink>
                <a :href="d.url" target="_blank" rel="noopener noreferrer" class="-mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-ink hover:text-fg" :aria-label="`Abrir original: ${d.title} (nova aba)`" data-testid="duplicate-original">
                  <AppIcon name="external" :size="14" />
                </a>
              </div>
              <p class="mt-1 text-xs text-muted">{{ d.source_name }} · nota <span class="font-semibold text-accent">{{ fmtScore(d.score) }}</span></p>
              <div v-if="d.similarity !== null" class="mt-2 flex items-center gap-3">
                <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-raised" aria-hidden="true">
                  <div class="meter-fill h-full rounded-full bg-accent" :style="{ width: `${d.similarity * 100}%`, '--d': staggerDelay(i) }" />
                </div>
                <span class="text-xs font-semibold tabular-nums">{{ (d.similarity * 100).toFixed(0) }}% similar</span>
              </div>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>
