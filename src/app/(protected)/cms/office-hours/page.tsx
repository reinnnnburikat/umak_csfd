'use client';

import { useEffect, useState, useCallback } from 'react';
import { Clock, Plus, Trash2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface OfficeHourItem {
  id: string;
  label: string;
  value: string | null;
  sortOrder: number;
  isActive: boolean;
  extra: string | null;
}

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export default function OfficeHoursPage() {
  const [hours, setHours] = useState<OfficeHourItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDay, setNewDay] = useState('Monday');
  const [newStart, setNewStart] = useState('08:00');
  const [newEnd, setNewEnd] = useState('17:00');

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchHours = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/managed-lists?listType=office_hours');
      if (res.ok) {
        const json = await res.json();
        setHours(json.data);
      }
    } catch (err) {
      // Failed to fetch office hours
      toast.error('Failed to load office hours');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHours();
  }, [fetchHours]);

  const handleAdd = async () => {
    if (!newDay || !newStart || !newEnd) {
      toast.error('All fields are required');
      return;
    }
    setSaving(true);
    try {
      const maxSort = hours.length > 0 ? Math.max(...hours.map(h => h.sortOrder)) : -1;
      const res = await fetch('/api/managed-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listType: 'office_hours',
          label: newDay,
          value: `${newStart}-${newEnd}`,
          sortOrder: maxSort + 1,
          extra: { start: newStart, end: newEnd, day: newDay },
        }),
      });
      if (!res.ok) throw new Error('Failed to add office hours');
      toast.success('Office hours added successfully');
      setShowAddForm(false);
      fetchHours();
    } catch {
      toast.error('Failed to add office hours');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateHours = async (id: string, start: string, end: string) => {
    try {
      const res = await fetch('/api/managed-lists', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          value: `${start}-${end}`,
          extra: { start, end },
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Office hours updated');
      fetchHours();
    } catch {
      toast.error('Failed to update office hours');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/managed-lists?id=${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Office hours entry deleted');
      fetchHours();
    } catch {
      toast.error('Failed to delete office hours');
    } finally {
      setDeleteId(null);
    }
  };

  const parseTime = (item: OfficeHourItem) => {
    if (item.extra) {
      try {
        const extra = JSON.parse(item.extra);
        return { start: extra.start || '08:00', end: extra.end || '17:00' };
      } catch {
        // fallback
      }
    }
    const parts = (item.value || '08:00-17:00').split('-');
    return { start: parts[0] || '08:00', end: parts[1] || '17:00' };
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };

  const usedDays = hours.map(h => h.label);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-amber-500/15 dark:bg-amber-500/20 flex items-center justify-center">
            <Clock className="size-5 text-amber-500 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">OFFICE HOURS MANAGER</h1>
            <p className="text-sm text-muted-foreground">Configure CSFD processing hours</p>
          </div>
        </div>
        <Button
          onClick={() => setShowAddForm(true)}
          className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy gap-2"
        >
          <Plus className="size-4" />
          Add Hours
        </Button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card className="glass border-0 shadow-sm border-l-4 border-l-umak-gold">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">New Office Hours Entry</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Day of Week *</Label>
                <Select value={newDay} onValueChange={setNewDay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(day => (
                      <SelectItem key={day} value={day} disabled={usedDays.includes(day)}>
                        {day} {usedDays.includes(day) ? '(Already set)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Time *</Label>
                <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Time *</Label>
                <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving} className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy">
                {saving ? 'Saving...' : 'Add Hours'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Office Hours */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : hours.length === 0 ? (
        <Card className="glass border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Clock className="size-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No office hours configured</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hours.map((item) => {
            const { start, end } = parseTime(item);
            return (
              <Card key={item.id} className="glass border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-sm mb-1">{item.label}</h4>
                      <p className="text-lg font-bold text-umak-gold">
                        {formatTime(start)} — {formatTime(end)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-red-500 hover:text-red-600"
                      onClick={() => setDeleteId(item.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Input
                      type="time"
                      value={start}
                      onChange={(e) => {
                        const updated = hours.map(h =>
                          h.id === item.id
                            ? { ...h, extra: JSON.stringify({ start: e.target.value, end }) }
                            : h
                        );
                        setHours(updated);
                      }}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="time"
                      value={end}
                      onChange={(e) => {
                        const updated = hours.map(h =>
                          h.id === item.id
                            ? { ...h, extra: JSON.stringify({ start, end: e.target.value }) }
                            : h
                        );
                        setHours(updated);
                      }}
                      className="h-8 text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => {
                        const current = hours.find(h => h.id === item.id);
                        if (current) {
                          const parsed = parseTime(current);
                          handleUpdateHours(item.id, parsed.start, parsed.end);
                        }
                      }}
                    >
                      <Save className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Office Hours</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this office hours entry?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
