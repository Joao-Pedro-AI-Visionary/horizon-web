import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { vReveal } from './lib/motion'
import { registerServiceWorker } from './lib/pwa'
import { initTheme } from './lib/theme'
import { initLocale } from './lib/locale'
import { router } from './router'
import './style.css'

initTheme()
initLocale()
createApp(App).use(createPinia()).use(router).directive('reveal', vReveal).mount('#app')
registerServiceWorker()
