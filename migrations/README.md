# Database Migrations

This directory contains versioned SQL migrations for the blockchain indexer database.

## Quick Start

```bash
# Check migration status
bun run migrate:status

# Run all pending migrations
bun run migrate:up

# Rollback to version 0 (empty database)
bun run migrate:down 0

# Create a new migration
bun run migrate:create add_new_feature
```

## Available Commands

| Command                          | Description                             |
| -------------------------------- | --------------------------------------- |
| `bun run migrate:status`         | Show current migration status           |
| `bun run migrate:up`             | Apply all pending migrations            |
| `bun run migrate:up <version>`   | Apply migrations up to specific version |
| `bun run migrate:down <version>` | Rollback to specific version            |
| `bun run migrate:create <name>`  | Create new migration file               |

## How It Works

### Migration Files

Migrations are SQL files in the format: `NNN_description.sql`

- `NNN`: 3-digit version number (e.g., 001, 002, 003)
- `description`: Brief description using underscores (e.g., `initial_schema`, `add_user_table`)

### Migration Structure

Each migration file contains two sections:

1. **UP MIGRATION**: SQL to apply the migration
2. **DOWN MIGRATION**: SQL to rollback the migration (commented out)

Example:

```sql
-- Migration: 001_initial_schema
-- Description: Initial database schema
-- Date: 2025-10-03

-- ============================================
-- UP MIGRATION
-- ============================================

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL
);

INSERT INTO schema_migrations (version, name)
VALUES (1, '001_initial_schema')
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- DOWN MIGRATION (rollback)
-- ============================================
-- Uncomment and run these statements to rollback

-- DROP TABLE IF EXISTS users CASCADE;
-- DELETE FROM schema_migrations WHERE version = 1;
```

## Migration Tracking

The system uses a `schema_migrations` table to track applied migrations:

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Best Practices

### 1. Always Create New Migrations

Never modify existing migration files that have been applied. Instead, create a new migration to make changes:

```bash
# Wrong: Edit 001_initial_schema.sql
# Right: Create new migration
bun run migrate:create fix_user_table
```

### 2. Test Migrations Locally First

```bash
# Apply migration
bun run migrate:up

# Test your application
bun start

# If there's an issue, rollback
bun run migrate:down 0
```

### 3. Include Rollback Logic

Always provide DOWN migration logic in comments. This is critical for production rollbacks.

### 4. Use Transactions

The migration runner automatically wraps each migration in a transaction, so all changes are atomic (all-or-nothing).

### 5. Naming Conventions

- Use descriptive names: `add_user_authentication`, `create_payment_tables`
- Avoid: `new_stuff`, `fixes`, `update`

## Production Deployment

### Initial Setup

```bash
# On production database
DATABASE_URL=postgres://user:pass@prod-host:5432/proddb bun run migrate:up
```

### Regular Updates

```bash
# 1. Check current status
DATABASE_URL=postgres://... bun run migrate:status

# 2. Apply pending migrations
DATABASE_URL=postgres://... bun run migrate:up

# 3. Verify application works
# 4. If issues occur, rollback to previous version
DATABASE_URL=postgres://... bun run migrate:down <previous_version>
```

## Environment Variables

The migration system uses `DATABASE_URL` to connect to PostgreSQL:

```bash
# Development (default)
DATABASE_URL=postgres://myuser:mypassword@localhost:5432/mydatabase

# Production
DATABASE_URL=postgres://user:password@production-host:5432/production_db

# Test
TEST_DATABASE_URL=postgres://myuser:mypassword@localhost:5433/test_mydatabase
```

## Common Workflows

### Creating a New Feature

```bash
# 1. Create migration
bun run migrate:create add_transaction_metadata

# 2. Edit migrations/00X_add_transaction_metadata.sql
# 3. Apply migration
bun run migrate:up

# 4. Test your code
bun start

# 5. If good, commit migration file
git add migrations/00X_add_transaction_metadata.sql
git commit -m "Add transaction metadata table"
```

### Fixing a Bad Migration

```bash
# 1. Rollback to previous version
bun run migrate:down <previous_version>

# 2. Create new migration with fix
bun run migrate:create fix_transaction_metadata

# 3. Apply new migration
bun run migrate:up
```

### Checking Migration History

```bash
# See which migrations are applied
bun run migrate:status

# Output:
# Applied Migrations:
#   ✓ 1: 001_initial_schema (applied at 2025-10-03T10:30:00.000Z)
#   ✓ 2: 002_add_indexes (applied at 2025-10-03T11:15:00.000Z)
#
# Pending Migrations:
#   ○ 3: 003_add_user_table
```

## Troubleshooting

### Migration Fails Midway

The migration runner uses transactions, so failed migrations are automatically rolled back. Fix the SQL and try again.

### Can't Connect to Database

Check your `DATABASE_URL` environment variable:

```bash
echo $DATABASE_URL
# or
DATABASE_URL=postgres://... bun run migrate:status
```

### Migration Already Applied

The system tracks applied migrations in `schema_migrations` table. Use `migrate:status` to see what's been applied.

### Need to Skip a Migration

Not recommended, but if necessary:

```sql
-- Manually mark as applied without running
INSERT INTO schema_migrations (version, name)
VALUES (<version>, '<name>')
ON CONFLICT (version) DO NOTHING;
```

## Files in This Directory

- `001_initial_schema.sql` - Initial database schema with UTXO model
- `README.md` - This file

## Related Files

- `../scripts/migrate.ts` - Migration runner script
- `../package.json` - npm scripts for migration commands
