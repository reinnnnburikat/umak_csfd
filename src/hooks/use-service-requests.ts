'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './use-api';

// ─── Response Types ───────────────────────────────────────────

export interface ServiceRequest {
  id: string;
  requestNumber: string;
  requestType: string;
  requestorName: string;
  requestorEmail: string;
  status: string;
  purpose: string | null;
  details: unknown;
  fileUrls: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  issuedAt: string | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRequestsPaginatedResponse {
  requests: ServiceRequest[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ServiceRequestsListResponse {
  requests: ServiceRequest[];
  total: number;
  counts: Record<string, number>;
}

export type ServiceRequestsResponse =
  | ServiceRequestsPaginatedResponse
  | ServiceRequestsListResponse;

export interface ServiceRequestsParams {
  status?: string;
  serviceType?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Hook ─────────────────────────────────────────────────────

export function useServiceRequests(params: ServiceRequestsParams = {}) {
  return useQuery<ServiceRequestsResponse>({
    queryKey: ['service-requests', params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.status) searchParams.set('status', params.status);
      if (params.serviceType) searchParams.set('type', params.serviceType);
      if (params.search) searchParams.set('search', params.search);
      if (params.page) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      searchParams.set('mode', 'list');
      const qs = searchParams.toString();
      return apiFetch<ServiceRequestsResponse>(`/api/service-requests/list${qs ? `?${qs}` : ''}`);
    },
    staleTime: 30_000,
  });
}
