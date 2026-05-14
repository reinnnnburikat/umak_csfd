import { Pool, type PoolConfig } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Raw PostgreSQL pool for DDL operations.
 *
 * WHY THIS EXISTS:
 * Prisma's $executeRawUnsafe() uses prepared statements that conflict with
 * Supabase's PgBouncer connection pooler, causing error 42P05:
 * "prepared statement already exists".
 *
 * This module uses the native `pg` library directly, bypassing Prisma's
 * connection pooling and prepared statement caching entirely.
 *
 * Used by db-setup.ts and api/setup/route.ts for table creation.
 */

let pool: Pool | null = null;

/**
 * Get the effective DATABASE_URL, fixing stale SQLite paths at module load time.
 * Mirrors the logic in db.ts.
 */
function getEffectiveDatabaseUrl(): string {
  let dbUrl = process.env.DATABASE_URL || '';

  // If already PostgreSQL, use as-is
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    return dbUrl;
  }

  // If SQLite or empty, try reading PostgreSQL URL from .env
  if (dbUrl.startsWith('file:') || !dbUrl) {
    try {
      const envPath = resolve(process.cwd(), '.env');
      const envContent = readFileSync(envPath, 'utf-8');
      const pgUrlMatch = envContent.match(/^DATABASE_URL\s*=\s*(postgresql:\/\/[^\s]+)/m);
      if (pgUrlMatch) {
        process.env.DATABASE_URL = pgUrlMatch[1];
        return pgUrlMatch[1];
      }
    } catch {
      // .env not found — proceed with what we have
    }
  }

  return dbUrl;
}

/**
 * Read DIRECT_DATABASE_URL from .env if system env is stale.
 */
function getEffectiveDirectUrl(): string {
  let directUrl = process.env.DIRECT_DATABASE_URL || '';
  if (directUrl.startsWith('postgresql://') || directUrl.startsWith('postgres://')) {
    return directUrl;
  }
  try {
    const envPath = resolve(process.cwd(), '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    const match = envContent.match(/^DIRECT_DATABASE_URL\s*=\s*(postgresql:\/\/[^\s]+)/m);
    if (match) {
      process.env.DIRECT_DATABASE_URL = match[1];
      return match[1];
    }
  } catch {}
  return directUrl;
}

function getPool(): Pool | null {
  const dbUrl = getEffectiveDatabaseUrl();

  // Not PostgreSQL — nothing to do (local SQLite)
  if (!dbUrl || dbUrl.startsWith('file:')) return null;

  if (!pool) {
    const directUrl = getEffectiveDirectUrl();
    const connectionString = directUrl || dbUrl;
    const config: PoolConfig = {
      connectionString,
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
    };
    pool = new Pool(config);
  }

  return pool;
}

/**
 * Execute raw DDL/DML SQL on PostgreSQL using a direct connection.
 * Bypasses Prisma entirely — no prepared statement issues with PgBouncer.
 */
export async function rawQuery(sql: string): Promise<void> {
  const p = getPool();
  if (!p) throw new Error('rawQuery: not a PostgreSQL database');

  const client = await p.connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }
}

/**
 * Check if this is a PostgreSQL database (not local SQLite).
 */
export function isPostgres(): boolean {
  const dbUrl = getEffectiveDatabaseUrl();
  return !!dbUrl && !dbUrl.startsWith('file:');
}
