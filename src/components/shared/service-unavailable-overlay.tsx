'use client';

import { type ReactNode } from 'react';
import { Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useServiceAvailability } from '@/hooks/use-service-availability';

interface ServiceUnavailableOverlayProps {
  /** The service key to check — e.g. "GMC", "COMPLAINT", "DISCIPLINARY" */
  serviceKey: string;
  children: ReactNode;
}

export function ServiceUnavailableOverlay({
  serviceKey,
  children,
}: ServiceUnavailableOverlayProps) {
  const { loading, isAvailable } = useServiceAvailability();

  // While loading, render children normally to prevent flash of disabled state
  if (loading) {
    return <>{children}</>;
  }

  const available = isAvailable(serviceKey);

  // If available, render children normally
  if (available) {
    return <>{children}</>;
  }

  // If unavailable, render with blur overlay
  return (
    <div className="relative">
      {/* Blurred content — non-interactive */}
      <div
        className="pointer-events-none select-none"
        style={{ filter: 'blur(4px)' }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        {/* Semi-transparent backdrop */}
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] transition-opacity duration-300" />

        {/* Centered message card */}
        <Card className="relative glass border-0 shadow-lg max-w-sm w-[calc(100%-2rem)] animate-slide-up pointer-events-auto">
          <CardContent className="flex flex-col items-center text-center pt-0">
            {/* Icon */}
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-umak-blue/10 dark:bg-umak-gold/10">
              <Clock className="size-7 text-umak-blue dark:text-umak-gold" />
            </div>

            {/* Heading */}
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-umak-blue dark:text-umak-gold mb-2">
              This service will be available soon.
            </h2>

            {/* Subtext */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              Please check back later or contact the CSFD office for more
              information.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
