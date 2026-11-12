// The suites run against the real horizon-go backend
// (https://github.com/Joao-Pedro-AI-Visionary/horizon-go), which must already
// be running at HORIZON_API_URL (default http://localhost:8080) with Postgres,
// NATS, the worker and Ollama. Fail fast with a clear message if it is not.
export default async function globalSetup() {
  const api = (process.env.HORIZON_API_URL || process.env.API_TARGET || 'http://localhost:8080').replace(/\/+$/, '')
  try {
    const res = await fetch(`${api}/healthz`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    throw new Error(
      `horizon-go API not reachable at ${api}/healthz (${(err as Error).message}). ` +
        'Start the backend first (horizon-go: scripts\\start-local.ps1) or set HORIZON_API_URL.',
    )
  }
}
