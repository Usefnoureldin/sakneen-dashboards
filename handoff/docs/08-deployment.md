# 08 — Deployment

## Railway setup, step by step

### One-time setup

1. **Create Railway account** at railway.app (Youssef does this)
2. **Connect GitHub** (Youssef authorizes Railway to access the repo)
3. **Create new project**: "sakneen-dashboards"
4. **Add Postgres**: project dashboard → New → Database → PostgreSQL
5. **Add the Next.js service**: project dashboard → New → GitHub Repo → select `sakneen-dashboards`
6. **Configure the service**:
   - Build command: `pnpm install && pnpm build`
   - Start command: `pnpm start`
   - Root directory: `/` (default)
   - Watch paths: leave default
7. **Add a volume** for uploaded files:
   - Service → Volumes → Create Volume
   - Mount path: `/data`
   - Size: 1GB (more than enough for MVP)
8. **Set environment variables** (see below)
9. **Wire the domain**:
   - Service → Settings → Domains → Custom Domain
   - Enter `paragon.sakneen.com` (or chosen domain)
   - Add CNAME record at DNS registrar pointing to Railway's CNAME
   - Wait for DNS propagation (5-30 min) and certificate provisioning

### Environment variables

```bash
# Database — Railway auto-injects these when you reference the Postgres service
DATABASE_URL="${{Postgres.DATABASE_URL}}"

# Auth
AUTH_SECRET="<generate with: openssl rand -base64 32>"
AUTH_URL="https://paragon.sakneen.com"
AUTH_TRUST_HOST="true"

# Storage path (uses the Railway volume)
UPLOAD_DIR="/data/uploads"

# Email (Resend)
RESEND_API_KEY="<from resend.com dashboard>"
EMAIL_FROM="Sakneen <noreply@sakneen.com>"

# Sentry (optional but recommended)
SENTRY_DSN="<from sentry.io project>"

# PostHog (optional but recommended; Sakneen already uses this)
NEXT_PUBLIC_POSTHOG_KEY="<from posthog>"
NEXT_PUBLIC_POSTHOG_HOST="https://app.posthog.com"

# Node environment
NODE_ENV="production"
```

### `package.json` scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start -p ${PORT:-3000}",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx scripts/seed.ts",
    "db:studio": "drizzle-kit studio",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  }
}
```

### Migrations on deploy

Drizzle migrations need to run on each production deploy. Two options:

**Option A (simpler for MVP):** Run migrations as part of build:
```json
"build": "pnpm drizzle-kit migrate && next build"
```
Risk: if DB is unavailable during build, build fails. Acceptable for MVP.

**Option B (production-grade):** Use Railway's pre-deploy command:
- Service → Settings → Deploy → Pre-Deploy Command: `pnpm drizzle-kit migrate`
- Migrations run before each deploy starts

Recommend Option B as soon as you have it working.

### Playwright setup on Railway

Playwright needs Chromium installed. Railway's Nixpacks builder usually handles this. If it doesn't:

Add a `nixpacks.toml` in the repo root:
```toml
[phases.setup]
nixPkgs = ["nodejs_20", "pnpm", "playwright-driver.browsers"]

[phases.install]
cmds = ["pnpm install --frozen-lockfile", "pnpm exec playwright install chromium"]
```

Or use a `Dockerfile`:
```dockerfile
FROM node:20-slim

# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
    libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile
RUN pnpm exec playwright install chromium

COPY . .
RUN pnpm build

EXPOSE 3000
CMD ["pnpm", "start"]
```

Use the Dockerfile if Nixpacks gives trouble.

## Domain and DNS

Recommended structure:

- **Marketing / login:** `dashboards.sakneen.com` (or just root sakneen.com if Sakneen wants)
- **Per-client subdomains:** `paragon.sakneen.com`, `sodic.sakneen.com`, etc. for v2

For MVP with just Paragon, use `paragon.sakneen.com` directly.

DNS records (at whatever registrar Sakneen uses):
```
paragon.sakneen.com  CNAME  <railway-provided-cname>.up.railway.app
```

Railway auto-provisions Let's Encrypt cert. No manual cert management needed.

## Email setup (Resend)

1. **Create Resend account** at resend.com (free tier: 3000 emails/month, plenty for MVP)
2. **Add and verify sakneen.com** as a sending domain (DNS records: SPF, DKIM, DMARC — Resend gives you the records, paste at registrar)
3. **Generate API key**, save as `RESEND_API_KEY` in Railway env
4. **Test** by sending a welcome email from the seed script

What emails get sent in MVP:
- User invitation: "You've been invited to view {Client}'s dashboard. Temp password: ..."
- (Optional) Password reset link — if not built, link to `mailto:youssef@sakneen.com`

## Backups

Railway Postgres has automated daily backups on paid plans. For MVP starter ($5/mo), backups are manual — set up a cron job:

```yaml
# .github/workflows/backup.yml
name: Backup Postgres
on:
  schedule:
    - cron: '0 2 * * *'  # 2am UTC daily
  workflow_dispatch:
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - run: pg_dump $PROD_DB_URL > backup-$(date +%Y%m%d).sql
        env: { PROD_DB_URL: ${{ secrets.PROD_DB_URL }} }
      - uses: actions/upload-artifact@v3
        with: { name: db-backup, path: backup-*.sql, retention-days: 30 }
```

For MVP this is fine. Upgrade to Railway Pro plan when you have 5+ clients on the platform.

## Cost estimate

| Item | Cost / month |
|---|---|
| Railway Hobby plan ($5 credit) | $5 |
| Postgres on Railway | ~$3-5 (1GB RAM tier) |
| Next.js service usage | ~$3-5 |
| Volume (1GB) | $0.25 |
| Resend email | $0 (free tier) |
| Domain (already owned) | $0 |
| Sentry (free tier) | $0 |
| **Total** | **~$11-15/month** |

If you outgrow this, the next bump is Railway Pro at $20/month with more resources.

## Incident playbook

If the production app goes down:

1. **Check Railway dashboard** for service status
2. **Check logs** in Railway → Service → Logs
3. **Check Sentry** for unhandled exceptions
4. **Roll back** if a recent deploy caused it: Railway → Deployments → click prior deploy → "Redeploy"
5. **Restore DB from backup** if data corruption: `psql $DATABASE_URL < backup-{date}.sql`

Railway has a status page at status.railway.app for platform-level issues.

## Security checklist (pre-launch)

- [ ] All env vars set in production, none committed to repo
- [ ] `AUTH_SECRET` is unique production value, not the dev one
- [ ] HTTPS enforced (Railway does this by default)
- [ ] Rate limiting on `/api/auth/login` (e.g. 5 attempts per 15 min per IP)
- [ ] Passwords stored as bcrypt hashes (NextAuth default)
- [ ] No `console.log` of sensitive data in production
- [ ] Sentry source maps uploaded but DSN is the production one
- [ ] CORS restricted to same-origin only
- [ ] File upload limited to 10MB and `.xlsx`/`.xls` only
- [ ] No public read access on the volume
- [ ] DB connection over SSL
- [ ] Backups configured and tested (restore one to a staging env at least once)

## Pre-launch checklist (the day before showing Paragon)

- [ ] Production app loads at custom domain
- [ ] Login works for all seeded users
- [ ] Upload flow works end-to-end with real Paragon data
- [ ] PDF download produces correct output
- [ ] Mobile view tested on actual phone (not just browser devtools)
- [ ] Wrong password → clear error message
- [ ] Logged-in Paragon user navigating to /admin → 403 or redirect
- [ ] Logout works and session is cleared
- [ ] Email invitations actually arrive (check spam folders)
- [ ] Tested in Chrome, Safari, Edge on desktop
- [ ] Tested on iOS Safari and Chrome on mobile
- [ ] All real client users have been emailed and confirmed they can log in
- [ ] Youssef has tested the full upload flow with current-day data and confirmed the dashboard reflects it correctly
- [ ] Sentry is catching errors (force one to verify)
- [ ] One backup has been taken and restoring it has been tested
