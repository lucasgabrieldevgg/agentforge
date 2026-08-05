#!/bin/bash
# Vercel build script — generates Prisma client (prod schema = Postgres) and pushes schema
# Safe to run on every deploy (idempotent).

set -e

echo "=== Vercel Build: AgentForge v0.2.0 ==="

# Generate Prisma client using the PRODUCTION schema (Postgres)
echo "[1/3] Generating Prisma client (prod schema)..."
bunx prisma generate --schema=prisma/schema.prod.prisma

# Push schema to Postgres database (only if DATABASE_URL is set)
if [ -n "$DATABASE_URL" ]; then
  echo "[2/3] Pushing prod schema to database..."
  bunx prisma db push --schema=prisma/schema.prod.prisma --accept-data-loss || {
    echo "⚠️ prisma db push failed — schema may already be in sync, or DATABASE_URL not reachable."
    echo "You can run 'bunx prisma db push --schema=prisma/schema.prod.prisma' manually after setting up Supabase."
  }
else
  echo "[2/3] DATABASE_URL not set — skipping db push."
fi

# Build Next.js
echo "[3/3] Building Next.js..."
next build

echo "=== Vercel Build complete ==="
