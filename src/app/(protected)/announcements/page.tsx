'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Megaphone, Plus, Pencil, Trash2, Pin, Eye, Calendar, Star, FileText, Download, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getServeFileUrl, getIframeSrcUrl, getFileType, openFileUrl } from '@/lib/file-url';
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
import dynamic from 'next/dynamic';
const ComposeModal = dynamic(
  () => import('@/components/announcements/compose-modal').then(mod => mod.ComposeModal),
  { ssr: false, loading: () => <div className="animate-pulse bg-muted h-96 rounded-xl" /> }
);
import { useAuth } from '@/hooks/use-auth';
import { useDataRefresh } from '@/hooks/use-data-refresh';

interface Announcement {
  id: string;
  title: string;
  body: string;
  postedFrom: string;
  postedTo: string;
  visibility: string;
  isPinned: boolean;
  fileUrl: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { fullName: string } | null;
}

export default function AnnouncementsPage() {
  return (
    <Suspense fallback={<AnnouncementsSkeleton />}>
      <AnnouncementsContent />
    </Suspense>
  );
}

function AnnouncementsSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function AnnouncementsContent() {
  const { user, isAdmin, isStaff, isSuperAdmin } = useAuth();
  const searchParams = useSearchParams();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [previewAnnouncement, setPreviewAnnouncement] = useState<Announcement | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const canEdit = isStaff || isAdmin || isSuperAdmin;
  const canDelete = isStaff || isAdmin || isSuperAdmin;

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch('/api/announcements?limit=50');
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.data || data);
      }
    } catch {
      // Failed to fetch announcements
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Real-time data refresh via Socket.IO
  const { isRefreshing } = useDataRefresh(['announcements'], fetchAnnouncements);

  // Auto-open compose modal if ?compose=true
  useEffect(() => {
    if (searchParams.get('compose') === 'true') {
      setComposeOpen(true);
    }
  }, [searchParams]);

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setComposeOpen(true);
  };

  const handleComposeNew = () => {
    setEditingAnnouncement(null);
    setComposeOpen(true);
  };

  const handleCloseModal = () => {
    setComposeOpen(false);
    setEditingAnnouncement(null);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Announcement deleted.');
        fetchAnnouncements();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete announcement.');
      }
    } catch {
      toast.error('An error occurred.');
    } finally {
      setDeleting(null);
      setDeleteTarget(null);
    }
  };

  const isExpired = (postedTo: string) => new Date(postedTo) < new Date();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight uppercase">
            <Megaphone className="inline-block mr-2 size-6 text-umak-gold" />
            Announcements
            {isRefreshing && (
              <span className="size-2 rounded-full bg-umak-gold animate-pulse inline-block ml-2 align-middle" />
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {announcements.length} announcement{announcements.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={handleComposeNew}
            className="bg-umak-gold text-umak-navy hover:bg-umak-gold-hover font-semibold"
          >
            <Plus className="size-4 mr-2" />
            Compose
          </Button>
        )}
      </div>

      {/* Announcements List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No announcements yet.
          {canEdit && ' Click "Compose" to create one.'}
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <Card
              key={a.id}
              className={`card-hover ${a.isPinned ? 'border-umak-gold/30' : ''} ${
                isExpired(a.postedTo) ? 'opacity-60' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {a.isPinned && (
                        <span className="inline-flex items-center gap-1 text-umak-gold text-xs font-semibold">
                          <Pin className="size-3" />
                          Pinned
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          a.visibility === 'Students'
                            ? 'status-pending'
                            : a.visibility === 'Staff'
                              ? 'status-minor'
                              : 'status-approved'
                        }
                      >
                        <Eye className="size-3 mr-1" />
                        {a.visibility}
                      </Badge>
                      {isExpired(a.postedTo) && (
                        <Badge variant="outline" className="status-hold">
                          Expired
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-base mb-1">{a.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{a.body}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>
                        {new Date(a.postedFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' — '}
                        {new Date(a.postedTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {a.createdBy?.fullName && (
                        <span>by {a.createdBy.fullName}</span>
                      )}
                      {a.fileUrl && (
                        <button
                          type="button"
                          onClick={() => openFileUrl(a.fileUrl)}
                          className="text-primary hover:underline cursor-pointer"
                        >
                          📎 Attachment
                        </button>
                      )}
                    </div>
                    {/* Edited timestamp indicator */}
                    {a.updatedAt && new Date(a.updatedAt).getTime() !== new Date(a.createdAt).getTime() && (
                      <p className="text-[11px] text-muted-foreground/70 mt-1 italic">
                        edited as of{' '}
                        {new Date(a.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {', '}
                        {new Date(a.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons - visible based on role */}
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => { setPreviewAnnouncement(a); setPreviewOpen(true); }}
                      title="Preview announcement"
                    >
                      <Eye className="size-3.5 text-muted-foreground" />
                    </Button>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleEdit(a)}
                        title="Edit announcement"
                      >
                        <Pencil className="size-3.5 text-muted-foreground" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setDeleteTarget(a)}
                        disabled={deleting === a.id}
                        title="Delete announcement"
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the announcement
              &ldquo;{deleteTarget?.title}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              disabled={deleting === deleteTarget?.id}
            >
              {deleting === deleteTarget?.id ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Announcement Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold pr-8">
              {previewAnnouncement?.title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Announcement preview
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date Range */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="size-4" />
              <span>
                {previewAnnouncement?.postedFrom &&
                  new Date(previewAnnouncement.postedFrom).toLocaleDateString('en-PH', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })
                }
                {previewAnnouncement?.postedTo &&
                  ` — ${new Date(previewAnnouncement.postedTo).toLocaleDateString('en-PH', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}`
                }
              </span>
            </div>

            {/* Visibility + Pinned badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {previewAnnouncement?.isPinned && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-umak-gold bg-umak-gold/10 px-2 py-1 rounded-full w-fit">
                  <Star className="size-3 fill-current" /> Pinned
                </span>
              )}
              <Badge
                variant="outline"
                className={
                  previewAnnouncement?.visibility === 'Students'
                    ? 'status-pending'
                    : previewAnnouncement?.visibility === 'Staff'
                      ? 'status-minor'
                      : 'status-approved'
                }
              >
                {previewAnnouncement?.visibility}
              </Badge>
            </div>

            {/* Created By */}
            {previewAnnouncement?.createdBy?.fullName && (
              <p className="text-xs text-muted-foreground">
                Posted by {previewAnnouncement.createdBy.fullName}
              </p>
            )}

            {/* Full Body */}
            <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {previewAnnouncement?.body}
            </div>

            {/* File Attachment */}
            {previewAnnouncement?.fileUrl && (() => {
              const fileType = getFileType(previewAnnouncement.fileUrl!)
              const fileUrl = previewAnnouncement.fileUrl!
              if (fileType === 'image') {
                return (
                  <div className="mt-2">
                    <img
                      src={getServeFileUrl(fileUrl) || fileUrl}
                      alt={previewAnnouncement.title}
                      className="w-full rounded-lg"
                    />
                  </div>
                )
              }
              if (fileType === 'pdf') {
                const iframeSrc = getIframeSrcUrl(fileUrl, '#toolbar=1&navpanes=0')
                if (iframeSrc) {
                  return (
                    <div className="mt-2 space-y-2">
                      <iframe
                        src={iframeSrc}
                        title={previewAnnouncement.title}
                        className="w-full h-[500px] rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => openFileUrl(fileUrl)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-umak-blue dark:text-umak-gold hover:underline cursor-pointer"
                      >
                        <FileText className="size-4" />
                        Open PDF in new tab
                      </button>
                    </div>
                  )
                }
                return (
                  <button
                    type="button"
                    onClick={() => openFileUrl(fileUrl)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-umak-blue dark:text-umak-gold hover:underline mt-2 cursor-pointer"
                  >
                    <FileText className="size-4" />
                    View PDF
                  </button>
                )
              }
              if (fileType === 'word') {
                return (
                  <button
                    type="button"
                    onClick={() => openFileUrl(fileUrl, { download: true })}
                    className="inline-flex items-center gap-2 text-sm font-medium text-umak-blue dark:text-umak-gold hover:underline mt-2 cursor-pointer"
                  >
                    <Download className="size-4" />
                    Download Document
                  </button>
                )
              }
              return (
                <button
                  type="button"
                  onClick={() => openFileUrl(fileUrl)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-umak-blue dark:text-umak-gold hover:underline mt-2 cursor-pointer"
                >
                  <Paperclip className="size-4" />
                  View Attachment
                </button>
              )
            })()}
          </div>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compose/Edit Modal */}
      <ComposeModal
        open={composeOpen}
        onClose={handleCloseModal}
        onCreated={fetchAnnouncements}
        editAnnouncement={editingAnnouncement}
      />
    </div>
  );
}
