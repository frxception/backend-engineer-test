-- Migration: 001_initial_schema
-- Description: Initial database schema for blockchain indexer with UTXO model
-- Author: System
-- Date: 2025-10-03

-- ============================================
-- UP MIGRATION
-- ============================================

-- Create migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- BLOCKS TABLE
-- =============================================================================
-- Purpose: Stores blockchain block metadata
-- Key Fields:
--   - id: Unique block identifier (hash)
--   - height: Sequential block number (must be unique)
--   - created_at: Timestamp when block was added to database
CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  height INTEGER UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient height-based queries and sorting
CREATE INDEX IF NOT EXISTS idx_blocks_height ON blocks(height);

-- =============================================================================
-- TRANSACTIONS TABLE
-- =============================================================================
-- Purpose: Stores transactions linked to their parent blocks
-- Key Fields:
--   - id: Unique transaction identifier
--   - block_id: Foreign key to blocks table
--   - block_height: Denormalized height for query optimization
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  block_height INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- OUTPUTS TABLE (UTXO Model)
-- =============================================================================
-- Purpose: Core UTXO tracking - stores all transaction outputs
-- Key Fields:
--   - id: Auto-incrementing primary key
--   - transaction_id: Foreign key to transactions
--   - output_index: Position of output within transaction
--   - address: Recipient address
--   - value: Amount in smallest unit (satoshis/wei equivalent)
--   - is_spent: Tracks if this output has been consumed
--   - spent_in_transaction_id: Which transaction spent this output (null if unspent)
--   - block_height: Denormalized for efficient queries
CREATE TABLE IF NOT EXISTS outputs (
  id SERIAL PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  output_index INTEGER NOT NULL,
  address TEXT NOT NULL,
  value BIGINT NOT NULL,
  is_spent BOOLEAN DEFAULT FALSE,
  spent_in_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  block_height INTEGER NOT NULL,
  UNIQUE(transaction_id, output_index)
);

-- Performance indexes for UTXO queries
CREATE INDEX IF NOT EXISTS idx_outputs_address ON outputs(address);
CREATE INDEX IF NOT EXISTS idx_outputs_spent ON outputs(is_spent);

-- =============================================================================
-- ADDRESS BALANCES TABLE
-- =============================================================================
-- Purpose: Materialized view of address balances for O(1) lookups
-- Note: This is a cached/denormalized table derived from outputs
-- Key Fields:
--   - address: Unique address identifier
--   - balance: Current balance (sum of unspent outputs)
--   - last_updated_height: Last block that affected this address
CREATE TABLE IF NOT EXISTS address_balances (
  address TEXT PRIMARY KEY,
  balance BIGINT NOT NULL DEFAULT 0,
  last_updated_height INTEGER NOT NULL DEFAULT 0
);

-- Record this migration
INSERT INTO schema_migrations (version, name)
VALUES (1, '001_initial_schema')
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- DOWN MIGRATION (rollback)
-- ============================================
-- Uncomment and run these statements to rollback this migration

-- DROP TABLE IF EXISTS address_balances CASCADE;
-- DROP TABLE IF EXISTS outputs CASCADE;
-- DROP TABLE IF EXISTS transactions CASCADE;
-- DROP TABLE IF EXISTS blocks CASCADE;
-- DELETE FROM schema_migrations WHERE version = 1;

-- =============================================================================
-- PRODUCTION NOTES
-- =============================================================================
-- 1. All tables use CASCADE deletion for referential integrity
-- 2. Indexes are optimized for:
--    - Balance lookups by address
--    - UTXO validation (unspent outputs)
--    - Block height queries
-- 3. BIGINT is used for values to support large amounts
-- 4. Boolean flags enable efficient spent/unspent queries
--
-- For schema modifications in production, always use migrations:
--   bun run migrate:create <migration_name>
-- =============================================================================
