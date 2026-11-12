/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the horizon-go API; empty keeps relative /api URLs (Vite proxy). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
