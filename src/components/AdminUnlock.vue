<script setup lang="ts">
import { ref } from 'vue'
import { errorMessage } from '../api/client'
import { useAdmin } from '../stores/admin'
import { useToasts } from '../stores/toast'
import AppIcon from './AppIcon.vue'

// Unlocks editing with the HORIZON_ADMIN_TOKEN. The token is checked against
// POST /api/auth/check and kept only in this browser's localStorage.
const admin = useAdmin()
const toasts = useToasts()

const token = ref('')
const show = ref(false)
const busy = ref(false)
const error = ref('')

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await admin.unlock(token.value)
    token.value = ''
    show.value = false
    toasts.success('Edição desbloqueada neste navegador.')
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}

function lock() {
  admin.lock()
  toasts.info('Edição bloqueada. O token foi apagado deste navegador.')
}
</script>

<template>
  <section class="card-float p-5 md:p-6" aria-labelledby="admin-h" :data-state="admin.status" data-testid="admin-unlock">
    <div class="flex items-start gap-3">
      <span
        class="grid size-11 shrink-0 place-items-center rounded-full"
        :class="admin.canEdit ? 'bg-primary text-ink' : 'bg-raised text-muted'"
        aria-hidden="true"
      >
        <AppIcon :name="admin.canEdit ? 'unlock' : 'lock'" :size="18" />
      </span>
      <div class="min-w-0">
        <p class="eyebrow text-accent">Acesso</p>
        <h2 id="admin-h" class="font-display text-xl font-bold tracking-tight" data-testid="admin-state" aria-live="polite">
          {{ admin.status === 'checking' ? 'Verificando acesso…' : admin.canEdit ? 'Edição liberada' : 'Somente leitura' }}
        </h2>
        <p class="mt-1 text-sm text-muted">
          <template v-if="admin.status === 'open'">A API local aceita edições sem token.</template>
          <template v-else-if="admin.status === 'unlocked'">O token de admin está salvo só neste navegador.</template>
          <template v-else>Você vê tudo, mas só quem tem o token de admin edita fontes, configurações e roda coletas.</template>
        </p>
      </div>
    </div>

    <p v-if="admin.disabled" class="mt-4 rounded-2xl bg-danger/10 p-3 text-sm text-danger" role="alert" data-testid="admin-disabled">
      O servidor está sem HORIZON_ADMIN_TOKEN: ninguém consegue editar até ele ser configurado.
    </p>
    <p v-if="admin.expired && admin.status === 'locked'" class="mt-4 rounded-2xl bg-danger/10 p-3 text-sm text-danger" role="alert" data-testid="admin-expired">
      O token salvo foi recusado pela API. Desbloqueie de novo.
    </p>

    <form v-if="admin.status === 'locked' && !admin.disabled" class="mt-4 grid gap-2" novalidate data-testid="admin-form" @submit.prevent="submit">
      <input type="text" name="username" value="horizon-admin" autocomplete="username" class="sr-only" tabindex="-1" aria-hidden="true" readonly />
      <label for="admin-token" class="label">Token de admin</label>
      <div class="relative">
        <input
          id="admin-token"
          v-model="token"
          :type="show ? 'text' : 'password'"
          class="field pr-14 font-mono"
          autocomplete="current-password"
          autocapitalize="off"
          spellcheck="false"
          required
          :aria-invalid="error ? 'true' : undefined"
          :aria-describedby="error ? 'admin-token-err' : 'admin-token-hint'"
          data-testid="admin-token"
        />
        <button
          type="button"
          class="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-primary"
          :aria-pressed="show"
          :aria-label="show ? 'Ocultar token' : 'Mostrar token'"
          data-testid="admin-token-toggle"
          @click="show = !show"
        >
          <AppIcon :name="show ? 'eyeOff' : 'eye'" :size="18" />
        </button>
      </div>
      <p v-if="error" id="admin-token-err" class="text-sm text-danger" role="alert" data-testid="admin-error">{{ error }}</p>
      <p v-else id="admin-token-hint" class="text-xs text-muted">O mesmo valor de HORIZON_ADMIN_TOKEN no servidor.</p>
      <button type="submit" class="btn-primary mt-1 w-full" :disabled="busy || !token.trim()" :aria-busy="busy" data-testid="admin-submit">
        <AppIcon name="unlock" :size="16" /> {{ busy ? 'Verificando…' : 'Desbloquear edição' }}
      </button>
    </form>

    <button v-else-if="admin.status === 'unlocked'" type="button" class="btn-ghost mt-4 w-full" data-testid="admin-lock" @click="lock">
      <AppIcon name="lock" :size="16" /> Bloquear e apagar token
    </button>
  </section>
</template>
