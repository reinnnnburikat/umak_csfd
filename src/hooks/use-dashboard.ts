'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './use-api';

// ─── Response Types ───────────────────────────────────────────

export interface DashboardUser {
  fullName: string;
  role: string;
  profileImageUrl: string | null;
}

export interface DashboardCounters {
  pendingRequests: number;
  todayNewRequests: number;
  activeComplaints: number;
  disciplinaryThisMonth: number;
  forIssuancePending: number;
  onHoldRequests: number;
  issuedToday: number;
}

export interface DailySummary {
  total: number;
  pending: number;
  issued: number;
  resolvedPct: number;
}

export interface TrendDataPoint {
  month: string;
  GMC: number;
  UER: number;
  CDC: number;
  CAC: number;
  total: number;
}

export interface ComparisonDataPoint {
  period: string;
  requests: number;
  complaints: number;
  disciplinary: number;
}

export interface ComplaintCategoryDataPoint {
  name: string;
  count: number;
}

export interface DashboardStats {
  user: DashboardUser;
  requestTypeCounts: Record<string, number>;
  complaintCount: number;
  statusCounts: Record<string, number>;
  totalRequests: number;
  latestAnnouncements: Array<{
    id: string;
    title: string;
    body: string;
    postedFrom: string;
    postedTo: string;
    isPinned: boolean;
    createdAt: string;
  }>;
  staffAnnouncements: Array<{
    id: string;
    title: string;
    body: string;
    visibility: string;
    postedFrom: string;
    postedTo: string;
    isPinned: boolean;
    createdAt: string;
    fileUrl: string | null;
  }>;
  dailySummary: DailySummary;
  monthlySummary: DailySummary;
  counters: DashboardCounters;
  trendData: TrendDataPoint[];
  comparisonData: ComparisonDataPoint[];
  complaintCategoryData: ComplaintCategoryDataPoint[];
  latestServiceRequests: Array<{
    id: string;
    requestNumber: string;
    requestType: string;
    requestorName: string;
    status: string;
    createdAt: string;
  }>;
  latestComplaints: Array<{
    id: string;
    complaintNumber: string;
    subject: string;
    caseStatus: string;
    category: string | null;
    createdAt: string;
  }>;
  latestDisciplinary: Array<{
    id: string;
    studentName: string;
    studentNumber: string;
    violationType: string;
    violationCategory: string | null;
    status: string;
    createdAt: string;
  }>;
}

// ─── Hook ─────────────────────────────────────────────────────

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiFetch<DashboardStats>('/api/dashboard'),
    staleTime: 30_000,
  });
}
