# Narrated pt-BR video of the dashboard (videos/narrated/, script in
# videos/narrated/script.md). Generates the narration (edge-tts), builds the
# front, starts vite preview on :4173 (proxying /api to HORIZON_API_URL),
# records narrated/tour.spec.ts at 1920x1080, muxes the 16:9, 9:16 and 1:1
# MP4s and stops only the preview it started. The horizon-go backend (api +
# worker, Postgres, NATS, Ollama) must already be running at HORIZON_API_URL
# (default http://localhost:8080).
#   .\scripts\narrated.ps1              # tts + recording + videos
#   .\scripts\narrated.ps1 -SkipTts     # reuse videos/narrated/work/*.mp3
param([switch]$SkipTts)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$runs = "$Root\.runs"
New-Item -ItemType Directory -Force $runs | Out-Null

function Invoke-Step([string]$Name, [scriptblock]$Block) {
    Write-Host "==> $Name" -ForegroundColor Yellow
    & $Block
    if ($LASTEXITCODE -ne 0) { throw "$Name failed (exit $LASTEXITCODE)" }
}

$api = if ($env:HORIZON_API_URL) { $env:HORIZON_API_URL.TrimEnd('/') } else { 'http://localhost:8080' }
try { $null = Invoke-WebRequest -UseBasicParsing "$api/healthz" }
catch { throw "horizon-go API not reachable at $api/healthz: start the backend first" }
if (Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue) {
    throw 'port 4173 is already in use: stop the running preview first'
}

Push-Location $Root
try {
    if (-not $SkipTts) { Invoke-Step 'narration (edge-tts)' { node scripts/narrated-tts.mjs } }
    Invoke-Step 'build web' { npm run build }
}
finally { Pop-Location }

$preview = $null
try {
    $preview = Start-Process node -ArgumentList 'node_modules/vite/bin/vite.js', 'preview', '--port', '4173', '--strictPort' `
        -WorkingDirectory $Root -PassThru -NoNewWindow `
        -RedirectStandardOutput "$runs\narr-preview.log" -RedirectStandardError "$runs\narr-preview.err.log"
    Write-Host "preview PID $($preview.Id)"

    $deadline = (Get-Date).AddSeconds(60)
    while ($true) {
        try {
            if ((Invoke-WebRequest -UseBasicParsing http://localhost:4173/healthz).StatusCode -eq 200) { break }
        } catch {}
        if ((Get-Date) -gt $deadline) { throw 'preview did not answer within 60s' }
        Start-Sleep -Milliseconds 500
    }

    Push-Location $Root
    try {
        $env:E2E_BASE_URL = 'http://localhost:4173'
        Invoke-Step 'narrated tour' { npx playwright test --config playwright.narrated.config.ts }
        Invoke-Step 'narrated videos' { node scripts/narrated-video.mjs }
    }
    finally { Remove-Item Env:E2E_BASE_URL -ErrorAction SilentlyContinue; Pop-Location }
}
finally {
    if ($preview -and -not $preview.HasExited) { Stop-Process -Id $preview.Id -Force; Write-Host "stopped PID $($preview.Id)" }
}
