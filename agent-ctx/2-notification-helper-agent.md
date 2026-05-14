# Task 2 — notification-helper-agent

## Task
Create `/home/z/my-project/src/lib/notifications.ts` — shared notification helper library

## Work Done
- Read existing codebase: `src/lib/db.ts`, `src/lib/audit.ts`, `prisma/schema.prisma`, `worklog.md`
- Created `/home/z/my-project/src/lib/notifications.ts` with 6 exported functions:
  1. `createNotification(params)` — Creates single notification in DB + pushes `notification` event via relay
  2. `createNotificationForUsers(params)` — Creates notifications for multiple users via `createMany` + pushes `notification-bulk` event
  3. `createNotificationForRoles(params)` — Queries active users by roles, creates notifications, pushes `notification-role` event
  4. `createBroadcastNotification(params)` — Queries all active users, creates notifications, pushes `notification-broadcast` event
  5. `notifyDataChanged(params)` — Fire-and-forget `data-changed` event (no DB write)
  6. `pushUnreadCount(userId)` — Counts unread from DB and pushes `unread-count` event

## Implementation Details
- All relay calls are fire-and-forget using `Promise.resolve().then()` pattern — never blocks the main DB operation
- Relay errors are caught and logged but never thrown — graceful degradation if relay is down
- Relay URL: `http://localhost:3003/relay`, Header: `X-Relay-Key: csfd-relay-2026`
- `pushUnreadCount` is automatically called after every notification-creating function
- Types are properly defined for all function parameters
- Follows existing codebase patterns (similar to `audit.ts`)

## Verification
- `bun run lint` — passed with zero errors
