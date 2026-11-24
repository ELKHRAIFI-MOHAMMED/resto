# RestoFlow — Production deployment

This guide deploys RestoFlow on a single Linux server with Docker. The stack
was built and smoke-tested end to end with `docker-compose.prod.yml`.

## 1. Architecture

```
            Internet (HTTPS)
                  │
        TLS proxy (Caddy, Traefik, a load balancer, Cloudflare…)
                  │  HTTP + X-Forwarded-Proto: https
          ┌───────▼────────┐
          │  web (nginx)   │  React build, security headers, CSP
          │  :80           │  /media/ from the shared volume (read-only)
          └───────┬────────┘
     /api/  /django-admin/  /static/  /sitemap.xml  /robots.txt
          ┌───────▼────────┐
          │ backend        │  Django + Gunicorn (non-root), WhiteNoise for static
          │ :8000          │  runs migrations + createcachetable on start
          └───────┬────────┘
          ┌───────▼────────┐
          │ db (Postgres17)│  private network only, persistent volume
          └────────────────┘
```

| Container | Image | Volumes |
| --- | --- | --- |
| `db` | `postgres:17-alpine` | `postgres_data` |
| `backend` | `backend/Dockerfile` (Python 3.13, Gunicorn, WhiteNoise) | `media` (read-write) |
| `web` | `frontend/Dockerfile` (Node build → `nginx:1.29-alpine`) | `media` (read-only) |

Each container has a health check; `web` starts only once `backend` is
healthy, and `backend` only once `db` is healthy.

## 2. Requirements

- A Linux server with Docker Engine and the Compose plugin (2 vCPU / 2 GB RAM
  is plenty for one restaurant).
- A domain name pointing to the server.
- TLS in front of the stack (section 5).

## 3. Configure

```bash
git clone https://github.com/ELKHRAIFI-MOHAMMED/resto.git restoflow
cd restoflow
cp .env.production.example .env.production
```

Edit `.env.production` (it is git-ignored) and replace every placeholder:

| Variable | Value |
| --- | --- |
| `DJANGO_SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(64))"`. Production refuses to start with a short or placeholder key |
| `DJANGO_ALLOWED_HOSTS` | Your domain(s), comma-separated |
| `CSRF_TRUSTED_ORIGINS` | `https://` + each domain |
| `PUBLIC_SITE_URL` | `https://your-domain` (used in `sitemap.xml` and `robots.txt`) |
| `DJANGO_ADMIN_URL` | Must start with `django-admin/`, e.g. `django-admin/k3v9-private/` (nginx only forwards that prefix; production refuses anything else) |
| `POSTGRES_PASSWORD` | A long random password |
| `HTTP_PORT` | Host port for nginx (80, or another port if the TLS proxy runs on the same machine) |
| `WEB_CONCURRENCY` | Gunicorn workers, about `2 × cores + 1` |

## 4. Start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps   # all "healthy"

# First staff account (owner role)
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec backend python manage.py createsuperuser
```

Then log in at `https://your-domain/admin`, open **Settings**, and set the
restaurant name, **WhatsApp number** (orders are sent there), address, opening
hours and delivery zones. Add categories and products from the dashboard.

To try the platform with demo content instead (never on a real restaurant's
data): `exec backend python manage.py seed_demo --force`.

## 5. HTTPS

The stack serves HTTP on `HTTP_PORT`; put a TLS-terminating proxy in front
that sets `X-Forwarded-Proto: https`. Example with Caddy on the same server
(automatic Let's Encrypt certificates), with `HTTP_PORT=8080`:

```
resto.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

With HTTPS in place, Django redirects HTTP to HTTPS, sends HSTS and marks the
session and CSRF cookies `Secure`. Staff login does not work over plain HTTP
(by design: the cookies are `Secure`).

Do not expose nginx directly to the internet without a TLS proxy: it trusts
the incoming `X-Forwarded-Proto` header, which only the proxy may set.

## 6. Security in place

| Layer | Measures |
| --- | --- |
| nginx | `server_tokens off`; CSP for the app (`script-src 'self'`, no framing, no objects); `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, HSTS; `/media/` serves only `jpg/jpeg/png/webp` with `default-src 'none'; sandbox`; 10 MB request limit |
| Django | HTTPS redirect, HSTS, secure cookies, strong-secret check, admin path check, CSRF on login, deny-by-default API, rate limits shared via the database cache |
| Containers | Gunicorn runs as an unprivileged user; the database has no published port; uploads are mounted read-only into nginx |

## 7. Operations

```bash
# Logs
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f backend web

# Update to a new version (migrations run automatically on start)
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Database backup / restore
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T db pg_dump -U restoflow -Fc restoflow > backup-$(date +%F).dump
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T db pg_restore -U restoflow -d restoflow --clean < backup-YYYY-MM-DD.dump

# Media backup (uploaded photos)
docker run --rm -v restoflow-prod_media:/media -v "$PWD":/backup alpine \
  tar czf /backup/media-$(date +%F).tar.gz -C /media .
```

Back up both the database and the media volume, for example nightly with
cron, and keep copies off the server.

## 8. Without Docker (platform hosting)

The backend runs anywhere Python 3.12+ runs:

- `pip install -r backend/requirements.txt`
- Set the same variables; a platform-provided `DATABASE_URL` overrides the
  `POSTGRES_*` values.
- `python manage.py migrate && python manage.py createcachetable && python manage.py collectstatic --noinput`
- Start `gunicorn config.wsgi:application -c gunicorn.conf.py` (production settings are the WSGI default).
- Build the frontend with `npm ci && npm run build` and serve `frontend/dist`
  with SPA fallback, forwarding `/api/`, `/django-admin/`, `/static/`,
  `/sitemap.xml` and `/robots.txt` to Django and `/media/` to the uploads
  folder, as in `frontend/deploy/nginx.conf`. Keep the app and the API on the
  same domain so session and CSRF cookies work without CORS.

## 8b. Vercel + Supabase (serverless)

One Vercel project serves everything from the repository root
(`vercel.json`):

| Path | Served by |
| --- | --- |
| `/`, `/menu`, `/admin`, `/livreur`, … | the React build (`frontend/dist`), static |
| `/api/*`, `/django-admin/*`, `/static/*`, `/sitemap.xml`, `/robots.txt` | Django, as one Python function (`api/index.py`, settings `config.settings.vercel`) |

Same domain for both, so session and CSRF cookies work as in the Docker
setup. The database is Supabase PostgreSQL through its connection pooler;
uploaded photos go to a public Supabase Storage bucket (a function's disk is
not kept). The function runs in `iad1` (US East), next to a Supabase project
in `us-east-1`; change `regions` in `vercel.json` if the database is elsewhere.

**Environment variables (Vercel → Settings → Environment Variables)**

| Variable | Source |
| --- | --- |
| `POSTGRES_URL` | Added by the Supabase integration (transaction pooler, port 6543) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Added by the Supabase integration; server-side only, used for Storage |
| `DJANGO_SECRET_KEY` | **Add it**: a long random value, e.g. `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `DJANGO_ALLOWED_HOSTS` | Only for a custom domain (e.g. `resto.ma,www.resto.ma`); Vercel domains are allowed automatically |
| `PUBLIC_SITE_URL` | Optional, e.g. `https://resto.ma` (defaults to the Vercel production domain) |

| `INITIAL_OWNER_EMAIL`, `INITIAL_OWNER_PASSWORD` | Optional: first owner account, created with the initial data on a brand-new database |
| `AUTO_BOOTSTRAP_DATABASE` | Optional, `true` by default (see below) |

**The database prepares itself.** There is no release step on Vercel, so
each new function instance checks the database when it starts
(`apps/core/bootstrap.py`, about 0.15 s):

- pending migrations are applied, then the Supabase preparation runs (cache
  table, Data API lockdown, public `media` bucket);
- a brand-new database (no account, no category, no dish) also receives the
  initial menu: restaurant profile and hours, 6 categories, 14 dishes with
  sizes, extras and photos, 2 offers, 6 delivery zones, and the owner account
  from `INITIAL_OWNER_EMAIL` / `INITIAL_OWNER_PASSWORD`. No courier account is
  created (add them in Admin → Couriers). Once anything exists this is never
  loaded again, so real data is never overwritten.

It all runs in one transaction holding a PostgreSQL advisory lock: when
several instances start together, one does the work and the others wait,
then find nothing left to do. A failure is rolled back, logged, and retried
by the next instance; the app still starts. Set `AUTO_BOOTSTRAP_DATABASE=false`
to run the same steps by hand instead, from a computer, with `DATABASE_URL`
set to the session pooler URL (`POSTGRES_URL_NON_POOLING`, port 5432) and
`DJANGO_SETTINGS_MODULE=config.settings.vercel`:

```bash
cd backend
python manage.py migrate
python manage.py setup_supabase     # cache table, API lockdown, "media" bucket
python manage.py load_initial_data  # brand-new database only
python manage.py createsuperuser    # if INITIAL_OWNER_* were not set
```

The Docker image does the same on start (`docker-entrypoint.sh`).

**Supabase Data API lockdown.** Supabase publishes the `public` schema over
its REST API, reachable with the public anon key. After every `migrate`,
RestoFlow revokes the `anon` and `authenticated` roles' access to every
Django table and enables row level security on them (`apps/core/supabase.py`);
Django connects as the table owner and is not affected. Check it with
`curl -H "apikey: <anon key>" https://<project>.supabase.co/rest/v1/accounts_user`:
the answer must be a `42501` permission error.

**Limits of this setup**

- Uploads are capped at 4 MB (Vercel rejects request bodies over 4.5 MB).
- A cold start (first request after a quiet period) takes a second or two.
- The first start on a brand-new database takes longer (migrations,
  initial data and photo uploads, a few seconds); `maxDuration` is 60 s.

## 8c. Vercel, backend and frontend as two projects

| Vercel project | Root Directory | Configuration |
| --- | --- | --- |
| Backend (e.g. `resto-backend`) | `backend` | `backend/vercel.json`, `backend/api/index.py`: every path goes to Django |
| Frontend (e.g. `resto-front`) | `frontend` | `frontend/vercel.json`: Vite build, `/api`, `/django-admin`, `/static`, `/sitemap.xml`, `/robots.txt` proxied to the backend |

The frontend **proxies** the API instead of calling another domain: the
browser only ever talks to the frontend's domain, so the session and CSRF
cookies of the admin and courier apps keep working (cookies of another
`*.vercel.app` site would be third-party cookies, blocked by browsers).

The backend URL is written in `frontend/vercel.json`
(`https://resto-orcin-iota.vercel.app`): replace it if the backend project gets
another domain. Backend environment variables: as in 8b, plus

| Variable | Value |
| --- | --- |
| `CSRF_TRUSTED_ORIGINS` | `https://<frontend domain>` (requests arrive with the frontend's Origin) |
| `DJANGO_ALLOWED_HOSTS` | `<backend domain>,<frontend domain>` |
| `PUBLIC_SITE_URL` | `https://<frontend domain>` (absolute URLs in the sitemap) |

The frontend project needs no environment variable.

## 9. Pre-launch checklist

- [ ] `.env.production` filled, no placeholder left; file not committed
- [ ] HTTPS works; `http://` redirects to `https://`
- [ ] `docker compose … ps` shows every service healthy
- [ ] Owner account created; extra staff created with the **manager** role
- [ ] WhatsApp number set and tested: place a test order, press Send, check the message arrives
- [ ] Opening hours, delivery zones, fees and minimum order set
- [ ] Test order confirmed and completed from the dashboard, then cancelled or deleted
- [ ] `https://your-domain/sitemap.xml` and `/robots.txt` show your domain
- [ ] Backups scheduled for the database and the media volume
