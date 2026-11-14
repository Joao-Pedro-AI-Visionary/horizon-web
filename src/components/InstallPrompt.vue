<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { canInstall, dismissInstall, initPwaInstall, installDismissed, installed, triggerInstall } from '../lib/pwa'
import AppIcon from './AppIcon.vue'

onMounted(() => {
  initPwaInstall()
})

const visible = computed(() => canInstall.value && !installed.value && !installDismissed.value)
</script>

<template>
  <aside
    v-if="visible"
    class="container-ed mb-4"
    aria-label="Instalar aplicativo Radar by JpDev"
    data-testid="pwa-install-banner"
  >
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
      <div class="flex min-w-0 items-center gap-3">
        <img src="/icons/icon-192.png" alt="" class="size-10 shrink-0 rounded-xl border border-line object-cover" width="40" height="40" />
        <div class="min-w-0">
          <p class="font-display text-sm font-bold text-fg">Instalar Radar no dispositivo</p>
          <p class="text-xs text-muted">Acesso rápido ao feed diário sem barra do navegador.</p>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          class="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-ink transition-opacity hover:opacity-90"
          data-testid="pwa-install-btn"
          @click="triggerInstall()"
        >
          <AppIcon name="download" :size="15" />
          Instalar
        </button>
        <button
          type="button"
          class="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line px-3.5 text-xs font-medium text-muted transition-colors hover:border-fg/30 hover:text-fg"
          aria-label="Dispensar aviso de instalação"
          data-testid="pwa-dismiss-btn"
          @click="dismissInstall()"
        >
          Agora não
        </button>
      </div>
    </div>
  </aside>
</template>
