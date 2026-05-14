'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X, Loader2, Eye, AlertTriangle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { ViolationTypeDropdown } from '@/components/shared/violation-type-dropdown';
import { FileUpload, UploadedFile } from '@/components/shared/file-upload';
import { getOffenseColor, getViolationCategories, getCategoryLabel, getColorProgression } from '@/lib/offense-colors';

interface OffenseCountResult {
  currentCount: number;
  nextOffenseCount: number;
  statusLabel: string;
  action: string;
  existingCases: Array<{
    id: string;
    violationType: string;
    violationCategory: string;
    offenseCount: number;
    isCleared: boolean | null;
    status: string;
    createdAt: string;
  }>;
}

const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024; // 4 MB safety limit

export default function NewViolationPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [colleges, setColleges] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const collegeInstituteOtherRef = useRef('');
  const [collegeOtherError, setCollegeOtherError] = useState('');
  const [offenseCountResult, setOffenseCountResult] = useState<OffenseCountResult | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [manualOffenseCount, setManualOffenseCount] = useState<number | null>(null);
  const [actionEdited, setActionEdited] = useState(false);

  const [formData, setFormData] = useState({
    violationType: '',
    violationTypeOther: '',
    violationCategory: '',
    otherCategorySpecified: '',
    studentName: '',
    studentNumber: '',
    collegeInstitute: '',
    umakEmail: '',
    sex: '',
    dateOfInfraction: '',
    description: '',
    actionTaken: '',
    files: [] as UploadedFile[],
  });

  useEffect(() => {
    async function fetchColleges() {
      try {
        const res = await fetch('/api/lists?type=college_institute');
        if (res.ok) {
          const data = await res.json();
          setColleges(data.map((c: { label: string }) => c.label));
        }
      } catch {}
    }
    fetchColleges();
  }, []);

  // Fetch offense count from the dedicated backend endpoint (same logic as POST)
  const fetchOffenseCount = useCallback(async (studentNumber: string, category: string, violationType?: string) => {
    if (!studentNumber || !/^[A-Za-z]\d+$/.test(studentNumber) || !category) {
      setOffenseCountResult(null);
      return;
    }
    setLoadingCounts(true);
    try {
      const effectiveType = violationType === '__other__' ? '' : (violationType || '');
      const params = new URLSearchParams({
        studentNumber,
        category,
      });
      if (effectiveType) params.set('violationType', effectiveType);

      const res = await fetch(`/api/disciplinary/offense-count?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOffenseCountResult(data as OffenseCountResult);
      } else {
        setOffenseCountResult(null);
      }
    } catch {
      setOffenseCountResult(null);
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  // Debounced offense count fetching when student number, category, or violation type changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.studentNumber.trim() && formData.violationCategory) {
        fetchOffenseCount(formData.studentNumber.trim(), formData.violationCategory, formData.violationType);
      } else {
        setOffenseCountResult(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.studentNumber, formData.violationCategory, formData.violationType, fetchOffenseCount]);

  const handleViolationSelect = (value: string, category: string) => {
    setFormData((prev) => ({
      ...prev,
      violationType: value,
      violationCategory: category,
    }));
  };

  const currentCount = offenseCountResult?.currentCount ?? 0;
  const nextOffenseCount = offenseCountResult?.nextOffenseCount ?? 1;
  const effectiveOffenseCount = manualOffenseCount ?? nextOffenseCount;
  const effectiveOffenseColor = formData.violationCategory && effectiveOffenseCount > 0
    ? getOffenseColor(formData.violationCategory, effectiveOffenseCount)
    : null;
  const colorProgression = formData.violationCategory ? getColorProgression(formData.violationCategory) : [];
  const autoCalculatedAction = effectiveOffenseColor?.action || '';

  // Auto-populate action taken when auto-calculated values change and user hasn't manually edited
  useEffect(() => {
    if (autoCalculatedAction && !actionEdited) {
      setFormData(prev => ({ ...prev, actionTaken: autoCalculatedAction }));
    }
  }, [autoCalculatedAction, actionEdited]);

  const handleSubmit = async () => {
    // --- Front-end validation ---
    if (!formData.violationType) {
      toast.error('Please select a violation type.');
      return;
    }
    if (formData.violationType === '__other__' && !formData.violationTypeOther.trim()) {
      toast.error('Please specify the other violation type.');
      return;
    }
    if (!formData.violationCategory) {
      toast.error('Please select a violation category.');
      return;
    }
    if (formData.violationCategory === 'OTHER' && !formData.otherCategorySpecified.trim()) {
      toast.error('Please specify the other violation category.');
      return;
    }
    if (!formData.studentName.trim()) {
      toast.error('Full Name is required.');
      return;
    }
    if (!formData.studentNumber.trim()) {
      toast.error('Student Number is required.');
      return;
    }
    if (!/^[A-Za-z]\d+$/.test(formData.studentNumber.trim())) {
      toast.error('Student Number must be a letter followed by numbers (e.g., K12345678).');
      return;
    }
    if (!formData.collegeInstitute.trim()) {
      toast.error('College/Institute is required.');
      return;
    }
    if (formData.collegeInstitute === 'Other' && !collegeInstituteOtherRef.current.trim()) {
      toast.error('Please specify your college/institute.');
      setCollegeOtherError('Please specify the college/institute');
      return;
    }
    if (!formData.umakEmail.trim()) {
      toast.error('UMak Email Address is required.');
      return;
    }
    if (!formData.sex) {
      toast.error('Sex is required.');
      return;
    }
    if (!formData.dateOfInfraction) {
      toast.error('Date of Infraction is required.');
      return;
    }

    // --- Build payload ---
    setSaving(true);
    try {
      // Only include successfully uploaded file URLs; skip base64 data URLs
      const fileUrls = formData.files
        .filter(f => f.status === 'uploaded' && f.url && !f.url.startsWith('data:'))
        .map(f => f.url as string);

      // Resolve effective violation type (handle "Other" option)
      const effectiveViolationType = formData.violationType === '__other__'
        ? formData.violationTypeOther.trim()
        : formData.violationType;

      // Resolve college/institute — defensively guarantee it's a real name
      const effectiveCollegeInstitute = formData.collegeInstitute === 'Other'
        ? collegeInstituteOtherRef.current.trim() || 'Unspecified'
        : formData.collegeInstitute;

      // Build a clean payload with only the fields the API expects
      // (do NOT spread ...formData to avoid sending the raw files array and stale fields)
      const payload: Record<string, unknown> = {
        studentName: formData.studentName.trim(),
        studentNumber: formData.studentNumber.trim(),
        collegeInstitute: effectiveCollegeInstitute,
        umakEmail: formData.umakEmail.trim(),
        sex: formData.sex,
        violationType: effectiveViolationType,
        violationCategory: formData.violationCategory,
        otherCategorySpecified: formData.otherCategorySpecified.trim() || null,
        description: formData.description.trim() || null,
        actionTaken: formData.actionTaken.trim() || null,
        dateOfInfraction: formData.dateOfInfraction || null,
        fileUrls,
        officerName: user?.fullName || 'System',
      };

      if (manualOffenseCount !== null) {
        payload.offenseCountOverride = manualOffenseCount;
      }

      // --- Payload size guard ---
      const payloadStr = JSON.stringify(payload);
      const payloadBytes = new Blob([payloadStr]).size;

      if (payloadBytes > MAX_PAYLOAD_BYTES) {
        const sizeMB = (payloadBytes / (1024 * 1024)).toFixed(1);
        toast.error(
          `The total data size (${sizeMB} MB) exceeds the 4 MB upload limit. ` +
          'Please reduce file sizes or remove some attachments and try again.',
          { duration: 8000 },
        );
        setSaving(false);
        return;
      }

      // --- Send request ---
      const res = await fetch('/api/disciplinary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadStr,
      });

      if (res.ok) {
        toast.success('Violation citation saved successfully!');
        router.push('/disciplinary');
      } else {
        let errorMsg = 'Failed to save violation citation.';
        let errorDetail = '';
        try {
          const data = await res.json();
          if (data.error) errorMsg = data.error;
          if (data.detail) errorDetail = data.detail;
        } catch {
          // Response body was not JSON — likely a 502 / gateway error
          errorMsg = `Server returned status ${res.status}. Please try again later.`;
        }
        toast.error(errorDetail ? `${errorMsg} (${errorDetail})` : errorMsg, { duration: 8000 });
      }
    } catch (error) {
      console.error('[NewViolation] Submit error:', error);
      const message = error instanceof TypeError && error.message === 'Failed to fetch'
        ? 'Network error — please check your connection and try again.'
        : 'An unexpected error occurred while saving. Please try again.';
      toast.error(message, { duration: 8000 });
    } finally {
      setSaving(false);
    }
  };

  const violationCategories = getViolationCategories();

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Prominent Saving Overlay */}
      {saving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 shadow-2xl dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <span className="relative flex size-4">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-umak-gold opacity-75" />
                <span className="relative inline-flex size-4 rounded-full bg-umak-gold" />
              </span>
              <Loader2 className="size-6 animate-spin text-umak-gold" />
            </div>
            <p className="text-lg font-semibold text-foreground">Saving record...</p>
            <p className="text-sm text-muted-foreground">Please do not close this page.</p>
          </div>
        </div>
      )}
      <Card className={saving ? 'pointer-events-none opacity-80' : ''}>
        <CardHeader>
          <CardTitle className="text-xl font-bold uppercase tracking-tight">
            Encode Violation Citation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Violation Type */}
          <ViolationTypeDropdown
            value={formData.violationType}
            onChange={handleViolationSelect}
            otherValue={formData.violationTypeOther || ''}
            onOtherChange={(v) => setFormData(prev => ({ ...prev, violationTypeOther: v }))}
            id="violationType"
          />

          {/* Violation Category Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="violationCategory">
              Violation Category <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.violationCategory}
              onValueChange={(v) => setFormData(prev => ({ ...prev, violationCategory: v }))}
            >
              <SelectTrigger id="violationCategory">
                <SelectValue placeholder="Select violation category..." />
              </SelectTrigger>
              <SelectContent>
                {violationCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Other Category Specification */}
          {formData.violationCategory === 'OTHER' && (
            <div className="space-y-2">
              <Label htmlFor="otherCategorySpecified">
                Specify Category <span className="text-destructive">*</span>
              </Label>
              <Input
                id="otherCategorySpecified"
                placeholder="Please specify the violation category..."
                value={formData.otherCategorySpecified}
                onChange={(e) => setFormData(prev => ({ ...prev, otherCategorySpecified: e.target.value }))}
              />
            </div>
          )}

          {/* Offense Color Preview */}
          {formData.violationCategory && formData.studentNumber.trim() && (
            <Card className="border-dashed">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Offense Color Preview
                  </h4>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        <Eye className="size-3 mr-1" />
                        View All Levels
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          Color Progression — {getCategoryLabel(formData.violationCategory)}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-2 mt-2">
                        {colorProgression.map((color, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div
                              className="size-8 rounded-md shrink-0"
                              style={{ backgroundColor: color.hex }}
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{color.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {color.isMajor ? 'MAJOR offense' : 'Minor offense'} · {color.action}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {loadingCounts && manualOffenseCount === null ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading offense count...
                  </div>
                ) : effectiveOffenseColor ? (
                  <div className="space-y-2">
                    {/* Offense Color Badge + Info */}
                    <div className="flex items-center gap-3">
                      <div
                        className="size-10 rounded-lg shrink-0 flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: effectiveOffenseColor.hex }}
                      >
                        {effectiveOffenseCount}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">
                          This will be the student&apos;s{' '}
                          <span style={{ color: effectiveOffenseColor.hex }}>{effectiveOffenseColor.label}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Auto-calculated: {nextOffenseCount}
                          {effectiveOffenseColor.isMajor && (
                            <span className="ml-2 font-semibold text-red-600 dark:text-red-400">
                              ⚠ MAJOR OFFENSE
                            </span>
                          )}
                        </p>
                        {effectiveOffenseColor.action && (
                          <p className="text-xs font-medium mt-0.5" style={{ color: effectiveOffenseColor.hex }}>
                            Suggested action: {effectiveOffenseColor.action}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Editable Offense Count Override */}
                    <div className="flex items-center gap-2 flex-wrap p-2 rounded-md bg-muted/30">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">
                        Override offense count:
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={manualOffenseCount ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setManualOffenseCount(null);
                          } else {
                            const num = parseInt(val, 10);
                            if (!isNaN(num) && num >= 1) {
                              setManualOffenseCount(Math.min(num, 10));
                            }
                          }
                        }}
                        className="w-16 h-7 text-sm"
                        placeholder={String(nextOffenseCount)}
                      />
                      {manualOffenseCount !== null && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                          <AlertTriangle className="size-3" />
                          Manual override
                          <button
                            type="button"
                            onClick={() => setManualOffenseCount(null)}
                            className="ml-1 inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
                            title="Reset to auto-calculated"
                          >
                            <RotateCcw className="size-3" />
                          </button>
                        </span>
                      )}
                    </div>

                    {/* Show existing cases being counted (for transparency) */}
                    {offenseCountResult && offenseCountResult.existingCases.length > 0 && (
                      <div className="mt-2 p-2 rounded-md bg-muted/50 text-xs">
                        <p className="font-semibold text-muted-foreground mb-1">
                          Existing offenses counted ({offenseCountResult.existingCases.length}):
                        </p>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {offenseCountResult.existingCases.map((c, i) => (
                            <div key={c.id} className="flex items-center gap-2 text-muted-foreground">
                              <span className="font-medium">{i + 1}.</span>
                              <span>{c.violationType}</span>
                              <span className="text-[10px] bg-muted px-1 rounded">{c.violationCategory}</span>
                              <span className="text-[10px]">({c.status})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Color progression bar */}
                    <div className="flex gap-1">
                      {colorProgression.map((color, idx) => (
                        <div
                          key={idx}
                          className={`h-2 flex-1 rounded-full transition-all ${
                            idx < effectiveOffenseCount ? 'opacity-100' : 'opacity-30'
                          }`}
                          style={{ backgroundColor: color.hex }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Enter student number and select category to see color preview.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Student Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="studentName">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="studentName"
                placeholder="e.g., Juan Dela Cruz"
                value={formData.studentName}
                onChange={(e) => setFormData((prev) => ({ ...prev, studentName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentNumber">
                UMak Student Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="studentNumber"
                placeholder="Input your Student number"
                value={formData.studentNumber}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^[A-Za-z]\d*$/.test(val)) {
                    setFormData((prev) => ({ ...prev, studentNumber: val }));
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="collegeInstitute">
                College/Institute <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.collegeInstitute}
                onValueChange={(v) => { setFormData((prev) => ({ ...prev, collegeInstitute: v })); if (v !== 'Other') { collegeInstituteOtherRef.current = ''; } setCollegeOtherError(''); }}
              >
                <SelectTrigger id="collegeInstitute" className="w-full overflow-hidden">
                  <SelectValue placeholder="Select college/institute..." />
                </SelectTrigger>
                <SelectContent>
                  {colleges.map((college) => (
                    <SelectItem key={college} value={college}>{college}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formData.collegeInstitute === 'Other' && (
              <div className="space-y-2">
                <Label htmlFor="collegeInstituteOther">
                  Please specify your College/Institute <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="collegeInstituteOther"
                  placeholder="Enter the college or institute"
                  defaultValue={collegeInstituteOtherRef.current}
                  onChange={(e) => { collegeInstituteOtherRef.current = e.target.value; setCollegeOtherError(''); }}
                />
                {collegeOtherError && (
                  <p className="text-sm text-destructive">{collegeOtherError}</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="umakEmail">
                UMak Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="umakEmail"
                type="email"
                placeholder="e.g., juan.delacruz@umak.edu.ph"
                value={formData.umakEmail}
                onChange={(e) => setFormData((prev) => ({ ...prev, umakEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sex">
                Sex <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.sex}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, sex: value }))}
              >
                <SelectTrigger id="sex">
                  <SelectValue placeholder="Select sex..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Non-binary">Non-binary</SelectItem>
                  <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfInfraction">
                Date of Infraction <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dateOfInfraction"
                type="date"
                value={formData.dateOfInfraction}
                onChange={(e) => setFormData((prev) => ({ ...prev, dateOfInfraction: e.target.value }))}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Provide details about the violation..."
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* Action Taken */}
          <div className="space-y-2">
            <Label htmlFor="actionTaken">
              Action Taken
              {actionEdited && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-normal">
                  <AlertTriangle className="size-3" />
                  Custom action
                </span>
              )}
            </Label>
            <Textarea
              id="actionTaken"
              placeholder={autoCalculatedAction || 'Describe the action taken...'}
              rows={3}
              value={formData.actionTaken}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, actionTaken: e.target.value }));
                if (!actionEdited) setActionEdited(true);
              }}
            />
            {!actionEdited && autoCalculatedAction && (
              <p className="text-xs text-muted-foreground">
                Auto-filled from offense rules. Edit to override.
              </p>
            )}
          </div>

          {/* File Upload */}
          <FileUpload
            files={formData.files}
            onFilesChange={(files) => setFormData(prev => ({ ...prev, files }))}
            acceptedTypes=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            maxFileSize={5 * 1024 * 1024}
            label="Evidence/Attachment"
            hint="PDF, DOC, DOCX, JPG, PNG (max 5MB each)"
          />

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-umak-gold text-umak-navy hover:bg-umak-gold-hover font-semibold"
            >
              {saving ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Save className="size-4 mr-2" />
              )}
              {saving ? 'Saving...' : 'SAVE'}
            </Button>
            <Button
              variant="outline"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => router.push('/disciplinary')}
              disabled={saving}
            >
              <X className="size-4 mr-2" />
              CANCEL
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
