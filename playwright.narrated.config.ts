import { defineConfig, devices } from '@playwright/test'

// Narrated tour (narrated/tour.spec.ts), 1920x1080, against the real horizon-go
// backend already running at HORIZON_API_URL. scripts/narrated.ps1 builds the
// front, starts vite preview and sets E2E_BASE_URL.
export default defineConfig({
  testDir: './narrated',
  globalSetup: './e2e/global-setup.ts',
  outputDir: './test-results/narrated',
  workers: 1,
  reporter: 'list',
  timeout: 300_000,
  use: { ...devices['Desktop Chrome'], baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173' },
})
