<script setup lang="ts">
import { ref } from 'vue'
import { api, errorMessage } from '../api/client'
import AppIcon from './AppIcon.vue'

const props = withDefaults(defineProps<{ idPrefix?: string }>(), { idPrefix: 'nl' })

const email = ref('')
const busy = ref(false)
const doneMsg = ref('')
const errMsg = ref('')

async function submit() {
  errMsg.value = ''
  doneMsg.value = ''
  const v = email.value.trim()
  if (!v || !v.includes('@')) {
    errMsg.value = 'Digite um e-mail válido.'
    return
  }
  busy.value = true
  try {
    const res = await api.subscribeNewsletter(v)
    doneMsg.value = res.message
    if (res.status === 'pending') email.value = ''
  } catch (err) {
    errMsg.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="news-card bg-surface" :aria-labelledby="`${idPrefix}-title`" data-testid="newsletter-box">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div class="min-w-0">
        <p class="eyebrow flex items-center gap-1.5 text-accent">
          <AppIcon name="mail" :size="14" /> Resumo diário
        </p>
        <h2 :id="`${idPrefix}-title`" class="mt-1 font-display text-lg font-bold tracking-tight">
          Receba o Top 5–7 todo dia às 08h
        </h2>
        <p class="mt-1 text-sm text-muted">
          Confirmação em duas etapas por e-mail e descadastro com um clique em toda edição.
        </p>
      </div>

      <form class="flex w-full flex-col gap-2 sm:flex-row md:max-w-md" novalidate @submit.prevent="submit">
        <label :for="`${idPrefix}-email`" class="sr-only">Seu e-mail para receber o digest</label>
        <input
          :id="`${idPrefix}-email`"
          v-model="email"
          type="email"
          autocomplete="email"
          inputmode="email"
          placeholder="voce@exemplo.com"
          required
          class="field min-h-12 flex-1"
          data-testid="newsletter-email"
        />
        <button type="submit" class="btn-primary min-h-12 shrink-0 px-5" :disabled="busy" data-testid="newsletter-submit">
          {{ busy ? 'Enviando…' : 'Inscrever' }}
        </button>
      </form>
    </div>

    <p v-if="doneMsg" class="rounded-2xl bg-tint px-4 py-2.5 text-sm font-medium text-accent" role="status" data-testid="newsletter-status">
      {{ doneMsg }}
    </p>
    <p v-else-if="errMsg" class="rounded-2xl bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger" role="alert" data-testid="newsletter-error">
      {{ errMsg }}
    </p>
  </section>
</template>
