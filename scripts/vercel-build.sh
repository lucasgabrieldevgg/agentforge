#!/bin/bash
# Vercel build script — generates Prisma client (prod schema = Postgres) and builds Next.js.
# Note: prisma db push is NOT run here because:
#   1. The database schema is already in sync (we ran db push manually when we first set up Supabase)
#   2. pgbouncer (transaction pooler) doesn't support DDL statements reliably
# To apply schema changes: run `bunx prisma db push --schema=prisma/schema.prod.prisma` locally
# with DIRECT_DATABASE_URL pointing to the session pooler (port 5432).

set -e

echo "=== Vercel Build: AgentForge v0.5.0 ==="

echo "[1/2] Generating Prisma client (prod schema)..."
bunx prisma generate --schema=prisma/schema.prod.prisma

echo "[2/2] Building Next.js..."
next build

echo "=== Vercel Build complete ==="
