'use client';

import { useState } from 'react';
import { InternalSidebar } from '@/components/layout/internal-sidebar';
import { InternalNavbar } from '@/components/layout/internal-navbar';
import { FloatingActions } from '@/components/layout/floating-actions';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NotificationProvider } from '@/components/providers/notification-provider';
import { QueryProvider } from '@/components/providers/query-provider';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapse = () => setCollapsed((prev) => !prev);

  return (
    <QueryProvider>
    <TooltipProvider>
      <NotificationProvider>
      <div className="min-h-screen flex">
        {/* Sidebar - Desktop always visible, mobile toggleable */}
        <div
          className={`fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity duration-300 ${
            sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setSidebarOpen(false)}
        />
        <div
          className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <InternalSidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <InternalNavbar
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onToggleCollapse={toggleCollapse}
            collapsed={collapsed}
          />
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            {children}
          </main>
        </div>

        {/* Floating Action Buttons */}
        <FloatingActions />
      </div>
      </NotificationProvider>
    </TooltipProvider>
    </QueryProvider>
  );
}
