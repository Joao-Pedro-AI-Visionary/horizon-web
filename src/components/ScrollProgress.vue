<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const progress = ref(0)
const cssDriven = ref(false)
let raf = 0

function update() {
  raf = 0
  const doc = document.documentElement
  const max = doc.scrollHeight - window.innerHeight
  progress.value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
}

function onScroll() {
  if (raf) return
  raf = requestAnimationFrame(update)
}

onMounted(() => {
  cssDriven.value = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('animation-timeline', 'scroll()')
  if (cssDriven.value) return
  update()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
})

onUnmounted(() => {
  if (raf) cancelAnimationFrame(raf)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <div
    class="scroll-progress pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-accent"
    :class="cssDriven ? 'is-css' : ''"
    :style="cssDriven ? undefined : { transform: `scaleX(${progress})` }"
    aria-hidden="true"
    data-testid="scroll-progress"
  />
</template>
