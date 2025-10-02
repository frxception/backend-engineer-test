import { createHash } from 'crypto';
import { Block, Transaction } from '../schemas/blockchain.schema.ts';

export function calculateBlockId(height: number, transactions: Transaction[]): string {
  const transactionIds = transactions.map(tx => tx.id).join('');
  const input = height.toString() + transactionIds;
  return createHash('sha256').update(input).digest('hex');
}

export function validateBlockId(block: Block): boolean {
  const expectedId = calculateBlockId(block.height, block.transactions);
  return block.id === expectedId;
}

export function calculateTransactionValues(transactions: Transaction[]): {
  totalInputValue: number;
  totalOutputValue: number;
} {
  const totalInputValue = 0;
  let totalOutputValue = 0;

  for (const transaction of transactions) {
    for (const output of transaction.outputs) {
      totalOutputValue += output.value;
    }
  }

  return { totalInputValue, totalOutputValue };
}

export interface ValidationError {
  code: string;
  message: string;
}

export function validateBlock(
  block: Block,
  currentHeight: number,
  inputValidation: { isValid: boolean; totalInputValue: number }
): ValidationError | null {
  // Validate block ID first
  if (!validateBlockId(block)) {
    const expectedId = calculateBlockId(block.height, block.transactions);
    return {
      code: 'INVALID_BLOCK_ID',
      message: `Block ID ${block.id} does not match expected ID ${expectedId}`
    };
  }

  // Validate height
  if (block.height !== currentHeight + 1) {
    return {
      code: 'INVALID_HEIGHT',
      message: `Block height ${block.height} is not exactly one unit higher than current height ${currentHeight}`
    };
  }

  // Validate inputs exist and are unspent
  if (!inputValidation.isValid) {
    return {
      code: 'INVALID_INPUTS',
      message: 'One or more inputs reference non-existent or already spent outputs'
    };
  }

  // Validate input/output value balance
  const { totalOutputValue } = calculateTransactionValues(block.transactions);

  // Check if this is a coinbase transaction (first transaction with no inputs)
  const hasCoinbaseTransaction = block.transactions.some(tx => tx.inputs.length === 0);

  // Separate coinbase and regular transactions
  const regularInputValue = inputValidation.totalInputValue;
  let regularOutputValue = 0;

  for (const transaction of block.transactions) {
    if (transaction.inputs.length != 0) {
      // This is a regular transaction
      for (const output of transaction.outputs) {
        regularOutputValue += output.value;
      }
    }
  }

  // For blocks with only coinbase transactions, totalInputValue should be 0
  // For blocks with only regular transactions, inputs must equal outputs
  // For mixed blocks, regular transaction inputs must equal regular transaction outputs
  if (hasCoinbaseTransaction && regularOutputValue === 0) {
    // Pure coinbase block - input value should be 0
    if (inputValidation.totalInputValue !== 0) {
      return {
        code: 'INVALID_BALANCE',
        message: `Coinbase block should have zero input value, but got ${inputValidation.totalInputValue}`
      };
    }
  } else if (!hasCoinbaseTransaction) {
    // Pure regular transaction block - inputs must equal outputs
    if (inputValidation.totalInputValue !== totalOutputValue) {
      return {
        code: 'INVALID_BALANCE',
        message: `Sum of inputs (${inputValidation.totalInputValue}) does not equal sum of outputs (${totalOutputValue})`
      };
    }
  } else {
    // Mixed block - regular inputs must equal regular outputs
    if (regularInputValue !== regularOutputValue) {
      return {
        code: 'INVALID_BALANCE',
        message: `Sum of regular inputs (${regularInputValue}) does not equal sum of regular outputs (${regularOutputValue})`
      };
    }
  }

  return null;
}
