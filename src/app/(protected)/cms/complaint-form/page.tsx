'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  User,
  Shield,
  Type,
  AlignLeft,
  List,
  CircleDot,
  CheckSquare,
  Calendar,
  Paperclip,
  Hash,
  Mail,
  Heading,
  GripVertical,
  FolderOpen,
  FolderPlus,
  ArrowRightLeft,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { ChoicesEditor } from '@/components/cms/choices-editor';

// ── Types ────────────────────────────────────────────────────────────────
interface FormSection {
  id: string;
  phase: string;
  title: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { questions: number };
}

interface FormQuestion {
  id: string;
  phase: string;
  fieldType: string;
  label: string;
  helpText: string | null;
  placeholder: string | null;
  required: boolean;
  roleTarget: string;
  sortOrder: number;
  isActive: boolean;
  choices: string | null;
  content: string | null;
  allowMultiple: boolean;
  defaultValue: string | null;
  validation: string | null;
  sectionId: string | null;
}

interface QuestionFormData {
  fieldType: string;
  label: string;
  helpText: string;
  placeholder: string;
  required: boolean;
  roleTarget: string;
  choices: string;
  content: string;
  allowMultiple: boolean;
  defaultValue: string;
  validationMin: string;
  validationMax: string;
  validationPattern: string;
  validationMessage: string;
  sectionId: string;
}

// ── Constants ────────────────────────────────────────────────────────────
const PHASES = [
  { value: 'instructions', label: 'Instructions' },
  { value: 'complainant', label: 'Complainant Info' },
  { value: 'respondent', label: 'Respondent Info' },
  { value: 'complaint_details', label: 'Complaint Details' },
] as const;

const FIELD_TYPES = [
  { value: 'section_header', label: 'Section Header' },
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'radio', label: 'Radio' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
  { value: 'file_upload', label: 'File Upload' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
] as const;

const TYPE_BADGE_COLORS: Record<string, string> = {
  section_header: 'bg-gray-500/15 text-gray-600 border-gray-500/30 dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/40',
  short_text: 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40',
  long_text: 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40',
  dropdown: 'bg-green-500/15 text-green-600 border-green-500/30 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/40',
  radio: 'bg-purple-500/15 text-purple-600 border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40',
  checkbox: 'bg-purple-500/15 text-purple-600 border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40',
  date: 'bg-orange-500/15 text-orange-600 border-orange-500/30 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/40',
  file_upload: 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40',
  number: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40',
  email: 'bg-teal-500/15 text-teal-600 border-teal-500/30 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/40',
};

const EMPTY_FORM: QuestionFormData = {
  fieldType: 'short_text',
  label: '',
  helpText: '',
  placeholder: '',
  required: false,
  roleTarget: 'both',
  choices: '',
  content: '',
  allowMultiple: false,
  defaultValue: '',
  validationMin: '',
  validationMax: '',
  validationPattern: '',
  validationMessage: '',
  sectionId: '',
};

// ── Helpers ──────────────────────────────────────────────────────────────
function formatFieldType(type: string): string {
  const map: Record<string, string> = {
    section_header: 'Section Header',
    short_text: 'Short Text',
    long_text: 'Long Text',
    dropdown: 'Dropdown',
    radio: 'Radio',
    checkbox: 'Checkbox',
    date: 'Date',
    file_upload: 'File Upload',
    number: 'Number',
    email: 'Email',
  };
  return map[type] || type;
}

function getFieldIcon(type: string) {
  switch (type) {
    case 'section_header': return <Heading className="size-4" />;
    case 'short_text': return <Type className="size-4" />;
    case 'long_text': return <AlignLeft className="size-4" />;
    case 'dropdown': return <List className="size-4" />;
    case 'radio': return <CircleDot className="size-4" />;
    case 'checkbox': return <CheckSquare className="size-4" />;
    case 'date': return <Calendar className="size-4" />;
    case 'file_upload': return <Paperclip className="size-4" />;
    case 'number': return <Hash className="size-4" />;
    case 'email': return <Mail className="size-4" />;
    default: return <Type className="size-4" />;
  }
}

function renderFieldPreview(q: FormQuestion) {
  const baseClass = 'w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground';
  switch (q.fieldType) {
    case 'section_header':
      return (
        <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-3">
          <p className="text-sm text-muted-foreground/80 italic">
            {q.content || 'Section header content will appear here...'}
          </p>
        </div>
      );
    case 'short_text':
      return (
        <div className={baseClass}>
          {q.placeholder ? (
            <span className="text-muted-foreground/50 italic">{q.placeholder}</span>
          ) : (
            <span className="text-muted-foreground/30 italic">Text input...</span>
          )}
        </div>
      );
    case 'long_text':
      return (
        <div className={`${baseClass} min-h-[60px]`}>
          {q.placeholder ? (
            <span className="text-muted-foreground/50 italic">{q.placeholder}</span>
          ) : (
            <span className="text-muted-foreground/30 italic">Long text area...</span>
          )}
        </div>
      );
    case 'dropdown': {
      let choices: string[] = ['Option 1', 'Option 2', 'Option 3'];
      try {
        if (q.choices) {
          const parsed = JSON.parse(q.choices);
          if (Array.isArray(parsed)) {
            choices = parsed.map((c: unknown) =>
              typeof c === 'object' && c !== null && 'label' in c
                ? String((c as { label: unknown }).label)
                : String(c)
            );
          } else if (typeof parsed === 'string') {
            choices = [parsed];
          }
        }
      } catch {
        choices = q.choices ? [q.choices] : choices;
      }
      return (
        <div className={`${baseClass} flex items-center justify-between`}>
          <span className="text-muted-foreground/50 italic">{choices[0] || 'Select...'}</span>
          <span className="text-xs text-muted-foreground/40">▼</span>
        </div>
      );
    }
    case 'radio': {
      let choices: string[] = ['Option A', 'Option B', 'Option C'];
      try {
        if (q.choices) {
          const parsed = JSON.parse(q.choices);
          if (Array.isArray(parsed)) {
            choices = parsed.map((c: unknown) =>
              typeof c === 'object' && c !== null && 'label' in c
                ? String((c as { label: unknown }).label)
                : String(c)
            );
          } else if (typeof parsed === 'string') {
            choices = [parsed];
          }
        }
      } catch {
        choices = q.choices ? [q.choices] : choices;
      }
      return (
        <div className="space-y-2 px-1 py-1">
          {choices.slice(0, 3).map((choice, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="size-4 rounded-full border border-muted-foreground/40" />
              <span className="text-sm text-muted-foreground/60">{choice}</span>
            </div>
          ))}
          {choices.length > 3 && (
            <span className="text-xs text-muted-foreground/40 pl-6">+{choices.length - 3} more options</span>
          )}
        </div>
      );
    }
    case 'checkbox': {
      let choices: string[] = ['Option A', 'Option B', 'Option C'];
      try {
        if (q.choices) {
          const parsed = JSON.parse(q.choices);
          if (Array.isArray(parsed)) {
            choices = parsed.map((c: unknown) =>
              typeof c === 'object' && c !== null && 'label' in c
                ? String((c as { label: unknown }).label)
                : String(c)
            );
          } else if (typeof parsed === 'string') {
            choices = [parsed];
          }
        }
      } catch {
        choices = q.choices ? [q.choices] : choices;
      }
      return (
        <div className="space-y-2 px-1 py-1">
          {choices.slice(0, 3).map((choice, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="size-4 rounded border border-muted-foreground/40" />
              <span className="text-sm text-muted-foreground/60">{choice}</span>
            </div>
          ))}
          {choices.length > 3 && (
            <span className="text-xs text-muted-foreground/40 pl-6">+{choices.length - 3} more options</span>
          )}
        </div>
      );
    }
    case 'date':
      return (
        <div className={`${baseClass} flex items-center gap-2`}>
          <Calendar className="size-3.5 text-muted-foreground/40" />
          <span className="text-muted-foreground/50 italic">MM/DD/YYYY</span>
        </div>
      );
    case 'file_upload':
      return (
        <div className="rounded-md border-2 border-dashed border-muted-foreground/25 bg-muted/20 px-4 py-6 text-center">
          <Paperclip className="size-5 mx-auto text-muted-foreground/30 mb-1.5" />
          <p className="text-xs text-muted-foreground/50">Click or drag to upload file</p>
        </div>
      );
    case 'number':
      return (
        <div className={baseClass}>
          <span className="text-muted-foreground/30 italic">0</span>
        </div>
      );
    case 'email':
      return (
        <div className={baseClass}>
          <span className="text-muted-foreground/30 italic">email@example.com</span>
        </div>
      );
    default:
      return <div className={baseClass}><span className="text-muted-foreground/30 italic">Input field...</span></div>;
  }
}

function buildValidationPayload(form: QuestionFormData): string | null {
  const hasValidation = form.validationMin || form.validationMax || form.validationPattern || form.validationMessage;
  if (!hasValidation) return null;
  const obj: Record<string, string> = {};
  if (form.validationMin) obj.min = form.validationMin;
  if (form.validationMax) obj.max = form.validationMax;
  if (form.validationPattern) obj.pattern = form.validationPattern;
  if (form.validationMessage) obj.customMessage = form.validationMessage;
  return JSON.stringify(obj);
}

function parseValidation(validation: string | null): Partial<Pick<QuestionFormData, 'validationMin' | 'validationMax' | 'validationPattern' | 'validationMessage'>> {
  if (!validation) return {};
  try {
    const parsed = JSON.parse(validation);
    return {
      validationMin: parsed.min || '',
      validationMax: parsed.max || '',
      validationPattern: parsed.pattern || '',
      validationMessage: parsed.customMessage || '',
    };
  } catch {
    return {};
  }
}

// parseChoices removed — ChoicesEditor handles raw choices value directly

// ── Component ────────────────────────────────────────────────────────────
export default function ComplaintFormBuilderPage() {
  const [activeTab, setActiveTab] = useState('instructions');
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<FormQuestion | null>(null);
  const [form, setForm] = useState<QuestionFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Section state ─────────────────────────────────────────────────────
  const [sections, setSections] = useState<FormSection[]>([]);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<FormSection | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionDesc, setNewSectionDesc] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // ── Fetch questions ──────────────────────────────────────────────────
  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/form-questions?phase=${activeTab}`);
      if (res.ok) {
        const json = await res.json();
        setQuestions(json.data || []);
      } else {
        toast.error('Failed to load questions');
      }
    } catch {
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // ── Fetch sections ───────────────────────────────────────────────────
  const fetchSections = useCallback(async () => {
    try {
      setSectionLoading(true);
      const res = await fetch('/api/form-sections?phase=complaint_details');
      if (res.ok) {
        const json = await res.json();
        const sectionData: FormSection[] = json.data || [];
        setSections(sectionData);
        // Expand all sections by default
        setExpandedSections(new Set(sectionData.map(s => s.id)));
      } else {
        toast.error('Failed to load sections');
      }
    } catch {
      toast.error('Failed to load sections');
    } finally {
      setSectionLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  useEffect(() => {
    if (activeTab === 'complaint_details') {
      fetchSections();
    }
  }, [activeTab, fetchSections]);

  // ── Section toggle expand ────────────────────────────────────────────
  const toggleSectionExpand = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // ── Section CRUD ─────────────────────────────────────────────────────
  const handleOpenAddSection = (preFillSectionId?: string) => {
    setEditingSection(null);
    setNewSectionTitle('');
    setNewSectionDesc('');
    setSectionDialogOpen(true);
  };

  const handleOpenEditSection = (section: FormSection) => {
    setEditingSection(section);
    setNewSectionTitle(section.title);
    setNewSectionDesc(section.description || '');
    setSectionDialogOpen(true);
  };

  const handleSaveSection = async () => {
    if (!newSectionTitle.trim()) {
      toast.error('Section title is required');
      return;
    }

    try {
      if (editingSection) {
        // Update
        const res = await fetch('/api/form-sections', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingSection.id,
            title: newSectionTitle.trim(),
            description: newSectionDesc.trim() || null,
          }),
        });
        if (!res.ok) throw new Error('Failed to update section');
        toast.success('Section updated successfully');
      } else {
        // Create
        const res = await fetch('/api/form-sections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phase: 'complaint_details',
            title: newSectionTitle.trim(),
            description: newSectionDesc.trim() || null,
            sortOrder: sections.length,
          }),
        });
        if (!res.ok) throw new Error('Failed to create section');
        toast.success('Section created successfully');
      }

      setSectionDialogOpen(false);
      fetchSections();
      fetchQuestions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save section');
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    try {
      const res = await fetch('/api/form-sections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sectionId }),
      });
      if (!res.ok) throw new Error('Failed to delete section');
      toast.success('Section deleted successfully');
      fetchSections();
      fetchQuestions();
    } catch {
      toast.error('Failed to delete section');
    }
  };

  const handleToggleSectionActive = async (section: FormSection) => {
    try {
      const res = await fetch('/api/form-sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: section.id, isActive: !section.isActive }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Section ${section.isActive ? 'deactivated' : 'activated'} successfully`);
      fetchSections();
    } catch {
      toast.error('Failed to toggle section status');
    }
  };

  const handleReorderSection = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;

    const reordered = [...sections];
    const temp = reordered[index];
    reordered[index] = reordered[newIndex];
    reordered[newIndex] = temp;

    // Optimistic update
    setSections(reordered);

    try {
      // Update sortOrder for each section
      for (let i = 0; i < reordered.length; i++) {
        await fetch('/api/form-sections', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: reordered[i].id, sortOrder: i }),
        });
      }
    } catch {
      toast.error('Failed to reorder sections');
      fetchSections();
    }
  };

  // ── Move question to section ─────────────────────────────────────────
  const handleMoveQuestionToSection = async (questionId: string, targetSectionId: string | null) => {
    try {
      const res = await fetch('/api/form-questions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: questionId,
          sectionId: targetSectionId || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(targetSectionId ? 'Question moved to section' : 'Question moved to unsectioned');
      fetchQuestions();
      fetchSections();
    } catch {
      toast.error('Failed to move question');
    }
  };

  // ── Reorder questions within a section ───────────────────────────────
  const handleReorderInSection = async (sectionQuestions: FormQuestion[], index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sectionQuestions.length) return;

    const reordered = [...sectionQuestions];
    const temp = reordered[index];
    reordered[index] = reordered[newIndex];
    reordered[newIndex] = temp;

    // Optimistic update
    setQuestions(prev => {
      const inSectionIds = new Set(reordered.map(q => q.id));
      return [
        ...prev.filter(q => !inSectionIds.has(q.id)),
        ...reordered,
      ];
    });

    try {
      const questionIds = reordered.map(q => q.id);
      const res = await fetch('/api/form-questions/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: activeTab, questionIds }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error('Failed to reorder questions');
      fetchQuestions();
    }
  };

  // ── Show Add dialog ──────────────────────────────────────────────────
  const handleOpenAdd = (preFillSectionId?: string) => {
    setEditingQuestion(null);
    setForm({
      ...EMPTY_FORM,
      sectionId: preFillSectionId || '',
    });
    setDialogOpen(true);
  };

  // ── Show Add Section dialog (pre-filled as section_header) ──────────
  const handleOpenAddSectionHeader = () => {
    setEditingQuestion(null);
    setForm({
      ...EMPTY_FORM,
      fieldType: 'section_header',
      label: 'New Section',
      content: '',
    });
    setDialogOpen(true);
  };

  // ── Show Edit dialog ─────────────────────────────────────────────────
  const handleOpenEdit = (q: FormQuestion) => {
    setEditingQuestion(q);
    const parsedValidation = parseValidation(q.validation);
    setForm({
      fieldType: q.fieldType,
      label: q.label,
      helpText: q.helpText || '',
      placeholder: q.placeholder || '',
      required: q.required,
      roleTarget: q.roleTarget || 'both',
      choices: q.choices || '',
      content: q.content || '',
      allowMultiple: q.allowMultiple,
      defaultValue: q.defaultValue || '',
      sectionId: q.sectionId || '',
      ...parsedValidation,
    });
    setDialogOpen(true);
  };

  // ── Save (Add or Edit) ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.label.trim()) {
      toast.error('Label is required');
      return;
    }

    setSaving(true);
    try {
      // ChoicesEditor returns raw value: JSON array for static, 'dynamic:xxx' for shared lists
      const choicesValue = (['dropdown', 'radio', 'checkbox'].includes(form.fieldType) && form.choices.trim())
        ? form.choices.trim()
        : null;

      const payload: Record<string, unknown> = {
        phase: activeTab,
        fieldType: form.fieldType,
        label: form.label.trim(),
        helpText: form.helpText.trim() || null,
        placeholder: form.placeholder.trim() || null,
        required: form.required,
        roleTarget: form.roleTarget,
        sortOrder: editingQuestion ? editingQuestion.sortOrder : questions.length,
        choices: choicesValue,
        content: form.content.trim() || null,
        allowMultiple: form.allowMultiple,
        defaultValue: form.defaultValue.trim() || null,
        validation: buildValidationPayload(form),
      };

      // Include sectionId for complaint_details phase
      if (activeTab === 'complaint_details') {
        payload.sectionId = form.sectionId || null;
      }

      let res: Response;
      if (editingQuestion) {
        res = await fetch('/api/form-questions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingQuestion.id, ...payload }),
        });
      } else {
        res = await fetch('/api/form-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to save question');
      }

      toast.success(editingQuestion ? 'Question updated successfully' : 'Question added successfully');
      setDialogOpen(false);
      fetchQuestions();
      if (activeTab === 'complaint_details') fetchSections();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active/inactive ───────────────────────────────────────────
  const handleToggleActive = async (q: FormQuestion) => {
    try {
      const res = await fetch('/api/form-questions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: q.id, isActive: !q.isActive }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Question ${q.isActive ? 'deactivated' : 'activated'} successfully`);
      fetchQuestions();
    } catch {
      toast.error('Failed to toggle status');
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch('/api/form-questions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteId }),
      });
      if (!res.ok) throw new Error();
      toast.success('Question deleted successfully');
      fetchQuestions();
      if (activeTab === 'complaint_details') fetchSections();
    } catch {
      toast.error('Failed to delete question');
    } finally {
      setDeleteId(null);
    }
  };

  // ── Reorder (up/down) — for instructions and unsectioned ────────────
  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;

    const reordered = [...questions];
    const temp = reordered[index];
    reordered[index] = reordered[newIndex];
    reordered[newIndex] = temp;

    // Optimistic update
    setQuestions(reordered);

    try {
      const questionIds = reordered.map(q => q.id);
      const res = await fetch('/api/form-questions/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: activeTab, questionIds }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error('Failed to reorder questions');
      fetchQuestions(); // Revert
    }
  };

  // ── Derived data for complaint_details ───────────────────────────────
  const unsectionedQuestions = useMemo(() =>
    questions.filter(q => !q.sectionId),
    [questions],
  );

  const questionsBySection = useMemo(() => {
    const map: Record<string, FormQuestion[]> = {};
    for (const q of questions) {
      if (q.sectionId) {
        if (!map[q.sectionId]) map[q.sectionId] = [];
        map[q.sectionId].push(q);
      }
    }
    return map;
  }, [questions]);

  // ── Determine which fields to show ───────────────────────────────────
  const showPlaceholder = ['short_text', 'long_text', 'number', 'email'].includes(form.fieldType);
  const showChoices = ['dropdown', 'radio', 'checkbox'].includes(form.fieldType);
  const showContent = form.fieldType === 'section_header';
  const showRoleTarget = ['complainant', 'respondent'].includes(activeTab);

  // ── Current phase meta ───────────────────────────────────────────────
  const currentPhase = PHASES.find(p => p.value === activeTab);

  // ── Render compact question row (inside section) ─────────────────────
  const renderCompactQuestionRow = (q: FormQuestion, index: number, siblings: FormQuestion[]) => (
    <div
      key={q.id}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-muted/40 transition-colors group ${!q.isActive ? 'opacity-50' : ''}`}
    >
      {/* Reorder within section */}
      <div className="flex flex-col gap-0.5 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="size-5 text-muted-foreground/40"
          onClick={() => handleReorderInSection(siblings, index, 'up')}
          disabled={index === 0}
        >
          <ChevronUp className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-5 text-muted-foreground/40"
          onClick={() => handleReorderInSection(siblings, index, 'down')}
          disabled={index === siblings.length - 1}
        >
          <ChevronDown className="size-3" />
        </Button>
      </div>

      <GripVertical className="size-3.5 text-muted-foreground/30 shrink-0" />

      {/* Type icon + badge */}
      <div className={`flex items-center gap-1.5 rounded-md px-2 py-0.5 shrink-0 ${TYPE_BADGE_COLORS[q.fieldType] || ''}`}>
        {getFieldIcon(q.fieldType)}
        <span className="text-[10px] font-medium">{formatFieldType(q.fieldType)}</span>
      </div>

      {/* Label */}
      <div className="flex items-center gap-1 min-w-0 flex-1">
        <span className="text-sm font-medium truncate">{q.label}</span>
        {q.required && <span className="text-red-500 dark:text-red-400 shrink-0">*</span>}
      </div>

      {/* Move to section dropdown */}
      <Select
        value={q.sectionId || '__none__'}
        onValueChange={(val) => handleMoveQuestionToSection(q.id, val === '__none__' ? null : val)}
      >
        <SelectTrigger className="w-[130px] h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
          <FolderOpen className="size-3 mr-1 shrink-0" />
          <SelectValue placeholder="Move to..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">No Section</SelectItem>
          {sections.map(s => (
            <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Switch
          checked={q.isActive}
          onCheckedChange={() => handleToggleActive(q)}
          className="scale-[0.75]"
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => handleOpenEdit(q)}
          title="Edit"
        >
          <Pencil className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => setDeleteId(q.id)}
          title="Delete"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );

  // ── Render sectionized view ──────────────────────────────────────────
  const renderSectionizedView = () => {
    if (loading || sectionLoading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      );
    }

    const hasContent = questions.length > 0 || sections.length > 0;

    if (!hasContent) {
      return (
        <Card className="glass border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <FolderOpen className="size-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No sections or questions yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Click &quot;Add Section&quot; to organize your complaint details</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {/* Unsectioned questions */}
        {unsectionedQuestions.length > 0 && (
          <div className="border border-border/50 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border/50">
              <div className="flex items-center gap-2">
                <FolderOpen className="size-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-muted-foreground">Unsectioned Questions</span>
                <Badge variant="secondary" className="text-xs ml-1">{unsectionedQuestions.length}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => handleOpenAdd()}
              >
                <Plus className="size-3" />
                Add Question
              </Button>
            </div>
            <div className="divide-y divide-border/30 p-1">
              {unsectionedQuestions.map((q, idx) =>
                renderCompactQuestionRow(q, idx, unsectionedQuestions)
              )}
            </div>
          </div>
        )}

        {/* Sections */}
        {sections.sort((a, b) => a.sortOrder - b.sortOrder).map((section, sectionIndex) => {
          const sectionQuestions = (questionsBySection[section.id] || []).sort(
            (a, b) => a.sortOrder - b.sortOrder
          );
          const isExpanded = expandedSections.has(section.id);

          return (
            <Collapsible
              key={section.id}
              open={isExpanded}
              onOpenChange={() => toggleSectionExpand(section.id)}
            >
              <div className={`border rounded-xl overflow-hidden transition-all ${!section.isActive ? 'opacity-60' : 'border-border/50'}`}>
                {/* Gradient top border */}
                <div className="h-0.5 bg-gradient-to-r from-umak-gold/60 via-umak-gold/30 to-transparent" />

                {/* Section header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-card">
                  {/* Expand toggle */}
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7 shrink-0">
                      <ChevronRight className={`size-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>

                  {/* Section icon + title */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FolderOpen className="size-4 text-umak-gold shrink-0" />
                    <span className="text-sm font-semibold truncate">{section.title}</span>
                    {section.description && (
                      <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[200px]">
                        — {section.description}
                      </span>
                    )}
                  </div>

                  {/* Question count badge */}
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {sectionQuestions.length} {sectionQuestions.length === 1 ? 'question' : 'questions'}
                  </Badge>

                  {/* Status badge */}
                  <Badge className={`text-[10px] shrink-0 ${section.isActive ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40' : 'bg-gray-500/15 text-gray-500 border-gray-500/30 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/40'}`}>
                    {section.isActive ? 'Active' : 'Inactive'}
                  </Badge>

                  {/* Section actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* Reorder up */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={(e) => { e.stopPropagation(); handleReorderSection(sectionIndex, 'up'); }}
                      disabled={sectionIndex === 0}
                      title="Move section up"
                    >
                      <ChevronUp className="size-3.5" />
                    </Button>
                    {/* Reorder down */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={(e) => { e.stopPropagation(); handleReorderSection(sectionIndex, 'down'); }}
                      disabled={sectionIndex === sections.length - 1}
                      title="Move section down"
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                    {/* Toggle active */}
                    <Switch
                      checked={section.isActive}
                      onCheckedChange={() => handleToggleSectionActive(section)}
                      className="scale-[0.8] ml-1"
                    />
                    {/* Edit section */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={(e) => { e.stopPropagation(); handleOpenEditSection(section); }}
                      title="Edit section"
                    >
                      <Pencil className="size-3" />
                    </Button>
                    {/* Delete section */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete section "${section.title}"? Questions will become unsectioned.`)) {
                          handleDeleteSection(section.id);
                        }
                      }}
                      title="Delete section"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>

                {/* Section content — questions */}
                <CollapsibleContent>
                  <div className="border-t border-border/30">
                    {sectionQuestions.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <p className="text-xs text-muted-foreground">No questions in this section</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-xs gap-1"
                          onClick={() => handleOpenAdd(section.id)}
                        >
                          <Plus className="size-3" />
                          Add Question
                        </Button>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/20 p-1">
                        {sectionQuestions.map((q, idx) =>
                          renderCompactQuestionRow(q, idx, sectionQuestions)
                        )}
                      </div>
                    )}

                    {/* Add question button */}
                    <div className="px-4 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full border border-dashed border-muted-foreground/30 rounded-lg text-xs gap-1.5 text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                        onClick={() => handleOpenAdd(section.id)}
                      >
                        <Plus className="size-3" />
                        Add Question to &quot;{section.title}&quot;
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}

        {/* Add Section button */}
        <Button
          variant="ghost"
          className="w-full border border-dashed border-muted-foreground/30 rounded-xl py-6 gap-2 text-sm text-muted-foreground hover:text-foreground hover:border-umak-gold/50 hover:bg-umak-gold/5"
          onClick={() => handleOpenAddSection()}
        >
          <FolderPlus className="size-4" />
          Add Section
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-umak-gold/15 dark:bg-umak-gold/20 flex items-center justify-center">
            <FileText className="size-5 text-umak-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">COMPLAINT FORM BUILDER</h1>
            <p className="text-sm text-muted-foreground">Manage the questions displayed in each phase of the complaint form</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleOpenAdd()}
            className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy gap-2"
          >
            <Plus className="size-4" />
            Add Question
          </Button>
          {activeTab === 'complaint_details' ? (
            <Button
              onClick={() => handleOpenAddSection()}
              variant="outline"
              className="gap-2 border-umak-gold/50 text-umak-navy hover:bg-umak-gold/10"
            >
              <FolderPlus className="size-4" />
              Add Section
            </Button>
          ) : (
            <Button
              onClick={handleOpenAddSectionHeader}
              variant="outline"
              className="gap-2 border-umak-gold/50 text-umak-navy hover:bg-umak-gold/10"
            >
              <Plus className="size-4" />
              Add Section
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          {PHASES.map(phase => (
            <TabsTrigger key={phase.value} value={phase.value}>
              {phase.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-4">
          {/* Questions List */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : activeTab === 'complaint_details' ? (
            /* ── Sectionized View for Complaint Details ── */
            renderSectionizedView()
          ) : questions.length === 0 ? (
            <Card className="glass border-0 shadow-sm">
              <CardContent className="p-12 text-center">
                <FileText className="size-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No questions in {currentPhase?.label || 'this phase'}</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Click &quot;Add Question&quot; to get started</p>
              </CardContent>
            </Card>
          ) : activeTab === 'complainant' || activeTab === 'respondent' ? (
            /* ── Visual Form Preview for Complainant / Respondent Info ── */
            <div className="space-y-4">
              {questions.map((q, index) => (
                <Card
                  key={q.id}
                  className={`glass border-0 shadow-sm transition-all ${!q.isActive ? 'opacity-50' : 'hover:shadow-md'}`}
                >
                  <CardContent className="p-5">
                    {/* Question Header Row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        {/* Drag handle / Reorder */}
                        <div className="flex flex-col gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-5 text-muted-foreground/50"
                            onClick={() => handleReorder(index, 'up')}
                            disabled={index === 0}
                          >
                            <ChevronUp className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-5 text-muted-foreground/50"
                            onClick={() => handleReorder(index, 'down')}
                            disabled={index === questions.length - 1}
                          >
                            <ChevronDown className="size-3" />
                          </Button>
                        </div>

                        {/* Type icon + badge */}
                        <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${TYPE_BADGE_COLORS[q.fieldType] || ''}`}>
                          {getFieldIcon(q.fieldType)}
                          <span className="text-[11px] font-medium">{formatFieldType(q.fieldType)}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch
                          checked={q.isActive}
                          onCheckedChange={() => handleToggleActive(q)}
                          className="scale-[0.8]"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => handleOpenEdit(q)}
                          title="Edit"
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
                          onClick={() => setDeleteId(q.id)}
                          title="Delete"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Label */}
                    <div className="mb-1">
                      <span className="text-sm font-semibold">
                        {q.label}
                        {q.required && <span className="text-red-500 dark:text-red-400 ml-0.5">*</span>}
                      </span>
                    </div>

                    {/* Help text */}
                    {q.helpText && (
                      <p className="text-xs text-muted-foreground mb-3">{q.helpText}</p>
                    )}

                    {/* Field Preview */}
                    <div className="mb-2">
                      {renderFieldPreview(q)}
                    </div>

                    {/* Footer meta */}
                    <div className="flex flex-wrap items-center gap-3 mt-3 pt-2 border-t border-border/50">
                      {q.roleTarget && q.roleTarget !== 'both' && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          {q.roleTarget === 'complainant' ? (
                            <><User className="size-3" /> Complainant only</>
                          ) : (
                            <><Shield className="size-3" /> Respondent only</>
                          )}
                        </div>
                      )}
                      {q.allowMultiple && (
                        <span className="text-[11px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                          Allow Multiple
                        </span>
                      )}
                      {q.defaultValue && (
                        <span className="text-[11px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                          Default: {q.defaultValue}
                        </span>
                      )}
                      <span className={`ml-auto text-[11px] font-medium ${q.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                        {q.isActive ? '● Active' : '○ Inactive'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* ── Table View for Instructions ── */
            <Card className="glass border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-16">Order</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-36">Type</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Label</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-24">Status</th>
                        <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-36">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((q, index) => (
                        <tr key={q.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          {/* Order / Reorder */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() => handleReorder(index, 'up')}
                                disabled={index === 0}
                                title="Move up"
                              >
                                <ChevronUp className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() => handleReorder(index, 'down')}
                                disabled={index === questions.length - 1}
                                title="Move down"
                              >
                                <ChevronDown className="size-3.5" />
                              </Button>
                            </div>
                          </td>

                          {/* Type badge */}
                          <td className="px-4 py-3">
                            <Badge className={`text-xs ${TYPE_BADGE_COLORS[q.fieldType] || ''}`}>
                              {formatFieldType(q.fieldType)}
                            </Badge>
                          </td>

                          {/* Label */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium">{q.label}</span>
                              {q.required && (
                                <span className="text-red-500 dark:text-red-400 font-bold">*</span>
                              )}
                            </div>
                            {q.helpText && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{q.helpText}</p>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <Badge className={`text-xs ${q.isActive ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40' : 'bg-gray-500/15 text-gray-500 border-gray-500/30 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/40'}`}>
                              {q.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Switch
                                checked={q.isActive}
                                onCheckedChange={() => handleToggleActive(q)}
                                className="scale-90"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => handleOpenEdit(q)}
                                title="Edit"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
                                onClick={() => setDeleteId(q.id)}
                                title="Delete"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Question Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? 'Edit Question' : 'Add Question'}
            </DialogTitle>
            <DialogDescription>
              {editingQuestion
                ? `Editing "${editingQuestion.label}" in ${currentPhase?.label || activeTab}`
                : `Add a new question to the ${currentPhase?.label || activeTab} phase`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            {/* Section Assignment (complaint_details only) */}
            {activeTab === 'complaint_details' && (
              <div className="space-y-2">
                <Label>Section</Label>
                <Select
                  value={form.sectionId}
                  onValueChange={(val) => setForm(f => ({ ...f, sectionId: val }))}
                >
                  <SelectTrigger className="w-full">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="size-3.5 text-muted-foreground" />
                      <SelectValue placeholder="No Section" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No Section (Unsectioned)</SelectItem>
                    {sections.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Field Type */}
            <div className="space-y-2">
              <Label htmlFor="fieldType">Field Type</Label>
              <Select
                value={form.fieldType}
                onValueChange={(val) => setForm(f => ({ ...f, fieldType: val }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select field type" />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(ft => (
                    <SelectItem key={ft.value} value={ft.value}>
                      {ft.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="label">
                Label <span className="text-red-500">*</span>
              </Label>
              <Input
                id="label"
                value={form.label}
                onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. What is your full name?"
              />
            </div>

            {/* Help Text */}
            <div className="space-y-2">
              <Label htmlFor="helpText">Help Text</Label>
              <Input
                id="helpText"
                value={form.helpText}
                onChange={(e) => setForm(f => ({ ...f, helpText: e.target.value }))}
                placeholder="Optional hint shown below the label"
              />
            </div>

            {/* Placeholder (conditional) */}
            {showPlaceholder && (
              <div className="space-y-2">
                <Label htmlFor="placeholder">Placeholder</Label>
                <Input
                  id="placeholder"
                  value={form.placeholder}
                  onChange={(e) => setForm(f => ({ ...f, placeholder: e.target.value }))}
                  placeholder="e.g. Enter your name here..."
                />
              </div>
            )}

            {/* Content (section_header only) */}
            {showContent && (
              <div className="space-y-2">
                <Label htmlFor="content">Content / Instructions</Label>
                <Textarea
                  id="content"
                  value={form.content}
                  onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Rich text or instructions for this section..."
                  rows={4}
                />
              </div>
            )}

            {/* Choices (dropdown/radio/checkbox) */}
            {showChoices && (
              <div className="space-y-2">
                <Label>Choices / Options</Label>
                <ChoicesEditor
                  value={form.choices}
                  onChange={(val) => setForm(f => ({ ...f, choices: val }))}
                />
              </div>
            )}

            {/* Default Value */}
            <div className="space-y-2">
              <Label htmlFor="defaultValue">Default Value</Label>
              <Input
                id="defaultValue"
                value={form.defaultValue}
                onChange={(e) => setForm(f => ({ ...f, defaultValue: e.target.value }))}
                placeholder="Optional pre-filled value"
              />
            </div>

            {/* Role Target (complainant_info / respondent_info only) */}
            {showRoleTarget && (
              <div className="space-y-2">
                <Label htmlFor="roleTarget">Role Target</Label>
                <Select
                  value={form.roleTarget}
                  onValueChange={(val) => setForm(f => ({ ...f, roleTarget: val }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select target role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both</SelectItem>
                    <SelectItem value="complainant">Complainant only</SelectItem>
                    <SelectItem value="respondent">Respondent only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Toggles row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
              <div className="flex items-center gap-3">
                <Switch
                  id="required"
                  checked={form.required}
                  onCheckedChange={(checked) => setForm(f => ({ ...f, required: checked }))}
                />
                <Label htmlFor="required" className="cursor-pointer">
                  Required {form.required && <span className="text-red-500">*</span>}
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="allowMultiple"
                  checked={form.allowMultiple}
                  onCheckedChange={(checked) => setForm(f => ({ ...f, allowMultiple: checked }))}
                />
                <Label htmlFor="allowMultiple" className="cursor-pointer">Allow Multiple Entries</Label>
              </div>
            </div>

            {/* Validation (Advanced) */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Advanced Validation</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="validationMin" className="text-xs text-muted-foreground">Min Value / Length</Label>
                  <Input
                    id="validationMin"
                    value={form.validationMin}
                    onChange={(e) => setForm(f => ({ ...f, validationMin: e.target.value }))}
                    placeholder="e.g. 0"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="validationMax" className="text-xs text-muted-foreground">Max Value / Length</Label>
                  <Input
                    id="validationMax"
                    value={form.validationMax}
                    onChange={(e) => setForm(f => ({ ...f, validationMax: e.target.value }))}
                    placeholder="e.g. 100"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="validationPattern" className="text-xs text-muted-foreground">Regex Pattern</Label>
                  <Input
                    id="validationPattern"
                    value={form.validationPattern}
                    onChange={(e) => setForm(f => ({ ...f, validationPattern: e.target.value }))}
                    placeholder="e.g. ^[a-zA-Z]+$"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="validationMessage" className="text-xs text-muted-foreground">Custom Error Message</Label>
                  <Input
                    id="validationMessage"
                    value={form.validationMessage}
                    onChange={(e) => setForm(f => ({ ...f, validationMessage: e.target.value }))}
                    placeholder="e.g. Only letters allowed"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.label.trim()}
              className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy gap-2"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editingQuestion ? 'Save Changes' : 'Add Question'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Section Add/Edit Dialog */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSection ? 'Edit Section' : 'Add Section'}
            </DialogTitle>
            <DialogDescription>
              {editingSection
                ? `Editing section "${editingSection.title}"`
                : 'Create a new section to organize complaint detail questions'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sectionTitle">
                Section Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="sectionTitle"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="e.g. Incident Details"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sectionDesc">Description</Label>
              <Textarea
                id="sectionDesc"
                value={newSectionDesc}
                onChange={(e) => setNewSectionDesc(e.target.value)}
                placeholder="Optional description for this section..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSectionDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSection}
              disabled={!newSectionTitle.trim()}
              className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy gap-2"
            >
              {editingSection ? 'Save Changes' : 'Create Section'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? It will be deactivated and hidden from the complaint form. Existing submissions that used this question will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
