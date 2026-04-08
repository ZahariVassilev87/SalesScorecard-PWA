# Phase 1A — Minimal local test data (fixture setup)

This is **test fixture setup for local development only**, not a product feature.

## How to seed

From repo root (requires Postgres reachable at `DATABASE_URL` or default dev URL):

```bash
node scripts/phase1a-minimal-seed.js
```

Requires `pg` and `bcrypt` available via `production-backend/node_modules` (same as other repo scripts).

## What gets created

### Company

| Field | Value |
|-------|--------|
| `id` | `phase1a_company` |
| `name` | Phase1A Test Co |
| `slug` | `phase1a-test-co` |

### Region

| Field | Value |
|-------|--------|
| `id` | `phase1a_region_1` |
| `name` | Phase1A Region |

If the `regions` table has a `companyId` column, it is set to `phase1a_company`.

### Users (password for both: `password`)

| Role | Email | `id` |
|------|--------|------|
| `SALES_LEAD` | `lead@phase1a.local` | `phase1a0000-0000-4000-8000-000000000001` |
| `SALESPERSON` | `salesperson@phase1a.local` | `phase1a0000-0000-4000-8000-000000000002` |

Both users have `"companyId" = 'phase1a_company'`.

### Team + membership (required for `GET /organizations/salespeople` as `SALES_LEAD`)

| Entity | Value |
|--------|--------|
| Team `id` | `phase1a_team_1` |
| Team name | Phase1A Team |
| `regionId` | `phase1a_region_1` |
| `managerId` | Sales Lead user id (see above) |
| `companyId` | `phase1a_company` (if column exists) |

| `user_teams` | Value |
|--------------|--------|
| Salesperson is member of `phase1a_team_1` | membership id `phase1a0000-0000-4000-8000-000000000020` |

The Sales Lead does not need a `user_teams` row when they are the team **manager**; the API union includes teams where `teams.managerId = lead`.

### Scoring data (minimum for `GET /scoring/categories`)

| Entity | Value |
|--------|--------|
| Category `id` | `phase1a0000-0000-4000-8000-000000000010` |
| Category name | `Phase1A Discovery (SALESPERSON)` (must match `SALESPERSON` in name for the standard form query) |
| Item `id` | `phase1a0000-0000-4000-8000-000000000011` |
| Item name | Phase1A behavior item |

## Baseline JSON fixtures

Generated against a **running local API** (default `http://localhost:3001`):

```bash
node scripts/generate-phase1a-baseline-fixtures.js
```

Outputs JSON files under this folder. JWT strings in responses are **redacted** in stored files (`<REDACTED_JWT_*>`); status codes and non-secret response shapes are preserved.

### Fixture list

See `_index.json`. Includes success paths and:

- login failure (wrong password)
- evaluation validation failure (invalid item score)
- `GET /evaluations/my` without `Authorization` (401)
- `POST /evaluations` as `SALESPERSON` (403)

## Production

**Do not run** these scripts against production RDS. They are for local / CI fixture databases only.
