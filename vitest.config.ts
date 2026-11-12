import { defineConfig } from 'vitest/config'

// Unit tests of the pure helpers (src/**/*.test.ts). The Playwright e2e
// specs (e2e/, demo/, narrated/) run with `npm run e2e`, not here.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
