'use client';

import { useState, useEffect, useCallback, useRef, startTransition } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────

interface DraftPayload {
  step: string | number;
  formData: Record<string, unknown>;
  savedAt: string;
}

export interface UseFormDraftOptions {
  /** Unique key for localStorage (e.g., 'gmc-form-draft') */
  storageKey: string;
  /** Current step in the form wizard */
  currentStep: string | number;
  /** The step that represents the initial/first step (don't save draft here) */
  initialStep: string | number;
  /** The step that represents "submitted/done" — don't save draft at this step */
  finalStep: string | number;
  /** Whether the form has been submitted (success state) */
  isSubmitted: boolean;
  /** Get current form data to save */
  getFormData: () => Record<string, unknown>;
  /** Restore saved form data */
  setFormData: (data: Record<string, unknown>) => void;
  /** Optional: callback when draft is detected on mount (for auto-restore) */
  onDraftLoaded?: (data: Record<string, unknown>, step: string | number) => void;
}

export interface UseFormDraftReturn {
  /** Whether a draft exists in localStorage */
  hasDraft: boolean;
  /** The step saved in the draft (for "Resume Draft" button) */
  draftStep: string | number | null;
  /** Whether the form has data that should trigger a leave warning */
  isDirty: boolean;
  /** Whether the leave-without-saving dialog is visible */
  showLeaveDialog: boolean;
  /** Show/hide the leave dialog */
  setShowLeaveDialog: (show: boolean) => void;
  /** Load the draft data, call setFormData, return draft info */
  loadDraft: () => { step: string | number; formData: Record<string, unknown> } | null;
  /** Save draft right now and return the payload */
  saveDraftNow: () => void;
  /** Remove draft from localStorage */
  clearDraft: () => void;
  /** User chose to leave: saves draft, closes dialog */
  confirmLeave: () => void;
  /** User chose to stay: closes dialog */
  cancelLeave: () => void;
  /** Incremented each time a draft save occurs — pass to DraftIndicator */
  saveCount: number;
}

// ─── Custom event for draft save notification ────────────────────────────
// This avoids passing saveCount through React state which causes parent
// re-renders and focus loss on input fields.

const DRAFT_SAVE_EVENT = 'form-draft-saved';

function dispatchDraftSaveEvent(storageKey: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DRAFT_SAVE_EVENT, { detail: { storageKey } }));
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────

export function useFormDraft({
  storageKey,
  currentStep,
  initialStep,
  finalStep,
  isSubmitted,
  getFormData,
  setFormData,
  onDraftLoaded,
}: UseFormDraftOptions): UseFormDraftReturn {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftStep, setDraftStep] = useState<string | number | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  // saveCount is kept for API compatibility but updates are deferred
  // via startTransition to prevent focus loss on active input fields
  const [saveCount, setSaveCount] = useState(0);

  // Track whether we've moved past the initial step at least once
  const hasMovedPastInitial = useRef(false);

  // Ref to avoid re-registering beforeunload
  const isDirtyRef = useRef(false);

  // Ref to always hold the latest getFormData without causing re-renders.
  // This prevents saveDraftInternal from being recreated when getFormData changes,
  // which would cause the auto-save interval useEffect to re-run and reset state.
  const getFormDataRef = useRef(getFormData);

  // Keep getFormDataRef in sync with the latest prop (via effect to satisfy lint)
  useEffect(() => {
    getFormDataRef.current = getFormData;
  }, [getFormData]);

  // Keep ref in sync
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // ─── Internal: save draft to localStorage ──────────────────────────
  // Defined BEFORE the useEffect that calls it, to avoid dep issues
  const saveDraftInternal = useCallback(() => {
    try {
      // Use the ref to get the latest form data without depending on
      // the getFormData prop directly, which would cause this callback
      // to be recreated on every render.
      const formData = getFormDataRef.current();
      // Only save if there's actual data (at least one non-empty field)
      const hasData = Object.values(formData).some(
        (v) => v !== '' && v !== null && v !== undefined
      );
      if (!hasData) return;

      const payload: DraftPayload = {
        step: currentStep,
        formData,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));

      // Dispatch custom event for DraftIndicator to pick up
      // (avoids React state update which causes focus loss)
      dispatchDraftSaveEvent(storageKey);

      // Use startTransition to mark the save count update as low-priority.
      // This prevents React from interrupting the user's current typing
      // interaction, which was the root cause of the focus-loss bug.
      startTransition(() => {
        setSaveCount((c) => c + 1);
      });
    } catch {
      // Storage full or error — silently fail
    }
  }, [storageKey, currentStep]);

  // ─── Detect draft on mount ─────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed: DraftPayload = JSON.parse(raw);
        if (parsed && parsed.formData && parsed.step !== undefined) {
          // Defer state updates to avoid synchronous setState in effect
          requestAnimationFrame(() => {
            setHasDraft(true);
            setDraftStep(parsed.step);
          });
        }
      }
    } catch {
      // Invalid JSON or storage error — ignore
    }
    // Only run on mount — intentionally empty deps
  }, []);

  // ─── Track if user has moved past initial step ─────────────────────
  useEffect(() => {
    if (currentStep !== initialStep) {
      hasMovedPastInitial.current = true;
      // Once past the initial step, form is considered dirty
      // Defer to avoid synchronous setState in effect
      requestAnimationFrame(() => setIsDirty(true));
    } else if (!hasMovedPastInitial.current) {
      requestAnimationFrame(() => setIsDirty(false));
    }
  }, [currentStep, initialStep]);

  // ─── Clear draft when submitted ────────────────────────────────────
  useEffect(() => {
    if (isSubmitted) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
      // Defer state updates to avoid synchronous setState in effect
      requestAnimationFrame(() => {
        setHasDraft(false);
        setDraftStep(null);
        setIsDirty(false);
      });
    }
  }, [isSubmitted, storageKey]);

  // ─── beforeunload handler ──────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current && currentStep !== finalStep) {
        e.preventDefault();
        // Modern browsers require returnValue to be set
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentStep, finalStep]);

  // ─── Auto-save every 5 seconds ────────────────────────────────────
  useEffect(() => {
    if (
      currentStep === initialStep ||
      currentStep === finalStep ||
      isSubmitted
    ) {
      return;
    }

    const intervalId = setInterval(() => {
      saveDraftInternal();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [currentStep, initialStep, finalStep, isSubmitted, saveDraftInternal]);

  // ─── Public: clearDraft ────────────────────────────────────────────
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setHasDraft(false);
    setDraftStep(null);
  }, [storageKey]);

  // ─── Public: saveDraftNow ─────────────────────────────────────────
  const saveDraftNow = useCallback(() => {
    saveDraftInternal();
  }, [saveDraftInternal]);

  // ─── Public: loadDraft ────────────────────────────────────────────
  const loadDraft = useCallback((): {
    step: string | number;
    formData: Record<string, unknown>;
  } | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed: DraftPayload = JSON.parse(raw);
      if (!parsed || !parsed.formData) return null;

      setFormData(parsed.formData);
      setHasDraft(false);
      setDraftStep(null);
      return { step: parsed.step, formData: parsed.formData };
    } catch {
      return null;
    }
  }, [storageKey, setFormData]);

  // ─── Public: confirmLeave (saves draft & closes dialog) ──────────
  const confirmLeave = useCallback(() => {
    saveDraftInternal();
    setShowLeaveDialog(false);
  }, [saveDraftInternal]);

  // ─── Public: cancelLeave ──────────────────────────────────────────
  const cancelLeave = useCallback(() => {
    setShowLeaveDialog(false);
  }, []);

  return {
    hasDraft,
    draftStep,
    isDirty,
    showLeaveDialog,
    setShowLeaveDialog,
    loadDraft,
    saveDraftNow,
    clearDraft,
    confirmLeave,
    cancelLeave,
    saveCount,
  };
}

// ─── Enhanced DraftIndicator hook ────────────────────────────────────────
// Uses custom events instead of prop-based saveSignal to avoid
// re-rendering the parent form component (which causes focus loss).

export function useDraftSaveListener(storageKey: string): number {
  const [saveSignal, setSaveSignal] = useState(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.storageKey === storageKey) {
        setSaveSignal((c) => c + 1);
      }
    };
    window.addEventListener(DRAFT_SAVE_EVENT, handler);
    return () => window.removeEventListener(DRAFT_SAVE_EVENT, handler);
  }, [storageKey]);

  return saveSignal;
}
