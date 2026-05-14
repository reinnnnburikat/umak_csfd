import Link from 'next/link';
import Image from 'next/image';
import { Globe, Phone, Mail, MapPin, Facebook } from 'lucide-react';

const quickLinks = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/faqs', label: 'FAQs' },
  { href: '/track', label: 'Track Request' },
];

export function Footer() {
  return (
    <footer className="gradient-dark text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {/* Column 1: Logo + Info */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5">
                <Image
                  src="/logos/UMAK LOGO.png"
                  alt="UMak"
                  width={28}
                  height={28}
                  className="object-contain"
                />
                <Image
                  src="/logos/CSFD LOGO.png"
                  alt="CSFD"
                  width={28}
                  height={28}
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] font-bold text-white leading-none">CENTER FOR STUDENT</span>
                <span className="text-[11px] font-bold text-umak-gold leading-none">FORMATION &amp; DISCIPLINE</span>
              </div>
            </div>
            <p className="text-white/80 text-sm font-medium mb-2">
              Center for Student Formation and Discipline
            </p>
            <p className="text-white/50 text-sm leading-relaxed">
              The digital management system for the University of Makati CSFD — streamlining
              service requests, complaints, disciplinary records, and more.
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-umak-gold uppercase tracking-wider mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/60 hover:text-umak-gold text-sm transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Contact Info */}
          <div>
            <h3 className="text-sm font-semibold text-umak-gold uppercase tracking-wider mb-4">
              Contact Info
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <MapPin className="size-4 text-umak-gold/70 shrink-0 mt-0.5" />
                <span className="text-white/60 text-sm">
                  University of Makati, J.P. Rizal Extension, West Rembo, Makati City 1210
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-4 text-umak-gold/70 shrink-0" />
                <span className="text-white/60 text-sm">8883-1875 loc. 2101</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4 text-umak-gold/70 shrink-0" />
                <span className="text-white/60 text-sm">csfd@umak.edu.ph</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4 text-umak-gold/70 shrink-0" />
                <span className="text-white/60 text-sm">csfdgoodmoral@umak.edu.ph</span>
              </li>
              <li className="flex items-center gap-2">
                <Globe className="size-4 text-umak-gold/70 shrink-0" />
                <span className="text-white/60 text-sm">csfd.umak.edu.ph</span>
              </li>
              <li className="flex items-center gap-2">
                <Facebook className="size-4 text-umak-gold/70 shrink-0" />
                <a
                  href="https://facebook.com/UMakCSFD"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-umak-gold text-sm transition-colors"
                >
                  facebook.com/UMakCSFD
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-6 border-t border-white/10">
          <p className="text-white/40 text-xs text-center">
            &copy; 2025 University of Makati &mdash; CSFD. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
