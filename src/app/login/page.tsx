'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { User, Lock, Eye, EyeOff, Loader2, AlertTriangle, Database } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required').min(6, 'Password must be at least 6 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

const roleRedirects: Record<string, string> = {
  superadmin: '/dashboard',
  admin: '/dashboard',
  staff: '/dashboard',
}

function LoginFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [dbNeedsSetup, setDbNeedsSetup] = useState(false)
  const [isCheckingDb, setIsCheckingDb] = useState(true)

  // Check URL error params
  useEffect(() => {
    const urlError = searchParams.get('error')
    if (urlError) {
      setError(decodeURIComponent(urlError))
    }
  }, [searchParams])

  // Check if database needs setup (tables, users, OR missing data)
  useEffect(() => {
    async function checkDb() {
      try {
        const res = await fetch('/api/setup')
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'no_tables' || (data.status === 'connected' && data.userCount === 0)) {
            setDbNeedsSetup(true)
          } else if (data.status === 'connected' && data.userCount > 0 && data.dataCounts) {
            // Tables exist with users — check if data needs restoration
            const dc = data.dataCounts
            const hasAnyData = (dc.requests || 0) + (dc.complaints || 0) + (dc.announcements || 0) + (dc.disciplinary || 0)
            if (hasAnyData === 0) {
              setDbNeedsSetup(true)
            }
          }
        }
      } catch {
        // Ignore
      } finally {
        setIsCheckingDb(false)
      }
    }
    checkDb()
  }, [])

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: LoginForm) {
    setError(null)
    setIsLoading(true)

    try {
      const email = data.email.trim().toLowerCase()
      const password = data.password

      console.log('[Login] attempting sign in for:', email)

      // Single-step login: POST to /api/auth/login which validates credentials
      // and sets the JWT cookie automatically
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const loginData = await loginRes.json()

      if (!loginRes.ok || !loginData.success) {
        console.log('[Login] login failed:', loginData.error, loginData.code)
        
        // If database is not ready, auto-trigger setup
        if (loginData.code === 'DB_NOT_READY') {
          setDbNeedsSetup(true)
          setError('Database is not yet initialized. Please click "Initialize Database" below to set up.')
          setIsLoading(false)
          return
        }
        
        const errorMsg = loginData.error || 'Invalid email or password. Please try again.'
        setError(errorMsg)
        setIsLoading(false)
        return
      }

      console.log('[Login] login successful for:', email, 'role:', loginData.user?.role)

      // Session is now established via httpOnly cookie
      // Redirect based on role
      const role = loginData.user?.role as string | undefined
      const redirectPath = role ? roleRedirects[role] || '/dashboard' : '/dashboard'

      router.push(redirectPath)
      router.refresh()
    } catch (err) {
      console.error('[Login] unexpected error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSetup() {
    try {
      // Step 1: Create tables + seed users
      const res = await fetch('/api/setup', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        alert('Setup failed: ' + (data.error || data.message || 'Unknown error'))
        return
      }

      // Step 2: Restore system announcements (only real institutional data)
      const restoreRes = await fetch('/api/setup/restore-data', { method: 'POST' })
      if (restoreRes.ok) {
        const restoreData = await restoreRes.json()
        console.log('[Setup] Restore result:', restoreData)
      } else {
        console.error('[Setup] Restore failed:', await restoreRes.text())
      }

      setDbNeedsSetup(false)
      setError(null)
      alert('Database setup complete! You can now log in.')
    } catch {
      alert('Setup failed: Could not connect to the server.')
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left Panel: Decorative ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center" style={{ background: '#111c4e' }}>
        {/* Decorative shapes */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/5 animate-float" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-white/3 animate-float delay-300" />
          <div className="absolute top-1/3 right-1/4 w-16 h-16 rotate-45 rounded-lg bg-umak-gold/10 animate-float delay-200" />
          <div className="absolute bottom-1/4 left-1/3 w-6 h-6 rounded-full bg-umak-gold/15 animate-float delay-500" />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative z-10 px-12 text-center">
          {/* Logos */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="relative size-20 rounded-full border-2 border-umak-gold/50 shadow-[0_0_16px_rgba(255,196,0,0.25)] overflow-hidden bg-white/10">
              <Image
                src="/logos/UMAK LOGO.png"
                alt="University of Makati"
                fill
                className="object-contain p-1.5"
              />
            </div>
            <div className="relative size-20 rounded-full border-2 border-umak-gold/50 shadow-[0_0_16px_rgba(255,196,0,0.25)] overflow-hidden bg-white/10">
              <Image
                src="/logos/CSFD LOGO.png"
                alt="CSFD"
                fill
                className="object-contain p-1.5"
              />
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
            Welcome back,<br />
            <span className="text-umak-gold">Heron!</span>
          </h1>
          <p className="mt-4 text-lg text-white/60 max-w-sm mx-auto">
            Your gateway to CSFD services — streamlined, digital, and always accessible.
          </p>

          {/* Decorative line */}
          <div className="mt-8 mx-auto w-24 h-1 gradient-gold rounded-full" />
        </div>
      </div>

      {/* ── Right Panel: Login Form ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="flex items-center gap-1.5">
              <Image
                src="/logos/UMAK LOGO.png"
                alt="UMak"
                width={32}
                height={32}
                className="object-contain"
              />
              <Image
                src="/logos/CSFD LOGO.png"
                alt="CSFD"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-bold text-foreground leading-none">CENTER FOR STUDENT</span>
              <span className="text-[10px] font-bold text-umak-gold leading-none">FORMATION &amp; DISCIPLINE</span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              LOGIN
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your credentials to access your account
            </p>
          </div>

          {/* Database Setup Warning */}
          {dbNeedsSetup && (
            <div className="mb-6 rounded-lg border border-amber-300 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
              <div className="flex items-start gap-3">
                <Database className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Database Setup Required
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    Click below to initialize the database with default admin credentials and system announcements.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2 bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={handleSetup}
                  >
                    Initialize Database
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive animate-fade-in">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p>{error}</p>
                  {error.includes('Invalid email or password') && (
                    <p className="text-xs mt-1 text-destructive/80">
                      Make sure your email and password are correct. Contact CSFD if you need help.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Email Field */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          placeholder="you@umak.edu.ph"
                          type="email"
                          className="pl-10"
                          autoComplete="email"
                          disabled={isLoading}
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Password Field */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Link
                        href="/forgot-password"
                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          placeholder="Enter your password"
                          type={showPassword ? 'text' : 'password'}
                          className="pl-10 pr-10"
                          autoComplete="current-password"
                          disabled={isLoading}
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-umak-blue hover:bg-umak-blue-hover text-white border-0 h-11 text-base font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </Form>

          {/* Info */}
          <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground text-center">
              For students: No account needed. Use our{' '}
              <Link href="/services" className="text-primary hover:underline">services</Link> or{' '}
              <Link href="/complaint" className="text-primary hover:underline">file a complaint</Link> directly.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <Loader2 className="size-6 animate-spin text-umak-blue" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    }>
      <LoginFormContent />
    </Suspense>
  )
}
