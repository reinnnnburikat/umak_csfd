'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface ViolationItem {
  id: string;
  label: string;
  value: string | null;
  sortOrder: number;
  isActive: boolean;
  listType: string;
}

export default function ViolationsManagerPage() {
  const [violations, setViolations] = useState<ViolationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('MINOR');

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchViolations = useCallback(async () => {
    try {
      setLoading(true);
      const listType = activeTab === 'MINOR' ? 'violation_minor' : 'violation_major';
      const res = await fetch(`/api/managed-lists?listType=${listType}`);
      if (res.ok) {
        const json = await res.json();
        setViolations(json.data);
      }
    } catch (err) {
      // Failed to fetch violations
      toast.error('Failed to load violations');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchViolations();
  }, [fetchViolations]);

  const handleAdd = async () => {
    if (!newLabel.trim()) {
      toast.error('Violation type name is required');
      return;
    }
    setSaving(true);
    try {
      const listType = activeTab === 'MINOR' ? 'violation_minor' : 'violation_major';
      const maxSort = violations.length > 0 ? Math.max(...violations.map(v => v.sortOrder)) : -1;
      const res = await fetch('/api/managed-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listType,
          label: newLabel.trim(),
          value: newLabel.trim().toLowerCase().replace(/\s+/g, '_'),
          sortOrder: maxSort + 1,
        }),
      });
      if (!res.ok) throw new Error('Failed to add violation');
      toast.success(`${activeTab} violation added successfully`);
      setShowAddForm(false);
      setNewLabel('');
      fetchViolations();
    } catch {
      toast.error('Failed to add violation');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editLabel.trim()) {
      toast.error('Violation type name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/managed-lists', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, label: editLabel.trim() }),
      });
      if (!res.ok) throw new Error('Failed to update violation');
      toast.success('Violation updated successfully');
      setEditingId(null);
      fetchViolations();
    } catch {
      toast.error('Failed to update violation');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: ViolationItem) => {
    try {
      const res = await fetch('/api/managed-lists', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle status');
      toast.success(`Violation ${item.isActive ? 'deactivated' : 'activated'} successfully`);
      fetchViolations();
    } catch {
      toast.error('Failed to toggle status');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/managed-lists?id=${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete violation');
      toast.success('Violation deleted successfully');
      fetchViolations();
    } catch {
      toast.error('Failed to delete violation');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-red-500/15 dark:bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="size-5 text-red-500 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">VIOLATION TYPES MANAGER</h1>
            <p className="text-sm text-muted-foreground">{violations.length} {activeTab.toLowerCase()} violations</p>
          </div>
        </div>
        <Button
          onClick={() => setShowAddForm(true)}
          className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy gap-2"
        >
          <Plus className="size-4" />
          Add Violation
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="MINOR">Minor</TabsTrigger>
          <TabsTrigger value="MAJOR">Major</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-4">
          {/* Add Form */}
          {showAddForm && (
            <Card className="glass border-0 shadow-sm border-l-4 border-l-umak-gold">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">New {activeTab} Violation</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Enter violation type name"
                    className="flex-1"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setShowAddForm(false); setNewLabel(''); }}>
                      Cancel
                    </Button>
                    <Button onClick={handleAdd} disabled={saving} className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy">
                      {saving ? 'Saving...' : 'Add'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Violations List */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : violations.length === 0 ? (
            <Card className="glass border-0 shadow-sm">
              <CardContent className="p-12 text-center">
                <AlertTriangle className="size-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No {activeTab.toLowerCase()} violations found</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">#</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Violation Type</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                        <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {violations.map((v, index) => (
                        <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-sm text-muted-foreground">{index + 1}</td>
                          <td className="px-4 py-3">
                            {editingId === v.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editLabel}
                                  onChange={(e) => setEditLabel(e.target.value)}
                                  className="h-8 text-sm"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  onClick={() => handleSaveEdit(v.id)}
                                  disabled={saving}
                                >
                                  <Check className="size-3.5 text-emerald-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  onClick={() => setEditingId(null)}
                                >
                                  <X className="size-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-sm font-medium">{v.label}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`text-xs ${v.isActive ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40' : 'bg-gray-500/15 text-gray-500 border-gray-500/30 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/40'}`}>
                              {v.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => handleToggleActive(v)}
                                title={v.isActive ? 'Deactivate' : 'Activate'}
                              >
                                {v.isActive ? (
                                  <ToggleRight className="size-4 text-emerald-500 dark:text-emerald-400" />
                                ) : (
                                  <ToggleLeft className="size-4 text-gray-400 dark:text-gray-500" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => { setEditingId(v.id); setEditLabel(v.label); }}
                                title="Edit"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
                                onClick={() => setDeleteId(v.id)}
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Violation Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this violation type? Existing disciplinary records using this type will not be affected, but it will no longer be available for new records.
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
