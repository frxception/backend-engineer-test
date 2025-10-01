import { Pool } from 'pg';

export async function initializeDatabase(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      height INTEGER NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_blocks_height ON blocks(height);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
      block_height INTEGER NOT NULL
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_block_height ON transactions(block_height);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS outputs (
      tx_id TEXT NOT NULL,
      idx INTEGER NOT NULL,
      address TEXT NOT NULL,
      value BIGINT NOT NULL,
      is_spent BOOLEAN NOT NULL DEFAULT FALSE,
      spent_in_block_height INTEGER,
      PRIMARY KEY (tx_id, idx),
      FOREIGN KEY (tx_id) REFERENCES transactions(id) ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_outputs_address ON outputs(address);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_outputs_is_spent ON outputs(is_spent);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_outputs_spent_in_block_height ON outputs(spent_in_block_height);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS balances (
      address TEXT PRIMARY KEY,
      balance BIGINT NOT NULL DEFAULT 0
    );
  `);
}
