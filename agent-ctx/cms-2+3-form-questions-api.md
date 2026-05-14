# Task ID: cms-2+3 — Form Questions API + Seed Data Builder

## Summary
Created 3 API routes and 1 seed script for the FormQuestions CMS system.

## Files Created
1. **`src/app/api/form-questions/route.ts`** — CRUD API (GET/POST/PATCH/DELETE)
   - All endpoints require superadmin auth via `getSession()`
   - GET: List questions with optional `?phase=` filter, ordered by sortOrder
   - POST: Create question, validates required fields (phase, fieldType, label)
   - PATCH: Update question by id, only updates provided fields
   - DELETE: Soft-delete (isActive=false), not actual deletion
   - All mutations include audit logging

2. **`src/app/api/form-questions/reorder/route.ts`** — Reorder API
   - PATCH: Accepts `{ phase, questionIds }`, updates sortOrder atomically via `$transaction()`
   - Validates all IDs exist in the specified phase
   - Superadmin auth + audit logging

3. **`src/app/api/complaint-form/config/route.ts`** — Public config endpoint
   - No auth required
   - Returns `{ version: 1, phases: { ... } }` with only active questions
   - Person-phase filtering (complainant/respondent roleTarget)
   - Cache-Control: `s-maxage=60, stale-while-revalidate=120`

4. **`prisma/seed-form-questions.ts`** — Idempotent seed script
   - 35 default questions across 5 phases (instructions, complainant, respondent, complaint_details, review)
   - Dynamic choices use `dynamic:listType` convention
   - Validation rules stored as JSON strings
   - Successfully seeded: 35 created, 0 skipped
   - Idempotency verified: re-run produces 0 created, 35 skipped

## Verification
- `bun run lint` — passes with zero errors
- Seed idempotency confirmed
- All endpoints follow project conventions
