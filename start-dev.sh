#!/bin/bash
# Start script for UMak CSFD development servers
# Ensures DATABASE_URL points to Supabase (overrides system env)

export DATABASE_URL="postgresql://postgres.nqbswodpygegaqdzjokr:T7VBtBFB5ska1Tnz@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"
export DIRECT_DATABASE_URL="postgresql://postgres.nqbswodpygegaqdzjokr:T7VBtBFB5ska1Tnz@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"

cd /home/z/my-project

# Start Next.js dev server
bun run dev
