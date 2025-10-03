import { DatabaseService } from '../models';
import { Block, BlockSchema } from '../schemas/blockchain.schema.ts';
import { validateBlock } from '../utils/blockhain.util.ts';
import { AppConfig } from '../config/app.config';

export class BlockchainService {
  constructor(private dbService: DatabaseService) {
    this.dbService = dbService;
  }

  async processBlock(block: Block): Promise<{ blockId: string; height: number }> {
    // Validate block with Zod schema at runtime for extra safety
    const validatedBlock = BlockSchema.parse(block);

    // Get current height
    const currentHeight = await this.dbService.blocks.getCurrentHeight();

    // Validate all inputs exist and get total input value
    const allInputs = validatedBlock.transactions.flatMap(tx => tx.inputs);
    const inputValidation = await this.dbService.transactions.validateInputsExist(allInputs);

    // Validate block
    const validationError = validateBlock(validatedBlock, currentHeight, inputValidation);
    if (validationError) {
      throw new Error(`${validationError.code}: ${validationError.message}`);
    }

    // Insert block and update balances
    await this.dbService.blocks.insert(validatedBlock);

    return {
      blockId: validatedBlock.id,
      height: validatedBlock.height
    };
  }

  async getAddressBalance(address: string): Promise<number> {
    return await this.dbService.outputs.getAddressBalance(address);
  }

  // async getAllBlocks() {
  //   return await this.dbService.blocks.getAllBlocks();
  // }

  async rollbackToHeight(
    targetHeight: number
  ): Promise<{ targetHeight: number; previousHeight: number }> {
    const currentHeight = await this.dbService.blocks.getCurrentHeight();

    if (targetHeight > currentHeight) {
      throw new Error(
        `Cannot rollback to height ${targetHeight} which is higher than current height ${currentHeight}`
      );
    }

    if (currentHeight - targetHeight > AppConfig.MAX_ROLLBACK_BLOCKS) {
      throw new Error(
        `Cannot rollback more than ${AppConfig.MAX_ROLLBACK_BLOCKS} blocks from current height`
      );
    }

    await this.dbService.blocks.rollbackToHeight(targetHeight);

    return {
      targetHeight,
      previousHeight: currentHeight
    };
  }
}
