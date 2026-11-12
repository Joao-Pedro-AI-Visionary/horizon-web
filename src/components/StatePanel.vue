<script setup lang="ts">
import AppIcon from './AppIcon.vue'

// Empty / error state with an optional retry action.
defineProps<{ kind: 'empty' | 'error'; title: string; detail?: string; testid?: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div
    class="news-card items-start py-10 md:py-12"
    :role="kind === 'error' ? 'alert' : 'status'"
    :data-testid="testid ?? `state-${kind}`"
  >
    <span class="eyebrow flex items-center gap-2" :class="kind === 'error' ? 'text-danger' : 'text-accent'">
      <AppIcon :name="kind === 'error' ? 'alert' : 'layers'" :size="14" /> {{ kind === 'error' ? 'Erro' : 'Vazio' }}
    </span>
    <p class="max-w-3xl font-display text-2xl font-bold tracking-tight md:text-3xl">{{ title }}</p>
    <p v-if="detail" class="max-w-xl text-muted">{{ detail }}</p>
    <div v-if="$slots.default || kind === 'error'" class="mt-3 flex flex-wrap gap-2">
      <slot />
      <button v-if="kind === 'error'" type="button" class="btn-ghost" data-testid="retry" @click="$emit('retry')">
        <AppIcon name="refresh" :size="16" /> Tentar de novo
      </button>
    </div>
  </div>
</template>
