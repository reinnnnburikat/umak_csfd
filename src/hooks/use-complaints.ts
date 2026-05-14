'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './use-api';

// ─── Response Types ───────────────────────────────────────────

export interface Complaint {
  id: string;
  complaintNumber: string;
  trackingToken: string;
  complainants: unknown;
  respondents: unknown;
  subject: string;
  category: string | null;
  complaintCategory: string | null;
  description: string;
  desiredOutcome: string;
  dateOfIncident: string | null;
  location: string;
  isOngoing: string;
  howOften: string | null;
  witnesses: string | null;
  previousReports: string | null;
  fileUrls: string | null;
  caseStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ComplaintsResponse {
  data: Complaint[];
  pagination: ComplaintsPagination;
}

export interface ComplaintsParams {
  page?: number;
  category?: string;
  status?: string;
  search?: string;
}

// ─── Hook ─────────────────────────────────────────────────────

export function useComplaints(params: ComplaintsParams = {}) {
  return useQuery<ComplaintsResponse>({
    queryKey: ['complaints', params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', String(params.page));
      if (params.category) searchParams.set('category', params.category);
      if (params.status) searchParams.set('status', params.status);
      if (params.search) searchParams.set('search', params.search);
      const qs = searchParams.toString();
      return apiFetch<ComplaintsResponse>(`/api/complaints${qs ? `?${qs}` : ''}`);
    },
    staleTime: 30_000,
  });
}
