<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { buildShareLinks, itemPermalink } from '../lib/share'
import { useToasts } from '../stores/toast'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  itemId: number
  title: string
}>()

const toasts = useToasts()
const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined

const pageUrl = computed(() => itemPermalink(props.itemId))
const links = computed(() => buildShareLinks(props.title, pageUrl.value))

async function copyLink() {
  try {
    await navigator.clipboard.writeText(pageUrl.value)
    copied.value = true
    toasts.success('Link da notícia copiado.')
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => {
      copied.value = false
    }, 2200)
  } catch {
    toasts.error('Não foi possível copiar o link.')
  }
}

onUnmounted(() => clearTimeout(resetTimer))
</script>

<template>
  <div class="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4" role="group" aria-label="Compartilhar esta notícia" data-testid="share-bar">
    <span class="mr-1 text-xs font-medium text-muted">Compartilhar:</span>
    <a
      :href="links.x"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-xs font-medium text-fg transition-colors hover:border-fg/30"
      aria-label="Compartilhar no X"
      data-testid="share-x"
    >
      X
    </a>
    <a
      :href="links.linkedin"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-xs font-medium text-fg transition-colors hover:border-fg/30"
      aria-label="Compartilhar no LinkedIn"
      data-testid="share-linkedin"
    >
      LinkedIn
    </a>
    <a
      :href="links.whatsapp"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-xs font-medium text-fg transition-colors hover:border-fg/30"
      aria-label="Compartilhar no WhatsApp"
      data-testid="share-whatsapp"
    >
      WhatsApp
    </a>
    <button
      type="button"
      class="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-xs font-medium text-fg transition-colors hover:border-fg/30"
      :aria-label="copied ? 'Link copiado' : 'Copiar link da notícia'"
      data-testid="share-copy"
      @click="copyLink"
    >
      <AppIcon :name="copied ? 'check' : 'copy'" :size="14" />
      {{ copied ? 'Copiado' : 'Copiar link' }}
    </button>
  </div>
</template>
