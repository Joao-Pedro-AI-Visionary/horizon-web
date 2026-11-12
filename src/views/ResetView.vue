<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, api, errorMessage } from '../api/client'
import AppIcon from '../components/AppIcon.vue'
import { useToasts } from '../stores/toast'

// New password from the e-mailed link (/reset?token=...). The token is read
// once and dropped from the address bar so it is not kept in history.
const MIN = 10
const route = useRoute()
const router = useRouter()
const toasts = useToasts()

const token = ref('')
const password = ref('')
const confirm = ref('')
const show = ref(false)
const busy = ref(false)
const error = ref('')
const input = ref<HTMLInputElement | null>(null)

onMounted(() => {
  token.value = String(route.query.token ?? '')
  if (token.value) router.replace({ path: '/reset' })
  input.value?.focus()
})

async function submit() {
  error.value = ''
  if (!token.value) {
    error.value = 'Link inválido. Peça um novo em "Esqueci minha senha".'
    return
  }
  if ([...password.value].length < MIN) {
    error.value = `A senha precisa ter pelo menos ${MIN} caracteres.`
    return
  }
  if (password.value !== confirm.value) {
    error.value = 'As senhas não conferem.'
    return
  }
  busy.value = true
  try {
    await api.resetPassword(token.value, password.value)
    password.value = confirm.value = token.value = ''
    toasts.success('Senha alterada. Entre com a senha nova.')
    router.replace('/login')
  } catch (err) {
    error.value = err instanceof ApiError && err.status === 400 ? err.message.replace(/^./, (c) => c.toUpperCase()) + '.' : errorMessage(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="grid min-h-[70dvh] place-items-center py-8">
    <section class="card-float w-full max-w-md p-6 md:p-8" aria-labelledby="reset-h" data-testid="reset">
      <p class="eyebrow text-accent">Área restrita</p>
      <h1 id="reset-h" class="mt-1 font-display text-3xl font-bold tracking-tight">Nova senha</h1>
      <p v-if="!token && !busy" class="mt-3 rounded-2xl bg-tint p-3 text-sm" data-testid="reset-no-token">
        Abra o link do e-mail, ou peça outro em <RouterLink to="/forgot" class="font-semibold underline underline-offset-4">Esqueci minha senha</RouterLink>.
      </p>

      <form class="mt-6 grid gap-4" novalidate data-testid="reset-form" @submit.prevent="submit">
        <div>
          <label for="reset-pass" class="label">Senha nova</label>
          <div class="relative">
            <input
              id="reset-pass"
              ref="input"
              v-model="password"
              :type="show ? 'text' : 'password'"
              class="field pr-14"
              autocomplete="new-password"
              :minlength="MIN"
              required
              :aria-invalid="error ? 'true' : undefined"
              aria-describedby="reset-hint reset-err"
              data-testid="reset-password"
            />
            <button
              type="button"
              class="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-primary"
              :aria-pressed="show"
              :aria-label="show ? 'Ocultar senhas' : 'Mostrar senhas'"
              @click="show = !show"
            >
              <AppIcon :name="show ? 'eyeOff' : 'eye'" :size="18" />
            </button>
          </div>
          <p id="reset-hint" class="mt-1 text-xs text-muted">Pelo menos {{ MIN }} caracteres.</p>
        </div>
        <div>
          <label for="reset-confirm" class="label">Confirme a senha</label>
          <input
            id="reset-confirm"
            v-model="confirm"
            :type="show ? 'text' : 'password'"
            class="field"
            autocomplete="new-password"
            required
            :aria-invalid="error ? 'true' : undefined"
            aria-describedby="reset-err"
            data-testid="reset-confirm"
          />
        </div>
        <p id="reset-err" class="min-h-5 text-sm text-danger" role="alert" data-testid="reset-error">{{ error }}</p>
        <button type="submit" class="btn-primary w-full" :disabled="busy" :aria-busy="busy" data-testid="reset-submit">
          {{ busy ? 'Salvando…' : 'Salvar senha nova' }}
        </button>
      </form>
    </section>
  </div>
</template>
