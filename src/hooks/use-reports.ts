'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './use-api';

// ─── Response Types ───────────────────────────────────────────

export interface ReportSummary {
  totalRequests: number;
  issuedResolved: number;
  pendingProcessing: number;
  holdRejected: number;
  issuedPct: number;
  pendingPct: number;
  holdRejectedPct: number;
}

export interface BarChartDataPoint {
  name: string;
  Submitted: number;
  'For Review': number;
  'For Issuance': number;
  Hold: number;
  Rejected: number;
}

export interface PieChartDataPoint {
  name: string;
  value: number;
  color: string;
}

export interface TrendDataPoint {
  month: string;
  requests: number;
  complaints: number;
  resolved: number;
}

export interface ReportsResponse {
  summary: ReportSummary;
  barChartData: BarChartDataPoint[];
  pieChartData: PieChartDataPoint[];
  trendData: TrendDataPoint[];
  rawData: Array<Record<string, unknown>>;
}

export interface ReportsParams {
  period?: string;
  startDate?: string;
  endDate?: string;
  serviceType?: string;
  status?: string;
}

// ─── Hook ─────────────────────────────────────────────────────

export function useReports(params: ReportsParams = {}) {
  return useQuery<ReportsResponse>({
    queryKey: ['reports', params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.period) searchParams.set('period', params.period);
      if (params.startDate) searchParams.set('dateFrom', params.startDate);
      if (params.endDate) searchParams.set('dateTo', params.endDate);
      if (params.serviceType) searchParams.set('type', params.serviceType);
      if (params.status) searchParams.set('status', params.status);
      const qs = searchParams.toString();
      return apiFetch<ReportsResponse>(`/api/reports${qs ? `?${qs}` : ''}`);
    },
    staleTime: 30_000,
  });
}
