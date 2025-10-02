import { Pool } from 'pg';
import { createHash } from 'crypto';
import { DatabaseService } from './models';
import { Block, Transaction } from './schemas/blockchain.schema.ts';

// Helper function to generate block ID
function generateBlockId(height: number, transactionIds: string[]): string {
  const data = height.toString() + transactionIds.join('');
  return createHash('sha256').update(data).digest('hex');
}

// Mock data generator
export class MockDataGenerator {
  private static instance: MockDataGenerator;
  private addressCounter = 1;
  private txCounter = 1;

  static getInstance(): MockDataGenerator {
    if (!MockDataGenerator.instance) {
      MockDataGenerator.instance = new MockDataGenerator();
    }
    return MockDataGenerator.instance;
  }

  generateAddress(): string {
    return `addr${this.addressCounter++}`;
  }

  generateTxId(): string {
    return `tx${this.txCounter++}`;
  }

  // Create genesis block (first block with no inputs)
  createGenesisBlock(): Block {
    const transactions: Transaction[] = [
      {
        id: this.generateTxId(),
        inputs: [],
        outputs: [
          { address: this.generateAddress(), value: 1000 },
          { address: this.generateAddress(), value: 500 },
          { address: this.generateAddress(), value: 250 }
        ]
      },
      {
        id: this.generateTxId(),
        inputs: [],
        outputs: [
          { address: this.generateAddress(), value: 800 },
          { address: this.generateAddress(), value: 300 }
        ]
      }
    ];

    const height = 1;
    const transactionIds = transactions.map(tx => tx.id);
    const blockId = generateBlockId(height, transactionIds);

    return {
      id: blockId,
      height,
      transactions
    };
  }

  // Create a block that spends outputs from previous blocks
  createBlockWithInputs(
    height: number,
    availableOutputs: Array<{ txId: string; index: number; value: number; address: string }>
  ): Block {
    const transactions: Transaction[] = [];

    // Transaction 1: Spend some previous outputs
    if (availableOutputs.length >= 2) {
      const input1 = availableOutputs[0];
      const input2 = availableOutputs[1];

      transactions.push({
        id: this.generateTxId(),
        inputs: [
          { txId: input1.txId, index: input1.index },
          { txId: input2.txId, index: input2.index }
        ],
        outputs: [
          {
            address: this.generateAddress(),
            value: Math.floor((input1.value + input2.value) * 0.6)
          },
          {
            address: this.generateAddress(),
            value: Math.floor((input1.value + input2.value) * 0.4)
          }
        ]
      });
    }

    // Transaction 2: Another transaction with different inputs
    if (availableOutputs.length >= 4) {
      const input3 = availableOutputs[2];

      transactions.push({
        id: this.generateTxId(),
        inputs: [{ txId: input3.txId, index: input3.index }],
        outputs: [
          { address: this.generateAddress(), value: Math.floor(input3.value * 0.3) },
          { address: this.generateAddress(), value: Math.floor(input3.value * 0.3) },
          { address: this.generateAddress(), value: Math.floor(input3.value * 0.4) }
        ]
      });
    }

    // Add a coinbase-like transaction (no inputs)
    transactions.push({
      id: this.generateTxId(),
      inputs: [],
      outputs: [{ address: this.generateAddress(), value: 100 }]
    });

    const transactionIds = transactions.map(tx => tx.id);
    const blockId = generateBlockId(height, transactionIds);

    return {
      id: blockId,
      height,
      transactions
    };
  }
}

export async function seedDatabase(databaseUrl: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });
  const dbService = new DatabaseService(pool);
  const mockGen = MockDataGenerator.getInstance();

  try {
    console.log('🌱 Starting database seeding...');

    // Initialize tables
    await dbService.initializeTables();
    console.log('✅ Tables initialized');

    // Create genesis block
    const genesisBlock = mockGen.createGenesisBlock();
    await dbService.insertBlock(genesisBlock);
    console.log(`✅ Genesis block created (height: ${genesisBlock.height})`);

    // Track unspent outputs for creating subsequent blocks
    let unspentOutputs: Array<{ txId: string; index: number; value: number; address: string }> = [];

    // Add all outputs from genesis block as unspent
    genesisBlock.transactions.forEach(tx => {
      tx.outputs.forEach((output, index) => {
        unspentOutputs.push({
          txId: tx.id,
          index,
          value: output.value,
          address: output.address
        });
      });
    });

    // Create 5 more blocks
    for (let height = 2; height <= 6; height++) {
      const block: Block = mockGen.createBlockWithInputs(height, unspentOutputs);
      await dbService.insertBlock(block);
      console.log(`✅ Block ${height} created`);

      // Update unspent outputs
      // Remove spent outputs
      block.transactions.forEach(tx => {
        tx.inputs.forEach(input => {
          unspentOutputs = unspentOutputs.filter(
            utxo => !(utxo.txId === input.txId && utxo.index === input.index)
          );
        });

        // Add new outputs
        tx.outputs.forEach((output, index) => {
          unspentOutputs.push({
            txId: tx.id,
            index,
            value: output.value,
            address: output.address
          });
        });
      });
    }

    // Display some sample balances
    console.log('\n📊 Sample address balances:');
    for (let i = 1; i <= 10; i++) {
      const address = `addr${i}`;
      const balance = await dbService.getAddressBalance(address);
      if (balance > 0) {
        console.log(`  ${address}: ${balance}`);
      }
    }

    const currentHeight = await dbService.getCurrentHeight();
    console.log(`\n🎉 Seeding completed! Current blockchain height: ${currentHeight}`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// CLI runner
if (require.main === module) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  seedDatabase(databaseUrl)
    .then(() => {
      console.log('✅ Seeding process completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Seeding process failed:', error);
      process.exit(1);
    });
}
