# 🛠️ Local Dev Environment — Quick Reference

This dev setup mirrors production exactly:
- **Same backend code** (`production-backend/server.js`)
- **Same database engine** (PostgreSQL 15)
- **Isolated from prod** — zero risk of touching `api.instorm.io` or the prod DB

---

## Architecture

```
http://localhost:3000   ←  React frontend (npm start, .env.development)
        │
        ▼
http://localhost:3001   ←  Production backend (Docker)
        │
        ▼
   localhost:5432       ←  PostgreSQL dev DB (Docker, persisted volume)
```

---

## First-time setup

```bash
# 1. Start everything + seed the dev database
./start-dev.sh --seed
```

That's it. The script will:
1. Start PostgreSQL + backend via Docker Compose
2. Wait until the backend is healthy
3. Seed dev users and evaluation form data
4. Start the React frontend

---

## Daily use

```bash
# Start dev environment
./start-dev.sh

# Stop everything (Ctrl+C also works — it auto-cleans up)
./start-dev.sh --stop
```

---

## Test credentials

All passwords are `password`.

| Email | Role |
|---|---|
| admin@dev.local | ADMIN |
| director@dev.local | SALES_DIRECTOR |
| manager@dev.local | REGIONAL_SALES_MANAGER |
| lead@dev.local | SALES_LEAD |
| salesperson@dev.local | SALESPERSON |

---

## Key files

| File | Purpose |
|---|---|
| `docker-compose.dev.yml` | Defines PostgreSQL + backend containers |
| `.env.dev` | Backend env vars (DB URL, JWT secrets, port) |
| `.env.development` | Frontend env vars — points React to `localhost:3001` |
| `seed-dev-data.js` | Seeds users + evaluation forms into dev DB |
| `start-dev.sh` | One-command startup script |

---

## Re-seeding / resetting

```bash
# Re-seed without losing data (safe, uses ON CONFLICT DO NOTHING)
node seed-dev-data.js

# Re-seed and clear dev users/categories first
node seed-dev-data.js --reset

# Nuke everything (containers + DB volume) and start fresh
./start-dev.sh --reset
```

---

## Using real production data safely (DEV only)

This flow lets you test with a copy of production data **without any risk to prod**.

### 1. Create a production backup (as you do today)

- Use the existing backup scripts on the production environment (for example `backup-database.js` or ECS task).
- Download the resulting `backup-YYYY-MM-DDTHH-MM-SS/backup.sql` file to your local machine.

### 2. Start the DEV environment

```bash
./start-dev.sh
```

Make sure:
- `scorecard-db-dev` is running and healthy.
- Backend health works: `curl http://localhost:3001/health`.

### 3. Restore the backup into DEV database

```bash
./restore-backup-to-dev.sh production-backend/backups/backup-2025-11-17T17-42-16/full.sql
```

What this script does:
- Connects **only** to the local Docker Postgres container `scorecard-db-dev`.
- Drops and recreates the `salesscorecard_dev` database inside that container.
- Applies the dump with `ON_ERROR_STOP=1` (fails fast on SQL errors).
- Strips incompatible ownership/timeout statements for local compatibility.

What it **never** does:
- It never connects to the production RDS endpoint.
- It never uses `DATABASE_URL` for remote connections.

This gives you a DEV backend (`http://localhost:3001`) and PWA (`http://localhost:3000`) running against a copy of production data, fully isolated from the real production system.

---

## Useful commands

```bash
# View backend logs
docker logs -f scorecard-backend-dev

# View DB logs
docker logs -f scorecard-db-dev

# Connect to dev DB directly
docker exec -it scorecard-db-dev psql -U scorecard -d salesscorecard_dev

# Rebuild backend image (after changing production-backend code)
docker compose -f docker-compose.dev.yml up -d --build backend
```

---

## Deploying changes to production

1. Test your changes in dev (`./start-dev.sh`)
2. Build the frontend: `npm run build`
3. Deploy to AWS: `./update-aws.sh`

**Production is never affected while working in dev.** The `.env.development` file is only used during `npm start`; the production build (`npm run build`) uses `.env` which still points to `api.instorm.io`.
