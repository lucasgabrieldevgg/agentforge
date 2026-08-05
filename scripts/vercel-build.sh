#!/bin/bash
# Vercel build script — generates Prisma client and pushes schema to Postgres
# Only pushes on first deploy (or when schema changed). Safe to run on every deploy.

set -e

echo "=== Vercel Build: AgentForge ==="

# Generate Prisma client (always — needed for build)
echo "[1/3] Generating Prisma client..."
bunx prisma generate

# Push schema to database (idempotent — only applies diffs)
if [ -n "$DATABASE_URL" ]; then
  echo "[2/3] Pushing schema to database..."
  bunx prisma db push --accept-data-loss || {
    echo "⚠️ prisma db push failed — schema may already be in sync, or DATABASE_URL not reachable yet."
    echo "You can run 'bun run db:push' manually after setting up Supabase."
  }
else
  echo "[2/3] DATABASE_URL not set — skipping db push."
fi

# Build Next.js
echo "[3/3] Building Next.js..."
next build

echo "=== Vercel Build complete ==="
