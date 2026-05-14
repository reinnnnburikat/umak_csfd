'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/layout/theme-toggle';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/faqs', label: 'FAQs' },
];

export function PublicNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-nav">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo + Brand */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <Image
                src="/logos/UMAK LOGO.png"
                alt="University of Makati Logo"
                width={36}
                height={36}
                className="object-contain"
              />
              <Image
                src="/logos/CSFD LOGO.png"
                alt="CSFD Logo"
                width={36}
                height={36}
                className="object-contain"
              />
            </div>
            <span className="text-xs sm:text-sm font-bold text-umak-blue dark:text-umak-gold tracking-tight whitespace-nowrap">
              Center for Student Formation &amp; Discipline
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    isActive
                      ? 'text-umak-blue dark:text-umak-gold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4/5 h-0.5 bg-umak-gold rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right Actions - only theme toggle */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            {/* Mobile Hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="size-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
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
                    <span className="text-xs font-bold text-umak-blue dark:text-umak-gold whitespace-nowrap">
                      Center for Student Formation &amp; Discipline
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-1 mt-4">
                  {navLinks.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                      <SheetClose asChild key={link.href}>
                        <Link
                          href={link.href}
                          className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                            isActive
                              ? 'bg-umak-blue/10 text-umak-blue dark:text-umak-gold border-l-2 border-umak-gold'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {link.label}
                        </Link>
                      </SheetClose>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
    </header>
  );
}
