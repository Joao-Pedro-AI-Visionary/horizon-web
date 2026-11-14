<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { api, errorMessage } from '../api/client'
import StatePanel from '../components/StatePanel.vue'

const route = useRoute()
const isUnsubscribe = route.name === 'newsletter-unsubscribe'

const loading = ref(true)
const title = ref(isUnsubscribe ? 'Processando descadastro…' : 'Confirmando sua inscrição…')
const message = ref('')
const err = ref('')

onMounted(async () => {
  const token = String(route.query.token ?? '').trim()
  if (!token) {
    loading.value = false
    err.value = 'Link incompleto ou sem token.'
    return
  }
  try {
    const res = isUnsubscribe ? await api.unsubscribeNewsletter(token) : await api.confirmNewsletter(token)
    title.value = isUnsubscribe ? 'Descadastro concluído' : 'Inscrição confirmada'
    message.value = res.message
  } catch (e) {
    err.value = errorMessage(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="mx-auto max-w-xl pt-12 pb-16">
    <div v-if="loading" class="news-card items-center py-12 text-center" role="status">
      <p class="font-display text-lg font-bold">{{ title }}</p>
      <p class="text-sm text-muted">Aguarde um instante.</p>
    </div>
    <StatePanel
      v-else-if="err"
      kind="error"
      :title="isUnsubscribe ? 'Não foi possível cancelar a inscrição' : 'Link de confirmação inválido'"
      :detail="err"
      testid="newsletter-action-error"
    >
      <RouterLink to="/" class="btn-primary min-h-12">Voltar para o feed</RouterLink>
    </StatePanel>
    <section v-else class="news-card items-start gap-4 p-6 md:p-8" data-testid="newsletter-action-done">
      <p class="eyebrow text-accent">Newsletter Horizon</p>
      <h1 class="display-md">{{ title }}</h1>
      <p class="text-sm leading-relaxed text-muted">{{ message }}</p>
      <RouterLink to="/" class="btn-primary min-h-12">Ir para o feed</RouterLink>
    </section>
  </div>
</template>
