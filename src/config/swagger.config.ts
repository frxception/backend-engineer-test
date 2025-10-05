import type { FastifyDynamicSwaggerOptions } from '@fastify/swagger';
import type { FastifySwaggerUiOptions } from '@fastify/swagger-ui';

export const swaggerOptions: FastifyDynamicSwaggerOptions = {
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'Blockchain Indexer API',
      description:
        'A blockchain indexer implementation using the UTXO (Unspent Transaction Output) model. Processes blocks, tracks address balances, validates transactions, and supports blockchain rollbacks.',
      version: '1.0.0',
      contact: {
        name: 'API Support',
        email: 'support@blockchain-indexer.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'http://localhost:3001',
        description: 'Test server'
      }
    ],
    tags: [
      {
        name: 'blockchain',
        description: 'Blockchain operations - block processing, balance queries, and rollbacks'
      },
      {
        name: 'health',
        description: 'Health check and monitoring endpoints'
      }
    ],
    components: {
      schemas: {
        TransactionInput: {
          type: 'object',
          required: ['txId', 'index'],
          properties: {
            txId: {
              type: 'string',
              description: 'Reference to the transaction ID containing the output to spend',
              example: 'tx1'
            },
            index: {
              type: 'integer',
              minimum: 0,
              description: 'Index of the output within the referenced transaction',
              example: 0
            }
          }
        },
        TransactionOutput: {
          type: 'object',
          required: ['address', 'value'],
          properties: {
            address: {
              type: 'string',
              description: 'Recipient address for this output',
              example: 'addr1'
            },
            value: {
              type: 'integer',
              minimum: 0,
              description: 'Amount of value in satoshis',
              example: 100
            }
          }
        },
        Transaction: {
          type: 'object',
          required: ['id', 'inputs', 'outputs'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique transaction identifier',
              example: 'tx1'
            },
            inputs: {
              type: 'array',
              description: 'List of inputs (references to previous outputs)',
              items: {
                $ref: '#/components/schemas/TransactionInput'
              }
            },
            outputs: {
              type: 'array',
              description: 'List of outputs (new UTXOs)',
              minItems: 1,
              items: {
                $ref: '#/components/schemas/TransactionOutput'
              }
            }
          }
        },
        Block: {
          type: 'object',
          required: ['height', 'hash', 'transactions'],
          properties: {
            height: {
              type: 'integer',
              minimum: 1,
              description: 'Block height (sequential, starting from 1)',
              example: 1
            },
            hash: {
              type: 'string',
              description: 'SHA-256 hash: sha256(height + tx1.id + tx2.id + ... + txN.id)',
              example: 'a1b2c3d4e5f6...'
            },
            transactions: {
              type: 'array',
              description: 'List of transactions in this block',
              minItems: 1,
              items: {
                $ref: '#/components/schemas/Transaction'
              }
            }
          }
        },
        BalanceResponse: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'The queried address',
              example: 'addr1'
            },
            balance: {
              type: 'integer',
              description: 'Current balance (sum of unspent outputs)',
              example: 100
            }
          }
        },
        RollbackResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Blockchain rolled back to height 5'
            },
            rolledBackToHeight: {
              type: 'integer',
              example: 5
            },
            blocksDeleted: {
              type: 'integer',
              description: 'Number of blocks removed',
              example: 3
            }
          }
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'unhealthy'],
              example: 'healthy'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00.000Z'
            },
            database: {
              type: 'string',
              enum: ['connected', 'disconnected'],
              example: 'connected'
            },
            blockHeight: {
              type: 'integer',
              description: 'Current blockchain height',
              example: 42
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            statusCode: {
              type: 'integer',
              example: 400
            },
            error: {
              type: 'string',
              example: 'Bad Request'
            },
            message: {
              type: 'string',
              example: 'Invalid block height'
            },
            code: {
              type: 'string',
              description: 'Application-specific error code',
              example: 'VALIDATION_ERROR'
            }
          }
        }
      },
      examples: {
        // POST /blocks - Success case (genesis block)
        GenesisBlockRequest: {
          summary: 'Genesis block (height 1)',
          value: {
            height: 1,
            hash: 'abc123',
            transactions: [
              {
                id: 'tx1',
                inputs: [],
                outputs: [
                  {
                    address: 'addr1',
                    value: 100
                  }
                ]
              }
            ]
          }
        },
        GenesisBlockResponse: {
          summary: 'Block processed successfully',
          value: {
            message: 'Block processed successfully',
            height: 1,
            transactionsProcessed: 1
          }
        },
        // POST /blocks - Regular block with UTXO spending
        RegularBlockRequest: {
          summary: 'Block 2 with UTXO spending',
          value: {
            height: 2,
            hash: 'def456',
            transactions: [
              {
                id: 'tx2',
                inputs: [
                  {
                    txId: 'tx1',
                    index: 0
                  }
                ],
                outputs: [
                  {
                    address: 'addr2',
                    value: 50
                  },
                  {
                    address: 'addr1',
                    value: 50
                  }
                ]
              }
            ]
          }
        },
        // POST /blocks - Invalid height
        InvalidHeightRequest: {
          summary: 'Invalid height (skipping blocks)',
          value: {
            height: 5,
            hash: 'invalid',
            transactions: [
              {
                id: 'tx5',
                inputs: [],
                outputs: [
                  {
                    address: 'addr1',
                    value: 100
                  }
                ]
              }
            ]
          }
        },
        InvalidHeightResponse: {
          summary: 'Height validation error',
          value: {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Invalid block height. Expected 2, got 5',
            code: 'VALIDATION_ERROR'
          }
        },
        // POST /blocks - Invalid hash
        InvalidHashRequest: {
          summary: 'Invalid block hash',
          value: {
            height: 2,
            hash: 'wronghash',
            transactions: [
              {
                id: 'tx2',
                inputs: [],
                outputs: [
                  {
                    address: 'addr1',
                    value: 100
                  }
                ]
              }
            ]
          }
        },
        InvalidHashResponse: {
          summary: 'Hash validation error',
          value: {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Invalid block hash',
            code: 'VALIDATION_ERROR'
          }
        },
        // POST /blocks - Double spending
        DoubleSpendRequest: {
          summary: 'Attempt to spend already spent UTXO',
          value: {
            height: 3,
            hash: 'ghi789',
            transactions: [
              {
                id: 'tx3',
                inputs: [
                  {
                    txId: 'tx1',
                    index: 0
                  }
                ],
                outputs: [
                  {
                    address: 'addr3',
                    value: 100
                  }
                ]
              }
            ]
          }
        },
        DoubleSpendResponse: {
          summary: 'UTXO already spent error',
          value: {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Input references an already spent output: tx1:0',
            code: 'VALIDATION_ERROR'
          }
        },
        // POST /blocks - Invalid input reference
        InvalidInputRequest: {
          summary: 'Input references non-existent UTXO',
          value: {
            height: 2,
            hash: 'jkl012',
            transactions: [
              {
                id: 'tx2',
                inputs: [
                  {
                    txId: 'nonexistent',
                    index: 0
                  }
                ],
                outputs: [
                  {
                    address: 'addr1',
                    value: 100
                  }
                ]
              }
            ]
          }
        },
        InvalidInputResponse: {
          summary: 'UTXO not found error',
          value: {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Input references non-existent output: nonexistent:0',
            code: 'VALIDATION_ERROR'
          }
        },
        // POST /blocks - Unbalanced transaction
        UnbalancedTransactionRequest: {
          summary: 'Input value != output value',
          value: {
            height: 2,
            hash: 'mno345',
            transactions: [
              {
                id: 'tx2',
                inputs: [
                  {
                    txId: 'tx1',
                    index: 0
                  }
                ],
                outputs: [
                  {
                    address: 'addr2',
                    value: 150
                  }
                ]
              }
            ]
          }
        },
        UnbalancedTransactionResponse: {
          summary: 'Transaction balance error',
          value: {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Transaction input/output values do not match',
            code: 'VALIDATION_ERROR'
          }
        },
        // GET /balance/:address - Address with balance
        BalanceFoundResponse: {
          summary: 'Address with balance',
          value: {
            address: 'addr1',
            balance: 150
          }
        },
        // GET /balance/:address - Address with no balance
        BalanceNotFoundResponse: {
          summary: 'Address with zero balance',
          value: {
            address: 'addr999',
            balance: 0
          }
        },
        // POST /rollback - Success
        RollbackSuccessResponse: {
          summary: 'Successful rollback',
          value: {
            message: 'Blockchain rolled back to height 5',
            rolledBackToHeight: 5,
            blocksDeleted: 3
          }
        },
        // POST /rollback - Invalid height
        RollbackInvalidHeightResponse: {
          summary: 'Invalid rollback height',
          value: {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Invalid rollback height. Must be >= 0',
            code: 'VALIDATION_ERROR'
          }
        },
        // POST /rollback - Exceeds max depth
        RollbackMaxDepthResponse: {
          summary: 'Rollback depth exceeds limit',
          value: {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Rollback depth exceeds maximum allowed (2000 blocks)',
            code: 'VALIDATION_ERROR'
          }
        },
        // POST /rollback - Future height
        RollbackFutureHeightResponse: {
          summary: 'Rollback to future height',
          value: {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Cannot rollback to height 100. Current height is 50',
            code: 'VALIDATION_ERROR'
          }
        },
        // GET /health - Healthy
        HealthyResponse: {
          summary: 'System healthy',
          value: {
            status: 'healthy',
            timestamp: '2024-01-15T10:30:00.000Z',
            database: 'connected',
            blockHeight: 42
          }
        },
        // GET /health - Unhealthy (DB disconnected)
        UnhealthyResponse: {
          summary: 'Database disconnected',
          value: {
            status: 'unhealthy',
            timestamp: '2024-01-15T10:30:00.000Z',
            database: 'disconnected',
            blockHeight: 0
          }
        }
      }
    }
  }
};

export const swaggerUiOptions: FastifySwaggerUiOptions = {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    syntaxHighlight: {
      activate: true,
      theme: 'monokai'
    }
  },
  staticCSP: true,
  transformStaticCSP: header => header
};

// Type-safe route schemas for Fastify RouteShorthandOptions
import type { FastifySchema } from 'fastify';

export const swaggerRouteSchemas = {
  postBlocks: {
    description: 'Process and validate a new block with its transactions',
    tags: ['blockchain'],
    body: {
      type: 'object',
      required: ['height', 'hash', 'transactions'],
      properties: {
        height: {
          type: 'integer',
          minimum: 1,
          description: 'Block height (sequential, starting from 1)'
        },
        hash: {
          type: 'string',
          description: 'SHA-256 hash: sha256(height + tx1.id + tx2.id + ... + txN.id)'
        },
        transactions: {
          type: 'array',
          description: 'List of transactions in this block',
          minItems: 1,
          items: {
            type: 'object',
            required: ['id', 'inputs', 'outputs'],
            properties: {
              id: {
                type: 'string',
                description: 'Unique transaction identifier'
              },
              inputs: {
                type: 'array',
                description:
                  'List of inputs (references to previous outputs). Empty for coinbase transactions.',
                items: {
                  type: 'object',
                  required: ['txId', 'index'],
                  properties: {
                    txId: {
                      type: 'string',
                      description: 'Reference to the transaction ID containing the output to spend'
                    },
                    index: {
                      type: 'integer',
                      minimum: 0,
                      description: 'Index of the output within the referenced transaction'
                    }
                  }
                }
              },
              outputs: {
                type: 'array',
                description: 'List of outputs (new UTXOs)',
                minItems: 1,
                items: {
                  type: 'object',
                  required: ['address', 'value'],
                  properties: {
                    address: {
                      type: 'string',
                      description: 'Recipient address for this output'
                    },
                    value: {
                      type: 'integer',
                      minimum: 0,
                      description: 'Amount of value in satoshis'
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  } satisfies FastifySchema,

  getBalanceAddress: {
    description: 'Get current balance for an address (sum of unspent outputs)',
    tags: ['blockchain'],
    params: {
      type: 'object',
      required: ['address'],
      properties: {
        address: {
          type: 'string',
          description: 'The blockchain address to query'
        }
      }
    }
  } satisfies FastifySchema,

  postRollback: {
    description: 'Rollback blockchain to a specific height (deletes blocks with height > N)',
    tags: ['blockchain'],
    querystring: {
      type: 'object',
      required: ['height'],
      properties: {
        height: {
          type: 'integer',
          minimum: 0,
          description:
            'Target height to rollback to (must be >= 0 and within 2000 blocks of current height)'
        }
      }
    }
  } satisfies FastifySchema,

  health: {
    description:
      'Health check endpoint - returns system status, database connectivity, and current block height',
    tags: ['health']
  } satisfies FastifySchema
};
