<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '../api/client'
import AppIcon from './AppIcon.vue'

// md+: a top bar with the brand, a pill nav and the API health.
// <768px: a slim brand row and a floating pill bottom nav with round items;
// the active one shows its label and a soft green glow (as in the shot).
const nav = [
  { to: '/', name: 'feed', label: 'Feed', icon: 'feed' },
  { to: '/digests', name: 'digests', label: 'Digests', icon: 'digest' },
  { to: '/sources', name: 'sources', label: 'Fontes & Config', short: 'Fontes', icon: 'sources' },
  { to: '/metrics', name: 'metrics', label: 'Métricas', icon: 'metrics' },
] as const

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
})
onUnmounted(() => clearInterval(timer))

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
    <a
      href="#main"
      class="sr-only z-50 rounded-full bg-primary px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >Pular para o conteúdo</a
    >

    <header class="sticky top-0 z-40 bg-ink/75 backdrop-blur-md max-md:static max-md:bg-transparent max-md:backdrop-blur-none">
      <div class="container-ed flex h-16 items-center gap-4 md:h-20">
        <RouterLink to="/" class="flex shrink-0 items-center gap-2.5 rounded-full" data-testid="nav-logo" aria-label="Radar by JpDev — início">
          <img src="/jpdev-logo.png" alt="" class="size-9 rounded-full border border-line bg-surface object-cover object-top" width="36" height="36" />
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

        <div class="ml-auto flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted md:ml-0" role="status" data-testid="api-health">
          <span class="relative flex size-2.5">
            <span v-if="health === 'ok'" class="absolute inset-0 animate-ping rounded-full bg-ok/50 motion-reduce:hidden" aria-hidden="true" />
            <span class="relative size-2.5 rounded-full" :class="healthDot[health]" aria-hidden="true" />
          </span>
          <span>{{ healthText[health] }}</span>
        </div>
      </div>
    </header>

    <main id="main" tabindex="-1" class="relative z-10 container-ed pb-36 md:pb-16">
      <slot />
    </main>

    <!-- Floating pill bottom nav (mobile) -->
    <nav
      class="pill-nav fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 md:hidden"
      aria-label="Navegação principal"
    >
      <RouterLink
        v-for="n in nav"
        :key="n.to"
        :to="n.to"
        :data-testid="`bnav-${n.name}`"
        :aria-current="isActive(n.name, $route.name) ? 'page' : undefined"
        :aria-label="n.label"
        class="pill-nav-item font-display text-sm font-semibold"
      >
        <AppIcon :name="n.icon" :size="20" />
        <span v-if="isActive(n.name, $route.name)" aria-hidden="true">{{ 'short' in n ? n.short : n.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>
