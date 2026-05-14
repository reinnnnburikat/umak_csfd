import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Fix DATABASE_URL at module load time — BEFORE PrismaClient is created.
 *
 * The sandbox system environment may set DATABASE_URL to a stale SQLite path
 * (e.g., file:/home/z/my-project/db/custom.db), which overrides the .env
 * file's PostgreSQL URL. Prisma validates the URL when PrismaClient is
 * instantiated, so we must fix process.env.DATABASE_URL synchronously
 * before that happens.
 *
 * This runs at import time (before any function call), ensuring the env var
 * is correct even when Turbopack hot-reloads the module.
 */
function fixDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL || ''

  // Already PostgreSQL — nothing to fix
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    return dbUrl
  }

  // SQLite or empty — read the correct URL from .env
  if (dbUrl.startsWith('file:') || !dbUrl) {
    try {
      const envPath = resolve(process.cwd(), '.env')
      const envContent = readFileSync(envPath, 'utf-8')

      const pgUrlMatch = envContent.match(/^DATABASE_URL\s*=\s*(postgresql:\/\/[^\s]+)/m)
      if (pgUrlMatch) {
        process.env.DATABASE_URL = pgUrlMatch[1]
        console.log('[DB] Fixed DATABASE_URL: overrode stale SQLite path with PostgreSQL URL from .env')
        return pgUrlMatch[1]
      }

      const directMatch = envContent.match(/^DIRECT_DATABASE_URL\s*=\s*(postgresql:\/\/[^\s]+)/m)
      if (directMatch) {
        process.env.DATABASE_URL = directMatch[1]
        console.log('[DB] Fixed DATABASE_URL: using DIRECT_DATABASE_URL from .env')
        return directMatch[1]
      }
    } catch {
      // .env not found — proceed with what we have
    }
  }

  return dbUrl
}

// Fix the env var IMMEDIATELY at module load time (synchronous, before PrismaClient)
const effectiveDbUrl = fixDatabaseUrl()

function createPrismaClient(): PrismaClient {
  // PostgreSQL (Vercel/Supabase): Use @prisma/adapter-pg to bypass Prisma's
  // internal connection pool and prepared statement caching.
  // This fixes PostgreSQL error 42P05 "prepared statement already exists"
  // which occurs when Prisma's prepared statements conflict with PgBouncer.
  if (effectiveDbUrl && !effectiveDbUrl.startsWith('file:')) {
    const pool = new Pool({
      connectionString: effectiveDbUrl,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
    })
    const adapter = new PrismaPg(pool)
    return new PrismaClient({ adapter, log: ['error'] })
  }

  // SQLite (local development)
  return new PrismaClient({ log: ['error'] })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
