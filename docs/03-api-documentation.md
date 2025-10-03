# API Documentation - EMURGO Backend Engineer Challenge

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Endpoints](#endpoints)
5. [Request/Response Examples](#requestresponse-examples)
6. [Schema Definitions](#schema-definitions)
7. [Status Codes](#status-codes)

## API Overview

The EMURGO Blockchain Indexer API provides endpoints for processing blockchain blocks, querying address balances, and managing blockchain state through rollback operations. The API follows RESTful principles and uses JSON for data exchange.

### Base URL

```
http://localhost:3000
```

### Content Type

All requests and responses use `application/json` content type.

### Rate Limiting

- **Window**: 15 minutes
- **Max Requests**: 100 per window per IP
- **Headers**: Rate limit information is returned in response headers

## Authentication

Currently, the API does not require authentication. All endpoints are publicly accessible.

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description"
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR`: Request validation failed
- `INVALID_HEIGHT`: Block height validation failed
- `INVALID_BLOCK_ID`: Block ID hash validation failed
- `INVALID_INPUTS`: Input validation failed
- `INVALID_BALANCE`: Input/output sum mismatch
- `ROLLBACK_TOO_FAR`: Rollback distance exceeds limit
- `INTERNAL_ERROR`: Server-side error

## Endpoints

### 1. Health Check

**GET /**

Returns the health status of the API and available endpoints.

#### Response

```json
{
  "message": "Blockchain Indexer API",
  "endpoints": [
    "POST /api/blocks - Process a new block",
    "GET /api/balance/:address - Get address balance",
    "POST /api/rollback - Rollback to specific height"
  ],
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### 2. Process Block

**POST /api/blocks**

Processes a new block and updates the blockchain state.

#### Request Body

```json
{
  "id": "string",
  "height": number,
  "transactions": [
    {
      "id": "string",
      "inputs": [
        {
          "txId": "string",
          "index": number
        }
      ],
      "outputs": [
        {
          "address": "string",
          "value": number
        }
      ]
    }
  ]
}
```

#### Validation Rules

1. **Height Validation**: Must be exactly `current_height + 1`
2. **Block ID Validation**: Must be SHA256 hash of `height + tx1.id + tx2.id + ... + txN.id`
3. **Input/Output Balance**: Sum of input values must equal sum of output values
4. **Input Existence**: All referenced inputs must exist and be unspent

#### Response (200 OK)

```json
{
  "message": "Block processed successfully",
  "blockId": "block_id_hash",
  "height": 123
}
```

#### Error Responses

- **400 Bad Request**: Validation errors
- **500 Internal Server Error**: Processing errors

---

### 3. Get Address Balance

**GET /api/balance/:address**

Retrieves the current balance for a specific address.

#### Parameters

- `address` (path): The address to query

#### Response (200 OK)

```json
{
  "address": "addr1",
  "balance": 1000
}
```

#### Error Responses

- **400 Bad Request**: Invalid address format
- **500 Internal Server Error**: Query errors

---

### 4. Rollback Blockchain

**POST /api/rollback?height={height}**

Rolls back the blockchain to a specific height.

#### Query Parameters

- `height` (number): Target height to rollback to

#### Validation Rules

1. **Height Constraint**: Cannot rollback to height greater than current height
2. **Distance Limit**: Cannot rollback more than 2000 blocks from current height
3. **Non-negative**: Height must be non-negative

#### Response (200 OK)

```json
{
  "message": "Rollback completed successfully",
  "targetHeight": 100,
  "previousHeight": 150
}
```

#### Error Responses

- **400 Bad Request**: Invalid height or rollback constraints violated
- **500 Internal Server Error**: Rollback processing errors

## Request/Response Examples

### Example 1: Processing First Block

```bash
curl -X POST http://localhost:3000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "d1582b9e2cac15e170c39ef2e85855ffd7e6a820550a8ca16a2f016d366503dc",
    "height": 1,
    "transactions": [{
      "id": "tx1",
      "inputs": [],
      "outputs": [{
        "address": "addr1",
        "value": 10
      }]
    }]
  }'
```

**Response:**

```json
{
  "message": "Block processed successfully",
  "blockId": "d1582b9e2cac15e170c39ef2e85855ffd7e6a820550a8ca16a2f016d366503dc",
  "height": 1
}
```

### Example 2: Processing Block with Inputs

```bash
curl -X POST http://localhost:3000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "0000456...",
    "height": 2,
    "transactions": [{
      "id": "tx2",
      "inputs": [{
        "txId": "tx1",
        "index": 0
      }],
      "outputs": [{
        "address": "addr2",
        "value": 4
      }, {
        "address": "addr3",
        "value": 6
      }]
    }]
  }'
```

### Example 3: Checking Balance

```bash
curl http://localhost:3000/api/balance/addr1
```

**Response:**

```json
{
  "address": "addr1",
  "balance": 0
}
```

### Example 4: Rollback Operation

```bash
curl -X POST "http://localhost:3000/api/rollback?height=1"
```

**Response:**

```json
{
  "message": "Rollback completed successfully",
  "targetHeight": 1,
  "previousHeight": 2
}
```

## Schema Definitions

### Block Schema

```typescript
{
  id: string;           // Block identifier (hash)
  height: number;       // Block height (positive integer)
  transactions: Transaction[];
}
```

### Transaction Schema

```typescript
{
  id: string;           // Transaction identifier
  inputs: Input[];      // Array of transaction inputs
  outputs: Output[];    // Array of transaction outputs
}
```

### Input Schema

```typescript
{
  txId: string; // Referenced transaction ID
  index: number; // Output index in referenced transaction
}
```

### Output Schema

```typescript
{
  address: string; // Recipient address
  value: number; // Amount (positive integer)
}
```

## Status Codes

### Success Codes

- **200 OK**: Request processed successfully
- **201 Created**: Resource created successfully

### Client Error Codes

- **400 Bad Request**: Invalid request data or business rule violation
- **404 Not Found**: Requested resource not found
- **422 Unprocessable Entity**: Request validation failed
- **429 Too Many Requests**: Rate limit exceeded

### Server Error Codes

- **500 Internal Server Error**: Unexpected server error
- **503 Service Unavailable**: Service temporarily unavailable

## UTXO Model Explanation

The API implements the UTXO (Unspent Transaction Output) model:

1. **Outputs**: When a transaction creates outputs, those represent value sent to addresses
2. **Inputs**: When a transaction has inputs, those reference previous outputs being spent
3. **Balance Calculation**: Address balance = Sum of unspent outputs for that address
4. **Spending**: When an output is referenced as an input, it becomes "spent" and can't be used again

### Example UTXO Flow

```
Block 1: Transaction tx1
├── Inputs: [] (coinbase transaction)
└── Outputs: [{ address: "addr1", value: 10 }]

Result: addr1 balance = 10

Block 2: Transaction tx2
├── Inputs: [{ txId: "tx1", index: 0 }] (spends the 10 from addr1)
└── Outputs: [
    { address: "addr2", value: 4 },
    { address: "addr3", value: 6 }
  ]

Result: addr1 balance = 0, addr2 balance = 4, addr3 balance = 6
```

## Security Considerations

### Input Validation

- All requests are validated against strict schemas
- SQL injection prevention through parameterized queries
- Rate limiting to prevent abuse

### Error Information Disclosure

- Production environment returns generic error messages
- Detailed error information only in development mode
- No sensitive data in error responses

### CORS Configuration

- Configurable CORS settings for cross-origin requests
- Security headers applied via Helmet middleware

## Performance Considerations

### Database Optimization

- Indexed columns for fast lookups
- Connection pooling for efficient database access
- Optimized queries for balance calculations

### Caching Strategy

- Balance calculations are pre-computed and stored
- Efficient rollback through batch operations
- Minimal data transfer in responses

## Testing the API

### Using curl

```bash
# Health check
curl http://localhost:3000/

# Process a block
curl -X POST http://localhost:3000/api/blocks \
  -H "Content-Type: application/json" \
  -d @block.json

# Check balance
curl http://localhost:3000/api/balance/addr1



# Rollback
curl -X POST "http://localhost:3000/api/rollback?height=1"
```

### Using the test suite

```bash
# Run all API tests
npm run test:api

# Run full test suite
npm test
```

This API documentation provides comprehensive information for integrating with the EMURGO Blockchain Indexer API. For additional technical details, refer to the architecture and implementation documentation.
