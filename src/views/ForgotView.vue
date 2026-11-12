<script setup lang="ts">
import { ref } from 'vue'
import { api, errorMessage } from '../api/client'

// "Esqueci minha senha": one button. The API mails a 30 min link to the
// address configured on the server; it never takes a recipient from here.
const busy = ref(false)
const sent = ref('')
const error = ref('')

async function send() {
  busy.value = true
  error.value = ''
  try {
    sent.value = (await api.forgot()).message
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="grid min-h-[70dvh] place-items-center py-8">
    <section class="card-float w-full max-w-md p-6 md:p-8" aria-labelledby="forgot-h" data-testid="forgot">
      <p class="eyebrow text-accent">Área restrita</p>
      <h1 id="forgot-h" class="mt-1 font-display text-3xl font-bold tracking-tight">Esqueci minha senha</h1>
      <p class="mt-3 text-muted">Enviamos um link para o e-mail do admin. Ele vale 30 minutos e funciona uma vez.</p>

      <p v-if="sent" class="mt-6 rounded-2xl bg-tint p-4 text-sm text-fg" role="status" data-testid="forgot-sent">{{ sent }}</p>
      <button v-else type="button" class="btn-primary mt-6 w-full" :disabled="busy" :aria-busy="busy" data-testid="forgot-submit" @click="send">
        {{ busy ? 'Enviando…' : 'Enviar link para meu e-mail' }}
      </button>
      <p class="mt-3 min-h-5 text-sm text-danger" role="alert" data-testid="forgot-error">{{ error }}</p>

      <p class="mt-2 text-center text-sm">
        <RouterLink to="/login" class="inline-flex min-h-11 items-center text-muted underline-offset-4 hover:text-fg hover:underline" data-testid="forgot-back">Voltar para o login</RouterLink>
      </p>
    </section>
  </div>
</template>
