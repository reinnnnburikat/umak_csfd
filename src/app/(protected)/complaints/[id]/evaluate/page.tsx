'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressModal } from '@/components/complaint/progress-modal';
import { useAuth } from '@/hooks/use-auth';

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
  fileUrls: string | null;
  encodedByName: string | null;
  filedCase: string | null;
  progressUpdates: string | null;
  modifications: string | null;
  dynamicAnswers: string | null;
  formVersion: number | null;
  createdAt: string;
}

const emptyPerson: PersonInfo = {
  givenName: '',
  surname: '',
  middleName: '',
  extensionName: '',
  sex: '',
  studentNumber: '',
  collegeInstitute: '',
  email: '',
  yearLevel: '',
};

function PersonCard({
  person,
  index,
  type,
  onEdit,
  onDelete,
}: {
  person: PersonInfo;
  index: number;
  type: 'complainant' | 'respondent';
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  const fullName = `${person.givenName} ${person.middleName ? person.middleName + ' ' : ''}${person.surname}${person.extensionName ? ' ' + person.extensionName : ''}`;

  return (
    <Card className="relative">
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px]">
                {type === 'complainant' ? 'Complainant' : 'Respondent'} {index + 1}
              </Badge>
              <span className="text-xs text-muted-foreground">{person.sex}</span>
            </div>
            <p className="font-medium text-sm truncate">{fullName || 'Unnamed'}</p>
            <p className="text-xs text-muted-foreground">{person.studentNumber} | {person.collegeInstitute}</p>
            <p className="text-xs text-muted-foreground">{person.email}</p>
          </div>
          <div className="flex gap-1 ml-2">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => onEdit(index)}>
              <Pencil className="size-3.5 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => onDelete(index)}>
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PersonEditModal({
  open,
  onClose,
  onSave,
  person,
  type,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (person: PersonInfo) => void;
  person: PersonInfo;
  type: 'complainant' | 'respondent';
}) {
  const [data, setData] = useState<PersonInfo>(person);

  useEffect(() => {
    setData(person);
  }, [person]);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${open ? '' : 'hidden'}`}>
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-lg">Edit {type === 'complainant' ? 'Complainant' : 'Respondent'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Given Name</Label>
              <Input value={data.givenName} onChange={(e) => setData({ ...data, givenName: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Surname</Label>
              <Input value={data.surname} onChange={(e) => setData({ ...data, surname: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Middle Name</Label>
              <Input value={data.middleName || ''} onChange={(e) => setData({ ...data, middleName: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Extension Name</Label>
              <Input value={data.extensionName || ''} onChange={(e) => setData({ ...data, extensionName: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sex</Label>
              <Select value={data.sex} onValueChange={(v) => setData({ ...data, sex: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Non-binary">Non-binary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Student Number</Label>
              <Input value={data.studentNumber} onChange={(e) => setData({ ...data, studentNumber: e.target.value })} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">College/Institute</Label>
              <Input value={data.collegeInstitute} onChange={(e) => setData({ ...data, collegeInstitute: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Year Level</Label>
              <Input value={data.yearLevel} onChange={(e) => setData({ ...data, yearLevel: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => onSave(data)} className="bg-umak-gold text-umak-navy hover:bg-umak-gold-hover font-semibold">Save</Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ComplaintEvaluatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [complaint, setComplaint] = useState<ComplaintRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [dynamicAnswersMap, setDynamicAnswersMap] = useState<Record<string, string>>({});
  const [formQuestions, setFormQuestions] = useState<FormQuestionMeta[]>([]);

  // Edit state
  const [category, setCategory] = useState('');
  const [caseStatus, setCaseStatus] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [complainants, setComplainants] = useState<PersonInfo[]>([]);
  const [respondents, setRespondents] = useState<PersonInfo[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [filedCase, setFiledCase] = useState('');

  // Person edit modal
  const [editingPerson, setEditingPerson] = useState<PersonInfo>(emptyPerson);
  const [editingPersonIndex, setEditingPersonIndex] = useState(-1);
  const [editingPersonType, setEditingPersonType] = useState<'complainant' | 'respondent'>('complainant');
  const [personModalOpen, setPersonModalOpen] = useState(false);

  useEffect(() => {
    async function fetchComplaint() {
      try {
        const res = await fetch(`/api/complaints/${id}`);
        if (res.ok) {
          const data = await res.json();
          setComplaint(data);
          setCategory(data.category || '');
          setCaseStatus(data.caseStatus || '');
          setSubject(data.subject || '');
          setDescription(data.description || '');
          setDesiredOutcome(data.desiredOutcome || '');
          try { setComplainants(JSON.parse(data.complainants)); } catch { setComplainants([]); }
          try { setRespondents(JSON.parse(data.respondents)); } catch { setRespondents([]); }
          try { setProgressUpdates(JSON.parse(data.progressUpdates || '[]')); } catch { setProgressUpdates([]); }
          setFiledCase(data.filedCase || '');
          // Parse dynamic answers if present (read-only display)
          if (data.dynamicAnswers && data.formVersion) {
            try {
              const parsed = JSON.parse(data.dynamicAnswers);
              setDynamicAnswersMap(parsed);
              const qRes = await fetch('/api/form-questions');
              if (qRes.ok) {
                const qData = await qRes.json();
                setFormQuestions(qData.data || []);
              }
            } catch { /* empty */ }
          }
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

  const handleEditPerson = (index: number, type: 'complainant' | 'respondent') => {
    const list = type === 'complainant' ? complainants : respondents;
    setEditingPerson(list[index] || emptyPerson);
    setEditingPersonIndex(index);
    setEditingPersonType(type);
    setPersonModalOpen(true);
  };

  const handleSavePerson = (person: PersonInfo) => {
    if (editingPersonType === 'complainant') {
      const updated = [...complainants];
      updated[editingPersonIndex] = person;
      setComplainants(updated);
    } else {
      const updated = [...respondents];
      updated[editingPersonIndex] = person;
      setRespondents(updated);
    }
    setPersonModalOpen(false);
  };

  const handleDeletePerson = (index: number, type: 'complainant' | 'respondent') => {
    if (type === 'complainant') {
      setComplainants((prev) => prev.filter((_, i) => i !== index));
    } else {
      setRespondents((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleAddComplainant = () => {
    setEditingPerson(emptyPerson);
    setEditingPersonIndex(complainants.length);
    setEditingPersonType('complainant');
    setPersonModalOpen(true);
  };

  const handleAddRespondent = () => {
    setEditingPerson(emptyPerson);
    setEditingPersonIndex(respondents.length);
    setEditingPersonType('respondent');
    setPersonModalOpen(true);
  };

  const handleProgressSubmit = async (progress: { subject: string; date: string; details: string; fileUrls?: string[] }) => {
    const res = await fetch(`/api/complaints/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addProgress: progress,
        modifiedBy: user?.fullName || 'System',
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      try { setProgressUpdates(JSON.parse(updated.progressUpdates || '[]')); } catch { /* keep existing */ }
      toast.success('Progress update added.');
    } else {
      throw new Error('Failed to add progress');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/complaints/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          caseStatus,
          subject,
          description,
          desiredOutcome,
          complainants,
          respondents,
          filedCase,
          saveModification: true,
          modifiedBy: user?.fullName || 'System',
          encodedByName: user?.fullName || 'System',
        }),
      });

      if (res.ok) {
        toast.success('Complaint updated successfully!');
        router.push('/complaints');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update complaint.');
      }
    } catch {
      toast.error('An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
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
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/complaints')}>
          <ArrowLeft className="size-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-xl font-bold">Evaluate Complaint</h1>
          <p className="text-sm text-muted-foreground">{complaint.complaintNumber}</p>
        </div>
      </div>

      {/* Case Category & Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Case Classification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Case Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MAJOR">MAJOR</SelectItem>
                  <SelectItem value="MINOR">MINOR</SelectItem>
                  <SelectItem value="OTHERS">OTHERS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Case Status</Label>
              <Select value={caseStatus} onValueChange={setCaseStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Under Review">Under Review</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                  <SelectItem value="Dismissed">Dismissed</SelectItem>
                  <SelectItem value="Reopened">Reopened</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Filed Case</Label>
              <Input
                value={filedCase}
                onChange={(e) => setFiledCase(e.target.value)}
                placeholder="Enter the official filed case with the complainant"
              />
              <p className="text-[11px] text-muted-foreground">The official filed case as declared by admin/director with the complainant.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Complaint Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Complaint Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Desired Outcome</Label>
            <Textarea rows={3} value={desiredOutcome} onChange={(e) => setDesiredOutcome(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Date of Incident:</span>{' '}
              <span className="font-medium">{complaint.dateOfIncident || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Location:</span>{' '}
              <span className="font-medium">{complaint.location || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Ongoing:</span>{' '}
              <span className="font-medium">{complaint.isOngoing || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Complaint Category:</span>{' '}
              <span className="font-medium">{complaint.complaintCategory || '—'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Form Answers — READ ONLY (shown when complaint has formVersion) */}
      {complaint.formVersion && Object.keys(dynamicAnswersMap).length > 0 && (
        <Card className="border-amber-300/50 dark:border-amber-500/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Dynamic Form Answers</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  Form v{complaint.formVersion}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  Read Only
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              These answers were submitted with the dynamic complaint form. To edit these fields, use the{' '}
              <span className="font-medium">CMS → Complaint Form</span> builder.
            </p>
            <div className="space-y-3">
              {(() => {
                const qMap = new Map(formQuestions.map((q) => [q.id, q]));
                const phaseOrder = ['instructions', 'complainant', 'respondent', 'complaint_details', 'review', 'submitted'];
                const grouped: Record<string, Array<{ qId: string; label: string; value: string; phase: string }>> = {};

                for (const [qId, value] of Object.entries(dynamicAnswersMap)) {
                  const q = qMap.get(qId);
                  if (q && value) {
                    const phase = q.phase || 'other';
                    if (!grouped[phase]) grouped[phase] = [];
                    grouped[phase].push({ qId, label: q.label, value, phase });
                  }
                }

                const wellKnownLabels = ['Description', 'Desired Outcome', 'Date of Incident', 'Location', 'Ongoing', 'How Often', 'Witnesses', 'Previous Reports', 'Complaint Category', 'Violation Type', 'Subject'];

                return phaseOrder
                  .filter((phase) => grouped[phase]?.length > 0)
                  .map((phase) => {
                    const filtered = grouped[phase].filter(
                      (item) => !wellKnownLabels.includes(item.label)
                    );
                    if (filtered.length === 0) return null;

                    const phaseLabel = phase
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase());

                    return (
                      <div key={phase}>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{phaseLabel}</h4>
                        <div className="space-y-2">
                          {filtered.map((item) => (
                            <div key={item.qId} className="flex flex-col sm:flex-row sm:gap-4 text-sm py-1 border-b border-muted last:border-0">
                              <span className="text-muted-foreground text-xs uppercase sm:w-48 shrink-0">{item.label}</span>
                              <p className="whitespace-pre-wrap break-words">{item.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complainants */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Complainants</CardTitle>
            <Button variant="outline" size="sm" onClick={handleAddComplainant}>
              <Plus className="size-3.5 mr-1" />
              Add Complainant
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {complainants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No complainants listed.</p>
          ) : (
            complainants.map((person, i) => (
              <PersonCard
                key={i}
                person={person}
                index={i}
                type="complainant"
                onEdit={() => handleEditPerson(i, 'complainant')}
                onDelete={() => handleDeletePerson(i, 'complainant')}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Respondents */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Respondents</CardTitle>
            <Button variant="outline" size="sm" onClick={handleAddRespondent}>
              <Plus className="size-3.5 mr-1" />
              Add Respondent
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {respondents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No respondents listed.</p>
          ) : (
            respondents.map((person, i) => (
              <PersonCard
                key={i}
                person={person}
                index={i}
                type="respondent"
                onEdit={() => handleEditPerson(i, 'respondent')}
                onDelete={() => handleDeletePerson(i, 'respondent')}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Progress Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Progress</CardTitle>
            <Button
              size="sm"
              className="bg-umak-gold text-umak-navy hover:bg-umak-gold-hover font-semibold"
              onClick={() => setProgressModalOpen(true)}
            >
              <Plus className="size-3.5 mr-1" />
              Add Progress
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {progressUpdates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No progress updates yet.</p>
          ) : (
            <div className="space-y-3">
              {progressUpdates.map((p) => (
                <Card key={p.id} className="bg-muted/30">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-sm">{p.subject}</h4>
                      <span className="text-xs text-muted-foreground">
                        {new Date(p.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{p.details}</p>
                    {p.asOf && (
                      <p className="text-xs text-umak-blue dark:text-umak-gold font-medium mt-1.5 italic">
                        As of {p.asOf}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 font-semibold"
        >
          {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
          SAVE THE MODIFIED INFORMATION
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push('/complaints')}
        >
          BACK
        </Button>
      </div>

      {/* Modals */}
      <ProgressModal
        open={progressModalOpen}
        onClose={() => setProgressModalOpen(false)}
        onSubmit={handleProgressSubmit}
      />
      <PersonEditModal
        open={personModalOpen}
        onClose={() => setPersonModalOpen(false)}
        onSave={handleSavePerson}
        person={editingPerson}
        type={editingPersonType}
      />
    </div>
  );
}
