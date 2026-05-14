'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Wrench,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Check,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface ServiceItem {
  id: string;
  label: string;
  value: string | null;
  sortOrder: number;
  isActive: boolean;
  extra: string | null;
}

export default function ServicesManagerPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/managed-lists?listType=service_type');
      if (res.ok) {
        const json = await res.json();
        setServices(json.data);
      }
    } catch {
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleAdd = async () => {
    if (!newLabel.trim()) {
      toast.error('Service name is required');
      return;
    }
    setSaving(true);
    try {
      const maxSort = services.length > 0 ? Math.max(...services.map(s => s.sortOrder)) : -1;
      const res = await fetch('/api/managed-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listType: 'service_type',
          label: newLabel.trim(),
          value: newValue.trim() || newLabel.trim().toLowerCase().replace(/\s+/g, '_'),
          sortOrder: maxSort + 1,
        }),
      });
      if (!res.ok) throw new Error('Failed to add');
      toast.success('Service added');
      setShowAddForm(false);
      setNewLabel('');
      setNewValue('');
      fetchServices();
    } catch {
      toast.error('Failed to add service');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editLabel.trim()) {
      toast.error('Service name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/managed-lists', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, label: editLabel.trim() }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Service updated');
      setEditingId(null);
      fetchServices();
    } catch {
      toast.error('Failed to update service');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: ServiceItem) => {
    try {
      const res = await fetch('/api/managed-lists', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle');
      toast.success(`Service ${item.isActive ? 'disabled' : 'enabled'}`);
      fetchServices();
    } catch {
      toast.error('Failed to toggle service');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/managed-lists?id=${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Service deleted');
      fetchServices();
    } catch {
      toast.error('Failed to delete service');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-emerald-500/15 dark:bg-emerald-500/20 flex items-center justify-center">
            <Wrench className="size-5 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SERVICES MANAGER</h1>
            <p className="text-sm text-muted-foreground">{services.length} service types</p>
          </div>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy gap-2">
          <Plus className="size-4" />
          Add Service
        </Button>
      </div>

      {showAddForm && (
        <Card className="glass border-0 shadow-sm border-l-4 border-l-umak-gold">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">New Service Type</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Service name" className="flex-1" />
              <Input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="Value (optional)" className="flex-1" />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setShowAddForm(false); setNewLabel(''); setNewValue(''); }}>Cancel</Button>
                <Button onClick={handleAdd} disabled={saving} className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy">{saving ? 'Saving...' : 'Add'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : services.length === 0 ? (
        <Card className="glass border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Wrench className="size-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No service types configured</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Service</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Value</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(s => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        {editingId === s.id ? (
                          <div className="flex items-center gap-2">
                            <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} className="h-8 text-sm" />
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => handleSaveEdit(s.id)} disabled={saving}><Check className="size-3.5 text-emerald-500" /></Button>
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditingId(null)}><X className="size-3.5" /></Button>
                          </div>
                        ) : (
                          <span className="text-sm font-medium">{s.label}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{s.value || '-'}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs ${s.isActive ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40' : 'bg-gray-500/15 text-gray-500 border-gray-500/30 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/40'}`}>
                          {s.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => handleToggleActive(s)} title={s.isActive ? 'Disable' : 'Enable'}>
                            {s.isActive ? <ToggleRight className="size-4 text-emerald-500 dark:text-emerald-400" /> : <ToggleLeft className="size-4 text-gray-400 dark:text-gray-500" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditingId(s.id); setEditLabel(s.label); }} title="Edit"><Pencil className="size-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="size-8 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300" onClick={() => setDeleteId(s.id)} title="Delete"><Trash2 className="size-3.5" /></Button>
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service Type</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this service type?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
