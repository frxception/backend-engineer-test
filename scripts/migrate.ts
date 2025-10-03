#!/usr/bin/env bun

/**
 * Database Migration Runner
 *
 * Usage:
 *   bun scripts/migrate.ts up              - Run all pending migrations
 *   bun scripts/migrate.ts up 1            - Run up to version 1
 *   bun scripts/migrate.ts down 1          - Rollback to version 1
 *   bun scripts/migrate.ts status          - Show migration status
 *   bun scripts/migrate.ts create <name>   - Create a new migration file
 */

import { Pool } from 'pg';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

// Database connection
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://myuser:mypassword@localhost:5432/mydatabase'
});

interface Migration {
  version: number;
  name: string;
  filename: string;
  sql: string;
}

interface AppliedMigration {
  version: number;
  name: string;
  applied_at: Date;
}

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getAppliedMigrations(): Promise<AppliedMigration[]> {
  const result = await pool.query(
    'SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC'
  );
  return result.rows;
}

async function getAvailableMigrations(): Promise<Migration[]> {
  const files = await readdir(MIGRATIONS_DIR);
  const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

  const migrations: Migration[] = [];

  for (const filename of sqlFiles) {
    const match = filename.match(/^(\d+)_(.+)\.sql$/);
    if (!match) continue;

    const version = parseInt(match[1], 10);
    const name = match[2];
    const filepath = join(MIGRATIONS_DIR, filename);
    const sql = await readFile(filepath, 'utf-8');

    migrations.push({ version, name, filename, sql });
  }

  return migrations;
}

function cleanSQL(sql: string): string {
  return sql
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      // Skip empty lines, comment-only lines, and decorator lines (=, -, etc.)
      if (!trimmed) return false;
      if (trimmed.startsWith('--')) return false;
      // Skip lines that are only special characters (decorators)
      if (/^[=\-_*#]+$/.test(trimmed)) return false;
      return true;
    })
    .join('\n')
    .trim();
}

async function runMigration(migration: Migration): Promise<void> {
  console.log(`Applying migration ${migration.version}: ${migration.name}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Extract UP section from migration
    const upMatch = migration.sql.match(
      /-- UP MIGRATION\s*--+\s*([\s\S]*?)(?:-- DOWN MIGRATION|$)/i
    );
    const rawSQL = upMatch ? upMatch[1].trim() : migration.sql;

    // Clean SQL by removing comment-only lines
    const upSQL = cleanSQL(rawSQL);

    if (!upSQL) {
      throw new Error('No SQL statements found in UP migration section');
    }

    await client.query(upSQL);

    await client.query('COMMIT');
    console.log(`✓ Migration ${migration.version} applied successfully`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`✗ Migration ${migration.version} failed:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function rollbackMigration(migration: Migration): Promise<void> {
  console.log(`Rolling back migration ${migration.version}: ${migration.name}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Extract DOWN section from migration
    const downMatch = migration.sql.match(
      /-- DOWN MIGRATION[\s\S]*?--+\s*(?:--\s*Uncomment.*?\n)?([\s\S]*?)$/i
    );
    if (!downMatch || !downMatch[1]) {
      throw new Error(`No DOWN migration found for version ${migration.version}`);
    }

    // Parse and execute uncommented statements, then clean
    const rawDownSQL = downMatch[1]
      .split('\n')
      .map(line => line.replace(/^--\s*/, ''))
      .join('\n');

    const downSQL = cleanSQL(rawDownSQL);

    if (!downSQL) {
      throw new Error('No SQL statements found in DOWN migration section');
    }

    await client.query(downSQL);

    await client.query('COMMIT');
    console.log(`✓ Migration ${migration.version} rolled back successfully`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`✗ Rollback of migration ${migration.version} failed:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function migrateUp(targetVersion?: number): Promise<void> {
  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();
  const available = await getAvailableMigrations();

  const appliedVersions = new Set(applied.map(m => m.version));
  const pending = available.filter(m => !appliedVersions.has(m.version));

  if (pending.length === 0) {
    console.log('✓ No pending migrations');
    return;
  }

  const toApply = targetVersion ? pending.filter(m => m.version <= targetVersion) : pending;

  console.log(`Found ${toApply.length} pending migration(s)\n`);

  for (const migration of toApply) {
    await runMigration(migration);
  }

  console.log('\n✓ All migrations applied successfully');
}

async function migrateDown(targetVersion: number): Promise<void> {
  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();
  const available = await getAvailableMigrations();

  const toRollback = applied
    .filter(m => m.version > targetVersion)
    .sort((a, b) => b.version - a.version);

  if (toRollback.length === 0) {
    console.log('✓ No migrations to rollback');
    return;
  }

  console.log(`Rolling back ${toRollback.length} migration(s)\n`);

  for (const appliedMigration of toRollback) {
    const migration = available.find(m => m.version === appliedMigration.version);
    if (!migration) {
      console.error(`✗ Migration file not found for version ${appliedMigration.version}`);
      continue;
    }

    await rollbackMigration(migration);
  }

  console.log('\n✓ Rollback completed successfully');
}

async function showStatus(): Promise<void> {
  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();
  const available = await getAvailableMigrations();

  console.log('Migration Status:\n');
  console.log('Applied Migrations:');
  if (applied.length === 0) {
    console.log('  (none)');
  } else {
    for (const m of applied) {
      console.log(`  ✓ ${m.version}: ${m.name} (applied at ${m.applied_at.toISOString()})`);
    }
  }

  const appliedVersions = new Set(applied.map(m => m.version));
  const pending = available.filter(m => !appliedVersions.has(m.version));

  console.log('\nPending Migrations:');
  if (pending.length === 0) {
    console.log('  (none)');
  } else {
    for (const m of pending) {
      console.log(`  ○ ${m.version}: ${m.name}`);
    }
  }
}

async function createMigration(name: string): Promise<void> {
  const available = await getAvailableMigrations();
  const nextVersion = available.length > 0 ? Math.max(...available.map(m => m.version)) + 1 : 1;

  const paddedVersion = String(nextVersion).padStart(3, '0');
  const filename = `${paddedVersion}_${name}.sql`;
  const filepath = join(MIGRATIONS_DIR, filename);

  const template = `-- Migration: ${paddedVersion}_${name}
-- Description: [Add description here]
-- Author: [Your name]
-- Date: ${new Date().toISOString().split('T')[0]}

-- ============================================
-- UP MIGRATION
-- ============================================

-- Add your SQL statements here


-- Record this migration
INSERT INTO schema_migrations (version, name)
VALUES (${nextVersion}, '${paddedVersion}_${name}')
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- DOWN MIGRATION (rollback)
-- ============================================
-- Uncomment and run these statements to rollback this migration

-- [Add your rollback SQL here]
-- DELETE FROM schema_migrations WHERE version = ${nextVersion};
`;

  await writeFile(filepath, template, 'utf-8');
  console.log(`✓ Created migration: ${filename}`);
}

async function main() {
  const [command, arg] = process.argv.slice(2);

  try {
    switch (command) {
      case 'up':
        await migrateUp(arg ? parseInt(arg, 10) : undefined);
        break;
      case 'down':
        if (!arg) {
          console.error('Error: Target version required for down migration');
          console.log('Usage: bun scripts/migrate.ts down <version>');
          process.exit(1);
        }
        await migrateDown(parseInt(arg, 10));
        break;
      case 'status':
        await showStatus();
        break;
      case 'create':
        if (!arg) {
          console.error('Error: Migration name required');
          console.log('Usage: bun scripts/migrate.ts create <name>');
          process.exit(1);
        }
        await createMigration(arg);
        break;
      default:
        console.log('Database Migration Runner\n');
        console.log('Usage:');
        console.log('  bun scripts/migrate.ts up              - Run all pending migrations');
        console.log('  bun scripts/migrate.ts up <version>    - Run up to specific version');
        console.log('  bun scripts/migrate.ts down <version>  - Rollback to specific version');
        console.log('  bun scripts/migrate.ts status          - Show migration status');
        console.log('  bun scripts/migrate.ts create <name>   - Create new migration file');
        process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
