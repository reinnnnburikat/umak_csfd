const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Schema is PostgreSQL by default (Supabase)
// SQLite schema is preserved in prisma/schema.sqlite.prisma for local dev if needed

// Generate Prisma client
console.log('📦 Generating Prisma client...');
execSync('npx prisma generate', { stdio: 'inherit' });

// Note: Tables are created at runtime via POST /api/setup (using raw SQL through pooler)
// prisma db push cannot run during build because Supabase pooler URLs don't support DDL

// Build Next.js
console.log('🏗️  Building Next.js...');
execSync('npx next build', { stdio: 'inherit' });
