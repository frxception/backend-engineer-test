import { Pool } from 'pg';
import { Block, BlockRecord } from '../schemas/blockchain.schema.ts';
import { TransactionModel } from './transaction.model.ts';

export class BlockModel {
  constructor(private pool: Pool) {
    this.pool = pool;
  }

  async initializeTables(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS blocks (
        id TEXT PRIMARY KEY,
        height INTEGER UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_blocks_height ON blocks(height);
    `);
  }

  async getCurrentHeight(): Promise<number> {
    const result = await this.pool.query(`
      SELECT COALESCE(MAX(height), 0) as current_height FROM blocks;
    `);
    return result.rows[0].current_height;
  }

  async getById(blockId: string): Promise<BlockRecord | null> {
    const result = await this.pool.query(
      `
      SELECT * FROM blocks WHERE id = $1;
    `,
      [blockId]
    );

    return result.rows[0] || null;
  }

  async insert(block: Block): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if block already exists
      const existingBlock = await client.query(
        `
        SELECT id FROM blocks WHERE id = $1 OR height = $2;
      `,
        [block.id, block.height]
      );

      if (existingBlock.rows.length > 0) {
        throw new Error(`Block with ID ${block.id} or height ${block.height} already exists`);
      }

      // Insert block
      await client.query(
        `
        INSERT INTO blocks (id, height) VALUES ($1, $2);
      `,
        [block.id, block.height]
      );

      // Insert transactions and process UTXOs
      const transactionModel = new TransactionModel(this.pool);
      for (const transaction of block.transactions) {
        await transactionModel.insertWithClient(client, transaction, block);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getAllBlocks(): Promise<BlockRecord[]> {
    const result = await this.pool.query(`
      SELECT * FROM blocks ORDER BY height ASC;
    `);
    return result.rows;
  }

  async rollbackToHeight(targetHeight: number): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get all blocks to rollback (height > targetHeight)
      const blocksToRollback = await client.query(
        `
        SELECT id, height FROM blocks WHERE height > $1 ORDER BY height DESC;
      `,
        [targetHeight]
      );

      // For each block, reverse the UTXO changes
      const transactionModel = new TransactionModel(this.pool);
      for (const block of blocksToRollback.rows) {
        await transactionModel.rollbackBlock(client, block.id, block.height);
      }

      // Delete blocks and related data
      await client.query('DELETE FROM blocks WHERE height > $1;', [targetHeight]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
