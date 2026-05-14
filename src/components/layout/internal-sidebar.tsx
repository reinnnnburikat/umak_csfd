'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  BookOpen,
  Megaphone,
  UserCircle,
  Users,
  Settings2,
  ScrollText,
  LogOut,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ClipboardList,
  LayoutTemplate,
  HelpCircle,
  Mail,
  Award,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getServeFileUrl } from '@/lib/file-url';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/components/providers/session-provider';
import { apiFetch } from '@/hooks/use-api';

// ─── Hover Prefetch Config ─────────────────────────────────────
// Only prefetch data-heavy pages on hover. Settings/config pages excluded.

const PREFETCH_CONFIG: Record<
  string,
  { queryKey: unknown[]; queryFn: () => Promise<unknown> }
> = {
  '/dashboard': {
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiFetch('/api/dashboard'),
  },
  '/complaints': {
    queryKey: ['complaints', {}],
    queryFn: () => apiFetch('/api/complaints'),
  },
  '/disciplinary': {
    queryKey: ['disciplinary', {}],
    queryFn: () => apiFetch('/api/disciplinary'),
  },
  '/service-requests': {
    queryKey: ['service-requests', {}],
    queryFn: () => apiFetch('/api/service-requests/list?mode=list'),
  },
  '/reports': {
    queryKey: ['reports', {}],
    queryFn: () => apiFetch('/api/reports'),
  },
};

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
  children?: { href: string; label: string }[];
}

const STAFF_ROLES = ['staff', 'admin', 'superadmin', 'student_assistant', 'makati_internship'];

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="size-4" />,
    roles: STAFF_ROLES,
  },
  {
    href: '/service-controls',
    label: 'Service Controls',
    icon: <Settings2 className="size-4" />,
    roles: STAFF_ROLES,
  },
  {
    href: '/service-requests',
    label: 'Service Requests',
    icon: <FileText className="size-4" />,
    roles: STAFF_ROLES,
  },
  {
    href: '/service-requests/issued',
    label: 'Issued Requests',
    icon: <CheckCircle2 className="size-4" />,
    roles: STAFF_ROLES,
  },
  {
    href: '/complaints',
    label: 'Complaints',
    icon: <AlertTriangle className="size-4" />,
    roles: STAFF_ROLES,
  },
  {
    href: '/disciplinary',
    label: 'Disciplinary Records',
    icon: <BookOpen className="size-4" />,
    roles: STAFF_ROLES,
  },
  {
    href: '/announcements',
    label: 'Announcements',
    icon: <Megaphone className="size-4" />,
    roles: STAFF_ROLES,
  },
  {
    href: '/reports',
    label: 'Reports & Analytics',
    icon: <BarChart3 className="size-4" />,
    roles: STAFF_ROLES,
  },
  {
    href: '/notifications',
    label: 'Notifications',
    icon: <Bell className="size-4" />,
    roles: STAFF_ROLES,
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: <UserCircle className="size-4" />,
    roles: STAFF_ROLES,
  },
  {
    href: '/users',
    label: 'User Management',
    icon: <Users className="size-4" />,
    roles: ['superadmin'],
  },
  {
    href: '/cms',
    label: 'CMS Panel',
    icon: <ScrollText className="size-4" />,
    roles: ['superadmin'],
    children: [
      { href: '/cms/complaint-form', label: 'Complaint Form' },
      { href: '/cms/landing', label: 'Landing Page' },
      { href: '/cms/services', label: 'Services' },
      { href: '/cms/violations', label: 'Violations' },
      { href: '/cms/faqs', label: 'FAQs' },
      { href: '/cms/staff-profiles', label: 'Staff Profiles' },
      { href: '/cms/email-templates', label: 'Email Templates' },
      { href: '/cms/certificate', label: 'Certificates' },
      { href: '/cms/settings', label: 'Settings' },
      { href: '/cms/audit-logs', label: 'Audit Logs' },
    ],
  },
];

interface InternalSidebarProps {
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function InternalSidebar({ className, collapsed = false, onToggleCollapse }: InternalSidebarProps) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { user, isAdmin, isStaff, isSuperAdmin, signOut } = useAuth();

  const prefetchOnHover = useCallback(
    (href: string) => {
      const config = PREFETCH_CONFIG[href];
      if (config) {
        queryClient.prefetchQuery({
          queryKey: config.queryKey,
          queryFn: config.queryFn as () => Promise<unknown>,
          staleTime: 30_000,
        });
      }
    },
    [queryClient],
  );

  const cmsManuallyOpen = useState(false);
  const [cmsExpanded, setCmsExpanded] = cmsManuallyOpen;
  // Auto-expand CMS when navigated to a sub-page
  const isCmsSubRoute = pathname.startsWith('/cms') && pathname !== '/cms';
  const cmsOpen = cmsExpanded || isCmsSubRoute;

  const role = user?.role ?? '';
  const filteredItems = navItems.filter((item) => item.roles.includes(role));

  const roleLabel = isSuperAdmin
    ? 'Super Admin'
    : isAdmin
      ? 'Admin'
      : isStaff
        ? 'Staff'
        : 'User';

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <aside
      className={`h-screen gradient-dark flex flex-col shrink-0 sticky top-0 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      } ${className ?? ''}`}
    >
      {/* Logo + User Info */}
      <div className={`shrink-0 transition-all duration-300 ${collapsed ? 'p-2 pb-2' : 'p-4 pb-3'}`}>
        <Link href="/dashboard" className={`flex items-center gap-2 mb-4 transition-all duration-300 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex items-center gap-1.5 shrink-0">
            <Image
              src="/logos/UMAK LOGO.png"
              alt="UMak"
              width={24}
              height={24}
              className="object-contain"
            />
            <Image
              src="/logos/CSFD LOGO.png"
              alt="CSFD"
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight ml-1">
              <span className="text-[10px] font-bold text-white leading-none">CENTER FOR STUDENT</span>
              <span className="text-[10px] font-bold text-umak-gold leading-none">FORMATION &amp; DISCIPLINE</span>
            </div>
          )}
        </Link>
        <div className={`flex items-center gap-3 transition-all duration-300 ${collapsed ? 'justify-center' : ''}`}>
          <Avatar className={`border border-white/10 shrink-0 transition-all duration-300 ${collapsed ? 'size-8' : 'size-9'}`}>
            <AvatarImage src={getServeFileUrl(user?.profileImageUrl) ?? undefined} alt={user?.fullName || 'User'} />
            <AvatarFallback className="bg-umak-blue text-white text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">
                {user?.fullName ?? 'User'}
              </p>
              <Badge
                variant="secondary"
                className="mt-0.5 text-[10px] px-1.5 py-0 bg-umak-gold/20 text-umak-gold border-umak-gold/30 hover:bg-umak-gold/30"
              >
                {roleLabel}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <Separator className="bg-white/10 mx-3 shrink-0" />

      {/* Navigation - SCROLLABLE */}
      <div className="flex-1 overflow-y-auto px-2 py-3 min-h-0">
        <nav className="flex flex-col gap-0.5">
          {filteredItems.map((item) => {
            // For /cms, only highlight if exactly /cms (not /cms/*)
            const isActive = item.href === '/cms'
              ? pathname === '/cms'
              : pathname.startsWith(item.href);

            const linkElement = (
              <Link
                href={item.href}
                onMouseEnter={() => prefetchOnHover(item.href)}
                className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-white/10 text-umak-gold border-l-2 border-umak-gold'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className={`shrink-0 ${isActive ? 'text-umak-gold' : ''}`}>{item.icon}</span>
                {!collapsed && item.label}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    {linkElement}
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            // CMS collapsible sub-nav
            if (item.children && item.children.length > 0) {
              const isCmsActive = pathname.startsWith('/cms');
              return (
                <div key={item.href} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => setCmsExpanded(prev => !prev)}
                    className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200 w-full px-3 py-2.5 ${
                      isCmsActive
                        ? 'text-umak-gold'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className={`shrink-0 ${isCmsActive ? 'text-umak-gold' : ''}`}>{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown className={`size-3.5 transition-transform duration-200 ${cmsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {cmsOpen && (
                    <div className="ml-4 pl-3 border-l border-white/10 space-y-0.5 animate-fade-in">
                      {item.children.map((child) => {
                        const childActive = pathname === child.href;
                        const childLink = (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`flex items-center gap-2 rounded-lg text-xs font-medium transition-all duration-200 px-3 py-2 ${
                              childActive
                                ? 'bg-white/10 text-umak-gold border-l-2 border-umak-gold'
                                : 'text-white/50 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            {child.label}
                          </Link>
                        );
                        return childLink;
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return <div key={item.href}>{linkElement}</div>;
          })}
        </nav>
      </div>

      <Separator className="bg-white/10 mx-3 shrink-0" />

      {/* Bottom Section: Collapse toggle + Logout */}
      <div className={`shrink-0 transition-all duration-300 ${collapsed ? 'p-2' : 'p-3'}`}>
        {/* Collapse Toggle Button */}
        {onToggleCollapse && (
          <Button
            variant="ghost"
            className={`w-full text-white/60 hover:text-white hover:bg-white/5 mb-1 transition-all duration-300 ${
              collapsed ? 'justify-center px-0 py-2' : 'justify-start gap-3 px-3'
            }`}
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronsRight className="size-4" />
            ) : (
              <>
                <ChevronsLeft className="size-4" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        )}

        {/* Logout Button */}
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-center px-0 py-2 text-white/60 hover:text-white hover:bg-white/5"
                onClick={signOut}
                aria-label="Logout"
              >
                <LogOut className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Logout
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            className="w-full justify-start text-white/60 hover:text-white hover:bg-white/5 gap-3 px-3"
            onClick={signOut}
          >
            <LogOut className="size-4" />
            Logout
          </Button>
        )}
      </div>
    </aside>
  );
}
