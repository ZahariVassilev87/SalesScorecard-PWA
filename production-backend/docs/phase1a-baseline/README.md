# Local baseline flow (Phase 1A)

Use this to verify **API parity** before and after refactors, without touching production.

## Prerequisites

- PostgreSQL running locally (e.g. Docker `docker-compose.dev.yml`)
- `DATABASE_URL` in `production-backend/.env` or repo-root `.env.dev`
- Backend: `npm start` in `production-backend` (default port **3001** unless `PORT` is set)

## 1. Seed minimal test data (local only)

From **repository root**:

```bash
node scripts/phase1a-minimal-seed.js
```

See [SEEDED-DATA.md](./SEEDED-DATA.md) for IDs and users.

## 2. Capture / refresh JSON fixtures

With the API running on `http://localhost:3001`:

```bash
node scripts/generate-phase1a-baseline-fixtures.js
```

Outputs JSON under `production-backend/docs/phase1a-baseline/`. JWTs are redacted in stored files.

## 3. Compare after a refactor

1. Run the same generator against the **same** seeded DB and API base URL.
2. Diff JSON files with a tool that **ignores volatile fields** (see [FIXTURE-DIFF-IGNORE.md](../phase1a/FIXTURE-DIFF-IGNORE.md)).
3. Status codes and stable response shapes must match.

## Safety

- Do **not** point these scripts at production RDS.
- Full app seed (`seed-dev-data.js`) is separate; Phase 1A minimal seed is enough for contract checks.
