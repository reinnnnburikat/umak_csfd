import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { resolve } from "path";

// Fix DATABASE_URL BEFORE Next.js starts — the sandbox system environment
// may set DATABASE_URL to a stale SQLite path, overriding the .env file.
// This runs at config load time, before any Prisma module.
function fixDatabaseUrlFromEnv(): void {
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    return; // Already correct
  }

  try {
    const envPath = resolve(process.cwd(), '.env');
    const envContent = readFileSync(envPath, 'utf-8');

    const pgUrlMatch = envContent.match(/^DATABASE_URL\s*=\s*(postgresql:\/\/[^\s]+)/m);
    if (pgUrlMatch) {
      process.env.DATABASE_URL = pgUrlMatch[1];
      console.log('[next.config] Fixed DATABASE_URL: overrode stale SQLite path with PostgreSQL URL from .env');
      return;
    }

    const directMatch = envContent.match(/^DIRECT_DATABASE_URL\s*=\s*(postgresql:\/\/[^\s]+)/m);
    if (directMatch) {
      process.env.DATABASE_URL = directMatch[1];
      console.log('[next.config] Fixed DATABASE_URL: using DIRECT_DATABASE_URL from .env');
      return;
    }
  } catch {
    // .env not found
  }
}

// Fix the env var at Next.js config load time — BEFORE anything else runs
fixDatabaseUrlFromEnv();

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  serverExternalPackages: ['pdfkit'],
  allowedDevOrigins: ['*'],
};

export default nextConfig;
