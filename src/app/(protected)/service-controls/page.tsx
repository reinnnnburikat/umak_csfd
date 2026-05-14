'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FileCheck2,
  Shirt,
  Baby,
  UserCheck,
  AlertTriangle,
  Shield,
  Settings2,
  Loader2,
  PowerOff,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────
interface ServiceToggle {
  id: string;
  serviceKey: string;
  serviceName: string;
  description: string;
  isActive: boolean;
  updatedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

// ── Service metadata (icon + color) ─────────────────────────────────────
const SERVICE_META: Record<
  string,
  { icon: React.ElementType; color: string; inactiveColor: string }
> = {
  GMC: {
    icon: FileCheck2,
    color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    inactiveColor: 'bg-gray-500/10 text-gray-400',
  },
  UER: {
    icon: Shirt,
    color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    inactiveColor: 'bg-gray-500/10 text-gray-400',
  },
  CDC: {
    icon: UserCheck,
    color: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
    inactiveColor: 'bg-gray-500/10 text-gray-400',
  },
  CAC: {
    icon: Baby,
    color: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    inactiveColor: 'bg-gray-500/10 text-gray-400',
  },
  COMPLAINT: {
    icon: AlertTriangle,
    color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    inactiveColor: 'bg-gray-500/10 text-gray-400',
  },
  DISCIPLINARY: {
    icon: Shield,
    color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
    inactiveColor: 'bg-gray-500/10 text-gray-400',
  },
};

// ── Component ──────────────────────────────────────────────────────────
export default function ServiceControlsPage() {
  const [toggles, setToggles] = useState<ServiceToggle[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const fetchToggles = useCallback(async () => {
    try {
      const res = await fetch('/api/service-toggles');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setToggles(json.data ?? []);
    } catch {
      toast.error('Failed to load service toggles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToggles();
  }, [fetchToggles]);

  const handleInitialize = async () => {
    setInitializing(true);
    try {
      const res = await fetch('/api/service-toggles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to initialize');
      const json = await res.json();
      setToggles(json.data ?? []);
      toast.success('Service toggles initialized successfully');
    } catch {
      toast.error('Failed to initialize service toggles');
    } finally {
      setInitializing(false);
    }
  };

  const handleToggle = async (serviceKey: string, newActive: boolean) => {
    setTogglingKey(serviceKey);
    // Optimistic update
    setToggles((prev) =>
      prev.map((t) =>
        t.serviceKey === serviceKey ? { ...t, isActive: newActive } : t
      )
    );
    try {
      const res = await fetch('/api/service-toggles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceKey, isActive: newActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle');
      const json = await res.json();
      setToggles((prev) =>
        prev.map((t) => (t.serviceKey === serviceKey ? json.data : t))
      );
      toast.success(
        `${toggles.find((t) => t.serviceKey === serviceKey)?.serviceName} is now ${newActive ? 'available' : 'unavailable'}`
      );
    } catch {
      // Revert optimistic update
      setToggles((prev) =>
        prev.map((t) =>
          t.serviceKey === serviceKey ? { ...t, isActive: !newActive } : t
        )
      );
      toast.error('Failed to update service status');
    } finally {
      setTogglingKey(null);
    }
  };

  // ── Loading skeleton ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state: no toggles seeded yet ─────────────────────────────
  if (toggles.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-umak-gold/15 flex items-center justify-center">
            <Settings2 className="size-5 text-umak-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              SERVICE CONTROLS
            </h1>
            <p className="text-sm text-muted-foreground">
              Toggle services on or off to control public availability
            </p>
          </div>
        </div>

        {/* Empty state */}
        <Card className="glass border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <PowerOff className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              No service toggles found
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Initialize the service toggles to start controlling which
              services are available to the public.
            </p>
            <Button
              onClick={handleInitialize}
              disabled={initializing}
              className="bg-umak-gold hover:bg-umak-gold/90 text-white"
            >
              {initializing ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Initializing...
                </>
              ) : (
                'Initialize Services'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main content ───────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-umak-gold/15 flex items-center justify-center">
            <Settings2 className="size-5 text-umak-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              SERVICE CONTROLS
            </h1>
            <p className="text-sm text-muted-foreground">
              Toggle services on or off to control public availability
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            Available
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-gray-400" />
            Unavailable
          </span>
        </div>
      </div>

      {/* Service Toggle Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {toggles.map((toggle) => {
          const meta = SERVICE_META[toggle.serviceKey] ?? {
            icon: Settings2,
            color: 'bg-gray-500/15 text-gray-600',
            inactiveColor: 'bg-gray-500/10 text-gray-400',
          };
          const Icon = meta.icon;
          const isToggling = togglingKey === toggle.serviceKey;

          return (
            <Card
              key={toggle.id}
              className={`glass border-0 shadow-sm transition-all duration-300 relative overflow-hidden ${
                toggle.isActive
                  ? 'ring-1 ring-emerald-500/20'
                  : 'ring-1 ring-gray-200 dark:ring-gray-800 opacity-75'
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Icon + Info */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div
                      className={`size-11 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-300 ${
                        toggle.isActive ? meta.color : meta.inactiveColor
                      }`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`font-semibold text-sm mb-0.5 transition-colors duration-300 ${
                          toggle.isActive
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {toggle.serviceName}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {toggle.description}
                      </p>
                      <div className="mt-2">
                        <Badge
                          variant={toggle.isActive ? 'default' : 'secondary'}
                          className={`text-[10px] px-2 py-0.5 font-medium transition-colors duration-300 ${
                            toggle.isActive
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 border-0'
                              : 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20 border-0'
                          }`}
                        >
                          {toggle.isActive ? 'Available' : 'Unavailable'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Right: Switch */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Switch
                      checked={toggle.isActive}
                      onCheckedChange={(checked) =>
                        handleToggle(toggle.serviceKey, checked)
                      }
                      disabled={isToggling}
                      className={`${
                        toggle.isActive
                          ? 'data-[state=checked]:bg-emerald-500'
                          : ''
                      }`}
                    />
                    {isToggling && (
                      <Loader2 className="size-3 animate-spin text-muted-foreground mt-1" />
                    )}
                  </div>
                </div>

                {/* Inactive overlay preview */}
                {!toggle.isActive && (
                  <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
                    <div className="bg-muted/80 rounded-lg px-4 py-2 text-center">
                      <p className="text-xs font-medium text-muted-foreground">
                        This service is currently unavailable
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
