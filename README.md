# DR HOME Backend V1

Self-hosted backend for the DR HOME customer PWA.

## Stack
- Node.js + TypeScript
- PostgreSQL 16
- Docker Compose
- Server-side sessions stored in PostgreSQL

## Start

```bash
cp .env.example .env
```

Edit `.env` and set strong values for `POSTGRES_PASSWORD` and `SESSION_SECRET`.

Generate a secret with:

```bash
openssl rand -hex 32
```

Then:

```bash
docker compose up -d --build
```

Check:

```bash
docker compose ps
docker compose logs -f api
```

Health test:

```bash
curl http://127.0.0.1:3000/health
```

Expected:

```json
{"ok":true,"service":"drhome-api"}
```

## Seed demo data

```bash
docker compose exec api node dist/scripts/seed.js
```

Default demo credentials are in `.env.example` and should be changed before public use.

Demo data:
- Opal Tower - Marina
- AC Maintenance
- Appointment 23 Sep 2026, 10:00-12:00

## Recommended deployment

Use:
- `app.drhome.ae` for the PWA
- `api.drhome.ae` for this API
- PostgreSQL only on Docker's internal network

The API binds to `127.0.0.1:3000`, so put Nginx/Caddy in front of it.

Example Nginx proxy:

```nginx
server {
    listen 443 ssl http2;
    server_name api.drhome.ae;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Current API

Public:
- `GET /health`
- `POST /api/auth/login`

Authenticated:
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/properties`
- `GET /api/appointments`
- `POST /api/appointments`

## Before real customer data

Next production steps:
- Admin users + roles
- Password reset
- CSRF protection
- Database backups
- Documents/object storage
- Push subscriptions
- Audit log
- Database migration tooling

Never expose PostgreSQL port 5432 publicly.
