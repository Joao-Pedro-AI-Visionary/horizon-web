<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { FeedItem } from '../api/types'
import { fmtRelative } from '../lib/format'
import AppIcon from './AppIcon.vue'
import NewsCard from './NewsCard.vue'
import SourceAvatar from './SourceAvatar.vue'

// "Em alta": the stacked deck of the shot. The front card is the current
// top-scored item; the next two peek above it and fade out. Previous/next
// rotate through the real top items (GET /api/feed?sort=score).
const props = defineProps<{ items: FeedItem[]; threshold?: number; activeTag?: string }>()
defineEmits<{ tag: [t: string] }>()

const at = ref(0)
watch(
  () => props.items.map((i) => i.item_id).join(),
  () => (at.value = 0),
)
const n = computed(() => props.items.length)
const front = computed(() => props.items[at.value])
const behind = computed(() => [1, 2].map((k) => (n.value > k ? props.items[(at.value + k) % n.value] : undefined)).filter((x): x is FeedItem => !!x))
function go(step: number) {
  at.value = (at.value + step + n.value) % n.value
}
</script>

<template>
  <div v-if="front" data-testid="popular-deck">
    <div class="deck" :style="{ paddingTop: behind.length === 0 ? '0' : behind.length === 1 ? '2.75rem' : undefined }">
      <div
        v-for="(b, k) in behind"
        :key="b.item_id"
        class="deck-back news-card flex-row! items-start gap-3 px-4! py-1.5!"
        :class="`is-${k + 1}`"
        :style="behind.length === 1 ? { top: '0' } : undefined"
        aria-hidden="true"
        inert
      >
        <SourceAvatar :kind="b.source_kind" size="sm" />
        <p class="min-w-0 leading-tight">
          <span class="block truncate font-display text-sm font-bold">{{ b.source_name }}</span>
          <span class="block truncate text-xs text-muted">{{ fmtRelative(b.published_at ?? b.projected_at) }}</span>
        </p>
      </div>
      <Transition name="deck-swap" mode="out-in">
        <NewsCard
          :key="front.item_id"
          :item="front"
          :threshold="threshold"
          :active-tag="activeTag"
          :max-tags="3"
          testid="popular-card"
          class="z-10 shadow-[var(--shadow-lift)]"
          @tag="$emit('tag', $event)"
        />
      </Transition>
    </div>

    <div v-if="n > 1" class="mt-4 flex items-center justify-between gap-3">
      <p class="text-sm text-muted" aria-live="polite" data-testid="popular-position">
        <span class="sr-only">Destaque </span><span class="font-semibold text-fg tabular-nums">{{ at + 1 }}</span> de <span class="tabular-nums">{{ n }}</span>
      </p>
      <div class="flex gap-2">
        <button type="button" class="btn-icon" aria-label="Destaque anterior" data-testid="popular-prev" @click="go(-1)">
          <AppIcon name="chevronLeft" :size="18" />
        </button>
        <button type="button" class="btn-icon" aria-label="Próximo destaque" data-testid="popular-next" @click="go(1)">
          <AppIcon name="chevronRight" :size="18" />
        </button>
      </div>
    </div>
  </div>
</template>
