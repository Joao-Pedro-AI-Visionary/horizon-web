<script setup lang="ts">
import { computed } from 'vue'
import type { SourceKind } from '../api/types'
import AppIcon from './AppIcon.vue'

// Round source avatar (the logo circle of the shot). There are no source
// logos in the API, so it shows a mark per source kind, in AA colours.
const props = defineProps<{ kind: SourceKind | string; size?: 'sm' | 'md' }>()
const look = computed(
  () =>
    ({
      hackernews: { text: 'HN', cls: 'bg-[#ffe8d9] text-[#a33a00]' },
      reddit: { text: 'r/', cls: 'bg-[#ffe4dc] text-[#b3261e]' },
      rss: { text: '', cls: 'bg-tint text-accent' },
    })[props.kind as SourceKind] ?? { text: String(props.kind).slice(0, 2).toUpperCase(), cls: 'bg-raised text-fg' },
)
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-full font-display font-extrabold ring-4 ring-ink"
    :class="[look.cls, size === 'sm' ? 'size-9 text-xs' : 'size-11 text-sm']"
    aria-hidden="true"
    data-testid="source-avatar"
    :data-kind="kind"
  >
    <AppIcon v-if="kind === 'rss'" name="feed" :size="size === 'sm' ? 16 : 18" />
    <template v-else>{{ look.text }}</template>
  </span>
</template>
