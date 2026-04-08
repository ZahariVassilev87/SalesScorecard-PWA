# Phase 1A — Definition of Done

Phase 1A **stabilizes the core backend** by extracting infrastructure and cross-cutting middleware **without changing product behavior**.

## In scope

- Load env / config from a dedicated module
- PostgreSQL pool creation from config (same SSL + URL rules as before)
- CORS setup extracted (same allowlist merge and origin callback behavior)
- Central Express error-handler **hook** (parity-safe; see `src/middleware/errorHandler.js`)
- JWT `authenticateToken` middleware extracted
- Role guard for evaluation creation (`authorizeEvaluationCreation`) extracted
- Company context helpers (`resolveCompanyContext`, `normalizeCompanyId`, `slugifyCompanyName`) extracted

## Out of scope (explicit)

- No new routes, renamed routes, or removed routes
- No request/response JSON shape changes for existing endpoints
- **No new database migrations or schema changes** in Phase 1A refactors
- No admin-panel or PWA changes
- No scoring/validation “engine” abstractions (Phase 2+)
- No unification of all error JSON bodies across the app

## Parity checks (must pass)

1. `node --check production-backend/server.js` succeeds
2. Local smoke using Phase 1A baseline flow:
   - `node scripts/phase1a-minimal-seed.js`
   - Start API → `node scripts/generate-phase1a-baseline-fixtures.js`
   - Same status codes as recorded in `docs/phase1a-baseline/_index.json` for the listed cases
3. Manual spot-check: `GET /health` returns `database: connected` when DB is up

## Done when

- All items in **In scope** are implemented as separate modules under `production-backend/src/`
- `server.js` only wires modules (composition) and keeps routes/business handlers in place
- Documentation in `docs/phase1a/` and `docs/phase1a-baseline/` is up to date
- Each change is committed in **small, reviewable commits** with parity notes in the message body if non-obvious
