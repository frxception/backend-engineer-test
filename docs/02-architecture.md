# Architecture Documentation - EMURGO Backend Engineer Challenge

## Table of Contents

1. [Architectural Overview](#architectural-overview)
2. [Layer Architecture](#layer-architecture)
3. [Component Design](#component-design)
4. [Database Schema](#database-schema)
5. [Security Architecture](#security-architecture)
6. [Error Handling Architecture](#error-handling-architecture)
7. [Validation Architecture](#validation-architecture)
8. [Deployment Architecture](#deployment-architecture)

## Architectural Overview

The application follows a **Layered Architecture** pattern with clear separation of concerns, implementing the **Repository Pattern** for data access and **Dependency Injection** for loose coupling. The architecture is designed to be maintainable, testable, and scalable.

### Core Architectural Principles

1. **Separation of Concerns**: Each layer has a specific responsibility
2. **Dependency Inversion**: High-level modules don't depend on low-level modules
3. **Single Responsibility**: Each class/module has one reason to change
4. **Open/Closed Principle**: Open for extension, closed for modification
5. **Interface Segregation**: Clients depend only on methods they use

## Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Presentation Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │   Routes        │  │  Controllers    │  │   Middleware    │    │
│  │ • HTTP Routing  │  │ • Request       │  │ • Validation    │    │
│  │ • Path Matching │  │   Handling      │  │ • Security      │    │
│  │ • Method        │  │ • Response      │  │ • Error         │    │
│  │   Validation    │  │   Formatting    │  │   Handling      │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Business Logic Layer                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │   Services      │  │   Validation    │  │   Utilities     │    │
│  │ • Business      │  │ • Block         │  │ • Hash          │    │
│  │   Rules         │  │   Validation    │  │   Generation    │    │
│  │ • Orchestration │  │ • Input/Output  │  │ • Data          │    │
│  │ • Coordination  │  │   Verification  │  │   Transformation│    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Data Access Layer                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │   Models        │  │  DatabaseService│  │   Repositories  │    │
│  │ • Data Models   │  │ • Connection    │  │ • Query Logic   │    │
│  │ • CRUD          │  │   Management    │  │ • Data Access   │    │
│  │   Operations    │  │ • Transaction   │  │   Patterns      │    │
│  │ • Table         │  │   Handling      │  │ • Aggregation   │    │
│  │   Management    │  │ • Pool          │  │   Queries       │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Storage Layer                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │   PostgreSQL    │  │    Indexes      │  │   Constraints   │    │
│  │ • ACID          │  │ • B-Tree        │  │ • Foreign Keys  │    │
│  │   Transactions  │  │   Indexes       │  │ • Primary Keys  │    │
│  │ • Connection    │  │ • Unique        │  │ • Check         │    │
│  │   Pooling       │  │   Constraints   │  │   Constraints   │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Presentation Layer Components

#### Routes (src/routes/)

```typescript
// Fastify Route Definition Pattern
export default async function blockchainRoutes(fastify: FastifyInstance, options: any) {
  const controller = new BlockchainController(fastify.db.service);

  fastify.post(
    '/blocks',
    {
      schema: { body: BlockSchema }
    },
    controller.processBlock.bind(controller)
  );

  fastify.get('/balance/:address', controller.getBalance.bind(controller));
  fastify.post('/rollback', controller.rollback.bind(controller));
}
```

**Design Rationale:**

- Fastify plugin-based architecture for modularity
- Built-in schema validation with Zod integration
- Type-safe request/response handling
- Automatic OpenAPI documentation generation (future)

#### Controllers (src/controllers/)

```typescript
// Fastify Controller Pattern
export class BlockchainController {
  constructor(private blockchainService: BlockchainService) {}

  async processBlock(request: FastifyRequest<{ Body: Block }>, reply: FastifyReply) {
    try {
      const result = await this.blockchainService.processBlock(request.body);
      return reply.status(200).send(result);
    } catch (error) {
      // Fastify handles error propagation automatically
      throw error;
    }
  }
}
```

**Design Rationale:**

- Thin controllers focus only on HTTP concerns
- Fastify automatically handles error serialization
- Business logic is delegated to services
- Type-safe request/reply objects with generics

### 2. Business Logic Layer Components

#### Services (src/services/)

```typescript
// Service Layer Pattern
export class BlockchainService {
  constructor(private dbService: DatabaseService) {}

  async processBlock(block: Block): Promise<ProcessResult> {
    // 1. Validation
    const validation = await this.validateBlock(block);
    if (!validation.valid) throw new ValidationError(validation.error);

    // 2. Transaction Management
    return await this.dbService.executeTransaction(async tx => {
      await this.insertBlock(block, tx);
      await this.updateBalances(block, tx);
      return { blockId: block.id, height: block.height };
    });
  }
}
```

**Design Rationale:**

- Encapsulates business rules and workflows
- Manages transaction boundaries
- Coordinates between multiple data operations

#### Validation (src/utils.ts)

```typescript
// Validation Strategy Pattern
export function validateBlock(
  block: Block,
  currentHeight: number,
  inputValidation: InputValidationResult
): ValidationError | null {
  // Height validation
  if (block.height !== currentHeight + 1) {
    return { code: 'INVALID_HEIGHT', message: '...' };
  }

  // Hash validation
  if (!validateBlockHash(block)) {
    return { code: 'INVALID_BLOCK_ID', message: '...' };
  }

  // Input/Output validation
  if (!validateInputOutputBalance(block, inputValidation)) {
    return { code: 'INVALID_BALANCE', message: '...' };
  }

  return null;
}
```

**Design Rationale:**

- Pure functions for easy testing
- Specific error codes for different validation failures
- Composable validation rules

### 3. Data Access Layer Components

#### DatabaseService (src/models/index.ts)

```typescript
// Service Facade Pattern
export class DatabaseService {
  constructor(private pool: Pool) {
    this.blockModel = new BlockModel(pool);
    this.transactionModel = new TransactionModel(pool);
    this.outputModel = new OutputModel(pool);
  }

  async executeTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

**Design Rationale:**

- Provides unified interface to data layer
- Manages database transactions centrally
- Abstracts connection pooling complexity

#### Model Classes (src/models/)

```typescript
// Active Record Pattern
export class BlockModel {
  constructor(private pool: Pool) {}

  async insert(block: Block): Promise<void> {
    await this.pool.query('INSERT INTO blocks (id, height) VALUES ($1, $2)', [
      block.id,
      block.height
    ]);
  }

  async getCurrentHeight(): Promise<number> {
    const result = await this.pool.query('SELECT COALESCE(MAX(height), 0) as height FROM blocks');
    return result.rows[0].height;
  }
}
```

**Design Rationale:**

- Each model manages one database table
- Encapsulates SQL queries and database operations
- Provides type-safe interfaces

## Database Schema

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   blocks    │──────▶│  transactions   │──────▶│    outputs      │
│             │ 1:N   │                 │ 1:N   │                 │
│ • id (PK)   │       │ • id (PK)       │       │ • id (PK)       │
│ • height    │       │ • block_id (FK) │       │ • tx_id (FK)    │
│ • created_at│       │ • tx_id         │       │ • index         │
└─────────────┘       │ • created_at    │       │ • address       │
                      └─────────────────┘       │ • value         │
                                                │ • is_spent      │
                                                │ • spent_tx_id   │
                                                │ • created_at    │
                                                └─────────────────┘
                                                         │
                                                         │ aggregates to
                                                         ▼
                                                ┌─────────────────┐
                                                │ address_balances│
                                                │                 │
                                                │ • address (PK)  │
                                                │ • balance       │
                                                │ • updated_at    │
                                                └─────────────────┘
```

### Schema Design Principles

1. **Normalization**: Tables are in 3NF to eliminate redundancy
2. **Referential Integrity**: Foreign key constraints ensure data consistency
3. **Indexing Strategy**: Indexes on frequently queried columns
4. **Audit Trail**: Created_at timestamps for temporal queries

### Key Design Decisions

#### 1. Separate Balance Table

- **Rationale**: Real-time balance calculation from outputs would be expensive
- **Trade-off**: Storage space vs. query performance
- **Implementation**: Trigger-based balance updates ensure consistency

#### 2. is_spent Flag

- **Rationale**: Enables efficient UTXO tracking without complex joins
- **Alternative**: Could use LEFT JOIN to check if output is referenced as input
- **Benefit**: O(1) lookup for spend status vs. O(log n) join operation

#### 3. Composite Indexes

```sql
-- Optimized for balance queries
CREATE INDEX idx_outputs_address_unspent ON outputs (address, is_spent) WHERE is_spent = false;

-- Optimized for input validation
CREATE INDEX idx_outputs_tx_index ON outputs (transaction_id, output_index);
```

## Security Architecture

### 1. Input Validation

```typescript
// Multi-layer validation with Fastify
await app.register(import('@fastify/helmet'), { global: true });
await app.register(import('@fastify/cors'), { origin: true });
await app.register(import('@fastify/rate-limit'), {
  max: 100,
  timeWindow: '15 minutes'
});

// Schema validation via Fastify plugin
await app.register(import('./plugins/validation.plugin'));

// Route-level schema validation
fastify.post(
  '/blocks',
  {
    schema: { body: BlockSchema }
  },
  handler
);
```

### 2. SQL Injection Prevention

```typescript
// Parameterized queries only
await this.pool.query('SELECT * FROM outputs WHERE address = $1 AND is_spent = $2', [
  address,
  false
]);
```

### 3. Error Information Disclosure

```typescript
// Generic error responses to external clients
if (process.env.NODE_ENV === 'production') {
  return res.status(500).json({ error: 'Internal Server Error' });
} else {
  return res.status(500).json({ error: error.message, stack: error.stack });
}
```

## Error Handling Architecture

### Error Hierarchy

```typescript
// Base error classes
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
  }
}

class ValidationError extends ApiError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

class BusinessLogicError extends ApiError {
  constructor(message: string, code: string) {
    super(message, 400, code);
  }
}
```

### Centralized Error Handling

```typescript
// Fastify error handler
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

## Validation Architecture

### Schema-First Design

```typescript
// Zod schemas define both runtime validation and TypeScript types
export const BlockSchema = z.object({
  id: z.string().min(1),
  height: z.number().int().positive(),
  transactions: z.array(TransactionSchema)
});

export type Block = z.infer<typeof BlockSchema>;
```

### Validation Layers

1. **Schema Validation**: Type and format validation
2. **Business Rule Validation**: Domain-specific rules
3. **Database Constraint Validation**: Referential integrity
4. **Cross-Transaction Validation**: UTXO existence and spend validation

## Deployment Architecture

### Docker Container Strategy

```dockerfile
# Multi-stage build for optimization
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["bun", "src/index.ts"]
```

### Container Orchestration

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      - DATABASE_URL=postgres://...
    depends_on:
      - postgres

  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=mydatabase
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

### Environment Configuration

```typescript
// Configuration management
export const AppConfig = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://localhost/mydatabase',
  NODE_ENV: process.env.NODE_ENV || 'development',
  MAX_ROLLBACK_BLOCKS: Number(process.env.MAX_ROLLBACK_BLOCKS) || 2000
};
```

## Architecture Benefits

### 1. Maintainability

- Clear separation of concerns
- Modular design enables independent changes
- Comprehensive test coverage possible at each layer

### 2. Scalability

- Stateless application design
- Database connection pooling
- Horizontal scaling capabilities

### 3. Reliability

- ACID transaction guarantees
- Comprehensive error handling
- Input validation at multiple layers

### 4. Security

- Defense in depth approach
- Input sanitization and validation
- Secure defaults and best practices

### 5. Testability

- Dependency injection enables easy mocking
- Pure functions for validation logic
- Each layer can be tested independently

This architecture provides a solid foundation for the blockchain indexer while maintaining flexibility for future enhancements and requirements.
