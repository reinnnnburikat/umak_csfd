'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  UserCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface StaffProfileItem {
  id: string;
  label: string;
  value: string | null;
  sortOrder: number;
  isActive: boolean;
  extra: string | null;
}

export default function StaffProfilesPage() {
  const [profiles, setProfiles] = useState<StaffProfileItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<StaffProfileItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formPhoto, setFormPhoto] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/managed-lists?listType=staff_profile');
      if (res.ok) {
        const json = await res.json();
        setProfiles(json.data);
      }
    } catch (err) {
      // Failed to fetch staff profiles
      toast.error('Failed to load staff profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleAdd = () => {
    setEditingProfile(null);
    setFormName('');
    setFormTitle('');
    setFormPhoto('');
    setShowModal(true);
  };

  const handleEdit = (profile: StaffProfileItem) => {
    setEditingProfile(profile);
    setFormName(profile.label);
    let parsedExtra: { title?: string; photoUrl?: string } = {};
    if (profile.extra) {
      try { parsedExtra = JSON.parse(profile.extra); } catch { /* empty */ }
    }
    setFormTitle(parsedExtra.title || '');
    setFormPhoto(parsedExtra.photoUrl || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingProfile) {
        const res = await fetch('/api/managed-lists', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingProfile.id,
            label: formName.trim(),
            extra: { title: formTitle.trim(), photoUrl: formPhoto.trim() },
          }),
        });
        if (!res.ok) throw new Error('Failed to update');
        toast.success('Staff profile updated');
      } else {
        const maxSort = profiles.length > 0 ? Math.max(...profiles.map(p => p.sortOrder)) : -1;
        const res = await fetch('/api/managed-lists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listType: 'staff_profile',
            label: formName.trim(),
            value: formTitle.trim(),
            sortOrder: maxSort + 1,
            extra: { title: formTitle.trim(), photoUrl: formPhoto.trim() },
          }),
        });
        if (!res.ok) throw new Error('Failed to create');
        toast.success('Staff profile added');
      }
      setShowModal(false);
      fetchProfiles();
    } catch {
      toast.error('Failed to save staff profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/managed-lists?id=${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Staff profile deleted');
      fetchProfiles();
    } catch {
      toast.error('Failed to delete staff profile');
    } finally {
      setDeleteId(null);
    }
  };

  const getExtra = (profile: StaffProfileItem) => {
    if (profile.extra) {
      try { return JSON.parse(profile.extra); } catch { /* empty */ }
    }
    return { title: profile.value || '', photoUrl: '' };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-cyan-500/15 dark:bg-cyan-500/20 flex items-center justify-center">
            <Users className="size-5 text-cyan-500 dark:text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">STAFF PROFILES</h1>
            <p className="text-sm text-muted-foreground">Manage About page staff profiles</p>
          </div>
        </div>
        <Button
          onClick={handleAdd}
          className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy gap-2"
        >
          <Plus className="size-4" />
          Add Profile
        </Button>
      </div>

      {/* Profiles Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <Card className="glass border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <UserCircle className="size-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No staff profiles yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((profile) => {
            const extra = getExtra(profile);
            return (
              <Card key={profile.id} className="glass border-0 shadow-sm card-hover">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {extra.photoUrl ? (
                        <img
                          src={extra.photoUrl}
                          alt={profile.label}
                          className="size-14 rounded-full object-cover"
                        />
                      ) : (
                        <UserCircle className="size-8 text-primary/50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate">{profile.label}</h4>
                      {extra.title && (
                        <p className="text-xs text-muted-foreground truncate">{extra.title}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleEdit(profile)}
                    >
                      <Pencil className="size-3" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-red-500 hover:text-red-600"
                      onClick={() => setDeleteId(profile.id)}
                    >
                      <Trash2 className="size-3" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="size-5 text-cyan-500" />
              {editingProfile ? 'Edit Staff Profile' : 'Add Staff Profile'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Enter staff member name"
              />
            </div>
            <div className="space-y-2">
              <Label>Title / Position</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., Director, CSFD"
              />
            </div>
            <div className="space-y-2">
              <Label>Photo URL</Label>
              <Input
                value={formPhoto}
                onChange={(e) => setFormPhoto(e.target.value)}
                placeholder="Enter photo URL"
              />
              <p className="text-xs text-muted-foreground">Optional. Paste a URL to the staff member&apos;s photo.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Staff Profile</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this staff profile? This will remove them from the About page.
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
