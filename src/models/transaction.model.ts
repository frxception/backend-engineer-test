import { Pool } from 'pg';
import { Transaction as TransactionType, Block, Input } from '../schemas/blockchain.schema.ts';
import { OutputModel } from './output.model.ts';

export class TransactionModel {
  constructor(private pool: Pool) {
    this.pool = pool;
  }

  async initializeTables(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
        block_height INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async insertWithClient(client: any, transaction: TransactionType, block: Block): Promise<void> {
    // Check if transaction already exists
    const existingTx = await client.query(
      `
      SELECT id FROM transactions WHERE id = $1;
    `,
      [transaction.id]
    );

    if (existingTx.rows.length > 0) {
      throw new Error(`Transaction with ID ${transaction.id} already exists`);
    }

    // Insert transaction
    await client.query(
      `
      INSERT INTO transactions (id, block_id, block_height) VALUES ($1, $2, $3);
    `,
      [transaction.id, block.id, block.height]
    );

    const outputModel = new OutputModel(this.pool);

    // Process inputs (mark outputs as spent)
    for (const input of transaction.inputs) {
      await client.query(
        `
        UPDATE outputs
        SET is_spent = TRUE, spent_in_transaction_id = $1
        WHERE transaction_id = $2 AND output_index = $3;
      `,
        [transaction.id, input.txId, input.index]
      );

      // Get the spent output to update balance
      const spentOutput = await client.query(
        `
        SELECT address, value FROM outputs
        WHERE transaction_id = $1 AND output_index = $2;
      `,
        [input.txId, input.index]
      );

      if (spentOutput.rows[0]) {
        const { address, value } = spentOutput.rows[0];
        await outputModel.updateAddressBalanceWithClient(client, address, -value, block.height);
      }
    }

    // Process outputs (create new UTXOs)
    for (let i = 0; i < transaction.outputs.length; i++) {
      const output = transaction.outputs[i];

      await client.query(
        `
        INSERT INTO outputs (transaction_id, output_index, address, value, block_height)
        VALUES ($1, $2, $3, $4, $5);
      `,
        [transaction.id, i, output.address, output.value, block.height]
      );

      await outputModel.updateAddressBalanceWithClient(
        client,
        output.address,
        output.value,
        block.height
      );
    }
  }

  async rollbackBlock(client: any, blockId: string, blockHeight: number): Promise<void> {
    // Get all transactions in this block
    const transactions = await client.query(
      `
      SELECT id FROM transactions WHERE block_id = $1;
    `,
      [blockId]
    );

    for (const tx of transactions.rows) {
      // Reverse outputs (subtract from balances)
      const outputs = await client.query(
        `
        SELECT address, value FROM outputs WHERE transaction_id = $1;
      `,
        [tx.id]
      );

      for (const output of outputs.rows) {
        await client.query(
          `
          UPDATE address_balances
          SET balance = balance - $1, last_updated_height = $2
          WHERE address = $3;
        `,
          [output.value, blockHeight - 1, output.address]
        );
      }

      // Reverse inputs (mark outputs as unspent and add back to balances)
      const inputs = await client.query(
        `
        SELECT address, value FROM outputs
        WHERE spent_in_transaction_id = $1;
      `,
        [tx.id]
      );

      for (const input of inputs.rows) {
        await client.query(
          `
          UPDATE outputs
          SET is_spent = FALSE, spent_in_transaction_id = NULL
          WHERE spent_in_transaction_id = $1;
        `,
          [tx.id]
        );

        await client.query(
          `
          UPDATE address_balances
          SET balance = balance + $1, last_updated_height = $2
          WHERE address = $3;
        `,
          [input.value, blockHeight - 1, input.address]
        );
      }
    }
  }

  async validateInputsExist(
    inputs: Input[]
  ): Promise<{ isValid: boolean; totalInputValue: number }> {
    if (inputs.length === 0) {
      return { isValid: true, totalInputValue: 0 };
    }

    let totalInputValue = 0;

    for (const input of inputs) {
      const result = await this.pool.query(
        `
        SELECT value, is_spent FROM outputs
        WHERE transaction_id = $1 AND output_index = $2;
      `,
        [input.txId, input.index]
      );

      if (result.rows.length === 0) {
        return { isValid: false, totalInputValue: 0 };
      }

      const output = result.rows[0];
      if (output.is_spent) {
        return { isValid: false, totalInputValue: 0 };
      }

      totalInputValue += parseInt(output.value);
    }

    return { isValid: true, totalInputValue };
  }
}
