import { z } from 'zod';

// Domain schemas
export const outputSchema = z.object({
  address: z.string().min(1, 'Address cannot be empty'),
  value: z.number().positive('Value must be positive'),
});

export const inputSchema = z.object({
  txId: z.string().min(1, 'Transaction ID cannot be empty'),
  index: z.number().int().nonnegative('Index must be a non-negative integer'),
});

export const transactionSchema = z.object({
  id: z.string().min(1, 'Transaction ID cannot be empty'),
  inputs: z.array(inputSchema),
  outputs: z.array(outputSchema).min(1, 'Transaction must have at least one output'),
});

export const blockSchema = z.object({
  id: z.string().min(1, 'Block ID cannot be empty'),
  height: z.number().int().positive('Height must be a positive integer'),
  transactions: z.array(transactionSchema).min(1, 'Block must have at least one transaction'),
});

// Type exports
export type Output = z.infer<typeof outputSchema>;
export type Input = z.infer<typeof inputSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Block = z.infer<typeof blockSchema>;

// UTXO identifier
export interface UtxoId {
  txId: string;
  index: number;
}

// Database models
export interface StoredBlock {
  id: string;
  height: number;
  createdAt: Date;
}

export interface StoredTransaction {
  id: string;
  blockId: string;
  blockHeight: number;
}

export interface StoredOutput {
  txId: string;
  index: number;
  address: string;
  value: number;
  isSpent: boolean;
  spentInBlockHeight: number | null;
}

export interface AddressBalance {
  address: string;
  balance: number;
}