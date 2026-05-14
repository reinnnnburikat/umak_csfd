# Task 3 — api-routes-agent

## Task
Modify backend API routes to create notifications when key events happen

## Work Done
- Read worklog.md for prior context (bug fix, synthetic data removal, notification helper, socket relay, frontend real-time integration)
- Found notifications.ts did not exist on disk (previous agent's file was lost) — recreated from scratch with same public API
- Found notification-relay/index.ts did not exist on disk — recreated with /emit endpoint and proper event routing
- Tested relay: /health returns ok, /emit returns ok
- Modified 6 API route files to add notification logic:

### 1. complaints/route.ts — POST
- Added import: `createNotificationForRoles`, `notifyDataChanged`
- After email send block: `createNotificationForRoles` for staff/admin/superadmin with type `complaint_update`
- `notifyDataChanged` for complaints module (action: created)

### 2. complaints/[id]/route.ts — PATCH
- Added import: `createNotificationForRoles`, `notifyDataChanged`
- After audit log: conditional notifications for:
  - Status change → `complaint_update` notification
  - Progress update → `complaint_update` notification
  - Always → `data-changed` for complaints module (action: updated)

### 3. service-requests/route.ts — POST
- Added import: `createNotificationForRoles`, `notifyDataChanged`
- After email send block: `createNotificationForRoles` for staff/admin/superadmin with type `status_change`
- `notifyDataChanged` for service-requests module (action: created)

### 4. service-requests/[id]/route.ts — PATCH
- Added import: `createNotificationForRoles`, `notifyDataChanged`
- After audit log: conditional notification only when NOT regenerating AND status changed
- Type mapping: Issued→`request_issued`, Hold→`request_hold`, Rejected→`request_rejected`, else→`status_change`
- `notifyDataChanged` for both service-requests (action: status_changed) and dashboard (action: updated)

### 5. announcements/route.ts — POST
- Replaced old notification block with visibility-based routing:
  - "All" → `createBroadcastNotification` (all active users, excluding creator)
  - "Staff" → `createNotificationForRoles` (staff/admin/superadmin, excluding creator)
  - "Students" → `createNotificationForRoles` (student/faculty, excluding creator)
- `notifyDataChanged` for announcements module (action: created)

### 6. announcements/[id]/route.ts — PATCH + DELETE
- PATCH: Same visibility-based routing as POST, using updated title
- DELETE: Added `notifyDataChanged` for announcements module (action: deleted)
- All notification calls wrapped in try/catch

## Implementation Details
- All notification calls are placed AFTER the main DB operation and audit log
- All notification calls are wrapped in try/catch — notifications never break the main operation
- All notification calls are awaited (not fire-and-forget)
- Notification types match the frontend icon mapping in notifications/page.tsx
- Announcement visibility properly routes to correct user segments

## Files Modified
1. `src/app/api/complaints/route.ts`
2. `src/app/api/complaints/[id]/route.ts`
3. `src/app/api/service-requests/route.ts`
4. `src/app/api/service-requests/[id]/route.ts`
5. `src/app/api/announcements/route.ts`
6. `src/app/api/announcements/[id]/route.ts`

## Files Created
1. `src/lib/notifications.ts` (recreated — previous version was lost)
2. `mini-services/notification-relay/index.ts` (recreated — previous version was lost)

## Verification
- `bun run lint` — passed with zero errors
- Relay tested: `/health` and `/emit` endpoints both working
