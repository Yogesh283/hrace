# All-in-one dev: php artisan serve + queue + logs + vite
# Run: .\dev-serve.ps1
# Site: http://127.0.0.1:8000 — set APP_URL=http://127.0.0.1:8000 in .env first

Set-Location $PSScriptRoot
php artisan config:clear
composer dev
