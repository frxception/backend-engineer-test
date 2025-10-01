import { createHash } from 'crypto';
import type { Block, Transaction, Input } from '../types/domain';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateBlockHeight(block: Block, currentHeight: number): void {
  const expectedHeight = currentHeight + 1;
  if (block.height !== expectedHeight) {
    throw new ValidationError(
      `Invalid block height. Expected ${expectedHeight}, got ${block.height}`
    );
  }
}

export function calculateBlockHash(block: Block): string {
  const transactionIds = block.transactions.map(tx => tx.id).join('');
  const data = `${block.height}${transactionIds}`;
  return createHash('sha256').update(data).digest('hex');
}

export function validateBlockHash(block: Block): void {
  const calculatedHash = calculateBlockHash(block);
  if (block.id !== calculatedHash) {
    throw new ValidationError(
      `Invalid block hash. Expected ${calculatedHash}, got ${block.id}`
    );
  }
}

export function calculateInputSum(inputs: Input[], getOutputValue: (txId: string, index: number) => number): number {
  return inputs.reduce((sum, input) => {
    const value = getOutputValue(input.txId, input.index);
    return sum + value;
  }, 0);
}

export function calculateOutputSum(transaction: Transaction): number {
  return transaction.outputs.reduce((sum, output) => sum + output.value, 0);
}

export function validateTransactionBalance(
  transaction: Transaction,
  getOutputValue: (txId: string, index: number) => number
): void {
  const inputSum = calculateInputSum(transaction.inputs, getOutputValue);
  const outputSum = calculateOutputSum(transaction);

  if (inputSum !== outputSum) {
    throw new ValidationError(
      `Transaction ${transaction.id} has unbalanced inputs and outputs. Input sum: ${inputSum}, Output sum: ${outputSum}`
    );
  }
}

export function validateBlockTransactions(
  block: Block,
  getOutputValue: (txId: string, index: number) => number
): void {
  for (const transaction of block.transactions) {
    // Allow transactions with no inputs (coinbase/genesis transactions)
    if (transaction.inputs.length === 0) {
      continue;
    }

    validateTransactionBalance(transaction, getOutputValue);
  }
}
