# Test Cases with Example Data

Comprehensive test case diagrams covering all scenarios with real example data.

## Table of Contents

1. [Happy Path Test Suite](#happy-path-test-suite)
2. [Error Handling Test Suite](#error-handling-test-suite)
3. [Edge Cases Test Suite](#edge-cases-test-suite)
4. [Performance Test Suite](#performance-test-suite)
5. [Rollback Test Suite](#rollback-test-suite)

---

## Happy Path Test Suite

### Test Case 1: Genesis Block Creation

```mermaid
graph TD
    Start[Test Start] --> Setup[Setup: Empty Database]
    Setup --> Request[POST /api/blocks<br/>Genesis Block]

    Request --> Data{Request Data}
    Data -->|height: 1| D1[Height validation]
    Data -->|transactions: 2| D2[No inputs coinbase]
    Data -->|outputs: 5 total| D3[Create initial UTXOs]

    D1 --> Process[Process Block]
    D2 --> Process
    D3 --> Process

    Process --> Assert1{Assert: Block<br/>height = 1?}
    Assert1 -->|Yes| Assert2{Assert: 5 outputs<br/>created?}
    Assert2 -->|Yes| Assert3{Assert: Balances<br/>correct?}
    Assert3 -->|Yes| Pass[✅ TEST PASS]

    Assert1 -->|No| Fail[❌ TEST FAIL]
    Assert2 -->|No| Fail
    Assert3 -->|No| Fail

    style Pass fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style Fail fill:#FFB6C1,stroke:#333,stroke-width:3px,color:black
```

**Test Data:**

```json
{
  "id": "f9c5c8e1e9c9e3f5c5f9c5c8e1e9c9e3f5c5f9c5c8e1e9c9e3f5c5f9c5c8e1e9",
  "height": 1,
  "transactions": [
    {
      "id": "tx1",
      "inputs": [],
      "outputs": [
        { "address": "addr1", "value": 1000 },
        { "address": "addr2", "value": 500 },
        { "address": "addr3", "value": 250 }
      ]
    },
    {
      "id": "tx2",
      "inputs": [],
      "outputs": [
        { "address": "addr4", "value": 800 },
        { "address": "addr5", "value": 300 }
      ]
    }
  ]
}
```

**Expected Database State:**

```sql
-- blocks
SELECT * FROM blocks WHERE height = 1;
-- Result: 1 row

-- outputs
SELECT COUNT(*) FROM outputs WHERE block_height = 1;
-- Result: 5

-- address_balances
SELECT address, balance FROM address_balances ORDER BY address;
-- Results:
-- addr1: 1000
-- addr2: 500
-- addr3: 250
-- addr4: 800
-- addr5: 300
```

**Assertions:**

- ✅ Block inserted with height 1
- ✅ 2 transactions created
- ✅ 5 outputs created, all `is_spent = false`
- ✅ 5 address balances match expected values
- ✅ Response status: 201 Created

---

### Test Case 2: Regular Transaction with Inputs

```mermaid
sequenceDiagram
    participant Test
    participant API
    participant DB

    Note over Test,DB: Prerequisites: Genesis block exists (height 1)

    Test->>API: POST /api/blocks (Block 2)
    Note right of Test: Spend tx1[0] + tx1[1]<br/>Create 2 new outputs

    API->>DB: Validate tx1[0] exists & unspent
    DB-->>API: ✅ Valid (value: 1000)

    API->>DB: Validate tx1[1] exists & unspent
    DB-->>API: ✅ Valid (value: 500)

    API->>DB: Check input sum = output sum
    Note right of API: 1000 + 500 = 900 + 600 ✅

    API->>DB: BEGIN TRANSACTION
    API->>DB: Mark tx1[0] spent
    API->>DB: Mark tx1[1] spent
    API->>DB: Create output tx3[0]: addr6 = 900
    API->>DB: Create output tx3[1]: addr7 = 600
    API->>DB: Update balances
    API->>DB: COMMIT

    DB-->>API: Success
    API-->>Test: 201 Created

    Test->>API: GET /api/balance/addr1
    API-->>Test: {balance: 0}

    Test->>API: GET /api/balance/addr6
    API-->>Test: {balance: 900}

    Note over Test,DB: ✅ Test Pass: Balances updated correctly
```

**Test Data:**

```json
{
  "id": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  "height": 2,
  "transactions": [
    {
      "id": "tx3",
      "inputs": [
        { "txId": "tx1", "index": 0 },
        { "txId": "tx1", "index": 1 }
      ],
      "outputs": [
        { "address": "addr6", "value": 900 },
        { "address": "addr7", "value": 600 }
      ]
    }
  ]
}
```

**Before/After State:**

```
BEFORE:
  addr1: 1000 (tx1[0])
  addr2: 500  (tx1[1])
  addr6: 0
  addr7: 0

AFTER:
  addr1: 0    (spent)
  addr2: 0    (spent)
  addr6: 900  (new)
  addr7: 600  (new)

  tx1[0]: is_spent = true, spent_in_transaction_id = 'tx3'
  tx1[1]: is_spent = true, spent_in_transaction_id = 'tx3'
```

**Assertions:**

- ✅ Previous outputs marked as spent
- ✅ New outputs created with correct values
- ✅ Balances updated correctly
- ✅ Total value conserved: 1500 in = 1500 out

---

### Test Case 3: Get Balance

```mermaid
graph LR
    A[Test: GET /api/balance/addr1] --> B{Address<br/>exists?}
    B -->|Yes| C[Query DB]
    B -->|No| D[Return 0]
    C --> E{Balance<br/>found?}
    E -->|Yes| F[Return balance]
    E -->|No| D
    F --> G[Assert: balance = expected]
    D --> H[Assert: balance = 0]
    G --> I[✅ Pass]
    H --> I

    style I fill:#90EE90,stroke:#333,stroke-width:2px,color:black
```

**Test Scenarios:**

| Address | Expected Balance | Test                                      |
| ------- | ---------------- | ----------------------------------------- |
| addr1   | 1000             | ✅ Existing address with balance          |
| addr999 | 0                | ✅ Non-existent address returns 0         |
| ""      | Error            | ✅ Empty address returns validation error |

**Test Code Example:**

```javascript
// Test 1: Existing address
const response1 = await app.inject({
  method: 'GET',
  url: '/api/balance/addr1'
});
assert.equal(response1.statusCode, 200);
assert.equal(response1.json().balance, 1000);

// Test 2: Non-existent address
const response2 = await app.inject({
  method: 'GET',
  url: '/api/balance/addr999'
});
assert.equal(response2.statusCode, 200);
assert.equal(response2.json().balance, 0);
```

---

## Error Handling Test Suite

### Test Case 4: Invalid Block Height

```mermaid
flowchart TD
    Start[Test Start] --> Current[Current Height: 5]
    Current --> Submit{Submit Block<br/>Height?}

    Submit -->|height: 4| E1[Error: Height too low]
    Submit -->|height: 5| E2[Error: Height already exists]
    Submit -->|height: 7| E3[Error: Height skipped 6]
    Submit -->|height: 6| Success[✅ Success]

    E1 --> Assert1[Assert: 400 Error]
    E2 --> Assert2[Assert: 400 Error]
    E3 --> Assert3[Assert: 400 Error]

    Assert1 --> Pass[✅ Test Pass]
    Assert2 --> Pass
    Assert3 --> Pass
    Success --> Fail[❌ Not testing error]

    style Pass fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style Fail fill:#FFB6C1,stroke:#333,stroke-width:3px,color:black
```

**Test Cases:**

```javascript
// Current height: 5

// Test 1: Height too low
await expect(
  processBlock({ height: 4, ... })
).rejects.toThrow('Block height must be 6');

// Test 2: Height already exists
await expect(
  processBlock({ height: 5, ... })
).rejects.toThrow('Block height must be 6');

// Test 3: Height skips ahead
await expect(
  processBlock({ height: 7, ... })
).rejects.toThrow('Block height must be 6');
```

**Expected Errors:**

```json
{
  "error": "INVALID_BLOCK_HEIGHT",
  "message": "Block height must be 6, but received 4",
  "currentHeight": 5
}
```

---

### Test Case 5: Invalid UTXO Reference

```mermaid
graph TD
    Start[Test: Use Invalid UTXO] --> Case{UTXO<br/>Status?}

    Case -->|Not Exists| E1[tx999 index 0<br/>does not exist]
    Case -->|Already Spent| E2[tx1 index 0<br/>is_spent = true]
    Case -->|Wrong Index| E3[tx1 index 99<br/>out of range]

    E1 --> Assert1[Assert: 400 Error<br/>UTXO not found]
    E2 --> Assert2[Assert: 400 Error<br/>UTXO already spent]
    E3 --> Assert3[Assert: 400 Error<br/>UTXO not found]

    Assert1 --> Pass[✅ Test Pass]
    Assert2 --> Pass
    Assert3 --> Pass

    style Pass fill:#90EE90,stroke:#333,stroke-width:3px
```

**Test Data Examples:**

```javascript
// Test 1: Non-existent transaction
{
  "inputs": [{ "txId": "tx999", "index": 0 }],
  "outputs": [{ "address": "addr1", "value": 100 }]
}
// Expected: 400 "UTXO tx999[0] not found"

// Test 2: Already spent UTXO
// (After tx1[0] was spent in previous block)
{
  "inputs": [{ "txId": "tx1", "index": 0 }],
  "outputs": [{ "address": "addr1", "value": 100 }]
}
// Expected: 400 "UTXO tx1[0] already spent"

// Test 3: Invalid index
{
  "inputs": [{ "txId": "tx1", "index": 99 }],
  "outputs": [{ "address": "addr1", "value": 100 }]
}
// Expected: 400 "UTXO tx1[99] not found"
```

---

### Test Case 6: Input/Output Mismatch

```mermaid
graph LR
    A[Test: Unbalanced Transaction] --> B[Input: 1000]
    B --> C{Output<br/>Sum?}

    C -->|800| D[❌ 1000 ≠ 800]
    C -->|1200| E[❌ 1000 ≠ 1200]
    C -->|1000| F[✅ 1000 = 1000]

    D --> G[Assert: 400 Error]
    E --> G
    F --> H[❌ Should fail<br/>this test]

    G --> I[✅ Test Pass]

    style I fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style H fill:#FFB6C1,stroke:#333,stroke-width:3px,color:black
```

**Test Cases:**

```javascript
// Input value: 1000

// Test 1: Outputs less than inputs
{
  "inputs": [{ "txId": "tx1", "index": 0 }],  // 1000
  "outputs": [
    { "address": "addr6", "value": 800 }       // 800 total
  ]
}
// Expected: 400 "Input sum (1000) ≠ Output sum (800)"

// Test 2: Outputs more than inputs
{
  "inputs": [{ "txId": "tx1", "index": 0 }],  // 1000
  "outputs": [
    { "address": "addr6", "value": 700 },
    { "address": "addr7", "value": 500 }       // 1200 total
  ]
}
// Expected: 400 "Input sum (1000) ≠ Output sum (1200)"

// Test 3: Exact match (should succeed)
{
  "inputs": [{ "txId": "tx1", "index": 0 }],  // 1000
  "outputs": [
    { "address": "addr6", "value": 600 },
    { "address": "addr7", "value": 400 }       // 1000 total ✅
  ]
}
```

---

### Test Case 7: Invalid Block Hash

```mermaid
flowchart TD
    Start[Test: Invalid Block Hash] --> Calc[Calculate Expected Hash]
    Calc --> Expected[sha256 height + tx IDs<br/>Expected: abc123...]

    Expected --> Submit{Submitted<br/>Hash?}
    Submit -->|abc123...| Valid[✅ Hash matches]
    Submit -->|wrong123...| Invalid[❌ Hash mismatch]

    Invalid --> Assert[Assert: 400 Error<br/>Invalid block hash]
    Assert --> Pass[✅ Test Pass]
    Valid --> Fail[❌ Should fail test]

    style Pass fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style Fail fill:#FFB6C1,stroke:#333,stroke-width:3px,color:black
```

**Test Example:**

```javascript
const block = {
  id: "wronghash123",  // ❌ Incorrect hash
  height: 2,
  transactions: [{ id: "tx3", ... }]
};

// Expected hash: sha256("2" + "tx3") = "5f4dcc3b5aa765d..."

await expect(processBlock(block))
  .rejects.toThrow('Invalid block hash');
```

---

## Edge Cases Test Suite

### Test Case 8: Coinbase Transaction (No Inputs)

```mermaid
graph TB
    Start[Test: Coinbase Transaction] --> Check{Transaction<br/>has inputs?}
    Check -->|Yes| Regular[Regular Transaction<br/>Validate UTXOs]
    Check -->|No| Coinbase[Coinbase Transaction<br/>Skip UTXO validation]

    Coinbase --> Create[Create outputs<br/>from thin air]
    Create --> Balance[Update balances]
    Balance --> Success[✅ Success]

    Regular --> ValidUTXO{UTXOs<br/>valid?}
    ValidUTXO -->|Yes| Success
    ValidUTXO -->|No| Fail[❌ Error]

    style Success fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style Fail fill:#FFB6C1,stroke:#333,stroke-width:3px,color:black
```

**Test Data:**

```json
{
  "id": "tx_coinbase",
  "inputs": [],
  "outputs": [{ "address": "addr_miner", "value": 100 }]
}
```

**Assertions:**

- ✅ No input validation performed
- ✅ Output created with value 100
- ✅ addr_miner balance increased by 100
- ✅ No "input sum != output sum" error

---

### Test Case 9: Large Transaction (Multiple Inputs/Outputs)

```mermaid
graph LR
    A[Test: 10 Inputs<br/>20 Outputs] --> B[Validate all 10<br/>inputs exist]
    B --> C[Calculate input sum]
    C --> D[Calculate output sum]
    D --> E{Sums<br/>equal?}
    E -->|Yes| F[Process transaction]
    E -->|No| G[❌ Error]
    F --> H{All 30 DB<br/>operations<br/>succeed?}
    H -->|Yes| I[✅ Test Pass]
    H -->|No| J[❌ Test Fail]

    style I fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style J fill:#FFB6C1,stroke:#333,stroke-width:3px,color:black
```

**Test Data:**

```json
{
  "id": "tx_large",
  "inputs": [
    { "txId": "tx1", "index": 0 },
    { "txId": "tx2", "index": 0 }
    // ... 8 more inputs
  ],
  "outputs": [
    { "address": "addr1", "value": 50 },
    { "address": "addr2", "value": 75 }
    // ... 18 more outputs
  ]
}
```

**Performance Assertions:**

- ✅ All 10 inputs validated
- ✅ All 20 outputs created
- ✅ 10 addresses debited
- ✅ 20 addresses credited
- ✅ Transaction completes in < 1 second

---

### Test Case 10: Zero Value Output

```mermaid
flowchart TD
    Start[Test: Zero Value Output] --> Submit{Output<br/>value?}
    Submit -->|0| Zero[value = 0]
    Submit -->|Negative| Neg[value = -100]
    Submit -->|Positive| Pos[value = 100]

    Zero --> Schema{Zod Schema<br/>Validation}
    Neg --> Schema
    Pos --> Schema

    Schema -->|0| Error1[❌ Value must be > 0]
    Schema -->|Negative| Error2[❌ Value must be positive]
    Schema -->|Positive| Success[✅ Valid]

    Error1 --> Pass[✅ Test Pass]
    Error2 --> Pass

    style Pass fill:#90EE90,stroke:#333,stroke-width:3px,color:black
```

**Test Cases:**

```javascript
// Test 1: Zero value
{
  "outputs": [{ "address": "addr1", "value": 0 }]
}
// Expected: 400 "Output value must be greater than 0"

// Test 2: Negative value
{
  "outputs": [{ "address": "addr1", "value": -100 }]
}
// Expected: 400 "Output value must be positive"

// Test 3: Valid positive value
{
  "outputs": [{ "address": "addr1", "value": 100 }]
}
// Expected: ✅ Success
```

---

## Performance Test Suite

### Test Case 11: Concurrent Block Submissions

```mermaid
sequenceDiagram
    participant Client1
    participant Client2
    participant API
    participant DB

    Note over Client1,DB: Both try to submit height 2 simultaneously

    par Client 1
        Client1->>API: POST /api/blocks (height: 2)
    and Client 2
        Client2->>API: POST /api/blocks (height: 2)
    end

    API->>DB: BEGIN TRANSACTION (Client 1)
    API->>DB: BEGIN TRANSACTION (Client 2)

    DB-->>API: Lock acquired (Client 1)
    DB-->>API: Wait for lock... (Client 2)

    API->>DB: INSERT block height 2 (Client 1)
    DB-->>API: Success (Client 1)

    API-->>Client1: 201 Created ✅

    Note over API,DB: Client 2 now gets lock

    API->>DB: INSERT block height 2 (Client 2)
    DB-->>API: ❌ Unique constraint violation

    API-->>Client2: 400 Error<br/>(Height already exists)
```

**Test Assertions:**

- ✅ Only one block at height 2 exists
- ✅ First client succeeds (201)
- ✅ Second client fails (400)
- ✅ Database maintains consistency

---

### Test Case 12: High-Volume Balance Queries

```mermaid
graph LR
    A[1000 Balance Queries<br/>in 1 second] --> B[Parallel Execution]
    B --> C[Query Cache Hit Rate]
    C --> D{Average<br/>Response<br/>Time?}
    D -->|< 10ms| E[✅ Performance Good]
    D -->|> 50ms| F[❌ Performance Poor]

    style E fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style F fill:#FFB6C1,stroke:#333,stroke-width:3px,color:black
```

**Test Code:**

```javascript
const start = Date.now();
const promises = [];

for (let i = 0; i < 1000; i++) {
  promises.push(
    app.inject({
      method: 'GET',
      url: `/api/balance/addr${i % 100}`
    })
  );
}

await Promise.all(promises);
const duration = Date.now() - start;

assert(duration < 10000, 'Should complete in < 10 seconds');
assert(avgResponseTime < 10, 'Average response < 10ms');
```

**Assertions:**

- ✅ All 1000 queries succeed
- ✅ Total time < 10 seconds
- ✅ Average response time < 10ms
- ✅ No database connection errors

---

## Rollback Test Suite

### Test Case 13: Simple Rollback

```mermaid
graph TD
    Start[Initial State:<br/>Blocks 1-5] --> Submit[POST /api/rollback?height=3]
    Submit --> Validate{Target < Current?}
    Validate -->|No| Error[400 Error]
    Validate -->|Yes| Process[Process Rollback]

    Process --> Delete[Delete Blocks 4-5]
    Delete --> Unspend[Unspend outputs<br/>from blocks 4-5]
    Unspend --> Restore[Restore balances]
    Restore --> Assert1{Current<br/>height = 3?}

    Assert1 -->|Yes| Assert2{Blocks 4-5<br/>deleted?}
    Assert2 -->|Yes| Assert3{Balances<br/>restored?}
    Assert3 -->|Yes| Pass[✅ Test Pass]

    Assert1 -->|No| Fail
    Assert2 -->|No| Fail
    Assert3 -->|No| Fail[❌ Test Fail]

    style Pass fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style Fail fill:#FFB6C1,stroke:#333,stroke-width:3px,color:black
```

**Before Rollback:**

```
Blocks: 1, 2, 3, 4, 5
Current Height: 5
addr30 balance: 426 (created in block 6, doesn't exist yet in this test)
```

**After Rollback to Height 3:**

```
Blocks: 1, 2, 3
Current Height: 3
addr30 balance: 0 (outputs deleted)
addr13 balance: 440 (restored, was spent in block 4)
```

**Assertions:**

- ✅ Blocks 4 and 5 deleted
- ✅ Outputs from blocks 4-5 deleted
- ✅ Outputs spent in blocks 4-5 marked unspent
- ✅ Balances recalculated correctly

---

### Test Case 14: Rollback Depth Limit

```mermaid
flowchart TD
    Start[Current Height: 3000] --> Request{Rollback to<br/>height?}
    Request -->|0| Depth1[Depth: 3000]
    Request -->|1000| Depth2[Depth: 2000]
    Request -->|1001| Depth3[Depth: 1999]

    Depth1 --> Check{Depth ><br/>2000?}
    Depth2 --> Check
    Depth3 --> Check

    Check -->|Yes| Error[400 Error<br/>Depth exceeded]
    Check -->|No| Success[✅ Rollback proceeds]

    Error --> TestPass[✅ Test Pass]
    Success --> TestFail[❌ Should reject<br/>rollback > 2000]

    style TestPass fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style TestFail fill:#FFB6C1,stroke:#333,stroke-width:3px,color:black
```

**Test Cases:**

```javascript
// Current height: 3000

// Test 1: Rollback 3000 blocks (exceeds limit)
await expect(rollback({ height: 0 })).rejects.toThrow('Cannot rollback more than 2000 blocks');

// Test 2: Rollback exactly 2000 blocks (at limit)
const result = await rollback({ height: 1000 });
assert.equal(result.newHeight, 1000); // ✅ Success

// Test 3: Rollback 1999 blocks (under limit)
const result2 = await rollback({ height: 1001 });
assert.equal(result2.newHeight, 1001); // ✅ Success
```

---

## Test Suite Summary

### Coverage Matrix

| Category           | Test Cases | Status |
| ------------------ | ---------- | ------ |
| **Happy Path**     | 3          | ✅     |
| **Error Handling** | 4          | ✅     |
| **Edge Cases**     | 3          | ✅     |
| **Performance**    | 2          | ✅     |
| **Rollback**       | 2          | ✅     |
| **Total**          | **14**     | **✅** |

### Test Execution Flow

```mermaid
graph LR
    A[Run Test Suite] --> B[Unit Tests<br/>10 tests]
    B --> C[Integration Tests<br/>13 tests]
    C --> D[API Tests<br/>23 tests]
    D --> E{All Pass?}
    E -->|Yes| F[✅ Deploy]
    E -->|No| G[❌ Fix & Retry]

    style F fill:#90EE90,stroke:#333,stroke-width:3px,color:black
    style G fill:#FFB6C1,stroke:#333,stroke-width:3px,color:black
```

### Command to Run Tests

```bash
# All tests (36 total)
npm test

# Unit tests only (10 tests, fast)
npm run test:unit

# Database integration tests (13 tests)
npm run test:db

# API integration tests (23 tests)
npm run test:api
```
