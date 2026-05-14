'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import {
  Users,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  ClipboardCheck,
  Upload,
  FileText,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { OfficeHoursBanner } from '@/components/layout/office-hours-banner';
import { FileUpload, UploadedFile } from '@/components/shared/file-upload';
import { TrackableCard } from '@/components/shared/trackable-card';
import { DraftIndicator, LeaveDialog } from '@/components/shared/form-draft-ui';
import { ConditionalOtherField } from '@/components/shared/conditional-other-field';
import { ServiceAvailabilityGuard } from '@/components/shared/service-availability-guard';
import { useFormDraft } from '@/hooks/use-form-draft';

// ─── Types ──────────────────────────────────────
type Step = 'personal' | 'details' | 'upload' | 'review' | 'success';

interface ListOption {
  id?: string;
  label: string;
  value: string | null;
}

// ─── Validation ─────────────────────────────────
const STUDENT_NUMBER_REGEX = /^[A-Za-z]\d+$/;

const personalSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  sex: z.string().min(1, 'Sex is required'),
  yearLevel: z.string().min(1, 'Year/Grade level is required'),
  studentNumber: z
    .string()
    .min(1, 'Student number is required')
    .regex(STUDENT_NUMBER_REGEX, 'Must be a letter followed by numbers (e.g., K12345678)'),
  collegeInstitute: z.string().min(1, 'College/Institute is required'),
  collegeInstituteOther: z.string().optional(),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
});

const detailsSchema = z.object({
  reason: z.string().min(1, 'Reason/Justification is required'),
  dateOfEvent: z.string().min(1, 'Date of event/start date is required'),
  duration: z.string().min(1, 'Duration is required'),
});

const formSchema = personalSchema.merge(detailsSchema);

type FormValues = z.infer<typeof formSchema>;

// ─── Fallback Year Levels ────────────────────────
const FALLBACK_YEAR_LEVELS = [
  'Grade 11',
  'Grade 12',
  'First Year Level',
  'Second Year Level',
  'Third Year Level',
  'Fourth Year Level',
  'Fifth Year Level',
];

// ─── Step Config ─────────────────────────────────
const STEPS: { key: Step; label: string }[] = [
  { key: 'personal', label: 'Personal Info' },
  { key: 'details', label: 'Request Details' },
  { key: 'upload', label: 'File Upload' },
  { key: 'review', label: 'Review' },
  { key: 'success', label: 'Done' },
];

// ─── Progress Bar & Step Indicator ──────────────
function StepIndicator({ currentStep }: { currentStep: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);
  const progressPercent = currentStep === 'success' ? 100 : Math.round((currentIndex / (STEPS.length - 1)) * 100);

  return (
    <div className="mb-8">
      {/* Percentage Progress Bar */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">Step {currentIndex + 1} of {STEPS.length}</span>
        <span className="text-xs font-semibold text-umak-blue dark:text-umak-gold">{progressPercent}%</span>
      </div>
      <Progress value={progressPercent} className="h-2 mb-4" />

      {/* Step Indicators */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`size-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-all duration-300 ${
                  i < currentIndex
                    ? 'bg-emerald-600 text-white'
                    : i === currentIndex
                    ? 'bg-umak-blue dark:bg-umak-gold text-white dark:text-umak-navy ring-2 ring-umak-blue/20 dark:ring-umak-gold/20'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {i < currentIndex ? <CheckCircle2 className="size-4" /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium truncate hidden sm:inline transition-colors ${
                  i <= currentIndex ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 rounded-full transition-colors duration-300 ${
                  i < currentIndex ? 'bg-emerald-600' : 'bg-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Animated Wrapper ────────────────────────────
function StepWrapper({ children, stepKey }: { children: React.ReactNode; stepKey: string }) {
  return (
    <div
      key={stepKey}
      className="animate-in fade-in-0 slide-in-from-right-4 duration-300"
    >
      {children}
    </div>
  );
}

// ─── Main Component ─────────────────────────────
function CrossDressingPageContent() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('personal');
  const [colleges, setColleges] = useState<ListOption[]>([]);
  const [yearLevels, setYearLevels] = useState<ListOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ requestNumber: string; trackingToken: string } | null>(null);
  const [certified, setCertified] = useState(false);

  // ─── Form Draft ───────────────────────────────────────────────
  const draft = useFormDraft({
    storageKey: 'cdc-form-draft',
    currentStep: step,
    initialStep: 'personal' as Step,
    finalStep: 'success' as Step,
    isSubmitted: step === 'success',
    getFormData: () => ({
      ...form.getValues(),
    }),
    setFormData: (data) => {
      const d = data as Record<string, unknown>;
      form.reset(d);
    },
  });

  const handleResumeDraft = () => {
    const loaded = draft.loadDraft();
    if (!loaded) return;
    const d = loaded.formData as Record<string, unknown>;
    form.reset(d);
    setStep(loaded.step as Step);
  };

  // Separate file upload states for each required document
  const [corFiles, setCorFiles] = useState<UploadedFile[]>([]);
  const [schoolIdFiles, setSchoolIdFiles] = useState<UploadedFile[]>([]);
  const [corError, setCorError] = useState('');
  const [schoolIdError, setSchoolIdError] = useState('');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      sex: '',
      yearLevel: '',
      studentNumber: '',
      collegeInstitute: '',
      collegeInstituteOther: '',
      email: '',
      reason: '',
      dateOfEvent: '',
      duration: '',
    },
    mode: 'onBlur',
  });

  // Fetch lists on mount
  useEffect(() => {
    async function fetchLists() {
      try {
        const [colRes, ylRes] = await Promise.all([
          fetch('/api/lists?type=college_institute'),
          fetch('/api/lists?type=year_level'),
        ]);
        if (colRes.ok) {
          const colData = await colRes.json();
          const mapped: ListOption[] = colData.map((item: ListOption) => ({ ...item, value: item.value || item.label }));
          // Client-side defensive dedup, sort, and "Other" at bottom
          const seen = new Set<string>();
          const deduped = mapped.filter((c) => {
            const key = c.label.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          const others = deduped.filter((c) => c.label.toLowerCase() === 'other');
          const rest = deduped.filter((c) => c.label.toLowerCase() !== 'other');
          rest.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
          setColleges([...rest, ...others]);
        }
        if (ylRes.ok) {
          const ylData = await ylRes.json();
          if (ylData.length > 0) {
            setYearLevels(ylData.map((item: ListOption) => ({ ...item, value: item.value || item.label })));
          } else {
            setYearLevels(FALLBACK_YEAR_LEVELS.map((label, i) => ({ id: `fallback-${i}`, label, value: label })));
          }
        } else {
          setYearLevels(FALLBACK_YEAR_LEVELS.map((label, i) => ({ id: `fallback-${i}`, label, value: label })));
        }
      } catch {
        setYearLevels(FALLBACK_YEAR_LEVELS.map((label, i) => ({ id: `fallback-${i}`, label, value: label })));
      }
    }
    fetchLists();
  }, []);

  // ─── Step Navigation ──────────────────────────
  const goBack = useCallback(() => {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx > 0) {
      setStep(STEPS[idx - 1].key);
    }
  }, [step]);

  const goNext = useCallback(() => {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1].key);
    }
  }, [step]);

  // Step 1 -> Step 2 validation
  const handlePersonalNext = async () => {
    const valid = await form.trigger(['fullName', 'sex', 'yearLevel', 'studentNumber', 'collegeInstitute', 'email']);
    if (valid && form.getValues('collegeInstitute') === 'Other' && !form.getValues('collegeInstituteOther')?.trim()) {
      form.setError('collegeInstituteOther', { message: 'Please specify your College/Institute' });
      return;
    }
    if (valid) goNext();
  };

  // Step 2 -> Step 3 validation
  const handleDetailsNext = async () => {
    const valid = await form.trigger(['reason', 'dateOfEvent', 'duration']);
    if (valid) goNext();
  };

  // Step 3 -> Step 4 validation
  const handleUploadNext = () => {
    let hasError = false;

    const corUploaded = corFiles.some(f => f.status === 'uploaded');
    if (!corUploaded) {
      setCorError('Certificate of Registration (COR) upload is required.');
      hasError = true;
    } else {
      setCorError('');
    }

    const schoolIdUploaded = schoolIdFiles.some(f => f.status === 'uploaded');
    if (!schoolIdUploaded) {
      setSchoolIdError('Copy of School ID upload is required.');
      hasError = true;
    } else {
      setSchoolIdError('');
    }

    if (!hasError) goNext();
  };

  // Submit
  const handleSubmit = async () => {
    if (!certified) return;

    const formValues = { ...form.getValues() };
    // Replace "Other" with the custom college/institute value
    if (formValues.collegeInstitute === 'Other' && formValues.collegeInstituteOther?.trim()) {
      formValues.collegeInstitute = formValues.collegeInstituteOther.trim();
    }
    setIsSubmitting(true);

    const fileUrls = [
      ...corFiles.filter(f => f.status === 'uploaded' && f.url).map(f => f.url!),
      ...schoolIdFiles.filter(f => f.status === 'uploaded' && f.url).map(f => f.url!),
    ];

    try {
      const res = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'CDC',
          requestorName: formValues.fullName,
          requestorEmail: formValues.email,
          classification: null,
          formData: formValues,
          fileUrls,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit request');
      }

      const data = await res.json();
      setResult(data);
      goNext();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Shared Back Link ───────────────────────────────────────
  const backLinkElement = draft.isDirty ? (
    <button
      type="button"
      onClick={() => draft.setShowLeaveDialog(true)}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
    >
      <ArrowLeft className="size-4" />
      Back to Services
    </button>
  ) : (
    <Link
      href="/services"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
    >
      <ArrowLeft className="size-4" />
      Back to Services
    </Link>
  );

  // ─── Shared layout wrapper ────────────────────
  const layoutWrapper = (content: React.ReactNode) => (
    <div className="flex flex-col">
      <OfficeHoursBanner />
      <DraftIndicator storageKey="cdc-form-draft" />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        {backLinkElement}

        <StepIndicator currentStep={step} />

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-lg bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center">
              <Users className="size-5 text-violet-600 dark:text-violet-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Cross-Dressing Clearance
            </h1>
          </div>
        </div>

        <StepWrapper stepKey={step}>
          {content}
        </StepWrapper>
      </div>
      <LeaveDialog
        open={draft.showLeaveDialog}
        onOpenChange={draft.setShowLeaveDialog}
        onConfirmLeave={() => { draft.confirmLeave(); window.location.href = '/services'; }}
        onCancel={draft.cancelLeave}
      />
    </div>
  );

  // ─── Step 1: Personal Information ─────────────
  if (step === 'personal') {
    return layoutWrapper(
      <>
        <Card className="glass border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Step 1 — Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Form {...form}>
              <form className="space-y-5">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField
                    control={form.control}
                    name="sex"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sex <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select sex" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="yearLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year/Grade Level <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select year/grade level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {yearLevels.length > 0 ? (
                              yearLevels.map((yl) => (
                                <SelectItem key={yl.value || yl.label} value={yl.value || yl.label}>
                                  {yl.label}
                                </SelectItem>
                              ))
                            ) : (
                              FALLBACK_YEAR_LEVELS.map((yl) => (
                                <SelectItem key={yl} value={yl}>{yl}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField
                    control={form.control}
                    name="studentNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UMak Student Number <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., K12345678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="collegeInstitute"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>College/Institute <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={(v) => { field.onChange(v); if (v !== 'Other') form.setValue('collegeInstituteOther', ''); }} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select college/institute" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {colleges.map((c) => (
                              <SelectItem key={c.value || c.label} value={c.value || c.label}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <ConditionalOtherField
                  control={form.control}
                  watchName="collegeInstitute"
                  triggerValue="Other"
                  inputName="collegeInstituteOther"
                  label="Please specify your College/Institute"
                  placeholder="Enter your college or institute"
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@umak.edu.ph" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-between pt-4">
                  <Button type="button" variant="outline" onClick={() => router.push('/services')}>
                    <ArrowLeft className="size-4 mr-1" /> Cancel
                  </Button>
                  <Button type="button" onClick={handlePersonalNext} className="bg-umak-blue hover:bg-umak-blue-hover text-white">
                    Continue <ArrowRight className="size-4 ml-1" />
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </>
    );
  }

  // ─── Step 2: Request Details ──────────────────
  if (step === 'details') {
    return layoutWrapper(
      <>
        <Card className="glass border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Step 2 — Request Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Form {...form}>
              <form className="space-y-5">
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason/Justification <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="State the reason or justification for your cross-dressing clearance request..."
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField
                    control={form.control}
                    name="dateOfEvent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Event/Start Date <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., One semester, One week" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex items-center justify-between pt-4">
                  <Button type="button" variant="outline" onClick={goBack}>
                    <ArrowLeft className="size-4 mr-1" /> Back
                  </Button>
                  <Button type="button" onClick={handleDetailsNext} className="bg-umak-blue hover:bg-umak-blue-hover text-white">
                    Continue <ArrowRight className="size-4 ml-1" />
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </>
    );
  }

  // ─── Step 3: File Upload ─────────────────────
  if (step === 'upload') {
    return layoutWrapper(
      <>
        <Card className="glass border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Step 3 — File Upload
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-6">
            {/* Requirements Notice */}
            <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardCheck className="size-4 text-amber-600 dark:text-amber-400" />
                  Required Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm">
                    <Upload className="size-4 text-violet-500 mt-0.5 shrink-0" />
                    <span><strong>Certificate of Registration (COR)</strong> — Current semester</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <Upload className="size-4 text-violet-500 mt-0.5 shrink-0" />
                    <span><strong>Copy of School ID</strong> — Front and back</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* COR Upload */}
            <FileUpload
              files={corFiles}
              onFilesChange={(files) => {
                setCorFiles(files);
                if (files.some(f => f.status === 'uploaded')) {
                  setCorError('');
                }
              }}
              maxFileSize={10 * 1024 * 1024}
              required={true}
              multiple={false}
              label="Certificate of Registration (COR)"
              hint="PDF, DOC, DOCX, JPG, PNG (max 10MB)"
              error={corError}
            />

            {/* School ID Upload */}
            <FileUpload
              files={schoolIdFiles}
              onFilesChange={(files) => {
                setSchoolIdFiles(files);
                if (files.some(f => f.status === 'uploaded')) {
                  setSchoolIdError('');
                }
              }}
              maxFileSize={10 * 1024 * 1024}
              required={true}
              multiple={false}
              label="Copy of School ID"
              hint="PDF, DOC, DOCX, JPG, PNG (max 10MB)"
              error={schoolIdError}
            />

            <div className="flex items-center justify-between pt-4">
              <Button type="button" variant="outline" onClick={goBack}>
                <ArrowLeft className="size-4 mr-1" /> Back
              </Button>
              <Button type="button" onClick={handleUploadNext} className="bg-umak-blue hover:bg-umak-blue-hover text-white">
                Continue <ArrowRight className="size-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  // ─── Step 4: Review ──────────────────────────
  if (step === 'review') {
    const formValues = form.getValues();

    const personalFields = [
      { label: 'Full Name', value: formValues.fullName },
      { label: 'Sex', value: formValues.sex },
      { label: 'Year/Grade Level', value: formValues.yearLevel },
      { label: 'UMak Student Number', value: formValues.studentNumber },
      { label: 'College/Institute', value: formValues.collegeInstitute },
      { label: 'Email Address', value: formValues.email },
    ];

    const detailFields = [
      { label: 'Reason/Justification', value: formValues.reason },
      { label: 'Date of Event/Start Date', value: formValues.dateOfEvent },
      { label: 'Duration', value: formValues.duration },
    ];

    const uploadedFiles = [
      ...corFiles.filter(f => f.status === 'uploaded').map(f => ({ label: 'Certificate of Registration (COR)', name: f.name, status: f.status as string })),
      ...schoolIdFiles.filter(f => f.status === 'uploaded').map(f => ({ label: 'Copy of School ID', name: f.name, status: f.status as string })),
    ];

    return layoutWrapper(
      <>
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
            Review Your Request
          </h1>
          <p className="text-muted-foreground text-sm">
            Please verify all information before submitting.
          </p>
        </div>

        {/* Personal Information Summary */}
        <Card className="glass border-border/40 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {personalFields.map((field) => (
                <div key={field.label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <span className="text-sm text-muted-foreground sm:w-48 shrink-0">
                    {field.label}
                  </span>
                  <span className="text-sm font-medium">{field.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Request Details Summary */}
        <Card className="glass border-border/40 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Request Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {detailFields.map((field) => (
                <div key={field.label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <span className="text-sm text-muted-foreground sm:w-48 shrink-0">
                    {field.label}
                  </span>
                  <span className="text-sm font-medium">{field.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Uploaded Files Summary */}
        <Card className="glass border-border/40 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Uploaded Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {uploadedFiles.length > 0 ? (
              <ul className="space-y-3">
                {uploadedFiles.map((file, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-1 min-w-0">
                      <span className="text-muted-foreground shrink-0">{file.label}:</span>
                      <span className="font-medium truncate">{file.name}</span>
                    </div>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 shrink-0">Uploaded</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-destructive">No files uploaded</p>
            )}
          </CardContent>
        </Card>

        {/* Certification */}
        <Card className="mb-6 border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Checkbox
                id="certification"
                checked={certified}
                onCheckedChange={(checked) => setCertified(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor="certification" className="text-sm leading-relaxed cursor-pointer">
                I certify that all information provided is true and correct. Any forgery and falsified document will result in a disciplinary sanction.
              </label>
            </div>
            {!certified && (
              <p className="text-xs text-destructive mt-2 ml-7">
                You must accept the certification to submit.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={goBack}>
            <ArrowLeft className="size-4 mr-1" /> Back
          </Button>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/services')}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              CANCEL
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!certified || isSubmitting}
              className="gradient-gold text-umak-navy border-0 font-semibold disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1" /> Submitting...
                </>
              ) : (
                'SUBMIT REQUEST'
              )}
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ─── Step 5: Success ─────────────────────────
  return (
    <div className="flex flex-col">
      <OfficeHoursBanner />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        <StepIndicator currentStep={step} />

        <Card className="glass border-border/40 text-center">
          <CardContent className="p-8 sm:p-12">
            <div className="mx-auto mb-5">
              <Image
                src="/images/thankyoucheck.png"
                alt="Success"
                width={64}
                height={64}
                className="mx-auto"
              />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
              Request Submitted Successfully!
            </h1>
            <p className="text-muted-foreground mb-6">
              Your Cross-Dressing Clearance request has been received.
            </p>

            {result && (
              <div className="mb-8 max-w-sm mx-auto">
                <TrackableCard
                  requestNumber={result.requestNumber}
                  trackingToken={result.trackingToken}
                  type="service_request"
                  requestType="CDC"
                />
              </div>
            )}

            <p className="text-sm text-muted-foreground mb-6">
              Save your tracking token to check your request status.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild className="bg-umak-blue hover:bg-umak-blue-hover text-white">
                <Link href="/track">Track My Request</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CrossDressingPage() {
  return (
    <ServiceAvailabilityGuard serviceKey="CDC">
      <CrossDressingPageContent />
    </ServiceAvailabilityGuard>
  );
}
