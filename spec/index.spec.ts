import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import { DatabaseService } from '../src/models';
import { calculateBlockId, validateBlock } from '../src/utils/blockhain.util.ts';
import { Pool } from 'pg';
import { Block, Transaction } from '../src/schemas/blockchain.schema.ts';

// Use TEST_DATABASE_URL from .test.env (loaded via --env-file flag)
const testDbUrl = process.env.TEST_DATABASE_URL;

describe('Blockchain Indexer', () => {
  let pool: Pool;
  let dbService: DatabaseService;

  beforeEach(async () => {
    try {
      pool = new Pool({ connectionString: testDbUrl });
      dbService = new DatabaseService(pool);

      // Test connection first
      await pool.query('SELECT 1');

      // Clean up database
      await pool.query('DROP TABLE IF EXISTS address_balances CASCADE');
      await pool.query('DROP TABLE IF EXISTS outputs CASCADE');
      await pool.query('DROP TABLE IF EXISTS transactions CASCADE');
      await pool.query('DROP TABLE IF EXISTS blocks CASCADE');

      await dbService.initializeTables();
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  });

  afterEach(async () => {
    try {
      if (pool) {
        await pool.end();
      }
    } catch (error) {
      console.error('Error closing pool:', error);
    }
  });

  describe('Block ID Calculation', () => {
    test('calculates correct block ID', () => {
      const transactions: Transaction[] = [
        { id: 'tx1', inputs: [], outputs: [] },
        { id: 'tx2', inputs: [], outputs: [] }
      ];

      const blockId = calculateBlockId(1, transactions);
      // sha256("1tx1tx2") should be calculated correctly
      expect(blockId).toBe('74a9608142770b46c9eec3f39f41b4fb38d8d7f4063ac5676ccc2ed1d670c92b');
    });

    test('validates correct block ID', () => {
      const transactions: Transaction[] = [
        { id: 'tx1', inputs: [], outputs: [] },
        { id: 'tx2', inputs: [], outputs: [] }
      ];

      const block: Block = {
        id: calculateBlockId(1, transactions),
        height: 1,
        transactions
      };

      const validationResult = validateBlock(block, 0, { isValid: true, totalInputValue: 0 });
      expect(validationResult).toBeNull();
    });

    test('rejects incorrect block ID', () => {
      const block: Block = {
        id: 'wrong_id',
        height: 1,
        transactions: [{ id: 'tx1', inputs: [], outputs: [] }]
      };

      const validationResult = validateBlock(block, 0, { isValid: true, totalInputValue: 0 });
      expect(validationResult).not.toBeNull();
      expect(validationResult?.code).toBe('INVALID_BLOCK_ID');
    });
  });

  describe('Height Validation', () => {
    test('accepts block with correct height', () => {
      const block: Block = {
        id: calculateBlockId(1, []),
        height: 1,
        transactions: []
      };

      const validationResult = validateBlock(block, 0, { isValid: true, totalInputValue: 0 });
      expect(validationResult).toBeNull();
    });

    test('rejects block with incorrect height', () => {
      const block: Block = {
        id: calculateBlockId(3, []),
        height: 3,
        transactions: []
      };

      const validationResult = validateBlock(block, 0, { isValid: true, totalInputValue: 0 });
      expect(validationResult).not.toBeNull();
      expect(validationResult?.code).toBe('INVALID_HEIGHT');
    });
  });

  describe('Balance Validation', () => {
    test('accepts block with balanced inputs and outputs', () => {
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

    test('rejects block with unbalanced inputs and outputs', () => {
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

      const validationResult = validateBlock(block, 0, { isValid: true, totalInputValue: 5 });
      expect(validationResult).not.toBeNull();
      expect(validationResult?.code).toBe('INVALID_BALANCE');
    });
  });

  describe('Database Operations', () => {
    test('tracks current height correctly', async () => {
      const initialHeight = await dbService.blocks.getCurrentHeight();
      expect(initialHeight).toBe(0);

      const block: Block = {
        id: calculateBlockId(1, []),
        height: 1,
        transactions: []
      };

      await dbService.blocks.insert(block);
      const newHeight = await dbService.blocks.getCurrentHeight();
      expect(newHeight).toBe(1);
    });

    test('calculates address balance correctly', async () => {
      // Create block with initial transaction
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 100 }]
        }
      ];

      const block: Block = {
        id: calculateBlockId(1, transactions),
        height: 1,
        transactions
      };

      await dbService.blocks.insert(block);

      const balance = await dbService.outputs.getAddressBalance('addr1');
      expect(balance).toBe(100);
    });

    test('handles spending transactions correctly', async () => {
      // Block 1: Create initial UTXO
      const tx1: Transaction = {
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 100 }]
      };

      const block1: Block = {
        id: calculateBlockId(1, [tx1]),
        height: 1,
        transactions: [tx1]
      };

      await dbService.blocks.insert(block1);

      // Block 2: Spend the UTXO
      const tx2: Transaction = {
        id: 'tx2',
        inputs: [{ txId: 'tx1', index: 0 }],
        outputs: [
          { address: 'addr2', value: 60 },
          { address: 'addr3', value: 40 }
        ]
      };

      const block2: Block = {
        id: calculateBlockId(2, [tx2]),
        height: 2,
        transactions: [tx2]
      };

      await dbService.blocks.insert(block2);

      // Check balances
      expect(await dbService.outputs.getAddressBalance('addr1')).toBe(0);
      expect(await dbService.outputs.getAddressBalance('addr2')).toBe(60);
      expect(await dbService.outputs.getAddressBalance('addr3')).toBe(40);
    });

    test('validates inputs exist and are unspent', async () => {
      // Try to spend non-existent output
      const invalidInputs = [{ txId: 'nonexistent', index: 0 }];
      const validation = await dbService.transactions.validateInputsExist(invalidInputs);
      expect(validation.isValid).toBe(false);

      // Create UTXO
      const tx1: Transaction = {
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 100 }]
      };

      const block1: Block = {
        id: calculateBlockId(1, [tx1]),
        height: 1,
        transactions: [tx1]
      };

      await dbService.blocks.insert(block1);

      // Valid input reference
      const validInputs = [{ txId: 'tx1', index: 0 }];
      const validValidation = await dbService.transactions.validateInputsExist(validInputs);
      expect(validValidation.isValid).toBe(true);
      expect(validValidation.totalInputValue).toBe(100);

      // Spend the UTXO
      const tx2: Transaction = {
        id: 'tx2',
        inputs: [{ txId: 'tx1', index: 0 }],
        outputs: [{ address: 'addr2', value: 100 }]
      };

      const block2: Block = {
        id: calculateBlockId(2, [tx2]),
        height: 2,
        transactions: [tx2]
      };

      await dbService.blocks.insert(block2);

      // Try to spend already spent output
      const spentValidation = await dbService.transactions.validateInputsExist(validInputs);
      expect(spentValidation.isValid).toBe(false);
    });

    test('handles rollback correctly', async () => {
      // Create multiple blocks
      const tx1: Transaction = {
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 100 }]
      };

      const block1: Block = {
        id: calculateBlockId(1, [tx1]),
        height: 1,
        transactions: [tx1]
      };

      await dbService.blocks.insert(block1);

      const tx2: Transaction = {
        id: 'tx2',
        inputs: [{ txId: 'tx1', index: 0 }],
        outputs: [{ address: 'addr2', value: 100 }]
      };

      const block2: Block = {
        id: calculateBlockId(2, [tx2]),
        height: 2,
        transactions: [tx2]
      };

      await dbService.blocks.insert(block2);

      // Before rollback
      expect(await dbService.blocks.getCurrentHeight()).toBe(2);
      expect(await dbService.outputs.getAddressBalance('addr1')).toBe(0);
      expect(await dbService.outputs.getAddressBalance('addr2')).toBe(100);

      // Rollback to height 1
      await dbService.blocks.rollbackToHeight(1);

      // After rollback
      expect(await dbService.blocks.getCurrentHeight()).toBe(1);
      expect(await dbService.outputs.getAddressBalance('addr1')).toBe(100);
      expect(await dbService.outputs.getAddressBalance('addr2')).toBe(0);

      // Verify UTXO is unspent again
      const validation = await dbService.transactions.validateInputsExist([
        { txId: 'tx1', index: 0 }
      ]);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Example Scenario from README', () => {
    test('processes the complete example sequence', async () => {
      // Block 1: Create initial UTXO
      const tx1: Transaction = {
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 10 }]
      };

      const block1: Block = {
        id: calculateBlockId(1, [tx1]),
        height: 1,
        transactions: [tx1]
      };

      await dbService.blocks.insert(block1);
      expect(await dbService.outputs.getAddressBalance('addr1')).toBe(10);

      // Block 2: Split the UTXO
      const tx2: Transaction = {
        id: 'tx2',
        inputs: [{ txId: 'tx1', index: 0 }],
        outputs: [
          { address: 'addr2', value: 4 },
          { address: 'addr3', value: 6 }
        ]
      };

      const block2: Block = {
        id: calculateBlockId(2, [tx2]),
        height: 2,
        transactions: [tx2]
      };

      await dbService.blocks.insert(block2);
      expect(await dbService.outputs.getAddressBalance('addr1')).toBe(0);
      expect(await dbService.outputs.getAddressBalance('addr2')).toBe(4);
      expect(await dbService.outputs.getAddressBalance('addr3')).toBe(6);

      // Block 3: Spend one of the outputs
      const tx3: Transaction = {
        id: 'tx3',
        inputs: [{ txId: 'tx2', index: 1 }],
        outputs: [
          { address: 'addr4', value: 2 },
          { address: 'addr5', value: 2 },
          { address: 'addr6', value: 2 }
        ]
      };

      const block3: Block = {
        id: calculateBlockId(3, [tx3]),
        height: 3,
        transactions: [tx3]
      };

      await dbService.blocks.insert(block3);
      expect(await dbService.outputs.getAddressBalance('addr1')).toBe(0);
      expect(await dbService.outputs.getAddressBalance('addr2')).toBe(4);
      expect(await dbService.outputs.getAddressBalance('addr3')).toBe(0);
      expect(await dbService.outputs.getAddressBalance('addr4')).toBe(2);
      expect(await dbService.outputs.getAddressBalance('addr5')).toBe(2);
      expect(await dbService.outputs.getAddressBalance('addr6')).toBe(2);

      // Rollback to height 2
      await dbService.blocks.rollbackToHeight(2);
      expect(await dbService.outputs.getAddressBalance('addr1')).toBe(0);
      expect(await dbService.outputs.getAddressBalance('addr2')).toBe(4);
      expect(await dbService.outputs.getAddressBalance('addr3')).toBe(6);
      expect(await dbService.outputs.getAddressBalance('addr4')).toBe(0);
      expect(await dbService.outputs.getAddressBalance('addr5')).toBe(0);
      expect(await dbService.outputs.getAddressBalance('addr6')).toBe(0);
    });
  });
});
