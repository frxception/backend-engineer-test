# API Endpoints Flowcharts

Complete end-to-end flowcharts for all API endpoints with example requests, responses, and error cases.

## Table of Contents

1. [POST /api/blocks](#post-apiblocks---process-block)
2. [GET /api/balance/:address](#get-apibalanceaddress---get-balance)
3. [POST /api/rollback](#post-apirollback---rollback-blockchain)
4. [GET /health](#get-health---health-check)

---

## POST /api/blocks - Process Block

### Endpoint Overview

**Purpose**: Submit and process a new block with transactions
**Method**: `POST`
**URL**: `/api/blocks`
**Authentication**: None (public endpoint)

### Complete Flow Diagram

```mermaid
flowchart TD
    Start([Client Sends POST /api/blocks]) --> Receive[Fastify Receives Request]
    Receive --> Schema{Zod Schema<br/>Validation}

    Schema -->|Invalid| Error1[Return 400 Bad Request]
    Schema -->|Valid| Controller[BlockchainController.processBlock]

    Controller --> Service[BlockchainService.processBlock]

    Service --> GetHeight[Get Current Height from DB]
    GetHeight --> ValidateHeight{Height Valid?<br/>current + 1 = new}

    ValidateHeight -->|No| Error2[Return 400:<br/>Invalid block height]
    ValidateHeight -->|Yes| ValidateHash{Block Hash Valid?<br/>sha256 hash match}

    ValidateHash -->|No| Error3[Return 400:<br/>Invalid block hash]
    ValidateHash -->|Yes| ValidateTxs[Loop: Validate Each Transaction]

    ValidateTxs --> CheckInputs{All Inputs<br/>Exist & Unspent?}
    CheckInputs -->|No| Error4[Return 400:<br/>Invalid UTXO reference]
    CheckInputs -->|Yes| CheckBalance{Input Sum<br/>= Output Sum?}

    CheckBalance -->|No| Error5[Return 400:<br/>Input/output mismatch]
    CheckBalance -->|Yes| BeginTx[BEGIN Database Transaction]

    BeginTx --> InsertBlock[INSERT INTO blocks]
    InsertBlock --> LoopTx[Loop: Process Each Transaction]

    LoopTx --> InsertTx[INSERT INTO transactions]
    InsertTx --> LoopInputs[Loop: Process Inputs]
    LoopInputs --> MarkSpent[UPDATE outputs<br/>SET is_spent=true]
    MarkSpent --> DecBalance[UPDATE address_balances<br/>Decrease balance]

    DecBalance --> LoopOutputs[Loop: Process Outputs]
    LoopOutputs --> InsertOut[INSERT INTO outputs]
    InsertOut --> IncBalance[UPDATE address_balances<br/>Increase balance]

    IncBalance --> CheckMore{More<br/>Transactions?}
    CheckMore -->|Yes| LoopTx
    CheckMore -->|No| Commit[COMMIT Transaction]

    Commit --> Success[Return 201 Created]

    Error1 --> End([End])
    Error2 --> End
    Error3 --> End
    Error4 --> End
    Error5 --> End
    Success --> End

    style Start fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style Success fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style Error1 fill:#FFB6C1,stroke:#333,stroke-width:2px,color:black
    style Error2 fill:#FFB6C1,stroke:#333,stroke-width:2px,color:black
    style Error3 fill:#FFB6C1,stroke:#333,stroke-width:2px,color:black
    style Error4 fill:#FFB6C1,stroke:#333,stroke-width:2px,color:black
    style Error5 fill:#FFB6C1,stroke:#333,stroke-width:2px,color:black
    style Commit fill:#87CEEB,stroke:#333,stroke-width:2px,color:black
```

### Request Example

```bash
curl -X POST http://localhost:3000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "5f4dcc3b5aa765d61d8327deb882cf99",
    "height": 2,
    "transactions": [
      {
        "id": "tx3",
        "inputs": [
          { "txId": "tx1", "index": 0 }
        ],
        "outputs": [
          { "address": "addr6", "value": 600 },
          { "address": "addr1", "value": 400 }
        ]
      }
    ]
  }'
```

### Success Response (201 Created)

```json
{
  "message": "Block processed successfully",
  "height": 2,
  "blockId": "5f4dcc3b5aa765d61d8327deb882cf99"
}
```

### Error Responses

#### 400 - Schema Validation Failed

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request body",
  "details": [
    {
      "path": ["transactions", 0, "outputs", 0, "value"],
      "message": "Expected number, received string"
    }
  ]
}
```

#### 400 - Invalid Height

```json
{
  "error": "INVALID_BLOCK_HEIGHT",
  "message": "Block height must be 2, but received 3",
  "currentHeight": 1
}
```

#### 400 - Invalid Hash

```json
{
  "error": "INVALID_BLOCK_HASH",
  "message": "Block hash does not match computed hash"
}
```

#### 400 - Invalid UTXO

```json
{
  "error": "INVALID_UTXO",
  "message": "Referenced output tx1[0] does not exist or is already spent"
}
```

#### 400 - Balance Mismatch

```json
{
  "error": "INVALID_TRANSACTION",
  "message": "Transaction tx3: input sum (1000) does not equal output sum (900)"
}
```

### Database Changes

**Before:**

```sql
-- Current height: 1
-- addr1 balance: 1000
```

**After Success:**

```sql
-- blocks table
INSERT INTO blocks (id, height) VALUES ('5f4dcc3b...', 2);

-- transactions table
INSERT INTO transactions (id, block_id, block_height)
VALUES ('tx3', '5f4dcc3b...', 2);

-- outputs table (mark spent)
UPDATE outputs SET is_spent=true, spent_in_transaction_id='tx3'
WHERE transaction_id='tx1' AND output_index=0;

-- outputs table (create new)
INSERT INTO outputs (transaction_id, output_index, address, value, block_height)
VALUES ('tx3', 0, 'addr6', 600, 2),
       ('tx3', 1, 'addr1', 400, 2);

-- address_balances table
UPDATE address_balances SET balance=0 WHERE address='addr1';    -- spent 1000
UPDATE address_balances SET balance=1000 WHERE address='addr6'; -- new 600
UPDATE address_balances SET balance=400 WHERE address='addr1';  -- change 400
```

---

## GET /api/balance/:address - Get Balance

### Endpoint Overview

**Purpose**: Retrieve current balance for an address
**Method**: `GET`
**URL**: `/api/balance/:address`
**Authentication**: None

### Complete Flow Diagram

```mermaid
flowchart TD
    Start([Client Sends GET /api/balance/addr1]) --> Receive[Fastify Receives Request]
    Receive --> Validate{Validate<br/>address param}

    Validate -->|Invalid| Error1[Return 400:<br/>Invalid address format]
    Validate -->|Valid| Controller[BlockchainController.getBalance]

    Controller --> Service[BlockchainService.getAddressBalance]
    Service --> Query[SELECT balance<br/>FROM address_balances<br/>WHERE address = ?]

    Query --> Exists{Address<br/>Exists?}
    Exists -->|No| Return0[Return balance: 0]
    Exists -->|Yes| ReturnBalance[Return balance from DB]

    Return0 --> Success[Return 200 OK]
    ReturnBalance --> Success

    Error1 --> End([End])
    Success --> End

    style Start fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style Success fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style Error1 fill:#FFB6C1,stroke:#333,stroke-width:2px,color:black
    style Query fill:#87CEEB,stroke:#333,stroke-width:2px,color:black
```

### Request Example

```bash
curl -X GET http://localhost:3000/api/balance/addr1
```

### Success Response (200 OK)

```json
{
  "address": "addr1",
  "balance": 400
}
```

### Response for Non-Existent Address

```json
{
  "address": "addr999",
  "balance": 0
}
```

### Error Response (400 - Invalid Address)

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Address parameter is required and must be a string"
}
```

### Database Query

```sql
SELECT balance
FROM address_balances
WHERE address = 'addr1';

-- Result: { balance: 400 }
```

### Performance Notes

- **Query Complexity**: O(1) - Primary key lookup
- **Index Used**: `address_balances.address` (PRIMARY KEY)
- **Average Response Time**: < 5ms

---

## POST /api/rollback - Rollback Blockchain

### Endpoint Overview

**Purpose**: Rollback blockchain to a specific height
**Method**: `POST`
**URL**: `/api/rollback?height=N`
**Authentication**: None
**Limit**: Maximum 2000 blocks rollback

### Complete Flow Diagram

```mermaid
flowchart TD
    Start([Client Sends POST /api/rollback?height=3]) --> Receive[Fastify Receives Request]
    Receive --> ValidateQuery{Validate<br/>height query param}

    ValidateQuery -->|Invalid| Error1[Return 400:<br/>Invalid height parameter]
    ValidateQuery -->|Valid| Controller[BlockchainController.rollback]

    Controller --> Service[BlockchainService.rollbackToHeight]
    Service --> GetCurrent[Get current height from DB]
    GetCurrent --> CheckTarget{Target height<br/>< current height?}

    CheckTarget -->|No| Error2[Return 400:<br/>Target height must be<br/>less than current]
    CheckTarget -->|Yes| CheckDepth{Rollback depth<br/><= 2000 blocks?}

    CheckDepth -->|No| Error3[Return 400:<br/>Rollback depth exceeds<br/>maximum of 2000]
    CheckDepth -->|Yes| BeginTx[BEGIN Database Transaction]

    BeginTx --> GetBlocks[SELECT blocks<br/>WHERE height > target<br/>ORDER BY height DESC]
    GetBlocks --> LoopBlocks[Loop: Each Block to Rollback]

    LoopBlocks --> GetTxs[Get all transactions<br/>in this block]
    GetTxs --> ReverseOutputs[Reverse outputs:<br/>Decrease balances]
    ReverseOutputs --> ReverseInputs[Reverse inputs:<br/>Mark unspent,<br/>Increase balances]

    ReverseInputs --> MoreBlocks{More<br/>blocks?}
    MoreBlocks -->|Yes| LoopBlocks
    MoreBlocks -->|No| DeleteBlocks[DELETE FROM blocks<br/>WHERE height > target]

    DeleteBlocks --> Commit[COMMIT Transaction]
    Commit --> Success[Return 200 OK]

    Error1 --> End([End])
    Error2 --> End
    Error3 --> End
    Success --> End

    style Start fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style Success fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style Error1 fill:#FFB6C1,stroke:#333,stroke-width:2px,color:black
    style Error2 fill:#FFB6C1,stroke:#333,stroke-width:2px,color:black
    style Error3 fill:#FFB6C1,stroke:#333,stroke-width:2px,color:black
    style Commit fill:#87CEEB,stroke:#333,stroke-width:2px,color:black
```

### Request Example

```bash
curl -X POST "http://localhost:3000/api/rollback?height=3"
```

### Success Response (200 OK)

```json
{
  "message": "Blockchain rolled back successfully",
  "newHeight": 3,
  "blocksRemoved": 3
}
```

### Error Responses

#### 400 - Invalid Height Parameter

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Height must be a valid integer"
}
```

#### 400 - Target Height Too High

```json
{
  "error": "INVALID_ROLLBACK_HEIGHT",
  "message": "Target height (7) must be less than current height (6)"
}
```

#### 400 - Rollback Depth Exceeded

```json
{
  "error": "ROLLBACK_DEPTH_EXCEEDED",
  "message": "Cannot rollback more than 2000 blocks. Requested: 2500"
}
```

### Rollback Process Example

**Scenario**: Rollback from height 6 to height 3

#### Before Rollback

```
Blocks: 1, 2, 3, 4, 5, 6
Current height: 6
```

#### After Rollback

```
Blocks: 1, 2, 3
Current height: 3
```

### Database Changes

```sql
-- For each block (6, 5, 4 in reverse order):

-- 1. Get all transactions in block
SELECT id FROM transactions WHERE block_id = ?;

-- 2. Reverse outputs (created by this block)
SELECT address, value FROM outputs WHERE transaction_id IN (?);
UPDATE address_balances
SET balance = balance - value, last_updated_height = 3
WHERE address = ?;

-- 3. Reverse inputs (spent by this block)
SELECT address, value FROM outputs WHERE spent_in_transaction_id IN (?);
UPDATE outputs
SET is_spent = false, spent_in_transaction_id = NULL
WHERE spent_in_transaction_id IN (?);

UPDATE address_balances
SET balance = balance + value, last_updated_height = 3
WHERE address = ?;

-- 4. Delete all blocks > target height
DELETE FROM blocks WHERE height > 3;
-- CASCADE automatically deletes transactions and outputs
```

### Balance Changes Example

**Before Rollback (Height 6):**

```
addr30: 426
addr31: 284
addr32: 81
```

**After Rollback to Height 3:**

```
addr30: 0    (outputs deleted)
addr31: 0    (outputs deleted)
addr32: 0    (outputs deleted)

-- Previously spent outputs become unspent again
addr13: 440  (was 0, now restored)
addr14: 270  (was 0, now restored)
addr15: 270  (was 0, now restored)
```

---

## GET /health - Health Check

### Endpoint Overview

**Purpose**: Check if service is running and database is connected
**Method**: `GET`
**URL**: `/health`
**Authentication**: None

### Complete Flow Diagram

```mermaid
flowchart TD
    Start([Client Sends GET /health]) --> Receive[Fastify Receives Request]
    Receive --> Controller[HealthController.check]

    Controller --> DBCheck{Test Database<br/>Connection}
    DBCheck -->|Success| Healthy[Return 200 OK<br/>status: healthy]
    DBCheck -->|Fail| Unhealthy[Return 503<br/>status: unhealthy]

    Healthy --> End([End])
    Unhealthy --> End

    style Start fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style Healthy fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style Unhealthy fill:#FFB6C1,stroke:#333,stroke-width:2px,color:black
```

### Request Example

```bash
curl -X GET http://localhost:3000/health
```

### Success Response (200 OK)

```json
{
  "status": "healthy",
  "timestamp": "2025-10-03T10:30:00.000Z",
  "database": "connected"
}
```

### Error Response (503 Service Unavailable)

```json
{
  "status": "unhealthy",
  "timestamp": "2025-10-03T10:30:00.000Z",
  "database": "disconnected",
  "error": "Connection to database failed"
}
```

---

## API Call Sequence Example

### Scenario: Complete Blockchain Build

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB

    Note over Client,DB: Initial State: Empty blockchain

    Client->>API: GET /health
    API->>DB: Test connection
    DB-->>API: Connected
    API-->>Client: 200 OK (healthy)

    Client->>API: POST /api/blocks (Block 1)
    API->>DB: getCurrentHeight() → 0
    API->>DB: Process genesis block
    DB-->>API: Success
    API-->>Client: 201 Created

    Client->>API: GET /api/balance/addr1
    API->>DB: SELECT balance
    DB-->>API: 1000
    API-->>Client: 200 OK {balance: 1000}

    Client->>API: POST /api/blocks (Block 2)
    API->>DB: getCurrentHeight() → 1
    API->>DB: Validate & process
    DB-->>API: Success
    API-->>Client: 201 Created

    Client->>API: GET /api/balance/addr1
    API->>DB: SELECT balance
    DB-->>API: 400
    API-->>Client: 200 OK {balance: 400}

    Note over Client,DB: Block 2 spent addr1's 1000, returned 400 as change

    Client->>API: POST /api/rollback?height=1
    API->>DB: Rollback Block 2
    DB-->>API: Success
    API-->>Client: 200 OK

    Client->>API: GET /api/balance/addr1
    API->>DB: SELECT balance
    DB-->>API: 1000
    API-->>Client: 200 OK {balance: 1000}

    Note over Client,DB: After rollback, addr1 balance restored to 1000
```

---

## Error Handling Flow

### Global Error Handler

```mermaid
flowchart TD
    Start[Request Received] --> Process[Process Request]
    Process --> Error{Error<br/>Thrown?}

    Error -->|No| Success[Return Success Response]
    Error -->|Yes| CheckType{Error<br/>Type?}

    CheckType -->|Validation| Return400[400 Bad Request]
    CheckType -->|Not Found| Return404[404 Not Found]
    CheckType -->|Business Logic| Return400
    CheckType -->|Database| Return500[500 Internal Server Error]
    CheckType -->|Unknown| Return500

    Return400 --> Log[Log Error]
    Return404 --> Log
    Return500 --> Log

    Log --> End([End])
    Success --> End

    style Success fill:#90EE90,stroke:#333,stroke-width:2px,color:black
    style Return400 fill:#FFB6C1,stroke:#333,stroke-width:2px,color:black
    style Return404 fill:#FFB6C1,stroke:#333,stroke-width:2px,color:black
    style Return500 fill:#FF6B6B,stroke:#333,stroke-width:2px,color:black
```

### Common Error Codes

| Status Code | Error Type          | Example                                        |
| ----------- | ------------------- | ---------------------------------------------- |
| 400         | Bad Request         | Invalid schema, invalid height, UTXO not found |
| 404         | Not Found           | Endpoint does not exist                        |
| 500         | Internal Error      | Database connection failed, unexpected error   |
| 503         | Service Unavailable | Health check failed                            |

---

## Rate Limiting

All endpoints are rate-limited (configurable via environment variables):

```
Default: 100 requests per 15 minutes per IP
```

### Rate Limit Exceeded Response (429)

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests from this IP, please try again later",
  "expiresIn": 300
}
```
