'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Search,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Hand,
  XCircle,
  Printer,
  Loader2,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { toast } from 'sonner';
import { useQueryInvalidation } from '@/hooks/use-data-refresh';
import { useServiceRequests } from '@/hooks/use-service-requests';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const ActionModal = dynamic(
  () => import('@/components/service/action-modal').then(mod => mod.ActionModal),
  { ssr: false, loading: () => <div className="animate-pulse bg-muted h-[600px] rounded-xl" /> }
);

// ── Types ──
interface ServiceRequest {
  id: string;
  requestNumber: string;
  requestType: string;
  requestorName: string;
  requestorEmail: string;
  classification: string | null;
  status: string;
  formData: string;
  fileUrls?: string | null;
  certificatePdfUrl?: string | null;
  remarks: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  issuedByName: string | null;
  issuedAt: string | null;
  createdAt: string;
}

type SortField = 'requestNumber' | 'requestorName' | 'requestType' | 'status' | 'createdAt';
type SortOrder = 'asc' | 'desc';

// ── Constants ──
const STATUS_LABELS: Record<string, string> = {
  'Submitted': 'Submitted',
  'For Review': 'For Review',
  'For Issuance': 'For Issuance',
  'Issued': 'Issued',
  'Hold': 'On Hold',
  'Rejected': 'Rejected',
  'New': 'Submitted',
  'Processing': 'For Review',
};

const STATUS_DISPLAY_COLORS: Record<string, string> = {
  'Submitted': 'bg-blue-500/15 text-blue-600 border-blue-500/25 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/35',
  'For Review': 'bg-amber-500/15 text-amber-600 border-amber-500/25 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/35',
  'For Issuance': 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/35',
  'Issued': 'bg-green-500/15 text-green-600 border-green-500/25 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/35',
  'Hold': 'bg-yellow-500/15 text-yellow-600 border-yellow-500/25 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/35',
  'Rejected': 'bg-red-500/15 text-red-600 border-red-500/25 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/35',
  // Legacy
  'New': 'bg-blue-500/15 text-blue-600 border-blue-500/25 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/35',
  'Processing': 'bg-amber-500/15 text-amber-600 border-amber-500/25 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/35',
};

const TYPE_BADGE_COLORS: Record<string, string> = {
  GMC: 'bg-blue-500/15 text-blue-600 border-blue-500/25 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/35',
  UER: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/35',
  CDC: 'bg-purple-500/15 text-purple-600 border-purple-500/25 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/35',
  CAC: 'bg-amber-500/15 text-amber-600 border-amber-500/25 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/35',
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  currently_enrolled: 'Currently Enrolled',
  graduate_alumni: 'Graduate / Alumni',
  non_completer: 'Non-Completer',
  working_student: 'Working Student',
  office_org_event: 'Office/Org Event',
  ojt: 'OJT',
  college_org_shirt: 'College Org Shirt',
  other: 'Other',
};

// Map raw DB status to display status (for legacy mapping)
function mapStatus(raw: string): string {
  return STATUS_LABELS[raw] || raw;
}

// Determine the "Issue" action based on current status
function getIssueAction(rawStatus: string): string | null {
  const mapped = mapStatus(rawStatus);
  switch (mapped) {
    case 'Submitted': return 'review';
    case 'For Review': return 'for_issuance';
    case 'For Issuance': return 'issue';
    default: return null;
  }
}

// Get the next status label for the Issue button tooltip
function getNextStatusLabel(rawStatus: string): string | null {
  const mapped = mapStatus(rawStatus);
  switch (mapped) {
    case 'Submitted': return 'For Review';
    case 'For Review': return 'For Issuance';
    case 'For Issuance': return 'Issued';
    default: return null;
  }
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'For Review', label: 'For Review' },
  { value: 'For Issuance', label: 'For Issuance' },
  { value: 'Issued', label: 'Issued' },
  { value: 'Hold', label: 'On Hold' },
  { value: 'Rejected', label: 'Rejected' },
] as const;

const STATUS_COUNT_CARDS = [
  { key: 'Submitted', label: 'Submitted', icon: FileText, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 dark:bg-blue-500/15', border: 'border-blue-500/20' },
  { key: 'For Review', label: 'For Review', icon: ClipboardCheck, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 dark:bg-amber-500/15', border: 'border-amber-500/20' },
  { key: 'For Issuance', label: 'For Issuance', icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 dark:bg-emerald-500/15', border: 'border-emerald-500/20' },
  { key: 'Issued', label: 'Issued', icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10 dark:bg-green-500/15', border: 'border-green-500/20' },
  { key: 'Hold', label: 'On Hold', icon: Hand, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/10 dark:bg-yellow-500/15', border: 'border-yellow-500/20' },
] as const;

// ── Batch Action Dialog ──
function BatchActionDialog({
  open,
  onClose,
  action,
  selectedCount,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  action: string | null;
  selectedCount: number;
  onConfirm: (remarks: string) => void;
  loading: boolean;
}) {
  const [remarks, setRemarks] = useState('');
  const [remarksError, setRemarksError] = useState('');
  const [prevAction, setPrevAction] = useState<string | null>(null);

  if (action !== prevAction) {
    setPrevAction(action);
    setRemarks('');
    setRemarksError('');
  }

  if (!action) return null;

  const needsRemarks = action === 'hold' || action === 'reject';
  const actionLabels: Record<string, string> = {
    review: 'Review',
    for_issuance: 'Move to For Issuance',
    issue: 'Issue',
    hold: 'Put On Hold',
    reject: 'Reject',
    // Legacy
    process: 'Review',
    mark_ready: 'Move to For Issuance',
    release: 'Issue',
  };

  const handleConfirm = () => {
    if (needsRemarks && !remarks.trim()) {
      setRemarksError('Remarks are required for this action.');
      return;
    }
    onConfirm(remarks.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Batch {actionLabels[action] || action}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You are about to <strong>{actionLabels[action]?.toLowerCase() || action}</strong> {selectedCount} request{selectedCount !== 1 ? 's' : ''}.
            {needsRemarks && ' Remarks are required.'}
          </p>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
              REMARKS {needsRemarks && <span className="text-red-500">*</span>}
            </label>
            <Textarea
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value);
                if (remarksError) setRemarksError('');
              }}
              placeholder="Enter remarks for this batch action..."
              rows={3}
              className={remarksError ? 'border-red-500 focus-visible:ring-red-500' : ''}
            />
            {remarksError && (
              <p className="text-xs text-red-500 mt-1">{remarksError}</p>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              className={action === 'reject' ? 'bg-red-500 hover:bg-red-600 text-white' : action === 'hold' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Confirm {actionLabels[action]}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Inner Component ──
function ServiceRequestsInner() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get('type') || 'All';
  const initialStatus = searchParams.get('status') || 'all';

  const [typeFilter, setTypeFilter] = useState(initialType);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoadingMap, setActionLoadingMap] = useState<Record<string, string | null>>({});

  // Sorting
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Detail modal
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Batch action dialog
  const [batchAction, setBatchAction] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // React Query data fetching
  const { data, isLoading, isFetching, refetch } = useServiceRequests({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    serviceType: typeFilter !== 'All' ? typeFilter : undefined,
    search: search || undefined,
  });

  const requests = ((data as any)?.requests ?? []) as ServiceRequest[];
  const counts = ((data as any)?.counts ?? {}) as Record<string, number>;
  const loading = isLoading;
  const isRefreshing = isFetching && !isLoading;

  // Real-time data refresh via Socket.IO → React Query invalidation
  useQueryInvalidation(['service-requests']);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, statusFilter, search]);

  // Filter and sort requests client-side
  const filteredRequests = useMemo(() => {
    let result = [...requests];

    // Status filter — compare against both raw status and mapped display status
    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter || mapStatus(r.status) === statusFilter);
    }

    // Client-side sorting (server sort not supported by hook)
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'requestNumber':
          comparison = a.requestNumber.localeCompare(b.requestNumber);
          break;
        case 'requestorName':
          comparison = a.requestorName.localeCompare(b.requestorName);
          break;
        case 'requestType':
          comparison = a.requestType.localeCompare(b.requestType);
          break;
        case 'status':
          comparison = mapStatus(a.status).localeCompare(mapStatus(b.status));
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [requests, statusFilter, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  // Search handler
  const handleSearch = () => {
    setSearch(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="size-3 text-muted-foreground/50" />;
    }
    return sortOrder === 'asc'
      ? <ArrowUp className="size-3" />
      : <ArrowDown className="size-3" />;
  };

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedRequests.map(r => r.id);
    const allSelected = pageIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredRequests.map(r => r.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const isAllPageSelected = paginatedRequests.length > 0 && paginatedRequests.every(r => selectedIds.has(r.id));

  // Quick action handler
  const handleIssueAction = async (requestId: string) => {
    const req = requests.find(r => r.id === requestId);
    if (!req) return;

    const action = getIssueAction(req.status);
    if (!action) return;

    const loadingKey = `${requestId}-issue`;
    setActionLoadingMap(prev => ({ ...prev, [requestId]: loadingKey }));

    try {
      const res = await fetch(`/api/service-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to update request');
        return;
      }

      const nextLabel = getNextStatusLabel(req.status);
      toast.success(`Request moved to ${nextLabel}`);
      refetch();
    } catch {
      toast.error('An error occurred. Please try again.');
    } finally {
      setActionLoadingMap(prev => ({ ...prev, [requestId]: null }));
    }
  };

  const handleHoldAction = (requestId: string) => {
    const req = requests.find(r => r.id === requestId);
    if (req) {
      setSelectedRequest(req);
      setModalOpen(true);
    }
  };

  // Batch action handler
  const handleBatchAction = async (remarks: string) => {
    if (!batchAction || selectedIds.size === 0) return;

    setBatchLoading(true);
    try {
      const res = await fetch('/api/service-requests/batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: batchAction,
          remarks,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Batch action failed');
        return;
      }

      const result = await res.json();
      if (result.failed > 0) {
        toast.warning(`${result.success} request(s) updated, ${result.failed} failed (invalid transitions)`);
      } else {
        toast.success(`${result.success} request(s) updated successfully`);
      }
      setSelectedIds(new Set());
      setBatchAction(null);
      refetch();
    } catch {
      toast.error('An error occurred. Please try again.');
    } finally {
      setBatchLoading(false);
    }
  };

  // Print handler
  const handlePrint = () => {
    const selectedRequests = requests.filter(r => selectedIds.has(r.id));
    if (selectedRequests.length === 0) {
      toast.error('No requests selected for printing');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window. Please allow popups.');
      return;
    }

    const printDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const cardsHtml = selectedRequests.map(req => {
      let parsedFormData: Record<string, unknown> = {};
      try { parsedFormData = JSON.parse(req.formData); } catch { /* empty */ }
      const entries = Object.entries(parsedFormData).filter(([key]) => key !== 'classification');
      const displayStatus = mapStatus(req.status).replace(/\s/g, '');
      const statusLabel = mapStatus(req.status);
      const dateStr = new Date(req.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const classification = req.classification ? `<div class="field"><span class="field-label">Classification: </span><span class="field-value">${CLASSIFICATION_LABELS[req.classification] || req.classification}</span></div>` : '';
      const detailsHtml = entries.map(([key, value]) => {
        const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (s) => s.toUpperCase());
        const displayValue = value === null || value === undefined || value === '' ? '—' : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
        return `<div class="field"><span class="field-label">${displayKey}: </span><span class="field-value">${displayValue}</span></div>`;
      }).join('');
      const detailsSection = entries.length > 0
        ? `<div style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 8px;"><div class="field-label" style="margin-bottom: 4px; font-size: 11px;">ADDITIONAL DETAILS</div>${detailsHtml}</div>`
        : '';
      const remarksSection = req.remarks ? `<div class="field" style="margin-top: 8px;"><span class="field-label">Remarks: </span><span class="field-value">${req.remarks}</span></div>` : '';

      return [
        '<div class="card">',
        '  <div class="card-header">',
        `    <span class="req-number">${req.requestNumber}</span>`,
        `    <span class="type-badge">${req.requestType}</span>`,
        '  </div>',
        `  <div class="field"><span class="field-label">Requestor: </span><span class="field-value">${req.requestorName}</span></div>`,
        `  <div class="field"><span class="field-label">Email: </span><span class="field-value">${req.requestorEmail}</span></div>`,
        classification,
        `  <div class="field"><span class="field-label">Status: </span><span class="status-badge status-${displayStatus}">${statusLabel}</span></div>`,
        `  <div class="field"><span class="field-label">Date Submitted: </span><span class="field-value">${dateStr}</span></div>`,
        detailsSection,
        remarksSection,
        '</div>',
      ].join('\n');
    }).join('\n');

    const html = [
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      '  <title>Service Requests - Batch Print</title>',
      '  <style>',
      '    body { font-family: Arial, sans-serif; padding: 20px; color: #1a1a2e; }',
      '    h1 { font-size: 18px; margin-bottom: 4px; }',
      '    .subtitle { font-size: 12px; color: #6b7280; margin-bottom: 20px; }',
      '    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; page-break-inside: avoid; }',
      '    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }',
      '    .req-number { font-weight: bold; font-size: 14px; }',
      '    .type-badge { background: #e8eaf6; color: #111c4e; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }',
      '    .field { font-size: 12px; margin-bottom: 4px; }',
      '    .field-label { color: #6b7280; }',
      '    .field-value { font-weight: 500; }',
      '    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }',
      '    .status-Submitted { background: #dbeafe; color: #2563eb; }',
      '    .status-ForReview { background: #fef3c7; color: #d97706; }',
      '    .status-ForIssuance { background: #d1fae5; color: #059669; }',
      '    .status-Issued { background: #dcfce7; color: #16a34a; }',
      '    .status-Hold { background: #fef9c3; color: #ca8a04; }',
      '    .status-Rejected { background: #fee2e2; color: #dc2626; }',
      '    @media print { body { padding: 0; } }',
      '  </style>',
      '</head>',
      '<body>',
      '  <h1>Service Requests - Batch Print</h1>',
      `  <div class="subtitle">Printed on ${printDate} | ${selectedRequests.length} request(s)</div>`,
      cardsHtml,
      '</body>',
      '</html>',
    ].join('\n');

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-umak-blue/15 flex items-center justify-center">
          <FileText className="size-5 text-umak-blue" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            SERVICE REQUESTS
            {isRefreshing && (
              <span className="size-2 rounded-full bg-umak-gold animate-pulse inline-block ml-2 align-middle" />
            )}
          </h1>
          <p className="text-sm text-muted-foreground">Manage and process all incoming service requests</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <Link href="/service-requests/issued">
              <CheckCircle2 className="size-3.5" />
              Issued Requests
              <ExternalLink className="size-3" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Status Count Cards */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {STATUS_COUNT_CARDS.map((card) => {
            const count = counts[card.key] || 0;
            const Icon = card.icon;
            return (
              <Card
                key={card.key}
                className={`border ${card.border} cursor-pointer hover:shadow-md transition-all duration-200 ${statusFilter === card.key ? 'ring-2 ring-offset-1 ring-current' : ''}`}
                onClick={() => {
                  setStatusFilter(statusFilter === card.key ? 'all' : card.key);
                }}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`size-9 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`size-4 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-none">{count}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Type filter */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Request Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Types</SelectItem>
            <SelectItem value="GMC">Good Moral (GMC)</SelectItem>
            <SelectItem value="UER">Uniform Exemption (UER)</SelectItem>
            <SelectItem value="CDC">Cross-Dressing (CDC)</SelectItem>
            <SelectItem value="CAC">Child Admission (CAC)</SelectItem>
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="size-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by request #, name, or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleSearch}>
            Search
          </Button>
          {search && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => { setSearch(''); setSearchInput(''); }}
            >
              <X className="size-3.5 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Count */}
        <div className="text-sm text-muted-foreground">
          {filteredRequests.length} result{filteredRequests.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Selection toolbar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-umak-blue/5 dark:bg-umak-blue/10 border border-umak-blue/15"
          >
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs">
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={deselectAll} className="text-xs">
                Deselect
              </Button>

              <Separator orientation="vertical" className="h-6" />

              {/* Batch actions */}
              <Button
                size="sm"
                className="bg-blue-500 hover:bg-blue-600 text-white text-xs gap-1"
                onClick={() => setBatchAction('review')}
                disabled={batchLoading}
              >
                <ClipboardCheck className="size-3" /> Review
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                onClick={() => setBatchAction('for_issuance')}
                disabled={batchLoading}
              >
                <CheckCircle2 className="size-3" /> For Issuance
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white text-xs gap-1"
                onClick={() => setBatchAction('issue')}
                disabled={batchLoading}
              >
                <CheckCircle2 className="size-3" /> Issue
              </Button>
              <Button
                size="sm"
                className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs gap-1"
                onClick={() => setBatchAction('hold')}
                disabled={batchLoading}
              >
                <Hand className="size-3" /> Hold
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="text-xs gap-1"
                onClick={() => setBatchAction('reject')}
                disabled={batchLoading}
              >
                <XCircle className="size-3" /> Reject
              </Button>

              <Separator orientation="vertical" className="h-6" />

              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={handlePrint}
              >
                <Printer className="size-3" /> Print
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="rounded-xl border bg-card/50 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="size-5 shrink-0" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-36 flex-1" />
                <Skeleton className="h-5 w-12 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="size-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No service requests found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {search ? 'Try adjusting your search or filters' : 'Requests will appear here when submitted'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={isAllPageSelected}
                    onCheckedChange={toggleSelectAll}
                    className="size-4"
                  />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('requestNumber')}
                >
                  <div className="flex items-center gap-1.5">
                    Request #
                    <SortIcon field="requestNumber" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('requestorName')}
                >
                  <div className="flex items-center gap-1.5">
                    Requestor
                    <SortIcon field="requestorName" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('requestType')}
                >
                  <div className="flex items-center gap-1.5">
                    Type
                    <SortIcon field="requestType" />
                  </div>
                </TableHead>
                <TableHead>Classification</TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1.5">
                    Status
                    <SortIcon field="status" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center gap-1.5">
                    Date
                    <SortIcon field="createdAt" />
                  </div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {paginatedRequests.map((req) => {
                  const displayStatus = mapStatus(req.status);
                  const issueAction = getIssueAction(req.status);
                  const nextStatusLabel = getNextStatusLabel(req.status);
                  const isLoading = actionLoadingMap[req.id] || null;

                  return (
                    <motion.tr
                      key={req.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="group cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => {
                        setSelectedRequest(req);
                        setModalOpen(true);
                      }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(req.id)}
                          onCheckedChange={() => toggleSelect(req.id)}
                          className="size-4"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-bold text-sm">{req.requestNumber}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm truncate max-w-[200px]">{req.requestorName}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{req.requestorEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold px-1.5 py-0 ${TYPE_BADGE_COLORS[req.requestType] || ''}`}
                        >
                          {req.requestType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {req.classification ? (
                          <span className="text-xs text-muted-foreground">
                            {CLASSIFICATION_LABELS[req.classification] || req.classification.replace(/_/g, ' ')}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold px-2 py-0.5 ${STATUS_DISPLAY_COLORS[req.status] || STATUS_DISPLAY_COLORS[displayStatus] || ''}`}
                        >
                          {displayStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(req.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setSelectedRequest(req);
                              setModalOpen(true);
                            }}
                          >
                            <Eye className="size-3" />
                            View
                          </Button>
                          {issueAction && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
                              onClick={() => handleIssueAction(req.id)}
                              disabled={isLoading !== null}
                              title={`Advance to ${nextStatusLabel}`}
                            >
                              {isLoading === `${req.id}-issue` ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="size-3" />
                              )}
                              {displayStatus === 'Submitted' ? 'Review' : displayStatus === 'For Review' ? 'For Issuance' : 'Issue'}
                            </Button>
                          )}
                          {displayStatus !== 'Hold' && displayStatus !== 'Rejected' && displayStatus !== 'Issued' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-500/10 dark:text-yellow-400"
                              onClick={() => handleHoldAction(req.id)}
                              disabled={isLoading !== null}
                              title="Put on hold"
                            >
                              <Hand className="size-3" />
                              Hold
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {!loading && filteredRequests.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredRequests.length)} of {filteredRequests.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="size-3.5" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={page}
                    variant={page === currentPage ? 'default' : 'outline'}
                    size="sm"
                    className="size-8 p-0 text-xs"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              Next
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Action Modal */}
      <ActionModal
        request={selectedRequest}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onActionComplete={() => {
          refetch();
        }}
      />

      {/* Batch Action Dialog */}
      <BatchActionDialog
        open={batchAction !== null}
        onClose={() => setBatchAction(null)}
        action={batchAction}
        selectedCount={selectedIds.size}
        onConfirm={handleBatchAction}
        loading={batchLoading}
      />
    </div>
  );
}

// ── Skeleton ──
function ServiceRequestsSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <div>
          <Skeleton className="h-7 w-48 mb-1" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      {/* Status cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <Skeleton className="size-9 rounded-lg" />
              <div>
                <Skeleton className="h-6 w-8 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-[180px]" />
        <Skeleton className="h-9 w-[160px]" />
        <Skeleton className="h-9 flex-1 max-w-md" />
      </div>
      {/* Table skeleton */}
      <div className="rounded-xl border p-6 space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="size-5 shrink-0" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36 flex-1" />
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page Export ──
export default function ServiceRequestsPage() {
  return (
    <Suspense fallback={<ServiceRequestsSkeleton />}>
      <ServiceRequestsInner />
    </Suspense>
  );
}
