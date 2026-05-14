'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Implement actual forgot password API endpoint
      // For now, simulate a successful submission
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setIsSubmitted(true);
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center gap-1.5">
            <Image
              src="/logos/UMAK LOGO.png"
              alt="UMak"
              width={36}
              height={36}
              className="object-contain"
            />
            <Image
              src="/logos/CSFD LOGO.png"
              alt="CSFD"
              width={36}
              height={36}
              className="object-contain"
            />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-bold text-foreground leading-none">CENTER FOR STUDENT</span>
            <span className="text-[10px] font-bold text-umak-gold leading-none">FORMATION &amp; DISCIPLINE</span>
          </div>
        </div>

        {isSubmitted ? (
          <Card className="border-border/50 animate-fade-in">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/30">
                <CheckCircle2 className="size-7 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                Check Your Email
              </h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                If an account exists for <span className="font-medium text-foreground">{email}</span>,
                you will receive a password reset link shortly.
              </p>
              <Button
                asChild
                variant="outline"
                className="gap-2"
              >
                <Link href="/login">
                  <ArrowLeft className="size-4" />
                  Back to Login
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50 animate-fade-in">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-bold tracking-tight">
                Forgot Password
              </CardTitle>
              <CardDescription className="mt-2">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {error && (
                <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive animate-fade-in">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@umak.edu.ph"
                      className="pl-10"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-umak-blue hover:bg-umak-blue-hover text-white h-11 text-base font-medium"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft className="size-3" />
                  Back to Login
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
