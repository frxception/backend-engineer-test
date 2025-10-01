import type { Block, Input } from '../types/domain';
import { BlockchainRepository } from '../database/repository';
import {
  validateBlockHeight,
  validateBlockHash,
  validateBlockTransactions,
  ValidationError,
} from './validation';

export class BlockchainService {
  constructor(private repository: BlockchainRepository) {}

  async processBlock(block: Block): Promise<void> {
    await this.repository.withTransaction(async (client) => {
      // Get current height
      const currentHeight = await this.repository.getCurrentHeight(client);

      // Validate block height
      validateBlockHeight(block, currentHeight);

      // Validate block hash
      validateBlockHash(block);

      // Create a map to store output values for validation
      const outputValueCache = new Map<string, number>();

      // Helper function to get output value for validation
      const getOutputValue = (txId: string, index: number): number => {
        const key = `${txId}:${index}`;

        // Check cache first
        if (outputValueCache.has(key)) {
          return outputValueCache.get(key)!;
        }

        // Check if it's an output from a transaction in this same block
        for (const tx of block.transactions) {
          if (tx.id === txId && tx.outputs[index]) {
            const value = tx.outputs[index].value;
            outputValueCache.set(key, value);
            return value;
          }
        }

        throw new ValidationError(
          `Output not found for input reference: txId=${txId}, index=${index}`
        );
      };

      // Validate all transactions in the block
      validateBlockTransactions(block, getOutputValue);

      // If all validations pass, insert the block
      await this.repository.insertBlock(block, client);

      // Process each transaction
      for (const transaction of block.transactions) {
        await this.repository.insertTransaction(transaction, block.id, block.height, client);

        // Process inputs - mark referenced outputs as spent
        for (const input of transaction.inputs) {
          const referencedOutput = await this.repository.getOutput(input.txId, input.index, client);

          if (!referencedOutput) {
            throw new ValidationError(
              `Referenced output not found: txId=${input.txId}, index=${input.index}`
            );
          }

          if (referencedOutput.isSpent) {
            throw new ValidationError(
              `Output already spent: txId=${input.txId}, index=${input.index}`
            );
          }

          // Mark output as spent
          await this.repository.markOutputAsSpent(input.txId, input.index, block.height, client);

          // Decrease balance for the address that owned this output
          await this.repository.updateBalance(referencedOutput.address, -referencedOutput.value, client);
        }

        // Process outputs - create new UTXOs
        for (let i = 0; i < transaction.outputs.length; i++) {
          const output = transaction.outputs[i];
          await this.repository.insertOutput(transaction.id, output, i, client);

          // Increase balance for the receiving address
          await this.repository.updateBalance(output.address, output.value, client);
        }
      }
    });
  }

  async getBalance(address: string): Promise<number> {
    return this.repository.getBalance(address);
  }

  async rollback(targetHeight: number): Promise<void> {
    await this.repository.withTransaction(async (client) => {
      const currentHeight = await this.repository.getCurrentHeight(client);

      if (targetHeight < 0) {
        throw new ValidationError('Target height cannot be negative');
      }

      if (targetHeight >= currentHeight) {
        throw new ValidationError(
          `Cannot rollback to height ${targetHeight}. Current height is ${currentHeight}`
        );
      }

      // Validate rollback is within 2000 blocks
      if (currentHeight - targetHeight > 2000) {
        throw new ValidationError(
          `Cannot rollback more than 2000 blocks. Requested: ${currentHeight - targetHeight} blocks`
        );
      }

      // Unmark outputs that were spent after target height
      await this.repository.unmarkOutputsSpentAfterHeight(targetHeight, client);

      // Delete blocks after target height (cascade will delete transactions and outputs)
      await this.repository.deleteBlocksAfterHeight(targetHeight, client);

      // Recalculate all balances from scratch
      await this.repository.recalculateBalances(client);
    });
  }
}
