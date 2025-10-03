#!/bin/bash

# Seed script for blockchain indexer database

set -e

echo "🌱 Setting up database seeding..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is not set"
    echo "💡 Please set it like: export DATABASE_URL='postgres://myuser:mypassword@localhost:5432/mydatabase'"
    exit 1
fi

echo "✅ DATABASE_URL is set"

# Check if database is reachable
echo "🔍 Testing database connection..."
if ! pg_isready -d "$DATABASE_URL" 2>/dev/null; then
    echo "⚠️  Database connection test failed, but proceeding anyway..."
    echo "💡 Make sure your PostgreSQL server is running"
fi

echo "🚀 Running seed script..."
bun run src/seed.ts

echo "✅ Database seeding completed!"
echo ""
echo "📋 You can now test the API with:"
echo "  - GET /balance/:address"
echo "  - POST /blocks"
echo "  - POST /rollback?height=number"