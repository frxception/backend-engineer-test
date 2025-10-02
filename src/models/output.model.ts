import { Pool } from 'pg';

export class OutputModel {
  constructor(private pool: Pool) {
    this.pool = pool;
  }

  async initializeTables(): Promise<void> {
    await this.pool.query(`
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
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS address_balances (
        address TEXT PRIMARY KEY,
        balance BIGINT NOT NULL DEFAULT 0,
        last_updated_height INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Create indexes for better performance
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_outputs_address ON outputs(address);
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_outputs_spent ON outputs(is_spent);
    `);
  }

  async updateAddressBalanceWithClient(
    client: any,
    address: string,
    valueChange: number,
    height: number
  ): Promise<void> {
    await client.query(
      `
      INSERT INTO address_balances (address, balance, last_updated_height)
      VALUES ($1, $2, $3)
      ON CONFLICT (address)
      DO UPDATE SET
        balance = address_balances.balance + $2,
        last_updated_height = $3;
    `,
      [address, valueChange, height]
    );
  }

  async getAddressBalance(address: string): Promise<number> {
    const result = await this.pool.query(
      `
      SELECT balance FROM address_balances WHERE address = $1;
    `,
      [address]
    );

    return parseInt(result.rows[0]?.balance || '0');
  }
}
