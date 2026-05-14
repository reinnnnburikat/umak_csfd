'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './use-api';

// ─── Response Types ───────────────────────────────────────────

export interface OffenseHistoryEntry {
  id: string;
  studentNumber: string;
  violationType: string;
  violationCategory: string;
  otherCategorySpecified: string | null;
  offenseCount: number;
  disciplinaryCaseId: string;
  dateOfInfraction: string | null;
  createdAt: string;
}

export interface DisciplinaryCase {
  id: string;
  studentName: string;
  studentNumber: string;
  sex: string | null;
  collegeInstitute: string | null;
  umakEmail: string | null;
  violationType: string;
  violationCategory: string;
  otherCategorySpecified: string | null;
  description: string | null;
  actionTaken: string | null;
  offenseCount: number;
  status: string;
  dateOfInfraction: string | null;
  fileUrls: string | null;
  officerName: string | null;
  isCleared: boolean | null;
  isEndorsed: boolean | null;
  createdAt: string;
  updatedAt: string;
  offenseHistory: OffenseHistoryEntry[];
}

export interface DisciplinaryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DisciplinaryResponse {
  data: DisciplinaryCase[];
  pagination: DisciplinaryPagination;
}

export interface DisciplinaryParams {
  page?: number;
  category?: string;
  status?: string;
  search?: string;
}

// ─── Hook ─────────────────────────────────────────────────────

export function useDisciplinaryCases(params: DisciplinaryParams = {}) {
  return useQuery<DisciplinaryResponse>({
    queryKey: ['disciplinary', params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', String(params.page));
      if (params.category) searchParams.set('category', params.category);
      if (params.status) searchParams.set('status', params.status);
      if (params.search) searchParams.set('search', params.search);
      const qs = searchParams.toString();
      return apiFetch<DisciplinaryResponse>(`/api/disciplinary${qs ? `?${qs}` : ''}`);
    },
    staleTime: 30_000,
  });
}
