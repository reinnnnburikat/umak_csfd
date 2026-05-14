'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import {
  Shirt,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  ClipboardCheck,
  Briefcase,
  Building2,
  GraduationCap,
  Users,
  HelpCircle,
  AlertTriangle,
  FileText,
  Upload,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

// ─── Types & Constants ──────────────────────────────────────────────

type Category = 'working_student' | 'office_org_event' | 'ojt' | 'college_org_shirt' | 'other';

interface CategoryInfo {
  key: Category;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const CATEGORIES: CategoryInfo[] = [
  {
    key: 'working_student',
    label: 'Working Student',
    icon: <Briefcase className="size-5" />,
    description: 'Employed students requesting uniform exemption due to work commitments',
  },
  {
    key: 'office_org_event',
    label: 'Office/Org Event',
    icon: <Building2 className="size-5" />,
    description: 'Students involved in official office or organization events',
  },
  {
    key: 'ojt',
    label: 'OJT (On-the-Job Training)',
    icon: <GraduationCap className="size-5" />,
    description: 'Students currently completing on-the-job training requirements',
  },
  {
    key: 'college_org_shirt',
    label: 'College/Org Shirt',
    icon: <Users className="size-5" />,
    description: 'Students wearing official college or organization shirts',
  },
  {
    key: 'other',
    label: 'Other',
    icon: <HelpCircle className="size-5" />,
    description: 'Any other reason for uniform exemption not listed above',
  },
];

const STUDENT_NUMBER_REGEX = /^[A-Za-z]\d+$/;

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS = ['Category', 'Information', 'Documents', 'Review', 'Done'];

// ─── File Upload Field Definitions ──────────────────────────────────

interface FileFieldDef {
  key: string;
  label: string;
  acceptedTypes?: string;
  required: boolean;
}

const FILE_FIELDS: Record<Category, FileFieldDef[]> = {
  working_student: [
    { key: 'cor', label: 'Certificate of Registration (COR)', required: true },
    { key: 'schoolId', label: 'School ID', required: true },
    { key: 'certOfEmploymentAndId', label: 'Certificate of Employment and ID', required: true },
  ],
  office_org_event: [
    { key: 'facultyAdminId', label: 'Faculty/Administrative ID', required: true },
    { key: 'projectProfile', label: 'Project Profile', required: true },
  ],
  ojt: [
    { key: 'cor', label: 'Certificate of Registration (COR)', required: true },
    { key: 'schoolId', label: 'School ID', required: true },
    { key: 'moaDeploymentLetter', label: 'Copy of approved Memorandum of Agreement and Deployment Letter (PDF only)', acceptedTypes: '.pdf', required: true },
  ],
  college_org_shirt: [
    { key: 'adviserId', label: 'Organization/Council Adviser Administrative/Faculty ID', required: true },
    { key: 'intentLetter', label: 'Approved copy of Intent Letter addressed to Center for Integrated Communications for Design/Layout approval', required: true },
  ],
  other: [
    { key: 'cor', label: 'Certificate of Registration (COR)', required: true },
    { key: 'schoolId', label: 'School ID', required: true },
    { key: 'otherDoc', label: 'Other supporting document', required: false },
  ],
};

// ─── Zod Schemas ────────────────────────────────────────────────────

const baseInfoSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  sex: z.string().min(1, 'Sex is required'),
  yearLevel: z.string().min(1, 'Year/Grade Level is required'),
  studentNumber: z
    .string()
    .min(1, 'UMak Student Number is required')
    .regex(STUDENT_NUMBER_REGEX, 'Must be a letter followed by numbers (e.g., K12345678)'),
  collegeInstitute: z.string().min(1, 'College/Institute is required'),
  collegeInstituteOther: z.string().optional(),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
});

const workingStudentSchema = baseInfoSchema.extend({
  employerName: z.string().min(1, 'Name of Employer is required'),
  positionJobTitle: z.string().min(1, 'Position/Job Title is required'),
  durationOfEmployment: z.string().min(1, 'Duration of Employment is required'),
  reasonForExemption: z.string().min(1, 'Reason for exemption is required'),
});

const officeOrgEventSchema = baseInfoSchema.extend({
  organizationOfficeName: z.string().min(1, 'Organization/Office Name is required'),
  eventName: z.string().min(1, 'Event Name is required'),
  eventDate: z.string().min(1, 'Event Date is required'),
  roleInEvent: z.string().min(1, 'Role in Event is required'),
  reasonForExemption: z.string().min(1, 'Reason for exemption is required'),
});

const ojtSchema = baseInfoSchema.extend({
  companyName: z.string().min(1, 'Company Name is required'),
  positionRole: z.string().min(1, 'Position/Role is required'),
  ojtDuration: z.string().min(1, 'OJT Duration is required'),
  programCourseRequirement: z.string().min(1, 'Program/Course requirement is required'),
});

const collegeOrgShirtSchema = baseInfoSchema.extend({
  organizationCouncilName: z.string().min(1, 'Organization/Council Name is required'),
  shirtDesignDescription: z.string().min(1, 'Shirt Design Description is required'),
  eventOccasion: z.string().min(1, 'Event/Occasion is required'),
});

const otherSchema = baseInfoSchema.extend({
  reasonForExemption: z.string().min(1, 'Reason for exemption is required'),
  specifyCategory: z.string().min(1, 'Please specify the category'),
});

const categorySchemas: Record<Category, z.ZodTypeAny> = {
  working_student: workingStudentSchema,
  office_org_event: officeOrgEventSchema,
  ojt: ojtSchema,
  college_org_shirt: collegeOrgShirtSchema,
  other: otherSchema,
};

type FormValues = z.infer<typeof workingStudentSchema> &
  z.infer<typeof officeOrgEventSchema> &
  z.infer<typeof ojtSchema> &
  z.infer<typeof collegeOrgShirtSchema> &
  z.infer<typeof otherSchema>;

// ─── Helpers ────────────────────────────────────────────────────────

function getCategoryLabel(key: Category): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

function getCategoryIcon(key: Category): React.ReactNode {
  return CATEGORIES.find((c) => c.key === key)?.icon ?? <HelpCircle className="size-5" />;
}

function getStepProgress(step: Step): number {
  return Math.round(((step - 1) / 4) * 100);
}

// ─── Step Indicator ─────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: Step }) {
  return (
    <div className="mb-8">
      <Progress value={getStepProgress(currentStep)} className="h-2 mb-4" />
      <div className="flex items-center gap-1">
        {STEP_LABELS.map((label, i) => {
          const stepNum = (i + 1) as Step;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;

          return (
            <div key={label} className="flex items-center flex-1 min-w-0">
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
                    isCompleted || isCurrent ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
                    isCompleted ? 'bg-emerald-600' : 'bg-muted'
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

// ─── Main Component ─────────────────────────────────────────────────

function UniformExemptionPageContent() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [category, setCategory] = useState<Category | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ requestNumber: string; trackingToken: string } | null>(null);
  const [certified, setCertified] = useState(false);

  // Category change confirmation
  const [pendingCategory, setPendingCategory] = useState<Category | ''>('');
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);

  // File uploads per field key
  const [fileMap, setFileMap] = useState<Record<string, UploadedFile[]>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});

  // Dropdown options
  const [colleges, setColleges] = useState<{ value: string; label: string }[]>([]);
  const [yearLevels, setYearLevels] = useState<{ value: string; label: string }[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(category ? categorySchemas[category] : baseInfoSchema),
    defaultValues: {
      fullName: '',
      sex: '',
      yearLevel: '',
      studentNumber: '',
      collegeInstitute: '',
      collegeInstituteOther: '',
      email: '',
      employerName: '',
      positionJobTitle: '',
      durationOfEmployment: '',
      reasonForExemption: '',
      organizationOfficeName: '',
      eventName: '',
      eventDate: '',
      roleInEvent: '',
      companyName: '',
      positionRole: '',
      ojtDuration: '',
      programCourseRequirement: '',
      organizationCouncilName: '',
      shirtDesignDescription: '',
      eventOccasion: '',
      specifyCategory: '',
    },
    mode: 'onBlur',
  });

  // Fetch dropdown lists
  useEffect(() => {
    async function fetchLists() {
      setLoadingLists(true);
      try {
        const [colRes, yrRes] = await Promise.all([
          fetch('/api/lists?type=college_institute'),
          fetch('/api/lists?type=year_level'),
        ]);
        if (colRes.ok) {
          const data = await colRes.json();
          const mapped = data.map((item: { value: string | null; label: string }) => ({
            value: item.value || item.label,
            label: item.label,
          }));
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
        if (yrRes.ok) {
          const data = await yrRes.json();
          if (data.length > 0) {
            setYearLevels(
              data.map((item: { value: string; label: string }) => ({
                value: item.value,
                label: item.label,
              }))
            );
          } else {
            const FALLBACK_YEAR_LEVELS = ['Grade 11', 'Grade 12', 'First Year Level', 'Second Year Level', 'Third Year Level', 'Fourth Year Level', 'Fifth Year Level'];
            setYearLevels(FALLBACK_YEAR_LEVELS.map(yl => ({ value: yl, label: yl })));
          }
        } else {
          const FALLBACK_YEAR_LEVELS = ['Grade 11', 'Grade 12', 'First Year Level', 'Second Year Level', 'Third Year Level', 'Fourth Year Level', 'Fifth Year Level'];
          setYearLevels(FALLBACK_YEAR_LEVELS.map(yl => ({ value: yl, label: yl })));
        }
      } catch (err) {
        // Failed to fetch lists
        // Fallback year levels when API fails
        if (yearLevels.length === 0) {
          const FALLBACK_YEAR_LEVELS = ['Grade 11', 'Grade 12', 'First Year Level', 'Second Year Level', 'Third Year Level', 'Fourth Year Level', 'Fifth Year Level'];
          setYearLevels(FALLBACK_YEAR_LEVELS.map(yl => ({ value: yl, label: yl })));
        }
      } finally {
        setLoadingLists(false);
      }
    }
    fetchLists();
  }, []);

  // Clear errors when category changes
  useEffect(() => {
    if (category) {
      form.clearErrors();
    }
  }, [category, form]);

  // Category change handler with confirmation
  const handleCategorySelect = useCallback(
    (newCat: Category) => {
      if (!category) {
        setCategory(newCat);
        return;
      }
      if (newCat === category) return;

      // Check if there are uploaded files
      const hasFiles = Object.values(fileMap).some((files) => files.length > 0);
      if (hasFiles) {
        setPendingCategory(newCat);
        setShowCategoryDialog(true);
      } else {
        setCategory(newCat);
        setFileMap({});
        setFileErrors({});
      }
    },
    [category, fileMap]
  );

  const confirmCategoryChange = useCallback(() => {
    setCategory(pendingCategory);
    setFileMap({});
    setFileErrors({});
    setShowCategoryDialog(false);
    setPendingCategory('');
  }, [pendingCategory]);

  // File validation for step navigation
  const validateFiles = useCallback((): boolean => {
    if (!category) return false;
    const fields = FILE_FIELDS[category];
    const errors: Record<string, string> = {};
    let valid = true;

    fields.forEach((field) => {
      if (field.required) {
        const files = fileMap[field.key] ?? [];
        const hasUploaded = files.some((f) => f.status === 'uploaded');
        if (!hasUploaded) {
          errors[field.key] = `${field.label} is required`;
          valid = false;
        }
      }
    });

    setFileErrors(errors);
    return valid;
  }, [category, fileMap]);

  // Step navigation
  const goNext = useCallback(async () => {
    if (step === 1) {
      if (!category) return;
      setStep(2);
      return;
    }

    if (step === 2) {
      const valid = await form.trigger(['fullName', 'sex', 'yearLevel', 'studentNumber', 'collegeInstitute', 'email']);
      if (!valid) return;
      // Validate "Other" college/institute
      if (form.getValues('collegeInstitute') === 'Other' && !form.getValues('collegeInstituteOther')?.trim()) {
        form.setError('collegeInstituteOther', { message: 'Please specify your College/Institute' });
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!validateFiles()) return;
      setStep(4);
      return;
    }
  }, [step, category, form, validateFiles]);

  const goBack = useCallback(() => {
    if (step > 1 && step < 5) {
      setStep((step - 1) as Step);
    }
  }, [step]);

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!certified || !category) return;

    const formValues = form.getValues();

    // Manually validate against the correct category schema
    const schema = categorySchemas[category];
    const result = schema.safeParse(formValues);
    if (!result.success) {
      // Map zod errors to react-hook-form errors
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      Object.entries(fieldErrors).forEach(([field, message]) => {
        form.setError(field as any, { type: 'manual', message });
      });
      // Go back to step 2 to show errors
      setStep(2);
      return;
    }

    setIsSubmitting(true);

    try {
      // Collect all uploaded file URLs
      const allFileUrls: string[] = [];
      Object.values(fileMap).forEach((files) => {
        files
          .filter((f) => f.status === 'uploaded' && f.url)
          .forEach((f) => allFileUrls.push(f.url!));
      });

      // Build category-specific formData
      const categoryData: Record<string, string> = {
        category,
        categoryLabel: getCategoryLabel(category),
        fullName: formValues.fullName,
        sex: formValues.sex,
        yearLevel: formValues.yearLevel,
        studentNumber: formValues.studentNumber,
        collegeInstitute: formValues.collegeInstitute === 'Other' && formValues.collegeInstituteOther?.trim() ? formValues.collegeInstituteOther.trim() : formValues.collegeInstitute,
        email: formValues.email,
      };

      // Add category-specific fields
      if (category === 'working_student') {
        categoryData.employerName = formValues.employerName ?? '';
        categoryData.positionJobTitle = formValues.positionJobTitle ?? '';
        categoryData.durationOfEmployment = formValues.durationOfEmployment ?? '';
        categoryData.reasonForExemption = formValues.reasonForExemption ?? '';
      } else if (category === 'office_org_event') {
        categoryData.organizationOfficeName = formValues.organizationOfficeName ?? '';
        categoryData.eventName = formValues.eventName ?? '';
        categoryData.eventDate = formValues.eventDate ?? '';
        categoryData.roleInEvent = formValues.roleInEvent ?? '';
        categoryData.reasonForExemption = formValues.reasonForExemption ?? '';
      } else if (category === 'ojt') {
        categoryData.companyName = formValues.companyName ?? '';
        categoryData.positionRole = formValues.positionRole ?? '';
        categoryData.ojtDuration = formValues.ojtDuration ?? '';
        categoryData.programCourseRequirement = formValues.programCourseRequirement ?? '';
      } else if (category === 'college_org_shirt') {
        categoryData.organizationCouncilName = formValues.organizationCouncilName ?? '';
        categoryData.shirtDesignDescription = formValues.shirtDesignDescription ?? '';
        categoryData.eventOccasion = formValues.eventOccasion ?? '';
      } else if (category === 'other') {
        categoryData.reasonForExemption = formValues.reasonForExemption ?? '';
        categoryData.specifyCategory = formValues.specifyCategory ?? '';
      }

      // Add file info
      const fileInfo: Record<string, string> = {};
      const fileFields = FILE_FIELDS[category];
      fileFields.forEach((field) => {
        const files = fileMap[field.key] ?? [];
        const uploaded = files.find((f) => f.status === 'uploaded');
        if (uploaded) {
          fileInfo[field.key] = uploaded.name;
        }
      });
      categoryData.uploadedFiles = JSON.stringify(fileInfo);

      const res = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'UER',
          requestorName: formValues.fullName,
          requestorEmail: formValues.email,
          classification: category,
          formData: categoryData,
          fileUrls: allFileUrls,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit request');
      }

      const data = await res.json();
      setResult(data);
      setStep(5);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  }, [certified, category, form, fileMap]);

  // ─── Form Draft ─────────────────────────────────────────────
  const draft = useFormDraft({
    storageKey: 'uer-form-draft',
    currentStep: step,
    initialStep: 1 as Step,
    finalStep: 5 as Step,
    isSubmitted: step === 5,
    getFormData: () => ({
      category,
      ...form.getValues(),
    }),
    setFormData: (data) => {
      const d = data as Record<string, any>;
      if (d.category) setCategory(d.category as Category);
      const { category: _, ...formValues } = d;
      form.reset(formValues);
    },
  });

  const handleResumeDraft = () => {
    const loaded = draft.loadDraft();
    if (!loaded) return;
    const d = loaded.formData as Record<string, any>;
    if (d.category) setCategory(d.category as Category);
    const { category: _, ...formValues } = d;
    form.reset(formValues);
    setStep(loaded.step as Step);
  };

  const handleBackToServices = () => {
    if (draft.isDirty) {
      draft.setShowLeaveDialog(true);
    } else {
      router.push('/services');
    }
  };

  // ─── Render Helpers ───────────────────────────────────────────

  const renderCategorySpecificFields = () => {
    if (!category) return null;

    if (category === 'working_student') {
      return (
        <>
          <FormField
            control={form.control}
            name="employerName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Name of Employer <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Enter employer name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="positionJobTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Position/Job Title <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Enter your position or job title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="durationOfEmployment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Duration of Employment <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="e.g., June 2024 - Present" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="reasonForExemption"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Reason for Exemption <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Explain your reason for requesting a uniform exemption..."
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      );
    }

    if (category === 'office_org_event') {
      return (
        <>
          <FormField
            control={form.control}
            name="organizationOfficeName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Organization/Office Name <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Enter organization or office name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="eventName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Event Name <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Enter event name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="eventDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Event Date <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="roleInEvent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Role in Event <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Enter your role in the event" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="reasonForExemption"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Reason for Exemption <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Explain your reason for requesting a uniform exemption..."
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      );
    }

    if (category === 'ojt') {
      return (
        <>
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Company Name <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Enter company name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="positionRole"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Position/Role <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Enter your position or role" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ojtDuration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  OJT Duration <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="e.g., June 2024 - October 2024" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="programCourseRequirement"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Program/Course Requirement <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the program or course requirement for OJT..."
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      );
    }

    if (category === 'college_org_shirt') {
      return (
        <>
          <FormField
            control={form.control}
            name="organizationCouncilName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Organization/Council Name <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Enter organization or council name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shirtDesignDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Shirt Design Description <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the shirt design..."
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="eventOccasion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Event/Occasion <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Enter the event or occasion" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      );
    }

    if (category === 'other') {
      return (
        <>
          <FormField
            control={form.control}
            name="specifyCategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Specify Category <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Please specify your category for exemption" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="reasonForExemption"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Reason for Exemption <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Explain your reason for requesting a uniform exemption..."
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      );
    }

    return null;
  };

  const renderFileUploads = () => {
    if (!category) return null;
    const fields = FILE_FIELDS[category];

    return (
      <div className="space-y-6">
        {fields.map((field) => (
          <FileUpload
            key={field.key}
            files={fileMap[field.key] ?? []}
            onFilesChange={(files) => {
              setFileMap((prev) => ({ ...prev, [field.key]: files }));
              // Clear error if file is uploaded
              if (files.some((f) => f.status === 'uploaded')) {
                setFileErrors((prev) => {
                  const next = { ...prev };
                  delete next[field.key];
                  return next;
                });
              }
            }}
            maxFileSize={10 * 1024 * 1024}
            required={field.required}
            multiple={false}
            label={field.label}
            hint={
              field.acceptedTypes
                ? `PDF only (max 10MB)`
                : `PDF, DOC, DOCX, JPG, PNG (max 10MB)`
            }
            error={fileErrors[field.key]}
          />
        ))}
      </div>
    );
  };

  const renderReviewDetails = () => {
    if (!category) return null;
    const formValues = form.getValues();

    const baseFields = [
      { label: 'Category', value: getCategoryLabel(category) },
      { label: 'Full Name', value: formValues.fullName },
      { label: 'Sex', value: formValues.sex },
      { label: 'Year/Grade Level', value: formValues.yearLevel },
      { label: 'UMak Student Number', value: formValues.studentNumber },
      { label: 'College/Institute', value: formValues.collegeInstitute },
      { label: 'Email Address', value: formValues.email },
    ];

    let categoryFields: { label: string; value: string }[] = [];

    if (category === 'working_student') {
      categoryFields = [
        { label: 'Name of Employer', value: formValues.employerName ?? '' },
        { label: 'Position/Job Title', value: formValues.positionJobTitle ?? '' },
        { label: 'Duration of Employment', value: formValues.durationOfEmployment ?? '' },
        { label: 'Reason for Exemption', value: formValues.reasonForExemption ?? '' },
      ];
    } else if (category === 'office_org_event') {
      categoryFields = [
        { label: 'Organization/Office Name', value: formValues.organizationOfficeName ?? '' },
        { label: 'Event Name', value: formValues.eventName ?? '' },
        { label: 'Event Date', value: formValues.eventDate ?? '' },
        { label: 'Role in Event', value: formValues.roleInEvent ?? '' },
        { label: 'Reason for Exemption', value: formValues.reasonForExemption ?? '' },
      ];
    } else if (category === 'ojt') {
      categoryFields = [
        { label: 'Company Name', value: formValues.companyName ?? '' },
        { label: 'Position/Role', value: formValues.positionRole ?? '' },
        { label: 'OJT Duration', value: formValues.ojtDuration ?? '' },
        { label: 'Program/Course Requirement', value: formValues.programCourseRequirement ?? '' },
      ];
    } else if (category === 'college_org_shirt') {
      categoryFields = [
        { label: 'Organization/Council Name', value: formValues.organizationCouncilName ?? '' },
        { label: 'Shirt Design Description', value: formValues.shirtDesignDescription ?? '' },
        { label: 'Event/Occasion', value: formValues.eventOccasion ?? '' },
      ];
    } else if (category === 'other') {
      categoryFields = [
        { label: 'Specify Category', value: formValues.specifyCategory ?? '' },
        { label: 'Reason for Exemption', value: formValues.reasonForExemption ?? '' },
      ];
    }

    return (
      <>
        {/* Personal Information */}
        <Card className="glass border-border/40 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {baseFields.map((field) => (
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

        {/* Category-Specific Details */}
        <Card className="glass border-border/40 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              {getCategoryIcon(category)}
              {getCategoryLabel(category)} Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {categoryFields.map((field) => (
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

        {/* Uploaded Files */}
        <Card className="glass border-border/40 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Upload className="size-4" />
              Uploaded Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {FILE_FIELDS[category].map((field) => {
                const files = fileMap[field.key] ?? [];
                const uploadedFile = files.find((f) => f.status === 'uploaded');
                const hasError = files.some((f) => f.status === 'error');

                return (
                  <div
                    key={field.key}
                    className="flex items-start gap-3 p-3 rounded-lg border"
                  >
                    {uploadedFile ? (
                      <CheckCircle2 className="size-5 text-emerald-500 mt-0.5 shrink-0" />
                    ) : hasError ? (
                      <AlertTriangle className="size-5 text-destructive mt-0.5 shrink-0" />
                    ) : (
                      <FileText className="size-5 text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{field.label}</p>
                      {uploadedFile ? (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">
                          {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB) — Uploaded
                        </p>
                      ) : hasError ? (
                        <p className="text-xs text-destructive">Upload failed</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">No file uploaded</p>
                      )}
                    </div>
                    {field.required && !uploadedFile && (
                      <Badge variant="destructive" className="text-[10px]">
                        Required
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </>
    );
  };

  // ─── Step Renders ─────────────────────────────────────────────

  // Step 1: Category Selection
  if (step === 1) {
    return (
      <div className="flex flex-col">
        <OfficeHoursBanner />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
          <button
            type="button"
            onClick={handleBackToServices}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Services
          </button>

          <StepIndicator currentStep={step} />

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                <Shirt className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Uniform Exemption Request
              </h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Select the category that best describes your reason for uniform exemption.
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => handleCategorySelect(cat.key)}
                  className={`text-left p-5 rounded-xl border-2 transition-all hover:shadow-md group ${
                    isSelected
                      ? 'border-umak-blue dark:border-umak-gold bg-umak-blue/5 dark:bg-umak-gold/5 shadow-sm'
                      : 'border-border/60 hover:border-umak-blue/40 dark:hover:border-umak-gold/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-umak-blue/10 dark:bg-umak-gold/10 text-umak-blue dark:text-umak-gold'
                          : 'bg-muted text-muted-foreground group-hover:bg-umak-blue/10 group-hover:text-umak-blue dark:group-hover:bg-umak-gold/10 dark:group-hover:text-umak-gold'
                      }`}
                    >
                      {cat.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{cat.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-umak-blue dark:text-umak-gold">
                      <CheckCircle2 className="size-3.5" />
                      Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-8">
            <Button type="button" variant="outline" onClick={() => router.push('/services')}>
              <ArrowLeft className="size-4 mr-1" /> Cancel
            </Button>
            <Button
              type="button"
              onClick={goNext}
              disabled={!category}
              className="bg-umak-blue hover:bg-umak-blue-hover text-white"
            >
              Continue <ArrowRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Category Change Confirmation Dialog */}
        <AlertDialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-500" />
                Change Category?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Changing the category will clear all uploaded files. You will need to re-upload the
                required documents for the new category. Do you want to proceed?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingCategory('')}>
                Keep Current
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmCategoryChange}>
                Yes, Change Category
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Step 2: Personal Information + Category-Specific Questions
  if (step === 2) {
    return (
      <div className="flex flex-col">
        <OfficeHoursBanner />
        <DraftIndicator storageKey="uer-form-draft" />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
          <button
            type="button"
            onClick={handleBackToServices}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Services
          </button>

          <StepIndicator currentStep={step} />

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                <Shirt className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Uniform Exemption Request
                </h1>
                <Badge variant="secondary" className="mt-1 gap-1">
                  {getCategoryIcon(category)}
                  {getCategoryLabel(category)}
                </Badge>
              </div>
            </div>
          </div>

          <Form {...form}>
            <form className="space-y-0">
              {/* Personal Information */}
              <Card className="glass border-border/40 mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
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
                            <FormLabel>
                              Year/Grade Level <span className="text-destructive">*</span>
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select year/grade level" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {yearLevels.map((yl) => (
                                  <SelectItem key={yl.value} value={yl.value}>
                                    {yl.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="studentNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            UMak Student Number <span className="text-destructive">*</span>
                          </FormLabel>
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
                          <FormLabel>
                            College/Institute <span className="text-destructive">*</span>
                          </FormLabel>
                          <Select onValueChange={(v) => { field.onChange(v); if (v !== 'Other') form.setValue('collegeInstituteOther', ''); }} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select college/institute" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-64">
                              {colleges.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                          <FormLabel>
                            Email Address <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="you@umak.edu.ph" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Category-Specific Questions */}
              <Card className="glass border-border/40 mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    {getCategoryIcon(category)}
                    {getCategoryLabel(category)} — Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-5">{renderCategorySpecificFields()}</div>
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                <Button type="button" variant="outline" onClick={goBack}>
                  <ArrowLeft className="size-4 mr-1" /> Back
                </Button>
                <Button
                  type="button"
                  onClick={goNext}
                  className="bg-umak-blue hover:bg-umak-blue-hover text-white"
                >
                  Continue <ArrowRight className="size-4 ml-1" />
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    );
  }

  // Step 3: File Upload
  if (step === 3) {
    return (
      <div className="flex flex-col">
        <OfficeHoursBanner />
        <DraftIndicator storageKey="uer-form-draft" />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
          <button
            type="button"
            onClick={handleBackToServices}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Services
          </button>

          <StepIndicator currentStep={step} />

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                <Shirt className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Upload Required Documents
                </h1>
                <Badge variant="secondary" className="mt-1 gap-1">
                  {getCategoryIcon(category)}
                  {getCategoryLabel(category)}
                </Badge>
              </div>
            </div>
            <p className="text-muted-foreground text-sm mt-2">
              Please upload the required documents for your category. Each field accepts one file only.
            </p>
          </div>

          {/* Required Documents Checklist */}
          <Card className="mb-6 border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ClipboardCheck className="size-4 text-amber-600 dark:text-amber-400" />
                Required Documents for {getCategoryLabel(category)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-2">
                {FILE_FIELDS[category].map((field, i) => (
                  <li key={field.key} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>
                      {field.label}
                      {field.required && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                      {!field.required && (
                        <span className="text-muted-foreground ml-1">(optional)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* File Upload Fields */}
          <Card className="glass border-border/40 mb-6">
            <CardContent className="p-6">{renderFileUploads()}</CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={goBack}>
              <ArrowLeft className="size-4 mr-1" /> Back
            </Button>
            <Button
              type="button"
              onClick={goNext}
              className="bg-umak-blue hover:bg-umak-blue-hover text-white"
            >
              Continue <ArrowRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Review
  if (step === 4) {
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
              Please verify all information before submitting your Uniform Exemption Request.
            </p>
          </div>

          {renderReviewDetails()}

          {/* Certification */}
          <Card className="glass border-border/40 mb-6">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="certify"
                  checked={certified}
                  onCheckedChange={(checked) => setCertified(checked === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="certify" className="text-sm font-medium leading-snug cursor-pointer">
                    I hereby certify that all information provided is true and correct to the best of
                    my knowledge. I understand that any false information may result in the denial or
                    revocation of my Uniform Exemption Request and may subject me to disciplinary
                    action.
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={goBack}>
              <ArrowLeft className="size-4 mr-1" /> Back to Edit
            </Button>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleBackToServices}
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                CANCEL
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !certified}
                className="gradient-gold text-umak-navy border-0 font-semibold"
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

  // Step 5: Success
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
              Your Uniform Exemption Request has been received.
            </p>

            {result && (
              <div className="mb-8 max-w-sm mx-auto">
                <TrackableCard
                  requestNumber={result.requestNumber}
                  trackingToken={result.trackingToken}
                  type="service_request"
                  requestType="UER"
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

export default function UniformExemptionPage() {
  return (
    <ServiceAvailabilityGuard serviceKey="UER">
      <UniformExemptionPageContent />
    </ServiceAvailabilityGuard>
  );
}
