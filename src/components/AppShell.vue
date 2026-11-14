<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { api } from '../api/client'
import { theme, toggleTheme } from '../lib/theme'
import { useAdmin } from '../stores/admin'
import { useToasts } from '../stores/toast'
import AdminAlerts from './AdminAlerts.vue'
import AppIcon from './AppIcon.vue'
import InstallPrompt from './InstallPrompt.vue'
import ScrollProgress from './ScrollProgress.vue'

const CommandSearch = defineAsyncComponent(() => import('./CommandSearch.vue'))

const admin = useAdmin()
const toasts = useToasts()
function logout() {
  admin.logout()
  toasts.info('Você saiu.')
}

// md+: a top bar with the brand, a pill nav and the API health.
// <768px: a slim brand row and a floating pill bottom nav with round items;
// the active one shows its label and a soft green glow (as in the shot).
const allNav = [
  { to: '/', name: 'feed', label: 'Feed', icon: 'feed' },
  { to: '/digests', name: 'digests', label: 'Digests', icon: 'digest' },
  { to: '/sources', name: 'sources', label: 'Fontes & Config', short: 'Fontes', icon: 'sources' },
  { to: '/metrics', name: 'metrics', label: 'Métricas', icon: 'metrics' },
] as const

// Fontes & Config is admin-only: visitors see Feed, Digests and Métricas.
const nav = computed(() => allNav.filter((n) => n.name !== 'sources' || admin.canEdit))

// Signing out on an admin page sends the visitor back to the feed.
const route = useRoute()
const router = useRouter()
watch(
  () => admin.canEdit,
  (can) => {
    if (!can && admin.status !== 'checking' && route.meta.admin) router.replace('/')
  },
)

// Real API health (GET /healthz), refreshed every 30s.
const health = ref<'ok' | 'degraded' | 'down' | 'loading'>('loading')
let timer: ReturnType<typeof setInterval> | undefined
async function check() {
  try {
    const h = await api.health()
    health.value = h.status === 'ok' ? 'ok' : 'degraded'
  } catch (err) {
    health.value = (err as { status?: number }).status === 503 ? 'degraded' : 'down'
  }
}
onMounted(() => {
  check()
  timer = setInterval(check, 30_000)
  window.addEventListener('keydown', onGlobalKeydown)
})
onUnmounted(() => {
  clearInterval(timer)
  window.removeEventListener('keydown', onGlobalKeydown)
})

const searchOpen = ref(false)
let lastFocusBeforeSearch: HTMLElement | null = null
function openSearch() {
  lastFocusBeforeSearch = document.activeElement as HTMLElement | null
  searchOpen.value = true
}
function closeSearch() {
  searchOpen.value = false
  lastFocusBeforeSearch?.focus?.()
}
function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (searchOpen.value) closeSearch()
    else openSearch()
  }
}

const isTrending = computed(() => route.name === 'feed' && route.query.sort === 'trending')
const isFeedMain = computed(() => (route.name === 'feed' || route.name === 'item') && route.query.sort !== 'trending')
const isDigests = computed(() => String(route.name ?? '').startsWith('digest'))

const healthText = { ok: 'API online', degraded: 'API degradada', down: 'API offline', loading: 'Verificando API' }
const healthDot = { ok: 'bg-ok', degraded: 'bg-[#b7791f]', down: 'bg-danger', loading: 'bg-muted' }

function isActive(name: string, routeName: unknown) {
  const r = String(routeName ?? '')
  if (name === 'feed') return r === 'feed' || r === 'item'
  if (name === 'digests') return r.startsWith('digest')
  return r === name
}
</script>

<template>
  <div class="relative min-h-dvh">
    <ScrollProgress />
    <a
      href="#main"
      class="sr-only z-50 rounded-full bg-primary px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >Pular para o conteúdo</a
    >

    <header class="app-header">
      <div class="app-bar">
        <div class="container-ed flex h-(--header-bar) items-center gap-4">
          <RouterLink to="/" class="flex shrink-0 items-center gap-2.5 rounded-full max-md:min-h-11" data-testid="nav-logo" aria-label="Radar by JpDev — início">
            <img src="/jpdev-avatar.webp" alt="" class="size-9 rounded-full border border-line bg-surface object-cover" width="36" height="36" />
            <span class="leading-none">
              <span class="block font-display text-base font-extrabold tracking-tight">Radar</span>
              <span class="mt-0.5 block text-[11px] font-medium text-muted">by JpDev</span>
            </span>
          </RouterLink>

          <nav class="pill-nav mx-auto hidden items-center gap-1 md:flex" aria-label="Navegação principal">
            <RouterLink
              v-for="n in nav"
              :key="n.to"
              :to="n.to"
              :data-testid="`nav-${n.name}`"
              :aria-current="isActive(n.name, $route.name) ? 'page' : undefined"
              class="inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-display text-sm font-semibold transition-colors duration-200"
              :class="isActive(n.name, $route.name) ? 'bg-primary text-ink' : 'text-fg/75 hover:bg-ink hover:text-fg'"
            >
              <AppIcon :name="n.icon" :size="16" />
              <span><span class="lg:hidden">{{ 'short' in n ? n.short : n.label }}</span><span class="hidden lg:inline">{{ n.label }}</span></span>
            </RouterLink>
          </nav>

          <!-- One right-hand group: quick search (md+), alerts, theme toggle and API health. -->
          <div class="ml-auto flex items-center gap-2 md:ml-0 md:gap-2.5">
            <button
              type="button"
              class="hidden min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-xs font-medium text-muted transition-colors hover:border-fg/30 hover:text-fg md:inline-flex"
              aria-label="Abrir busca rápida (Ctrl+K)"
              data-testid="cmdk-open"
              @click="openSearch"
            >
              <AppIcon name="search" :size="14" />
              <span>Buscar</span>
              <kbd class="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] text-muted">Ctrl K</kbd>
            </button>
            <button
              type="button"
              class="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-fg transition-colors hover:border-fg/30"
              :aria-label="theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'"
              :aria-pressed="theme === 'dark'"
              :title="theme === 'dark' ? 'Tema claro' : 'Tema escuro'"
              data-testid="theme-toggle"
              @click="toggleTheme()"
            >
              <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" :size="17" />
            </button>
            <AdminAlerts v-if="admin.status === 'in'" />
            <div class="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted" role="status" data-testid="api-health">
              <span class="relative flex size-2.5">
                <span v-if="health === 'ok'" class="absolute inset-0 animate-ping rounded-full bg-ok/50 motion-reduce:hidden" aria-hidden="true" />
                <span class="relative size-2.5 rounded-full" :class="healthDot[health]" aria-hidden="true" />
              </span>
              <span class="max-[370px]:hidden">{{ healthText[health] }}</span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main id="main" tabindex="-1" class="relative isolate z-10 container-ed pb-10 md:pb-12">
      <slot />
    </main>

    <InstallPrompt />

    <!-- Discreet admin access: only "Entrar" (logged out) or "Sair" (logged in). -->
    <footer class="container-ed flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5 pb-[calc(8rem+env(safe-area-inset-bottom))] text-xs text-muted md:pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div class="flex flex-wrap items-center gap-3">
        <span>Radar by JpDev</span>
        <a href="/rss.xml" class="inline-flex min-h-11 items-center gap-1 rounded-full px-2 underline-offset-4 hover:text-fg hover:underline" data-testid="rss-feed-link">
          <AppIcon name="feed" :size="13" />
          RSS Feed
        </a>
        <a href="/digests/rss.xml" class="inline-flex min-h-11 items-center gap-1 rounded-full px-2 underline-offset-4 hover:text-fg hover:underline" data-testid="rss-digests-link">
          <AppIcon name="digest" :size="13" />
          RSS Digests
        </a>
      </div>
      <span v-if="admin.status === 'in'" class="flex items-center gap-3">
        <span data-testid="footer-user">{{ admin.username }}</span>
        <button type="button" class="min-h-11 rounded-full px-2 font-medium text-fg underline-offset-4 hover:underline max-md:min-w-11" data-testid="logout" @click="logout">Sair</button>
      </span>
      <RouterLink v-else-if="admin.status === 'out' && $route.name !== 'login'" to="/login" class="inline-flex min-h-11 items-center rounded-full px-2 underline-offset-4 hover:text-fg hover:underline" data-testid="login-link">Entrar</RouterLink>
    </footer>

    <!-- Floating pill bottom nav (mobile: Feed, Em alta, Digests, Busca) -->
    <nav
      class="pill-nav fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(1rem+env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-40 mx-auto flex w-fit items-center gap-1 md:hidden"
      aria-label="Navegação principal"
    >
      <RouterLink
        to="/"
        data-testid="bnav-feed"
        :aria-current="isFeedMain ? 'page' : undefined"
        aria-label="Feed"
        class="pill-nav-item font-display text-sm font-semibold"
      >
        <AppIcon name="feed" :size="20" />
        <span v-if="isFeedMain" aria-hidden="true">Feed</span>
      </RouterLink>
      <RouterLink
        :to="{ path: '/', query: { sort: 'trending' } }"
        data-testid="bnav-trending"
        :aria-current="isTrending ? 'page' : undefined"
        aria-label="Em alta"
        class="pill-nav-item font-display text-sm font-semibold"
      >
        <AppIcon name="flame" :size="20" />
        <span v-if="isTrending" aria-hidden="true">Em alta</span>
      </RouterLink>
      <RouterLink
        to="/digests"
        data-testid="bnav-digests"
        :aria-current="isDigests ? 'page' : undefined"
        aria-label="Digests"
        class="pill-nav-item font-display text-sm font-semibold"
      >
        <AppIcon name="digest" :size="20" />
        <span v-if="isDigests" aria-hidden="true">Digests</span>
      </RouterLink>
      <button
        type="button"
        data-testid="bnav-search"
        :aria-expanded="searchOpen"
        aria-label="Busca"
        class="pill-nav-item cursor-pointer font-display text-sm font-semibold"
        @click="openSearch"
      >
        <AppIcon name="search" :size="20" />
      </button>
      <RouterLink
        v-if="admin.canEdit"
        to="/sources"
        data-testid="bnav-sources"
        :aria-current="$route.name === 'sources' ? 'page' : undefined"
        aria-label="Fontes & Config"
        class="pill-nav-item font-display text-sm font-semibold"
      >
        <AppIcon name="sources" :size="20" />
        <span v-if="$route.name === 'sources'" aria-hidden="true">Fontes</span>
      </RouterLink>
    </nav>

    <CommandSearch v-if="searchOpen" @close="closeSearch" />
  </div>
</template>
