@echo off
cd /d "%~dp0"

echo === Romp for the Rescues local test ===

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "if (-not (Test-Path '.dev.vars')) { Copy-Item '.dev.vars.example' '.dev.vars'; Write-Host 'Created .dev.vars from example – edit with real RESEND_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET' -ForegroundColor Yellow }"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Write-Host 'Starting Cloudflare Pages local server (uses .dev.vars for secrets)...' -ForegroundColor Cyan; npx wrangler pages dev . --port 8788 --compatibility-date=2024-09-23"

pause