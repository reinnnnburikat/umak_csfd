'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, XCircle, Loader2, Database, ArrowRight, RefreshCw } from 'lucide-react'

type SetupStatus = 'idle' | 'checking' | 'setting_up' | 'success' | 'error'

export default function SetupPage() {
  const [status, setStatus] = useState<SetupStatus>('idle')
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; userCount?: number; error?: string } | null>(null)
  const [setupResult, setSetupResult] = useState<{ message: string; credentials?: Record<string, string>; tablesCreated?: boolean } | null>(null)

  async function checkDatabase() {
    setStatus('checking')
    try {
      const res = await fetch('/api/setup')
      const data = await res.json()
      if (data.status === 'connected') {
        setDbStatus({ connected: true, userCount: data.userCount })
      } else {
        setDbStatus({ connected: false, error: data.error || data.hint || 'Unknown error' })
      }
    } catch (err) {
      setDbStatus({ connected: false, error: err instanceof Error ? err.message : 'Failed to reach API' })
    }
    setStatus('idle')
  }

  async function runSetup() {
    setStatus('setting_up')
    setSetupResult(null)
    try {
      const res = await fetch('/api/setup', { method: 'POST' })
      const data = await res.json()

      if (data.status === 'setup_complete' || data.status === 'already_seeded') {
        setSetupResult({
          message: data.message || 'Setup complete!',
          credentials: data.loginCredentials,
          tablesCreated: data.tablesCreated,
        })
        setDbStatus({ connected: true, userCount: data.users?.length || data.userCount || 0 })
        setStatus('success')
      } else {
        setSetupResult({
          message: data.error || 'Unknown error occurred',
        })
        setStatus('error')
      }
    } catch (err) {
      setSetupResult({
        message: err instanceof Error ? err.message : 'Failed to reach API',
      })
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8" style={{ background: '#111c4e' }}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="relative size-14 rounded-full border-2 border-umak-gold/50 shadow-[0_0_16px_rgba(255,196,0,0.25)] overflow-hidden bg-white/10">
              <Image
                src="/logos/UMAK LOGO.png"
                alt="University of Makati"
                fill
                className="object-contain p-1"
              />
            </div>
            <div className="relative size-14 rounded-full border-2 border-umak-gold/50 shadow-[0_0_16px_rgba(255,196,0,0.25)] overflow-hidden bg-white/10">
              <Image
                src="/logos/CSFD LOGO.png"
                alt="CSFD"
                fill
                className="object-contain p-1"
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">
            iCSFD+ <span className="text-umak-gold">Database Setup</span>
          </h1>
          <p className="mt-2 text-white/60 text-sm">
            Initialize your Supabase database with tables and seed data
          </p>
        </div>

        {/* Setup Card */}
        <Card className="border-border/50 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-5 text-umak-gold" />
              Database Initialization
            </CardTitle>
            <CardDescription>
              This will create all required tables in Supabase and populate them with default data (users, announcements, managed lists, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1: Check Connection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Step 1: Check Database Connection</span>
                {dbStatus?.connected && <CheckCircle2 className="size-5 text-emerald-500" />}
                {dbStatus && !dbStatus.connected && <XCircle className="size-5 text-destructive" />}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={checkDatabase}
                disabled={status === 'checking' || status === 'setting_up'}
              >
                {status === 'checking' ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-4" />
                    Check Connection
                  </>
                )}
              </Button>
              {dbStatus?.connected && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  ✅ Connected! {dbStatus.userCount !== undefined && `${dbStatus.userCount} user(s) found.`}
                </p>
              )}
              {dbStatus && !dbStatus.connected && (
                <p className="text-sm text-destructive">
                  ❌ {dbStatus.error}
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t" />

            {/* Step 2: Run Setup */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Step 2: Create Tables & Seed Data</span>
                {status === 'success' && <CheckCircle2 className="size-5 text-emerald-500" />}
              </div>
              <Button
                className="w-full bg-umak-blue hover:bg-umak-blue-hover text-white"
                onClick={runSetup}
                disabled={status === 'setting_up' || status === 'checking'}
              >
                {status === 'setting_up' ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Setting up database...
                  </>
                ) : (
                  <>
                    <Database className="size-4" />
                    Initialize Database
                  </>
                )}
              </Button>
            </div>

            {/* Result */}
            {setupResult && (
              <div className={`rounded-lg border p-4 text-sm ${
                status === 'success'
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50'
                  : 'border-destructive/30 bg-destructive/5'
              }`}>
                {status === 'success' ? (
                  <>
                    <p className="font-medium text-emerald-700 dark:text-emerald-300 mb-2">
                      {setupResult.message}
                    </p>
                    {setupResult.tablesCreated && (
                      <p className="text-emerald-600 dark:text-emerald-400 text-xs mb-2">
                        All database tables were created successfully.
                      </p>
                    )}
                    {setupResult.credentials && (
                      <div className="mt-3 space-y-1">
                        <p className="font-semibold text-emerald-700 dark:text-emerald-300">Login Credentials:</p>
                        {Object.entries(setupResult.credentials).map(([role, creds]) => (
                          <p key={role} className="text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                            {role}: {creds}
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-destructive">
                    ❌ {setupResult.message}
                  </p>
                )}
              </div>
            )}

            {/* Go to Login */}
            {status === 'success' && (
              <Link href="/login" className="block">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-2">
                  Go to Login
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Footer note */}
        <p className="text-center text-white/40 text-xs mt-6">
          This setup only needs to be run once. After initialization, your database is ready for use.
        </p>
      </div>
    </div>
  )
}
