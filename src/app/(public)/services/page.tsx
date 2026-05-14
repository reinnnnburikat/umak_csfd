'use client';

import Link from 'next/link';
import {
  FileCheck2,
  Shirt,
  UserCheck,
  Baby,
  AlertTriangle,
  Shield,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OfficeHoursBanner } from '@/components/layout/office-hours-banner';
import { useServiceAvailability } from '@/hooks/use-service-availability';
import { ServiceUnavailableOverlay } from '@/components/shared/service-unavailable-overlay';

const services = [
  {
    title: 'Good Moral Certificate',
    description:
      'Request a certificate of good moral character for employment, further studies, or other purposes.',
    href: '/services/good-moral',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    processingTime: '3-5 days',
    IconComp: FileCheck2,
    serviceKey: 'GMC',
  },
  {
    title: 'Uniform Exemption Request',
    description:
      'Apply for an exemption from the university uniform policy due to health or other valid reasons.',
    href: '/services/uniform-exemption',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    processingTime: '2-3 days',
    IconComp: Shirt,
    serviceKey: 'UER',
  },
  {
    title: 'Cross-Dressing Clearance',
    description:
      'Request clearance for cross-dressing during university events, activities, or performances.',
    href: '/services/cross-dressing',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-950/30',
    processingTime: '2-3 days',
    IconComp: UserCheck,
    serviceKey: 'CDC',
  },
  {
    title: 'Child Admission Clearance',
    description:
      'Obtain clearance for bringing a child to the university campus for valid purposes.',
    href: '/services/child-admission',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-950/30',
    processingTime: '2-3 days',
    IconComp: Baby,
    serviceKey: 'CAC',
  },
];

export default function ServicesPage() {
  const { isAvailable } = useServiceAvailability();

  return (
    <div className="flex flex-col">
      {/* Office Hours Banner */}
      <OfficeHoursBanner />

      {/* Header */}
      <section className="relative overflow-hidden gradient-primary text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,196,0,0.12),transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
              <Clock className="size-3.5 text-umak-gold" />
              <span className="text-xs font-medium text-white/80">
                Processing: Mon–Fri, 8 AM – 5 PM
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              CSFD Services
            </h1>
            <p className="text-base sm:text-lg text-white/70 leading-relaxed">
              Submit your requests online — available 24/7. Choose a service below to get started.
            </p>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-12 sm:py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 lg:gap-6">
            {services.map((service) => {
              const IconComp = service.IconComp;
              return (
                <ServiceUnavailableOverlay key={service.title} serviceKey={service.serviceKey}>
                  <Card
                    className="card-hover glass border-border/40 bg-card/80 group"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div
                          className={`size-12 rounded-xl ${service.bgColor} flex items-center justify-center shrink-0`}
                        >
                          <IconComp className={`size-6 ${service.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold">{service.title}</h3>
                          </div>
                          <Badge variant="secondary" className="mb-3 text-xs bg-umak-gold/10 text-umak-gold border-umak-gold/20 hover:bg-umak-gold/20">
                            <Clock className="size-3 mr-1" />
                            {service.processingTime}
                          </Badge>
                          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                            {service.description}
                          </p>
                          <Button
                            asChild
                            variant="link"
                            className="px-0 text-umak-blue dark:text-umak-gold hover:no-underline group-hover:gap-2 transition-all"
                          >
                            <Link href={service.href} className="flex items-center gap-1">
                              Apply Now
                              <ArrowRight className="size-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </ServiceUnavailableOverlay>
              );
            })}
          </div>

          {/* File a Complaint Card */}
          <div className="mt-8">
            <ServiceUnavailableOverlay serviceKey="COMPLAINT">
              <Card className="card-hover glass border-border/40 bg-card/80 border-l-4 border-l-umak-gold">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="size-12 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                      <AlertTriangle className="size-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold">File a Complaint</h3>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Report a concern or file a formal complaint through the CSFD digital complaint system.
                      </p>
                    </div>
                    <Button
                      asChild
                      className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy border-0 font-semibold shrink-0"
                    >
                      <Link href="/complaint" className="flex items-center gap-2">
                        File Complaint
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </ServiceUnavailableOverlay>
          </div>

          {/* Service Tracker Card */}
          <div className="mt-5">
            <ServiceUnavailableOverlay serviceKey="DISCIPLINARY">
              <Card className="card-hover glass border-border/40 bg-card/80">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="size-12 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                      <Shield className="size-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold mb-1">Service Tracker</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Track the services you acquired and monitor your request status using your reference number.
                      </p>
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      className="shrink-0 border-umak-blue/30 dark:border-umak-gold/30 text-umak-blue dark:text-umak-gold"
                    >
                      <Link href="/track" className="flex items-center gap-2">
                        Track Now
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </ServiceUnavailableOverlay>
          </div>
        </div>
      </section>
    </div>
  );
}
