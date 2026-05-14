'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Clock, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useServiceAvailability } from '@/hooks/use-service-availability';

interface ServiceAvailabilityGuardProps {
  serviceKey: string;
  children: ReactNode;
}

export function ServiceAvailabilityGuard({
  serviceKey,
  children,
}: ServiceAvailabilityGuardProps) {
  const { loading, isAvailable } = useServiceAvailability();

  // While loading, show a subtle skeleton
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const available = isAvailable(serviceKey);

  // If available, render children normally
  if (available) {
    return <>{children}</>;
  }

  // If unavailable, render with blur overlay
  return (
    <div className="relative">
      {/* Blurred content */}
      <div className="blur-[3px] pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <div className="absolute inset-0 bg-background/70 backdrop-blur-[1px]" />
        <div className="relative text-center px-6 py-8 max-w-md mx-auto">
          {/* Icon */}
          <div className="mx-auto mb-4 size-16 rounded-2xl bg-umak-gold/10 dark:bg-umak-gold/20 flex items-center justify-center">
            <Clock className="size-8 text-umak-gold" />
          </div>

          {/* Message */}
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2 text-foreground">
            This service will be available soon.
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            We&apos;re currently preparing this service. Please check back later or contact the CSFD office for more information.
          </p>

          {/* Back to Services link */}
          <Button
            asChild
            variant="outline"
            className="border-umak-gold/40 text-umak-gold hover:bg-umak-gold/10 hover:text-umak-gold"
          >
            <Link href="/services" className="flex items-center gap-2">
              <ArrowLeft className="size-4" />
              Back to Services
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
