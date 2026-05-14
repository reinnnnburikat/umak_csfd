'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight, Search, Clock, Megaphone, Star,
  ChevronRight, Send, Bell, Mail, Zap,
  ClipboardList, CheckCircle2, FileCheck2, Shirt,
  UserCheck, Baby, AlertTriangle, Shield, Users, BarChart3,
  Calendar, Paperclip, X, Download, FileText
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { getServeFileUrl, openFileUrl } from '@/lib/file-url'
import { useServiceAvailability } from '@/hooks/use-service-availability'
import { ServiceUnavailableOverlay } from '@/components/shared/service-unavailable-overlay'

const services = [
  {
    title: 'Good Moral Certificate',
    description: 'Request a certificate of good moral character for employment, further studies, or other purposes.',
    href: '/services/good-moral',
    color: 'from-blue-500/20 to-blue-600/5',
    iconColor: 'text-blue-600 dark:text-blue-400',
    IconComp: FileCheck2,
    serviceKey: 'GMC' as const,
  },
  {
    title: 'Uniform Exemption',
    description: 'Apply for exemption from wearing the prescribed school uniform due to valid reasons.',
    href: '/services/uniform-exemption',
    color: 'from-emerald-500/20 to-emerald-600/5',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    IconComp: Shirt,
    serviceKey: 'UER' as const,
  },
  {
    title: 'Cross-Dressing Clearance',
    description: 'Request clearance for cross-dressing during specific events or activities on campus.',
    href: '/services/cross-dressing',
    color: 'from-purple-500/20 to-purple-600/5',
    iconColor: 'text-purple-600 dark:text-purple-400',
    IconComp: UserCheck,
    serviceKey: 'CAC' as const,
  },
  {
    title: 'Child Admission Clearance',
    description: 'Obtain clearance for bringing a child onto the university campus.',
    href: '/services/child-admission',
    color: 'from-pink-500/20 to-pink-600/5',
    iconColor: 'text-pink-600 dark:text-pink-400',
    IconComp: Baby,
    serviceKey: 'CDC' as const,
  },
  {
    title: 'File a Complaint',
    description: 'File a formal complaint — no login required. Track your case with your complaint number.',
    href: '/complaint',
    color: 'from-amber-500/20 to-amber-600/5',
    iconColor: 'text-amber-600 dark:text-amber-400',
    IconComp: AlertTriangle,
    serviceKey: 'COMPLAINT' as const,
  },
  {
    title: 'Service Tracker',
    description: 'Track the services you acquired and monitor your request status using your reference number.',
    href: '/track',
    color: 'from-red-500/20 to-red-600/5',
    iconColor: 'text-red-600 dark:text-red-400',
    IconComp: Shield,
    serviceKey: 'DISCIPLINARY' as const,
  },
]

interface StatsData {
  totalRequests: number
  certificatesIssued: number
  activeStudents: number
  complaintsFiled: number
  disciplinaryRecords: number
  monthlyRequests: number
}

const defaultStats: StatsData = {
  totalRequests: 0,
  certificatesIssued: 0,
  activeStudents: 0,
  complaintsFiled: 0,
  disciplinaryRecords: 0,
  monthlyRequests: 0,
}

const features = [
  {
    icon: Send,
    title: 'Easy Online Request',
    description: 'Submit service requests from anywhere, anytime — no need to visit the office in person.',
  },
  {
    icon: Search,
    title: 'Real-time Tracking',
    description: 'Monitor the progress of your requests and complaints with instant status updates.',
  },
  {
    icon: Bell,
    title: 'Email Notifications',
    description: 'Receive automatic email updates when your request status changes.',
  },
  {
    icon: Mail,
    title: 'Digital Certificates',
    description: 'Access and download your certificates digitally once they are processed.',
  },
]

const howItWorks = [
  {
    number: '01',
    title: 'Submit Request',
    description: 'Fill out the online form with your details and requirements.',
    icon: ClipboardList,
  },
  {
    number: '02',
    title: 'Processing',
    description: 'CSFD staff reviews and processes your request during office hours.',
    icon: Clock,
  },
  {
    number: '03',
    title: 'Notification',
    description: 'Receive email notification when your request has been processed.',
    icon: Bell,
  },
  {
    number: '04',
    title: 'Claim Certificate',
    description: 'Visit the CSFD office to claim your certificate or download it digitally.',
    icon: CheckCircle2,
  },
]

interface Announcement {
  id: string
  title: string
  body: string
  postedFrom: string
  postedTo: string
  isPinned: boolean
  fileUrl?: string | null
  createdAt?: string
}

function getFileType(url: string): 'image' | 'pdf' | 'word' | 'unknown' {
  // Check MIME type from data URLs (e.g., "data:image/png;base64,...")
  if (url.startsWith('data:')) {
    const mimeMatch = url.match(/^data:([^;]+);/);
    if (mimeMatch) {
      const mime = mimeMatch[1];
      if (mime.startsWith('image/')) return 'image';
      if (mime === 'application/pdf') return 'pdf';
      if (mime === 'application/msword' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'word';
    }
    return 'unknown';
  }
  
  // Extract the actual file path from serve-file API URLs
  // e.g., "/api/serve-file?file=%2Fuploads%2Ffile_12345_abc.jpg" → "/uploads/file_12345_abc.jpg"
  let filePath = url;
  if (url.startsWith('/api/serve-file')) {
    try {
      const urlObj = new URL(url, 'http://localhost');
      const fileParam = urlObj.searchParams.get('file');
      if (fileParam) filePath = fileParam;
    } catch {
      // If URL parsing fails, use original URL
    }
  }
  
  // Check file extension on the extracted path
  if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filePath)) return 'image';
  if (/\.pdf$/i.test(filePath)) return 'pdf';
  if (/\.(doc|docx)$/i.test(filePath)) return 'word';
  return 'unknown';
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return num.toLocaleString()
  }
  return num.toString()
}

export default function HomePage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [stats, setStats] = useState<StatsData>(defaultStats)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false)
  const [allAnnouncementsOpen, setAllAnnouncementsOpen] = useState(false)
  const [allAnnouncements, setAllAnnouncements] = useState<Announcement[]>([])
  const [allAnnouncementsLoading, setAllAnnouncementsLoading] = useState(false)

  useEffect(() => {
    fetch('/api/announcements?public=true&limit=6')
      .then(res => res.json())
      .then(data => {
        const items = Array.isArray(data) ? data : data?.data || []
        setAnnouncements(items.slice(0, 6))
      })
      .catch(() => setAnnouncements([]))
  }, [])

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setStats(data)
        }
      })
      .catch(() => {})
  }, [])

  const statsDisplay = [
    { value: formatNumber(stats.totalRequests), label: 'Total Requests Processed', icon: ClipboardList, suffix: '+' },
    { value: formatNumber(stats.certificatesIssued), label: 'Certificates Issued', icon: FileCheck2, suffix: '+' },
    { value: formatNumber(stats.activeStudents), label: 'Students Served', icon: Users, suffix: '+' },
    { value: formatNumber(stats.complaintsFiled), label: 'Complaints Filed', icon: BarChart3, suffix: '' },
  ]

  return (
    <div className="flex flex-col">
      {/* ═══ HERO SECTION ═══ */}
      <section className="relative overflow-hidden gradient-primary text-white min-h-[90vh] flex items-center">
        {/* Decorative elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[radial-gradient(ellipse,rgba(255,196,0,0.12),transparent_70%)]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[radial-gradient(ellipse,rgba(92,107,192,0.15),transparent_70%)]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(ellipse,rgba(255,255,255,0.03),transparent_60%)]" />
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
        </div>

        {/* Floating elements */}
        <div className="absolute top-20 right-[15%] w-3 h-3 rounded-full bg-umak-gold/30 animate-float" />
        <div className="absolute top-40 left-[10%] w-2 h-2 rounded-full bg-umak-gold/20 animate-float delay-200" />
        <div className="absolute bottom-32 right-[25%] w-4 h-4 rounded-full bg-white/10 animate-float delay-300" />
        <div className="absolute bottom-48 left-[20%] w-2 h-2 rounded-full bg-umak-gold/25 animate-float delay-500" />
        <div className="absolute top-[30%] right-[8%] size-8 rotate-45 rounded-lg bg-umak-gold/5 animate-float delay-150" />
        <div className="absolute top-[60%] left-[5%] size-6 rounded-full bg-white/5 animate-float delay-400" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36 w-full">
          <div className="max-w-3xl mx-auto text-center">
            {/* Logos centered */}
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

            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-8 animate-fade-in">
              <span className="size-2 rounded-full bg-umak-gold animate-pulse-soft" />
              <span className="text-sm font-medium text-white/90">
                University of Makati — Center for Student Formation and Discipline
              </span>
            </div>

            {/* Main heading */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight leading-[1.1] mb-6 animate-slide-up">
              Center for Student
              <br />
              <span className="text-umak-gold">Formation &amp; Discipline</span>
            </h1>

            <p className="text-lg sm:text-xl text-white/65 mb-4 leading-relaxed max-w-2xl mx-auto animate-slide-up delay-100">
              Streamlining service requests, complaint filing, disciplinary records,
              and announcements for the Center for Student Formation and Discipline.
            </p>

            <p className="text-base text-umak-gold/90 font-medium mb-10 animate-slide-up delay-150">
              University of Makati. University of Character.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap justify-center gap-4 animate-slide-up delay-200">
              <Button
                asChild
                size="lg"
                className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy font-semibold h-12 px-8 text-base"
              >
                <Link href="/complaint">
                  File a Complaint
                  <ArrowRight className="size-4 ml-2" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 hover:text-white h-12 px-8 text-base"
              >
                <Link href="/services">
                  Request a Service
                  <ArrowRight className="size-4 ml-2" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 hover:text-white h-12 px-6 text-base"
              >
                <Link href="/track">
                  <Search className="size-4 mr-2" />
                  Track Request
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Wave SVG Divider */}
      <div className="relative -mt-1">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
          <path d="M0 80V40C240 0 480 0 720 40C960 80 1200 80 1440 40V80H0Z" className="fill-background" />
        </svg>
      </div>

      {/* ═══ SERVICES SECTION ═══ */}
      <section className="py-20 sm:py-28 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-umak-gold font-semibold text-sm tracking-wider uppercase mb-3">
              What We Offer
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Our Services
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Access all CSFD services digitally — submit requests, file complaints, and track your applications anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => {
              const IconComp = service.IconComp
              return (
                <ServiceUnavailableOverlay key={service.title} serviceKey={service.serviceKey}>
                  <Link href={service.href} className="group">
                    <Card className="card-hover glass border-border/40 bg-card/80 h-full transition-all duration-300 group-hover:border-umak-gold/30 group-hover:shadow-lg group-hover:shadow-umak-gold/5">
                      <CardContent className="p-6 sm:p-7">
                        <div className={`size-14 rounded-2xl bg-gradient-to-br ${service.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                          <IconComp className={`size-7 ${service.iconColor}`} />
                        </div>
                        <h3 className="text-lg font-semibold mb-2 group-hover:text-umak-blue dark:group-hover:text-umak-gold transition-colors">
                          {service.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                          {service.description}
                        </p>
                        <span className="inline-flex items-center text-sm font-medium text-umak-blue dark:text-umak-gold">
                          {service.title === 'Service Tracker' ? 'Track Now' : service.title === 'File a Complaint' ? 'File Now' : 'Apply Now'}
                          <ChevronRight className="size-4 ml-1 group-hover:translate-x-1 transition-transform" />
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                </ServiceUnavailableOverlay>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══ STATS SECTION ═══ */}
      <section className="py-16 sm:py-20 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {statsDisplay.map((stat) => {
              const IconComp = stat.icon
              return (
                <Card key={stat.label} className="glass border-border/40 bg-card/80 text-center p-6">
                  <IconComp className="size-8 text-umak-blue dark:text-umak-gold mx-auto mb-3" />
                  <div className="text-3xl font-bold text-umak-blue dark:text-umak-gold mb-1">
                    {stat.value}{stat.suffix}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES SECTION ═══ */}
      <section className="py-20 sm:py-28" style={{ background: '#111c4e' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-umak-gold font-semibold text-sm tracking-wider uppercase mb-3">
              Why Choose CSFD Digital
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
              Platform Features
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Experience a modern, streamlined approach to CSFD services with our digital platform.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => {
              const IconComp = feature.icon
              return (
                <div key={feature.title} className="text-center group">
                  <div className="size-16 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mx-auto mb-5 group-hover:scale-110 group-hover:border-umak-gold/40 transition-all duration-300">
                    <IconComp className="size-7 text-umak-gold" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS SECTION ═══ */}
      <section className="py-20 sm:py-28 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-umak-gold font-semibold text-sm tracking-wider uppercase mb-3">
              Simple Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Getting your CSFD request processed is easy. Follow these four simple steps.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((step, index) => {
              const IconComp = step.icon
              return (
                <div key={step.number} className="relative group">
                  {/* Connector line */}
                  {index < howItWorks.length - 1 && (
                    <div className="hidden lg:block absolute top-10 left-[calc(50%+40px)] w-[calc(100%-40px)] h-px bg-gradient-to-r from-umak-gold/40 to-umak-gold/10" />
                  )}

                  <div className="text-center">
                    {/* Step number circle */}
                    <div className="relative inline-flex mb-6">
                      <div className="size-20 rounded-2xl bg-gradient-to-br from-umak-blue/10 to-umak-blue/5 dark:from-umak-gold/15 dark:to-umak-gold/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <IconComp className="size-9 text-umak-blue dark:text-umak-gold" />
                      </div>
                      <span className="absolute -top-2 -right-2 size-7 rounded-full bg-umak-gold text-umak-navy text-xs font-bold flex items-center justify-center">
                        {step.number}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="text-center mt-12">
            <Button
              asChild
              size="lg"
              className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy font-semibold h-12 px-8"
            >
              <Link href="/services">
                Get Started
                <ArrowRight className="size-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ═══ ANNOUNCEMENTS SECTION ═══ */}
      <section className="py-20 sm:py-28 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
            <div>
              <span className="inline-block text-umak-gold font-semibold text-sm tracking-wider uppercase mb-3">
                Stay Updated
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Latest Announcements
              </h2>
            </div>
          </div>

          {announcements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {announcements.map((announcement) => (
                <Card key={announcement.id} className="card-hover glass border-border/40 bg-card/80 flex flex-col">
                  <CardContent className="p-6 flex flex-col flex-1">
                    {/* Image thumbnail */}
                    {announcement.fileUrl && getFileType(announcement.fileUrl) === 'image' && (
                      <div className="mb-3 cursor-pointer" onClick={() => { setSelectedAnnouncement(announcement); setAnnouncementModalOpen(true); }}>
                        <img
                          src={getServeFileUrl(announcement.fileUrl) || announcement.fileUrl}
                          alt={announcement.title}
                          className="h-32 w-full object-cover rounded-lg"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      {announcement.isPinned && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-umak-gold">
                          <Star className="size-3 fill-current" /> Pinned
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(announcement.postedFrom).toLocaleDateString('en-PH', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold mb-2 line-clamp-2">
                      {announcement.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
                      {announcement.body}
                    </p>
                    {/* PDF attachment link in card */}
                    {announcement.fileUrl && getFileType(announcement.fileUrl) === 'pdf' && (
                      <button
                        type="button"
                        onClick={() => openFileUrl(announcement.fileUrl)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-umak-blue dark:text-umak-gold mt-3 hover:underline cursor-pointer"
                      >
                        <FileText className="size-4" />
                        View PDF
                      </button>
                    )}
                    {/* Word attachment link in card */}
                    {announcement.fileUrl && getFileType(announcement.fileUrl) === 'word' && (
                      <button
                        type="button"
                        onClick={() => openFileUrl(announcement.fileUrl, { download: true })}
                        className="inline-flex items-center gap-2 text-sm font-medium text-umak-blue dark:text-umak-gold mt-3 hover:underline cursor-pointer"
                      >
                        <Download className="size-4" />
                        Download
                      </button>
                    )}
                    <button
                      onClick={() => { setSelectedAnnouncement(announcement); setAnnouncementModalOpen(true); }}
                      className="inline-flex items-center text-sm font-medium text-umak-blue dark:text-umak-gold mt-4 hover:underline cursor-pointer"
                    >
                      Read More
                      <ChevronRight className="size-4 ml-1" />
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="glass border-border/40 bg-card/80">
              <CardContent className="py-12 text-center">
                <Megaphone className="size-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No announcements at the moment.</p>
              </CardContent>
            </Card>
          )}

          {/* View All Announcements Button */}
          {announcements.length > 0 && (
            <div className="text-center mt-8">
              <button
                onClick={async () => {
                  setAllAnnouncementsOpen(true)
                  setAllAnnouncementsLoading(true)
                  try {
                    const res = await fetch('/api/announcements?public=true&limit=100')
                    const data = await res.json()
                    const items = Array.isArray(data) ? data : data?.data || []
                    setAllAnnouncements(items)
                  } catch {
                    setAllAnnouncements([])
                  } finally {
                    setAllAnnouncementsLoading(false)
                  }
                }}
                className="text-sm text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                View All Announcements
                <ArrowRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ═══ VIEW ALL ANNOUNCEMENTS MODAL ═══ */}
      <Dialog open={allAnnouncementsOpen} onOpenChange={setAllAnnouncementsOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              All Announcements
            </DialogTitle>
            <DialogDescription className="sr-only">
              Browse all public announcements
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 -mr-1 min-h-0">
            {allAnnouncementsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="size-8 border-4 border-muted-foreground/20 border-t-primary rounded-full animate-spin" />
              </div>
            ) : allAnnouncements.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {allAnnouncements.map((announcement) => (
                  <Card key={announcement.id} className="card-hover glass border-border/40 bg-card/80">
                    <CardContent className="p-5">
                      <div className="flex gap-4">
                        {/* Image thumbnail */}
                        {announcement.fileUrl && getFileType(announcement.fileUrl) === 'image' && (
                          <div
                            className="shrink-0 cursor-pointer"
                            onClick={() => {
                              setSelectedAnnouncement(announcement)
                              setAnnouncementModalOpen(true)
                            }}
                          >
                            <img
                              src={getServeFileUrl(announcement.fileUrl) || announcement.fileUrl}
                              alt={announcement.title}
                              className="h-24 w-32 object-cover rounded-lg"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {announcement.isPinned && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-umak-gold">
                                <Star className="size-3 fill-current" /> Pinned
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {new Date(announcement.postedFrom).toLocaleDateString('en-PH', {
                                year: 'numeric', month: 'long', day: 'numeric'
                              })}
                            </span>
                          </div>
                          <h3 className="text-base font-semibold mb-1 line-clamp-2">
                            {announcement.title}
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                            {announcement.body}
                          </p>
                          <div className="flex items-center gap-4 mt-3">
                            {/* PDF attachment link */}
                            {announcement.fileUrl && getFileType(announcement.fileUrl) === 'pdf' && (
                              <button
                                type="button"
                                onClick={() => openFileUrl(announcement.fileUrl)}
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-umak-blue dark:text-umak-gold hover:underline cursor-pointer"
                              >
                                <FileText className="size-3.5" />
                                View PDF
                              </button>
                            )}
                            {/* Word attachment link */}
                            {announcement.fileUrl && getFileType(announcement.fileUrl) === 'word' && (
                              <button
                                type="button"
                                onClick={() => openFileUrl(announcement.fileUrl, { download: true })}
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-umak-blue dark:text-umak-gold hover:underline cursor-pointer"
                              >
                                <Download className="size-3.5" />
                                Download
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedAnnouncement(announcement)
                                setAnnouncementModalOpen(true)
                              }}
                              className="inline-flex items-center text-sm font-medium text-umak-blue dark:text-umak-gold hover:underline cursor-pointer"
                            >
                              Read More
                              <ChevronRight className="size-4 ml-0.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Megaphone className="size-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No announcements at the moment.</p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => setAllAnnouncementsOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ ANNOUNCEMENT DETAIL MODAL ═══ */}
      <Dialog open={announcementModalOpen} onOpenChange={setAnnouncementModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold pr-8">
              {selectedAnnouncement?.title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Announcement details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date Range */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="size-4" />
              <span>
                {selectedAnnouncement?.postedFrom &&
                  new Date(selectedAnnouncement.postedFrom).toLocaleDateString('en-PH', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })
                }
                {selectedAnnouncement?.postedTo &&
                  ` — ${new Date(selectedAnnouncement.postedTo).toLocaleDateString('en-PH', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}`
                }
              </span>
            </div>

            {/* Pinned badge */}
            {selectedAnnouncement?.isPinned && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-umak-gold bg-umak-gold/10 px-2 py-1 rounded-full w-fit">
                <Star className="size-3 fill-current" /> Pinned
              </span>
            )}

            {/* Full Body */}
            <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {selectedAnnouncement?.body}
            </div>

            {/* File Attachment */}
            {selectedAnnouncement?.fileUrl && (() => {
              const fileType = getFileType(selectedAnnouncement.fileUrl!)
              const fileUrl = selectedAnnouncement.fileUrl!
              if (fileType === 'image') {
                return (
                  <div className="mt-2">
                    <img
                      src={getServeFileUrl(fileUrl) || fileUrl}
                      alt={selectedAnnouncement.title}
                      className="w-full rounded-lg"
                    />
                  </div>
                )
              }
              if (fileType === 'pdf') {
                return (
                  <button
                    type="button"
                    onClick={() => openFileUrl(fileUrl)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-umak-blue dark:text-umak-gold hover:underline mt-2 cursor-pointer"
                  >
                    <FileText className="size-4" />
                    View PDF
                  </button>
                )
              }
              if (fileType === 'word') {
                return (
                  <button
                    type="button"
                    onClick={() => openFileUrl(fileUrl, { download: true })}
                    className="inline-flex items-center gap-2 text-sm font-medium text-umak-blue dark:text-umak-gold hover:underline mt-2 cursor-pointer"
                  >
                    <Download className="size-4" />
                    Download
                  </button>
                )
              }
              // unknown file type — fall back to generic button
              return (
                <button
                  type="button"
                  onClick={() => openFileUrl(fileUrl)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-umak-blue dark:text-umak-gold hover:underline mt-2 cursor-pointer"
                >
                  <Paperclip className="size-4" />
                  View Attachment
                </button>
              )
            })()}
          </div>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => setAnnouncementModalOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ CTA / TRACK SECTION ═══ */}
      <section className="py-20 sm:py-28 gradient-primary text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(255,196,0,0.1),transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Need to Track a Request?
          </h2>
          <p className="text-white/70 text-lg max-w-xl mx-auto mb-8">
            Enter your request or complaint number along with your tracking token
            to check the current status of your submission.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="bg-umak-gold hover:bg-umak-gold-hover text-umak-navy font-semibold h-12 px-8"
            >
              <Link href="/track">
                <Search className="size-4 mr-2" />
                Track My Request
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 hover:text-white h-12 px-8"
            >
              <Link href="/services">
                View All Services
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
