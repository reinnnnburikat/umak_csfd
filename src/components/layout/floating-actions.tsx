'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Megaphone, AlertTriangle, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

const actions = [
  {
    label: 'Compose Announcement',
    href: '/announcements?compose=true',
    icon: <Megaphone className="size-4" />,
  },
  {
    label: 'Encode Complaint',
    href: '/complaint/encode',
    icon: <AlertTriangle className="size-4" />,
  },
  {
    label: 'Encode Violation Citation',
    href: '/disciplinary/new',
    icon: <BookOpen className="size-4" />,
  },
];

export function FloatingActions() {
  const [expanded, setExpanded] = useState(false);
  const { isAdmin, isStaff, isSuperAdmin, isAuthenticated } = useAuth();

  // Only visible for staff/admin/superadmin
  if (!isAuthenticated || (!isStaff && !isAdmin && !isSuperAdmin)) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Expanded Actions */}
      <div
        className="flex flex-col items-end gap-2 transition-all duration-300 ease-in-out"
        style={{
          opacity: expanded ? 1 : 0,
          transform: expanded ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.95)',
          pointerEvents: expanded ? 'auto' : 'none',
        }}
      >
        {actions.map((action) => (
          <Link key={action.href} href={action.href} className="flex items-center gap-2 group">
            <span className="text-xs font-medium text-foreground bg-card border border-border rounded-lg px-3 py-1.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
              {action.label}
            </span>
            <Button
              size="icon"
              className="size-11 rounded-full bg-umak-gold hover:bg-umak-gold-hover text-umak-navy shadow-lg transition-transform duration-200 hover:scale-105"
            >
              {action.icon}
            </Button>
          </Link>
        ))}
      </div>

      {/* Main FAB */}
      <Button
        size="icon"
        className="size-14 rounded-full bg-umak-blue hover:bg-umak-blue-hover text-white shadow-xl transition-transform duration-300 hover:scale-105"
        onClick={() => setExpanded(!expanded)}
        aria-label={expanded ? 'Close actions' : 'Open actions'}
        aria-expanded={expanded}
      >
        <Plus
          className="size-6 transition-transform duration-300"
          style={{
            transform: expanded ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        />
      </Button>
    </div>
  );
}
