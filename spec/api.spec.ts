import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import { spawn } from 'child_process';
import { calculateBlockId } from '../src/utils/blockhain.util.ts';
import { Block, Transaction } from '../src/schemas/blockchain.schema.ts';

// Use PORT from .test.env (loaded via --env-file flag)
const API_PORT = process.env.PORT || '3001';
const API_HOST = process.env.HOST || 'localhost';
const API_BASE_URL = `http://${API_HOST}:${API_PORT}`;

async function makeRequest(method: string, endpoint: string, body?: any): Promise<Response> {
  const url = `${API_BASE_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  } else if (method === 'POST') {
    // Fastify requires a body for POST requests, even if empty
    options.body = JSON.stringify({});
  }

  return fetch(url, options);
}

async function parseResponse(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('Failed to parse response as JSON:', { error, text });
    return { error: 'PARSE_ERROR', message: text };
  }
}

describe('API Integration Tests', () => {
  let serverProcess: any;

  beforeEach(async () => {
    try {
      // Start the server process with environment from .test.env
      // The test runner already loaded .test.env via --env-file flag
      serverProcess = spawn('bun', ['src/index.ts'], {
        env: {
          ...process.env // All variables from .test.env are already in process.env
        },
        stdio: 'pipe' // Changed from 'inherit' to 'pipe' to capture output
      });

      // Wait for server to start and test connectivity
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test if server is ready
      const maxRetries = 10;
      let retries = 0;
      while (retries < maxRetries) {
        try {
          const response = await fetch(`${API_BASE_URL}/`, {
            method: 'GET',
            signal: AbortSignal.timeout(1000)
          });
          if (response.ok) break;
        } catch (error) {
          retries++;
          if (retries === maxRetries) {
            throw new Error('Failed to start server: ' + error);
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error('Failed to start server:', error);
      throw error;
    }
  });

  afterEach(async () => {
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  describe('POST /blocks', () => {
    test('accepts valid block', async () => {
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
      console.log('>>>> accepts valid block request block: ', JSON.stringify(block, null, 2));
      const response = await makeRequest('POST', '/api/blocks', block);
      expect(response.status).toBe(200);

      const result = await parseResponse(response);
      expect(result.message).toBe('Block processed successfully');
      expect(result.blockId).toBe(block.id);
      expect(result.height).toBe(1);
    });

    test('rejects block with invalid height', async () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 100 }]
        }
      ];

      const block: Block = {
        id: calculateBlockId(3, transactions),
        height: 3, // Should be 1 for first block
        transactions
      };
      console.log('>>>> rejects block with invalid height block: ', JSON.stringify(block, null, 2));

      const response = await makeRequest('POST', '/api/blocks', block);
      expect(response.status).toBe(400);

      const result = await parseResponse(response);
      expect(result.code).toBe('INVALID_HEIGHT');
    });

    test('rejects block with invalid ID', async () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 100 }]
        }
      ];

      const block: Block = {
        id: 'invalid_id',
        height: 1,
        transactions
      };

      const response = await makeRequest('POST', '/api/blocks', block);
      expect(response.status).toBe(400);

      const result = await parseResponse(response);
      expect(result.code).toBe('INVALID_BLOCK_ID');
    });

    test('rejects malformed request', async () => {
      const response = await makeRequest('POST', '/api/blocks', { invalid: 'data' });
      expect(response.status).toBe(400);

      const result = await parseResponse(response);
      expect(result.code).toBe('INVALID_REQUEST');
    });
  });

  describe('GET /balance/:address', () => {
    test('returns zero balance for new address', async () => {
      const response = await makeRequest('GET', '/api/balance/newaddress');
      expect(response.status).toBe(200);

      const result = await parseResponse(response);
      expect(result.address).toBe('newaddress');
      expect(result.balance).toBe(0);
    });

    test('returns correct balance after processing blocks', async () => {
      // First create a block with some outputs
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'testaddr', value: 50 }]
        }
      ];

      const block: Block = {
        id: calculateBlockId(1, transactions),
        height: 1,
        transactions
      };

      await makeRequest('POST', '/api/blocks', block);

      // Check balance
      const response = await makeRequest('GET', '/api/balance/testaddr');
      expect(response.status).toBe(200);

      const result = await parseResponse(response);
      expect(result.address).toBe('testaddr');
      expect(result.balance).toBe(50);
    });

    test('handles empty address parameter', async () => {
      const response = await makeRequest('GET', '/api/balance/');
      expect(response.status).toBe(400); // Fastify returns 400 for validation errors
    });
  });

  describe('POST /rollback', () => {
    test('performs rollback successfully', async () => {
      // Create initial block
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

      await makeRequest('POST', '/api/blocks', block1);

      // Create second block
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

      await makeRequest('POST', '/api/blocks', block2);

      // Perform rollback
      const response = await makeRequest('POST', '/api/rollback?height=1');

      console.log('>>>> rollback: ', {
        block1: JSON.stringify(block1, null, 2),
        block2: JSON.stringify(block2, null, 2)
      });

      expect(response.status).toBe(200);

      const result = await parseResponse(response);
      expect(result.message).toBe('Rollback completed successfully');
      expect(result.targetHeight).toBe(1);
      expect(result.previousHeight).toBe(2);
    });

    test('rejects rollback without height parameter', async () => {
      const response = await makeRequest('POST', '/api/rollback');
      expect(response.status).toBe(400);

      const result = await parseResponse(response);
      expect(result.code).toBe('MISSING_HEIGHT');
    });

    test('rejects rollback with invalid height', async () => {
      const response = await makeRequest('POST', '/api/rollback?height=abc');
      expect(response.status).toBe(400);

      const result = await parseResponse(response);
      expect(result.code).toBe('INVALID_HEIGHT');
    });

    test('rejects rollback to future height', async () => {
      const response = await makeRequest('POST', '/api/rollback?height=999');
      expect(response.status).toBe(400);

      const result = await parseResponse(response);
      expect(result.code).toBe('INVALID_HEIGHT');
    });
  });

  describe('GET /getAllBlocks', () => {
    test('returns empty array when no blocks exist', async () => {
      const response = await makeRequest('GET', '/api/getAllBlocks');
      expect(response.status).toBe(200);

      const result = await parseResponse(response);
      expect(Array.isArray(result.blocks)).toBe(true);
      expect(result.blocks.length).toBe(0);
      expect(result.count).toBe(0);
    });

    test('returns all blocks after processing some blocks', async () => {
      // Create first block
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

      await makeRequest('POST', '/api/blocks', block1);

      // Create second block
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

      await makeRequest('POST', '/api/blocks', block2);

      // Get all blocks
      const response = await makeRequest('GET', '/api/getAllBlocks');
      expect(response.status).toBe(200);

      const result = await parseResponse(response);
      expect(Array.isArray(result.blocks)).toBe(true);
      expect(result.blocks.length).toBe(2);
      expect(result.count).toBe(2);

      // Verify blocks are ordered by height
      expect(result.blocks[0].height).toBe(1);
      expect(result.blocks[1].height).toBe(2);
      expect(result.blocks[0].id).toBe(block1.id);
      expect(result.blocks[1].id).toBe(block2.id);
    });
  });

  describe('GET /', () => {
    test('returns API information', async () => {
      const response = await makeRequest('GET', '/');
      expect(response.status).toBe(200);

      const result = await parseResponse(response);
      expect(result.message).toBe('Blockchain Indexer API');
      expect(Array.isArray(result.endpoints)).toBe(true);
      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
    });
  });
});
