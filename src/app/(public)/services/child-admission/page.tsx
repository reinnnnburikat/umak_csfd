'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import {
  Baby,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Plus,
  Trash2,
  ClipboardCheck,
  Upload,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useFormDraft } from '@/hooks/use-form-draft';
import { ServiceAvailabilityGuard } from '@/components/shared/service-availability-guard';

// ─── Types ──────────────────────────────────────
type Step = 1 | 2 | 3 | 4 | 5;

interface ListOption {
  id?: string;
  label: string;
  value: string | null;
}

// ─── Constants ──────────────────────────────────
const MAX_CHILDREN = 5;

const FALLBACK_YEAR_LEVELS = [
  'Grade 11',
  'Grade 12',
  'First Year Level',
  'Second Year Level',
  'Third Year Level',
  'Fourth Year Level',
  'Fifth Year Level',
];

// ─── Schemas ────────────────────────────────────
const childSchema = z.object({
  surname: z.string().min(1, 'Surname is required'),
  givenName: z.string().min(1, 'Given name is required'),
  middleName: z.string().optional(),
  extensionName: z.string().optional(),
  sex: z.string().min(1, 'Sex is required'),
  age: z.string().min(1, 'Age is required'),
});

const formSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  sex: z.string().min(1, 'Sex is required'),
  yearLevel: z.string().min(1, 'Year/Grade level is required'),
  studentNumber: z
    .string()
    .min(1, 'Student number is required')
    .regex(/^[A-Za-z]\d+$/, 'Must be a letter followed by numbers (e.g., K12345678)'),
  collegeInstitute: z.string().min(1, 'College/Institute is required'),
  collegeInstituteOther: z.string().optional(),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  relationship: z.string().min(1, 'Relationship to child is required'),
  children: z.array(childSchema).min(1, 'At least one child is required'),
});

type FormValues = z.infer<typeof formSchema>;

// ─── Step Definitions ───────────────────────────
const STEPS = [
  { step: 1 as Step, label: 'Student Info' },
  { step: 2 as Step, label: 'Child Info' },
  { step: 3 as Step, label: 'Documents' },
  { step: 4 as Step, label: 'Review' },
  { step: 5 as Step, label: 'Done' },
];

// ─── Progress Bar & Step Indicator ──────────────
function StepIndicator({ currentStep }: { currentStep: Step }) {
  const progressPercent = ((currentStep - 1) / 4) * 100;

  return (
    <div className="mb-8">
      {/* Percentage-based Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Step {currentStep} of 5
          </span>
          <span className="text-xs font-semibold text-umak-blue dark:text-umak-gold">
            {Math.round(progressPercent)}%
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Step Indicators */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const stepNum = s.step;
          const isCompleted = currentStep > stepNum;
          const isCurrent = currentStep === stepNum;

          return (
            <div key={stepNum} className="flex items-center flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`size-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-umak-blue dark:bg-umak-gold text-white dark:text-umak-navy'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="size-4" /> : stepNum}
                </div>
                <span
                  className={`text-xs font-medium truncate hidden sm:inline ${
                    isCompleted || isCurrent
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
                    currentStep > stepNum ? 'bg-emerald-600' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────
function ChildAdmissionPageContent() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [colleges, setColleges] = useState<ListOption[]>([]);
  const [yearLevels, setYearLevels] = useState<ListOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    requestNumber: string;
    trackingToken: string;
  } | null>(null);
  const [certified, setCertified] = useState(false);

  // ─── Form Draft ───────────────────────────────────────────────
  const draft = useFormDraft({
    storageKey: 'cac-form-draft',
    currentStep: step,
    initialStep: 1 as Step,
    finalStep: 5 as Step,
    isSubmitted: step === 5,
    getFormData: () => form.getValues(),
    setFormData: (data) => {
      const d = data as Record<string, unknown>;
      const { children: __children, ...formValues } = d as Record<string, unknown>;
      form.reset({ ...formValues, children: (__children as unknown[]) || form.getValues().children });
    },
  });

  const handleResumeDraft = () => {
    const loaded = draft.loadDraft();
    if (!loaded) return;
    const d = loaded.formData as Record<string, unknown>;
    const { children: __children, ...formValues } = d as Record<string, unknown>;
    form.reset({ ...formValues, children: (__children as unknown[]) || form.getValues().children });
    setStep(loaded.step as Step);
  };

  // File upload states — each accepts ONE file
  const [corFiles, setCorFiles] = useState<UploadedFile[]>([]);
  const [corError, setCorError] = useState('');
  const [schoolIdFiles, setSchoolIdFiles] = useState<UploadedFile[]>([]);
  const [schoolIdError, setSchoolIdError] = useState('');
  const [childPictureFiles, setChildPictureFiles] = useState<UploadedFile[]>([]);
  const [childPictureError, setChildPictureError] = useState('');

  // ─── Form Setup ─────────────────────────────
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
      relationship: '',
      children: [
        {
          surname: '',
          givenName: '',
          middleName: '',
          extensionName: '',
          sex: '',
          age: '',
        },
      ],
    },
    mode: 'onBlur',
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'children',
  });

  // ─── Fetch Lists ────────────────────────────
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
            setYearLevels(
              ylData.map((item: ListOption) => ({
                ...item,
                value: item.value || item.label,
              }))
            );
          } else {
            setYearLevels(
              FALLBACK_YEAR_LEVELS.map((label, i) => ({
                id: `fallback-${i}`,
                label,
                value: label,
              }))
            );
          }
        } else {
          setYearLevels(
            FALLBACK_YEAR_LEVELS.map((label, i) => ({
              id: `fallback-${i}`,
              label,
              value: label,
            }))
          );
        }
      } catch {
        setYearLevels(
          FALLBACK_YEAR_LEVELS.map((label, i) => ({
            id: `fallback-${i}`,
            label,
            value: label,
          }))
        );
      }
    }
    fetchLists();
  }, []);

  // ─── Step Navigation ────────────────────────
  const goNext = useCallback(() => {
    setStep((prev) => Math.min(prev + 1, 5) as Step);
  }, []);

  const goBack = useCallback(() => {
    setStep((prev) => Math.max(prev - 1, 1) as Step);
  }, []);

  // Validate Step 1 fields
  const validateStep1 = async (): Promise<boolean> => {
    const result = await form.trigger([
      'fullName',
      'sex',
      'yearLevel',
      'studentNumber',
      'collegeInstitute',
      'email',
      'relationship',
    ]);
    return result;
  };

  // Validate Step 2 fields
  const validateStep2 = async (): Promise<boolean> => {
    const result = await form.trigger('children');
    return result;
  };

  // Validate Step 3 uploads
  const validateStep3 = (): boolean => {
    let valid = true;

    if (!corFiles.some((f) => f.status === 'uploaded')) {
      setCorError('Certificate of Registration (COR) is required');
      valid = false;
    } else {
      setCorError('');
    }

    if (!schoolIdFiles.some((f) => f.status === 'uploaded')) {
      setSchoolIdError('Copy of School ID is required');
      valid = false;
    } else {
      setSchoolIdError('');
    }

    if (!childPictureFiles.some((f) => f.status === 'uploaded')) {
      setChildPictureError('Picture/Image of the child is required');
      valid = false;
    } else {
      setChildPictureError('');
    }

    return valid;
  };

  const handleStep1Next = async () => {
    const valid = await validateStep1();
    if (valid) {
      // Validate "Other" college/institute
      if (form.getValues('collegeInstitute') === 'Other' && !form.getValues('collegeInstituteOther')?.trim()) {
        form.setError('collegeInstituteOther', { message: 'Please specify your College/Institute' });
        return;
      }
      goNext();
    }
  };

  const handleStep2Next = async () => {
    const valid = await validateStep2();
    if (valid) goNext();
  };

  const handleStep3Next = () => {
    const valid = validateStep3();
    if (valid) goNext();
  };

  // ─── Submit ─────────────────────────────────
  const handleSubmit = async () => {
    if (!certified) return;

    const formValues = { ...form.getValues() };
    // Replace "Other" with the custom college/institute value
    if (formValues.collegeInstitute === 'Other' && formValues.collegeInstituteOther?.trim()) {
      formValues.collegeInstitute = formValues.collegeInstituteOther.trim();
    }
    setIsSubmitting(true);

    const allFileUrls = [
      ...corFiles.filter((f) => f.status === 'uploaded' && f.url).map((f) => f.url!),
      ...schoolIdFiles.filter((f) => f.status === 'uploaded' && f.url).map((f) => f.url!),
      ...childPictureFiles.filter((f) => f.status === 'uploaded' && f.url).map((f) => f.url!),
    ];

    try {
      const res = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'CAC',
          requestorName: formValues.fullName,
          requestorEmail: formValues.email,
          classification: null,
          formData: formValues,
          fileUrls: allFileUrls,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit request');
      }

      const data = await res.json();
      setResult(data);
      draft.clearDraft();
      goNext();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Add Child ──────────────────────────────
  const addChild = () => {
    if (fields.length >= MAX_CHILDREN) return;
    append({
      surname: '',
      givenName: '',
      middleName: '',
      extensionName: '',
      sex: '',
      age: '',
    });
  };

  // ─── Animation Helper ───────────────────────
  const stepAnimation = 'animate-in fade-in duration-300';

  // ═══════════════════════════════════════════════
  // RENDER: Step 1 — Student/Parent Information
  // ═══════════════════════════════════════════════
  if (step === 1) {
    return (
      <div className="flex flex-col">
        <OfficeHoursBanner />
        <DraftIndicator storageKey="cac-form-draft" />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
          {draft.isDirty ? (
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
          )}

          <StepIndicator currentStep={step} />

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-lg bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
                <Baby className="size-5 text-rose-600 dark:text-rose-400" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Child Admission Clearance
              </h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Provide your student and personal information.
            </p>
          </div>

          {/* Resume Draft Button */}
          {draft.hasDraft && (
            <button
              type="button"
              onClick={handleResumeDraft}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors w-full sm:w-auto mb-2"
            >
              <RotateCcw className="size-4" />
              <span className="text-sm font-medium">Resume Draft</span>
            </button>
          )}

          <Card className="glass border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Student / Parent Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Form {...form}>
                <div className="space-y-5">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Full Name <span className="text-destructive">*</span>
                        </FormLabel>
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
                          <FormLabel>
                            Sex <span className="text-destructive">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
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
                          <FormLabel>
                            Year/Grade Level{' '}
                            <span className="text-destructive">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select year/grade level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {yearLevels.length > 0
                                ? yearLevels.map((yl) => (
                                    <SelectItem
                                      key={yl.value || yl.label}
                                      value={yl.value || yl.label}
                                    >
                                      {yl.label}
                                    </SelectItem>
                                  ))
                                : FALLBACK_YEAR_LEVELS.map((yl) => (
                                    <SelectItem key={yl} value={yl}>
                                      {yl}
                                    </SelectItem>
                                  ))}
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
                          <FormLabel>
                            UMak Student Number{' '}
                            <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., K12345678"
                              {...field}
                            />
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
                          <FormLabel>
                            College/Institute{' '}
                            <span className="text-destructive">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={(v) => { field.onChange(v); if (v !== 'Other') form.setValue('collegeInstituteOther', ''); }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select college/institute" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {colleges.map((c) => (
                                <SelectItem
                                  key={c.value || c.label}
                                  value={c.value || c.label}
                                >
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Email Address{' '}
                            <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="you@umak.edu.ph"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="relationship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Relationship to Child{' '}
                            <span className="text-destructive">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select relationship" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Mother">Mother</SelectItem>
                              <SelectItem value="Father">Father</SelectItem>
                              <SelectItem value="Guardian">Guardian</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </Form>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => draft.setShowLeaveDialog(true)}
            >
              <ArrowLeft className="size-4 mr-1" /> Cancel
            </Button>
            <Button
              type="button"
              onClick={handleStep1Next}
              className="bg-umak-blue hover:bg-umak-blue-hover text-white"
            >
              Continue <ArrowRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
        <LeaveDialog
          open={draft.showLeaveDialog}
          onOpenChange={draft.setShowLeaveDialog}
          onConfirmLeave={() => { draft.confirmLeave(); window.location.href = '/services'; }}
          onCancel={draft.cancelLeave}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // RENDER: Step 2 — Child Information
  // ═══════════════════════════════════════════════
  if (step === 2) {
    return (
      <div className="flex flex-col">
        <OfficeHoursBanner />
        <DraftIndicator storageKey="cac-form-draft" />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Previous Step
          </button>

          <StepIndicator currentStep={step} />

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-lg bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
                <Baby className="size-5 text-rose-600 dark:text-rose-400" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Child Admission Clearance
              </h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Provide the details of the child/children to be admitted.
            </p>
          </div>

          <Form {...form}>
            <div className="space-y-6">
              {fields.map((field, index) => (
                <Card
                  key={field.id}
                  className={`glass border-border/40 ${stepAnimation}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Child {index + 1}
                      </CardTitle>
                      {index > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          className="text-destructive hover:bg-destructive/10 h-8 px-2"
                        >
                          <Trash2 className="size-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <FormField
                          control={form.control}
                          name={`children.${index}.surname`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel>
                                Surname{' '}
                                <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="Surname" {...f} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`children.${index}.givenName`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel>
                                Given Name{' '}
                                <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="Given name" {...f} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <FormField
                          control={form.control}
                          name={`children.${index}.middleName`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel>Middle Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Middle name (optional)" {...f} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`children.${index}.extensionName`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel>Extension Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., Jr., III (optional)"
                                  {...f}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <FormField
                          control={form.control}
                          name={`children.${index}.sex`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel>
                                Sex <span className="text-destructive">*</span>
                              </FormLabel>
                              <Select
                                onValueChange={f.onChange}
                                value={f.value}
                              >
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
                          name={`children.${index}.age`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel>
                                Age <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="e.g., 5"
                                  min="0"
                                  max="30"
                                  {...f}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Add Another Child Button */}
            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={addChild}
                disabled={fields.length >= MAX_CHILDREN}
                className="w-full border-dashed"
              >
                <Plus className="size-4 mr-2" />
                Add Another Child
              </Button>
            </div>
          </Form>

          <div className="flex items-center justify-between pt-6">
            <Button type="button" variant="outline" onClick={goBack}>
              <ArrowLeft className="size-4 mr-1" /> Back
            </Button>
            <Button
              type="button"
              onClick={handleStep2Next}
              className="bg-umak-blue hover:bg-umak-blue-hover text-white"
            >
              Continue <ArrowRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
        <LeaveDialog
          open={draft.showLeaveDialog}
          onOpenChange={draft.setShowLeaveDialog}
          onConfirmLeave={() => { draft.confirmLeave(); window.location.href = '/services'; }}
          onCancel={draft.cancelLeave}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // RENDER: Step 3 — File Upload
  // ═══════════════════════════════════════════════
  if (step === 3) {
    return (
      <div className="flex flex-col">
        <OfficeHoursBanner />
        <DraftIndicator storageKey="cac-form-draft" />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Previous Step
          </button>

          <StepIndicator currentStep={step} />

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-lg bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
                <Upload className="size-5 text-rose-600 dark:text-rose-400" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Upload Documents
              </h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Upload the required documents for your Child Admission Clearance request.
            </p>
          </div>

          <div className="space-y-6">
            {/* Student Information: COR */}
            <Card className="glass border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Student Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-6">
                <FileUpload
                  files={corFiles}
                  onFilesChange={(files) => {
                    setCorFiles(files);
                    if (files.some((f) => f.status === 'uploaded')) {
                      setCorError('');
                    }
                  }}
                  maxFileSize={10 * 1024 * 1024}
                  multiple={false}
                  required={true}
                  label="Certificate of Registration (COR)"
                  hint="PDF, DOC, DOCX, JPG, PNG (max 10MB)"
                  error={corError}
                />
                <FileUpload
                  files={schoolIdFiles}
                  onFilesChange={(files) => {
                    setSchoolIdFiles(files);
                    if (files.some((f) => f.status === 'uploaded')) {
                      setSchoolIdError('');
                    }
                  }}
                  maxFileSize={10 * 1024 * 1024}
                  multiple={false}
                  required={true}
                  label="Copy of School ID"
                  hint="PDF, DOC, DOCX, JPG, PNG (max 10MB)"
                  error={schoolIdError}
                />
              </CardContent>
            </Card>

            {/* Child Information: Picture */}
            <Card className="glass border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Child Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <FileUpload
                  files={childPictureFiles}
                  onFilesChange={(files) => {
                    setChildPictureFiles(files);
                    if (files.some((f) => f.status === 'uploaded')) {
                      setChildPictureError('');
                    }
                  }}
                  maxFileSize={10 * 1024 * 1024}
                  multiple={false}
                  required={true}
                  label="Picture/Image of the Child"
                  hint="JPG, PNG (max 10MB)"
                  error={childPictureError}
                />
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between pt-6">
            <Button type="button" variant="outline" onClick={goBack}>
              <ArrowLeft className="size-4 mr-1" /> Back
            </Button>
            <Button
              type="button"
              onClick={handleStep3Next}
              className="bg-umak-blue hover:bg-umak-blue-hover text-white"
            >
              Continue <ArrowRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
        <LeaveDialog
          open={draft.showLeaveDialog}
          onOpenChange={draft.setShowLeaveDialog}
          onConfirmLeave={() => { draft.confirmLeave(); window.location.href = '/services'; }}
          onCancel={draft.cancelLeave}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // RENDER: Step 4 — Review
  // ═══════════════════════════════════════════════
  if (step === 4) {
    const formValues = form.getValues();

    const studentFields = [
      { label: 'Full Name', value: formValues.fullName },
      { label: 'Sex', value: formValues.sex },
      { label: 'Year/Grade Level', value: formValues.yearLevel },
      { label: 'UMak Student Number', value: formValues.studentNumber },
      { label: 'College/Institute', value: formValues.collegeInstitute },
      { label: 'Email Address', value: formValues.email },
      { label: 'Relationship to Child', value: formValues.relationship },
    ];

    const uploadedFiles = [
      ...corFiles
        .filter((f) => f.status === 'uploaded')
        .map((f) => ({ label: 'Certificate of Registration (COR)', name: f.name })),
      ...schoolIdFiles
        .filter((f) => f.status === 'uploaded')
        .map((f) => ({ label: 'Copy of School ID', name: f.name })),
      ...childPictureFiles
        .filter((f) => f.status === 'uploaded')
        .map((f) => ({ label: 'Picture/Image of the Child', name: f.name })),
    ];

    return (
      <div className="flex flex-col">
        <OfficeHoursBanner />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
          <StepIndicator currentStep={step} />

          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
              Review Your Request
            </h1>
            <p className="text-muted-foreground text-sm">
              Please verify all information before submitting.
            </p>
          </div>

          {/* Student/Parent Info Summary */}
          <Card className="glass border-border/40 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Student / Parent Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {studentFields.map((field) => (
                  <div
                    key={field.label}
                    className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4"
                  >
                    <span className="text-sm text-muted-foreground sm:w-48 shrink-0">
                      {field.label}
                    </span>
                    <span className="text-sm font-medium">{field.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Children Summary */}
          {formValues.children.map((child, index) => (
            <Card key={index} className="glass border-border/40 mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Child {index + 1}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                      <span className="text-sm text-muted-foreground sm:w-32 shrink-0">
                        Surname
                      </span>
                      <span className="text-sm font-medium">{child.surname}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                      <span className="text-sm text-muted-foreground sm:w-32 shrink-0">
                        Given Name
                      </span>
                      <span className="text-sm font-medium">{child.givenName}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                      <span className="text-sm text-muted-foreground sm:w-32 shrink-0">
                        Middle Name
                      </span>
                      <span className="text-sm font-medium">
                        {child.middleName || '—'}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                      <span className="text-sm text-muted-foreground sm:w-32 shrink-0">
                        Extension Name
                      </span>
                      <span className="text-sm font-medium">
                        {child.extensionName || '—'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                      <span className="text-sm text-muted-foreground sm:w-32 shrink-0">
                        Sex
                      </span>
                      <span className="text-sm font-medium">{child.sex}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                      <span className="text-sm text-muted-foreground sm:w-32 shrink-0">
                        Age
                      </span>
                      <span className="text-sm font-medium">{child.age}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Uploaded Documents Summary */}
          <Card className="glass border-border/40 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Uploaded Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {uploadedFiles.length > 0 ? (
                <ul className="space-y-2">
                  {uploadedFiles.map((file, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium">{file.label}</span>
                        <span className="text-muted-foreground"> — {file.name}</span>
                      </div>
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
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="certification"
                  checked={certified}
                  onCheckedChange={(checked) => setCertified(checked === true)}
                  className="mt-0.5"
                />
                <label
                  htmlFor="certification"
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  I certify that all information provided is true and correct. Any
                  forgery and falsified document will result in a disciplinary
                  sanction.
                </label>
              </div>
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
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // RENDER: Step 5 — Success
  // ═══════════════════════════════════════════════
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
              Your Child Admission Clearance request has been received.
            </p>

            {result && (
              <div className="mb-8 max-w-sm mx-auto">
                <TrackableCard
                  requestNumber={result.requestNumber}
                  trackingToken={result.trackingToken}
                  type="service_request"
                  requestType="CAC"
                />
              </div>
            )}

            <p className="text-sm text-muted-foreground mb-6">
              Save your tracking token to check your request status.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                asChild
                className="bg-umak-blue hover:bg-umak-blue-hover text-white"
              >
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

export default function ChildAdmissionPage() {
  return (
    <ServiceAvailabilityGuard serviceKey="CAC">
      <ChildAdmissionPageContent />
    </ServiceAvailabilityGuard>
  );
}
