## Deploy (Hostinger / Shared Hosting) — Rynexcapital

### Project path (server)

Example used in this guide:

- `/home/u485327239/domains/arogyaspaa.com/public_html/testing`

Adjust to your real folder.

---

### 1) Production install (no dev packages)

Run inside the project folder:

```bash
cd /home/u485327239/domains/arogyaspaa.com/public_html/testing

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
cd /home/u485327239/domains/arogyaspaa.com/public_html/testing
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
cd /home/u485327239/domains/arogyaspaa.com/public_html/testing
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
* * * * * cd /home/u485327239/domains/arogyaspaa.com/public_html/testing && php artisan schedule:run >> /dev/null 2>&1
```

The app schedule is configured in `bootstrap/app.php`:

- `income:pay-roi` daily at `02:00`
- `income:pay-r10-leadership` monthly on day `1` at `03:15`

---

### 5) Manual run commands

#### A) Daily ROI (investment ROI)

```bash
cd /home/u485327239/domains/arogyaspaa.com/public_html/testing
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

