# Playwright e2e against the real horizon-go backend in desktop/tablet/mobile
# viewports. The backend (api + worker, with Postgres, NATS and Ollama) must
# already be running at HORIZON_API_URL (default http://localhost:8080), e.g.
# via horizon-go's scripts\start-local.ps1. vite preview is started by
# playwright.config.ts and proxies /api to HORIZON_API_URL. Turns the
# recordings into videos/e2e-<project>.mp4.
#   .\scripts\e2e.ps1            # suite + videos
#   .\scripts\e2e.ps1 -Demo      # also records videos/demo-final.mp4
#   .\scripts\e2e.ps1 -NoVideos  # suite only
param([switch]$Demo, [switch]$NoVideos)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Invoke-Step([string]$Name, [scriptblock]$Block) {
    Write-Host "==> $Name" -ForegroundColor Yellow
    & $Block
    if ($LASTEXITCODE -ne 0) { throw "$Name failed (exit $LASTEXITCODE)" }
}

$api = if ($env:HORIZON_API_URL) { $env:HORIZON_API_URL.TrimEnd('/') } else { 'http://localhost:8080' }
try { $null = Invoke-WebRequest -UseBasicParsing "$api/healthz" }
catch { throw "horizon-go API not reachable at $api/healthz: start the backend first" }

Push-Location $Root
try {
    Invoke-Step 'playwright chromium' { npx playwright install chromium }
    Write-Host '==> e2e' -ForegroundColor Yellow
    npx playwright test
    $suiteExit = $LASTEXITCODE
    if (-not $NoVideos) { Invoke-Step 'e2e videos' { node scripts/videos.mjs } }
    if ($Demo) {
        Invoke-Step 'demo tour' { npx playwright test --config playwright.demo.config.ts }
        Invoke-Step 'demo video' { node scripts/demo-video.mjs }
    }
}
finally { Pop-Location }
if ($suiteExit -ne 0) { throw "e2e failed (exit $suiteExit)" }
