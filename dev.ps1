# Rynexcapital local dev — run from project root in PowerShell:
#   .\dev.ps1
#
# Option 1 (XAMPP): Apache on http://localhost/Rynexcapital + Vite HMR
# Option 2: Laravel serve on http://127.0.0.1:8000 — set APP_URL in .env first

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Rynexcapital dev" -ForegroundColor Cyan
Write-Host "  Site (XAMPP): http://localhost/Rynexcapital"
Write-Host "  Admin:        http://localhost/Rynexcapital/admin"
Write-Host "  Vite:         http://127.0.0.1:5173"
Write-Host ""

php artisan config:clear | Out-Null

$queue = Start-Process -FilePath "php" -ArgumentList "artisan queue:listen --tries=1" -PassThru -WindowStyle Minimized
Write-Host "Queue worker started (PID $($queue.Id))" -ForegroundColor Green

try {
    npm run dev
} finally {
    if (-not $queue.HasExited) {
        Stop-Process -Id $queue.Id -Force -ErrorAction SilentlyContinue
    }
}
