<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { FeedItem, VoteResult } from '../api/types'
import { fmtDateTime, fmtRelative, fmtScore, hostOf } from '../lib/format'
import AppIcon from './AppIcon.vue'
import SourceAvatar from './SourceAvatar.vue'
import VoteControls from './VoteControls.vue'

// News card of the shot (white, large radius, soft shadow): source avatar,
// source name and relative time, a round action button, the bold title and
// real engagement: LLM score, anonymous vote controls, other sources and tags.
// The title is the card's single stretched link (card guide); the original
// link, vote controls and tag buttons stay independent controls above it.
const props = withDefaults(
  defineProps<{ item: FeedItem; threshold?: number; activeTag?: string; level?: 2 | 3; maxTags?: number; testid?: string }>(),
  { threshold: 6, level: 3, maxTags: 2, testid: 'feed-card' },
)
defineEmits<{ tag: [t: string]; vote: [res: VoteResult] }>()

const when = computed(() => props.item.published_at ?? props.item.projected_at)
const strong = computed(() => props.item.score >= props.threshold)
const tags = computed(() => (props.item.tags ?? []).slice(0, props.maxTags))

const cardEl = ref<HTMLElement | null>(null)
const visibleSince = ref(0)
let io: IntersectionObserver | null = null

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !cardEl.value) {
    visibleSince.value = Date.now()
    return
  }
  io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting) && visibleSince.value === 0) {
        visibleSince.value = Date.now()
        io?.disconnect()
        io = null
      }
    },
    { threshold: 0.35 },
  )
  io.observe(cardEl.value)
})

onUnmounted(() => {
  io?.disconnect()
  io = null
})
</script>

<template>
  <article ref="cardEl" class="news-card" :data-testid="testid" :data-item-id="item.item_id">
    <header class="flex items-center gap-3">
      <SourceAvatar :kind="item.source_kind" />
      <p class="min-w-0 flex-1 leading-tight">
        <span class="flex items-center gap-1.5 font-display text-[15px] font-bold">
          <span class="truncate">{{ item.source_name }}</span>
        </span>
        <span class="mt-0.5 block truncate text-xs text-muted">
          <time :datetime="when" :title="fmtDateTime(when)">{{ fmtRelative(when) }}</time>
          <span aria-hidden="true"> · </span>{{ hostOf(item.url) }}
        </span>
      </p>
      <a
        :href="item.url"
        target="_blank"
        rel="noopener noreferrer"
        class="btn-icon size-11 shadow-none"
        :aria-label="`Abrir original: ${item.title} (nova aba)`"
        title="Abrir original"
        data-testid="open-original"
      >
        <AppIcon name="external" :size="17" />
      </a>
    </header>

    <component :is="`h${level}`" class="font-display text-lg leading-snug font-bold tracking-tight break-words text-fg md:text-xl">
      <RouterLink :to="`/items/${item.item_id}`" class="card-link" data-testid="open-item">{{ item.title }}</RouterLink>
    </component>

    <p v-if="item.summary" class="line-clamp-3 text-sm leading-relaxed text-muted">{{ item.summary }}</p>

    <footer class="mt-auto flex flex-wrap items-center gap-2 pt-1">
      <span
        class="score-pill"
        :class="strong ? 'border-accent/25 bg-tint text-accent' : ''"
        :title="strong ? 'Nota acima do corte do digest' : 'Nota abaixo do corte do digest'"
        data-testid="score-pill"
      >
        <AppIcon name="star" :size="13" /> <span class="sr-only">Nota</span> {{ fmtScore(item.score) }}
      </span>
      <RouterLink
        v-if="item.duplicate_count > 0"
        :to="`/items/${item.item_id}`"
        class="score-pill hover:border-fg/30"
        :aria-label="`Mais ${item.duplicate_count} ${item.duplicate_count === 1 ? 'fonte' : 'fontes'} com a mesma notícia`"
        data-testid="dup-chip"
      >
        <AppIcon name="layers" :size="13" /> +{{ item.duplicate_count }} {{ item.duplicate_count === 1 ? 'fonte' : 'fontes' }}
      </RouterLink>
      <button
        v-for="t in tags"
        :key="t"
        type="button"
        class="score-pill cursor-pointer font-medium text-muted hover:border-fg/30 hover:text-fg"
        :class="activeTag === t ? 'border-primary text-fg' : ''"
        :aria-pressed="activeTag === t"
        :aria-label="`Filtrar pela tag ${t}`"
        data-testid="tag-chip"
        @click="$emit('tag', t)"
      >
        #{{ t }}
      </button>
      <div class="ml-auto">
        <VoteControls
          :item-id="item.item_id"
          :likes="item.likes"
          :user-vote="item.user_vote"
          :dwell-since="visibleSince"
          @voted="$emit('vote', $event)"
        />
      </div>
    </footer>
  </article>
</template>
