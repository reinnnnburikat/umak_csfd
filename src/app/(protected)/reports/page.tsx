'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  FileBarChart,
  Download,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { useReports } from '@/hooks/use-reports';
import { useQueryInvalidation } from '@/hooks/use-data-refresh';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Lazy-load recharts (~200KB) out of the initial bundle
const ReportsCharts = dynamic(() => import('@/components/reports/reports-charts'), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[420px] rounded-xl" />
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
      <Skeleton className="h-[420px] rounded-xl" />
    </div>
  ),
});

interface ReportSummary {
  totalRequests: number;
  issuedResolved: number;
  pendingProcessing: number;
  holdRejected: number;
  issuedPct: number;
  pendingPct: number;
  holdRejectedPct: number;
}

interface BarChartDataItem {
  name: string;
  New: number;
  Processing: number;
  Issued: number;
  Hold: number;
  Rejected: number;
}

interface PieChartDataItem {
  name: string;
  value: number;
  color: string;
}

interface TrendDataItem {
  month: string;
  requests: number;
  complaints: number;
  resolved: number;
}

interface RawDataItem {
  type: string;
  requestType: string;
  requestNumber: string;
  requestorName: string;
  requestorEmail: string;
  status: string;
  createdAt: string;
  reviewedAt: string;
  category?: string;
}

interface ReportData {
  summary: ReportSummary;
  barChartData: BarChartDataItem[];
  pieChartData: PieChartDataItem[];
  trendData: TrendDataItem[];
  rawData: RawDataItem[];
}

const kpiCards = [
  {
    key: 'total' as const,
    label: 'Total Requests',
    icon: FileBarChart,
    color: 'bg-umak-blue/15 text-umak-blue',
    getValue: (s: ReportSummary) => s.totalRequests,
    getPct: () => null,
  },
  {
    key: 'issued' as const,
    label: 'Issued / Resolved',
    icon: CheckCircle2,
    color: 'bg-status-approved/15 text-status-approved',
    getValue: (s: ReportSummary) => s.issuedResolved,
    getPct: (s: ReportSummary) => s.issuedPct,
  },
  {
    key: 'pending' as const,
    label: 'Pending / Processing',
    icon: Clock,
    color: 'bg-status-pending/15 text-status-pending',
    getValue: (s: ReportSummary) => s.pendingProcessing,
    getPct: (s: ReportSummary) => s.pendingPct,
  },
  {
    key: 'hold' as const,
    label: 'Hold / Rejected',
    icon: XCircle,
    color: 'bg-status-major/15 text-status-major',
    getValue: (s: ReportSummary) => s.holdRejected,
    getPct: (s: ReportSummary) => s.holdRejectedPct,
  },
];

export default function ReportsPage() {
  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [serviceType, setServiceType] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // React Query invalidation for real-time data-refresh events
  useQueryInvalidation(['reports']);

  const { data, isLoading: loading, isFetching: generating, refetch } = useReports({
    period,
    startDate: dateFrom || undefined,
    endDate: dateTo || undefined,
    serviceType: serviceType !== 'All' ? serviceType : undefined,
    status: statusFilter !== 'All' ? statusFilter : undefined,
  });

  const handleGenerate = () => {
    refetch();
  };

  const handleExportCSV = () => {
    if (!data?.rawData?.length) return;

    const headers = ['Type', 'Request Type', 'Request Number', 'Requestor Name', 'Requestor Email', 'Status', 'Created At', 'Reviewed At', 'Category'];
    const rows = (data.rawData as unknown as RawDataItem[]).map((row) => [
      row.type,
      row.requestType,
      row.requestNumber,
      `"${(row.requestorName || '').replace(/"/g, '""')}"`,
      row.requestorEmail,
      row.status,
      row.createdAt,
      row.reviewedAt,
      row.category || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <ReportsSkeleton />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-umak-gold/15 flex items-center justify-center">
          <FileBarChart className="size-5 text-umak-gold" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-wider">REPORTS & ANALYTICS</h1>
          <p className="text-sm text-muted-foreground">Generate and analyze service request reports</p>
        </div>
      </div>

      {/* Filter Section */}
      <Card className="glass border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-umak-gold" />
            <CardTitle className="text-sm font-bold tracking-wider">FILTERS</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Period</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Service Type</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="GMC">GMC</SelectItem>
                  <SelectItem value="UER">UER</SelectItem>
                  <SelectItem value="CDC">CDC</SelectItem>
                  <SelectItem value="CAC">CAC</SelectItem>
                  <SelectItem value="Complaints">Complaints</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="Submitted">Submitted</SelectItem>
                  <SelectItem value="For Review">For Review</SelectItem>
                  <SelectItem value="For Issuance">For Issuance</SelectItem>
                  <SelectItem value="Issued">Issued</SelectItem>
                  <SelectItem value="Hold">Hold</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy font-semibold gap-2"
            >
              {generating ? (
                <>
                  <span className="size-4 border-2 border-umak-navy/30 border-t-umak-navy rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileBarChart className="size-4" />
                  Generate Report
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const value = data?.summary ? card.getValue(data.summary) : 0;
          const pct = data?.summary ? card.getPct(data.summary) : null;

          return (
            <div key={card.key} className="glass rounded-xl p-5 card-hover">
              <div className="flex items-center justify-between mb-3">
                <div className={`size-10 rounded-lg flex items-center justify-center ${card.color}`}>
                  <Icon className="size-5" />
                </div>
                {pct !== null && (
                  <Badge variant="secondary" className="text-xs">
                    {pct}%
                  </Badge>
                )}
              </div>
              <p className="text-3xl font-bold tracking-tight">{value}</p>
              <p className="text-sm text-muted-foreground mt-1">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Section (lazy-loaded) */}
      <ReportsCharts
        barChartData={data?.barChartData ?? []}
        pieChartData={data?.pieChartData ?? []}
        trendData={data?.trendData ?? []}
      />

      {/* Export Section */}
      <Card className="glass border-0 shadow-sm">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Export Report Data</p>
                <p className="text-xs text-muted-foreground">
                  Download the current filtered data as a CSV file ({data?.rawData?.length || 0} records)
                </p>
              </div>
            </div>
            <Button
              onClick={handleExportCSV}
              disabled={!data?.rawData?.length}
              variant="outline"
              className="gap-2 border-umak-gold/40 text-umak-gold hover:bg-umak-gold/10 hover:text-umak-gold"
            >
              <Download className="size-4" />
              Export to CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <div>
          <Skeleton className="h-6 w-48 mb-1" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-xl p-5">
            <Skeleton className="size-10 rounded-lg mb-3" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
