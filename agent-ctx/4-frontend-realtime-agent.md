# Task 4: Frontend Real-Time Agent

## Summary
Updated the UMak CSFD frontend to support real-time notification updates and data refresh using Socket.IO.

## Files Created
1. **`/src/hooks/use-socket.ts`** — Singleton Socket.IO hook that manages a single WebSocket connection per browser tab. Connects via `/?XTransformPort=3003`, handles authentication on connect/reconnect, and provides `on`/`emit` helpers.
2. **`/src/hooks/use-realtime-data.ts`** — Data refresh hook that listens for `data-changed` events on specified modules and calls a refresh callback with a 500ms debounce.

## Files Modified
1. **`/src/components/layout/internal-navbar.tsx`** — Replaced 60s polling with Socket.IO real-time listeners (`unread-count`, `notification`). Added 30s fallback polling. Added bell pulse animation when new notifications arrive.
2. **`/src/app/(protected)/notifications/page.tsx`** — Added Socket.IO listeners for `notification` (prepend to list, show toast) and `data-changed` (refetch on relevant module changes). Refetches on socket reconnect.
3. **`/src/app/(protected)/dashboard/page.tsx`** — Added `useRealtimeData` hook for `dashboard`, `service-requests`, `complaints`, and `announcements` modules. Refactored fetch to useCallback for proper hook dependency.
4. **`/src/app/(protected)/complaints/page.tsx`** — Added `useRealtimeData(['complaints'], fetchComplaints)` for real-time complaint list refresh.
5. **`/src/app/(protected)/service-requests/page.tsx`** — Added `useRealtimeData(['service-requests'], fetchRequests)` for real-time service request list refresh.
6. **`/src/app/globals.css`** — Added `@keyframes bellPulse` animation and `.animate-bell-pulse` class for notification bell wiggle effect.

## Architecture Decisions
- **Singleton Socket.IO pattern**: Only one socket connection per browser tab, shared across all components using the hook. Reference counting ensures proper cleanup.
- **30s fallback polling**: Socket.IO is primary, but HTTP polling every 30s ensures notification count stays accurate even if WebSocket drops.
- **500ms debounce in useRealtimeData**: Prevents rapid successive refreshes when multiple `data-changed` events fire in quick succession.
- **Toast notifications**: New notifications show a toast with the message and type as description.
- **Duplicate prevention**: The notification page checks for existing IDs before prepending to avoid duplicates.
- **Reconnect handling**: Both navbar and notifications page refetch data when socket reconnects to ensure state consistency.

## Lint Status
All ESLint errors resolved. No warnings.
