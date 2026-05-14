'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Edit2, Save, X, Loader2,
  ShieldAlert, CheckCircle2, AlertTriangle,
  History, Calendar, User, Building2, Mail, FileText,
  Info, Gavel, Briefcase, Clock, MapPin, ClipboardCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { getServeFileUrl, openFileUrl } from '@/lib/file-url';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import {
  getOffenseColor,
  getOffenseContrastText,
  getCategoryLabel,
  getColorProgression,
} from '@/lib/offense-colors';

interface OffenseHistoryEntry {
  id: string;
  violationType: string;
  violationCategory: string;
  otherCategorySpecified: string | null;
  offenseCount: number;
  isCleared: boolean;
  clearedByName: string | null;
  clearedAt: string | null;
  clearReason: string | null;
  dateOfInfraction: string | null;
  createdAt: string;
}

interface DisciplinaryCase {
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
  isCleared: boolean;
  clearedByName: string | null;
  clearedAt: string | null;
  clearReason: string | null;
  isEndorsed: boolean;
  endorsedByName: string | null;
  endorsedAt: string | null;
  endorsementNotes: string | null;
  // Community Service Deployment fields
  deploymentStatus: string | null;
  deploymentOffice: string | null;
  deploymentDateFrom: string | null;
  deploymentDateTo: string | null;
  deploymentHoursToRender: string | null;
  deploymentAssessmentHours: string | null;
  deploymentRemarks: string | null;
  aipExpectedOutput: string | null;
  settlementDate: string | null;
  settledByName: string | null;
  createdAt: string;
  updatedAt: string;
  offenseHistory: OffenseHistoryEntry[];
}

export default function DisciplinaryCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [caseRecord, setCaseRecord] = useState<DisciplinaryCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<Partial<DisciplinaryCase>>({});

  // Clear offense dialog
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearReason, setClearReason] = useState('');
  const [clearing, setClearing] = useState(false);

  // Endorse dialog
  const [showEndorseDialog, setShowEndorseDialog] = useState(false);
  const [endorsementNotes, setEndorsementNotes] = useState('');
  const [endorsing, setEndorsing] = useState(false);

  // Color progression dialog
  const [showColorDialog, setShowColorDialog] = useState(false);

  // Deployment inline editing
  const [editingDeployment, setEditingDeployment] = useState(false);
  const [deployEditForm, setDeployEditForm] = useState({
    deploymentStatus: 'Pending' as string,
    deploymentOffice: '',
    deploymentDateFrom: '',
    deploymentDateTo: '',
    deploymentHoursToRender: '',
    deploymentAssessmentHours: '',
    deploymentRemarks: '',
    aipExpectedOutput: '',
  });
  const [savingDeployment, setSavingDeployment] = useState(false);
  const [deploymentSaveSuccess, setDeploymentSaveSuccess] = useState(false);

  // Settle dialog
  const [showSettleDialog, setShowSettleDialog] = useState(false);
  const [settleDate, setSettleDate] = useState('');
  const [settling, setSettling] = useState(false);

  const fetchCase = useCallback(async () => {
    try {
      const res = await fetch(`/api/disciplinary/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCaseRecord(data);
        setEditData(data);
      } else {
        toast.error('Case not found.');
        router.push('/disciplinary');
      }
    } catch {
      toast.error('Failed to load case.');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  const handleSave = async () => {
    if (!caseRecord) return;
    setSaving(true);
    try {
      // Only send basic case fields — deployment fields must go through handleSaveDeployment
      const res = await fetch(`/api/disciplinary/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: editData.studentName,
          studentNumber: editData.studentNumber,
          sex: editData.sex,
          collegeInstitute: editData.collegeInstitute,
          umakEmail: editData.umakEmail,
          violationType: editData.violationType,
          violationCategory: editData.violationCategory,
          otherCategorySpecified: editData.otherCategorySpecified,
          description: editData.description,
          actionTaken: editData.actionTaken,
          status: editData.status,
          dateOfInfraction: editData.dateOfInfraction,
          officerName: user?.fullName || 'System',
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setCaseRecord(updated);
        setEditData(updated);
        setEditing(false);
        toast.success('Case updated successfully!');
      } else {
        toast.error('Failed to update case.');
      }
    } catch {
      toast.error('An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearOffense = async () => {
    if (!caseRecord) return;
    if (!clearReason.trim()) {
      toast.error('Please provide a reason for clearing this offense.');
      return;
    }

    setClearing(true);
    try {
      const res = await fetch(`/api/disciplinary/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clear',
          clearReason: clearReason.trim(),
          clearedByName: user?.fullName || 'System',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCaseRecord(data);
        toast.success(`Offense cleared successfully! ${data._clearedCount || 0} case(s) affected.`);
        setShowClearDialog(false);
        setClearReason('');
        fetchCase();
      } else {
        const data = await res.json();
        // Show both the error message and the detail from the server for debugging
        const errorMsg = data.detail
          ? `${data.error}: ${data.detail}`
          : data.error || 'Failed to clear offense.';
        toast.error(errorMsg);
      }
    } catch {
      toast.error('An error occurred while clearing.');
    } finally {
      setClearing(false);
    }
  };

  const handleEndorse = async () => {
    if (!caseRecord) return;
    if (!endorsementNotes.trim()) {
      toast.error('Please provide endorsement notes.');
      return;
    }

    setEndorsing(true);
    try {
      const res = await fetch(`/api/disciplinary/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'endorse',
          endorsementNotes: endorsementNotes.trim(),
          endorsedByName: user?.fullName || 'System',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCaseRecord(data);
        toast.success('Student endorsed for Administrative/Community Service.');
        setShowEndorseDialog(false);
        setEndorsementNotes('');
        fetchCase();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to endorse student.');
      }
    } catch {
      toast.error('An error occurred while endorsing.');
    } finally {
      setEndorsing(false);
    }
  };

  const handleSaveDeployment = async () => {
    if (!caseRecord) return;

    // Validation: if Under AIP, aipExpectedOutput is required
    if (deployEditForm.deploymentStatus === 'Under AIP' && !deployEditForm.aipExpectedOutput.trim()) {
      toast.error('AIP Expected Output is required when status is "Under AIP".');
      return;
    }

    // Validation: deployment status must be selected
    if (!deployEditForm.deploymentStatus) {
      toast.error('Please select a deployment status.');
      return;
    }

    setSavingDeployment(true);
    try {
      // If changing to Settled, include settlement info
      const payload: Record<string, unknown> = {
        action: 'deploy',
        ...deployEditForm,
        officerName: user?.fullName || 'System',
      };

      if (deployEditForm.deploymentStatus === 'Settled' && caseRecord.deploymentStatus !== 'Settled') {
        payload.settlementDate = new Date().toISOString().split('T')[0];
        payload.settledByName = user?.fullName || 'System';
      }

      // Add abort controller with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`/api/disciplinary/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setCaseRecord(data);
        setEditData(data);
        setEditingDeployment(false);
        toast.success('Deployment info saved successfully!');
        // Show success banner
        setDeploymentSaveSuccess(true);
        setTimeout(() => setDeploymentSaveSuccess(false), 5000);
      } else {
        let errorMsg = 'Failed to save deployment info.';
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch {
          // Could not parse error response
        }
        toast.error(errorMsg);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast.error('Request timed out. Please try again.');
      } else {
        toast.error('An error occurred while saving deployment info. Please try again.');
      }
    } finally {
      setSavingDeployment(false);
    }
  };

  const handleSettle = async () => {
    if (!caseRecord) return;
    setSettling(true);
    try {
      const res = await fetch(`/api/disciplinary/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'settle',
          settlementDate: settleDate || new Date().toISOString().split('T')[0],
          settledByName: user?.fullName || 'System',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCaseRecord(data);
        toast.success('Community service marked as settled.');
        setShowSettleDialog(false);
        fetchCase();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to settle case.');
      }
    } catch {
      toast.error('An error occurred while settling.');
    } finally {
      setSettling(false);
    }
  };

  const startEditingDeployment = () => {
    if (!caseRecord) return;
    setDeployEditForm({
      deploymentStatus: caseRecord.deploymentStatus || 'Pending',
      deploymentOffice: caseRecord.deploymentOffice || '',
      deploymentDateFrom: caseRecord.deploymentDateFrom
        ? new Date(caseRecord.deploymentDateFrom).toISOString().split('T')[0]
        : '',
      deploymentDateTo: caseRecord.deploymentDateTo
        ? new Date(caseRecord.deploymentDateTo).toISOString().split('T')[0]
        : '',
      deploymentHoursToRender: caseRecord.deploymentHoursToRender || '',
      deploymentAssessmentHours: caseRecord.deploymentAssessmentHours || '',
      deploymentRemarks: caseRecord.deploymentRemarks || '',
      aipExpectedOutput: caseRecord.aipExpectedOutput || '',
    });
    setDeploymentSaveSuccess(false);
    setEditingDeployment(true);
  };

  const openSettleDialog = () => {
    setSettleDate(new Date().toISOString().split('T')[0]);
    setShowSettleDialog(true);
  };

  // Helper for deployment status badge
  const getDeploymentStatusBadge = (status: string | null) => {
    switch (status) {
      case 'Pending':
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0 text-xs">Pending</Badge>;
      // 'Deployed' is no longer used — 'Pending' covers the deployed/rendering state
      case 'Under AIP':
        return <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-0 text-xs">Under AIP</Badge>;
      case 'Settled':
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 text-xs">Settled</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Not Set</Badge>;
    }
  };

  // Determine if endorse button should be available
  const canEndorse = (): boolean => {
    if (!caseRecord) return false;
    if (caseRecord.isEndorsed) return false;
    if (caseRecord.isCleared) return false;
    // Check if any offense in history reaches "major" threshold
    const colorInfo = getOffenseColor(caseRecord.violationCategory, caseRecord.offenseCount);
    if (colorInfo.isMajor) return true;
    // Also check all offense history entries
    for (const entry of caseRecord.offenseHistory) {
      const entryColor = getOffenseColor(entry.violationCategory, entry.offenseCount);
      if (entryColor.isMajor && !entry.isCleared) return true;
    }
    return false;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!caseRecord) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Case not found.
      </div>
    );
  }

  const colorInfo = getOffenseColor(caseRecord.violationCategory, caseRecord.offenseCount);
  const contrastText = getOffenseContrastText(colorInfo.hex);
  const colorProgression = getColorProgression(caseRecord.violationCategory);

  // Parse file URLs
  const fileUrls: string[] = caseRecord.fileUrls
    ? (() => { try { return JSON.parse(caseRecord.fileUrls); } catch { return []; } })()
    : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/disciplinary')} className="mt-1">
            <ArrowLeft className="size-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight">Case Details</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Created {new Date(caseRecord.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Clear Offense Button */}
          {!caseRecord.isCleared && (
            <Button
              variant="outline"
              size="sm"
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950"
              onClick={() => setShowClearDialog(true)}
            >
              <CheckCircle2 className="size-4 mr-1.5" />
              Clear Offenses
            </Button>
          )}

          {/* Endorse Button */}
          {canEndorse() && (
            <Button
              variant="outline"
              size="sm"
              className="text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-700 dark:hover:bg-rose-950"
              onClick={() => setShowEndorseDialog(true)}
            >
              <Gavel className="size-4 mr-1.5" />
              Endorse for Service
            </Button>
          )}

          {editing ? (
            <>
              <Button
                onClick={handleSave}
                disabled={saving}
                size="sm"
                className="bg-umak-gold text-umak-navy hover:bg-umak-gold-hover font-semibold"
              >
                {saving ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Save className="size-4 mr-1" />}
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditData(caseRecord);
                  setEditing(false);
                }}
              >
                <X className="size-4 mr-1" />
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Edit2 className="size-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Offense Level Indicator */}
      <Card
        className="overflow-hidden"
        style={{ borderTopWidth: '4px', borderTopColor: colorInfo.hex }}
      >
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div
              className="flex items-center justify-center size-14 rounded-xl shrink-0 text-lg font-bold shadow-sm"
              style={{
                backgroundColor: colorInfo.hex,
                color: contrastText === 'text-white' ? '#fff' : '#0f172a',
              }}
            >
              {caseRecord.offenseCount}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold" style={{ color: colorInfo.hex }}>
                  {colorInfo.label}
                </h2>
                {colorInfo.isMajor && (
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0 text-xs">
                    <ShieldAlert className="size-3 mr-1" />
                    MAJOR OFFENSE
                  </Badge>
                )}
                {caseRecord.isCleared && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 text-xs">
                    <CheckCircle2 className="size-3 mr-1" />
                    CLEARED
                  </Badge>
                )}
                {caseRecord.isEndorsed && (
                  <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-0 text-xs">
                    <Gavel className="size-3 mr-1" />
                    ENDORSED
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {getCategoryLabel(caseRecord.violationCategory)} · {caseRecord.violationType}
              </p>

              {/* Action/Consequence for this offense level */}
              {colorInfo.action && !caseRecord.isCleared && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Gavel className="size-3 text-muted-foreground" />
                  <p className="text-xs font-medium" style={{ color: colorInfo.hex }}>
                    {colorInfo.action}
                  </p>
                </div>
              )}

              {/* Color progression bar */}
              {colorProgression.length > 0 && colorProgression[0].label !== 'No color coding' && (
                <div className="flex gap-1 mt-2">
                  {colorProgression.map((color, idx) => (
                    <div
                      key={idx}
                      className={`h-2 flex-1 rounded-full transition-all ${
                        idx < caseRecord.offenseCount ? 'opacity-100' : 'opacity-25'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={`${color.label}: ${color.action}`}
                    />
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setShowColorDialog(true)}
            >
              <Info className="size-3.5 mr-1" />
              View Levels
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Clearance & Endorsement Info */}
      {(caseRecord.isCleared || caseRecord.isEndorsed) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {caseRecord.isCleared && (
            <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-emerald-800 dark:text-emerald-200 text-sm">Offense Cleared</h3>
                    {caseRecord.clearedByName && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                        Cleared by: {caseRecord.clearedByName}
                      </p>
                    )}
                    {caseRecord.clearedAt && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        Date: {new Date(caseRecord.clearedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {caseRecord.clearReason && (
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-2 bg-emerald-100 dark:bg-emerald-900/30 rounded p-2">
                        &ldquo;{caseRecord.clearReason}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {caseRecord.isEndorsed && (
            <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Gavel className="size-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-rose-800 dark:text-rose-200 text-sm">Endorsed for Admin/Community Service</h3>
                    {caseRecord.endorsedByName && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                        Endorsed by: {caseRecord.endorsedByName}
                      </p>
                    )}
                    {caseRecord.endorsedAt && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        Date: {new Date(caseRecord.endorsedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {caseRecord.endorsementNotes && (
                      <p className="text-sm text-rose-700 dark:text-rose-300 mt-2 bg-rose-100 dark:bg-rose-900/30 rounded p-2">
                        &ldquo;{caseRecord.endorsementNotes}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Community Service Deployment Section */}
      {caseRecord.isEndorsed && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold uppercase tracking-wide flex items-center gap-2">
                <Briefcase className="size-4 text-amber-600 dark:text-amber-400" />
                Community Service Deployment
              </CardTitle>
              <div className="flex items-center gap-2">
                {getDeploymentStatusBadge(caseRecord.deploymentStatus)}
                {!editingDeployment ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={startEditingDeployment}
                    >
                      <Edit2 className="size-3 mr-1" />
                      {caseRecord.deploymentStatus ? 'Edit' : 'Add'} Deployment
                    </Button>
                    {caseRecord.deploymentStatus && (caseRecord.deploymentStatus === 'Pending' || caseRecord.deploymentStatus === 'Under AIP') && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950"
                        onClick={openSettleDialog}
                      >
                        <ClipboardCheck className="size-3 mr-1" />
                        Mark as Settled
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button
                      onClick={handleSaveDeployment}
                      disabled={savingDeployment || (deployEditForm.deploymentStatus === 'Under AIP' && !deployEditForm.aipExpectedOutput.trim())}
                      size="sm"
                      className="bg-amber-600 text-white hover:bg-amber-700 font-semibold"
                    >
                      {savingDeployment ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Save className="size-4 mr-1" />}
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingDeployment(false)}
                      disabled={savingDeployment}
                    >
                      <X className="size-4 mr-1" />
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Success banner */}
            {deploymentSaveSuccess && (
              <div className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Deployment info saved successfully!</p>
              </div>
            )}

            {editingDeployment ? (
              <div className="space-y-4">
                {/* Deployment Status */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase">Deployment Status</Label>
                  <Select
                    value={deployEditForm.deploymentStatus}
                    onValueChange={(value) => setDeployEditForm((prev) => ({ ...prev, deploymentStatus: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending (Deployed for Community Service)</SelectItem>
                      <SelectItem value="Under AIP">Under Alternative Intervention Program (AIP)</SelectItem>
                      <SelectItem value="Settled">Settled (Community Service Completed)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Office */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                    <MapPin className="size-3" /> Office/College/Institute/Center
                  </Label>
                  <Input
                    placeholder="e.g., College of Arts and Sciences"
                    value={deployEditForm.deploymentOffice}
                    onChange={(e) => setDeployEditForm((prev) => ({ ...prev, deploymentOffice: e.target.value }))}
                  />
                </div>

                {/* Date range */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                      <Calendar className="size-3" /> Date From
                    </Label>
                    <Input
                      type="date"
                      value={deployEditForm.deploymentDateFrom}
                      onChange={(e) => setDeployEditForm((prev) => ({ ...prev, deploymentDateFrom: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                      <Calendar className="size-3" /> Date To
                    </Label>
                    <Input
                      type="date"
                      value={deployEditForm.deploymentDateTo}
                      onChange={(e) => setDeployEditForm((prev) => ({ ...prev, deploymentDateTo: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Hours */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                      <Clock className="size-3" /> Hours to Render
                    </Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="e.g., 8"
                      value={deployEditForm.deploymentHoursToRender}
                      onChange={(e) => setDeployEditForm((prev) => ({ ...prev, deploymentHoursToRender: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                      <Clock className="size-3" /> Assessment Hours
                    </Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="e.g., 8"
                      value={deployEditForm.deploymentAssessmentHours}
                      onChange={(e) => setDeployEditForm((prev) => ({ ...prev, deploymentAssessmentHours: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Remarks */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase">Remarks</Label>
                  <Textarea
                    placeholder="Additional remarks about the deployment..."
                    value={deployEditForm.deploymentRemarks}
                    onChange={(e) => setDeployEditForm((prev) => ({ ...prev, deploymentRemarks: e.target.value }))}
                    rows={2}
                  />
                </div>

                {/* AIP Expected Output — conditional */}
                {deployEditForm.deploymentStatus === 'Under AIP' && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5 text-violet-600" />
                      AIP — Expected Output/Deliverables <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      placeholder="Describe the expected output/deliverables from the student under the Alternative Intervention Program..."
                      value={deployEditForm.aipExpectedOutput}
                      onChange={(e) => setDeployEditForm((prev) => ({ ...prev, aipExpectedOutput: e.target.value }))}
                      rows={3}
                    />
                  </div>
                )}
              </div>
            ) : !caseRecord.deploymentStatus ? (
              <div className="text-center py-6">
                <Briefcase className="size-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No deployment information yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click &quot;Add Deployment&quot; to set the community service deployment details.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Deployment details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {caseRecord.deploymentOffice && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                        <MapPin className="size-3" /> Office/College/Institute
                      </Label>
                      <p className="text-sm font-medium">{caseRecord.deploymentOffice}</p>
                    </div>
                  )}
                  {caseRecord.deploymentDateFrom && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                        <Calendar className="size-3" /> Date From
                      </Label>
                      <p className="text-sm font-medium">
                        {new Date(caseRecord.deploymentDateFrom).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  )}
                  {caseRecord.deploymentDateTo && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                        <Calendar className="size-3" /> Date To
                      </Label>
                      <p className="text-sm font-medium">
                        {new Date(caseRecord.deploymentDateTo).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  )}
                  {caseRecord.deploymentHoursToRender && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                        <Clock className="size-3" /> Hours to Render
                      </Label>
                      <p className="text-sm font-medium">{caseRecord.deploymentHoursToRender} hrs</p>
                    </div>
                  )}
                  {caseRecord.deploymentAssessmentHours && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                        <Clock className="size-3" /> Assessment Hours
                      </Label>
                      <p className="text-sm font-medium">{caseRecord.deploymentAssessmentHours} hrs</p>
                    </div>
                  )}
                </div>

                {/* Remarks */}
                {caseRecord.deploymentRemarks && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs uppercase">Remarks</Label>
                    <p className="text-sm bg-muted/50 rounded p-2">{caseRecord.deploymentRemarks}</p>
                  </div>
                )}

                {/* AIP Expected Output */}
                {caseRecord.deploymentStatus === 'Under AIP' && caseRecord.aipExpectedOutput && (
                  <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="size-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">AIP — Expected Output/Deliverables</p>
                        <p className="text-sm text-violet-700 dark:text-violet-300 mt-1">{caseRecord.aipExpectedOutput}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Settlement Info */}
                {caseRecord.deploymentStatus === 'Settled' && (
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Community Service Settled</p>
                        {caseRecord.settlementDate && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                            Settlement Date: {new Date(caseRecord.settlementDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                        )}
                        {caseRecord.settledByName && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">
                            Settled by: {caseRecord.settledByName}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Case Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold uppercase tracking-wide">
                Violation Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                    <FileText className="size-3" /> Violation Type
                  </Label>
                  {editing ? (
                    <Input
                      value={editData.violationType || ''}
                      onChange={(e) => setEditData((prev) => ({ ...prev, violationType: e.target.value }))}
                    />
                  ) : (
                    <p className="font-medium text-sm">{caseRecord.violationType}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                    <ShieldAlert className="size-3" /> Category
                  </Label>
                  {editing ? (
                    <Select
                      value={editData.violationCategory || ''}
                      onValueChange={(value) => setEditData((prev) => ({ ...prev, violationCategory: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MINOR">MINOR</SelectItem>
                        <SelectItem value="MAJOR">MAJOR</SelectItem>
                        <SelectItem value="LATE_FACULTY_EVALUATION">Late Faculty Evaluation</SelectItem>
                        <SelectItem value="LATE_ACCESS_ROG">Late Access of ROG</SelectItem>
                        <SelectItem value="LATE_PAYMENT">Late Payment</SelectItem>
                        <SelectItem value="OTHER">OTHER</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs gap-1"
                      style={{
                        borderColor: colorInfo.hex,
                        color: colorInfo.hex,
                      }}
                    >
                      {getCategoryLabel(caseRecord.violationCategory)}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                    <Calendar className="size-3" /> Date of Infraction
                  </Label>
                  {editing ? (
                    <Input
                      type="date"
                      value={editData.dateOfInfraction?.split('T')[0] || ''}
                      onChange={(e) => setEditData((prev) => ({ ...prev, dateOfInfraction: e.target.value }))}
                    />
                  ) : (
                    <p className="font-medium text-sm">
                      {caseRecord.dateOfInfraction
                        ? new Date(caseRecord.dateOfInfraction).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                        : '—'}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                    <Info className="size-3" /> Status
                  </Label>
                  {editing ? (
                    <Select
                      value={editData.status || ''}
                      onValueChange={(value) => setEditData((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1st Offense">1st Offense</SelectItem>
                        <SelectItem value="2nd Offense">2nd Offense</SelectItem>
                        <SelectItem value="3rd Offense">3rd Offense</SelectItem>
                        <SelectItem value="4th Offense">4th Offense</SelectItem>
                        <SelectItem value="5th Offense">5th Offense</SelectItem>
                        <SelectItem value="Under Review">Under Review</SelectItem>
                        <SelectItem value="Cleared">Cleared</SelectItem>
                        <SelectItem value="Resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: colorInfo.hex }}
                    >
                      {caseRecord.status}
                    </span>
                  )}
                </div>
              </div>

              <Separator />

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs uppercase">Description</Label>
                {editing ? (
                  <Textarea
                    value={editData.description || ''}
                    onChange={(e) => setEditData((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                ) : (
                  <p className="text-sm">{caseRecord.description || 'No description provided.'}</p>
                )}
              </div>

              {/* Action Taken */}
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs uppercase">Action Taken</Label>
                {editing ? (
                  <Textarea
                    value={editData.actionTaken || ''}
                    onChange={(e) => setEditData((prev) => ({ ...prev, actionTaken: e.target.value }))}
                    rows={3}
                  />
                ) : (
                  <p className="text-sm">{caseRecord.actionTaken || 'No action taken recorded.'}</p>
                )}
              </div>

              {/* Files */}
              {fileUrls.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs uppercase">Attached Files</Label>
                  <div className="flex flex-wrap gap-2">
                    {fileUrls.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => openFileUrl(url)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs hover:bg-muted transition-colors cursor-pointer"
                      >
                        <FileText className="size-3" />
                        File {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Officer */}
              {caseRecord.officerName && (
                <p className="text-xs text-muted-foreground">
                  Encoded by: <span className="font-medium text-foreground">{caseRecord.officerName}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column — Student Info & Offense History */}
        <div className="space-y-6">
          {/* Student Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold uppercase tracking-wide">
                Student Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                  <User className="size-3" /> Full Name
                </Label>
                {editing ? (
                  <Input
                    value={editData.studentName || ''}
                    onChange={(e) => setEditData((prev) => ({ ...prev, studentName: e.target.value }))}
                  />
                ) : (
                  <p className="font-medium text-sm">{caseRecord.studentName}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs uppercase">Student Number</Label>
                {editing ? (
                  <Input
                    value={editData.studentNumber || ''}
                    onChange={(e) => setEditData((prev) => ({ ...prev, studentNumber: e.target.value }))}
                  />
                ) : (
                  <p className="font-mono font-medium text-sm">{caseRecord.studentNumber}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs uppercase">Sex</Label>
                {editing ? (
                  <Select
                    value={editData.sex || ''}
                    onValueChange={(value) => setEditData((prev) => ({ ...prev, sex: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Non-binary">Non-binary</SelectItem>
                      <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm">{caseRecord.sex || '—'}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                  <Building2 className="size-3" /> College/Institute
                </Label>
                {editing ? (
                  <Input
                    value={editData.collegeInstitute || ''}
                    onChange={(e) => setEditData((prev) => ({ ...prev, collegeInstitute: e.target.value }))}
                  />
                ) : (
                  <p className="text-sm">{caseRecord.collegeInstitute || '—'}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs uppercase flex items-center gap-1.5">
                  <Mail className="size-3" /> Email
                </Label>
                {editing ? (
                  <Input
                    type="email"
                    value={editData.umakEmail || ''}
                    onChange={(e) => setEditData((prev) => ({ ...prev, umakEmail: e.target.value }))}
                  />
                ) : (
                  <p className="text-sm break-all">{caseRecord.umakEmail || '—'}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Offense History */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold uppercase tracking-wide flex items-center gap-2">
                  <History className="size-4" />
                  Offense History
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {caseRecord.offenseHistory.length} total
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {caseRecord.offenseHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No offense history.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {caseRecord.offenseHistory.map((entry) => {
                    const entryColor = getOffenseColor(entry.violationCategory, entry.offenseCount);
                    const entryContrast = getOffenseContrastText(entryColor.hex);
                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                          entry.isCleared
                            ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
                            : 'bg-card border-border'
                        }`}
                        style={{ borderLeftWidth: '3px', borderLeftColor: entry.isCleared ? '#10b981' : entryColor.hex }}
                      >
                        <div
                          className="flex items-center justify-center size-8 rounded-full shrink-0 text-xs font-bold"
                          style={{
                            backgroundColor: entry.isCleared ? '#10b981' : entryColor.hex,
                            color: entry.isCleared ? '#fff' : (entryContrast === 'text-white' ? '#fff' : '#0f172a'),
                          }}
                        >
                          {entry.isCleared ? (
                            <CheckCircle2 className="size-4" />
                          ) : (
                            entry.offenseCount
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {entry.violationType}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {entryColor.label} · {getCategoryLabel(entry.violationCategory)}
                            {entry.isCleared && ' · Cleared'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {entry.dateOfInfraction
                              ? new Date(entry.dateOfInfraction).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        {entryColor.isMajor && !entry.isCleared && (
                          <AlertTriangle className="size-3.5 text-red-500 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Clear Offense Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              Clear Offenses
            </DialogTitle>
            <DialogDescription>
              This will clear ALL offense history for student{' '}
              <span className="font-semibold">{caseRecord.studentName}</span>{' '}
              (<span className="font-mono">{caseRecord.studentNumber}</span>) in the{' '}
              <span className="font-semibold">{getCategoryLabel(caseRecord.violationCategory)}</span> category
              {caseRecord.violationCategory === 'MINOR' && (
                <> for the violation type <span className="font-semibold">{caseRecord.violationType}</span></>
              )}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  <p className="font-semibold">Important:</p>
                  <p>Clearing offenses resets the visual status, but the offense count continues from history.
                  For example, if cleared after the 1st offense, the next offense will count as the 2nd (orange level).</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clearReason">
                Reason for Clearing <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="clearReason"
                placeholder="e.g., Student completed community service, Case reviewed and dismissed..."
                value={clearReason}
                onChange={(e) => setClearReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setShowClearDialog(false); setClearReason(''); }}
              disabled={clearing}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleClearOffense}
              disabled={clearing || !clearReason.trim()}
            >
              {clearing ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4 mr-1.5" />
              )}
              Clear All Offenses
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Endorse Dialog */}
      <Dialog open={showEndorseDialog} onOpenChange={setShowEndorseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="size-5 text-rose-600" />
              Endorse for Administrative/Community Service
            </DialogTitle>
            <DialogDescription>
              Endorse student{' '}
              <span className="font-semibold">{caseRecord.studentName}</span>{' '}
              (<span className="font-mono">{caseRecord.studentNumber}</span>) for Administrative or Community Service.
              This action indicates the student has reached a major offense threshold.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 p-3">
              <div className="flex items-start gap-2">
                <ShieldAlert className="size-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-700 dark:text-rose-300">
                  <p className="font-semibold">Major Offense Detected</p>
                  <p>This student has reached a major offense level in the {getCategoryLabel(caseRecord.violationCategory)} category. Endorsement is recommended per CSFD policy.</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endorsementNotes">
                Endorsement Notes <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="endorsementNotes"
                placeholder="e.g., Recommended for 8 hours community service due to repeated violations..."
                value={endorsementNotes}
                onChange={(e) => setEndorsementNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setShowEndorseDialog(false); setEndorsementNotes(''); }}
              disabled={endorsing}
            >
              Cancel
            </Button>
            <Button
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={handleEndorse}
              disabled={endorsing || !endorsementNotes.trim()}
            >
              {endorsing ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <Gavel className="size-4 mr-1.5" />
              )}
              Endorse Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle Dialog */}
      <Dialog open={showSettleDialog} onOpenChange={setShowSettleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="size-5 text-emerald-600" />
              Settle Community Service
            </DialogTitle>
            <DialogDescription>
              Mark the community service for student{' '}
              <span className="font-semibold">{caseRecord.studentName}</span> as settled.
              This indicates the student has completed their required service hours/output.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-700 dark:text-emerald-300">
                  <p className="font-semibold">Confirm Settlement</p>
                  <p>Once settled, the community service deployment for this violation will be considered resolved. This action can be reversed by editing the deployment info.</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="settleDate">
                Settlement Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="settleDate"
                type="date"
                value={settleDate}
                onChange={(e) => setSettleDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSettleDialog(false)}
              disabled={settling}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleSettle}
              disabled={settling || !settleDate}
            >
              {settling ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <ClipboardCheck className="size-4 mr-1.5" />
              )}
              Mark as Settled
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Color Progression Dialog */}
      <Dialog open={showColorDialog} onOpenChange={setShowColorDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Offense Color Levels — {getCategoryLabel(caseRecord.violationCategory)}
            </DialogTitle>
            <DialogDescription>
              Color progression for {getCategoryLabel(caseRecord.violationCategory)} violations. Major offenses trigger endorsement eligibility.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {colorProgression.map((color, idx) => {
              const isCurrent = idx === Math.min(caseRecord.offenseCount - 1, colorProgression.length - 1);
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                    isCurrent ? 'bg-muted ring-1 ring-foreground/10' : ''
                  }`}
                >
                  <div
                    className="size-10 rounded-lg shrink-0 flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: color.hex }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{color.label}</p>
                      {isCurrent && (
                        <Badge variant="outline" className="text-[10px] px-1.5">Current</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">{color.action}</p>
                      {color.isMajor && (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0 text-[10px] px-1.5 py-0">
                          MAJOR
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
