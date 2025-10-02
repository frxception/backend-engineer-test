import { expect, test, describe } from 'bun:test';
import { BlockchainService } from '../src/services/blockchain';
import { BlockchainRepository } from '../src/database/repository';
import { ValidationError, calculateBlockHash } from '../src/services/validation';
import type { Block } from '../src/types/domain';
import { Pool } from 'pg';

// Mock repository for unit testing blockchain service
class MockRepository {
  private blocks: Map<number, Block> = new Map();
  private outputs: Map<string, any[]> = new Map();
  private balances: Map<string, number> = new Map();
  private currentHeight = 0;

  async withTransaction(callback: (client: any) => Promise<any>) {
    return callback(this);
  }

  async getCurrentHeight() {
    return this.currentHeight;
  }

  async getBlockById(blockId: string) {
    for (const [height, block] of this.blocks) {
      if (block.id === blockId) {
        return { id: block.id, height: block.height };
      }
    }
    return null;
  }

  async insertBlock(block: Block, client: any) {
    this.blocks.set(block.height, block);
    this.currentHeight = Math.max(this.currentHeight, block.height);
  }

  async insertTransaction(transaction: any, blockId: string, blockHeight: number, client: any) {
    // Mock implementation
  }

  async insertOutput(txId: string, output: any, index: number, client: any) {
    const key = `${txId}:${index}`;
    const outputs = this.outputs.get(txId) || [];
    outputs[index] = { ...output, isSpent: false, spentInBlockHeight: null };
    this.outputs.set(txId, outputs);
  }

  async getOutput(txId: string, index: number, client?: any) {
    const outputs = this.outputs.get(txId);
    if (!outputs || !outputs[index]) {
      return null;
    }
    return {
      txId,
      index,
      address: outputs[index].address,
      value: outputs[index].value,
      isSpent: outputs[index].isSpent,
      spentInBlockHeight: outputs[index].spentInBlockHeight,
    };
  }

  async markOutputAsSpent(txId: string, index: number, blockHeight: number, client: any) {
    const outputs = this.outputs.get(txId);
    if (outputs && outputs[index]) {
      outputs[index].isSpent = true;
      outputs[index].spentInBlockHeight = blockHeight;
    }
  }

  async updateBalance(address: string, delta: number, client: any) {
    const current = this.balances.get(address) || 0;
    this.balances.set(address, current + delta);
  }

  async getBalance(address: string) {
    return this.balances.get(address) || 0;
  }

  async deleteBlocksAfterHeight(height: number, client: any) {
    const toDelete: number[] = [];
    const txsToDelete: Set<string> = new Set();

    for (const [h, block] of this.blocks) {
      if (h > height) {
        toDelete.push(h);
        // Track transactions to delete
        for (const tx of block.transactions) {
          txsToDelete.add(tx.id);
        }
      }
    }

    // Delete blocks
    toDelete.forEach(h => this.blocks.delete(h));

    // Delete outputs from deleted transactions
    for (const txId of txsToDelete) {
      this.outputs.delete(txId);
    }

    this.currentHeight = height;
  }

  async unmarkOutputsSpentAfterHeight(height: number, client: any) {
    for (const outputs of this.outputs.values()) {
      for (const output of outputs) {
        if (output && output.spentInBlockHeight && output.spentInBlockHeight > height) {
          output.isSpent = false;
          output.spentInBlockHeight = null;
        }
      }
    }
  }

  async recalculateBalances(client: any) {
    this.balances.clear();
    for (const outputs of this.outputs.values()) {
      for (const output of outputs) {
        if (output && !output.isSpent) {
          const current = this.balances.get(output.address) || 0;
          this.balances.set(output.address, current + output.value);
        }
      }
    }
  }
}

describe('Blockchain Service', () => {
  describe('processBlock', () => {
    test('should process valid genesis block', async () => {
      const repository = new MockRepository() as any;
      const service = new BlockchainService(repository);

      const block: Block = {
        id: '',
        height: 1,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 100 }],
          },
        ],
      };
      block.id = calculateBlockHash(block);

      await service.processBlock(block);

      const balance = await service.getBalance('addr1');
      expect(balance).toBe(100);
    });

    test('should reject block with invalid height', async () => {
      const repository = new MockRepository() as any;
      const service = new BlockchainService(repository);

      const block: Block = {
        id: '',
        height: 2,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 100 }],
          },
        ],
      };
      block.id = calculateBlockHash(block);

      await expect(service.processBlock(block)).rejects.toThrow(ValidationError);
      await expect(service.processBlock(block)).rejects.toThrow('Invalid block height');
    });

    test('should reject block with invalid hash', async () => {
      const repository = new MockRepository() as any;
      const service = new BlockchainService(repository);

      const block: Block = {
        id: 'invalid_hash',
        height: 1,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 100 }],
          },
        ],
      };

      await expect(service.processBlock(block)).rejects.toThrow(ValidationError);
      await expect(service.processBlock(block)).rejects.toThrow('Invalid block hash');
    });

    test('should handle transactions with outputs only', async () => {
      const repository = new MockRepository() as any;
      const service = new BlockchainService(repository);

      // Block 1 - genesis
      const block1: Block = {
        id: '',
        height: 1,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 100 }],
          },
        ],
      };
      block1.id = calculateBlockHash(block1);
      await service.processBlock(block1);

      // Block 2 - another coinbase
      const block2: Block = {
        id: '',
        height: 2,
        transactions: [
          {
            id: 'tx2',
            inputs: [],
            outputs: [
              { address: 'addr2', value: 60 },
              { address: 'addr3', value: 40 },
            ],
          },
        ],
      };
      block2.id = calculateBlockHash(block2);
      await service.processBlock(block2);

      // Check balances
      expect(await service.getBalance('addr1')).toBe(100);
      expect(await service.getBalance('addr2')).toBe(60);
      expect(await service.getBalance('addr3')).toBe(40);
    });

    test('should reject transaction with unbalanced inputs and outputs', async () => {
      const repository = new MockRepository() as any;
      const service = new BlockchainService(repository);

      // Block with unbalanced transaction
      const block: Block = {
        id: '',
        height: 1,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 100 }],
          },
          {
            id: 'tx2',
            inputs: [{ txId: 'tx1', index: 0 }],
            outputs: [
              { address: 'addr2', value: 50 },
              { address: 'addr3', value: 60 }, // Total 110 > 100
            ],
          },
        ],
      };
      block.id = calculateBlockHash(block);

      await expect(service.processBlock(block)).rejects.toThrow(ValidationError);
      await expect(service.processBlock(block)).rejects.toThrow('unbalanced');
    });

    test('should handle intra-block transactions', async () => {
      const repository = new MockRepository() as any;
      const service = new BlockchainService(repository);

      const block: Block = {
        id: '',
        height: 1,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 100 }],
          },
          {
            id: 'tx2',
            inputs: [{ txId: 'tx1', index: 0 }],
            outputs: [
              { address: 'addr2', value: 60 },
              { address: 'addr3', value: 40 },
            ],
          },
        ],
      };
      block.id = calculateBlockHash(block);

      await service.processBlock(block);

      expect(await service.getBalance('addr1')).toBe(0);
      expect(await service.getBalance('addr2')).toBe(60);
      expect(await service.getBalance('addr3')).toBe(40);
    });
  });

  describe('rollback', () => {
    test('should rollback to previous height correctly', async () => {
      const repository = new MockRepository() as any;
      const service = new BlockchainService(repository);

      // Create 3 blocks (all coinbase)
      const block1: Block = {
        id: '',
        height: 1,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 100 }],
          },
        ],
      };
      block1.id = calculateBlockHash(block1);
      await service.processBlock(block1);

      const block2: Block = {
        id: '',
        height: 2,
        transactions: [
          {
            id: 'tx2',
            inputs: [],
            outputs: [
              { address: 'addr2', value: 60 },
              { address: 'addr3', value: 40 },
            ],
          },
        ],
      };
      block2.id = calculateBlockHash(block2);
      await service.processBlock(block2);

      const block3: Block = {
        id: '',
        height: 3,
        transactions: [
          {
            id: 'tx3',
            inputs: [],
            outputs: [{ address: 'addr4', value: 40 }],
          },
        ],
      };
      block3.id = calculateBlockHash(block3);
      await service.processBlock(block3);

      // Rollback to height 2
      await service.rollback(2);

      // Check balances after rollback
      expect(await service.getBalance('addr1')).toBe(100);
      expect(await service.getBalance('addr2')).toBe(60);
      expect(await service.getBalance('addr3')).toBe(40);
      expect(await service.getBalance('addr4')).toBe(0);
    });

    test('should reject invalid rollback height', async () => {
      const repository = new MockRepository() as any;
      const service = new BlockchainService(repository);

      const block: Block = {
        id: '',
        height: 1,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 100 }],
          },
        ],
      };
      block.id = calculateBlockHash(block);
      await service.processBlock(block);

      // Cannot rollback to current or future height
      await expect(service.rollback(1)).rejects.toThrow(ValidationError);
      await expect(service.rollback(2)).rejects.toThrow(ValidationError);

      // Cannot rollback to negative height
      await expect(service.rollback(-1)).rejects.toThrow(ValidationError);
    });
  });

  describe('getBalance', () => {
    test('should return 0 for unknown address', async () => {
      const repository = new MockRepository() as any;
      const service = new BlockchainService(repository);

      const balance = await service.getBalance('unknown');
      expect(balance).toBe(0);
    });

    test('should track balance through multiple transactions', async () => {
      const repository = new MockRepository() as any;
      const service = new BlockchainService(repository);

      // Block 1
      const block1: Block = {
        id: '',
        height: 1,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 100 }],
          },
        ],
      };
      block1.id = calculateBlockHash(block1);
      await service.processBlock(block1);

      // Block 2
      const block2: Block = {
        id: '',
        height: 2,
        transactions: [
          {
            id: 'tx2',
            inputs: [],
            outputs: [{ address: 'addr1', value: 50 }],
          },
        ],
      };
      block2.id = calculateBlockHash(block2);
      await service.processBlock(block2);

      expect(await service.getBalance('addr1')).toBe(150);
    });
  });
});
