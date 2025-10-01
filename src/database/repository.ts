import { Pool, PoolClient } from 'pg';
import type { Block, Transaction, Output, Input, StoredOutput, AddressBalance } from '../types/domain';

export class BlockchainRepository {
  constructor(private pool: Pool) {}

  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getCurrentHeight(client?: PoolClient): Promise<number> {
    const executor = client || this.pool;
    const result = await executor.query<{ height: number }>(
      'SELECT COALESCE(MAX(height), 0) as height FROM blocks'
    );
    return result.rows[0]?.height || 0;
  }

  async getBlockById(blockId: string, client?: PoolClient): Promise<{ id: string; height: number } | null> {
    const executor = client || this.pool;
    const result = await executor.query<{ id: string; height: number }>(
      'SELECT id, height FROM blocks WHERE id = $1',
      [blockId]
    );
    return result.rows[0] || null;
  }

  async insertBlock(block: Block, client: PoolClient): Promise<void> {
    await client.query(
      'INSERT INTO blocks (id, height) VALUES ($1, $2)',
      [block.id, block.height]
    );
  }

  async insertTransaction(transaction: Transaction, blockId: string, blockHeight: number, client: PoolClient): Promise<void> {
    await client.query(
      'INSERT INTO transactions (id, block_id, block_height) VALUES ($1, $2, $3)',
      [transaction.id, blockId, blockHeight]
    );
  }

  async insertOutput(txId: string, output: Output, index: number, client: PoolClient): Promise<void> {
    await client.query(
      'INSERT INTO outputs (tx_id, idx, address, value, is_spent) VALUES ($1, $2, $3, $4, $5)',
      [txId, index, output.address, output.value, false]
    );
  }

  async getOutput(txId: string, index: number, client?: PoolClient): Promise<StoredOutput | null> {
    const executor = client || this.pool;
    const result = await executor.query<{
      tx_id: string;
      idx: number;
      address: string;
      value: string;
      is_spent: boolean;
      spent_in_block_height: number | null;
    }>(
      'SELECT tx_id, idx, address, value, is_spent, spent_in_block_height FROM outputs WHERE tx_id = $1 AND idx = $2',
      [txId, index]
    );

    if (!result.rows[0]) return null;

    return {
      txId: result.rows[0].tx_id,
      index: result.rows[0].idx,
      address: result.rows[0].address,
      value: parseInt(result.rows[0].value, 10),
      isSpent: result.rows[0].is_spent,
      spentInBlockHeight: result.rows[0].spent_in_block_height,
    };
  }

  async markOutputAsSpent(txId: string, index: number, blockHeight: number, client: PoolClient): Promise<void> {
    await client.query(
      'UPDATE outputs SET is_spent = TRUE, spent_in_block_height = $3 WHERE tx_id = $1 AND idx = $2',
      [txId, index, blockHeight]
    );
  }

  async updateBalance(address: string, delta: number, client: PoolClient): Promise<void> {
    await client.query(
      `INSERT INTO balances (address, balance) VALUES ($1, $2)
       ON CONFLICT (address) DO UPDATE SET balance = balances.balance + $2`,
      [address, delta]
    );
  }

  async getBalance(address: string): Promise<number> {
    const result = await this.pool.query<{ balance: string }>(
      'SELECT balance FROM balances WHERE address = $1',
      [address]
    );
    return result.rows[0] ? parseInt(result.rows[0].balance, 10) : 0;
  }

  async deleteBlocksAfterHeight(height: number, client: PoolClient): Promise<void> {
    // Get all affected addresses before deletion to recalculate their balances
    await client.query('DELETE FROM blocks WHERE height > $1', [height]);
  }

  async unmarkOutputsSpentAfterHeight(height: number, client: PoolClient): Promise<void> {
    await client.query(
      'UPDATE outputs SET is_spent = FALSE, spent_in_block_height = NULL WHERE spent_in_block_height > $1',
      [height]
    );
  }

  async recalculateBalances(client: PoolClient): Promise<void> {
    // Clear all balances
    await client.query('DELETE FROM balances');

    // Recalculate from outputs
    await client.query(`
      INSERT INTO balances (address, balance)
      SELECT address, SUM(value) as balance
      FROM outputs
      WHERE is_spent = FALSE
      GROUP BY address
    `);
  }

  async getOutputsByBlockHeight(height: number, client?: PoolClient): Promise<StoredOutput[]> {
    const executor = client || this.pool;
    const result = await executor.query<{
      tx_id: string;
      idx: number;
      address: string;
      value: string;
      is_spent: boolean;
      spent_in_block_height: number | null;
    }>(
      `SELECT o.tx_id, o.idx, o.address, o.value, o.is_spent, o.spent_in_block_height
       FROM outputs o
       JOIN transactions t ON o.tx_id = t.id
       WHERE t.block_height = $1`,
      [height]
    );

    return result.rows.map(row => ({
      txId: row.tx_id,
      index: row.idx,
      address: row.address,
      value: parseInt(row.value, 10),
      isSpent: row.is_spent,
      spentInBlockHeight: row.spent_in_block_height,
    }));
  }
}
