import { Skeleton } from '@/components/ui/skeleton';

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-36 rounded-lg" />
        ))}
      </div>
      <div className="rounded-xl border bg-card p-4">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-80 w-full" />
      </div>
      <div className="rounded-xl border bg-card p-4">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}
