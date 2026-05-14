'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  HelpCircle,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { toast } from 'sonner';

interface FaqItem {
  id: string;
  label: string;
  value: string | null;
  sortOrder: number;
  isActive: boolean;
  extra: string | null;
}

export default function FaqManagerPage() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchFaqs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/managed-lists?listType=faq');
      if (res.ok) {
        const json = await res.json();
        setFaqs(json.data);
      }
    } catch (err) {
      // Failed to fetch FAQs
      toast.error('Failed to load FAQs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  const handleAdd = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) {
      toast.error('Question and answer are required');
      return;
    }
    setSaving(true);
    try {
      const maxSort = faqs.length > 0 ? Math.max(...faqs.map(f => f.sortOrder)) : -1;
      const res = await fetch('/api/managed-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listType: 'faq',
          label: newQuestion.trim(),
          value: newAnswer.trim(),
          sortOrder: maxSort + 1,
        }),
      });
      if (!res.ok) throw new Error('Failed to add FAQ');
      toast.success('FAQ added successfully');
      setShowAddForm(false);
      setNewQuestion('');
      setNewAnswer('');
      fetchFaqs();
    } catch {
      toast.error('Failed to add FAQ');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editQuestion.trim() || !editAnswer.trim()) {
      toast.error('Question and answer are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/managed-lists', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, label: editQuestion.trim(), value: editAnswer.trim() }),
      });
      if (!res.ok) throw new Error('Failed to update FAQ');
      toast.success('FAQ updated successfully');
      setEditingId(null);
      fetchFaqs();
    } catch {
      toast.error('Failed to update FAQ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/managed-lists?id=${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete FAQ');
      toast.success('FAQ deleted successfully');
      fetchFaqs();
    } catch {
      toast.error('Failed to delete FAQ');
    } finally {
      setDeleteId(null);
    }
  };

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    const index = faqs.findIndex(f => f.id === id);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === faqs.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const current = faqs[index];
    const swap = faqs[swapIndex];

    try {
      await Promise.all([
        fetch('/api/managed-lists', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: current.id, sortOrder: swap.sortOrder }),
        }),
        fetch('/api/managed-lists', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: swap.id, sortOrder: current.sortOrder }),
        }),
      ]);
      fetchFaqs();
    } catch {
      toast.error('Failed to reorder FAQ');
    }
  };

  const startEdit = (faq: FaqItem) => {
    setEditingId(faq.id);
    setEditQuestion(faq.label);
    setEditAnswer(faq.value || '');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-purple-500/15 dark:bg-purple-500/20 flex items-center justify-center">
            <HelpCircle className="size-5 text-purple-500 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">FAQ MANAGER</h1>
            <p className="text-sm text-muted-foreground">{faqs.length} FAQ items</p>
          </div>
        </div>
        <Button
          onClick={() => setShowAddForm(true)}
          className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy gap-2"
        >
          <Plus className="size-4" />
          Add FAQ
        </Button>
      </div>

      {/* Add FAQ Form */}
      {showAddForm && (
        <Card className="glass border-0 shadow-sm border-l-4 border-l-umak-gold">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold">New FAQ Item</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Question *</label>
              <Input
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Enter FAQ question"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Answer *</label>
              <Textarea
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="Enter FAQ answer"
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowAddForm(false); setNewQuestion(''); setNewAnswer(''); }}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={saving} className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy">
                {saving ? 'Saving...' : 'Add FAQ'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FAQ List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : faqs.length === 0 ? (
        <Card className="glass border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <HelpCircle className="size-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No FAQ items yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <Card key={faq.id} className="glass border-0 shadow-sm">
              <CardContent className="p-4">
                {editingId === faq.id ? (
                  <div className="space-y-3">
                    <Input
                      value={editQuestion}
                      onChange={(e) => setEditQuestion(e.target.value)}
                      placeholder="Question"
                    />
                    <Textarea
                      value={editAnswer}
                      onChange={(e) => setEditAnswer(e.target.value)}
                      placeholder="Answer"
                      rows={3}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="size-4 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(faq.id)}
                        disabled={saving}
                        className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy"
                      >
                        <Check className="size-4 mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() => handleMove(faq.id, 'up')}
                        disabled={index === 0}
                      >
                        <ChevronUp className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() => handleMove(faq.id, 'down')}
                        disabled={index === faqs.length - 1}
                      >
                        <ChevronDown className="size-3" />
                      </Button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="text-[10px] bg-umak-gold/15 text-umak-gold border-umak-gold/30">
                          #{index + 1}
                        </Badge>
                        <h4 className="font-medium text-sm">{faq.label}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{faq.value || 'No answer provided'}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => startEdit(faq)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-600" onClick={() => setDeleteId(faq.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete FAQ</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this FAQ item? This action cannot be undone.
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
