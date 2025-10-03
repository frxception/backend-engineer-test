-- Migration: 002_adding_seed_data
-- Description: Adds seed data for testing blockchain indexer with 6 blocks
-- Author: System
-- Date: 2025-10-03

-- ============================================
-- UP MIGRATION
-- ============================================

-- =============================================================================
-- BLOCK 1 (Genesis Block)
-- =============================================================================
-- Genesis block with no inputs (initial distribution)

INSERT INTO blocks (id, height) VALUES
('f9c5c8e1e9c9e3f5c5f9c5c8e1e9c9e3f5c5f9c5c8e1e9c9e3f5c5f9c5c8e1e9', 1);

INSERT INTO transactions (id, block_id, block_height) VALUES
('tx1', 'f9c5c8e1e9c9e3f5c5f9c5c8e1e9c9e3f5c5f9c5c8e1e9c9e3f5c5f9c5c8e1e9', 1),
('tx2', 'f9c5c8e1e9c9e3f5c5f9c5c8e1e9c9e3f5c5f9c5c8e1e9c9e3f5c5f9c5c8e1e9', 1);

INSERT INTO outputs (transaction_id, output_index, address, value, is_spent, block_height) VALUES
('tx1', 0, 'addr1', 1000, false, 1),
('tx1', 1, 'addr2', 500, false, 1),
('tx1', 2, 'addr3', 250, false, 1),
('tx2', 0, 'addr4', 800, false, 1),
('tx2', 1, 'addr5', 300, false, 1);

INSERT INTO address_balances (address, balance, last_updated_height) VALUES
('addr1', 1000, 1),
('addr2', 500, 1),
('addr3', 250, 1),
('addr4', 800, 1),
('addr5', 300, 1);

-- =============================================================================
-- BLOCK 2
-- =============================================================================
-- Spends outputs from Block 1

INSERT INTO blocks (id, height) VALUES
('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2', 2);

INSERT INTO transactions (id, block_id, block_height) VALUES
('tx3', 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2', 2),
('tx4', 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2', 2),
('tx5', 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2', 2);

UPDATE outputs SET is_spent = true, spent_in_transaction_id = 'tx3' WHERE transaction_id = 'tx1' AND output_index = 0;
UPDATE outputs SET is_spent = true, spent_in_transaction_id = 'tx3' WHERE transaction_id = 'tx1' AND output_index = 1;
UPDATE outputs SET is_spent = true, spent_in_transaction_id = 'tx4' WHERE transaction_id = 'tx1' AND output_index = 2;

INSERT INTO outputs (transaction_id, output_index, address, value, is_spent, block_height) VALUES
('tx3', 0, 'addr6', 900, false, 2),
('tx3', 1, 'addr7', 600, false, 2),
('tx4', 0, 'addr8', 75, false, 2),
('tx4', 1, 'addr9', 75, false, 2),
('tx4', 2, 'addr10', 100, false, 2),
('tx5', 0, 'addr11', 100, false, 2);

UPDATE address_balances SET balance = 0, last_updated_height = 2 WHERE address = 'addr1';
UPDATE address_balances SET balance = 0, last_updated_height = 2 WHERE address = 'addr2';
UPDATE address_balances SET balance = 0, last_updated_height = 2 WHERE address = 'addr3';

INSERT INTO address_balances (address, balance, last_updated_height) VALUES
('addr6', 900, 2),
('addr7', 600, 2),
('addr8', 75, 2),
('addr9', 75, 2),
('addr10', 100, 2),
('addr11', 100, 2)
ON CONFLICT (address) DO UPDATE SET
  balance = address_balances.balance + EXCLUDED.balance,
  last_updated_height = EXCLUDED.last_updated_height;

-- =============================================================================
-- BLOCK 3
-- =============================================================================

INSERT INTO blocks (id, height) VALUES
('b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3', 3);

INSERT INTO transactions (id, block_id, block_height) VALUES
('tx6', 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3', 3),
('tx7', 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3', 3),
('tx8', 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3', 3);

UPDATE outputs SET is_spent = true, spent_in_transaction_id = 'tx6' WHERE transaction_id = 'tx2' AND output_index = 0;
UPDATE outputs SET is_spent = true, spent_in_transaction_id = 'tx6' WHERE transaction_id = 'tx2' AND output_index = 1;
UPDATE outputs SET is_spent = true, spent_in_transaction_id = 'tx7' WHERE transaction_id = 'tx3' AND output_index = 0;

INSERT INTO outputs (transaction_id, output_index, address, value, is_spent, block_height) VALUES
('tx6', 0, 'addr12', 660, false, 3),
('tx6', 1, 'addr13', 440, false, 3),
('tx7', 0, 'addr14', 270, false, 3),
('tx7', 1, 'addr15', 270, false, 3),
('tx7', 2, 'addr16', 360, false, 3),
('tx8', 0, 'addr17', 100, false, 3);

UPDATE address_balances SET balance = 0, last_updated_height = 3 WHERE address = 'addr4';
UPDATE address_balances SET balance = 0, last_updated_height = 3 WHERE address = 'addr5';
UPDATE address_balances SET balance = 0, last_updated_height = 3 WHERE address = 'addr6';

INSERT INTO address_balances (address, balance, last_updated_height) VALUES
('addr12', 660, 3),
('addr13', 440, 3),
('addr14', 270, 3),
('addr15', 270, 3),
('addr16', 360, 3),
('addr17', 100, 3)
ON CONFLICT (address) DO UPDATE SET
  balance = address_balances.balance + EXCLUDED.balance,
  last_updated_height = EXCLUDED.last_updated_height;

-- =============================================================================
-- BLOCK 4
-- =============================================================================

INSERT INTO blocks (id, height) VALUES
('c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4', 4);

INSERT INTO transactions (id, block_id, block_height) VALUES
('tx9', 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4', 4),
('tx10', 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4', 4),
('tx11', 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4', 4);

UPDATE outputs SET is_spent = true, spent_in_transaction_id = 'tx9' WHERE transaction_id = 'tx3' AND output_index = 1;
UPDATE outputs SET is_spent = true, spent_in_transaction_id = 'tx9' WHERE transaction_id = 'tx4' AND output_index = 0;
UPDATE outputs SET is_spent = true, spent_in_transaction_id = 'tx10' WHERE transaction_id = 'tx4' AND output_index = 1;

INSERT INTO outputs (transaction_id, output_index, address, value, is_spent, block_height) VALUES
('tx9', 0, 'addr18', 405, false, 4),
('tx9', 1, 'addr19', 270, false, 4),
('tx10', 0, 'addr20', 22, false, 4),
('tx10', 1, 'addr21', 22, false, 4),
('tx10', 2, 'addr22', 30, false, 4),
('tx11', 0, 'addr23', 100, false, 4);

UPDATE address_balances SET balance = 0, last_updated_height = 4 WHERE address = 'addr7';
UPDATE address_balances SET balance = 0, last_updated_height = 4 WHERE address = 'addr8';
UPDATE address_balances SET balance = 0, last_updated_height = 4 WHERE address = 'addr9';

INSERT INTO address_balances (address, balance, last_updated_height) VALUES
('addr18', 405, 4),
('addr19', 270, 4),
('addr20', 22, 4),
('addr21', 22, 4),
('addr22', 30, 4),
('addr23', 100, 4)
ON CONFLICT (address) DO UPDATE SET
  balance = address_balances.balance + EXCLUDED.balance,
  last_updated_height = EXCLUDED.last_updated_height;

-- =============================================================================
-- BLOCK 5
-- =============================================================================

INSERT INTO blocks (id, height) VALUES
('d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5', 5);

INSERT INTO transactions (id, block_id, block_height) VALUES
('tx12', 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5', 5),
('tx13', 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5', 5),
('tx14', 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5', 5);

UPDATE outputs SET is_spent = true, spent_in_transaction_id = 'tx12' WHERE transaction_id = 'tx4' AND output_index = 2;
UPDATE outputs SET is_spent = true, spent_in_transaction_id = 'tx12' WHERE transaction_id = 'tx5' AND output_index = 0;
UPDATE outputs SET is_spent = true, spent_in_transaction_id = 'tx13' WHERE transaction_id = 'tx6' AND output_index = 0;

INSERT INTO outputs (transaction_id, output_index, address, value, is_spent, block_height) VALUES
('tx12', 0, 'addr24', 120, false, 5),
('tx12', 1, 'addr25', 80, false, 5),
('tx13', 0, 'addr26', 198, false, 5),
('tx13', 1, 'addr27', 198, false, 5),
('tx13', 2, 'addr28', 264, false, 5),
('tx14', 0, 'addr29', 100, false, 5);

UPDATE address_balances SET balance = 0, last_updated_height = 5 WHERE address = 'addr10';
UPDATE address_balances SET balance = 0, last_updated_height = 5 WHERE address = 'addr11';
UPDATE address_balances SET balance = 0, last_updated_height = 5 WHERE address = 'addr12';

INSERT INTO address_balances (address, balance, last_updated_height) VALUES
('addr24', 120, 5),
('addr25', 80, 5),
('addr26', 198, 5),
('addr27', 198, 5),
('addr28', 264, 5),
('addr29', 100, 5)
ON CONFLICT (address) DO UPDATE SET
  balance = address_balances.balance + EXCLUDED.balance,
  last_updated_height = EXCLUDED.last_updated_height;

-- =============================================================================
-- BLOCK 6
-- =============================================================================

INSERT INTO blocks (id, height) VALUES
('e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6', 6);

INSERT INTO transactions (id, block_id, block_height) VALUES
('tx15', 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6', 6),
('tx16', 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6', 6),
('tx17', 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6', 6);

UPDATE outputs SET is_spent = true, spent_in_transaction_id = 'tx15' WHERE transaction_id = 'tx6' AND output_index = 1;
UPDATE outputs SET is_spent = true, spent_in_transaction_id = 'tx15' WHERE transaction_id = 'tx7' AND output_index = 0;
UPDATE outputs SET is_spent = true, spent_in_transaction_id = 'tx16' WHERE transaction_id = 'tx7' AND output_index = 1;

INSERT INTO outputs (transaction_id, output_index, address, value, is_spent, block_height) VALUES
('tx15', 0, 'addr30', 426, false, 6),
('tx15', 1, 'addr31', 284, false, 6),
('tx16', 0, 'addr32', 81, false, 6),
('tx16', 1, 'addr33', 81, false, 6),
('tx16', 2, 'addr34', 108, false, 6),
('tx17', 0, 'addr35', 100, false, 6);

UPDATE address_balances SET balance = 0, last_updated_height = 6 WHERE address = 'addr13';
UPDATE address_balances SET balance = 0, last_updated_height = 6 WHERE address = 'addr14';
UPDATE address_balances SET balance = 0, last_updated_height = 6 WHERE address = 'addr15';

INSERT INTO address_balances (address, balance, last_updated_height) VALUES
('addr30', 426, 6),
('addr31', 284, 6),
('addr32', 81, 6),
('addr33', 81, 6),
('addr34', 108, 6),
('addr35', 100, 6)
ON CONFLICT (address) DO UPDATE SET
  balance = address_balances.balance + EXCLUDED.balance,
  last_updated_height = EXCLUDED.last_updated_height;

-- Record this migration
INSERT INTO schema_migrations (version, name)
VALUES (2, '002_adding_seed_data')
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- DOWN MIGRATION (rollback)
-- ============================================
-- Uncomment and run these statements to rollback this migration

-- DELETE FROM address_balances WHERE last_updated_height <= 6;
-- DELETE FROM outputs WHERE block_height <= 6;
-- DELETE FROM transactions WHERE block_height <= 6;
-- DELETE FROM blocks WHERE height <= 6;
-- DELETE FROM schema_migrations WHERE version = 2;
