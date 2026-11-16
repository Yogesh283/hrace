## Deploy — racenetwork.live (production)

Live site (this is the admin / production domain):

- Site: https://racenetwork.live
- ICO: https://racenetwork.live/ico
- Admin: https://racenetwork.live/admin

### Project path (server)

Use the folder that actually serves racenetwork.live (CloudPanel / typical):

- `/home/racenetwork/htdocs/racenetwork.live`

If that folder does not exist, try:

- `/var/www/racenetwork.live`

Do **not** use `arogyaspaa.com` — that is a different host.

On the apex host `racenetwork.live` keep `SESSION_DOMAIN` **empty**. `SESSION_DOMAIN=.racenetwork.live` causes CSRF 419 in TokenPocket / in-app browsers.

### 0) One-shot: pull code + set APP_URL + new contracts

SSH into the live server, then paste this entire block once:

```bash
cd /home/racenetwork/htdocs/racenetwork.live || cd /var/www/racenetwork.live

git pull

set_env() {
  key="$1"
  val="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    printf '\n%s=%s\n' "$key" "$val" >> .env
  fi
}

set_env APP_NAME '"racenetwork.live"'
set_env APP_URL https://racenetwork.live
set_env ASSET_URL https://racenetwork.live
set_env SESSION_DOMAIN ""
set_env SESSION_SECURE_COOKIE true
set_env BSC_CHAIN_ID 56
set_env BSC_NETWORK bsc
set_env RACE_TOKEN_CONTRACT 0xa29683442d9221Df0Eb7AFF3932c1E165FFa93EB
set_env RACE_MULTISIG_CONTRACT 0x81BffBF2C2a258E662e9df0a0f6e34150b33F3df
set_env RACE_TREASURY_CONTRACT 0xDFff662C7009a4FbFe12ee97b77b4f06a79Ae155
set_env RACE_DEVELOPMENT_TREASURY_CONTRACT 0xB255d395b872Af9727812c71176114f229878671
set_env RACE_MARKETING_TREASURY_CONTRACT 0xF75e6989Cf7C2Ab6c85D19F1471d3dAFE733E6A1
set_env RACE_OPERATIONS_TREASURY_CONTRACT 0x2BBCC874a556540da04e9604b4A33B9FFFD1fda9
set_env RACE_REWARD_VAULT_CONTRACT 0xa59543817202fE2967be2B6e9EE081b765aE8958
set_env RACE_REWARD_PRICE_ORACLE_CONTRACT 0x9504f0c9A81370443F0F1B97Bc92B4DE176C8bbF
set_env RACE_COMMUNITY_ENGINE_CONTRACT 0x93E75234026aA3942624Dd61Dc4EF2aCf958E1DE
set_env RACE_PARTICIPATION_CONTRACT 0x0cbBb4d3871343AB25EAe2A707956DC4E5779821
set_env RACE_ICO_CONTRACT 0x631C12254A98cC69516859fD43c4Da494F5073CA
set_env ICO_CONTRACT 0xc618bc4f36877F5d81539f7275958f4B21677d27
set_env RACE_INCOME_HOLD_CONTRACT 0x5D1576349C994656Cc15C28106C73bc6535bcb33
set_env RACE_STAKING_CONTRACT 0x1B313cB83aDA893CC37B83bAD1a9D0188056EEb9
set_env RACE_REWARD_POOL_CONTRACT 0xab9252Bb22599901DB6A2987905b8aF12a855cf6
set_env RACE_AUTO_LIQUIDITY_CONTRACT 0x37975d8C0D590ae95EFB3Fc4446962Ea3e133Aa9
set_env RACE_GOVERNOR_CONTRACT 0x998b76156535Caba89D1a25099334fBDC3EE4F13
set_env ICO_ADMIN_WALLET 0x568B11c83A104c81c70cde58cCdbF4aa9c97b225

rm -f bootstrap/cache/packages.php bootstrap/cache/services.php bootstrap/cache/config.php
composer install --no-dev --optimize-autoloader
php artisan package:discover --ansi
php artisan optimize:clear

echo "=== live urls + contracts ==="
grep -E '^(APP_URL|ASSET_URL|SESSION_DOMAIN|BSC_CHAIN_ID|RACE_|ICO_CONTRACT|ICO_ADMIN_WALLET)=' .env
```

Then open https://racenetwork.live/admin → ICO Contract → **Save setup**.

---

### 1) Production install (no dev packages)

Run inside the project folder:

```bash
cd /home/racenetwork/htdocs/racenetwork.live

# Remove stale cached discovery files (prevents PailServiceProvider error)
rm -f bootstrap/cache/packages.php bootstrap/cache/services.php bootstrap/cache/config.php

# Install prod deps
composer install --no-dev --optimize-autoloader

# Rebuild discovery + clear caches
php artisan package:discover --ansi
php artisan optimize:clear
```

---

### 2) If you see: `Class "Laravel\Pail\PailServiceProvider" not found`

This happens when production is missing dev deps but cached discovery still references Pail.

Fix:

```bash
cd /home/racenetwork/htdocs/racenetwork.live
rm -f bootstrap/cache/packages.php bootstrap/cache/services.php bootstrap/cache/config.php
composer install --no-dev --optimize-autoloader
php artisan package:discover --ansi
php artisan optimize:clear
```

Important:

- Do **not** upload `bootstrap/cache/*.php` from local to server.

---

### 3) Ensure Artisan income commands exist on server

On some shared-hosting deployments the folder may be missing. Verify:

```bash
cd /home/racenetwork/htdocs/racenetwork.live
ls -la app/Console/Commands/
php artisan list | grep income
```

Expected commands:

- `income:pay-roi`
- `income:pay-r10-leadership`
- `income:diagnose-roi`
- `income:diagnose-r10-leadership`
- `income:diagnose-network-roi`

If `app/Console/Commands/` is missing, create it and upload from local:

```bash
mkdir -p app/Console/Commands
```

Then upload the command files from local repo `app/Console/Commands/*.php`.

---

### 4) Cron / scheduler (required)

Laravel schedule runs the ROI + R10 automatically only if `schedule:run` is executed by cron.

Add a cron job (every minute):

```bash
* * * * * cd /home/racenetwork/htdocs/racenetwork.live && php artisan schedule:run >> /dev/null 2>&1
```

The app schedule is configured in `bootstrap/app.php`:

- `income:pay-roi` daily at `02:00`
- `income:pay-r10-leadership` monthly on day `1` at `03:15`

---

### 5) Manual run commands

#### A) Daily ROI (investment ROI)

```bash
cd /home/racenetwork/htdocs/racenetwork.live
php artisan income:pay-roi
```

Diagnose why ROI is not crediting:

```bash
php artisan income:diagnose-roi
php artisan income:diagnose-roi --user=5
```

Common reason for “no income”: `next_roi_at` is in the future (ROI not due yet).

#### B) R10 Leadership monthly payout

Default (previous month):

```bash
php artisan income:pay-r10-leadership
```

Specific period:

```bash
php artisan income:pay-r10-leadership --period=2026-04
```

Diagnose why 0 members were paid:

```bash
php artisan income:diagnose-r10-leadership --period=2026-04 --limit=200
```

#### C) Network of ROI (ROI-of-ROI) audit

```bash
php artisan income:diagnose-network-roi
php artisan income:diagnose-network-roi --user=28
```

---

### 6) Make ROI due immediately (one-time ops / testing)

If you want to test ROI right now and all investments are “waiting”, update `next_roi_at`.

Run in phpMyAdmin (SQL):

```sql
UPDATE investments
SET next_roi_at = NOW()
WHERE status = 'active'
  AND next_roi_at > NOW();
```

Then:

```bash
php artisan income:pay-roi
```

---

### 7) Notes (shared hosting)

- `php artisan tinker` may fail with `Call to undefined function shell_exec()` on shared hosting. Use the `income:diagnose-*` commands instead.
- If you change `composer.json`, regenerate `composer.lock` locally (recommended) and upload both.

