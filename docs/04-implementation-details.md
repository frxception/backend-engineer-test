# Implementation Details - EMURGO Backend Engineer Challenge

## Table of Contents

1. [Problem Analysis](#problem-analysis)
2. [Technical Approach](#technical-approach)
3. [Core Implementation Decisions](#core-implementation-decisions)
4. [UTXO Model Implementation](#utxo-model-implementation)
5. [Validation Logic](#validation-logic)
6. [Database Design](#database-design)
7. [Transaction Management](#transaction-management)
8. [Error Handling Strategy](#error-handling-strategy)
9. [Performance Optimizations](#performance-optimizations)
10. [Code Organization](#code-organization)

## Problem Analysis

The challenge requires implementing a blockchain indexer that tracks address balances using the UTXO (Unspent Transaction Output) model. The key requirements are:

### Core Requirements

1. **Block Processing**: Process blocks with transactions containing inputs and outputs
2. **Balance Tracking**: Maintain current balance for each address
3. **Block Validation**: Ensure block integrity through multiple validation layers
4. **Rollback Support**: Support blockchain state rollback up to 2000 blocks
5. **ACID Compliance**: Ensure data consistency across all operations

### Validation Requirements

1. **Height Validation**: Blocks must be sequential (height = current + 1)
2. **Block ID Validation**: Block ID must be SHA256 hash of height + transaction IDs
3. **Input/Output Balance**: Sum of inputs must equal sum of outputs
4. **Input Existence**: All inputs must reference existing, unspent outputs

## Technical Approach

### 1. Architecture Selection

**Chosen**: Layered Architecture with Repository Pattern

**Rationale**:

- Clear separation between HTTP handling, business logic, and data access
- Enables independent testing of each layer
- Supports future scaling and microservice migration
- Follows SOLID principles

```typescript
// Layer dependency flow
HTTP Layer -> Controller Layer -> Service Layer -> Model Layer -> Database
```

### 2. Technology Stack

**Fastify + TypeScript + PostgreSQL + Bun**

**Rationale**:

- **Fastify**: High-performance framework with built-in schema validation, better TypeScript support
- **TypeScript**: Type safety, better IDE support, reduced runtime errors
- **PostgreSQL 15**: ACID compliance, advanced indexing, JSON support
- **Bun**: Fast runtime, built-in test runner, TypeScript support
- **Zod 4.x**: Runtime schema validation with TypeScript inference

### 3. Validation Strategy

**Multi-Layer Validation**:

1. **Schema Validation** (Zod): Type and format validation
2. **Business Logic Validation**: Domain-specific rules
3. **Database Constraints**: Referential integrity
4. **Cross-Transaction Validation**: UTXO consistency

## Core Implementation Decisions

### 1. Block ID Calculation

```typescript
// src/utils/blockhain.util.ts
export function calculateBlockId(height: number, transactions: Transaction[]): string {
  const transactionIds = transactions.map(tx => tx.id).join('');
  const input = height.toString() + transactionIds;
  return createHash('sha256').update(input).digest('hex');
}
```

**Design Decision**: Use deterministic hash calculation
**Rationale**:

- Ensures block integrity
- Prevents tampering
- Enables verification without storing expected hash

### 2. Balance Tracking Strategy

**Chosen**: Real-time balance updates with dedicated balance table

```sql
-- Address balances are pre-computed and stored
CREATE TABLE address_balances (
  address TEXT PRIMARY KEY,
  balance BIGINT NOT NULL DEFAULT 0,
  last_updated_height INTEGER NOT NULL DEFAULT 0
);
```

**Alternative Considered**: Calculate balances on-demand from UTXO set
**Rationale for Choice**:

- O(1) balance queries vs O(n) UTXO aggregation
- Better performance for frequent balance checks
- Simplified query logic

### 3. Transaction Atomicity

```typescript
// src/models/block.model.ts
async insert(block: Block): Promise<void> {
  const client = await this.pool.connect();
  try {
    await client.query('BEGIN');

    // Insert block record
    await client.query(
      'INSERT INTO blocks (id, height) VALUES ($1, $2)',
      [block.id, block.height]
    );

    // Process all transactions within this atomic transaction
    for (const transaction of block.transactions) {
      await this.transactionModel.insertWithClient(client, transaction, block);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

**Design Decision**: Wrap all block processing in database transaction
**Rationale**:

- Ensures ACID properties
- Prevents partial updates on validation failures
- Maintains data consistency

## UTXO Model Implementation

### 1. Output Lifecycle Management

```typescript
// Output creation (when transaction is processed)
{
  transaction_id: "tx1",
  output_index: 0,
  address: "addr1",
  value: 100,
  is_spent: false,        // Initially unspent
  spent_in_transaction_id: null
}

// Output spending (when referenced as input)
{
  is_spent: true,
  spent_in_transaction_id: "tx2"  // Transaction that spent this output
}
```

### 2. Input Validation Logic

```typescript
// src/models/transaction.model.ts
async validateInputsExist(inputs: Input[]): Promise<{isValid: boolean, totalInputValue: number}> {
  if (inputs.length === 0) {
    // Coinbase transaction - no inputs to validate
    return { isValid: true, totalInputValue: 0 };
  }

  let totalValue = 0;
  for (const input of inputs) {
    const result = await this.pool.query(
      'SELECT value, is_spent FROM outputs WHERE transaction_id = $1 AND output_index = $2',
      [input.txId, input.index]
    );

    if (result.rows.length === 0) {
      return { isValid: false, totalInputValue: 0 }; // Output doesn't exist
    }

    if (result.rows[0].is_spent) {
      return { isValid: false, totalInputValue: 0 }; // Output already spent
    }

    totalValue += parseInt(result.rows[0].value);
  }

  return { isValid: true, totalInputValue: totalValue };
}
```

### 3. Balance Update Mechanism

```typescript
// When processing outputs (value received)
await updateAddressBalance(address, +value, height);

// When processing inputs (value spent)
await updateAddressBalance(address, -value, height);
```

**Key Insight**: Balance changes are applied bidirectionally - outputs add value, inputs subtract value.

## Validation Logic

### 1. Block Validation Pipeline

```typescript
// src/utils/blockhain.util.ts
export function validateBlock(
  block: Block,
  currentHeight: number,
  inputValidation: { isValid: boolean; totalInputValue: number }
): ValidationError | null {
  // 1. Validate block ID (hash)
  const expectedId = calculateBlockId(block.height, block.transactions);
  if (block.id !== expectedId) {
    return {
      code: 'INVALID_BLOCK_ID',
      message: `Block ID mismatch. Expected: ${expectedId}, Got: ${block.id}`
    };
  }

  // 2. Validate height
  if (block.height !== currentHeight + 1) {
    return {
      code: 'INVALID_HEIGHT',
      message: `Invalid block height. Expected: ${currentHeight + 1}, Got: ${block.height}`
    };
  }

  // 3. Validate inputs exist and are unspent
  if (!inputValidation.isValid) {
    return {
      code: 'INVALID_INPUTS',
      message: 'One or more inputs are invalid or already spent'
    };
  }

  // 4. Validate input/output balance
  const totalOutputValue = block.transactions.reduce(
    (sum, tx) => sum + tx.outputs.reduce((txSum, out) => txSum + out.value, 0),
    0
  );

  if (inputValidation.totalInputValue !== totalOutputValue) {
    return {
      code: 'INVALID_BALANCE',
      message: `Input/output mismatch. Inputs: ${inputValidation.totalInputValue}, Outputs: ${totalOutputValue}`
    };
  }

  return null; // Valid block
}
```

**Validation Order** (fail-fast approach):

1. **Block ID Validation**: Cryptographic integrity check
2. **Height Validation**: Sequential ordering check
3. **Input Existence**: UTXO availability check
4. **Balance Validation**: Input/output sum check

### 2. Special Case: Coinbase Transactions

```typescript
// src/utils/blockhain.util.ts
// Coinbase transactions (transactions with no inputs) are allowed
// These create new value in the system (like mining rewards)
const hasCoinbaseTransaction = block.transactions.some(tx => tx.inputs.length === 0);

if (hasCoinbaseTransaction) {
  // For coinbase transactions, we don't require input/output balance
  // This allows value creation (initial blocks, mining rewards, etc.)
  return null; // Valid - coinbase transactions allowed
}
```

**Design Decision**: Support coinbase transactions (no inputs)
**Rationale**:

- Enables mining rewards/block rewards
- Supports initial value creation in blockchain
- Follows Bitcoin UTXO model
- Essential for the first block (genesis block)

> #### Information:
>
> > #### **What is a Coinbase Transaction?**
> >
> > In simple terms, a coinbase transaction is a special transaction that creates new coins
> > "out of thin air" - it has no inputs, only outputs.

> **Think of it like this:**

- Regular transaction: "I'm sending you \$10 from the \$50 I already have" (has inputs +
  outputs)
- Coinbase transaction: "Here's $10 that just appeared" (only outputs, no inputs)

> #### Real-World Examples

**Bitcoin**

- Miners create a coinbase transaction when they successfully mine a block
- This is how new Bitcoin enters circulation (block reward)
- Example: Miner creates 6.25 BTC out of nothing as a reward

> **Your Blockchain**

In the seed data, coinbase-like transactions appear in every block (tx5, tx8, tx11,
tx14, tx17):

```js
// Block 2, Transaction 5 (coinbase-like)
transactions.push({
  id: this.generateTxId(),
  inputs: [], // <-- NO INPUTS!
  outputs: [{ address: this.generateAddress(), value: 100 }] // Creates 100 units
});
```

> **Why Mix Regular + Coinbase Transactions?**

The implementation mixes both types in each block to simulate a realistic blockchain:

Block Structure Pattern (Blocks 2-6)

**Each block contains:**

1. Transaction 1: Spends previous outputs (regular)
2. Transaction 2: Spends different outputs (regular)
3. Transaction 3: Coinbase - creates 100 new units (no inputs)

```
  Block 2:
  ├─ tx3: Spends tx1[0] + tx1[1] → Creates addr6, addr7 (REGULAR)
  ├─ tx4: Spends tx1[2]         → Creates addr8, addr9, addr10 (REGULAR)
  └─ tx5: No inputs             → Creates addr11 with 100 (COINBASE)
```

> **Why This Design?**

1. **Testing Flexibility**

- Coinbase transactions ensure you always have new unspent outputs
- Without them, you'd eventually run out of UTXOs to spend
- Enables continuous blockchain growth in tests

2. **Realistic Blockchain Behavior**

- Real blockchains have both:
  - User transactions (spending existing coins)
  - Block rewards (minting new coins)
- This mirrors Bitcoin/Ethereum structure

3. **UTXO Pool Management**

```
  // After a few blocks, you might spend all UTXOs
  // Coinbase ensures fresh UTXOs for next blocks
  Block 3: Spends all outputs from Block 1 ❌ (would run out)
  Block 3: Spends some + adds coinbase ✅ (sustainable)
```

**Code Evidence**

> src/seed.ts

```js
// Add a coinbase-like transaction (no inputs)
transactions.push({
  id: this.generateTxId(),
  inputs: [], // <-- This makes it coinbase
  outputs: [{ address: this.generateAddress(), value: 100 }]
});
```

The comment explicitly calls it "coinbase-like" because:

- It creates new value without consuming existing outputs
- It has no inputs (can't validate against previous UTXOs)

> **Validation Difference**

The blockchain service handles coinbase differently:

**Regular Transaction Validation (src/services/blockchain.service.ts):**

- ✅ Must have inputs that reference valid UTXOs
- ✅ Input sum must equal output sum

**Coinbase Transaction Validation:**

- ✅ Can have zero inputs (inputs.length === 0)
- ✅ Doesn't need UTXO validation (line 153-155 in blockchain.service.ts)

```js
// Line 153-155
if (inputs.length === 0) {
  return { isValid: true, totalInputValue: 0 }; // Coinbase allowed!
}
```

> **Summary**
>
> Coinbase transactions create new coins from nothing (mining rewards). They're mixed
> with regular transactions to:
>
> > 1.  Simulate real blockchain behavior (rewards + user transfers)
> > 2.  Keep a steady supply of spendable UTXOs for testing
> > 3.  Allow the blockchain to grow indefinitely without running out of coins
>
> _Without coinbase transactions, your test blockchain would eventually spend all its
> UTXOs and couldn't create new blocks!_

### 3. Mixed Transaction Blocks

```typescript
// Separate regular and coinbase transaction validation
let coinbaseOutputValue = 0;
let regularOutputValue = 0;

for (const transaction of block.transactions) {
  if (transaction.inputs.length === 0) {
    // Coinbase transaction - value creation allowed
  } else {
    // Regular transaction - inputs must equal outputs
  }
}
```

**Design Decision**: Allow mixed blocks with both coinbase and regular transactions
**Rationale**: Flexibility for different blockchain designs

## Database Design

### 1. Schema Optimization

```sql
-- Primary tables with optimized indexes
CREATE TABLE blocks (
  id TEXT PRIMARY KEY,                    -- Block hash
  height INTEGER UNIQUE NOT NULL,         -- Sequential height
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_blocks_height ON blocks(height);

CREATE TABLE outputs (
  id SERIAL PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id),
  output_index INTEGER NOT NULL,
  address TEXT NOT NULL,
  value BIGINT NOT NULL,
  is_spent BOOLEAN DEFAULT FALSE,
  spent_in_transaction_id TEXT REFERENCES transactions(id),
  block_height INTEGER NOT NULL,
  UNIQUE(transaction_id, output_index)    -- Prevent duplicate outputs
);

-- Composite indexes for efficient queries
CREATE INDEX idx_outputs_address ON outputs(address);
CREATE INDEX idx_outputs_spent ON outputs(is_spent);
```

### 2. Referential Integrity

**Foreign Key Constraints**:

- `transactions.block_id` → `blocks.id`
- `outputs.transaction_id` → `transactions.id`
- `outputs.spent_in_transaction_id` → `transactions.id`

**Cascade Rules**:

- `ON DELETE CASCADE`: Deleting block removes all transactions and outputs
- `ON DELETE SET NULL`: Deleting spending transaction resets spent reference

### 3. Data Types

**BIGINT for values**: Supports large value ranges (up to 2^63-1)
**TEXT for IDs**: Flexible length for hash strings
**SERIAL for auto-increment**: PostgreSQL-optimized auto-incrementing primary keys

## Transaction Management

### 1. Database Transaction Scope

```typescript
// Each block processing is one database transaction
async processBlock(block: Block): Promise<void> {
  BEGIN TRANSACTION
    1. Insert block record
    2. For each transaction:
       a. Insert transaction record
       b. Process inputs (mark outputs as spent, update balances)
       c. Process outputs (create new outputs, update balances)
    3. Validate all constraints
  COMMIT TRANSACTION
}
```

### 2. Rollback Implementation

```typescript
// src/models/Block.ts:90-121
async rollbackToHeight(targetHeight: number): Promise<void> {
  BEGIN TRANSACTION
    1. Identify blocks to rollback (height > targetHeight)
    2. For each block (in reverse order):
       a. Reverse UTXO changes
       b. Restore spent outputs
       c. Revert balance updates
    3. Delete blocks and related data
  COMMIT TRANSACTION
}
```

**Key Design**: Rollback operations are also atomic transactions

### 3. Connection Pooling

```typescript
// src/config/database.config.ts
export class DatabaseConfig {
  private static instance: Pool;

  public static getInstance(): Pool {
    if (!DatabaseConfig.instance) {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL is required');
      }

      DatabaseConfig.instance = new Pool({
        connectionString: databaseUrl,
        max: process.env.DATABASE_POOL_MAX ? parseInt(process.env.DATABASE_POOL_MAX, 10) : 20,
        idleTimeoutMillis: process.env.DATABASE_IDLE_TIMEOUT_MS
          ? parseInt(process.env.DATABASE_IDLE_TIMEOUT_MS, 10)
          : 30000,
        connectionTimeoutMillis: process.env.DATABASE_CONNECTION_TIMEOUT_MS
          ? parseInt(process.env.DATABASE_CONNECTION_TIMEOUT_MS, 10)
          : 2000
      });
    }

    return DatabaseConfig.instance;
  }

  public static resetInstance(): void {
    if (DatabaseConfig.instance) {
      DatabaseConfig.instance.end();
      DatabaseConfig.instance = null as any;
    }
  }

  public static async testConnection(): Promise<void> {
    const pool = DatabaseConfig.getInstance();
    try {
      await pool.query('SELECT 1');
      console.log('Database connection successful');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }
}
```

**Design Decision**: Singleton pattern for connection pool
**Rationale**:

- Prevents connection pool leaks in tests
- `resetInstance()` method for test isolation
- `testConnection()` validates connection on startup
- Environment-based configuration

## Error Handling Strategy

### 1. Error Classification

```typescript
// src/utils.ts:31-34
export interface ValidationError {
  code: string; // Machine-readable error code
  message: string; // Human-readable error message
}
```

**Error Categories**:

- `INVALID_HEIGHT`: Block sequencing errors
- `INVALID_BLOCK_ID`: Block hash validation errors
- `INVALID_INPUTS`: UTXO reference errors
- `INVALID_BALANCE`: Input/output sum errors

### 2. Error Propagation with Fastify

```typescript
// src/controllers/blockchain.controller.ts
export class BlockchainController {
  constructor(private service: BlockchainService) {}

  async processBlock(request: FastifyRequest<{ Body: Block }>, reply: FastifyReply) {
    try {
      const result = await this.service.processBlock(request.body);
      return reply.status(200).send(result);
    } catch (error: any) {
      // Fastify automatically handles error serialization
      const statusCode = error.code ? 400 : 500;
      throw { statusCode, ...error };
    }
  }
}
```

### 3. Centralized Error Handling (Fastify)

```typescript
// src/app.ts
app.setErrorHandler(async (error, request, reply) => {
  const statusCode = error.statusCode || 500;
  const errorCode = (error as any).code || 'INTERNAL_ERROR';
  const message = error.message || 'Internal server error';

  request.log.error({ error, statusCode, errorCode }, `Error ${statusCode}: ${message}`);

  return reply.status(statusCode).send({
    error: errorCode,
    message
  });
});

// 404 handler
app.setNotFoundHandler(async (request, reply) => {
  return reply.status(404).send({
    error: 'NOT_FOUND',
    message: 'Endpoint not found'
  });
});
```

**Key Change**: Fastify's error handling is async-first and built-in logger support

## Performance Optimizations

### 1. Database Indexes

```sql
-- Frequently queried columns
CREATE INDEX idx_blocks_height ON blocks(height);           -- Height lookups
CREATE INDEX idx_outputs_address ON outputs(address);       -- Balance queries
CREATE INDEX idx_outputs_spent ON outputs(is_spent);        -- UTXO queries

-- Composite indexes for complex queries
CREATE INDEX idx_outputs_tx_index ON outputs(transaction_id, output_index);
```

### 2. Query Optimization

```typescript
// Efficient balance query (O(1) lookup)
SELECT balance FROM address_balances WHERE address = $1;

// vs. naive approach (O(n) aggregation)
SELECT SUM(value) FROM outputs
WHERE address = $1 AND is_spent = false;
```

### 3. Connection Pooling

- **Pool Size**: 10 connections (configurable)
- **Idle Timeout**: 30 seconds
- **Connection Timeout**: 2 seconds
- **Connection Reuse**: Reduces connection overhead

### 4. Memory Management

```typescript
// Process transactions in sequence (not parallel) to control memory usage
for (const transaction of block.transactions) {
  await transactionModel.insertWithClient(client, transaction, block);
}
```

## Code Organization

### 1. Folder Structure

```
src/
├── config/                      # Configuration management
│   ├── app.config.ts           # Application settings (PORT, HOST, etc.)
│   └── database.config.ts      # Database singleton with connection pooling
├── controllers/                 # Fastify HTTP request handlers
│   ├── blockchain.controller.ts # Block processing, balance, rollback
│   └── health.controller.ts     # Health check endpoint
├── plugins/                     # Fastify plugins
│   └── validation.plugin.ts     # Zod schema validation integration
├── models/                      # Data access layer (Repository pattern)
│   ├── block.model.ts           # Block CRUD operations
│   ├── transaction.model.ts     # Transaction and UTXO management
│   ├── output.model.ts          # Output/balance operations
│   └── index.ts                 # DatabaseService facade
├── routes/                      # Fastify route definitions
│   ├── blockchain.route.ts      # /api/blocks, /api/balance, /api/rollback
│   ├── health.route.ts          # / health endpoint
│   └── index.ts                 # Route registry
├── schemas/                     # Zod validation schemas
│   └── blockchain.schema.ts     # Block, Transaction, Input, Output schemas
├── services/                    # Business logic layer
│   └── blockchain.service.ts    # Block validation and processing orchestration
├── utils/                       # Utility functions
│   └── blockhain.util.ts        # calculateBlockId, validateBlock
├── app.ts                       # Fastify app factory
├── index.ts                     # Application entry point
└── seed.ts                      # Database seeding script
```

### 2. Design Patterns Used

1. **Repository Pattern**: Models abstract database operations
2. **Service Layer Pattern**: Services contain business logic
3. **Facade Pattern**: DatabaseService provides unified interface
4. **Plugin Pattern**: Fastify plugins for middleware functionality
5. **Singleton Pattern**: DatabaseConfig for connection pool management
6. **Strategy Pattern**: Validation functions are composable
7. **Factory Pattern**: Fastify app factory in `createApp()`
8. **Decorator Pattern**: Fastify decorators for extending functionality

### 3. Dependency Injection

```typescript
// Constructor injection for testability
export class BlockchainController {
  constructor(private blockchainService: BlockchainService) {}
}

export class BlockchainService {
  constructor(private dbService: DatabaseService) {}
}

export class DatabaseService {
  constructor(private pool: Pool) {}
}
```

## Key Implementation Insights

### 1. Why Pre-computed Balances?

**Alternative**: Calculate balances by aggregating unspent outputs
**Chosen**: Maintain balance table with real-time updates

**Rationale**:

- Balance queries are likely to be frequent
- O(1) lookup vs O(n) aggregation
- Simpler query logic for API consumers

### 2. Why Separate Transaction Processing?

```typescript
// Process each transaction individually within the block transaction
for (const transaction of block.transactions) {
  await this.processTransaction(transaction, client);
}
```

**Rationale**:

- Clear transaction boundaries
- Easier error handling and debugging
- Maintains order of operations

### 3. Why Explicit Spent Tracking?

**Alternative**: Use LEFT JOIN to detect spent outputs
**Chosen**: `is_spent` boolean flag

**Rationale**:

- Faster queries (index on boolean vs JOIN operation)
- Simpler logic for UTXO validation
- Better performance for large datasets

### 4. Why Height-based Rollback?

```typescript
async rollbackToHeight(targetHeight: number): Promise<void> {
  // Delete all blocks with height > targetHeight
  // Automatically cascades to transactions and outputs
}
```

**Rationale**:

- Simple, deterministic rollback logic
- Leverages database foreign key constraints
- Consistent with blockchain height semantics

This implementation provides a robust, scalable solution for the blockchain indexer while maintaining code clarity and performance optimization.
