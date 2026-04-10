# Scorecard Flexibility Ideas

## Goal
Enable fully flexible, company-specific evaluation scorecards managed from admin UI (no hardcoded form dependency), with safe versioning, historical integrity, and optional AI-assisted draft creation.

## Current context
- System is hybrid today:
  - Some forms are still hardcoded in PWA.
  - Some company config exists in admin/backend.
- This was kept for production safety and parity.
- Requirement is to move toward self-service editing in admin:
  - add/remove sections and items
  - EN/BG text editing
  - 1-4 score explanation editing
  - safe publish and rollback

## End-state vision
- Admin is source of truth for forms.
- Draft -> Validate -> Publish flow.
- Versioned templates by company and role context.
- Old evaluations always display using their original template version.
- Optional AI assistant generates editable draft templates from prompt.

## Implementation phases

### Phase 1: Manual Form Builder (No AI)
- Add versioned template data model:
  - templates
  - sections
  - items
  - i18n labels
  - i18n score rubrics (1..4)
- Add admin APIs for:
  - list templates/versions
  - create draft
  - edit draft
  - publish
  - rollback
- Add PWA runtime API to fetch active template by context:
  - company
  - evaluator role
  - target role
  - customer type
- Keep hardcoded fallback temporarily if no template exists.

### Phase 2: Version Safety + History Integrity
- Store `templateId` + `templateVersion` on each evaluation.
- Store stable item reference (`itemKey` or equivalent) on evaluation items.
- History/detail rendering uses saved template version.
- No historical data rewriting.
- Rollback switches active version, does not mutate old records.

### Phase 3: AI Draft Copilot in Admin
- Add endpoint and UI for prompt-based draft generation.
- AI output must be structured JSON:
  - sections
  - items
  - weights
  - EN/BG labels
  - EN/BG 1..4 score explanations
- AI can only create/update draft (never direct publish).

## Safety guardrails (must-have)
- Published templates are immutable.
- All publish actions must pass server validation:
  - required EN/BG fields
  - all 1..4 rubrics present
  - valid weights
  - valid role/customer context binding
- Company scoping enforced at API level.
- Audit trail for edits/publish/rollback.
- Preview before publish.

## Suggested file touchpoints
- Backend:
  - `production-backend/server.js` (schema + APIs + publish/version logic)
- Admin UI:
  - `production-backend/admin-panel/src/App.tsx`
  - `production-backend/admin-panel/src/App.css`
- PWA:
  - `src/services/api.ts`
  - `src/components/SalespersonEvaluationForm.tsx`
  - `src/components/CoachingEvaluationForm.tsx`
  - `src/components/EvaluationHistory.tsx`

## Rough timeline (full scope)
- Best case: 3 weeks
- Realistic: 4-5 weeks
- With hardening + rollout buffer: 6 weeks

### Breakdown
- Manual builder + APIs + PWA read path: 8-10 working days
- Versioning + publish/rollback + history compatibility: 5-7 working days
- AI draft generator + UX + validation: 4-6 working days
- QA/UAT + rollout + fixes: 4-7 working days

## Faster staged delivery
- Weeks 1-2: Manual builder + versioning + publish/rollback (no AI)
- Week 3: AI draft assistant on top of stable builder

## Notes from recent UX changes
- Comment entry moved to cluster level in forms.
- Cluster comment can be made mandatory before submit.
- Validation banner can be shown near submit buttons for visibility.
- History can support both:
  - legacy per-question comments
  - new single cluster comment view

