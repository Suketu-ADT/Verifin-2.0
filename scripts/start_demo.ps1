<#
.SYNOPSIS
  Run the whole product from this machine behind one public address, at no cost.

.DESCRIPTION
  Builds the web interface, starts the API with FRONTEND_DIST pointing at it (so the site and the API share one origin), and opens a
  Cloudflare quick tunnel to it. The data stays in your MongoDB Atlas cluster (backend\.env). Quick tunnels need no account; the
  address changes every time. The product is reachable only while this window is open and the machine is awake.

  First run:  .\scripts\start_demo.ps1 -AllowRegistration   (register the admin account in the site, then stop and start again without it)
  Later:      .\scripts\start_demo.ps1
  No tunnel:  .\scripts\start_demo.ps1 -NoTunnel            (http://localhost:8000 only)
  cloudflared is looked up on PATH, then in tools\cloudflared.exe.
#>
param(
  [switch]$AllowRegistration,
  [switch]$NoTunnel,
  [switch]$SkipBuild,
  [int]$Port = 8000
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$python = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) { throw "Backend virtualenv not found at $python. See README for setup." }
if (-not (Test-Path (Join-Path $backend ".env"))) { throw "backend\.env not found: it must hold MONGODB_URI for your Atlas cluster." }

# 1. The web interface, built for same-origin use: an API base of "/" means "this address", and the app is served from "/".
if (-not $SkipBuild) {
  Push-Location $frontend
  try {
    if (-not (Test-Path "node_modules")) { npm ci }
    $env:VITE_API_BASE_URL = "/"   # "/" = the address that served the page (an empty value cannot be set in a Windows environment)
    $env:VITE_BASE = "/"
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed." }
  } finally { Remove-Item Env:VITE_API_BASE_URL, Env:VITE_BASE -ErrorAction SilentlyContinue; Pop-Location }
}

# 2. The API, in production mode (authentication on, no in-memory database), serving the interface.
function New-Secret([int]$bytes) { -join ((1..$bytes) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) }) }
$env:ENVIRONMENT = "production"
$env:DEBUG = "false"
$env:JWT_SECRET = New-Secret 32
$env:METRICS_TOKEN = New-Secret 24
$env:TRUST_PROXY_HEADERS = "true"
$env:ALLOW_REGISTRATION = if ($AllowRegistration) { "true" } else { "false" }
$env:FRONTEND_DIST = Join-Path $frontend "dist"
$env:PYTHONPATH = $backend
$log = Join-Path ([IO.Path]::GetTempPath()) "verifin-api.log"
$api = Start-Process -FilePath $python -WorkingDirectory $backend -PassThru -WindowStyle Hidden `
  -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", $Port, "--workers", "1", "--proxy-headers", "--forwarded-allow-ips", "*") `
  -RedirectStandardError $log -RedirectStandardOutput "$log.out"
$tunnel = $null
try {
  Write-Host "Starting the API (first start loads the models, about a minute)..."
  $ready = $false
  for ($i = 0; $i -lt 120 -and -not $ready; $i++) {
    if ($api.HasExited) { throw "The API stopped. See $log" }
    try { $ready = (Invoke-WebRequest "http://127.0.0.1:$Port/api/v1/system/live" -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { Start-Sleep -Seconds 2 }
  }
  if (-not $ready) { throw "The API did not become ready. See $log" }
  Write-Host "Local address: http://localhost:$Port"

  # 3. The tunnel.
  if (-not $NoTunnel) {
    $cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
    if (-not $cf) { $cf = Join-Path $root "tools\cloudflared.exe" }
    if (-not (Test-Path $cf)) { throw "cloudflared not found (PATH or tools\cloudflared.exe). Run with -NoTunnel for local use only." }
    $tlog = Join-Path ([IO.Path]::GetTempPath()) "verifin-tunnel.log"
    $tunnel = Start-Process -FilePath $cf -PassThru -WindowStyle Hidden -RedirectStandardError $tlog -RedirectStandardOutput "$tlog.out" `
      -ArgumentList @("tunnel", "--url", "http://127.0.0.1:$Port", "--no-autoupdate")
    $url = $null
    for ($i = 0; $i -lt 40 -and -not $url; $i++) {
      Start-Sleep -Seconds 1
      if (Test-Path $tlog) { $m = Select-String -Path $tlog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1; if ($m) { $url = $m.Matches[0].Value } }
    }
    if (-not $url) { throw "No tunnel address appeared. See $tlog" }
    Write-Host ""
    Write-Host "PUBLIC ADDRESS: $url" -ForegroundColor Green
    Write-Host "(changes on every start; share it only for as long as you want the product reachable)"
  }
  Write-Host ""
  Read-Host "Press Enter to stop"
} finally {
  if ($tunnel -and -not $tunnel.HasExited) { Stop-Process -Id $tunnel.Id -Force }
  if (-not $api.HasExited) { Stop-Process -Id $api.Id -Force }
}
