'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { z } from 'zod/v4';
import {
  CheckCircle2,
  Clock,
  ClipboardList,
  Scale,
  Plus,
  X,
  ChevronLeft,
  AlertTriangle,
  Info,
  User,
  Users,
  FileText,
  CheckSquare,
  MapPin,
  Mail,
  Phone,
  CalendarDays,
  Paperclip,
  ShieldCheck,
  PartyPopper,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { OfficeHoursBanner } from '@/components/layout/office-hours-banner';
import { CancelModal } from '@/components/complaint/cancel-modal';
import { FileUpload, UploadedFile } from '@/components/shared/file-upload';
import { ViolationTypeDropdown } from '@/components/shared/violation-type-dropdown';
import { TrackableCard } from '@/components/shared/trackable-card';
import { toTitleCase } from '@/lib/text-format';
import { ServiceUnavailableOverlay } from '@/components/shared/service-unavailable-overlay';

// ── Types ──
interface FormQuestion {
  id: string;
  phase: string;
  fieldType: string;
  label: string;
  helpText?: string | null;
  placeholder?: string | null;
  required: boolean;
  roleTarget?: string | null;
  sortOrder: number;
  isActive: boolean;
  choices?: string | null;
  content?: string | null;
  allowMultiple?: boolean;
  defaultValue?: string | null;
  validation?: string | null;
}

interface FormConfig {
  version: number;
  phases: Record<string, FormQuestion[]>;
}

interface PersonInfo {
  [key: string]: string;
}

interface ComplaintFormData {
  complainants: PersonInfo[];
  respondents: PersonInfo[];
  dynamicAnswers: Record<string, string>;
  files: UploadedFile[];
}

// ── Defaults ──
const defaultFormData: ComplaintFormData = {
  complainants: [{}],
  respondents: [{}],
  dynamicAnswers: {},
  files: [],
};

// ── Zod Schemas ──
const STUDENT_NUMBER_REGEX = /^[A-Za-z]\d+$/;

// ── Constants ──
const STEP_LABELS = [
  'Instructions',
  'Complainant Info',
  'Respondent Info',
  'Complaint Details',
  'Review',
  'Submitted',
];

const STEP_ICONS = [ClipboardList, User, Users, FileText, CheckSquare, CheckCircle2];

// ── Well-known field keys for backward compat ──
const WELL_KNOWN_KEYS = [
  'givenName', 'surname', 'middleName', 'extensionName', 'sex',
  'studentNumber', 'yearLevel', 'collegeInstitute', 'email',
  'subject', 'complaintCategory', 'description', 'desiredOutcome',
  'dateOfIncident', 'location', 'isOngoing', 'howOften',
  'witnesses', 'previousReports', 'violationType',
] as const;

// ── Phase step mapping ──
function phaseToStep(phase: string): number {
  switch (phase) {
    case 'instructions': return 1;
    case 'complainant': return 2;
    case 'respondent': return 3;
    case 'complaint_details': return 4;
    case 'review': return 5;
    case 'submitted': return 6;
    default: return 0;
  }
}

// ── Dynamic list cache ──
const listCache = new Map<string, { label: string; value: string }[]>();

async function fetchDynamicChoices(listType: string): Promise<{ label: string; value: string }[]> {
  if (listCache.has(listType)) return listCache.get(listType)!;
  try {
    const res = await fetch(`/api/lists?type=${listType}`);
    if (res.ok) {
      const data = await res.json();
      const items = data.map((c: { label: string; value?: string }) => ({
        label: c.label,
        value: c.value || c.label,
      }));
      listCache.set(listType, items);
      return items;
    }
  } catch {
    // ignore
  }
  return [];
}

function parseChoices(choicesStr: string | null | undefined): { label: string; value: string }[] | null {
  if (!choicesStr) return null;
  if (choicesStr.startsWith('dynamic:')) {
    return null; // needs async fetch
  }
  try {
    const parsed = JSON.parse(choicesStr);
    if (Array.isArray(parsed)) {
      return parsed.map((c: { label: string; value?: string }) => ({
        label: c.label,
        value: c.value || c.label,
      }));
    }
  } catch {
    // ignore
  }
  return null;
}

function getDynamicListType(choicesStr: string | null | undefined): string | null {
  if (!choicesStr || !choicesStr.startsWith('dynamic:')) return null;
  return choicesStr.replace('dynamic:', '');
}

// ── Section Header Component ──
function SectionHeader({ label, content, helpText }: { label: string; content?: string | null; helpText?: string | null }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="size-1.5 rounded-full bg-umak-blue dark:bg-umak-gold" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-umak-blue/70 dark:text-umak-gold/70">{label}</h4>
        <div className="flex-1 h-px bg-border/50" />
      </div>
      {content && (
        <div className="text-sm text-muted-foreground mb-3 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
      )}
      {helpText && !content && (
        <p className="text-xs text-muted-foreground mb-3">{helpText}</p>
      )}
    </div>
  );
}

// ── Dynamic Field Component ──
function DynamicField({
  question,
  value,
  onChange,
  error,
  prefix,
  dynamicChoices,
}: {
  question: FormQuestion;
  value: string;
  onChange: (qId: string, value: string) => void;
  error?: string;
  prefix?: string;
  dynamicChoices: { label: string; value: string }[] | null;
}) {
  const fieldId = prefix ? `${prefix}-${question.id}` : question.id;
  const inputClass = error
    ? "transition-all duration-200 focus:ring-2 focus:ring-umak-blue/20 dark:focus:ring-umak-gold/20 ring-2 ring-destructive border-destructive"
    : "transition-all duration-200 focus:ring-2 focus:ring-umak-blue/20 dark:focus:ring-umak-gold/20";

  switch (question.fieldType) {
    case 'section_header':
      return <SectionHeader label={question.label} content={question.content} helpText={question.helpText} />;

    case 'short_text':
      return (
        <div className="space-y-2">
          <Label htmlFor={fieldId} className="text-xs font-medium">
            {question.label} {question.required && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id={fieldId}
            value={value || ''}
            onChange={(e) => onChange(question.id, e.target.value)}
            placeholder={question.placeholder || `Enter ${question.label.toLowerCase()}`}
            className={inputClass}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      );

    case 'long_text':
      return (
        <div className="space-y-2">
          <Label htmlFor={fieldId} className="text-xs font-medium">
            {question.label} {question.required && <span className="text-destructive">*</span>}
          </Label>
          <Textarea
            id={fieldId}
            value={value || ''}
            onChange={(e) => onChange(question.id, e.target.value)}
            placeholder={question.placeholder || `Enter ${question.label.toLowerCase()}`}
            rows={question.id === 'description' ? 5 : 3}
            className={inputClass}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      );

    case 'dropdown': {
      const choices = dynamicChoices || parseChoices(question.choices) || [];
      return (
        <div className="space-y-2">
          <Label htmlFor={fieldId} className="text-xs font-medium">
            {question.label} {question.required && <span className="text-destructive">*</span>}
          </Label>
          <Select
            value={value || ''}
            onValueChange={(v) => onChange(question.id, v)}
          >
            <SelectTrigger className={`w-full ${question.label === 'College/Institute' ? 'overflow-hidden' : ''} ${inputClass}`} id={fieldId}>
              <SelectValue placeholder={question.placeholder || `Select ${question.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {choices.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      );
    }

    case 'radio': {
      const choices = dynamicChoices || parseChoices(question.choices) || [];
      return (
        <div className="space-y-2">
          <Label className="text-xs font-medium">
            {question.label} {question.required && <span className="text-destructive">*</span>}
          </Label>
          <RadioGroup
            value={value || ''}
            onValueChange={(v) => onChange(question.id, v)}
            className="flex gap-6"
          >
            {choices.map((choice) => (
              <div key={choice.value} className="flex items-center space-x-2">
                <RadioGroupItem value={choice.value} id={`${fieldId}-${choice.value}`} />
                <Label htmlFor={`${fieldId}-${choice.value}`} className="font-normal cursor-pointer">{choice.label}</Label>
              </div>
            ))}
          </RadioGroup>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      );
    }

    case 'checkbox': {
      const choices = dynamicChoices || parseChoices(question.choices) || [];
      const checkedValues: string[] = value ? value.split(',').filter(Boolean) : [];
      return (
        <div className="space-y-2">
          <Label className="text-xs font-medium">
            {question.label} {question.required && <span className="text-destructive">*</span>}
          </Label>
          <div className="space-y-2">
            {choices.map((choice) => (
              <div key={choice.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${fieldId}-${choice.value}`}
                  checked={checkedValues.includes(choice.value)}
                  onCheckedChange={(checked) => {
                    const updated = checked
                      ? [...checkedValues, choice.value]
                      : checkedValues.filter(v => v !== choice.value);
                    onChange(question.id, updated.join(','));
                  }}
                />
                <Label htmlFor={`${fieldId}-${choice.value}`} className="font-normal cursor-pointer">{choice.label}</Label>
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      );
    }

    case 'date':
      return (
        <div className="space-y-2">
          <Label className="text-xs font-medium">
            {question.label} {question.required && <span className="text-destructive">*</span>}
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={`w-full justify-start text-left font-normal ${inputClass} hover:border-amber-500/50`}
                id={fieldId}
              >
                <CalendarDays className="size-4 mr-2 text-muted-foreground" />
                {value
                  ? format(new Date(value), 'MMMM d, yyyy')
                  : (question.placeholder || `Select ${question.label.toLowerCase()}`)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value ? new Date(value) : undefined}
                onSelect={(date) => {
                  if (date) {
                    onChange(question.id, date.toISOString().split('T')[0]);
                  }
                }}
                disabled={(date) => date > new Date()}
              />
            </PopoverContent>
          </Popover>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      );

    case 'file_upload':
      return null; // handled separately at the card level

    case 'number':
      return (
        <div className="space-y-2">
          <Label htmlFor={fieldId} className="text-xs font-medium">
            {question.label} {question.required && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id={fieldId}
            type="number"
            value={value || ''}
            onChange={(e) => onChange(question.id, e.target.value)}
            placeholder={question.placeholder || `Enter ${question.label.toLowerCase()}`}
            className={inputClass}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      );

    case 'email':
      return (
        <div className="space-y-2">
          <Label htmlFor={fieldId} className="text-xs font-medium">
            {question.label} {question.required && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id={fieldId}
            type="email"
            value={value || ''}
            onChange={(e) => onChange(question.id, e.target.value)}
            placeholder={question.placeholder || `Enter ${question.label.toLowerCase()}`}
            className={inputClass}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      );

    default:
      return (
        <div className="space-y-2">
          <Label className="text-xs font-medium">{question.label}</Label>
          <Input
            value={value || ''}
            onChange={(e) => onChange(question.id, e.target.value)}
            placeholder={question.placeholder || `Enter ${question.label.toLowerCase()}`}
            className={inputClass}
          />
        </div>
      );
  }
}

// ── Person Form Component (dynamic) ──
function DynamicPersonForm({
  person,
  index,
  questions,
  onFieldChange,
  prefix,
  errors,
  dynamicLists,
  collegeInstituteOther,
  onCollegeInstituteOtherChange,
  collegeOtherError,
}: {
  person: PersonInfo;
  index: number;
  questions: FormQuestion[];
  onFieldChange: (index: number, qId: string, value: string) => void;
  prefix: string;
  errors: Record<string, string>;
  dynamicLists: Record<string, { label: string; value: string }[]>;
  collegeInstituteOther: string;
  onCollegeInstituteOtherChange: (index: number, value: string) => void;
  collegeOtherError?: string;
}) {
  return (
    <div className="space-y-5">
      {questions.map((q) => {
        if (q.fieldType === 'section_header') {
          return <SectionHeader key={q.id} label={q.label} content={q.content} helpText={q.helpText} />;
        }
        const fieldId = `${prefix}-${q.id}-${index}`;
        const dynamicChoices = getDynamicListType(q.choices) ? dynamicLists[getDynamicListType(q.choices)!] || null : null;
        const val = person[q.id] || q.defaultValue || '';
        const fieldError = errors[`${index}.${q.id}`] || errors[q.id];

        return (
          <div key={q.id}>
            <DynamicField
              question={q}
              value={val}
              onChange={(qId, v) => onFieldChange(index, qId, v)}
              error={fieldError}
              prefix={prefix}
              dynamicChoices={dynamicChoices}
            />
            {/* College/Institute "Other" conditional */}
            {q.id === 'collegeInstitute' && val === 'Other' && (
              <div className="space-y-2 animate-fade-in mt-2">
                <Label htmlFor={`${prefix}-collegeInstituteOther-${index}`} className="text-xs font-medium">
                  Please specify your College/Institute <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`${prefix}-collegeInstituteOther-${index}`}
                  placeholder="Enter your college or institute"
                  defaultValue={collegeInstituteOther}
                  onChange={(e) => onCollegeInstituteOtherChange(index, e.target.value)}
                  className="transition-all duration-200 focus:ring-2 focus:ring-umak-blue/20 dark:focus:ring-umak-gold/20"
                />
                {collegeOtherError && <p className="text-sm text-destructive">{collegeOtherError}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ──
export default function ComplaintPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<ComplaintFormData>({ ...defaultFormData, dynamicAnswers: {} });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cancelOpen, setCancelOpen] = useState(false);
  const [certified, setCertified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ complaintNumber: string; trackingToken: string } | null>(null);
  const [formConfig, setFormConfig] = useState<FormConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [dynamicLists, setDynamicLists] = useState<Record<string, { label: string; value: string }[]>>({});

  // Track "Other" college/institute text for each person (key: "prefix-index")
  const collegeInstituteOtherMapRef = useRef<Record<string, string>>({});
  const [collegeOtherErrors, setCollegeOtherErrors] = useState<Record<string, string>>({});

  // Track violation type other text
  const violationTypeOtherRef = useRef('');

  // Fetch form config + dynamic lists on mount
  useEffect(() => {
    async function init() {
      try {
        const [configRes] = await Promise.all([
          fetch('/api/complaint-form/config'),
        ]);
        if (configRes.ok) {
          const configData = await configRes.json();
          setFormConfig(configData);

          // Set default values from config
          const defaultAnswers: Record<string, string> = {};
          const dynamicListTypes = new Set<string>();

          for (const [, phaseArr] of Object.entries(configData.phases) as [string, FormQuestion[]][]) {
            for (const q of phaseArr) {
              if (q.defaultValue && q.fieldType !== 'section_header') {
                defaultAnswers[q.id] = q.defaultValue;
              }
              const listType = getDynamicListType(q.choices);
              if (listType) dynamicListTypes.add(listType);
            }
          }

          setFormData(prev => ({
            ...prev,
            dynamicAnswers: { ...prev.dynamicAnswers, ...defaultAnswers },
          }));

          // Fetch all dynamic lists in parallel
          if (dynamicListTypes.size > 0) {
            const listEntries = await Promise.all(
              Array.from(dynamicListTypes).map(async (type) => {
                const items = await fetchDynamicChoices(type);
                return [type, items] as const;
              })
            );
            const listsMap: Record<string, { label: string; value: string }[]> = {};
            for (const [type, items] of listEntries) {
              listsMap[type] = items;
            }
            setDynamicLists(listsMap);
          }
        }
      } catch {
        // If config fails, we'll show a loading error
      } finally {
        setConfigLoading(false);
      }
    }
    init();
  }, []);

  // Get questions for a phase
  const getPhaseQuestions = useCallback((phase: string): FormQuestion[] => {
    if (!formConfig) return [];
    return formConfig.phases[phase] || [];
  }, [formConfig]);

  // Check if a phase allows multiple persons (always true for complainant/respondent)
  const getPhaseAllowMultiple = useCallback((phase: string): boolean => {
    if (phase === 'complainant' || phase === 'respondent') return true;
    const questions = getPhaseQuestions(phase);
    return questions.some(q => q.allowMultiple);
  }, [getPhaseQuestions]);

  // Person field change handlers
  const updateComplainantField = useCallback((index: number, qId: string, value: string) => {
    setFormData((prev) => {
      const updated = [...prev.complainants];
      updated[index] = { ...updated[index], [qId]: value };
      return { ...prev, complainants: updated };
    });
    setErrors({});
    setCollegeOtherErrors({});
  }, []);

  const updateRespondentField = useCallback((index: number, qId: string, value: string) => {
    setFormData((prev) => {
      const updated = [...prev.respondents];
      updated[index] = { ...updated[index], [qId]: value };
      return { ...prev, respondents: updated };
    });
    setErrors({});
    setCollegeOtherErrors({});
  }, []);

  // Dynamic answer change (for complaint_details phase)
  const updateDynamicAnswer = useCallback((qId: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      dynamicAnswers: { ...prev.dynamicAnswers, [qId]: value },
    }));
    setErrors({});
  }, []);

  const handleComplainantOtherChange = useCallback((index: number, value: string) => {
    collegeInstituteOtherMapRef.current[`complainant-${index}`] = value;
  }, []);

  const handleRespondentOtherChange = useCallback((index: number, value: string) => {
    collegeInstituteOtherMapRef.current[`respondent-${index}`] = value;
  }, []);

  const addComplainant = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      complainants: [...prev.complainants, {}],
    }));
  }, []);

  const removeComplainant = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      complainants: prev.complainants.filter((_, i) => i !== index),
    }));
  }, []);

  const addRespondent = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      respondents: [...prev.respondents, {}],
    }));
  }, []);

  const removeRespondent = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      respondents: prev.respondents.filter((_, i) => i !== index),
    }));
  }, []);

  const handleCancelConfirm = useCallback(() => {
    setCancelOpen(false);
    router.push('/');
  }, [router]);

  // Validate a person phase
  const validatePersonPhase = useCallback((persons: PersonInfo[], questions: FormQuestion[], prefix: string): boolean => {
    const fieldErrors: Record<string, string> = {};
    const otherErrors: Record<string, string> = {};

    for (let i = 0; i < persons.length; i++) {
      const person = persons[i];
      for (const q of questions) {
        if (q.fieldType === 'section_header' || !q.required) continue;
        const val = person[q.id];
        if (!val || val.trim() === '') {
          fieldErrors[`${i}.${q.id}`] = `${q.label} is required`;
        }
        // Special validations
        if (q.id === 'studentNumber' && val && !STUDENT_NUMBER_REGEX.test(val)) {
          fieldErrors[`${i}.studentNumber`] = 'Must be a letter followed by numbers (e.g., K12345678)';
        }
        if (q.id === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          fieldErrors[`${i}.email`] = 'Invalid email address';
        }
      }
      // College/Institute "Other" validation
      if (person.collegeInstitute === 'Other' && !collegeInstituteOtherMapRef.current[`${prefix}-${i}`]?.trim()) {
        otherErrors[`${prefix}-${i}`] = 'Please specify your college/institute';
      }
    }

    setErrors(fieldErrors);
    if (Object.keys(otherErrors).length > 0) {
      setCollegeOtherErrors(otherErrors);
      return false;
    }
    return Object.keys(fieldErrors).length === 0;
  }, []);

  // Validate complaint_details phase
  const validateDetailsPhase = useCallback((questions: FormQuestion[]): boolean => {
    const fieldErrors: Record<string, string> = {};
    const answers = formData.dynamicAnswers;

    for (const q of questions) {
      if (q.fieldType === 'section_header' || !q.required) continue;
      const val = answers[q.id];
      if (!val || val.trim() === '') {
        fieldErrors[q.id] = `${q.label} is required`;
        continue;
      }
      // Parse validation rules
      if (q.validation) {
        try {
          const rules = JSON.parse(q.validation);
          if (rules.min && val.length < rules.min) {
            fieldErrors[q.id] = rules.customMessage || `${q.label} must be at least ${rules.min} characters`;
          }
          if (rules.max && val.length > rules.max) {
            fieldErrors[q.id] = `${q.label} must be at most ${rules.max} characters`;
          }
          if (rules.pattern) {
            const regex = new RegExp(rules.pattern);
            if (!regex.test(val)) {
              fieldErrors[q.id] = rules.customMessage || `Invalid format for ${q.label}`;
            }
          }
        } catch {
          // ignore invalid validation JSON
        }
      }
      // Built-in validations
      if (q.id === 'description' && val.length < 20) {
        fieldErrors[q.id] = 'Description must be at least 20 characters';
      }
    }

    setErrors(fieldErrors);
    return Object.keys(fieldErrors).length === 0;
  }, [formData.dynamicAnswers]);

  const validateStep = useCallback((stepNum: number): boolean => {
    setErrors({});
    setCollegeOtherErrors({});

    if (stepNum === 2) {
      const questions = getPhaseQuestions('complainant').filter(q => q.fieldType !== 'section_header');
      return validatePersonPhase(formData.complainants, questions, 'complainant');
    }
    if (stepNum === 3) {
      const questions = getPhaseQuestions('respondent').filter(q => q.fieldType !== 'section_header');
      return validatePersonPhase(formData.respondents, questions, 'respondent');
    }
    if (stepNum === 4) {
      const questions = getPhaseQuestions('complaint_details');
      return validateDetailsPhase(questions);
    }
    return true;
  }, [formData.complainants, formData.respondents, formData.dynamicAnswers, getPhaseQuestions, validatePersonPhase, validateDetailsPhase]);

  const handleNext = useCallback(() => {
    if (step >= 2 && step <= 4) {
      if (!validateStep(step)) return;
    }
    if (step === 5 && !certified) return;
    setStep((prev) => Math.min(prev + 1, 6));
  }, [step, validateStep, certified]);

  const handleBack = useCallback(() => {
    setStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!certified) return;
    setIsSubmitting(true);
    try {
      const answers = formData.dynamicAnswers;

      // Extract backward-compat well-known fields from dynamicAnswers
      const extractField = (key: string) => answers[key] || '';

      // Process violation type (combine with "Other")
      let effectiveViolationType = extractField('violationType');
      if (effectiveViolationType === '__other__') {
        effectiveViolationType = violationTypeOtherRef.current;
      }

      // Process complainants
      const processedComplainants = formData.complainants.map((p, i) => {
        const ciOther = p.collegeInstitute === 'Other' && collegeInstituteOtherMapRef.current[`complainant-${i}`]?.trim()
          ? collegeInstituteOtherMapRef.current[`complainant-${i}`].trim()
          : (p.collegeInstitute || '');
        return {
          givenName: toTitleCase(p.givenName || ''),
          surname: toTitleCase(p.surname || ''),
          middleName: toTitleCase(p.middleName || ''),
          extensionName: toTitleCase(p.extensionName || ''),
          sex: p.sex || '',
          studentNumber: p.studentNumber || '',
          collegeInstitute: ciOther,
          email: p.email || '',
          yearLevel: p.yearLevel || '',
        };
      });

      // Process respondents
      const processedRespondents = formData.respondents.map((p, i) => {
        const ciOther = p.collegeInstitute === 'Other' && collegeInstituteOtherMapRef.current[`respondent-${i}`]?.trim()
          ? collegeInstituteOtherMapRef.current[`respondent-${i}`].trim()
          : (p.collegeInstitute || '');
        return {
          givenName: toTitleCase(p.givenName || ''),
          surname: toTitleCase(p.surname || ''),
          middleName: toTitleCase(p.middleName || ''),
          extensionName: toTitleCase(p.extensionName || ''),
          sex: p.sex || '',
          studentNumber: p.studentNumber || '',
          collegeInstitute: ciOther,
          email: p.email || '',
          yearLevel: p.yearLevel || '',
        };
      });

      const payload = {
        complainants: processedComplainants,
        respondents: processedRespondents,
        subject: extractField('subject'),
        complaintCategory: extractField('complaintCategory'),
        violationType: effectiveViolationType || undefined,
        description: extractField('description'),
        desiredOutcome: extractField('desiredOutcome'),
        dateOfIncident: extractField('dateOfIncident'),
        location: extractField('location'),
        isOngoing: extractField('isOngoing'),
        howOften: extractField('howOften') || undefined,
        witnesses: extractField('witnesses') || undefined,
        previousReports: extractField('previousReports') || undefined,
        fileUrls: formData.files.filter(f => f.status === 'uploaded' && f.url).map(f => f.url),
        dynamicAnswers: answers,
        formVersion: formConfig?.version || 1,
      };

      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrors({ submit: data.error || 'Failed to file complaint.' });
        setIsSubmitting(false);
        return;
      }

      const data = await res.json();
      setSubmitResult({ complaintNumber: data.complaintNumber, trackingToken: data.trackingToken });
      setStep(6);
    } catch {
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [certified, formData, formConfig]);

  // ── Render Person Step (shared for complainant/respondent) ──
  const renderPersonStep = useCallback((
    phase: 'complainant' | 'respondent',
    persons: PersonInfo[],
    onFieldChange: (index: number, qId: string, value: string) => void,
    onOtherChange: (index: number, value: string) => void,
    addPerson: () => void,
    removePerson: (index: number) => void,
  ) => {
    const questions = getPhaseQuestions(phase);
    const sectionHeaders = questions.filter(q => q.fieldType === 'section_header');
    const mainHeader = sectionHeaders[0];
    const isComplainant = phase === 'complainant';
    const allowMultiple = getPhaseAllowMultiple(phase);
    const personsList = persons.length > 0 ? persons : [{}];

    // Card styling per phase
    const gradientClass = isComplainant
      ? 'from-umak-blue to-umak-blue/60'
      : 'from-purple-500 to-purple-500/60';
    const iconBg = isComplainant
      ? 'bg-umak-blue/10 dark:bg-umak-gold/10'
      : 'bg-purple-500/10 dark:bg-purple-400/10';
    const iconColor = isComplainant
      ? 'text-umak-blue dark:text-umak-gold'
      : 'text-purple-600 dark:text-purple-400';
    const MainIcon = isComplainant ? User : Users;
    const CoIcon = isComplainant ? User : Users;
    const mainLabel = isComplainant ? 'MAIN COMPLAINANT' : 'MAIN RESPONDENT';
    const coLabel = isComplainant ? 'CO-COMPLAINANT' : 'CO-RESPONDENT';
    const addLabel = isComplainant ? 'Add Co-complainant' : 'Add Co-respondent';
    const dashedBorder = isComplainant
      ? 'border-umak-blue/30 dark:border-umak-gold/30 bg-umak-blue/5 dark:bg-umak-gold/5 text-umak-blue dark:text-umak-gold hover:bg-umak-blue/10 dark:hover:bg-umak-gold/10 hover:border-umak-blue/50 dark:hover:border-umak-gold/50'
      : 'border-purple-400/30 dark:border-purple-400/30 bg-purple-500/5 dark:bg-purple-400/5 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 dark:hover:bg-purple-400/10 hover:border-purple-400/50 dark:hover:border-purple-400/50';
    const addCircleBg = isComplainant
      ? 'bg-umak-blue/15 dark:bg-umak-gold/15'
      : 'bg-purple-500/15 dark:bg-purple-400/15';

    return (
      <div className="animate-fade-in space-y-6">
        {/* Main person card */}
        {personsList[0] !== undefined && (
          <Card className="border-border/50 overflow-hidden">
            <div className={`h-1.5 bg-gradient-to-r ${gradientClass}`} />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-xl ${iconBg} flex items-center justify-center`}>
                  <MainIcon className={`size-5 ${iconColor}`} />
                </div>
                <CardTitle className={`text-lg font-semibold ${isComplainant ? 'text-umak-blue dark:text-umak-gold' : 'text-umak-blue dark:text-umak-gold'}`}>
                  {mainLabel}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <DynamicPersonForm
                person={personsList[0]}
                index={0}
                questions={questions}
                onFieldChange={onFieldChange}
                prefix={phase}
                errors={errors}
                dynamicLists={dynamicLists}
                collegeInstituteOther={collegeInstituteOtherMapRef.current[`${phase}-0`] || ''}
                onCollegeInstituteOtherChange={onOtherChange}
                collegeOtherError={collegeOtherErrors[`${phase}-0`]}
              />
            </CardContent>
          </Card>
        )}

        {/* Additional persons (co-complainants/co-respondents) */}
        {personsList.slice(1).map((person, idx) => {
          const actualIdx = idx + 1;
          return (
            <Card key={actualIdx} className="border-border/50 relative overflow-hidden">
              <div className="h-1 bg-muted" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-muted flex items-center justify-center">
                    <CoIcon className="size-4 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-base font-semibold text-muted-foreground">
                    {coLabel} {idx + 1}
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:bg-destructive/10"
                  onClick={() => removePerson(actualIdx)}
                  aria-label={`Remove ${coLabel.toLowerCase()} ${idx + 1}`}
                >
                  <X className="size-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <DynamicPersonForm
                  person={person}
                  index={actualIdx}
                  questions={questions}
                  onFieldChange={onFieldChange}
                  prefix={phase}
                  errors={errors}
                  dynamicLists={dynamicLists}
                  collegeInstituteOther={collegeInstituteOtherMapRef.current[`${phase}-${actualIdx}`] || ''}
                  onCollegeInstituteOtherChange={onOtherChange}
                  collegeOtherError={collegeOtherErrors[`${phase}-${actualIdx}`]}
                />
              </CardContent>
            </Card>
          );
        })}

        {/* Add another person button */}
        {allowMultiple && (
          <button
            type="button"
            onClick={addPerson}
            className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed ${dashedBorder} transition-all font-semibold`}
          >
            <div className={`size-8 rounded-full ${addCircleBg} flex items-center justify-center`}>
              <Plus className="size-4" />
            </div>
            {addLabel}
          </button>
        )}

        {Object.keys(errors).length > 0 && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive font-medium">
              {Object.keys(errors).length} required field(s) need attention. Please check the highlighted fields above.
            </p>
            {Object.keys(errors).length <= 5 && (
              <ul className="mt-2 text-xs text-destructive/80 space-y-1 list-disc list-inside">
                {Object.entries(errors).filter(([, v]) => v && v.trim()).map(([key, msg]) => (
                  <li key={key}>{msg}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {Object.keys(collegeOtherErrors).length > 0 && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive font-medium">
              {Object.keys(collegeOtherErrors).length} required field(s) need attention. Please check the highlighted fields above.
            </p>
            <ul className="mt-2 text-xs text-destructive/80 space-y-1 list-disc list-inside">
              {Object.values(collegeOtherErrors).map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-between mt-6">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleBack} className="min-w-[100px]">
              <ChevronLeft className="size-4 mr-1" />
              BACK
            </Button>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(true)}
              className="min-w-[100px]"
            >
              CANCEL
            </Button>
          </div>
          <Button
            onClick={handleNext}
            className="min-w-[120px] bg-umak-blue hover:bg-umak-blue-hover text-white font-semibold"
          >
            PROCEED
          </Button>
        </div>
      </div>
    );
  }, [errors, getPhaseQuestions, getPhaseAllowMultiple, dynamicLists, collegeOtherErrors, handleBack, handleNext]);

  // ── Step 1: Instructions ──
  const renderStep1 = () => (
    <div className="animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main instructions */}
        <div className="lg:col-span-2">
          <Card className="border-border/50 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-umak-blue via-umak-blue/70 to-umak-gold" />
            <CardHeader className="text-center pb-2 pt-6">
              <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-umak-blue/10 dark:bg-umak-gold/10 mb-4 mx-auto">
                <ClipboardList className="size-7 text-umak-blue dark:text-umak-gold" />
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold text-umak-blue dark:text-umak-gold">
                HOW TO FILE A COMPLAINT
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Follow these steps to submit your complaint to the CSFD office
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-3">
                {[
                  {
                    icon: <CheckCircle2 className="size-5 text-white" />,
                    iconBg: 'bg-emerald-500',
                    title: 'Accomplish this Complaint Form',
                    desc: 'Fill out all the required information about yourself, the respondent, and the incident.',
                  },
                  {
                    icon: <Clock className="size-5 text-white" />,
                    iconBg: 'bg-amber-500',
                    title: 'Wait for validation',
                    desc: 'An email will be sent to you confirming that your complaint has been received and is being reviewed.',
                  },
                  {
                    icon: <ClipboardList className="size-5 text-white" />,
                    iconBg: 'bg-umak-blue dark:bg-umak-gold/80',
                    title: 'Proceed to CSFD Office',
                    desc: 'Bring your official complaint letter to the CSFD Office for further processing.',
                  },
                  {
                    icon: <Scale className="size-5 text-white" />,
                    iconBg: 'bg-purple-500',
                    title: 'Wait for case hearing',
                    desc: 'Case hearing details will be sent to you via email. Please monitor your inbox regularly.',
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 shrink-0">
                      <div className={`size-10 rounded-full ${item.iconBg} flex items-center justify-center shadow-md`}>
                        {item.icon}
                      </div>
                      <span className="text-2xl font-black text-muted-foreground/30">{i + 1}</span>
                    </div>
                    <div className="pt-1">
                      <h3 className="font-semibold text-foreground">{item.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
                <Info className="size-4 text-green-600 dark:text-green-400 shrink-0" />
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                  No login required to file a complaint.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: CSFD Contact Info */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-border/50 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-umak-gold to-umak-gold/60" />
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-umak-blue dark:text-umak-gold flex items-center gap-2">
                <MapPin className="size-4" />
                CSFD Office
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Location</p>
                  <p className="text-muted-foreground">2nd Floor, Main Building<br />University of Makati</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <Mail className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Email</p>
                  <a href="mailto:csfd@umak.edu.ph" className="text-umak-blue dark:text-umak-gold hover:underline">
                    csfd@umak.edu.ph
                  </a>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <Phone className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Phone</p>
                  <p className="text-muted-foreground">(02) 8812-1800 loc. 2100</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <Clock className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Office Hours</p>
                  <p className="text-muted-foreground">Mon–Fri: 8:00 AM – 5:00 PM</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-800 dark:text-amber-300">Confidentiality Assured</p>
                  <p className="text-amber-700 dark:text-amber-400 mt-1">
                    All complaints are handled with strict confidentiality. Your identity is protected throughout the process.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={() => setCancelOpen(true)}
          className="min-w-[120px]"
        >
          CANCEL
        </Button>
        <Button
          onClick={handleNext}
          className="min-w-[140px] bg-umak-blue hover:bg-umak-blue-hover text-white font-semibold"
        >
          GET STARTED
          <ChevronLeft className="size-4 ml-1 rotate-180" />
        </Button>
      </div>
    </div>
  );

  // ── Step 4: Complaint Details ──
  const renderStep4 = () => {
    const questions = getPhaseQuestions('complaint_details');
    const answers = formData.dynamicAnswers;

    // Determine if we need the ViolationTypeDropdown (special field)
    const hasViolationType = questions.some(q => q.id === 'violationType');
    const hasFileUpload = questions.some(q => q.fieldType === 'file_upload');

    return (
      <div className="animate-fade-in space-y-6">
        {/* Core Complaint Details */}
        <Card className="border-border/50 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-umak-blue to-umak-gold" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-umak-blue/10 dark:bg-umak-gold/10 flex items-center justify-center">
                <FileText className="size-5 text-umak-blue dark:text-umak-gold" />
              </div>
              <CardTitle className="text-lg font-semibold text-umak-blue dark:text-umak-gold">
                CORE COMPLAINT DETAILS
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Classification Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="size-1.5 rounded-full bg-umak-blue dark:bg-umak-gold" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-umak-blue/70 dark:text-umak-gold/70">Classification</h4>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {questions.filter(q => q.id === 'complaintCategory').map(q => {
                  const listType = getDynamicListType(q.choices);
                  const dynamicChoices = listType ? dynamicLists[listType] || null : null;
                  return (
                    <DynamicField
                      key={q.id}
                      question={q}
                      value={answers[q.id] || ''}
                      onChange={updateDynamicAnswer}
                      error={errors[q.id]}
                      dynamicChoices={dynamicChoices}
                    />
                  );
                })}
                {hasViolationType && (
                  <ViolationTypeDropdown
                    value={answers['violationType'] || ''}
                    onChange={(v) => updateDynamicAnswer('violationType', v)}
                    otherValue={violationTypeOtherRef.current}
                    onOtherChange={(v) => { violationTypeOtherRef.current = v; }}
                  />
                )}
              </div>
            </div>

            {/* Details Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="size-1.5 rounded-full bg-umak-blue dark:bg-umak-gold" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-umak-blue/70 dark:text-umak-gold/70">Details</h4>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              <div className="space-y-4">
                {questions.filter(q =>
                  q.fieldType !== 'section_header' &&
                  q.id !== 'complaintCategory' &&
                  q.id !== 'violationType' &&
                  q.id !== 'dateOfIncident' &&
                  q.id !== 'location' &&
                  q.id !== 'isOngoing' &&
                  q.id !== 'howOften' &&
                  q.id !== 'witnesses' &&
                  q.id !== 'previousReports' &&
                  q.id !== 'file_upload' &&
                  q.fieldType !== 'file_upload'
                ).map(q => {
                  const listType = getDynamicListType(q.choices);
                  const dynamicChoices = listType ? dynamicLists[listType] || null : null;
                  return (
                    <DynamicField
                      key={q.id}
                      question={q}
                      value={answers[q.id] || ''}
                      onChange={updateDynamicAnswer}
                      error={errors[q.id]}
                      dynamicChoices={dynamicChoices}
                    />
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline & Context */}
        <Card className="border-border/50 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-amber-500 to-amber-400" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-500/10 flex:bg-amber-400/10 flex items-center justify-center">
                <CalendarDays className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-lg font-semibold text-umak-blue dark:text-umak-gold">
                TIMELINE &amp; CONTEXT
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* When & Where Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="size-1.5 rounded-full bg-amber-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70">When &amp; Where</h4>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {questions.filter(q => q.id === 'dateOfIncident').map(q => (
                  <DynamicField
                    key={q.id}
                    question={q}
                    value={answers[q.id] || ''}
                    onChange={updateDynamicAnswer}
                    error={errors[q.id]}
                    dynamicChoices={null}
                  />
                ))}
                {questions.filter(q => q.id === 'location').map(q => (
                  <DynamicField
                    key={q.id}
                    question={q}
                    value={answers[q.id] || ''}
                    onChange={updateDynamicAnswer}
                    error={errors[q.id]}
                    dynamicChoices={null}
                  />
                ))}
              </div>
            </div>

            {/* Context Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="size-1.5 rounded-full bg-amber-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70">Context</h4>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              <div className="space-y-4">
                {questions.filter(q => q.id === 'isOngoing').map(q => {
                  const listType = getDynamicListType(q.choices);
                  const dynamicChoices = listType ? dynamicLists[listType] || null : null;
                  return (
                    <DynamicField
                      key={q.id}
                      question={q}
                      value={answers[q.id] || ''}
                      onChange={updateDynamicAnswer}
                      error={errors[q.id]}
                      dynamicChoices={dynamicChoices}
                    />
                  );
                })}
                {(answers['isOngoing'] === 'Yes') && questions.filter(q => q.id === 'howOften').map(q => (
                  <div key={q.id} className="animate-fade-in ml-4 pl-4 border-l-2 border-amber-500/20">
                    <DynamicField
                      question={q}
                      value={answers[q.id] || ''}
                      onChange={updateDynamicAnswer}
                      error={errors[q.id]}
                      dynamicChoices={null}
                    />
                  </div>
                ))}
                {questions.filter(q => q.id === 'witnesses').map(q => (
                  <DynamicField
                    key={q.id}
                    question={q}
                    value={answers[q.id] || ''}
                    onChange={updateDynamicAnswer}
                    error={errors[q.id]}
                    dynamicChoices={null}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evidence & Documentation */}
        <Card className="border-border/50 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-teal-500 to-teal-400" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                <Paperclip className="size-5 text-teal-600 dark:text-teal-400" />
              </div>
              <CardTitle className="text-lg font-semibold text-umak-blue dark:text-umak-gold">
                EVIDENCE &amp; DOCUMENTATION
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Previous Reports */}
            {questions.filter(q => q.id === 'previousReports').map(q => {
              const listType = getDynamicListType(q.choices);
              const dynamicChoices = listType ? dynamicLists[listType] || null : null;
              return (
                <div key={q.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-1.5 rounded-full bg-teal-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-teal-600/70 dark:text-teal-400/70">Previous Reports</h4>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                  <DynamicField
                    question={q}
                    value={answers[q.id] || ''}
                    onChange={updateDynamicAnswer}
                    error={errors[q.id]}
                    dynamicChoices={dynamicChoices}
                  />
                </div>
              );
            })}

            {/* File Upload */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="size-1.5 rounded-full bg-teal-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-teal-600/70 dark:text-teal-400/70">Supporting Files</h4>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              <FileUpload
                files={formData.files}
                onFilesChange={(files) => setFormData(prev => ({ ...prev, files }))}
                maxFileSize={10 * 1024 * 1024}
                maxFiles={5}
                label="Supporting Evidence (Optional)"
                hint="PDF, DOC, DOCX, JPG, PNG (max 10MB each, up to 5 files)"
              />
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Upload a copy of your evidence with a maximum file size of 10MB. For larger files,
                upload it through an online storage/cloud and send it through email of CSFD at{' '}
                <a href="mailto:csfd@umak.edu.ph" className="underline font-medium">
                  csfd@umak.edu.ph
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        {Object.keys(errors).length > 0 && !errors.submit && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive font-medium">
              {Object.keys(errors).length} required field(s) need attention. Please check the highlighted fields above.
            </p>
            {Object.keys(errors).length <= 5 && (
              <ul className="mt-2 text-xs text-destructive/80 space-y-1 list-disc list-inside">
                {Object.entries(errors).filter(([, v]) => v && v.trim()).map(([key, msg]) => (
                  <li key={key}>{msg}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-between mt-6">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleBack} className="min-w-[100px]">
              <ChevronLeft className="size-4 mr-1" />
              BACK
            </Button>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(true)}
              className="min-w-[100px]"
            >
              CANCEL
            </Button>
          </div>
          <Button
            onClick={handleNext}
            className="min-w-[120px] bg-umak-blue hover:bg-umak-blue-hover text-white font-semibold"
          >
            PROCEED
          </Button>
        </div>
      </div>
    );
  };

  // ── Step 5: Summary ──
  const renderStep5 = () => {
    const answers = formData.dynamicAnswers;
    const detailQuestions = getPhaseQuestions('complaint_details');
    const complainantQuestions = getPhaseQuestions('complainant').filter(q => q.fieldType !== 'section_header');
    const respondentQuestions = getPhaseQuestions('respondent').filter(q => q.fieldType !== 'section_header');

    // Helper to render dynamic person fields
    const renderPersonFields = (person: PersonInfo, questions: FormQuestion[]) => {
      const filledFields = questions.filter(q => {
        const val = person[q.id];
        return val && val.trim() !== '';
      });
      if (filledFields.length === 0) return null;

      // Group: name fields first, then remaining
      const nameIds = new Set(['givenName', 'surname', 'middleName', 'extensionName']);
      const nameFields = filledFields.filter(q => nameIds.has(q.id));
      const otherFields = filledFields.filter(q => !nameIds.has(q.id));

      return (
        <div className="text-sm space-y-1.5">
          {/* Name line */}
          {nameFields.length > 0 && (
            <p className="font-semibold text-foreground">
              {person.givenName || ''} {person.middleName ? person.middleName + ' ' : ''}{person.surname || ''}
              {person.extensionName ? ` ${person.extensionName}` : ''}
            </p>
          )}
          {/* Other fields in flex rows */}
          {otherFields.length > 0 && (
            <>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                {otherFields.slice(0, 4).map(q => (
                  <span key={q.id} className="flex items-center gap-1">
                    {q.id === 'email' && <Mail className="size-3" />}
                    {q.id === 'sex' && <User className="size-3" />}
                    {person[q.id]}
                  </span>
                ))}
              </div>
              {otherFields.length > 4 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                  {otherFields.slice(4).map(q => (
                    <span key={q.id}>{person[q.id]}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      );
    };

    // Helper to render complaint details grouped by sections
    const renderDetailSections = () => {
      const sections: { header: FormQuestion | null; fields: FormQuestion[] }[] = [];
      let currentHeader: FormQuestion | null = null;
      let currentFields: FormQuestion[] = [];

      for (const q of detailQuestions) {
        if (q.fieldType === 'section_header') {
          if (currentFields.length > 0 || currentHeader) {
            sections.push({ header: currentHeader, fields: currentFields });
          }
          currentHeader = q;
          currentFields = [];
        } else if (q.fieldType === 'file_upload') {
          // skip file upload in review
          continue;
        } else {
          currentFields.push(q);
        }
      }
      if (currentFields.length > 0 || currentHeader) {
        sections.push({ header: currentHeader, fields: currentFields });
      }

      return sections.map((section, sIdx) => (
        <div key={sIdx}>
          {section.header && (
            <div className="flex items-center gap-2 mb-3">
              <div className="size-1.5 rounded-full bg-umak-blue dark:bg-umak-gold" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-umak-blue/70 dark:text-umak-gold/70">{section.header.label}</h4>
              <div className="flex-1 h-px bg-border/50" />
            </div>
          )}
          <div className={section.fields.length <= 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'space-y-3'}>
            {section.fields.map(q => {
              const val = answers[q.id];
              // Special handling for violation type
              if (q.id === 'violationType') {
                if (!val || (val !== '__other__' && !violationTypeOtherRef.current && !val.trim())) return null;
                return (
                  <div key={q.id} className="p-3 rounded-lg bg-muted/30 border border-border/30 sm:col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">{q.label}</p>
                    <p className="text-sm font-medium">{val === '__other__' ? violationTypeOtherRef.current : val}</p>
                  </div>
                );
              }
              if (!val || val.trim() === '') return null;
              // Date formatting
              let displayVal = val;
              if (q.fieldType === 'date') {
                try { displayVal = format(new Date(val), 'MMMM d, yyyy'); } catch { /* keep raw */ }
              }
              return (
                <div key={q.id} className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">{q.label}</p>
                  <p className="text-sm font-medium whitespace-pre-wrap">{displayVal}</p>
                </div>
              );
            })}
          </div>
        </div>
      ));
    };

    return (
      <div className="animate-fade-in space-y-6">
        {/* Complainants Summary */}
        <Card className="border-border/50 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-umak-blue to-umak-blue/60" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-umak-blue/10 dark:bg-umak-gold/10 flex items-center justify-center">
                <User className="size-5 text-umak-blue dark:text-umak-gold" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-umak-blue dark:text-umak-gold">
                  Complainants
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{formData.complainants.length} person{formData.complainants.length > 1 ? 's' : ''}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {formData.complainants.map((person, idx) => (
              <div key={idx} className={`p-4 rounded-xl ${idx === 0 ? 'bg-umak-blue/5 dark:bg-umak-gold/5 border border-umak-blue/10 dark:border-umak-gold/10' : 'bg-muted/30 border border-border/30'}`}>
                <div className="flex items-start gap-3">
                  <Badge variant={idx === 0 ? 'default' : 'secondary'} className="shrink-0 mt-0.5">
                    {idx === 0 ? 'Main' : `Co-${idx}`}
                  </Badge>
                  {renderPersonFields(person, complainantQuestions)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Respondents Summary */}
        <Card className="border-border/50 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-purple-500 to-purple-500/60" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-purple-500/10 dark:bg-purple-400/10 flex items-center justify-center">
                <Users className="size-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-umak-blue dark:text-umak-gold">
                  Respondents
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{formData.respondents.length} person{formData.respondents.length > 1 ? 's' : ''}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {formData.respondents.map((person, idx) => (
              <div key={idx} className={`p-4 rounded-xl ${idx === 0 ? 'bg-purple-500/5 border border-purple-500/10' : 'bg-muted/30 border border-border/30'}`}>
                <div className="flex items-start gap-3">
                  <Badge variant={idx === 0 ? 'default' : 'secondary'} className="shrink-0 mt-0.5">
                    {idx === 0 ? 'Main' : `Co-${idx}`}
                  </Badge>
                  {renderPersonFields(person, respondentQuestions)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Complaint Details Summary */}
        <Card className="border-border/50 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-umak-blue to-umak-gold" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-umak-blue/10 dark:bg-umak-gold/10 flex items-center justify-center">
                <FileText className="size-5 text-umak-blue dark:text-umak-gold" />
              </div>
              <CardTitle className="text-lg font-semibold text-umak-blue dark:text-umak-gold">
                Complaint Details
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {renderDetailSections()}
          </CardContent>
        </Card>

        {/* Supporting Evidence Summary */}
        {formData.files.length > 0 && (
          <Card className="border-border/50 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-teal-500 to-teal-400" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                  <Paperclip className="size-5 text-teal-600 dark:text-teal-400" />
                </div>
                <CardTitle className="text-lg font-semibold text-umak-blue dark:text-umak-gold">
                  Supporting Evidence
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {formData.files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/30"
                  >
                    {file.status === 'uploaded' ? (
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    ) : file.status === 'error' ? (
                      <X className="size-4 text-destructive shrink-0" />
                    ) : (
                      <Clock className="size-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm truncate">{file.name}</span>
                    {file.status === 'uploaded' && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 shrink-0 ml-auto">
                        Uploaded
                      </span>
                    )}
                    {file.status === 'error' && (
                      <span className="text-xs text-destructive shrink-0 ml-auto">
                        Failed
                      </span>
                    )}
                    {file.status === 'uploading' && (
                      <span className="text-xs text-primary shrink-0 ml-auto">
                        Uploading...
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Certification */}
        <div className="flex items-start gap-3 p-5 rounded-xl border-2 border-umak-blue/20 dark:border-umak-gold/20 bg-umak-blue/5 dark:bg-umak-gold/5">
          <Checkbox
            id="certify"
            checked={certified}
            onCheckedChange={(checked) => setCertified(checked === true)}
            className="mt-0.5 size-5"
          />
          <Label htmlFor="certify" className="text-sm font-semibold leading-relaxed cursor-pointer text-foreground">
            I HEREBY CERTIFY THE INFORMATION PROVIDED IS TRUE AND CORRECT
          </Label>
        </div>

        {errors.submit && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive font-medium">{errors.submit}</p>
          </div>
        )}

        <div className="flex justify-between mt-6">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleBack} className="min-w-[100px]">
              <ChevronLeft className="size-4 mr-1" />
              BACK
            </Button>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(true)}
              className="min-w-[100px]"
            >
              CANCEL
            </Button>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!certified || isSubmitting}
            className="min-w-[160px] bg-umak-blue hover:bg-umak-blue-hover text-white font-semibold disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Filing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-4" />
                FILE COMPLAINT
              </span>
            )}
          </Button>
        </div>
      </div>
    );
  };

  // ── Step 6: Success ──
  const renderStep6 = () => (
    <div className="animate-fade-in">
      <div className="gradient-dark rounded-2xl p-8 sm:p-12 text-center relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(245,197,24,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.04),transparent_50%)]" />

        <div className="relative">
          {/* Animated checkmark */}
          <div className="mb-6 animate-fade-in">
            <div className="mx-auto size-28 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center mb-2">
              <div className="size-20 rounded-full bg-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="size-12 text-emerald-400" />
              </div>
            </div>
            <div className="flex justify-center gap-2 mb-4">
              <PartyPopper className="size-5 text-umak-gold animate-bounce" style={{ animationDelay: '0ms' }} />
              <PartyPopper className="size-5 text-umak-gold animate-bounce" style={{ animationDelay: '300ms', transform: 'scaleX(-1)' }} />
            </div>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Complaint Filed!
          </h2>
          <p className="text-white/70 text-base sm:text-lg max-w-md mx-auto">
            Please wait for CSFD Staff to evaluate your complaint.
          </p>

          <div className="max-w-sm mx-auto mb-8 mt-8">
            <TrackableCard
              requestNumber={submitResult!.complaintNumber}
              trackingToken={submitResult!.trackingToken}
              type="complaint"
            />
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-8 max-w-md mx-auto">
            <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200 text-left">
              Save your tracking token! You will need it to check your complaint status.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              size="lg"
              className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy font-semibold"
            >
              <Link href="/track">Track My Complaint</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // Loading state
  if (configLoading) {
    return (
      <ServiceUnavailableOverlay serviceKey="COMPLAINT">
        <div className="min-h-screen flex flex-col">
          <OfficeHoursBanner />
          <section className="relative overflow-hidden gradient-primary text-white">
            <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
              <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-white/10 border border-white/20 mb-5">
                <Scale className="size-8 text-umak-gold" />
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3">
                FILE A COMPLAINT
              </h1>
            </div>
          </section>
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-8 text-umak-blue dark:text-umak-gold animate-spin" />
              <p className="text-sm text-muted-foreground">Loading complaint form...</p>
            </div>
          </div>
        </div>
      </ServiceUnavailableOverlay>
    );
  }

  // Config load error fallback
  if (!formConfig) {
    return (
      <ServiceUnavailableOverlay serviceKey="COMPLAINT">
        <div className="min-h-screen flex flex-col">
          <OfficeHoursBanner />
          <section className="relative overflow-hidden gradient-primary text-white">
            <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
              <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-white/10 border border-white/20 mb-5">
                <Scale className="size-8 text-umak-gold" />
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3">
                FILE A COMPLAINT
              </h1>
            </div>
          </section>
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="text-center">
              <AlertTriangle className="size-12 text-amber-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Unable to load complaint form</h2>
              <p className="text-sm text-muted-foreground mb-4">Please try again later or contact CSFD office.</p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </ServiceUnavailableOverlay>
    );
  }

  return (
    <ServiceUnavailableOverlay serviceKey="COMPLAINT">
    <div className="min-h-screen flex flex-col">
      <OfficeHoursBanner />

      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-primary text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(245,197,24,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.04),transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-white/10 border border-white/20 mb-5 animate-fade-in">
            <Scale className="size-8 text-umak-gold" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3 animate-fade-in">
            FILE A COMPLAINT
          </h1>
          <p className="text-white/70 text-base sm:text-lg max-w-xl mx-auto animate-fade-in">
            Submit your complaint to the Center for Student Formation and Development (CSFD) office. All information is handled with confidentiality.
          </p>
        </div>
      </section>

      <div className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          {/* Visual Step Indicator (Stepper) */}
          {step < 6 && (
            <div className="mb-8">
              {/* Desktop stepper */}
              <div className="hidden sm:flex items-center justify-between relative px-2">
                {STEP_LABELS.slice(0, 5).map((label, idx) => {
                  const Icon = STEP_ICONS[idx];
                  const isCompleted = idx + 1 < step;
                  const isCurrent = idx + 1 === step;
                  const isUpcoming = idx + 1 > step;
                  return (
                    <div key={idx} className="flex flex-col items-center relative z-10 flex-1">
                      {/* Connecting line before the step */}
                      {idx > 0 && (
                        <div className="absolute top-5 -left-1/2 w-full h-[3px] rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ease-out ${
                              isCompleted
                                ? 'w-full bg-emerald-500 dark:bg-emerald-400'
                                : idx + 1 === step
                                  ? 'w-1/2 bg-gradient-to-r from-emerald-500 to-umak-blue dark:to-umak-gold'
                                  : 'w-0 bg-muted-foreground/20'
                            }`}
                          />
                          <div className={`absolute inset-0 h-full ${isCompleted || idx + 1 === step ? 'bg-muted-foreground/15' : 'bg-muted-foreground/15'}`} />
                        </div>
                      )}
                      {/* Step circle with number */}
                      <div className="relative">
                        <div
                          className={`size-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ease-out ${
                            isCompleted
                              ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20'
                              : isCurrent
                                ? 'bg-umak-blue dark:bg-umak-gold border-umak-blue dark:border-umak-gold text-white shadow-lg shadow-umak-blue/30 dark:shadow-umak-gold/30 scale-110 ring-4 ring-umak-blue/10 dark:ring-umak-gold/10'
                                : 'bg-card border-muted-foreground/20 text-muted-foreground/60'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="size-5" />
                          ) : (
                            <span className="text-sm font-bold">{idx + 1}</span>
                          )}
                        </div>
                        {/* Pulse animation on active step */}
                        {isCurrent && (
                          <div className="absolute inset-0 size-10 rounded-full border-2 border-umak-blue/30 dark:border-umak-gold/30 animate-ping opacity-20" />
                        )}
                      </div>
                      {/* Step label */}
                      <span
                        className={`mt-2.5 text-[11px] font-medium text-center leading-tight max-w-[90px] transition-colors duration-300 ${
                          isCompleted
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isCurrent
                              ? 'text-umak-blue dark:text-umak-gold font-bold'
                              : 'text-muted-foreground/50'
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Mobile stepper (compact) */}
              <div className="sm:hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="size-9 rounded-full bg-umak-blue dark:bg-umak-gold flex items-center justify-center shadow-md shadow-umak-blue/20 dark:shadow-umak-gold/20">
                        <span className="text-sm font-bold text-white">{step}</span>
                      </div>
                      <div className="absolute inset-0 size-9 rounded-full border-2 border-umak-blue/20 dark:border-umak-gold/20 animate-ping opacity-30" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-umak-blue dark:text-umak-gold block leading-tight">
                        {STEP_LABELS[step - 1]}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        Step {step} of 5
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-umak-blue dark:text-umak-gold">
                    {Math.round((step / 5) * 100)}%
                  </span>
                </div>
                <div className="relative">
                  <Progress value={(step / 5) * 100} className="h-2.5 bg-muted-foreground/10 [&>[data-slot=indicator]]:bg-gradient-to-r [&>[data-slot=indicator]]:from-umak-blue [&>[data-slot=indicator]]:to-umak-gold dark:[&>[data-slot=indicator]]:from-umak-gold dark:[&>[data-slot=indicator]]:to-umak-blue" />
                </div>
                <div className="flex justify-between mt-2.5 px-1">
                  {STEP_LABELS.slice(0, 5).map((_, idx) => (
                    <div
                      key={idx}
                      className={`size-2.5 rounded-full transition-all duration-300 ${
                        idx + 1 < step
                          ? 'bg-emerald-500 dark:bg-emerald-400 scale-100'
                          : idx + 1 === step
                            ? 'bg-umak-blue dark:bg-umak-gold scale-125 shadow-sm shadow-umak-blue/30 dark:shadow-umak-gold/30'
                            : 'bg-muted-foreground/20 scale-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step Content */}
          {step === 1 && renderStep1()}
          {step === 2 && renderPersonStep(
            'complainant',
            formData.complainants,
            updateComplainantField,
            handleComplainantOtherChange,
            addComplainant,
            removeComplainant,
          )}
          {step === 3 && renderPersonStep(
            'respondent',
            formData.respondents,
            updateRespondentField,
            handleRespondentOtherChange,
            addRespondent,
            removeRespondent,
          )}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
          {step === 6 && renderStep6()}
        </div>
      </div>

      {/* Cancel Modal */}
      <CancelModal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onConfirm={handleCancelConfirm}
      />
    </div>
    </ServiceUnavailableOverlay>
  );
}
