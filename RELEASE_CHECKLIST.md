# Release Checklist (Dev -> Prod)

Use this checklist for every production release.  
Goal: release only intended changes, with rollback readiness.

## 1) Scope and Diff Safety

- [ ] Release branch is up to date with `main`.
- [ ] PR includes only intended files (no backup/temp/local files).
- [ ] No secret-bearing files are included (`.env`, dumps, credentials, keys).
- [ ] Reviewer confirms change scope matches ticket/plan.

## 2) Environment Parity

- [ ] Change is validated in DEV first.
- [ ] DEV tests were run with the correct company context (Metro/InStorm).
- [ ] Admin and PWA behavior is validated for the same role/company combination.
- [ ] API base URLs and env vars are correct for target environment.

## 3) Build and Verification

- [ ] Frontend build passes (`npm run build`).
- [ ] Backend dependencies install cleanly (`production-backend`).
- [ ] Core smoke flows pass:
  - [ ] Login
  - [ ] Teams/users visibility by company
  - [ ] Evaluation create/view
  - [ ] Admin CRUD basics

## 4) Data and Migration Safety

- [ ] Production backup created before release/migration.
- [ ] Migration impact reviewed (forward + rollback plan).
- [ ] No scripts with hardcoded prod DB fallbacks are used.
- [ ] Restore procedure validated in DEV.

## 5) Deployment Guardrails

- [ ] Deploy is triggered from CI on a reviewed commit (not ad-hoc local state).
- [ ] Branch protections are enabled on `main` (PR + checks required).
- [ ] Production deploy job uses environment-scoped secrets only.
- [ ] Rollback owner and rollback command are explicitly confirmed.

## 6) Post-Deploy Validation

- [ ] Health endpoints respond normally.
- [ ] Error logs are clean (no spike in 4xx/5xx).
- [ ] Critical user path spot-check completed.
- [ ] If regression appears, rollback is executed immediately.

