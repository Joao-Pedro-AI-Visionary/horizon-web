import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { vReveal } from './lib/motion'
import { registerServiceWorker } from './lib/pwa'
import { initTheme } from './lib/theme'
import { router } from './router'
import './style.css'

initTheme()
createApp(App).use(createPinia()).use(router).directive('reveal', vReveal).mount('#app')
registerServiceWorker()
