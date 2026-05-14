'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Search,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  ArrowLeft,
  Download,
  Loader2,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getServeFileUrl, openFileUrl } from '@/lib/file-url';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { toast } from 'sonner';
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
  certificatePdfUrl: string | null;
  remarks: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  issuedByName: string | null;
  issuedAt: string | null;
  createdAt: string;
}

type SortField = 'requestNumber' | 'requestorName' | 'requestType' | 'createdAt';
type SortOrder = 'asc' | 'desc';

// ── Constants ──
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

export default function IssuedRequestsPage() {
  const router = useRouter();

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Detail modal
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        mode: 'list',
        type: typeFilter,
        status: 'Issued',
        sortBy: sortField,
        sortOrder,
      });
      if (search) {
        params.set('search', search);
      }
      const res = await fetch(`/api/service-requests/list?${params}`);
      if (res.ok) {
        const data = await res.json();
        // Filter to only show Issued status (including legacy mappings)
        const issued = (data.requests || []).filter(
          (r: ServiceRequest) => r.status === 'Issued' || r.status === 'Released'
        );
        setRequests(issued);
      }
    } catch (err) {
      // Fetch error
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search, sortField, sortOrder]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, search]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(requests.length / pageSize));
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return requests.slice(start, start + pageSize);
  }, [requests, currentPage, pageSize]);

  const handleSearch = () => setSearch(searchInput);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

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

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => router.push('/service-requests')}
        >
          <ArrowLeft className="size-4" />
          Back to All Requests
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-green-500/15 flex items-center justify-center">
          <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">ISSUED REQUESTS</h1>
          <p className="text-sm text-muted-foreground">
            All certificates and documents that have been issued
            {!loading && ` — ${requests.length} total`}
          </p>
        </div>
      </div>

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
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card/50 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-36 flex-1" />
                <Skeleton className="h-5 w-12 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="size-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No issued requests found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {search ? 'Try adjusting your search or filters' : 'Issued requests will appear here'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
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
                <TableHead>Reviewed By</TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center gap-1.5">
                    Date Issued
                    <SortIcon field="createdAt" />
                  </div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {paginatedRequests.map((req) => (
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
                      <span className="text-xs text-muted-foreground">
                        {req.reviewedByName || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {(req.issuedAt || req.reviewedAt || req.createdAt)
                          ? new Date(req.issuedAt || req.reviewedAt || req.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
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
                        {req.certificatePdfUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-500/10 dark:text-green-400"
                            onClick={() => openFileUrl(req.certificatePdfUrl)}
                          >
                            <Download className="size-3" />
                            PDF
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {!loading && requests.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, requests.length)} of {requests.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Action Modal */}
      <ActionModal
        request={selectedRequest}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onActionComplete={fetchRequests}
      />
    </div>
  );
}
