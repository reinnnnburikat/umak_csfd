'use client';

import Link from 'next/link';
import {
  LayoutTemplate,
  Wrench,
  Clock,
  AlertTriangle,
  HelpCircle,
  Users,
  Mail,
  Settings,
  ScrollText,
  ArrowRight,
  Award,
  ClipboardList,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const cmsCards = [
  {
    title: 'Landing Page Content',
    description: 'Edit hero text, taglines, and landing page sections',
    icon: LayoutTemplate,
    href: '/cms/landing',
    color: 'bg-blue-500/15 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400',
  },
  {
    title: 'Services Manager',
    description: 'Add/edit/disable service types available to users',
    icon: Wrench,
    href: '/cms/services',
    color: 'bg-emerald-500/15 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400',
  },
  {
    title: 'Office Hours',
    description: 'Edit CSFD processing hours and availability',
    icon: Clock,
    href: '/cms/office-hours',
    color: 'bg-amber-500/15 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400',
  },
  {
    title: 'Offense/Violation Types',
    description: 'Manage minor and major violation lists',
    icon: AlertTriangle,
    href: '/cms/violations',
    color: 'bg-red-500/15 text-red-500 dark:bg-red-500/20 dark:text-red-400',
  },
  {
    title: 'FAQ Manager',
    description: 'Add/edit/delete FAQ items displayed publicly',
    icon: HelpCircle,
    href: '/cms/faqs',
    color: 'bg-purple-500/15 text-purple-500 dark:bg-purple-500/20 dark:text-purple-400',
  },
  {
    title: 'Staff Profiles',
    description: 'Edit About page staff profiles and information',
    icon: Users,
    href: '/cms/staff-profiles',
    color: 'bg-cyan-500/15 text-cyan-500 dark:bg-cyan-500/20 dark:text-cyan-400',
  },
  {
    title: 'Email Templates',
    description: 'Edit notification email templates and content',
    icon: Mail,
    href: '/cms/email-templates',
    color: 'bg-pink-500/15 text-pink-500 dark:bg-pink-500/20 dark:text-pink-400',
  },
  {
    title: 'Certificate Configuration',
    description: 'Good Moral Certificate settings, templates, and e-signature',
    icon: Award,
    href: '/cms/certificate',
    color: 'bg-amber-500/15 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400',
  },
  {
    title: 'System Settings',
    description: 'System name, logo, contact info configuration',
    icon: Settings,
    href: '/cms/settings',
    color: 'bg-gray-500/15 text-gray-500 dark:bg-gray-500/20 dark:text-gray-400',
  },
  {
    title: 'Audit Logs',
    description: 'View system audit trail and action history',
    icon: ScrollText,
    href: '/cms/audit-logs',
    color: 'bg-umak-gold/15 text-umak-gold',
  },
  {
    title: 'Complaint Form',
    description: 'Build and manage the dynamic complaint form questions',
    icon: ClipboardList,
    href: '/cms/complaint-form',
    color: 'bg-teal-500/15 text-teal-500 dark:bg-teal-500/20 dark:text-teal-400',
  },
];

export default function CMSPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-umak-gold/15 flex items-center justify-center">
          <LayoutTemplate className="size-5 text-umak-gold" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CONTENT MANAGEMENT SYSTEM</h1>
          <p className="text-sm text-muted-foreground">Manage site content, settings, and system configuration</p>
        </div>
      </div>

      {/* CMS Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cmsCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href}>
              <Card className="glass border-0 shadow-sm card-hover h-full group cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${card.color}`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm mb-1">{card.title}</h3>
                      <p className="text-xs text-muted-foreground mb-3">{card.description}</p>
                      <span className="text-xs font-medium text-umak-gold inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                        Manage <ArrowRight className="size-3" />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
