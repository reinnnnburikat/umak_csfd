'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardCheck, Clock, CheckCircle2, AlertCircle, Paperclip, Trash2, Loader2 } from 'lucide-react';
import { getServeFileUrl, openFileUrl } from '@/lib/file-url';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface PersonInfo {
  givenName: string;
  surname: string;
  middleName?: string;
  extensionName?: string;
  sex: string;
  studentNumber: string;
  collegeInstitute: string;
  email: string;
  yearLevel: string;
}

interface ProgressUpdate {
  id: string;
  subject: string;
  date: string;
  details: string;
  createdAt: string;
  asOf?: string;
  fileUrls?: string[];
}

interface Modification {
  id: string;
  modifiedAt: string;
  modifiedBy: string;
  snapshot: {
    subject: string;
    description: string;
    category: string | null;
    caseStatus: string;
    complainants: string;
    respondents: string;
  };
}

interface FormQuestionMeta {
  id: string;
  label: string;
  phase: string;
  fieldType: string;
}

interface ComplaintRecord {
  id: string;
  complaintNumber: string;
  complainants: string;
  respondents: string;
  category: string | null;
  caseStatus: string;
  subject: string;
  complaintCategory: string | null;
  description: string;
  desiredOutcome: string | null;
  dateOfIncident: string | null;
  location: string | null;
  isOngoing: string | null;
  howOften: string | null;
  witnesses: string | null;
  previousReports: string | null;
  encodedByName: string | null;
  progressUpdates: string | null;
  modifications: string | null;
  fileUrls: string | null;
  filedCase: string | null;
  violationType: string | null;
  dynamicAnswers: string | null;
  formVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

function getCategoryClass(category: string | null): string {
  switch (category) {
    case 'MAJOR': return 'status-major';
    case 'MINOR': return 'status-minor';
    case 'OTHERS': return 'status-others';
    default: return 'status-pending';
  }
}

function getCaseStatusIcon(status: string) {
  switch (status) {
    case 'Pending':
      return <Clock className="size-4 text-status-pending" />;
    case 'Under Review':
      return <AlertCircle className="size-4 text-status-minor" />;
    case 'Resolved':
      return <CheckCircle2 className="size-4 text-status-approved" />;
    case 'Dismissed':
      return <AlertCircle className="size-4 text-status-hold" />;
    case 'Reopened':
      return <AlertCircle className="size-4 text-status-major" />;
    default:
      return <Clock className="size-4 text-muted-foreground" />;
  }
}

function formatPersonName(p: PersonInfo): string {
  return `${p.givenName} ${p.middleName ? p.middleName + ' ' : ''}${p.surname}${p.extensionName ? ' ' + p.extensionName : ''}`;
}

export default function ComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [complaint, setComplaint] = useState<ComplaintRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsedComplainants, setParsedComplainants] = useState<PersonInfo[]>([]);
  const [parsedRespondents, setParsedRespondents] = useState<PersonInfo[]>([]);
  const [parsedProgress, setParsedProgress] = useState<ProgressUpdate[]>([]);
  const [parsedModifications, setParsedModifications] = useState<Modification[]>([]);
  const [parsedFileUrls, setParsedFileUrls] = useState<string[]>([]);
  const [dynamicAnswersMap, setDynamicAnswersMap] = useState<Record<string, string>>({});
  const [formQuestions, setFormQuestions] = useState<FormQuestionMeta[]>([]);

  useEffect(() => {
    async function fetchComplaint() {
      try {
        const res = await fetch(`/api/complaints/${id}`);
        if (res.ok) {
          const data = await res.json();
          setComplaint(data);
          try { setParsedComplainants(JSON.parse(data.complainants)); } catch { /* empty */ }
          try { setParsedRespondents(JSON.parse(data.respondents)); } catch { /* empty */ }
          try { setParsedProgress(JSON.parse(data.progressUpdates || '[]')); } catch { /* empty */ }
          try { setParsedModifications(JSON.parse(data.modifications || '[]')); } catch { /* empty */ }
          try { setParsedFileUrls(data.fileUrls ? JSON.parse(data.fileUrls) : []); } catch { setParsedFileUrls([]); }
          // Parse dynamic answers if present
          if (data.dynamicAnswers) {
            try {
              setDynamicAnswersMap(JSON.parse(data.dynamicAnswers));
            } catch { /* empty */ }
          }
          // Always fetch form questions to resolve dynamic answer IDs to labels
          try {
            const qRes = await fetch('/api/form-questions');
            if (qRes.ok) {
              const qData = await qRes.json();
              setFormQuestions(qData.data || []);
            }
          } catch { /* empty */ }
        } else {
          toast.error('Complaint not found.');
          router.push('/complaints');
        }
      } catch {
        toast.error('Failed to load complaint.');
      } finally {
        setLoading(false);
      }
    }
    fetchComplaint();
  }, [id, router]);

  const canEvaluate = user && (user.role === 'staff' || user.role === 'admin' || user.role === 'superadmin');

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/complaints/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Complaint deleted successfully.');
        router.push('/complaints');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete complaint.');
      }
    } catch {
      toast.error('An error occurred while deleting.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Complaint not found.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/complaints')}>
            <ArrowLeft className="size-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold">{complaint.complaintNumber}</h1>
            <p className="text-sm text-muted-foreground">
              Filed {new Date(complaint.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getCaseStatusIcon(complaint.caseStatus)}
          <span className="font-semibold text-sm">{complaint.caseStatus}</span>
          {complaint.category && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${getCategoryClass(complaint.category)}`}>
              {complaint.category}
            </span>
          )}
          {complaint.filedCase && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-umak-blue/10 text-umak-blue dark:bg-umak-gold/10 dark:text-umak-gold border border-umak-blue/20 dark:border-umak-gold/20">
              Filed: {complaint.filedCase}
            </span>
          )}
          {canEvaluate && (
            <Button
              size="sm"
              className="bg-umak-gold text-umak-navy hover:bg-umak-gold-hover font-semibold ml-2"
              onClick={() => router.push(`/complaints/${id}/evaluate`)}
            >
              <ClipboardCheck className="size-3.5 mr-1" />
              Evaluate
            </Button>
          )}
          {user?.role === 'superadmin' && (
            <Button
              variant="destructive"
              size="sm"
              className="ml-2"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="size-3.5 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              Delete Complaint
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this complaint? This action cannot be undone and will be permanently recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Trash2 className="size-4 mr-1" />}
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unified Complaint Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Complaint Information</CardTitle>
            {complaint.formVersion && (
              <Badge variant="outline" className="text-[10px]">
                Form v{complaint.formVersion}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Always show Subject */}
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Subject</Label>
            <p className="font-semibold mt-1">{complaint.subject}</p>
          </div>

          {/* Always show Description */}
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Description</Label>
            <p className="text-sm mt-1 whitespace-pre-wrap break-words">{complaint.description}</p>
          </div>

          {/* Build dynamic field list */}
          {(() => {
            const dynamicFields: Array<{ label: string; value: string }> = [];
            const alreadyShown = new Set<string>();

            // 1. From dynamicAnswers (resolve question IDs to labels)
            if (Object.keys(dynamicAnswersMap).length > 0) {
              const qMap = new Map(formQuestions.map((q) => [q.id, q]));
              for (const [qId, value] of Object.entries(dynamicAnswersMap)) {
                if (!value) continue;
                const q = qMap.get(qId);
                if (q && !alreadyShown.has(q.label)) {
                  dynamicFields.push({ label: q.label, value });
                  alreadyShown.add(q.label);
                }
              }
            }

            // 2. From remaining fixed fields that have data
            const fixedFieldEntries: Array<{ label: string; value: string | null | undefined }> = [
              { label: 'Desired Outcome', value: complaint.desiredOutcome },
              { label: 'Filed Case', value: complaint.filedCase },
              { label: 'Date of Incident', value: complaint.dateOfIncident },
              { label: 'Location', value: complaint.location },
              { label: 'Ongoing', value: complaint.isOngoing },
              { label: 'How Often', value: complaint.howOften },
              { label: 'Category', value: complaint.complaintCategory },
              { label: 'Witnesses', value: complaint.witnesses },
              { label: 'Violation Type', value: complaint.violationType },
              { label: 'Previous Reports', value: complaint.previousReports },
            ];

            for (const field of fixedFieldEntries) {
              if (field.value && !alreadyShown.has(field.label)) {
                dynamicFields.push({ label: field.label, value: field.value });
                alreadyShown.add(field.label);
              }
            }

            if (dynamicFields.length === 0) return null;

            return (
              <>
                <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {dynamicFields.map((field, idx) => (
                    <div key={idx}>
                      <span className="text-muted-foreground text-xs uppercase">{field.label}</span>
                      <p className="font-medium whitespace-pre-wrap break-words mt-0.5">{field.value}</p>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}

          {complaint.encodedByName && (
            <p className="text-xs text-muted-foreground pt-2">
              Encoded by: <span className="font-medium">{complaint.encodedByName}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Complainants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Complainants</CardTitle>
        </CardHeader>
        <CardContent>
          {parsedComplainants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No complainant data available.</p>
          ) : (
            <div className="space-y-2">
              {parsedComplainants.map((c, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30">
                  <Badge variant="outline" className="mt-0.5 text-[10px] shrink-0">
                    {i === 0 ? 'Main' : `Co-${i}`}
                  </Badge>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{formatPersonName(c)}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.studentNumber} | {c.collegeInstitute} | {c.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Respondents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Respondents</CardTitle>
        </CardHeader>
        <CardContent>
          {parsedRespondents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No respondent data available.</p>
          ) : (
            <div className="space-y-2">
              {parsedRespondents.map((r, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30">
                  <Badge variant="outline" className="mt-0.5 text-[10px] shrink-0">
                    {i === 0 ? 'Main' : `Co-${i}`}
                  </Badge>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{formatPersonName(r)}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.studentNumber} | {r.collegeInstitute} | {r.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence Files */}
      {parsedFileUrls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evidence Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {parsedFileUrls.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => openFileUrl(url)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs hover:bg-muted transition-colors cursor-pointer"
                >
                  <Paperclip className="size-3" />
                  Evidence {idx + 1}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modification History */}
      {parsedModifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modification History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Original */}
              <div className="p-3 rounded-lg bg-muted/30 border">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">Original</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(complaint.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Initial complaint filing</p>
              </div>

              {/* Modifications */}
              {parsedModifications.map((mod, i) => (
                <div key={mod.id} className="p-3 rounded-lg bg-muted/30 border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">
                      {i === 0 ? 'First' : `${ordinal(i + 1)}`} Modification
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(mod.modifiedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Modified by: {mod.modifiedBy}
                  </p>
                  {mod.snapshot.subject && (
                    <p className="text-xs mt-1">
                      <span className="text-muted-foreground">Subject was:</span>{' '}
                      <span className="font-medium">{mod.snapshot.subject}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Updates Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress Updates</CardTitle>
        </CardHeader>
        <CardContent>
          {parsedProgress.length === 0 ? (
            <p className="text-sm text-muted-foreground">No progress updates yet.</p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-umak-gold/30" />

              <div className="space-y-4">
                {parsedProgress.map((p) => (
                  <div key={p.id} className="flex gap-4 relative">
                    {/* Timeline dot */}
                    <div className="w-6 h-6 rounded-full bg-umak-gold flex items-center justify-center shrink-0 z-10 mt-0.5">
                      <CheckCircle2 className="size-3.5 text-umak-navy" />
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-sm">{p.subject}</h4>
                        <span className="text-xs text-muted-foreground">
                          {new Date(p.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{p.details}</p>
                      {p.asOf && (
                        <p className="text-xs text-umak-blue dark:text-umak-gold font-medium mt-1.5 italic">
                          As of {p.asOf}
                        </p>
                      )}
                      {p.fileUrls && p.fileUrls.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {p.fileUrls.map((url, fidx) => (
                            <button
                              key={fidx}
                              type="button"
                              onClick={() => openFileUrl(url)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] hover:bg-muted transition-colors cursor-pointer"
                            >
                              <Paperclip className="size-2.5" />
                              Attachment {fidx + 1}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={className}>{children}</p>;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
