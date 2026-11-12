<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage } from '../api/client'
import AppIcon from '../components/AppIcon.vue'
import { useAdmin } from '../stores/admin'
import { useToasts } from '../stores/toast'

// Admin sign-in (POST /api/auth/login). Only a discreet footer link points
// here; the session is a Bearer token kept in sessionStorage for 12 h.
const admin = useAdmin()
const route = useRoute()
const router = useRouter()
const toasts = useToasts()

const username = ref('')
const password = ref('')
const show = ref(false)
const busy = ref(false)
const error = ref('')
const userInput = ref<HTMLInputElement | null>(null)

function next(): string {
  const r = String(route.query.next ?? '')
  return r.startsWith('/') && !r.startsWith('//') && !r.startsWith('/login') ? r : '/sources'
}

async function submit() {
  error.value = ''
  if (!username.value.trim() || !password.value) {
    error.value = 'Preencha usuário e senha.'
    return
  }
  busy.value = true
  try {
    await admin.login(username.value, password.value)
    password.value = ''
    toasts.success(`Bem-vindo, ${admin.username}.`)
    router.replace(next())
  } catch (err) {
    error.value = errorMessage(err)
    password.value = ''
  } finally {
    busy.value = false
  }
}

function logout() {
  admin.logout()
  toasts.info('Você saiu.')
}

onMounted(() => userInput.value?.focus())
</script>

<template>
  <div class="grid min-h-[70dvh] place-items-center py-8">
    <section class="card-float w-full max-w-md p-6 md:p-8" aria-labelledby="login-h" data-testid="login">
      <p class="eyebrow text-accent">Área restrita</p>
      <h1 id="login-h" class="mt-1 font-display text-3xl font-bold tracking-tight">Entrar</h1>

      <template v-if="admin.status === 'in'">
        <p class="mt-3 text-muted" data-testid="login-already">Você já entrou como <strong class="text-fg">{{ admin.username }}</strong>.</p>
        <div class="mt-6 grid gap-2">
          <RouterLink to="/sources" class="btn-primary w-full justify-center">Ir para Fontes &amp; Config</RouterLink>
          <button type="button" class="btn-ghost w-full" data-testid="login-logout" @click="logout">Sair</button>
        </div>
      </template>

      <form v-else class="mt-6 grid gap-4" novalidate data-testid="login-form" @submit.prevent="submit">
        <p v-if="admin.expired" class="rounded-2xl bg-tint p-3 text-sm text-fg" role="status" data-testid="login-expired">Sua sessão expirou. Entre de novo.</p>
        <div>
          <label for="login-user" class="label">Usuário</label>
          <input
            id="login-user"
            ref="userInput"
            v-model="username"
            name="username"
            type="text"
            class="field"
            autocomplete="username"
            autocapitalize="off"
            spellcheck="false"
            required
            :aria-invalid="error ? 'true' : undefined"
            aria-describedby="login-err"
            data-testid="login-username"
          />
        </div>
        <div>
          <label for="login-pass" class="label">Senha</label>
          <div class="relative">
            <input
              id="login-pass"
              v-model="password"
              name="password"
              :type="show ? 'text' : 'password'"
              class="field pr-14"
              autocomplete="current-password"
              required
              :aria-invalid="error ? 'true' : undefined"
              aria-describedby="login-err"
              data-testid="login-password"
            />
            <button
              type="button"
              class="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-primary"
              :aria-pressed="show"
              :aria-label="show ? 'Ocultar senha' : 'Mostrar senha'"
              data-testid="login-password-toggle"
              @click="show = !show"
            >
              <AppIcon :name="show ? 'eyeOff' : 'eye'" :size="18" />
            </button>
          </div>
        </div>
        <p id="login-err" class="min-h-5 text-sm text-danger" role="alert" data-testid="login-error">{{ error }}</p>
        <p class="-mt-2 text-right text-sm"><RouterLink to="/forgot" class="inline-flex min-h-11 items-center text-muted underline-offset-4 hover:text-fg hover:underline" data-testid="forgot-link">Esqueci minha senha</RouterLink></p>
        <button type="submit" class="btn-primary w-full" :disabled="busy" :aria-busy="busy" data-testid="login-submit">
          {{ busy ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
    </section>
  </div>
</template>
