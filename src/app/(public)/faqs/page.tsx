'use client';

import { useEffect, useState } from 'react';
import { HelpCircle, MapPin, Phone, Globe, Mail } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface FaqItem {
  id: string;
  label: string;
  value: string | null;
  sortOrder: number;
}

const contactInfo = [
  {
    icon: <MapPin className="size-5 text-umak-blue dark:text-umak-gold shrink-0" />,
    label: 'University of Makati, J.P. Rizal Extension, West Rembo, Makati City',
  },
  {
    icon: <Phone className="size-5 text-umak-blue dark:text-umak-gold shrink-0" />,
    label: '8883-1875',
  },
  {
    icon: <Globe className="size-5 text-umak-blue dark:text-umak-gold shrink-0" />,
    label: 'umak.edu.ph/centers/csfd/',
  },
  {
    icon: <Globe className="size-5 text-umak-blue dark:text-umak-gold shrink-0" />,
    label: 'csfd.umak.edu.ph',
  },
  {
    icon: <Globe className="size-5 text-umak-blue dark:text-umak-gold shrink-0" />,
    label: 'umakpsd.umak.edu.ph',
  },
  {
    icon: <Globe className="size-5 text-umak-blue dark:text-umak-gold shrink-0" />,
    label: 'csfdgoodmoral.umak.edu.ph',
  },
];

export default function FaqsPage() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFaqs() {
      try {
        const res = await fetch('/api/faqs');
        if (res.ok) {
          const data = await res.json();
          setFaqs(data);
        }
      } catch {
        // Silently fail – faqs will remain empty
      } finally {
        setLoading(false);
      }
    }
    fetchFaqs();
  }, []);

  return (
    <div className="flex flex-col">
      {/* Header Section */}
      <section className="relative overflow-hidden gradient-primary text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(245,197,24,0.12),transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center justify-center size-20 rounded-2xl bg-white/10 border border-white/20 mb-6 animate-fade-in">
            <HelpCircle className="size-10 text-umak-gold" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3 animate-slide-up">
            FREQUENTLY ASKED
            <br />
            QUESTIONS
          </h1>
          <p className="text-lg text-white/70 max-w-xl mx-auto animate-slide-up delay-100">
            Find answers to common questions about CSFD services
          </p>
        </div>
      </section>

      {/* FAQ Grid Section */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="glass border-border/40 bg-card/80">
                  <CardContent className="p-6 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : faqs.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="size-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No FAQs available at the moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left column */}
              <Card className="glass border-border/40 bg-card/80">
                <CardContent className="p-4 sm:p-6">
                  <Accordion type="single" collapsible className="w-full">
                    {faqs
                      .filter((_, i) => i % 2 === 0)
                      .map((faq, index) => (
                        <AccordionItem key={faq.id} value={`left-${index}`}>
                          <AccordionTrigger className="text-sm sm:text-base font-medium text-left">
                            {faq.label}
                          </AccordionTrigger>
                          <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                            {faq.value || faq.label}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                  </Accordion>
                </CardContent>
              </Card>

              {/* Right column */}
              <Card className="glass border-border/40 bg-card/80">
                <CardContent className="p-4 sm:p-6">
                  <Accordion type="single" collapsible className="w-full">
                    {faqs
                      .filter((_, i) => i % 2 !== 0)
                      .map((faq, index) => (
                        <AccordionItem key={faq.id} value={`right-${index}`}>
                          <AccordionTrigger className="text-sm sm:text-base font-medium text-left">
                            {faq.label}
                          </AccordionTrigger>
                          <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                            {faq.value || faq.label}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                  </Accordion>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 sm:py-20 bg-muted/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Card className="glass border-border/40 bg-card/80 max-w-2xl mx-auto">
            <CardContent className="p-6 sm:p-8">
              <h3 className="text-xl font-bold mb-6 text-center">Still have questions?</h3>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Contact us directly and we&apos;ll be happy to help.
              </p>
              <div className="space-y-4">
                {contactInfo.map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    {item.icon}
                    <span className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
