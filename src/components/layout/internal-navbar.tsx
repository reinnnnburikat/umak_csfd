'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, Bell, UserCircle, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getServeFileUrl } from '@/lib/file-url';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useAuth } from '@/components/providers/session-provider';
import { useNotificationContext } from '@/components/providers/notification-provider';

interface InternalNavbarProps {
  onToggleSidebar?: () => void;
  onToggleCollapse?: () => void;
  collapsed?: boolean;
  title?: string;
}

export function InternalNavbar({ onToggleSidebar, onToggleCollapse, collapsed = false, title }: InternalNavbarProps) {
  const { user, isAuthenticated, signOut } = useAuth();
  const { unreadCount } = useNotificationContext();
  const [isPulsing, setIsPulsing] = useState(false);

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  // Pulse animation when unreadCount changes (for visual feedback)
  useEffect(() => {
    if (unreadCount > 0) {
      const startTimer = setTimeout(() => setIsPulsing(true), 0);
      const endTimer = setTimeout(() => setIsPulsing(false), 600);
      return () => {
        clearTimeout(startTimer);
        clearTimeout(endTimer);
      };
    }
  }, [unreadCount]);

  return (
    <header className="sticky top-0 z-30 glass-nav border-b border-border/40">
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        {/* Left: Hamburger + Desktop toggle + Title */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden size-9"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            <Menu className="size-5" />
          </Button>

          {/* Desktop sidebar collapse toggle */}
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex size-9"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </Button>
          )}

          {title && (
            <h1 className="text-lg font-semibold tracking-tight truncate">{title}</h1>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {/* Notifications */}
          <Link href="/notifications">
            <Button variant="ghost" size="icon" className="size-9 relative" aria-label="Notifications">
              <Bell className={`size-4 transition-transform duration-300 ${isPulsing ? 'animate-bell-pulse' : ''}`} />
              {unreadCount > 0 && (
                <span className={`absolute -top-0.5 -right-0.5 min-w-4 h-4 flex items-center justify-center rounded-full bg-umak-gold text-umak-navy text-[10px] font-bold px-1 transition-transform duration-300 ${isPulsing ? 'scale-125' : 'scale-100'}`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>
          </Link>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative size-9 rounded-full ml-1" aria-label="User menu">
                <Avatar className="size-8">
                  <AvatarImage src={getServeFileUrl(user?.profileImageUrl) ?? undefined} alt={user?.fullName || 'User'} />
                  <AvatarFallback className="bg-umak-blue text-white text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.fullName ?? 'User'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email ?? ''}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/profile" className="cursor-pointer">
                  <UserCircle className="mr-2 size-4" />
                  Profile
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={signOut}
              >
                <LogOut className="mr-2 size-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
