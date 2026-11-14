<script setup lang="ts">
import { ref, watch } from 'vue'
import { api, errorMessage } from '../api/client'
import type { VoteResult } from '../api/types'
import { MIN_VOTE_DWELL_MS, computeDwellMs } from '../lib/device'
import { useToasts } from '../stores/toast'
import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    itemId: number
    likes?: number
    userVote?: number
    dwellSince: number
    compact?: boolean
  }>(),
  { likes: 0, userVote: 0, compact: true },
)

const emit = defineEmits<{ voted: [VoteResult] }>()
const toasts = useToasts()

const localLikes = ref(props.likes ?? 0)
const localVote = ref<number>(props.userVote ?? 0)
const busy = ref(false)

watch(
  () => [props.itemId, props.likes, props.userVote] as const,
  ([, likes, uv]) => {
    localLikes.value = likes ?? 0
    localVote.value = uv ?? 0
  },
)

async function cast(target: 1 | -1) {
  if (busy.value) return
  const nextVote: -1 | 0 | 1 = localVote.value === target ? 0 : target
  const dwellMs = computeDwellMs(props.dwellSince)
  if (nextVote !== 0 && dwellMs < MIN_VOTE_DWELL_MS) {
    toasts.info('Leia por alguns segundos antes de votar.')
    return
  }
  busy.value = true
  try {
    const res = await api.voteItem(props.itemId, nextVote, dwellMs)
    localLikes.value = res.likes
    localVote.value = res.user_vote
    emit('voted', res)
  } catch (err) {
    toasts.error(errorMessage(err))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="inline-flex items-center gap-1.5" role="group" aria-label="Avaliar notícia">
    <button
      type="button"
      class="inline-flex touch-manipulation cursor-pointer items-center justify-center gap-1.5 rounded-full border font-semibold tabular-nums transition-colors disabled:opacity-50"
      :class="[
        compact ? 'min-h-11 px-3 text-xs' : 'min-h-12 px-4 text-sm',
        localVote === 1
          ? 'border-accent/40 bg-tint text-accent'
          : 'border-line bg-surface text-fg hover:border-fg/30',
      ]"
      :aria-pressed="localVote === 1"
      :aria-label="`Curtir notícia (${localLikes} ${localLikes === 1 ? 'curtida' : 'curtidas'})`"
      :disabled="busy"
      data-testid="vote-like"
      @click="cast(1)"
    >
      <AppIcon name="thumbUp" :size="compact ? 14 : 16" />
      <span data-testid="vote-likes-count">{{ localLikes }}</span>
    </button>
    <button
      type="button"
      class="inline-flex touch-manipulation cursor-pointer items-center justify-center rounded-full border transition-colors disabled:opacity-50"
      :class="[
        compact ? 'size-11' : 'size-12',
        localVote === -1
          ? 'border-danger/40 bg-danger/10 text-danger'
          : 'border-line bg-surface text-muted hover:border-fg/30 hover:text-fg',
      ]"
      :aria-pressed="localVote === -1"
      aria-label="Não curtir notícia"
      title="Não curtir"
      :disabled="busy"
      data-testid="vote-dislike"
      @click="cast(-1)"
    >
      <AppIcon name="thumbDown" :size="compact ? 14 : 16" />
    </button>
  </div>
</template>
