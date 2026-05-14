export async function register() {
  // Fix DATABASE_URL BEFORE any Prisma import
  // The sandbox system environment may set DATABASE_URL to a stale SQLite path
  // (e.g., file:/home/z/my-project/db/custom.db), which overrides the .env
  // file's PostgreSQL URL. Prisma validates the URL at schema load time,
  // so we must fix process.env.DATABASE_URL before any PrismaClient is created.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const dbUrl = process.env.DATABASE_URL || '';

    // If DATABASE_URL points to SQLite but we should be using PostgreSQL
    if (dbUrl.startsWith('file:') || !dbUrl) {
      try {
        const { readFileSync } = await import('fs');
        const { resolve } = await import('path');
        const envPath = resolve(process.cwd(), '.env');
        const envContent = readFileSync(envPath, 'utf-8');

        // Read DATABASE_URL from .env file
        const pgUrlMatch = envContent.match(/^DATABASE_URL\s*=\s*(postgresql:\/\/[^\s]+)/m);
        if (pgUrlMatch) {
          process.env.DATABASE_URL = pgUrlMatch[1];
          console.log('[Instrumentation] Fixed DATABASE_URL: overrode stale SQLite path with PostgreSQL URL from .env');
        } else {
          // Try DIRECT_DATABASE_URL as fallback
          const directMatch = envContent.match(/^DIRECT_DATABASE_URL\s*=\s*(postgresql:\/\/[^\s]+)/m);
          if (directMatch) {
            process.env.DATABASE_URL = directMatch[1];
            console.log('[Instrumentation] Fixed DATABASE_URL: using DIRECT_DATABASE_URL from .env');
          }
        }
      } catch {
        // .env not found — proceed with what we have
      }
    }

    // Run database auto-migration on startup to ensure all columns exist
    try {
      const { runAutoMigration } = await import('@/lib/db-migrate');
      await runAutoMigration();
    } catch (error) {
      console.error('[Instrumentation] Failed to run auto-migration:', error);
    }
  }
}
