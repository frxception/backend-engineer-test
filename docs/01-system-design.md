# System Design - EMURGO Backend Engineer Challenge

## Overview

This document describes the system design for the EMURGO Backend Engineer Challenge, which implements a blockchain indexer that tracks address balances using the UTXO (Unspent Transaction Output) model.

## Problem Statement

The challenge requires building an indexer that:

- Processes blocks containing transactions with inputs and outputs
- Tracks the current balance for each address
- Validates block integrity and transaction consistency
- Supports rollback operations to previous blockchain states
- Maintains data integrity across all operations

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Client Layer                              │
├─────────────────────────────────────────────────────────────────────┤
│  HTTP Requests (POST /blocks, GET /balance/:address, POST /rollback) │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API Gateway Layer                           │
├─────────────────────────────────────────────────────────────────────┤
│  • Fastify Application Server                                   │
│  • Rate Limiting & Security Middleware                             │
│  • Request Validation & Error Handling                             │
│  • CORS & Security Headers                                         │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Business Logic Layer                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌──────────────────┐   ┌─────────────────┐ │
│  │ BlockchainController │   │ BlockchainService │   │ Validation Utils │ │
│  │ • HTTP Handlers  │    │ • Block Processing│   │ • Block Validation│ │
│  │ • Error Mapping  │    │ • Balance Queries │   │ • Hash Verification│ │
│  │ • Response Format│    │ • Rollback Logic  │   │ • Input/Output Sum│ │
│  └─────────────────┘    └──────────────────┘   └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Data Access Layer                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Block Model │  │Transaction  │  │Output Model │  │Balance Model│ │
│  │ • CRUD Ops  │  │ Model       │  │ • Address   │  │ • Real-time │ │
│  │ • Height    │  │ • Input     │  │   Tracking  │  │   Balance   │ │
│  │   Tracking  │  │   Validation│  │ • Spend     │  │   Queries   │ │
│  │ • Rollback  │  │ • References│  │   Status    │  │ • Indexing  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Storage Layer                               │
├─────────────────────────────────────────────────────────────────────┤
│                         PostgreSQL Database                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   blocks    │  │transactions │  │   outputs   │  │address_     │ │
│  │   table     │  │   table     │  │   table     │  │ balances    │ │
│  │             │  │             │  │             │  │  table      │ │
│  │ • id        │  │ • id        │  │ • id        │  │ • address   │ │
│  │ • height    │  │ • block_id  │  │ • tx_id     │  │ • balance   │ │
│  │ • created_at│  │ • tx_id     │  │ • index     │  │ • updated_at│ │
│  │             │  │ • created_at│  │ • address   │  │             │ │
│  │             │  │             │  │ • value     │  │             │ │
│  │             │  │             │  │ • is_spent  │  │             │ │
│  │             │  │             │  │ • created_at│  │             │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. API Gateway Layer

- **Fastify Server**: Handles HTTP requests and responses
- **Security Middleware**: Rate limiting, CORS, security headers (Helmet)
- **Validation Middleware**: Zod schema validation for incoming requests
- **Error Handling**: Centralized error processing and response formatting

### 2. Business Logic Layer

- **BlockchainController**: HTTP request handlers and response formatting
- **BlockchainService**: Core business logic for block processing and balance management
- **Validation Utils**: Block validation, hash verification, and integrity checks

### 3. Data Access Layer

- **Model Layer**: Database abstraction with specialized models for each entity
- **Transaction Management**: Ensures ACID properties for complex operations
- **Index Management**: Optimized queries for balance lookups and block retrieval

### 4. Storage Layer

- **PostgreSQL Database**: ACID-compliant storage for blockchain data
- **Optimized Schema**: Indexed tables for efficient queries and integrity constraints
- **Connection Pooling**: Managed database connections for performance

## Data Flow

### Block Processing Flow

```
1. HTTP POST /blocks
2. Request Validation (Zod Schema)
3. Current Height Retrieval
4. Input Existence Validation
5. Block Integrity Validation
   - Height sequence validation
   - Block ID hash verification
   - Input/Output sum validation
6. Database Transaction Begin
7. Block Insertion
8. Transaction Processing
9. Output Creation
10. Balance Updates
11. Transaction Commit
12. Success Response
```

### Balance Query Flow

```
1. HTTP GET /balance/:address
2. Address Parameter Extraction
3. Database Balance Query
4. Response Formatting
5. JSON Response
```

### Rollback Flow

```
1. HTTP POST /rollback?height=X
2. Target Height Validation
3. Rollback Distance Check
4. Database Transaction Begin
5. Delete Blocks > Target Height
6. Recalculate Balances
7. Transaction Commit
8. Success Response
```

## Design Principles

### 1. ACID Compliance

- All block processing operations are wrapped in database transactions
- Ensures data consistency across multiple table updates
- Automatic rollback on validation failures

### 2. Validation-First Approach

- Multiple layers of validation (schema, business logic, database constraints)
- Fail-fast strategy to prevent invalid data persistence
- Comprehensive error reporting with specific error codes

### 3. Separation of Concerns

- Clear boundaries between HTTP handling, business logic, and data access
- Single responsibility principle for each component
- Dependency injection for testability

### 4. Performance Optimization

- Database indexes on frequently queried columns
- Connection pooling for database access
- Efficient queries with minimal data transfer

### 5. Security by Design

- Rate limiting to prevent abuse
- Input validation and sanitization
- Secure headers and CORS configuration
- No sensitive data in logs or responses

## Scalability Considerations

### Database Optimization

- **Indexes**: Created on foreign keys and frequently queried columns
- **Connection Pooling**: Managed PostgreSQL connections
- **Query Optimization**: Efficient JOIN operations and selective queries

### Application Architecture

- **Stateless Design**: No server-side session storage
- **Horizontal Scaling**: Multiple application instances can run concurrently
- **Load Balancing**: Compatible with standard load balancing strategies

### Future Enhancements

- **Read Replicas**: For improved query performance
- **Caching Layer**: Redis for frequently accessed balance data
- **Event Sourcing**: For audit trails and complex rollback scenarios
- **Microservices**: Split into separate validation, processing, and query services

## Error Handling Strategy

### Error Categories

1. **Validation Errors** (400): Invalid input data or business rule violations
2. **Not Found Errors** (404): Requested resources don't exist
3. **Server Errors** (500): Internal application or database errors

### Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description",
    "details": "Additional technical details"
  }
}
```

### Logging Strategy

- **Structured Logging**: JSON format for easy parsing
- **Log Levels**: Error, Warning, Info, Debug
- **Security**: No sensitive data in logs
- **Performance**: Async logging to prevent blocking

## Monitoring and Observability

### Metrics to Track

- **Request Metrics**: Response times, error rates, throughput
- **Business Metrics**: Blocks processed, balance queries, rollback operations
- **System Metrics**: Database connection usage, memory consumption

### Health Checks

- **Database Connectivity**: Verify PostgreSQL connection
- **Application Health**: Service status endpoint
- **Dependency Health**: External service availability

This system design provides a robust foundation for the blockchain indexer while maintaining flexibility for future enhancements and scaling requirements.
