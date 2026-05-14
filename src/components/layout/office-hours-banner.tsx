'use client';

import { useState } from 'react';
import { Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSyncExternalStore } from 'react';

const SESSION_KEY = 'icsfd-office-banner-dismissed';

const emptySubscribe = () => () => {};

function useSessionStorageDismissed() {
  return useSyncExternalStore(
    emptySubscribe,
    () => sessionStorage.getItem(SESSION_KEY) === 'true',
    () => false
  );
}

export function OfficeHoursBanner() {
  const [dismissed, setDismissed] = useState(false);
  const storageDismissed = useSessionStorageDismissed();

  if (dismissed || storageDismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(SESSION_KEY, 'true');
  };

  return (
    <div className="w-full bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Info className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200 truncate">
              CSFD accepts submissions 24/7. Processing is done Monday&ndash;Friday,
              8:00 AM &ndash; 5:00 PM.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
