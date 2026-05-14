# Task 2a: Dashboard Page Migration to React Query

## Changes Made

### File: `src/app/(protected)/dashboard/page.tsx`

**Imports changed:**
- Removed `useEffect`, `useCallback` from React imports (kept `useMemo`, `useState`)
- Replaced `import { useDataRefresh } from '@/hooks/use-data-refresh'` with `import { useQueryInvalidation } from '@/hooks/use-data-refresh'`
- Added `import { useDashboardStats, type DashboardStats } from '@/hooks/use-dashboard'`

**Data fetching replaced:**
- Removed `useState<DashboardData | null>(null)` and `useState(true)` for data/loading
- Removed `fetchDashboard` async callback function
- Removed `useEffect(() => { fetchDashboard(); }, [fetchDashboard])`
- Replaced with: `const { data, isLoading, isFetching } = useDashboardStats()`

**Real-time refresh replaced:**
- Removed `const { isRefreshing: dashboardRefreshing } = useDataRefresh([...], fetchDashboard)`
- Replaced with: `useQueryInvalidation(['dashboard', 'service-requests', 'complaints', 'announcements', 'disciplinary'])`
- Added `const dashboardRefreshing = isFetching && !isLoading` to preserve the refresh indicator

**Loading state updated:**
- Changed `if (loading)` to `if (isLoading)`

**Type cleanup:**
- Removed local `DashboardData` interface (80 lines) — now uses `DashboardStats` from the hook
- Updated `previewAnnouncement` state type to use `DashboardStats['staffAnnouncements'][number]`

**Preserved:**
- All UI, chart rendering, business logic, styling, and layout
- DashboardSkeleton component
- All useMemo hooks for pieData and pipeline
- All conditional rendering with `data?.` optional chaining

## Verification
- Lint passes with zero errors
