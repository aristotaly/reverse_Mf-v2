# v2 deployment notes

Status as of the initial v2 cutover (use this checklist if you bring up another v2 environment).

## What is already done

- ✅ GitHub repo: <https://github.com/aristotaly/reverse_Mf-v2>
- ✅ Vercel project: `reverse-mf-v2` (linked to the GitHub repo)
- ✅ Live URL: <https://reverse-mf-v2.vercel.app>
- ✅ Postgres database: `reverse_mf_v2` on the same Neon server as v1 (separate database = isolated data, shared compute = no extra cost)
- ✅ Schema migrations applied to the new database (init + add_user_username + add_user_role)
- ✅ Admin user seeded: `admin` / `Amdocs101`
- ✅ Vercel **Development** env vars set correctly (verified via `vercel env pull`)

## What needs manual fix-up

> **The Vercel CLI v54.1.0 on this Windows shell has a bug**: `vercel env add NAME production` silently stores empty strings, regardless of whether you use `--value`, stdin redirection, or temp-file redirection. The CLI reports "Added Environment Variable" but `vercel env pull --environment=production` returns 0-character values. The Development environment is unaffected.

To fix production env vars, go to <https://vercel.com/aristotalys-projects/reverse-mf-v2/settings/environment-variables> and add these 6 variables for the **Production** environment:

| Variable | Value | Notes |
|----------|-------|-------|
| `POSTGRES_URL_NON_POOLING` | (copy from Development env var) | Direct Neon URL with `?channel_binding=require&sslmode=require` |
| `POSTGRES_PRISMA_URL` | (copy from Development env var) | Pooled URL with `?channel_binding=require&connect_timeout=15&sslmode=require` |
| `SESSION_SECRET` | (random 48-char hex string) | Used to sign session cookies |
| `SEED_PASSCODE` | `Amdocs101` | Default admin password (only used if seed runs) |
| `SEED_USERNAME` | `admin` | Default admin username |
| `SEED_USER_NAME` | `Admin` | Default admin display name |

You can copy the URL values straight from Development:

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
npx vercel env pull .env.dev --environment=development
# Open .env.dev, copy the POSTGRES_URL_NON_POOLING and POSTGRES_PRISMA_URL values
```

Then trigger a redeploy: `npx vercel deploy --prod --yes`.

## Why is the database the same as v1's?

The `reverse_mf_v2` database lives on the same Neon server as v1's `verceldb`. Neon supports many databases per project (the "compute" is shared, the data is fully separate). v2's tables and rows are completely isolated from v1's — they're in different `CREATE DATABASE` namespaces. If you ever want a fully separate Postgres instance for v2, create one in the Neon dashboard and update the env vars accordingly.

## Provisioning a fresh v2-like environment from scratch

```powershell
# 1. Create the Vercel project
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
npx vercel projects add reverse-mf-v3
npx vercel link --project reverse-mf-v3 --yes

# 2. Provision a fresh DB (script reads v1's connection string from .env.v1
#    and creates a new logical database on the same server)
npx vercel env pull .env.v1 --environment=production --cwd c:\APS\revers-mf
node scripts/provision-v2-db.mjs .env.v1

# 3. Wire env vars (see the table above — do this in the dashboard for now;
#    the CLI bug only affects the Windows shell)

# 4. Connect Git, deploy, seed admin
npx vercel git connect https://github.com/aristotaly/reverse_Mf-v3
npx vercel deploy --prod --yes
npx vercel env pull .env.local --environment=production
npx tsx scripts/setup-prod-user.ts
```
