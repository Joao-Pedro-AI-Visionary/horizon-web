<script setup lang="ts">
import { computed } from 'vue'
import { staggerDelay } from '../lib/motion'

// Page header in the news-app style: a small section line, a bold headline
// whose words rise in sequence, a lead paragraph and the actions.
// `muted` dims the last N words of the headline (contrast emphasis).
const props = defineProps<{ index: string; section: string; title: string; muted?: number; lead?: string }>()
const words = computed(() => {
  const ws = props.title.split(' ')
  const cut = ws.length - (props.muted ?? 0)
  return ws.map((w, i) => ({ w, dim: i >= cut }))
})
</script>

<template>
  <header class="pt-4 pb-6 md:pt-6 md:pb-8">
    <div class="flex items-start justify-between gap-4 text-sm font-medium text-muted">
      <p>{{ section }}</p>
      <div class="text-right"><slot name="meta" /></div>
    </div>
    <div class="mt-1 grid items-end gap-5 xl:grid-cols-12">
      <h1 class="display-xl xl:col-span-8" :aria-label="title">
        <template v-for="(w, i) in words" :key="i">
          <span class="word" aria-hidden="true"><span :class="w.dim ? 'text-muted' : ''" :style="{ '--d': staggerDelay(i) }">{{ w.w }}</span></span>{{ ' ' }}
        </template>
      </h1>
      <div class="flex flex-col gap-4 xl:col-span-4 xl:items-end xl:text-right">
        <p v-if="lead" class="max-w-md text-base text-muted">{{ lead }}</p>
        <div v-if="$slots.actions" class="flex flex-wrap gap-2 xl:justify-end"><slot name="actions" /></div>
      </div>
    </div>
  </header>
</template>
