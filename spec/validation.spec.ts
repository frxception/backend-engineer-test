import { expect, test, describe } from 'bun:test';
import {
  validateBlockHeight,
  validateBlockHash,
  calculateBlockHash,
  validateTransactionBalance,
  validateBlockTransactions,
  ValidationError,
  calculateInputSum,
  calculateOutputSum,
} from '../src/services/validation';
import type { Block, Transaction } from '../src/types/domain';

describe('Validation Service', () => {
  describe('validateBlockHeight', () => {
    test('should pass when block height is exactly one more than current height', () => {
      const block: Block = {
        id: 'block1',
        height: 1,
        transactions: [],
      };

      expect(() => validateBlockHeight(block, 0)).not.toThrow();
    });

    test('should throw when block height is not sequential', () => {
      const block: Block = {
        id: 'block1',
        height: 3,
        transactions: [],
      };

      expect(() => validateBlockHeight(block, 1)).toThrow(ValidationError);
      expect(() => validateBlockHeight(block, 1)).toThrow(
        'Invalid block height. Expected 2, got 3'
      );
    });

    test('should throw when block height is less than expected', () => {
      const block: Block = {
        id: 'block1',
        height: 1,
        transactions: [],
      };

      expect(() => validateBlockHeight(block, 5)).toThrow(ValidationError);
    });

    test('should allow height 1 when current height is 0 (genesis block)', () => {
      const block: Block = {
        id: 'block1',
        height: 1,
        transactions: [],
      };

      expect(() => validateBlockHeight(block, 0)).not.toThrow();
    });
  });

  describe('calculateBlockHash', () => {
    test('should calculate correct hash for block with one transaction', () => {
      const block: Block = {
        id: '',
        height: 1,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 10 }],
          },
        ],
      };

      const hash = calculateBlockHash(block);
      expect(hash).toBe('d1582b9e2cac15e170c39ef2e85855ffd7e6a820550a8ca16a2f016d366503dc');
    });

    test('should calculate correct hash for block with multiple transactions', () => {
      const block: Block = {
        id: '',
        height: 2,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 10 }],
          },
          {
            id: 'tx2',
            inputs: [],
            outputs: [{ address: 'addr2', value: 20 }],
          },
        ],
      };

      const hash = calculateBlockHash(block);
      expect(hash).toBe('6c7d011f9e17f8abb5abc6cb21199470e6c0e35a9d5699e36613ebca00bd1e10');
    });

    test('should produce different hashes for different heights', () => {
      const block1: Block = {
        id: '',
        height: 1,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 10 }],
          },
        ],
      };

      const block2: Block = {
        id: '',
        height: 2,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 10 }],
          },
        ],
      };

      const hash1 = calculateBlockHash(block1);
      const hash2 = calculateBlockHash(block2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('validateBlockHash', () => {
    test('should pass when block hash is correct', () => {
      const block: Block = {
        id: 'd1582b9e2cac15e170c39ef2e85855ffd7e6a820550a8ca16a2f016d366503dc',
        height: 1,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 10 }],
          },
        ],
      };

      expect(() => validateBlockHash(block)).not.toThrow();
    });

    test('should throw when block hash is incorrect', () => {
      const block: Block = {
        id: 'invalid_hash',
        height: 1,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 10 }],
          },
        ],
      };

      expect(() => validateBlockHash(block)).toThrow(ValidationError);
      expect(() => validateBlockHash(block)).toThrow('Invalid block hash');
    });
  });

  describe('calculateInputSum and calculateOutputSum', () => {
    test('should calculate correct sum for outputs', () => {
      const transaction: Transaction = {
        id: 'tx1',
        inputs: [],
        outputs: [
          { address: 'addr1', value: 10 },
          { address: 'addr2', value: 20 },
          { address: 'addr3', value: 30 },
        ],
      };

      const sum = calculateOutputSum(transaction);
      expect(sum).toBe(60);
    });

    test('should calculate correct sum for inputs', () => {
      const getOutputValue = (txId: string, index: number) => {
        if (txId === 'tx1' && index === 0) return 10;
        if (txId === 'tx1' && index === 1) return 20;
        return 0;
      };

      const sum = calculateInputSum(
        [
          { txId: 'tx1', index: 0 },
          { txId: 'tx1', index: 1 },
        ],
        getOutputValue
      );

      expect(sum).toBe(30);
    });
  });

  describe('validateTransactionBalance', () => {
    test('should pass when inputs equal outputs', () => {
      const transaction: Transaction = {
        id: 'tx1',
        inputs: [
          { txId: 'tx0', index: 0 },
        ],
        outputs: [
          { address: 'addr1', value: 50 },
        ],
      };

      const getOutputValue = (txId: string, index: number) => {
        if (txId === 'tx0' && index === 0) return 50;
        return 0;
      };

      expect(() => validateTransactionBalance(transaction, getOutputValue)).not.toThrow();
    });

    test('should throw when inputs are greater than outputs', () => {
      const transaction: Transaction = {
        id: 'tx1',
        inputs: [
          { txId: 'tx0', index: 0 },
        ],
        outputs: [
          { address: 'addr1', value: 30 },
        ],
      };

      const getOutputValue = (txId: string, index: number) => {
        if (txId === 'tx0' && index === 0) return 50;
        return 0;
      };

      expect(() => validateTransactionBalance(transaction, getOutputValue)).toThrow(ValidationError);
      expect(() => validateTransactionBalance(transaction, getOutputValue)).toThrow(
        'has unbalanced inputs and outputs'
      );
    });

    test('should throw when inputs are less than outputs', () => {
      const transaction: Transaction = {
        id: 'tx1',
        inputs: [
          { txId: 'tx0', index: 0 },
        ],
        outputs: [
          { address: 'addr1', value: 70 },
        ],
      };

      const getOutputValue = (txId: string, index: number) => {
        if (txId === 'tx0' && index === 0) return 50;
        return 0;
      };

      expect(() => validateTransactionBalance(transaction, getOutputValue)).toThrow(ValidationError);
    });

    test('should handle multiple inputs and outputs correctly', () => {
      const transaction: Transaction = {
        id: 'tx1',
        inputs: [
          { txId: 'tx0', index: 0 },
          { txId: 'tx0', index: 1 },
        ],
        outputs: [
          { address: 'addr1', value: 30 },
          { address: 'addr2', value: 40 },
        ],
      };

      const getOutputValue = (txId: string, index: number) => {
        if (txId === 'tx0' && index === 0) return 30;
        if (txId === 'tx0' && index === 1) return 40;
        return 0;
      };

      expect(() => validateTransactionBalance(transaction, getOutputValue)).not.toThrow();
    });
  });

  describe('validateBlockTransactions', () => {
    test('should pass when all transactions are valid', () => {
      const block: Block = {
        id: 'block1',
        height: 2,
        transactions: [
          {
            id: 'tx1',
            inputs: [{ txId: 'tx0', index: 0 }],
            outputs: [{ address: 'addr1', value: 50 }],
          },
          {
            id: 'tx2',
            inputs: [{ txId: 'tx1', index: 0 }],
            outputs: [
              { address: 'addr2', value: 30 },
              { address: 'addr3', value: 20 },
            ],
          },
        ],
      };

      const getOutputValue = (txId: string, index: number) => {
        if (txId === 'tx0' && index === 0) return 50;
        if (txId === 'tx1' && index === 0) return 50;
        return 0;
      };

      expect(() => validateBlockTransactions(block, getOutputValue)).not.toThrow();
    });

    test('should allow transactions with no inputs (coinbase)', () => {
      const block: Block = {
        id: 'block1',
        height: 1,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 50 }],
          },
        ],
      };

      const getOutputValue = () => 0;

      expect(() => validateBlockTransactions(block, getOutputValue)).not.toThrow();
    });

    test('should throw when any transaction is invalid', () => {
      const block: Block = {
        id: 'block1',
        height: 2,
        transactions: [
          {
            id: 'tx1',
            inputs: [{ txId: 'tx0', index: 0 }],
            outputs: [{ address: 'addr1', value: 50 }],
          },
          {
            id: 'tx2',
            inputs: [{ txId: 'tx1', index: 0 }],
            outputs: [
              { address: 'addr2', value: 60 }, // Invalid: more than input
            ],
          },
        ],
      };

      const getOutputValue = (txId: string, index: number) => {
        if (txId === 'tx0' && index === 0) return 50;
        if (txId === 'tx1' && index === 0) return 50;
        return 0;
      };

      expect(() => validateBlockTransactions(block, getOutputValue)).toThrow(ValidationError);
    });
  });
});
