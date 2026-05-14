'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
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
import { useDraftSaveListener } from '@/hooks/use-form-draft';

// ─── Draft Saved Indicator ──────────────────────────────────────────
// Shows "Draft saved" briefly in the top-right corner.
// Uses custom events via useDraftSaveListener to avoid re-rendering
// the parent form component (which causes focus loss on input fields).

interface DraftIndicatorProps {
  /** The form draft save trigger — kept for backward compatibility but no longer causes focus loss */
  saveSignal?: number;
  /** The storage key to listen for draft save events (preferred over saveSignal) */
  storageKey?: string;
}

export function DraftIndicator({ saveSignal, storageKey }: DraftIndicatorProps) {
  const [visible, setVisible] = useState(false);

  // Listen for custom events when storageKey is provided (preferred)
  const eventSaveSignal = useDraftSaveListener(storageKey || '');

  // Use event-based signal if storageKey is provided, otherwise fall back to saveSignal prop
  const effectiveSignal = storageKey ? eventSaveSignal : saveSignal;

  useEffect(() => {
    if (effectiveSignal === undefined || effectiveSignal === 0) return;
    // Use setTimeout to avoid calling setState synchronously within an effect
    const showTimer = setTimeout(() => setVisible(true), 0);
    const hideTimer = setTimeout(() => setVisible(false), 2000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [effectiveSignal]);

  if (!visible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium shadow-lg">
        <CheckCircle2 className="size-4" />
        Draft saved
      </div>
    </div>
  );
}

// ─── Leave Without Saving Dialog ────────────────────────────────────

interface LeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmLeave: () => void;
  onCancel: () => void;
}

export function LeaveDialog({ open, onOpenChange, onConfirmLeave, onCancel }: LeaveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. If you leave, your draft will be saved automatically.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Stay on page</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmLeave}>Leave</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
