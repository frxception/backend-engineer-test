import { Pool } from 'pg';

export async function dropAllTables(pool: Pool): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS outputs CASCADE');
  await pool.query('DROP TABLE IF EXISTS transactions CASCADE');
  await pool.query('DROP TABLE IF EXISTS blocks CASCADE');
  await pool.query('DROP TABLE IF EXISTS balances CASCADE');
}

export async function resetDatabase(pool: Pool): Promise<void> {
  await dropAllTables(pool);
}
