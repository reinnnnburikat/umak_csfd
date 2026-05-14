'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { getServeFileUrl, getIframeSrcUrl, openFileUrl } from '@/lib/file-url';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle,
  Hand,
  Loader2,
  FileText,
  FileCheck,
  Download,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  UserCheck,
  User,
  Mail,
  Calendar,
  GraduationCap,
  ClipboardCheck,
  PackageCheck,
  RefreshCw,
  Pencil,
  X,
  Maximize2,
  Trash2,
  Loader2 as LoaderIcon,
} from 'lucide-react';
import {
  getOffenseColor,
  getCategoryLabel,
  getOffenseContrastText,
} from '@/lib/offense-colors';

/* ────────────────────────────────────────────────────────────────────── */
/*  Types                                                                  */
/* ────────────────────────────────────────────────────────────────────── */

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

interface ActionModalProps {
  request: ServiceRequest | null;
  open: boolean;
  onClose: () => void;
  onActionComplete: () => void;
  isSuperAdmin?: boolean;
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Status Labels & Colors                                                */
/* ────────────────────────────────────────────────────────────────────── */

const REQUEST_TYPE_LABELS: Record<string, string> = {
  GMC: 'Good Moral Certificate',
  UER: 'Uniform Exemption',
  CDC: 'Cross-Dressing Clearance',
  CAC: 'Child Admission Clearance',
};

const REQUEST_TYPE_ICONS: Record<string, typeof FileText> = {
  GMC: FileCheck,
  UER: PackageCheck,
  CDC: UserCheck,
  CAC: GraduationCap,
};

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

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; icon: typeof Clock }> = {
  'Submitted': { bg: 'bg-blue-500/10 dark:bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20', icon: Clock },
  'For Review': { bg: 'bg-amber-500/10 dark:bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', icon: ClipboardCheck },
  'For Issuance': { bg: 'bg-emerald-500/10 dark:bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20', icon: PackageCheck },
  'Issued': { bg: 'bg-green-500/10 dark:bg-green-500/15', text: 'text-green-600 dark:text-green-400', border: 'border-green-500/20', icon: CheckCircle },
  'Hold': { bg: 'bg-yellow-500/10 dark:bg-yellow-500/15', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-500/20', icon: Hand },
  'Rejected': { bg: 'bg-red-500/10 dark:bg-red-500/15', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/20', icon: AlertTriangle },
  // Legacy
  'New': { bg: 'bg-blue-500/10 dark:bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20', icon: Clock },
  'Processing': { bg: 'bg-amber-500/10 dark:bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', icon: ClipboardCheck },
};

/** Map current status → the action string to send and the label for the Issue button */
const ISSUE_ACTION_MAP: Record<string, { action: string; label: string; targetStatus: string; color: string }> = {
  'Submitted': { action: 'review', label: 'Review', targetStatus: 'For Review', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
  'For Review': { action: 'for_issuance', label: 'Move to For Issuance', targetStatus: 'For Issuance', color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  'For Issuance': { action: 'issue', label: 'Issue Certificate', targetStatus: 'Issued', color: 'bg-green-600 hover:bg-green-700 text-white' },
  // Legacy mappings
  'New': { action: 'review', label: 'Review', targetStatus: 'For Review', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
  'Processing': { action: 'for_issuance', label: 'Move to For Issuance', targetStatus: 'For Issuance', color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
};

/** Statuses where the Issue button should be hidden */
const ISSUE_HIDDEN_STATUSES = new Set(['Issued', 'Hold', 'Rejected', 'Released']);

/** Statuses where the Hold button should be hidden */
const HOLD_HIDDEN_STATUSES = new Set(['Issued', 'Hold', 'Rejected', 'Released']);

/* ────────────────────────────────────────────────────────────────────── */
/*  Infraction History Sub-Component                                      */
/* ────────────────────────────────────────────────────────────────────── */

interface DisciplinaryData {
  studentNumber: string;
  totalOffenses: number;
  minorOffenses: number;
  majorOffenses: number;
  clearedOffenses: number;
  activeOffenses: number;
  violationCategories: string[];
  pendingCommunityService: Array<{
    id: string;
    violationType: string;
    violationCategory: string;
    description: string | null;
    actionTaken: string | null;
    dateOfInfraction: string | null;
    isEndorsed: boolean;
    offenseCount: number;
    status: string;
  }>;
  recentCases: Array<{
    id: string;
    violationType: string;
    violationCategory: string;
    description: string | null;
    actionTaken: string | null;
    offenseCount: number;
    status: string;
    dateOfInfraction: string | null;
    isCleared: boolean;
    isEndorsed: boolean;
  }>;
}

/** Helper to get a color-coded dot/bg for a violation category */
function getCategoryColorClasses(category: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (category) {
    case 'MAJOR':
      return {
        bg: 'bg-red-500/15 dark:bg-red-500/20',
        text: 'text-red-600 dark:text-red-400',
        border: 'border-red-500/25 dark:border-red-500/35',
      };
    case 'MINOR':
      return {
        bg: 'bg-yellow-500/15 dark:bg-yellow-500/20',
        text: 'text-yellow-600 dark:text-yellow-400',
        border: 'border-yellow-500/25 dark:border-yellow-500/35',
      };
    default:
      return {
        bg: 'bg-muted',
        text: 'text-muted-foreground',
        border: 'border-muted',
      };
  }
}

function OffenseBadge({ category, offenseCount }: { category: string; offenseCount: number }) {
  const color = getOffenseColor(category, offenseCount);
  const contrastText = getOffenseContrastText(color.hex);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${color.bg} ${contrastText}`}
      title={color.action}
    >
      {color.label}
    </span>
  );
}

function InfractionHistorySection({ studentNumber }: { studentNumber: string }) {
  const [fetchedKey, setFetchedKey] = useState('');
  const [data, setData] = useState<DisciplinaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!studentNumber) return;
    if (fetchedKey === studentNumber) return;

    let cancelled = false;

    fetch(`/api/disciplinary/lookup?studentNumber=${encodeURIComponent(studentNumber)}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then(json => {
        if (!cancelled) {
          setData(json);
          setFetchedKey(studentNumber);
          setLoading(false);
          setError(false);
          if (json.totalOffenses > 0) {
            setIsOpen(true);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
          setFetchedKey(studentNumber);
        }
      });

    return () => { cancelled = true; };
  }, [studentNumber, fetchedKey]);

  if (loading) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
          INFRACTION HISTORY
        </p>
        <div className="rounded-lg border p-4 space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
          INFRACTION HISTORY
        </p>
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 flex items-center gap-3">
          <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">No Disciplinary Record</p>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">This student has a clean record with no offenses.</p>
          </div>
        </div>
      </div>
    );
  }

  // Clean record
  if (data.totalOffenses === 0) {
    return (
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
          INFRACTION HISTORY
        </p>
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 flex items-center gap-3">
          <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">No Disciplinary Record</p>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">This student has a clean record with no offenses.</p>
          </div>
        </div>
      </div>
    );
  }

  // Has offenses - render as collapsible section
  return (
    <div>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent"
          >
            <div className="flex items-center gap-2">
              {isOpen ? (
                <ChevronDown className="size-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground" />
              )}
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                INFRACTION HISTORY
              </p>
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                {data.totalOffenses} offense{data.totalOffenses !== 1 ? 's' : ''}
              </Badge>
            </div>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {/* Warning card with summary */}
          <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3 mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Disciplinary Record Found — {data.totalOffenses} Total Offense{data.totalOffenses !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800">
                  Minor: {data.minorOffenses}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">
                  Major: {data.majorOffenses}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                  Active: {data.activeOffenses}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700">
                  Cleared: {data.clearedOffenses}
                </Badge>
              </div>
            </div>

            {/* Pending community service */}
            {data.pendingCommunityService.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                  <Clock className="size-3" />
                  Pending Community Service ({data.pendingCommunityService.length})
                </p>
                <div className="space-y-1.5">
                  {data.pendingCommunityService.map(c => (
                    <div key={c.id} className="rounded border border-orange-200 dark:border-orange-800/50 bg-white/50 dark:bg-black/20 p-2.5 text-xs space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.violationType}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-5 px-1.5 ${getCategoryColorClasses(c.violationCategory).border} ${getCategoryColorClasses(c.violationCategory).text}`}
                        >
                          {getCategoryLabel(c.violationCategory)}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                          {c.status}
                        </Badge>
                      </div>
                      {c.description && (
                        <p className="text-muted-foreground">{c.description}</p>
                      )}
                      {c.actionTaken && (
                        <p className="text-muted-foreground">Action: {c.actionTaken}</p>
                      )}
                      {c.dateOfInfraction && (
                        <p className="text-muted-foreground">{new Date(c.dateOfInfraction).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recent cases in a proper table */}
          {data.recentCases.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 border-b">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Recent Cases (latest {data.recentCases.length})
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px]">Violation</TableHead>
                    <TableHead className="text-[11px]">Category</TableHead>
                    <TableHead className="text-[11px] text-center">Offense</TableHead>
                    <TableHead className="text-[11px]">Status</TableHead>
                    <TableHead className="text-[11px] text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentCases.map(c => {
                    const catColors = getCategoryColorClasses(c.violationCategory);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs font-medium py-2 max-w-[160px]">
                          <div className="flex items-start gap-1.5">
                            {c.violationCategory === 'MAJOR' ? (
                              <AlertTriangle className="size-3.5 text-red-500 mt-0.5 shrink-0" />
                            ) : c.violationCategory === 'MINOR' ? (
                              <AlertTriangle className="size-3.5 text-yellow-500 mt-0.5 shrink-0" />
                            ) : (
                              <AlertTriangle className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            )}
                            <span className="truncate" title={c.violationType}>{c.violationType}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs py-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-5 px-1.5 ${catColors.bg} ${catColors.text} ${catColors.border}`}
                          >
                            {getCategoryLabel(c.violationCategory)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs py-2 text-center">
                          <OffenseBadge category={c.violationCategory} offenseCount={c.offenseCount} />
                        </TableCell>
                        <TableCell className="text-xs py-2">
                          <div className="flex items-center gap-1.5">
                            {c.isCleared ? (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400">
                                Cleared
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                {c.status}
                              </Badge>
                            )}
                            {c.isEndorsed && !c.isCleared && (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300">
                                Endorsed
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground py-2 text-right whitespace-nowrap">
                          {c.dateOfInfraction
                            ? new Date(c.dateOfInfraction).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Main ActionModal                                                      */
/* ────────────────────────────────────────────────────────────────────── */

export function ActionModal({ request, open, onClose, onActionComplete, isSuperAdmin }: ActionModalProps) {
  const [showHoldRemarks, setShowHoldRemarks] = useState(false);
  const [holdRemarks, setHoldRemarks] = useState('');
  const [holdRemarksError, setHoldRemarksError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [liveRequest, setLiveRequest] = useState<ServiceRequest | null>(null);

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!currentRequest) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/service-requests/${currentRequest.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`Service request #${currentRequest.requestNumber} deleted successfully.`);
        handleClose();
        onActionComplete();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete service request.');
      }
    } catch {
      toast.error('An error occurred while deleting.');
    } finally {
      setDeleting(false);
    }
  };

  // Edit & Regenerate state
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<Record<string, unknown>>({});
  const [editClassification, setEditClassification] = useState<string>('');
  const [pdfViewerKey, setPdfViewerKey] = useState(0); // force iframe refresh

  // Sync liveRequest with the prop when request changes or modal opens
  useEffect(() => {
    if (open && request) {
      setLiveRequest(request);
    }
  }, [open, request]);

  const currentRequest = liveRequest;

  if (!currentRequest) return null;

  const status = currentRequest.status;
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG['Submitted'];
  const StatusIcon = statusConfig.icon;
  const issueConfig = ISSUE_ACTION_MAP[status];
  const canIssue = issueConfig && !ISSUE_HIDDEN_STATUSES.has(status);
  const canHold = !HOLD_HIDDEN_STATUSES.has(status);

  const ReqTypeIcon = REQUEST_TYPE_ICONS[currentRequest.requestType] || FileText;

  /* ── Action Handlers ─────────────────────────────────────────────── */

  const handleIssue = async () => {
    if (!issueConfig) return;

    setActionLoading('issue');
    try {
      const res = await fetch(`/api/service-requests/${currentRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: issueConfig.action }),
      });

      if (!res.ok) {
        let errorMsg = 'Failed to update request';
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch {
          // JSON parsing failed, use default error message
        }
        toast.error(errorMsg);
        return;
      }

      const updatedData = await res.json();
      const meta = updatedData._meta;
      const label = STATUS_LABELS[issueConfig.targetStatus] || issueConfig.targetStatus;

      // Show detailed feedback based on whether PDF was generated synchronously
      if (issueConfig.action === 'issue' && currentRequest.requestType === 'GMC') {
        if (meta?.pdfGenerated) {
          toast.success(`Certificate issued successfully! PDF generated. Status moved to ${label}.`, { duration: 5000 });
          toast.info(`The email with PDF attachment will be sent to ${currentRequest.requestorEmail} shortly.`, { duration: 7000 });
        } else {
          const errorMsg = meta?.pdfError || 'Unknown error';
          toast.success(`Certificate issued! Status moved to ${label}.`, { duration: 5000 });
          toast.error(`PDF generation failed: ${errorMsg}. Use the "Edit & Regenerate" or "Regenerate" button to retry.`, { duration: 10000 });
        }
      } else if (issueConfig.action === 'for_issuance' && currentRequest.requestType === 'GMC') {
        if (meta?.pdfGenerated) {
          toast.success(`Request moved to ${label}. PDF certificate generated successfully.`, { duration: 6000 });
        } else {
          const errorMsg = meta?.pdfError || 'Unknown error';
          toast.success(`Request moved to ${label}.`, { duration: 5000 });
          toast.error(`PDF generation failed: ${errorMsg}. The PDF will be re-attempted when issuing, or you can retry now using the "Regenerate" button.`, { duration: 10000 });
        }
      } else {
        toast.success(`Request ${currentRequest.requestNumber} has been moved to ${label}.`);
      }

      // Update liveRequest with the API response so the modal refreshes in place
      setLiveRequest((prev) => prev ? { ...prev, ...updatedData, status: updatedData.status || issueConfig.targetStatus } : null);
      resetState();
      onActionComplete();
    } catch {
      toast.error('An error occurred. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleHoldClick = () => {
    setShowHoldRemarks(true);
    setHoldRemarksError('');
  };

  const handleHoldCancel = () => {
    setShowHoldRemarks(false);
    setHoldRemarks('');
    setHoldRemarksError('');
  };

  const handleHoldConfirm = async () => {
    if (!holdRemarks.trim()) {
      setHoldRemarksError('Remarks are required to place this request on hold.');
      return;
    }
    setHoldRemarksError('');

    setActionLoading('hold');
    try {
      const res = await fetch(`/api/service-requests/${currentRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'hold',
          remarks: holdRemarks.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to place request on hold');
        return;
      }

      toast.success(`Request ${currentRequest.requestNumber} has been placed on hold.`);
      resetState();
      onActionComplete();
      onClose();
    } catch {
      toast.error('An error occurred. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const resetState = () => {
    setShowHoldRemarks(false);
    setHoldRemarks('');
    setHoldRemarksError('');
    setIsEditing(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  /* ── Edit & Regenerate Handlers ──────────────────────────────────── */

  const handleStartEdit = () => {
    if (!currentRequest) return;
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(currentRequest.formData); } catch { parsed = {}; }
    setEditFormData(parsed);
    setEditClassification(currentRequest.classification || 'currently_enrolled');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditFormData({});
    setEditClassification('');
  };

  const handleRegenerate = async () => {
    if (!currentRequest) return;

    setActionLoading('regenerate');
    try {
      // Build the updated form data fields (only send changed fields)
      const updatedFields: Record<string, unknown> = {};
      const currentParsed: Record<string, unknown> = {};
      try { Object.assign(currentParsed, JSON.parse(currentRequest.formData)); } catch { /* empty */ }

      // Compare and collect changed fields
      const editableKeys = ['purpose', 'yearLevel', 'degreeTitle', 'graduateSubType', 'signaturePreference', 'studentNumber'];
      for (const key of editableKeys) {
        if (editFormData[key] !== currentParsed[key]) {
          updatedFields[key] = editFormData[key] || '';
        }
      }

      const body: Record<string, unknown> = {
        action: 'regenerate',
        formData: Object.keys(updatedFields).length > 0 ? updatedFields : undefined,
        classification: editClassification !== currentRequest.classification ? editClassification : undefined,
      };

      const res = await fetch(`/api/service-requests/${currentRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to regenerate certificate');
        return;
      }

      const updatedData = await res.json();
      const meta = updatedData._meta;

      if (meta?.pdfGenerated) {
        toast.success(`Certificate regenerated successfully! Updated PDF sent to ${currentRequest.requestorEmail}.`, { duration: 6000 });
        // Force iframe refresh
        setPdfViewerKey(prev => prev + 1);
      } else {
        const errorMsg = meta?.pdfError || 'Unknown error';
        toast.error(`PDF generation failed: ${errorMsg}. Please check the certificate resources and try again.`, { duration: 8000 });
      }

      // Update liveRequest with the API response
      setLiveRequest((prev) => {
        if (!prev) return null;
        const newFormData = updatedData.formData || (Object.keys(updatedFields).length > 0 ? JSON.stringify({ ...currentParsed, ...updatedFields }) : prev.formData);
        return {
          ...prev,
          ...updatedData,
          formData: newFormData,
          classification: editClassification || prev.classification,
          certificatePdfUrl: meta?.certificatePdfUrl || prev.certificatePdfUrl,
        };
      });

      setIsEditing(false);
      onActionComplete();
    } catch {
      toast.error('An error occurred while regenerating. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  /* ── Data Parsing ────────────────────────────────────────────────── */

  let parsedFormData: Record<string, unknown> = {};
  try {
    parsedFormData = JSON.parse(currentRequest.formData);
  } catch {
    parsedFormData = {};
  }

  let fileUrls: string[] = [];
  try {
    fileUrls = currentRequest.fileUrls ? JSON.parse(currentRequest.fileUrls) : [];
  } catch {
    fileUrls = [];
  }

  const certificatePdfUrl = currentRequest.certificatePdfUrl || null;

  const studentNumber = (parsedFormData.studentNumber as string) || '';

  const classificationLabels: Record<string, string> = {
    currently_enrolled: 'Currently Enrolled',
    graduate_alumni: 'Graduate / Alumni',
    graduate_college: 'Graduate (College)',
    graduate_hsu: 'Graduate (Senior High)',
    non_completer: 'Non-Completer',
    working_student: 'Working Student',
    office_org_event: 'Office/Org Event',
    ojt: 'OJT',
    college_org_shirt: 'College Org Shirt',
    other: 'Other',
  };

  /* ── Form Data Renderer ──────────────────────────────────────────── */

  const renderFormData = () => {
    const entries = Object.entries(parsedFormData);
    if (entries.length === 0) {
      return <p className="text-sm text-muted-foreground">No form data available</p>;
    }

    const skipFields = new Set(['classification', 'uploadedFiles', 'category']);

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {entries
          .filter(([key]) => !skipFields.has(key))
          .map(([key, value]) => {
            const displayKey = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/_/g, ' ')
              .replace(/^./, (str) => str.toUpperCase());

            let displayValue = '';
            if (value === null || value === undefined || value === '') {
              displayValue = '—';
            } else if (typeof value === 'boolean') {
              displayValue = value ? 'Yes' : 'No';
            } else if (typeof value === 'object') {
              displayValue = JSON.stringify(value);
            } else {
              displayValue = String(value);
            }

            return (
              <div key={key} className="space-y-0.5">
                <p className="text-xs text-muted-foreground">{displayKey}</p>
                <p className="text-sm font-medium">{displayValue}</p>
              </div>
            );
          })}
      </div>
    );
  };

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`size-8 rounded-lg ${statusConfig.bg} flex items-center justify-center shrink-0`}>
              <StatusIcon className={`size-4 ${statusConfig.text}`} />
            </div>
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <Badge className={`${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border}`}>
                {STATUS_LABELS[status] || status}
              </Badge>
              <span className="text-base font-bold">{REQUEST_TYPE_LABELS[currentRequest.requestType] || currentRequest.requestType}</span>
              <span className="text-sm text-muted-foreground font-mono">#{currentRequest.requestNumber}</span>
            </div>
            {isSuperAdmin && (
              <Button
                variant="destructive"
                size="sm"
                className="ml-auto shrink-0"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="size-3.5 mr-1" />
                Delete
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* 1. Student & Request Information */}
          <Card className={`border ${statusConfig.border} shadow-sm`}>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                STUDENT & REQUEST INFORMATION
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2.5">
                  <User className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-sm font-semibold">{currentRequest.requestorName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Mail className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{currentRequest.requestorEmail}</p>
                  </div>
                </div>
                {studentNumber && (
                  <div className="flex items-start gap-2.5">
                    <GraduationCap className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Student Number</p>
                      <p className="text-sm font-medium">{studentNumber}</p>
                    </div>
                  </div>
                )}
                {currentRequest.classification && (
                  <div className="flex items-start gap-2.5">
                    <GraduationCap className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Classification</p>
                      <Badge variant="secondary" className="text-xs mt-0.5">
                        {classificationLabels[currentRequest.classification] || currentRequest.classification}
                      </Badge>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <Calendar className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Date Submitted</p>
                    <p className="text-sm font-medium">
                      {new Date(currentRequest.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <ReqTypeIcon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Request Type</p>
                    <p className="text-sm font-medium">{REQUEST_TYPE_LABELS[currentRequest.requestType] || currentRequest.requestType}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Request Details */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              REQUEST DETAILS
            </p>
            {renderFormData()}
          </div>

          {/* 3. Uploaded Documents */}
          {fileUrls.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                UPLOADED DOCUMENTS
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fileUrls.map((url, i) => {
                  const isImage = /^data:image\//i.test(url) || /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                  const serveUrl = getServeFileUrl(url) || url;
                  return (
                    <div key={i} className="rounded-lg border overflow-hidden bg-muted/30">
                      {isImage ? (
                        <img src={serveUrl} alt={`Document ${i + 1}`} className="w-full h-48 object-cover" />
                      ) : (
                        <div className="p-3">
                          <div className="flex items-center gap-2 text-sm">
                            <FileText className="size-4 text-muted-foreground" />
                            <span className="truncate">Document {i + 1}</span>
                          </div>
                        </div>
                      )}
                      <div className="p-2 border-t">
                        <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => openFileUrl(url)}>
                          <Download className="size-3 mr-1" /> View Full
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3.5. Good Moral Certificate PDF */}
          {currentRequest.requestType === 'GMC' && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                GOOD MORAL CERTIFICATE
              </p>

              {/* Certificate PDF viewer / info — only when PDF exists */}
              {certificatePdfUrl ? (
                status === 'Issued' ? (
                  /* Inline PDF viewer for issued requests */
                  <div className="space-y-3">
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-lg bg-emerald-500/15 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <FileCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                              Certificate PDF
                            </p>
                            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                              Good Moral Certificate for {currentRequest.requestorName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs h-8 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            onClick={() => openFileUrl(certificatePdfUrl)}
                          >
                            <Maximize2 className="size-3.5" />
                            Full Screen
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs h-8 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            onClick={() => openFileUrl(certificatePdfUrl, { download: true, fileName: `Good_Moral_Certificate_${currentRequest.requestNumber}.pdf` })}
                          >
                            <Download className="size-3.5" />
                            Download
                          </Button>
                        </div>
                      </div>
                      {/* Inline PDF viewer */}
                      {!isEditing && (
                        <div className="rounded-lg border border-emerald-300/50 dark:border-emerald-700/50 overflow-hidden bg-white dark:bg-black/20">
                          <iframe
                            key={pdfViewerKey}
                            src={getIframeSrcUrl(certificatePdfUrl, `#toolbar=1&navpanes=0&_t=${pdfViewerKey}`) || ''}
                            className="w-full border-0"
                            style={{ height: '500px' }}
                            title={`Certificate PDF - ${currentRequest.requestNumber}`}
                          />
                        </div>
                      )}
                    </div>

                    {/* Edit & Regenerate buttons (when NOT in edit mode) */}
                    {!isEditing && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-8 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                          onClick={handleStartEdit}
                          disabled={actionLoading !== null}
                        >
                          <Pencil className="size-3.5" />
                          Edit & Regenerate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-8 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          onClick={handleRegenerate}
                          disabled={actionLoading !== null}
                        >
                          {actionLoading === 'regenerate' ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="size-3.5" />
                          )}
                          Regenerate PDF
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Non-issued status (e.g., For Issuance): show certificate info + edit/regenerate buttons */
                  <div className="space-y-3">
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
                      <div className="flex items-start gap-3">
                        <div className="size-10 rounded-lg bg-emerald-500/15 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                          <FileCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                            Certificate PDF Generated
                          </p>
                          <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
                            Good Moral Certificate for {currentRequest.requestorName} is ready.
                          </p>
                          <div className="flex items-center gap-2 mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              onClick={() => openFileUrl(certificatePdfUrl)}
                            >
                              <ExternalLink className="size-3.5" />
                              View Certificate
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              onClick={() => openFileUrl(certificatePdfUrl, { download: true, fileName: `Good_Moral_Certificate_${currentRequest.requestNumber}.pdf` })}
                            >
                              <Download className="size-3.5" />
                              Download Certificate
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Edit & Regenerate buttons for For Issuance status */}
                    {!isEditing && (status === 'For Issuance') && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-8 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                          onClick={handleStartEdit}
                          disabled={actionLoading !== null}
                        >
                          <Pencil className="size-3.5" />
                          Edit & Regenerate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-8 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          onClick={handleRegenerate}
                          disabled={actionLoading !== null}
                        >
                          {actionLoading === 'regenerate' ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="size-3.5" />
                          )}
                          Regenerate PDF
                        </Button>
                      </div>
                    )}
                  </div>
                )
              ) : (
                /* No PDF yet — show info about PDF generation status */
                (status === 'For Issuance' || status === 'Issued') && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-4">
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-lg bg-amber-500/15 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
                        <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                          PDF Not Generated Yet
                        </p>
                        <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5">
                          The certificate PDF has not been generated. Use &quot;Edit & Regenerate&quot; to edit details and generate the PDF, or &quot;Regenerate&quot; to retry.
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs h-8 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                            onClick={handleStartEdit}
                            disabled={actionLoading !== null}
                          >
                            <Pencil className="size-3.5" />
                            Edit & Regenerate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs h-8 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            onClick={handleRegenerate}
                            disabled={actionLoading !== null}
                          >
                            {actionLoading === 'regenerate' ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="size-3.5" />
                            )}
                            Regenerate PDF
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Edit form — always visible when isEditing is true, regardless of certificatePdfUrl */}
              {isEditing && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-4 mt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Pencil className="size-4 text-amber-600 dark:text-amber-400" />
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                        Edit Request Info
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={handleCancelEdit}
                      disabled={actionLoading !== null}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-amber-700/70 dark:text-amber-400/70">
                    Edit the fields below, then click &quot;Save & Regenerate&quot; to update the certificate and resend it via email.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Classification */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        Classification
                      </Label>
                      <Select
                        value={editClassification}
                        onValueChange={setEditClassification}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select classification" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="currently_enrolled">Currently Enrolled</SelectItem>
                          <SelectItem value="graduate_alumni">Graduate / Alumni</SelectItem>
                          <SelectItem value="graduate_college">Graduate (College)</SelectItem>
                          <SelectItem value="graduate_hsu">Graduate (Senior High)</SelectItem>
                          <SelectItem value="non_completer">Non-Completer</SelectItem>
                          <SelectItem value="former_student">Former Student</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Purpose */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        Purpose
                      </Label>
                      <Input
                        value={String(editFormData.purpose || '')}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, purpose: e.target.value }))}
                        placeholder="e.g., Employment, Scholarship, etc."
                      />
                    </div>

                    {/* Year Level */}
                    {editClassification === 'currently_enrolled' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                          Year Level
                        </Label>
                        <Input
                          value={String(editFormData.yearLevel || '')}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, yearLevel: e.target.value }))}
                          placeholder="e.g., 3rd Year"
                        />
                      </div>
                    )}

                    {/* Degree Title */}
                    {(editClassification === 'graduate_college' || editClassification === 'graduate_alumni') && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                          Degree Title
                        </Label>
                        <Input
                          value={String(editFormData.degreeTitle || '')}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, degreeTitle: e.target.value }))}
                          placeholder="e.g., Bachelor of Science in Information Technology"
                        />
                      </div>
                    )}

                    {/* Graduate Sub Type */}
                    {editClassification === 'graduate_alumni' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                          Graduate Sub Type
                        </Label>
                        <Select
                          value={String(editFormData.graduateSubType || 'college')}
                          onValueChange={(val) => setEditFormData(prev => ({ ...prev, graduateSubType: val }))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select sub type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="college">College</SelectItem>
                            <SelectItem value="hsu">Senior High School (HSU)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Signature Preference */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        Signature Preference
                      </Label>
                      <Select
                        value={String(editFormData.signaturePreference || 'wet_sign')}
                        onValueChange={(val) => setEditFormData(prev => ({ ...prev, signaturePreference: val }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select signature type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wet_sign">Wet Sign</SelectItem>
                          <SelectItem value="esign">E-Signature</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={actionLoading !== null}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="gap-2 bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
                      onClick={handleRegenerate}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === 'regenerate' ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      Save & Regenerate
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. Infraction History (collapsible) */}
          {studentNumber && (
            <InfractionHistorySection studentNumber={studentNumber} />
          )}

          {/* 5. Existing Remarks */}
          {currentRequest.remarks && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                EXISTING REMARKS
              </p>
              <p className="text-sm bg-muted/50 rounded-lg p-3">{currentRequest.remarks}</p>
            </div>
          )}

          {/* 6. Review & Issue Info */}
          {(currentRequest.reviewedByName || currentRequest.issuedByName) && (
            <div className="flex flex-wrap gap-3">
              {currentRequest.reviewedByName && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-sm">
                  <ClipboardCheck className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    Reviewed by <strong className="text-foreground">{currentRequest.reviewedByName}</strong>
                    {currentRequest.reviewedAt && (
                      <> on {new Date(currentRequest.reviewedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}</>
                    )}
                  </span>
                </div>
              )}
              {currentRequest.issuedByName && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/10 text-sm">
                  <UserCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Issued by <strong>{currentRequest.issuedByName}</strong>
                    {currentRequest.issuedAt && (
                      <> on {new Date(currentRequest.issuedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}</>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 6.5. Issued Success Banner */}
          {status === 'Issued' && (
            <div className="rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-950/20 p-4 flex items-center gap-3">
              <div className="size-10 rounded-full bg-green-500/15 dark:bg-green-500/20 flex items-center justify-center shrink-0">
                <CheckCircle className="size-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                  Certificate Issued Successfully
                </p>
                <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-0.5">
                  {currentRequest.issuedByName
                    ? `Issued by ${currentRequest.issuedByName}${currentRequest.issuedAt ? ` on ${new Date(currentRequest.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}`
                    : 'This certificate has been issued and is ready for the student.'}
                </p>
              </div>
            </div>
          )}

          <Separator />

          {/* 7. Hold Remarks (shown only when user clicks Hold) */}
          {showHoldRemarks && (
            <div className="space-y-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-4">
              <div className="flex items-center gap-2">
                <Hand className="size-4 text-amber-600 dark:text-amber-400" />
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Place on Hold
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  REMARKS <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={holdRemarks}
                  onChange={(e) => {
                    setHoldRemarks(e.target.value);
                    if (holdRemarksError) setHoldRemarksError('');
                  }}
                  placeholder="Provide a reason for placing this request on hold..."
                  rows={3}
                  className={holdRemarksError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  autoFocus
                />
                {holdRemarksError && (
                  <p className="text-xs text-red-500 mt-1">{holdRemarksError}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleHoldCancel}
                  disabled={actionLoading !== null}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gap-2 bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
                  onClick={handleHoldConfirm}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'hold' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Hand className="size-4" />
                  )}
                  Hold
                </Button>
              </div>
            </div>
          )}

          {/* 8. Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-1">
            {/* Back */}
            <Button
              variant="outline"
              className="gap-2 border-border"
              onClick={handleClose}
              disabled={actionLoading !== null}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>

            <div className="flex-1" />

            {/* Hold (only when not in hold-remarks mode) */}
            {canHold && !showHoldRemarks && (
              <Button
                className="gap-2 bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20"
                onClick={handleHoldClick}
                disabled={actionLoading !== null}
              >
                <Hand className="size-4" />
                Hold
              </Button>
            )}

            {/* Issue / Review / For Issuance / Issue Certificate */}
            {canIssue && (
              <Button
                className={`gap-2 ${issueConfig.color} shadow-sm shadow-green-500/20`}
                onClick={handleIssue}
                disabled={actionLoading !== null}
              >
                {actionLoading === 'issue' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle className="size-4" />
                )}
                {issueConfig.label}
              </Button>
            )}

            {/* Certificate Edit & Regenerate actions (when status is Issued or For Issuance for GMC) */}
            {(status === 'Issued' || status === 'For Issuance') && currentRequest.requestType === 'GMC' && (
              <>
                <Button
                  variant="outline"
                  className="gap-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                  onClick={handleStartEdit}
                  disabled={actionLoading !== null}
                >
                  <Pencil className="size-4" />
                  Edit & Regenerate
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  onClick={handleRegenerate}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'regenerate' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Regenerate
                </Button>
              </>
            )}
            {status === 'Issued' && currentRequest.requestType !== 'GMC' && (
              <Button
                className="gap-2 bg-green-600 text-white cursor-default shadow-sm shadow-green-500/20"
                disabled
              >
                <CheckCircle className="size-4" />
                Certificate Issued ✓
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              Delete Service Request
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete service request #{currentRequest.requestNumber}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <LoaderIcon className="size-4 mr-1 animate-spin" /> : <Trash2 className="size-4 mr-1" />}
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
