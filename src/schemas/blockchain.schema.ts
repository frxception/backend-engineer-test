import { z } from 'zod';

// Basic blockchain data schemas
export const OutputSchema = z.object({
  address: z.string().min(1, 'Address cannot be empty'),
  value: z.number().int().positive('Value must be a positive integer')
});

export const InputSchema = z.object({
  txId: z.string().min(1, 'Transaction ID cannot be empty'),
  index: z.number().int().min(0, 'Index must be non-negative')
});

export const TransactionSchema = z.object({
  id: z.string().min(1, 'Transaction ID cannot be empty'),
  inputs: z.array(InputSchema),
  outputs: z.array(OutputSchema).min(0)
});

export const BlockSchema = z.object({
  id: z.string().min(1, 'Block ID cannot be empty'),
  height: z.number().int().positive('Block height must be positive'),
  transactions: z.array(TransactionSchema)
});

// API request/response schemas
export const ProcessBlockRequestSchema = BlockSchema;

export const ProcessBlockResponseSchema = z.object({
  message: z.string(),
  blockId: z.string(),
  height: z.number()
});

export const GetBalanceParamsSchema = z.object({
  address: z.string().min(1, 'Address cannot be empty')
});

export const GetBalanceResponseSchema = z.object({
  address: z.string(),
  balance: z.number().int().min(0)
});

export const RollbackQuerySchema = z.object({
  height: z
    .string()
    .refine(val => !isNaN(Number(val)), 'Height must be a number')
    .refine(val => Number(val) >= 0, 'Height must be non-negative')
    .transform(val => Number(val))
});

export const RollbackResponseSchema = z.object({
  message: z.string(),
  targetHeight: z.number(),
  previousHeight: z.number()
});

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  field: z.string().optional()
});

// Health check response schema
export const HealthResponseSchema = z.object({
  message: z.string(),
  endpoints: z.array(z.string()),
  status: z.string(),
  timestamp: z.string()
});

// Database schemas
export const StoredOutputSchema = z.object({
  id: z.number(),
  transaction_id: z.string(),
  output_index: z.number(),
  address: z.string(),
  value: z.number(),
  is_spent: z.boolean(),
  spent_in_transaction_id: z.string().optional(),
  block_height: z.number()
});

export const AddressBalanceSchema = z.object({
  address: z.string(),
  balance: z.number(),
  last_updated_height: z.number()
});

export const BlockRecordSchema = z.object({
  id: z.string(),
  height: z.number(),
  created_at: z.date()
});

export const TransactionRecordSchema = z.object({
  id: z.string(),
  block_id: z.string(),
  block_height: z.number(),
  created_at: z.date()
});

// Type exports (inferred from schemas)
export type Output = z.infer<typeof OutputSchema>;
export type Input = z.infer<typeof InputSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type Block = z.infer<typeof BlockSchema>;
export type ProcessBlockRequest = z.infer<typeof ProcessBlockRequestSchema>;
export type ProcessBlockResponse = z.infer<typeof ProcessBlockResponseSchema>;
export type GetBalanceParams = z.infer<typeof GetBalanceParamsSchema>;
export type GetBalanceResponse = z.infer<typeof GetBalanceResponseSchema>;
export type RollbackQuery = z.infer<typeof RollbackQuerySchema>;
export type RollbackResponse = z.infer<typeof RollbackResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type StoredOutput = z.infer<typeof StoredOutputSchema>;
export type AddressBalance = z.infer<typeof AddressBalanceSchema>;
export type BlockRecord = z.infer<typeof BlockRecordSchema>;
export type TransactionRecord = z.infer<typeof TransactionRecordSchema>;
