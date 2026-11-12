import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

// The dashboard talks to the horizon-go API (cmd/api), a separate repo:
// https://github.com/Joao-Pedro-AI-Visionary/horizon-go
// By default the browser calls relative /api and /healthz URLs, which the dev
// and preview servers proxy to HORIZON_API_URL (default http://localhost:8080;
// API_TARGET is still accepted). Set VITE_API_URL instead to call the API
// directly from the browser (its HORIZON_CORS_ORIGINS must allow this origin).
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const target = env.HORIZON_API_URL || env.API_TARGET || 'http://localhost:8080'
  const proxy = {
    '/api': { target, changeOrigin: true },
    '/healthz': { target, changeOrigin: true },
  }
  // https://vite.dev/config/
  return {
    plugins: [vue(), tailwindcss()],
    server: { proxy },
    preview: { proxy },
  }
})
