---
Task ID: 2d
Agent: Service Requests Page Migration
Task: Migrate service-requests page to React Query

Work Log:
- Read full service-requests page.tsx (~1154 lines) to understand existing data fetch pattern
- Identified pattern: useState for requests/counts/loading + useCallback fetchRequests + useEffect trigger
- Replaced `useCallback` import removal (no longer needed)
- Replaced `useDataRefresh` import with `useQueryInvalidation` from same module
- Added `useServiceRequests` hook import
- Removed 3 useState calls: requests, counts, loading
- Removed entire fetchRequests useCallback (~25 lines) and its useEffect trigger
- Replaced with `useServiceRequests({ status, serviceType, search })` hook
- Derived requests from `((data as any)?.requests ?? []) as ServiceRequest[]` (type mismatch between hook and page interfaces)
- Derived counts from `((data as any)?.counts ?? {}) as Record<string, number>`
- Mapped loading → isLoading, derived isRefreshing from `isFetching && !isLoading`
- Added `useQueryInvalidation(['service-requests'])` for Socket.IO real-time refresh
- Added client-side sorting to filteredRequests useMemo (hook doesn't support sortBy/sortOrder params)
- Replaced 3 `fetchRequests()` calls with `refetch()` in mutation handlers (handleIssueAction, handleBatchAction, ActionModal onActionComplete)
- Fixed indentation issue in sort block
- All lint checks pass with zero errors

Stage Summary:
- Service Requests page now uses React Query for data fetching
- All mutation operations use refetch() for data refresh
- Real-time Socket.IO invalidation via useQueryInvalidation
- Client-side sorting preserved (hook doesn't support server-side sort params)
- All UI, filtering, batch actions, card rendering, pagination, and print functionality preserved
