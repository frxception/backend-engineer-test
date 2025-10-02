import { expect, test, describe } from 'bun:test';
import { Block, Transaction } from '../src/schemas/blockchain.schema.ts';
import { calculateBlockId, validateBlock } from '../src/utils/blockhain.util.ts';

describe('Utils Unit Tests', () => {
  describe('Block ID Calculation', () => {
    test('calculates correct block ID for empty transactions', () => {
      const transactions: Transaction[] = [];
      const blockId = calculateBlockId(1, transactions);
      // sha256("1") = "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b"
      expect(blockId).toBe('6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b');
    });

    test('calculates correct block ID for multiple transactions', () => {
      const transactions: Transaction[] = [
        { id: 'tx1', inputs: [], outputs: [] },
        { id: 'tx2', inputs: [], outputs: [] }
      ];
      const blockId = calculateBlockId(1, transactions);
      // sha256("1tx1tx2") = "74a9608142770b46c9eec3f39f41b4fb38d8d7f4063ac5676ccc2ed1d670c92b"
      expect(blockId).toBe('74a9608142770b46c9eec3f39f41b4fb38d8d7f4063ac5676ccc2ed1d670c92b');
    });

    test('calculates different IDs for different heights', () => {
      const transactions: Transaction[] = [{ id: 'tx1', inputs: [], outputs: [] }];

      const blockId1 = calculateBlockId(1, transactions);
      const blockId2 = calculateBlockId(2, transactions);

      expect(blockId1).not.toBe(blockId2);
    });
  });

  describe('Block Validation', () => {
    test('validates correct block', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 10 }]
        }
      ];

      const block: Block = {
        id: calculateBlockId(1, transactions),
        height: 1,
        transactions
      };

      const validationResult = validateBlock(block, 0, { isValid: true, totalInputValue: 0 });
      expect(validationResult).toBeNull();
    });

    test('rejects block with wrong height', () => {
      const transactions: Transaction[] = [];
      const block: Block = {
        id: calculateBlockId(3, transactions),
        height: 3,
        transactions
      };

      const validationResult = validateBlock(block, 0, { isValid: true, totalInputValue: 0 });
      expect(validationResult).not.toBeNull();
      expect(validationResult?.code).toBe('INVALID_HEIGHT');
      expect(validationResult?.message).toContain('not exactly one unit higher');
    });

    test('rejects block with wrong ID', () => {
      const transactions: Transaction[] = [];
      const block: Block = {
        id: 'wrong_id',
        height: 1,
        transactions
      };

      const validationResult = validateBlock(block, 0, { isValid: true, totalInputValue: 0 });
      expect(validationResult).not.toBeNull();
      expect(validationResult?.code).toBe('INVALID_BLOCK_ID');
    });

    test('rejects block with invalid inputs', () => {
      const transactions: Transaction[] = [];
      const block: Block = {
        id: calculateBlockId(1, transactions),
        height: 1,
        transactions
      };

      const validationResult = validateBlock(block, 0, { isValid: false, totalInputValue: 0 });
      expect(validationResult).not.toBeNull();
      expect(validationResult?.code).toBe('INVALID_INPUTS');
    });

    test('rejects block with unbalanced inputs/outputs', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          inputs: [{ txId: 'prev_tx', index: 0 }], // Regular transaction with inputs
          outputs: [{ address: 'addr1', value: 10 }]
        }
      ];

      const block: Block = {
        id: calculateBlockId(1, transactions),
        height: 1,
        transactions
      };

      // Simulate input value doesn't match output value
      const validationResult = validateBlock(block, 0, { isValid: true, totalInputValue: 5 });
      expect(validationResult).not.toBeNull();
      expect(validationResult?.code).toBe('INVALID_BALANCE');
      expect(validationResult?.message).toContain('does not equal sum of outputs');
    });

    test('handles coinbase transactions (no inputs)', () => {
      const transactions: Transaction[] = [
        {
          id: 'coinbase_tx',
          inputs: [],
          outputs: [{ address: 'miner', value: 50 }]
        }
      ];

      const block: Block = {
        id: calculateBlockId(1, transactions),
        height: 1,
        transactions
      };

      const validationResult = validateBlock(block, 0, { isValid: true, totalInputValue: 0 });
      expect(validationResult).toBeNull();
    });
  });
});
