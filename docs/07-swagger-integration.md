# Swagger/OpenAPI Integration

## Overview

Comprehensive API documentation has been integrated into the Blockchain Indexer using **Swagger/OpenAPI 3.0**. This provides interactive documentation for all endpoints with request/response schemas, examples, and edge cases.

## Access Points

### Swagger UI

- **URL**: `http://localhost:3000/docs`
- Interactive web interface for exploring and testing the API
- Features:
  - Try-it-out functionality for testing endpoints directly
  - Request/response examples
  - Schema definitions
  - Syntax highlighting (Monokai theme)
  - Deep linking support
  - Request duration display

### OpenAPI JSON Specification

- **URL**: `http://localhost:3000/docs/json`
- Raw OpenAPI 3.0 specification in JSON format
- Can be imported into tools like Postman, Insomnia, or API clients

## Implementation Details

### Dependencies

```json
{
  "@fastify/swagger": "^9.5.2",
  "@fastify/swagger-ui": "^5.2.3"
}
```

### Configuration Files

**`src/config/swagger.config.ts`**

- OpenAPI metadata (title, description, version)
- Server definitions (development, test)
- Tag definitions (blockchain, health)
- Component schemas (models)
- Example payloads (21 examples covering various scenarios)

### Integration Points

**`src/app.ts`**

- Swagger plugins registered before routes
- Disabled in test environment to avoid conflicts
- Order: Database → Swagger → Routes

**Route Files**

- `src/routes/health.route.ts`
- `src/routes/blockchain.route.ts`

Each route includes:

- Description
- Tag assignment
- Validation handled by preHandler hooks (not Fastify's built-in validation to avoid conflicts)

## API Documentation Structure

### Component Schemas

1. **TransactionInput** - Input reference for spending UTXOs
2. **TransactionOutput** - Output creating new UTXOs
3. **Transaction** - Complete transaction with inputs and outputs
4. **Block** - Block containing transactions
5. **BalanceResponse** - Address balance query result
6. **RollbackResponse** - Rollback operation result
7. **HealthResponse** - Health check result
8. **ErrorResponse** - Standard error format

### Example Payloads (21 Total)

#### POST /blocks Examples

1. **GenesisBlockRequest** - First block (height 1)
2. **GenesisBlockResponse** - Success response
3. **RegularBlockRequest** - Block with UTXO spending
4. **InvalidHeightRequest** - Skipping block heights
5. **InvalidHeightResponse** - Height validation error
6. **InvalidHashRequest** - Wrong block hash
7. **InvalidHashResponse** - Hash validation error
8. **DoubleSpendRequest** - Spending already spent UTXO
9. **DoubleSpendResponse** - Double spend error
10. **InvalidInputRequest** - Non-existent UTXO reference
11. **InvalidInputResponse** - UTXO not found error
12. **UnbalancedTransactionRequest** - Input/output value mismatch
13. **UnbalancedTransactionResponse** - Balance error

#### GET /balance/:address Examples

14. **BalanceFoundResponse** - Address with balance
15. **BalanceNotFoundResponse** - Address with zero balance

#### POST /rollback Examples

16. **RollbackSuccessResponse** - Successful rollback
17. **RollbackInvalidHeightResponse** - Invalid height parameter
18. **RollbackMaxDepthResponse** - Exceeds rollback depth limit
19. **RollbackFutureHeightResponse** - Rollback to future height

#### GET /health Examples

20. **HealthyResponse** - System healthy
21. **UnhealthyResponse** - Database disconnected

## Edge Cases Covered

### Validation Errors

- Invalid block height (non-sequential)
- Invalid block hash
- Malformed request body
- Missing required fields
- Invalid data types

### Business Logic Errors

- Double spending attempts
- Non-existent UTXO references
- Unbalanced transactions
- Rollback depth exceeded
- Rollback to future height

### System Errors

- Database connection failures
- Health check degradation

## UI Configuration

The Swagger UI is configured with:

- **Doc Expansion**: List (shows all operations)
- **Deep Linking**: Enabled (shareable URLs)
- **Request Duration Display**: Enabled
- **Filter**: Enabled (search functionality)
- **Syntax Highlighting**: Monokai theme
- **CSP**: Static CSP enabled for security

## Usage Examples

### Testing an Endpoint via Swagger UI

1. Navigate to `http://localhost:3000/docs`
2. Click on the endpoint (e.g., `POST /api/blocks`)
3. Click "Try it out"
4. Use one of the example payloads or create your own
5. Click "Execute"
6. View the response below

### Importing into Postman

1. Open Postman
2. Click "Import"
3. Paste URL: `http://localhost:3000/docs/json`
4. Click "Import"
5. All endpoints will be available in a new collection

## Testing

All existing tests pass (34/34) with Swagger integration:

- Unit tests (13 tests)
- Database integration tests (13 tests)
- API integration tests (8 tests)

Swagger is disabled during testing to avoid schema conflicts with existing validation logic.

## Benefits

1. **Developer Experience**: Interactive documentation makes it easy to understand and test the API
2. **Onboarding**: New developers can quickly learn the API without reading code
3. **Client Generation**: OpenAPI spec can generate client SDKs for various languages
4. **API Design**: Enforces consistent request/response structures
5. **Edge Case Documentation**: All failure scenarios are documented with examples
6. **Integration Testing**: Try-it-out feature allows manual testing without cURL or Postman

## Maintenance

When adding new endpoints or modifying existing ones:

1. Add schemas to `src/config/swagger.config.ts` under `components.schemas`
2. Add examples to `components.examples`
3. Add route metadata in the route file:
   ```typescript
   fastify.post('/new-endpoint', {
     schema: {
       description: 'Endpoint description',
       tags: ['tag-name']
     }
     // ... handler config
   });
   ```

The OpenAPI spec is automatically generated from these definitions.
