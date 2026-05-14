'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import {
  FileText,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  GraduationCap,
  UserCheck,
  UserX,
  ClipboardCheck,
  Upload,
  Mail,
  Printer,
  ShieldCheck,
  BookOpen,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { OfficeHoursBanner } from '@/components/layout/office-hours-banner';
import { FileUpload, UploadedFile } from '@/components/shared/file-upload';
import { TrackableCard } from '@/components/shared/trackable-card';
import { DraftIndicator, LeaveDialog } from '@/components/shared/form-draft-ui';
import { ConditionalOtherField } from '@/components/shared/conditional-other-field';
import { useFormDraft } from '@/hooks/use-form-draft';
import { toTitleCase, toProperTitle } from '@/lib/text-format';
import { ServiceAvailabilityGuard } from '@/components/shared/service-availability-guard';

// ─── Types ──────────────────────────────────────
type Classification = 'currently_enrolled' | 'graduate' | 'former_student';
type StoredClassification = 'currently_enrolled' | 'graduate_college' | 'graduate_hsu' | 'former_student';
type GraduateSubType = 'college' | 'hsu';
type Step = 'classification' | 'personal_info' | 'file_upload' | 'review' | 'success';

interface ListOption {
  id?: string;
  label: string;
  value: string | null;
}

// ─── Student Number Validation ─────────────────
const STUDENT_NUMBER_REGEX = /^[A-Za-z0-9]+$/;
const studentNumberSchema = z
  .string()
  .min(1, 'Student number is required')
  .regex(STUDENT_NUMBER_REGEX, 'Must be alphanumeric (e.g., K12345678)');

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

// ─── Purpose Options ────────────────────────────
const PURPOSE_OPTIONS = [
  { value: 'LANI Scholarship Program', label: 'LANI Scholarship Program' },
  { value: 'LANI Review Assistance Program', label: 'LANI Review Assistance Program' },
  { value: 'Admission to other school/university', label: 'Admission to other school/university' },
  { value: 'Scholarship', label: 'Scholarship' },
  { value: 'School Requirement', label: 'School Requirement' },
  { value: 'Others', label: 'Others' },
];

// ─── Schemas ────────────────────────────────────
const enrolledSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  sex: z.string().min(1, 'Sex is required'),
  yearLevel: z.string().min(1, 'Year/Grade level is required'),
  studentNumber: studentNumberSchema,
  collegeInstitute: z.string().min(1, 'College/Institute is required'),
  collegeInstituteOther: z.string().optional(),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  purpose: z.string().min(1, 'Purpose is required'),
  purposeOther: z.string().optional(),
  signaturePreference: z.string().min(1, 'Signature preference is required'),
});

const graduateSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  sex: z.string().min(1, 'Sex is required'),
  yearGraduated: z.string().min(1, 'Year graduated is required'),
  studentNumber: studentNumberSchema,
  collegeInstitute: z.string().min(1, 'College/Institute is required'),
  collegeInstituteOther: z.string().optional(),
  degreeTitle: z.string().optional(), // Only required for college graduates, validated conditionally
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  purpose: z.string().min(1, 'Purpose is required'),
  purposeOther: z.string().optional(),
  signaturePreference: z.string().min(1, 'Signature preference is required'),
});

const formerStudentSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  sex: z.string().min(1, 'Sex is required'),
  studentNumber: studentNumberSchema,
  collegeInstitute: z.string().min(1, 'College/Institute is required'),
  collegeInstituteOther: z.string().optional(),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  purpose: z.string().min(1, 'Purpose is required'),
  purposeOther: z.string().optional(),
  lastLevelYear: z.string().min(1, 'Last level/year attended is required'),
  signaturePreference: z.string().min(1, 'Signature preference is required'),
});

// ─── Classification Labels ─────────────────────
const classificationLabels: Record<string, string> = {
  currently_enrolled: 'Currently Enrolled at UMAK',
  graduate: 'Graduate at University of Makati',
  graduate_college: 'Graduate (College)',
  graduate_hsu: 'Graduate (Senior High School)',
  former_student: 'Former/Previous Student of the University of Makati',
};

// ─── File Upload Config per Classification ─────
interface FileUploadConfig {
  key: string;
  label: string;
  hint: string;
}

const fileUploadConfigs: Record<Classification, FileUploadConfig[]> = {
  currently_enrolled: [
    {
      key: 'cor_or_report_card',
      label: 'Certificate of Registration (C.O.R) or Report Card (Form 138)',
      hint: 'Upload your C.O.R or Report Card. PDF, DOC, DOCX, JPG, PNG (max 10MB).',
    },
    {
      key: 'school_id',
      label: 'Copy of School ID',
      hint: 'Upload a clear copy of your School ID. PDF, DOC, DOCX, JPG, PNG (max 10MB).',
    },
  ],
  graduate: [
    {
      key: 'diploma_or_tor',
      label: 'Diploma or Transcript of Records (T.O.R)',
      hint: 'Upload your Diploma or T.O.R. PDF, DOC, DOCX, JPG, PNG (max 10MB).',
    },
    {
      key: 'school_or_gov_id',
      label: 'Copy of School ID (old or government ID)',
      hint: 'Upload your old School ID or government ID. PDF, DOC, DOCX, JPG, PNG (max 10MB).',
    },
  ],
  former_student: [
    {
      key: 'academic_record',
      label: 'C.O.R / Report Card / T.O.R / Honorable Dismissal / Any official academic record',
      hint: 'Upload any proof of previous enrolment at UMak. PDF, DOC, DOCX, JPG, PNG (max 10MB).',
    },
    {
      key: 'school_or_gov_id',
      label: 'Copy of School ID (old or government ID)',
      hint: 'Upload your old School ID or government ID. PDF, DOC, DOCX, JPG, PNG (max 10MB).',
    },
  ],
};

// ─── GMC Process Steps ─────────────────────────
const GMC_PROCESS_STEPS = [
  { icon: Upload, label: 'Request', desc: 'Submit your online request' },
  { icon: ShieldCheck, label: 'Validation', desc: 'Wait for validation' },
  { icon: Mail, label: 'Digital Copy Sent', desc: 'Receive digital copy via email' },
  { icon: Printer, label: 'Print', desc: 'Print desired number of copies' },
  { icon: CheckCircle2, label: 'Visit CSFD', desc: 'Go to CSFD office for authentication (dry seal)' },
];

// ─── Step Config ───────────────────────────────
const STEPS: { key: Step; label: string }[] = [
  { key: 'classification', label: 'Classification' },
  { key: 'personal_info', label: 'Personal Info' },
  { key: 'file_upload', label: 'Documents' },
  { key: 'review', label: 'Review' },
  { key: 'success', label: 'Done' },
];

// ─── Progress Bar ──────────────────────────────
function ProgressBar({ currentStep }: { currentStep: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);
  const percentage = currentStep === 'success' ? 100 : Math.round((currentIndex / (STEPS.length - 1)) * 100);

  return (
    <div className="mb-8">
      {/* Percentage bar */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">Progress</span>
        <span className="text-xs font-bold text-foreground">{percentage}%</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-umak-blue to-umak-gold rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 mt-4">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`size-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                  i < currentIndex
                    ? 'bg-emerald-600 text-white'
                    : i === currentIndex
                    ? 'bg-umak-blue dark:bg-umak-gold text-white dark:text-umak-navy'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {i < currentIndex ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs font-medium truncate hidden sm:inline ${
                  i <= currentIndex
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
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



// ─── Main Component ─────────────────────────────
function GoodMoralPageContent() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('classification');
  const [classification, setClassification] = useState<Classification | null>(null);
  const [graduateSubType, setGraduateSubType] = useState<GraduateSubType | null>(null);
  const [colleges, setColleges] = useState<ListOption[]>([]);
  const [yearLevels, setYearLevels] = useState<ListOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ requestNumber: string; trackingToken: string } | null>(null);
  const [certified, setCertified] = useState(false);
  // File upload state per document slot
  const [fileSlots, setFileSlots] = useState<Record<string, UploadedFile[]>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});

  // Classification switch confirmation
  const [pendingClassification, setPendingClassification] = useState<Classification | null>(null);
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);

  // ─── Form Draft ─────────────────────────────────────────────────
  const draft = useFormDraft({
    storageKey: 'gmc-form-draft',
    currentStep: step,
    initialStep: 'classification' as Step,
    finalStep: 'success' as Step,
    isSubmitted: step === 'success',
    getFormData: () => ({
      classification,
      graduateSubType,
      ...getFormValues(),
    }),
    setFormData: (data) => {
      const d = data as Record<string, any>;
      if (d.classification) setClassification(d.classification as Classification);
      if (d.graduateSubType) setGraduateSubType(d.graduateSubType as GraduateSubType);
      const cls = d.classification as Classification;
      if (cls === 'currently_enrolled') {
        const { classification: _, graduateSubType: __, ...rest } = d;
        enrolledForm.reset(rest);
      } else if (cls === 'graduate') {
        const { classification: _, graduateSubType: __, ...rest } = d;
        graduateForm.reset(rest);
      } else if (cls === 'former_student') {
        const { classification: _, graduateSubType: __, ...rest } = d;
        formerStudentForm.reset(rest);
      }
    },
  });

  const handleResumeDraft = () => {
    const loaded = draft.loadDraft();
    if (!loaded) return;
    const d = loaded.formData as Record<string, any>;
    const savedStep = loaded.step as Step;
    if (d.classification) setClassification(d.classification as Classification);
    if (d.graduateSubType) setGraduateSubType(d.graduateSubType as GraduateSubType);
    // Reset form values
    const cls = d.classification as Classification;
    if (cls === 'currently_enrolled') {
      const { classification: _, graduateSubType: __, ...rest } = d;
      enrolledForm.reset(rest);
    } else if (cls === 'graduate') {
      const { classification: _, graduateSubType: __, ...rest } = d;
      graduateForm.reset(rest);
    } else if (cls === 'former_student') {
      const { classification: _, graduateSubType: __, ...rest } = d;
      formerStudentForm.reset(rest);
    }
    setStep(savedStep);
  };

  const enrolledForm = useForm({
    resolver: zodResolver(enrolledSchema),
    defaultValues: {
      fullName: '',
      sex: '',
      yearLevel: '',
      studentNumber: '',
      collegeInstitute: '',
      collegeInstituteOther: '',
      email: '',
      purpose: '',
      purposeOther: '',
      signaturePreference: '',
    },
  });

  const graduateForm = useForm({
    resolver: zodResolver(graduateSchema),
    defaultValues: {
      fullName: '',
      sex: '',
      yearGraduated: '',
      studentNumber: '',
      collegeInstitute: '',
      collegeInstituteOther: '',
      degreeTitle: '',
      email: '',
      purpose: '',
      purposeOther: '',
      signaturePreference: '',
    },
  });

  const formerStudentForm = useForm({
    resolver: zodResolver(formerStudentSchema),
    defaultValues: {
      fullName: '',
      sex: '',
      studentNumber: '',
      collegeInstitute: '',
      collegeInstituteOther: '',
      email: '',
      purpose: '',
      purposeOther: '',
      lastLevelYear: '',
      signaturePreference: '',
    },
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

  // Check if any files are uploaded
  const hasUploadedFiles = useCallback(() => {
    return Object.values(fileSlots).some(
      (files) => files.some((f) => f.status === 'uploaded')
    );
  }, [fileSlots]);

  // Determine the stored classification value for submission
  const getStoredClassification = (): StoredClassification | null => {
    if (classification === 'currently_enrolled') return 'currently_enrolled';
    if (classification === 'former_student') return 'former_student';
    if (classification === 'graduate') {
      if (graduateSubType === 'college') return 'graduate_college';
      if (graduateSubType === 'hsu') return 'graduate_hsu';
    }
    return null;
  };

  const handleClassificationSelect = (cls: Classification) => {
    if (cls === 'graduate') {
      // Don't move to personal_info yet - wait for sub-type selection
      setClassification(cls);
      setGraduateSubType(null);
      return;
    }

    if (classification && cls !== classification && hasUploadedFiles()) {
      setPendingClassification(cls);
      setShowSwitchDialog(true);
      return;
    }
    setClassification(cls);
    setGraduateSubType(null);
    setFileSlots({});
    setFileErrors({});
    setStep('personal_info');
  };

  const handleGraduateSubTypeSelect = (subType: GraduateSubType) => {
    if (classification && hasUploadedFiles()) {
      setPendingClassification('graduate');
      setShowSwitchDialog(true);
      return;
    }
    setGraduateSubType(subType);
    setFileSlots({});
    setFileErrors({});
    setStep('personal_info');
  };

  const confirmSwitchClassification = () => {
    if (pendingClassification) {
      setClassification(pendingClassification);
      if (pendingClassification === 'graduate') {
        setGraduateSubType(null);
      }
      setFileSlots({});
      setFileErrors({});
      setPendingClassification(null);
    }
    setShowSwitchDialog(false);
    if (pendingClassification !== 'graduate') {
      setStep('personal_info');
    }
  };

  const cancelSwitchClassification = () => {
    setPendingClassification(null);
    setShowSwitchDialog(false);
  };

  const getFormValues = useCallback((): Record<string, string> => {
    if (classification === 'currently_enrolled') return enrolledForm.getValues() as Record<string, string>;
    if (classification === 'graduate') return graduateForm.getValues() as Record<string, string>;
    if (classification === 'former_student') return formerStudentForm.getValues() as Record<string, string>;
    return {};
  }, [classification, enrolledForm, graduateForm, formerStudentForm]);

  const validateForm = async (): Promise<boolean> => {
    if (classification === 'currently_enrolled') return enrolledForm.formState.isValid;
    if (classification === 'graduate') return graduateForm.formState.isValid;
    if (classification === 'former_student') return formerStudentForm.formState.isValid;
    return false;
  };

  const handlePersonalInfoSubmit = async () => {
    let isValid = false;
    if (classification === 'currently_enrolled') {
      isValid = await enrolledForm.trigger();
    } else if (classification === 'graduate') {
      // For college graduates, degreeTitle is required; for HSU it's not needed
      isValid = await graduateForm.trigger();
      // Conditionally require degreeTitle for college graduates only
      if (isValid && graduateSubType === 'college') {
        const degreeTitle = graduateForm.getValues('degreeTitle');
        if (!degreeTitle?.trim()) {
          graduateForm.setError('degreeTitle', { message: 'Degree name/title is required for college graduates' });
          isValid = false;
        }
      }
    } else if (classification === 'former_student') {
      isValid = await formerStudentForm.trigger();
    }
    // Validate "Other" college/institute
    const activeForm = classification === 'currently_enrolled' ? enrolledForm
      : classification === 'graduate' ? graduateForm
      : formerStudentForm;
    const currentCI = activeForm.getValues('collegeInstitute');
    const currentCIO = activeForm.getValues('collegeInstituteOther');
    if (isValid && currentCI === 'Other' && !currentCIO?.trim()) {
      activeForm.setError('collegeInstituteOther', { message: 'Please specify your College/Institute' });
      return;
    }
    if (isValid) {
      setStep('file_upload');
    }
  };

  const validateFileUploads = (): boolean => {
    if (!classification) return false;
    const configs = fileUploadConfigs[classification];
    const newErrors: Record<string, string> = {};
    let valid = true;

    for (const config of configs) {
      const files = fileSlots[config.key] || [];
      const hasUploaded = files.some((f) => f.status === 'uploaded');
      if (!hasUploaded) {
        newErrors[config.key] = 'This document is required. Please upload it.';
        valid = false;
      }
    }

    setFileErrors(newErrors);
    return valid;
  };

  const handleFileUploadSubmit = () => {
    if (validateFileUploads()) {
      setStep('review');
    }
  };

  const handleSubmit = async () => {
    if (!classification || !certified) return;
    setIsSubmitting(true);

    const formValues = { ...getFormValues() };
    // Apply Title Case to full name
    formValues.fullName = toTitleCase(formValues.fullName);
    // Apply Proper Title Case to degree title
    if (formValues.degreeTitle) {
      formValues.degreeTitle = toProperTitle(formValues.degreeTitle);
    }
    // Replace "Other" with the custom college/institute value (apply Proper Title Case)
    if (formValues.collegeInstitute === 'Other' && formValues.collegeInstituteOther?.trim()) {
      formValues.collegeInstitute = toProperTitle(formValues.collegeInstituteOther.trim());
    }
    // If purpose is "Others", use the custom purpose text
    if (formValues.purpose === 'Others' && formValues.purposeOther?.trim()) {
      formValues.purpose = formValues.purposeOther.trim();
    }
    // Add graduate sub-type to form data for reference
    if (classification === 'graduate') {
      formValues.graduateSubType = graduateSubType || '';
    }

    const storedClassification = getStoredClassification();
    if (!storedClassification) {
      setIsSubmitting(false);
      alert('Please select a classification.');
      return;
    }

    const allFileUrls: string[] = [];
    for (const files of Object.values(fileSlots)) {
      for (const f of files) {
        if (f.status === 'uploaded' && f.url) {
          allFileUrls.push(f.url);
        }
      }
    }

    try {
      const res = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'GMC',
          requestorName: formValues.fullName,
          requestorEmail: formValues.email,
          classification: storedClassification,
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
      setStep('success');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Shared Back Link (rendered as elements, not components, to avoid focus loss) ───
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

  // ─── Leave Dialog (shared across steps) ────────────────────────────
  const leaveDialog = (
    <LeaveDialog
      open={draft.showLeaveDialog}
      onOpenChange={draft.setShowLeaveDialog}
      onConfirmLeave={() => { draft.confirmLeave(); window.location.href = '/services'; }}
      onCancel={draft.cancelLeave}
    />
  );

  // ─── Render Classification Step ────────────────
  if (step === 'classification') {
    return (
      <div className="flex flex-col">
        <OfficeHoursBanner />
        <DraftIndicator storageKey="gmc-form-draft" />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        {backLinkElement}
        <ProgressBar currentStep={step} />

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            Good Moral Certificate
          </h1>
          <p className="text-muted-foreground">
            Select your classification to begin your request.
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

        <div className="grid gap-4">
          {(
            [
              {
                value: 'currently_enrolled' as Classification,
                label: 'Currently Enrolled at UMAK',
                desc: 'You are currently enrolled at the University of Makati.',
                icon: <UserCheck className="size-6" />,
                color: 'text-emerald-600 dark:text-emerald-400',
                bg: 'bg-emerald-50 dark:bg-emerald-950/30',
                border: 'border-emerald-200 dark:border-emerald-800/50',
                hoverBorder: 'hover:border-emerald-500 dark:hover:border-emerald-400',
              },
              {
                value: 'graduate' as Classification,
                label: 'Graduate at University of Makati',
                desc: 'You have graduated from the University of Makati.',
                icon: <GraduationCap className="size-6" />,
                color: 'text-amber-600 dark:text-amber-400',
                bg: 'bg-amber-50 dark:bg-amber-950/30',
                border: 'border-amber-200 dark:border-amber-800/50',
                hoverBorder: 'hover:border-amber-500 dark:hover:border-amber-400',
              },
              {
                value: 'former_student' as Classification,
                label: 'Former/Previous Student of the University of Makati',
                desc: 'You previously attended the university but are not currently enrolled.',
                icon: <UserX className="size-6" />,
                color: 'text-rose-600 dark:text-rose-400',
                bg: 'bg-rose-50 dark:bg-rose-950/30',
                border: 'border-rose-200 dark:border-rose-800/50',
                hoverBorder: 'hover:border-rose-500 dark:hover:border-rose-400',
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleClassificationSelect(opt.value)}
              className={`w-full text-left rounded-xl border-2 p-5 transition-all card-hover ${opt.border} ${opt.hoverBorder} hover:shadow-md bg-card`}
            >
              <div className="flex items-start gap-4">
                <div className={`size-12 rounded-xl ${opt.bg} flex items-center justify-center shrink-0 ${opt.color}`}>
                  {opt.icon}
                </div>
                <div>
                  <h3 className="text-base font-semibold mb-1">{opt.label}</h3>
                  <p className="text-sm text-muted-foreground">{opt.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Graduate Sub-Type Selection */}
        {classification === 'graduate' && !graduateSubType && (
          <div className="mt-6 space-y-3 animate-fade-in">
            <Label className="text-sm font-medium">Please specify your graduate classification:</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleGraduateSubTypeSelect('college')}
                className="w-full text-left rounded-xl border-2 border-amber-200 dark:border-amber-800/50 hover:border-amber-500 dark:hover:border-amber-400 p-5 transition-all card-hover hover:shadow-md bg-card"
              >
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                    <GraduationCap className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-0.5">College Graduate</h3>
                    <p className="text-xs text-muted-foreground">Graduated with a college degree</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleGraduateSubTypeSelect('hsu')}
                className="w-full text-left rounded-xl border-2 border-amber-200 dark:border-amber-800/50 hover:border-amber-500 dark:hover:border-amber-400 p-5 transition-all card-hover hover:shadow-md bg-card"
              >
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                    <BookOpen className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-0.5">Senior High School Graduate</h3>
                    <p className="text-xs text-muted-foreground">Graduated from K to 12 program</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Switch Classification Dialog */}
        <AlertDialog open={showSwitchDialog} onOpenChange={setShowSwitchDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Switch Classification?</AlertDialogTitle>
              <AlertDialogDescription>
                You have already uploaded files for your current classification. Switching will remove all uploaded files. Are you sure you want to continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelSwitchClassification}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmSwitchClassification}>Yes, Switch</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
        {leaveDialog}
      </div>
    );
  }

  // ─── Render Personal Info Step ─────────────────
  if (step === 'personal_info') {
    const renderCommonFields = (
      form: typeof enrolledForm | typeof graduateForm | typeof formerStudentForm,
      showYearLevel: boolean,
      showGraduateFields: boolean,
      showFormerFields: boolean,
    ) => (
      <>
        <FormField control={form.control} name="fullName" render={({ field }) => (
          <FormItem>
            <FormLabel>Full Name <span className="text-destructive">*</span></FormLabel>
            <FormControl><Input placeholder="Enter your full name" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField control={form.control} name="sex" render={({ field }) => (
            <FormItem>
              <FormLabel>Sex <span className="text-destructive">*</span></FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Select sex" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          {showYearLevel && (
            <FormField control={enrolledForm.control} name="yearLevel" render={({ field }) => (
              <FormItem>
                <FormLabel>Year/Grade Level <span className="text-destructive">*</span></FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Select year/grade level" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {yearLevels.length > 0 ? (
                      yearLevels.map((yl) => (
                        <SelectItem key={yl.value || yl.label} value={yl.value || yl.label}>{yl.label}</SelectItem>
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
            )} />
          )}

          {!showYearLevel && showGraduateFields && (
            <FormField control={graduateForm.control} name="yearGraduated" render={({ field }) => (
              <FormItem>
                <FormLabel>Year Graduated <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="e.g., 2023" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          )}

          {!showYearLevel && !showGraduateFields && showFormerFields && (
            <FormField control={formerStudentForm.control} name="lastLevelYear" render={({ field }) => (
              <FormItem>
                <FormLabel>Last Level/Year Attended <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="e.g., 3rd year or 2023" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField control={form.control} name="studentNumber" render={({ field }) => (
            <FormItem>
              <FormLabel>UMak Student Number <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input placeholder="e.g., K12345678" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="collegeInstitute" render={({ field }) => (
            <FormItem>
              <FormLabel>College/Institute <span className="text-destructive">*</span></FormLabel>
              <Select onValueChange={(v) => { field.onChange(v); if (v !== 'Other') form.setValue('collegeInstituteOther', ''); }} value={field.value}>
                <FormControl><SelectTrigger className="w-full overflow-hidden"><SelectValue placeholder="Select college/institute" /></SelectTrigger></FormControl>
                <SelectContent>
                  {colleges.map((c) => (
                    <SelectItem key={c.value || c.label} value={c.value || c.label}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <ConditionalOtherField
          control={form.control}
          watchName="collegeInstitute"
          triggerValue="Other"
          inputName="collegeInstituteOther"
          label="Please specify your College/Institute"
          placeholder="Enter your college or institute"
        />

        {showGraduateFields && graduateSubType === 'college' && (
          <FormField control={graduateForm.control} name="degreeTitle" render={({ field }) => (
            <FormItem>
              <FormLabel>Degree Name/Title <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input placeholder="e.g., Bachelor of Science in Information Technology" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}

        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email Address <span className="text-destructive">*</span></FormLabel>
            <FormControl><Input type="email" placeholder="you@umak.edu.ph" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="purpose" render={({ field }) => (
          <FormItem>
            <FormLabel>Purpose <span className="text-destructive">*</span></FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Select purpose" /></SelectTrigger></FormControl>
              <SelectContent>
                {PURPOSE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <ConditionalOtherField
          control={form.control}
          watchName="purpose"
          triggerValue="Others"
          inputName="purposeOther"
          label="Please specify your purpose"
          placeholder="Enter the specific purpose"
        />

        <div className="pt-2">
          <FormField control={form.control} name="signaturePreference" render={({ field }) => (
            <FormItem>
              <FormLabel>
                Does this document require an electronic signature (e-sign) or a wet signature?
                <span className="text-destructive"> *</span>
              </FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2"
                >
                  <label
                    className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                      field.value === 'esign'
                        ? 'border-umak-blue bg-umak-blue/5 dark:bg-umak-blue/10'
                        : 'border-border hover:border-umak-blue/50'
                    }`}
                  >
                    <RadioGroupItem value="esign" />
                    <div>
                      <span className="text-sm font-medium">Electronic Signature (e-sign)</span>
                      <p className="text-xs text-muted-foreground">Signed digitally and sent via email</p>
                    </div>
                  </label>
                  <label
                    className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                      field.value === 'wet_sign'
                        ? 'border-umak-blue bg-umak-blue/5 dark:bg-umak-blue/10'
                        : 'border-border hover:border-umak-blue/50'
                    }`}
                  >
                    <RadioGroupItem value="wet_sign" />
                    <div>
                      <span className="text-sm font-medium">Wet Signature</span>
                      <p className="text-xs text-muted-foreground">Signed manually at the CSFD office</p>
                    </div>
                  </label>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      </>
    );

    const getForm = () => {
      if (classification === 'currently_enrolled') {
        return (
          <Form {...enrolledForm}>
            <form onSubmit={enrolledForm.handleSubmit(handlePersonalInfoSubmit)} className="space-y-5">
              {renderCommonFields(enrolledForm, true, false, false)}
              <div className="flex items-center justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => { setStep('classification'); setGraduateSubType(null); }}>
                  <ArrowLeft className="size-4 mr-1" /> Back
                </Button>
                <Button type="submit" className="bg-umak-blue hover:bg-umak-blue-hover text-white">
                  Continue <ArrowRight className="size-4 ml-1" />
                </Button>
              </div>
            </form>
          </Form>
        );
      }
      if (classification === 'graduate') {
        return (
          <Form {...graduateForm}>
            <form onSubmit={graduateForm.handleSubmit(handlePersonalInfoSubmit)} className="space-y-5">
              {renderCommonFields(graduateForm, false, true, false)}
              <div className="flex items-center justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => { setStep('classification'); }}>
                  <ArrowLeft className="size-4 mr-1" /> Back
                </Button>
                <Button type="submit" className="bg-umak-blue hover:bg-umak-blue-hover text-white">
                  Continue <ArrowRight className="size-4 ml-1" />
                </Button>
              </div>
            </form>
          </Form>
        );
      }
      if (classification === 'former_student') {
        return (
          <Form {...formerStudentForm}>
            <form onSubmit={formerStudentForm.handleSubmit(handlePersonalInfoSubmit)} className="space-y-5">
              {renderCommonFields(formerStudentForm, false, false, true)}
              <div className="flex items-center justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => { setStep('classification'); setGraduateSubType(null); }}>
                  <ArrowLeft className="size-4 mr-1" /> Back
                </Button>
                <Button type="submit" className="bg-umak-blue hover:bg-umak-blue-hover text-white">
                  Continue <ArrowRight className="size-4 ml-1" />
                </Button>
              </div>
            </form>
          </Form>
        );
      }
      return null;
    };

    const displayClassificationLabel = getStoredClassification()
      ? classificationLabels[getStoredClassification()!]
      : classificationLabels[classification || ''];

    return (
      <div className="flex flex-col">
        <OfficeHoursBanner />
        <DraftIndicator storageKey="gmc-form-draft" />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        {backLinkElement}
        <ProgressBar currentStep={step} />

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
              <FileText className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Good Moral Certificate
              </h1>
              <Badge variant="secondary" className="text-xs mt-0.5">
                {displayClassificationLabel}
              </Badge>
            </div>
          </div>
          <p className="text-muted-foreground text-sm mt-2">
            Fill in your personal information below.
          </p>
        </div>

        <Card className="glass border-border/40">
          <CardContent className="p-6">
            {getForm()}
          </CardContent>
        </Card>
        </div>
        {leaveDialog}
      </div>
    );
  }

  // ─── Render File Upload Step ───────────────────
  if (step === 'file_upload') {
    const configs = classification ? fileUploadConfigs[classification] : [];

    return (
      <div className="flex flex-col">
        <OfficeHoursBanner />
        <DraftIndicator storageKey="gmc-form-draft" />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        {backLinkElement}
        <ProgressBar currentStep={step} />

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
              <ClipboardCheck className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Upload Required Documents
              </h1>
              <Badge variant="secondary" className="text-xs mt-0.5">
                {getStoredClassification() ? classificationLabels[getStoredClassification()!] : classificationLabels[classification || '']}
              </Badge>
            </div>
          </div>
          <p className="text-muted-foreground text-sm mt-2">
            Please upload the required documents. Each document is mandatory.
          </p>
        </div>

        <div className="space-y-6">
          {configs.map((config) => (
            <Card key={config.key} className="glass border-border/40">
              <CardContent className="p-6">
                <FileUpload
                  files={fileSlots[config.key] || []}
                  onFilesChange={(files) => {
                    setFileSlots((prev) => ({ ...prev, [config.key]: files }));
                    if (files.some((f) => f.status === 'uploaded')) {
                      setFileErrors((prev) => {
                        const next = { ...prev };
                        delete next[config.key];
                        return next;
                      });
                    }
                  }}
                  maxFileSize={10 * 1024 * 1024}
                  required={true}
                  multiple={false}
                  label={config.label}
                  hint={config.hint.replace(/max \d+MB/g, 'max 10MB')}
                  error={fileErrors[config.key] || ''}
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-between pt-6">
          <Button type="button" variant="outline" onClick={() => setStep('personal_info')}>
            <ArrowLeft className="size-4 mr-1" /> Back
          </Button>
          <Button
            type="button"
            onClick={handleFileUploadSubmit}
            className="bg-umak-blue hover:bg-umak-blue-hover text-white"
          >
            Continue <ArrowRight className="size-4 ml-1" />
          </Button>
        </div>
        </div>
        {leaveDialog}
      </div>
    );
  }

  // ─── Render Review Step ────────────────────────
  if (step === 'review') {
    const formValues = getFormValues();

    const reviewFields = Object.entries(formValues)
      .filter(([k, v]) => v !== undefined && v !== '' && !['purposeOther', 'graduateSubType', 'collegeInstituteOther'].includes(k))
      .map(([key, value]) => {
        const labels: Record<string, string> = {
          fullName: 'Full Name',
          sex: 'Sex',
          yearLevel: 'Year/Grade Level',
          studentNumber: 'UMak Student Number',
          collegeInstitute: 'College/Institute',
          email: 'Email Address',
          purpose: 'Purpose',
          yearGraduated: 'Year Graduated',
          degreeTitle: 'Degree Name/Title',
          lastLevelYear: 'Last Level/Year Attended',
          signaturePreference: 'Signature Preference',
        };
        // Map signature preference value to display label
        let displayValue = String(value);
        if (key === 'signaturePreference') {
          displayValue = value === 'esign' ? 'Electronic Signature (e-sign)' : 'Wet Signature';
        }
        return { key, label: labels[key] || key, value: displayValue };
      });

    const configs = classification ? fileUploadConfigs[classification] : [];
    const displayClassificationLabel = getStoredClassification()
      ? classificationLabels[getStoredClassification()!]
      : classificationLabels[classification || ''];

    return (
      <div className="flex flex-col">
        <OfficeHoursBanner />
        <DraftIndicator storageKey="gmc-form-draft" />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        {backLinkElement}
        <ProgressBar currentStep={step} />

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
            Review Your Request
          </h1>
          <p className="text-muted-foreground text-sm">
            Please verify all information before submitting.
          </p>
        </div>

        {/* Classification */}
        <Card className="glass border-border/40 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Classification
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Badge variant="secondary" className="text-sm">
              {displayClassificationLabel}
            </Badge>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card className="glass border-border/40 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {reviewFields.map((field) => (
                <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <span className="text-sm text-muted-foreground sm:w-48 shrink-0">
                    {field.label}
                  </span>
                  <span className="text-sm font-medium">{field.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Uploaded Documents */}
        <Card className="mb-6 glass border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Uploaded Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {configs.map((config) => {
                const files = fileSlots[config.key] || [];
                const uploaded = files.filter((f) => f.status === 'uploaded');
                return (
                  <div key={config.key}>
                    <p className="text-sm text-muted-foreground mb-1">{config.label}</p>
                    {uploaded.length > 0 ? (
                      <ul className="space-y-1">
                        {uploaded.map((file, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                            <span className="font-medium">{file.name}</span>
                            <span className="text-xs text-muted-foreground">Uploaded</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-destructive">No file uploaded</p>
                    )}
                  </div>
                );
              })}
            </div>
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
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep('file_upload')}
            className="order-2 sm:order-1"
          >
            <ArrowLeft className="size-4 mr-1" /> Back to Documents
          </Button>
          <div className="flex gap-3 order-1 sm:order-2">
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
              disabled={isSubmitting || !certified}
              className="gradient-gold text-umak-navy border-0 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
        {leaveDialog}
      </div>
    );
  }

  // ─── Render Success Step ───────────────────────
  return (
    <div className="flex flex-col">
      <OfficeHoursBanner />
      <DraftIndicator storageKey="gmc-form-draft" />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
      <ProgressBar currentStep={step} />

      <Card className="glass border-border/40 text-center mb-6">
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
          <h2 className="text-2xl font-bold mb-2">Request Submitted!</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            Your Good Moral Certificate request has been submitted successfully. Please save your tracking information below.
          </p>

          {result && (
            <div className="max-w-sm mx-auto">
              <TrackableCard
                requestNumber={result.requestNumber}
                trackingToken={result.trackingToken}
                type="service_request"
                requestType="GMC"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* GMC Process Steps */}
      <Card className="glass border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardCheck className="size-4 text-amber-600 dark:text-amber-400" />
            What Happens Next?
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {GMC_PROCESS_STEPS.map((procStep, i) => {
              const Icon = procStep.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
                    i === 0
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{procStep.label}</p>
                    <p className="text-xs text-muted-foreground">{procStep.desc}</p>
                  </div>
                  {i < GMC_PROCESS_STEPS.length - 1 && (
                    <div className="hidden sm:block absolute-0" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Back to services */}
      <div className="mt-6 text-center">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/services')}
        >
          <ArrowLeft className="size-4 mr-1" /> Back to Services
        </Button>
      </div>
    </div>
    {leaveDialog}
  </div>
  );
}

// ─── Exported Page with Service Availability Guard ──
export default function GoodMoralPage() {
  return (
    <ServiceAvailabilityGuard serviceKey="GMC">
      <GoodMoralPageContent />
    </ServiceAvailabilityGuard>
  );
}
