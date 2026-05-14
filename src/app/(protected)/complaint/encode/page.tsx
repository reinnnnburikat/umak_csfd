'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  X,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

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

import { FileUpload, UploadedFile } from '@/components/shared/file-upload';
import { ViolationTypeDropdown } from '@/components/shared/violation-type-dropdown';
import { TrackableCard } from '@/components/shared/trackable-card';

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

// ── Constants ──
const STUDENT_NUMBER_REGEX = /^[A-Za-z]\d+$/;

const STEP_LABELS = [
  'Complainant Info',
  'Respondent Info',
  'Complaint Details',
  'Review',
];
const TOTAL_STEPS = 4;

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

  switch (question.fieldType) {
    case 'section_header':
      return (
        <div className="mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-umak-blue dark:text-umak-gold mb-3">
            {question.label}
          </h4>
        </div>
      );

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
            <SelectTrigger className={`w-full ${question.label === 'College/Institute' ? 'overflow-hidden' : ''}`} id={fieldId}>
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
                className="w-full justify-start text-left font-normal"
                id={fieldId}
              >
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
          />
        </div>
      );
  }
}

// ── Dynamic Person Form Component ──
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
    <div className="space-y-4">
      {questions.map((q) => {
        if (q.fieldType === 'section_header') {
          return <DynamicField key={q.id} question={q} value="" onChange={() => {}} dynamicChoices={null} />;
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
export default function EncodeComplaintPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<ComplaintFormData>({ ...defaultFormData, dynamicAnswers: {} });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [certified, setCertified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Check if a phase allows multiple persons
  const getPhaseAllowMultiple = useCallback((phase: string): boolean => {
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

    if (stepNum === 1) {
      const questions = getPhaseQuestions('complainant').filter(q => q.fieldType !== 'section_header');
      return validatePersonPhase(formData.complainants, questions, 'complainant');
    }
    if (stepNum === 2) {
      const questions = getPhaseQuestions('respondent').filter(q => q.fieldType !== 'section_header');
      return validatePersonPhase(formData.respondents, questions, 'respondent');
    }
    if (stepNum === 3) {
      const questions = getPhaseQuestions('complaint_details');
      return validateDetailsPhase(questions);
    }
    return true;
  }, [formData.complainants, formData.respondents, formData.dynamicAnswers, getPhaseQuestions, validatePersonPhase, validateDetailsPhase]);

  const handleNext = useCallback(() => {
    if (step >= 1 && step <= 3) {
      if (!validateStep(step)) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }
    if (step === 4 && !certified) return;
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
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

      // Process complainants (no toTitleCase for admin)
      const processedComplainants = formData.complainants.map((p, i) => {
        const ciOther = p.collegeInstitute === 'Other' && collegeInstituteOtherMapRef.current[`complainant-${i}`]?.trim()
          ? collegeInstituteOtherMapRef.current[`complainant-${i}`].trim()
          : (p.collegeInstitute || '');
        return {
          givenName: p.givenName || '',
          surname: p.surname || '',
          middleName: p.middleName || '',
          extensionName: p.extensionName || '',
          sex: p.sex || '',
          studentNumber: p.studentNumber || '',
          collegeInstitute: ciOther,
          email: p.email || '',
          yearLevel: p.yearLevel || '',
        };
      });

      // Process respondents (no toTitleCase for admin)
      const processedRespondents = formData.respondents.map((p, i) => {
        const ciOther = p.collegeInstitute === 'Other' && collegeInstituteOtherMapRef.current[`respondent-${i}`]?.trim()
          ? collegeInstituteOtherMapRef.current[`respondent-${i}`].trim()
          : (p.collegeInstitute || '');
        return {
          givenName: p.givenName || '',
          surname: p.surname || '',
          middleName: p.middleName || '',
          extensionName: p.extensionName || '',
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
        source: 'walk-in',
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
      toast.success(`Walk-in complaint ${data.complaintNumber} encoded successfully!`);
      router.push('/complaints');
    } catch {
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [certified, formData, formConfig]);

  const progressValue = (step / TOTAL_STEPS) * 100;

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
    const isComplainant = phase === 'complainant';
    const allowMultiple = getPhaseAllowMultiple(phase);
    const personsList = persons.length > 0 ? persons : [{}];
    const mainLabel = isComplainant ? 'MAIN COMPLAINANT' : 'MAIN RESPONDENT';
    const coLabel = isComplainant ? 'CO-COMPLAINANT' : 'CO-RESPONDENT';
    const addLabel = isComplainant ? 'Add complainant' : 'Add respondent';

    return (
      <div className="animate-fade-in space-y-6">
        {/* Main person card */}
        {personsList[0] !== undefined && (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-umak-blue dark:text-umak-gold">
                {mainLabel}
              </CardTitle>
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

        {/* Additional persons */}
        {personsList.slice(1).map((person, idx) => {
          const actualIdx = idx + 1;
          return (
            <Card key={actualIdx} className="border-border/50 relative">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-semibold text-muted-foreground">
                  {coLabel} {idx + 1}
                </CardTitle>
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
          <Button
            variant="outline"
            onClick={addPerson}
            className="w-full border-dashed"
          >
            <Plus className="size-4 mr-2" />
            {addLabel}
          </Button>
        )}

        {Object.keys(errors).length > 0 && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-1">
            <p className="text-sm text-destructive font-medium">
              Please fix the following errors:
            </p>
            {Object.entries(errors).filter(([k]) => k !== 'submit').map(([key, msg]) => (
              <p key={key} className="text-xs text-destructive/80">• {msg}</p>
            ))}
          </div>
        )}

        <div className="flex justify-center gap-4 mt-6">
          <Button type="button" variant="outline" onClick={handleBack} className="w-[140px]">
            <ChevronLeft className="size-4 mr-1" />
            BACK
          </Button>
          <Button
            type="button"
            onClick={handleNext}
            className="w-[140px] bg-umak-blue hover:bg-umak-blue-hover text-white"
          >
            PROCEED
          </Button>
        </div>
      </div>
    );
  }, [errors, getPhaseQuestions, getPhaseAllowMultiple, dynamicLists, collegeOtherErrors, handleBack, handleNext]);

  // ── Step 1: Complainant Info ──
  const renderStep1 = () => {
    if (configLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Loading form configuration...</p>
        </div>
      );
    }

    return (
      <div className="animate-fade-in space-y-6">
        {renderPersonStep(
          'complainant',
          formData.complainants,
          updateComplainantField,
          handleComplainantOtherChange,
          addComplainant,
          removeComplainant,
        )}
      </div>
    );
  };

  // ── Step 2: Respondent Info ──
  const renderStep2 = () => (
    <div className="animate-fade-in space-y-6">
      {renderPersonStep(
        'respondent',
        formData.respondents,
        updateRespondentField,
        handleRespondentOtherChange,
        addRespondent,
        removeRespondent,
      )}
    </div>
  );

  // ── Step 3: Complaint Details (dynamic) ──
  const renderStep3 = () => {
    const detailQuestions = getPhaseQuestions('complaint_details');
    const answers = formData.dynamicAnswers;
    const hasFileUpload = detailQuestions.some(q => q.fieldType === 'file_upload');

    return (
      <div className="animate-fade-in space-y-6">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-umak-blue dark:text-umak-gold">
              COMPLAINT DETAILS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {detailQuestions.map((q) => {
              if (q.fieldType === 'file_upload') return null;
              const dynamicChoices = getDynamicListType(q.choices) ? dynamicLists[getDynamicListType(q.choices)!] || null : null;
              const val = answers[q.id] || q.defaultValue || '';
              const fieldError = errors[q.id];

              return <DynamicField key={q.id} question={q} value={val} onChange={updateDynamicAnswer} error={fieldError} dynamicChoices={dynamicChoices} />;
            })}

            {/* Violation Type Dropdown (backward compat) */}
            {detailQuestions.some(q => q.id === 'violationType') && (
              <ViolationTypeDropdown
                value={answers.violationType || ''}
                onChange={(v) => updateDynamicAnswer('violationType', v)}
                otherValue={violationTypeOtherRef.current}
                onOtherChange={(v) => { violationTypeOtherRef.current = v; }}
              />
            )}

            {/* File Upload */}
            {hasFileUpload && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Supporting Documents</Label>
                <FileUpload
                  files={formData.files}
                  onFilesChange={(files) => setFormData(prev => ({ ...prev, files }))}
                  acceptedTypes=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  maxFileSize={10 * 1024 * 1024}
                  label="Supporting Documents"
                  hint="PDF, DOC, DOCX, JPG, PNG (max 10MB each)"
                />
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                  <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Upload a copy of evidence with a maximum file size of 10MB. For further evidence/s,
                    upload it through an online storage/cloud and send it through email of CSFD at{' '}
                    <a href="mailto:csfd@umak.edu.ph" className="underline font-medium">
                      csfd@umak.edu.ph
                    </a>
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {Object.keys(errors).length > 0 && !errors.submit && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-1">
            <p className="text-sm text-destructive font-medium">
              Please fix the following errors:
            </p>
            {Object.entries(errors).filter(([k]) => k !== 'submit').map(([key, msg]) => (
              <p key={key} className="text-xs text-destructive/80">• {msg}</p>
            ))}
          </div>
        )}

        <div className="flex justify-center gap-4 mt-6">
          <Button type="button" variant="outline" onClick={handleBack} className="w-[140px]">
            <ChevronLeft className="size-4 mr-1" />
            BACK
          </Button>
          <Button
            type="button"
            onClick={handleNext}
            className="w-[140px] bg-umak-blue hover:bg-umak-blue-hover text-white"
          >
            PROCEED
          </Button>
        </div>
      </div>
    );
  };

  // ── Step 4: Review & Submit ──
  const renderStep4 = () => {
    const answers = formData.dynamicAnswers;
    const detailQuestions = getPhaseQuestions('complaint_details');

    // Helper to get display value for a question
    const getDisplayValue = (q: FormQuestion): string => {
      if (q.fieldType === 'section_header' || q.fieldType === 'file_upload') return '';
      const val = answers[q.id] || '';
      if (q.id === 'violationType') {
        return val === '__other__' ? violationTypeOtherRef.current : val;
      }
      if (q.fieldType === 'date' && val) {
        try { return format(new Date(val), 'MMMM d, yyyy'); } catch { return val; }
      }
      // For dropdown/radio/checkbox, try to show label instead of value
      const listType = getDynamicListType(q.choices);
      const choices = listType ? (dynamicLists[listType] || []) : (parseChoices(q.choices) || []);
      if ((q.fieldType === 'dropdown' || q.fieldType === 'radio') && val) {
        const found = choices.find(c => c.value === val);
        if (found) return found.label;
      }
      if (q.fieldType === 'checkbox' && val) {
        const checkedValues = val.split(',').filter(Boolean);
        const labels = checkedValues.map(cv => {
          const found = choices.find(c => c.value === cv);
          return found ? found.label : cv;
        });
        return labels.join(', ');
      }
      return val;
    };

    return (
      <div className="animate-fade-in space-y-6">
        {/* Complainants */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-umak-blue dark:text-umak-gold">
              Complainants
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.complainants.map((person, idx) => (
              <div key={idx}>
                {idx > 0 && <Separator className="mb-4" />}
                <div className="flex items-start gap-2">
                  <Badge variant={idx === 0 ? 'default' : 'secondary'} className="shrink-0 mt-0.5">
                    {idx === 0 ? 'Main' : `Co-${idx}`}
                  </Badge>
                  <div className="text-sm space-y-1">
                    <p className="font-medium">
                      {person.givenName} {person.middleName ? person.middleName + ' ' : ''}{person.surname}
                      {person.extensionName ? ` ${person.extensionName}` : ''}
                    </p>
                    <p className="text-muted-foreground">
                      {person.sex} · {person.studentNumber} · {person.collegeInstitute === 'Other' && collegeInstituteOtherMapRef.current[`complainant-${idx}`]?.trim() ? collegeInstituteOtherMapRef.current[`complainant-${idx}`].trim() : person.collegeInstitute}
                    </p>
                    <p className="text-muted-foreground">
                      {person.yearLevel} · {person.email}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Respondents */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-umak-blue dark:text-umak-gold">
              Respondents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.respondents.map((person, idx) => (
              <div key={idx}>
                {idx > 0 && <Separator className="mb-4" />}
                <div className="flex items-start gap-2">
                  <Badge variant={idx === 0 ? 'default' : 'secondary'} className="shrink-0 mt-0.5">
                    {idx === 0 ? 'Main' : `Co-${idx}`}
                  </Badge>
                  <div className="text-sm space-y-1">
                    <p className="font-medium">
                      {person.givenName} {person.middleName ? person.middleName + ' ' : ''}{person.surname}
                      {person.extensionName ? ` ${person.extensionName}` : ''}
                    </p>
                    <p className="text-muted-foreground">
                      {person.sex} · {person.studentNumber} · {person.collegeInstitute === 'Other' && collegeInstituteOtherMapRef.current[`respondent-${idx}`]?.trim() ? collegeInstituteOtherMapRef.current[`respondent-${idx}`].trim() : person.collegeInstitute}
                    </p>
                    <p className="text-muted-foreground">
                      {person.yearLevel} · {person.email}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Complaint Details (dynamic review) */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-umak-blue dark:text-umak-gold">
              Complaint Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {detailQuestions.map((q) => {
              if (q.fieldType === 'section_header') {
                return (
                  <div key={q.id} className="pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-umak-blue/70 dark:text-umak-gold/70">
                      {q.label}
                    </h4>
                  </div>
                );
              }
              if (q.fieldType === 'file_upload') return null;
              const displayVal = getDisplayValue(q);
              if (!displayVal && !q.required) return null;
              return (
                <div key={q.id}>
                  <span className="text-muted-foreground">{q.label}: </span>
                  <span className={q.required ? 'font-medium' : ''}>{displayVal || '—'}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Evidence */}
        {formData.files.length > 0 && (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-umak-blue dark:text-umak-gold">
                Evidence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {formData.files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border/40"
                  >
                    <span className="text-sm truncate">{file.name}</span>
                    {file.status === 'uploaded' && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 shrink-0">(Uploaded)</span>
                    )}
                    {file.status === 'uploading' && (
                      <span className="text-xs text-primary shrink-0">(Uploading...)</span>
                    )}
                    {file.status === 'error' && (
                      <span className="text-xs text-destructive shrink-0">({file.error || 'Upload failed'})</span>
                    )}
                    {file.status === 'pending' && (
                      <span className="text-xs text-muted-foreground shrink-0">(Pending)</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Certification */}
        <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card">
          <Checkbox
            id="certify"
            checked={certified}
            onCheckedChange={(checked) => setCertified(checked === true)}
            className="mt-0.5"
          />
          <Label htmlFor="certify" className="text-sm font-medium leading-relaxed cursor-pointer">
            I HEREBY CERTIFY THE INFORMATION PROVIDED IS TRUE AND CORRECT
          </Label>
        </div>

        {errors.submit && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive font-medium">{errors.submit}</p>
          </div>
        )}

        <div className="flex justify-center gap-4 mt-6">
          <Button type="button" variant="outline" onClick={handleBack} className="w-[140px]">
            <ChevronLeft className="size-4 mr-1" />
            BACK
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!certified || isSubmitting}
            className="w-[180px] bg-umak-blue hover:bg-umak-blue-hover text-white disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Encoding...
              </span>
            ) : (
              'ENCODE COMPLAINT'
            )}
          </Button>
        </div>
      </div>
    );
  };

  // ── Loading State ──
  if (configLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
            className="mb-2 text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="size-4 mr-1" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold tracking-tight uppercase">
            Encode Walk-in Complaint
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fill out complaint details on behalf of a walk-in student.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Loading form configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard')}
          className="mb-2 text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="size-4 mr-1" />
          Back to Dashboard
        </Button>
        <h1 className="text-2xl font-bold tracking-tight uppercase">
          Encode Walk-in Complaint
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fill out complaint details on behalf of a walk-in student.
        </p>
      </div>

      {/* Progress Indicator */}
      {step <= TOTAL_STEPS && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Step {step} of {TOTAL_STEPS}
            </span>
            <span className="text-sm font-medium text-umak-blue dark:text-umak-gold">
              {STEP_LABELS[step - 1]}
            </span>
          </div>
          <Progress value={progressValue} className="h-2" />
          <div className="flex justify-between mt-2">
            {STEP_LABELS.map((label, idx) => (
              <span
                key={idx}
                className={`text-xs hidden sm:block ${
                  idx + 1 === step
                    ? 'text-umak-blue dark:text-umak-gold font-semibold'
                    : idx + 1 < step
                      ? 'text-green-600 dark:text-green-400 font-medium'
                      : 'text-muted-foreground'
                }`}
              >
                {idx + 1}. {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Step Content */}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
    </div>
  );
}
