'use client';

import Image from 'next/image';
import {
  MapPin,
  Phone,
  Globe,
  Mail,
  Eye,
  Target,
  Users,
  Shield,
  Award,
  Clock,
  Facebook,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const staffMembers = [
  {
    name: 'POMPEYO C. ADAMOS III',
    position: 'Director, CSFD',
    image: '/images/staff/OFFICIAL PORTRAIT.jpg',
    description: 'Leads the Center for Student Formation and Discipline with dedication to student development and character formation.',
    isDirector: true,
  },
  {
    name: 'MARIA FE SAMARES-ROXAS',
    position: 'Discipline Program Coordinator',
    image: '/images/staff/SAMARES.jpg',
    description: 'Manages discipline programs and ensures fair implementation of student conduct policies.',
    isDirector: false,
  },
  {
    name: 'ALMA A. FRAGINAL',
    position: 'Formation Program Coordinator',
    image: '/images/staff/ALMA FRAGINAL.png',
    description: 'Oversees student formation programs, workshops, and character development activities.',
    isDirector: false,
  },
];

const contactCards = [
  {
    icon: <MapPin className="size-6 text-umak-gold" />,
    title: 'Address',
    detail: 'University of Makati, J.P. Rizal Extension, West Rembo, Makati City 1210',
  },
  {
    icon: <Phone className="size-6 text-umak-gold" />,
    title: 'Phone',
    detail: '8883-1875 loc. 2101',
  },
  {
    icon: <Mail className="size-6 text-umak-gold" />,
    title: 'Email',
    detail: 'csfd@umak.edu.ph\ncsfdgoodmoral@umak.edu.ph',
  },
  {
    icon: <Globe className="size-6 text-umak-gold" />,
    title: 'Website',
    detail: 'csfd.umak.edu.ph',
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      {/* Header Section */}
      <section className="relative overflow-hidden gradient-primary text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(255,196,0,0.12),transparent_60%)]" />

        {/* Floating elements */}
        <div className="absolute top-20 right-[15%] w-3 h-3 rounded-full bg-umak-gold/30 animate-float" />
        <div className="absolute top-32 left-[10%] w-2 h-2 rounded-full bg-umak-gold/20 animate-float delay-200" />
        <div className="absolute bottom-20 right-[25%] w-4 h-4 rounded-full bg-white/10 animate-float delay-300" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          {/* Logos */}
          <div className="flex items-center justify-center gap-4 mb-8 animate-fade-in">
            <div className="relative size-20 sm:size-24 rounded-full border-2 border-umak-gold/60 shadow-[0_0_20px_rgba(255,196,0,0.3)] overflow-hidden bg-white/10 backdrop-blur-sm">
              <Image
                src="/logos/UMAK LOGO.png"
                alt="University of Makati"
                fill
                className="object-contain p-1"
              />
            </div>
            <div className="relative size-20 sm:size-24 rounded-full border-2 border-umak-gold/60 shadow-[0_0_20px_rgba(255,196,0,0.3)] overflow-hidden bg-white/10 backdrop-blur-sm">
              <Image
                src="/logos/CSFD LOGO.png"
                alt="CSFD"
                fill
                className="object-contain p-1"
              />
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3 animate-slide-up">
            CENTER FOR STUDENT
            <br />
            FORMATION AND DISCIPLINE
          </h1>
          <p className="text-lg text-white/70 max-w-xl mx-auto animate-slide-up delay-100">
            University of Makati
          </p>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Card className="glass border-border/40 bg-card/80">
            <CardContent className="p-6 sm:p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="size-10 rounded-lg bg-umak-blue/10 dark:bg-umak-gold/10 flex items-center justify-center">
                  <Shield className="size-5 text-umak-blue dark:text-umak-gold" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">ABOUT</h2>
              </div>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-3xl">
                The Center for Student Formation and Discipline (CSFD) is a vital unit of the
                University of Makati dedicated to the holistic development of students. We are
                committed to nurturing well-rounded individuals who embody the core values of the
                University: Integrity, Excellence, and Service.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Vision & Mission Section */}
      <section className="py-16 sm:py-20 bg-muted/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Vision Card */}
            <Card className="overflow-hidden card-hover border-0">
              <CardContent className="p-0">
                <div className="gradient-primary p-6 sm:p-8 text-white h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-10 rounded-lg bg-white/15 flex items-center justify-center">
                      <Eye className="size-5 text-umak-gold" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold">VISION</h3>
                  </div>
                  <p className="text-base text-white/85 leading-relaxed">
                    A leading center for student formation and discipline that produces graduates
                    of character and integrity, recognized for excellence in developing holistic
                    individuals ready to contribute to nation-building.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Mission Card */}
            <Card className="overflow-hidden card-hover border-0">
              <CardContent className="p-0">
                <div className="gradient-dark p-6 sm:p-8 text-white h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-10 rounded-lg bg-white/10 flex items-center justify-center">
                      <Target className="size-5 text-umak-gold" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold">
                      MIS<span className="text-umak-gold">SION</span>
                    </h3>
                  </div>
                  <p className="text-base text-white/85 leading-relaxed">
                    To provide holistic student formation programs and fair disciplinary processes
                    that nurture responsible, ethical, and community-oriented individuals who embody
                    the core values of the University of Makati.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Staff & Administrator Section */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center size-10 rounded-lg bg-umak-blue/10 dark:bg-umak-gold/10 mb-4">
              <Users className="size-5 text-umak-blue dark:text-umak-gold" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              STAFF &amp; ADMINISTRATOR
            </h2>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              Meet the people behind CSFD who are committed to student welfare and discipline.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {staffMembers.map((staff) => (
              <Card
                key={staff.name}
                className="card-hover glass border-border/40 bg-card/80 overflow-hidden"
              >
                <CardContent className="p-0">
                  {/* Photo */}
                  <div className="relative w-full h-64 bg-muted">
                    <Image
                      src={staff.image}
                      alt={staff.name}
                      fill
                      className="object-cover object-top"
                    />
                    {/* Director gold star badge */}
                    {staff.isDirector && (
                      <div className="absolute top-3 right-3 size-8 rounded-full bg-umak-gold flex items-center justify-center shadow-lg">
                        <Award className="size-4 text-umak-navy" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-5 text-center">
                    <h4 className="text-base font-semibold mb-1">{staff.name}</h4>
                    <p className="text-sm text-umak-gold font-medium mb-2">{staff.position}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{staff.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Information Section */}
      <section className="py-16 sm:py-20 bg-muted/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold tracking-tight">Contact Information</h3>
            <p className="text-muted-foreground mt-2">Get in touch with the CSFD office.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {contactCards.map((card) => (
              <Card key={card.title} className="glass border-border/40 bg-card/80 text-center p-6 card-hover">
                <div className="size-12 rounded-xl bg-umak-blue/10 dark:bg-umak-gold/10 flex items-center justify-center mx-auto mb-4">
                  {card.icon}
                </div>
                <h4 className="text-sm font-semibold mb-2">{card.title}</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{card.detail}</p>
              </Card>
            ))}
          </div>

          {/* Facebook link */}
          <div className="text-center mt-8">
            <a
              href="https://facebook.com/UMakCSFD"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-umak-blue dark:text-umak-gold hover:underline font-medium text-sm transition-colors"
            >
              <Facebook className="size-4" />
              facebook.com/UMakCSFD
            </a>
          </div>
        </div>
      </section>

      {/* Office Hours Section */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Card className="glass border-border/40 bg-card/80 max-w-2xl mx-auto">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="size-10 rounded-lg bg-umak-blue/10 dark:bg-umak-gold/10 flex items-center justify-center">
                  <Clock className="size-5 text-umak-blue dark:text-umak-gold" />
                </div>
                <h3 className="text-xl font-bold">Office Hours</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm font-medium">Monday – Friday</span>
                  <span className="text-sm text-umak-gold font-semibold">8:00 AM – 5:00 PM</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium">Saturday – Sunday</span>
                  <span className="text-sm text-muted-foreground font-semibold">Closed</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
