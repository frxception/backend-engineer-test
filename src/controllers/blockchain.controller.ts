import { FastifyRequest, FastifyReply } from 'fastify';
import { BlockchainService } from '../services/blockchain.service.ts';
import {
  Block,
  ProcessBlockRequest,
  GetBalanceParams,
  RollbackQuery
} from '../schemas/blockchain.schema.ts';
import { ValidationError } from '../plugins/validation.plugin.ts';

export class FastifyBlockchainController {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly blockchainService: BlockchainService) {}

  async processBlock(
    request: FastifyRequest<{
      Body: ProcessBlockRequest;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const block: Block = request.body;

      const result = await this.blockchainService.processBlock(block);

      return reply.status(200).send({
        message: 'Block processed successfully',
        blockId: result.blockId,
        height: result.height
      });
    } catch (error) {
      const apiError = error as Error;

      if (apiError.message.includes('INVALID_HEIGHT')) {
        throw new ValidationError(apiError.message.split(': ')[1], 'INVALID_HEIGHT');
      }

      if (apiError.message.includes('INVALID_BLOCK_ID')) {
        throw new ValidationError(apiError.message.split(': ')[1], 'INVALID_BLOCK_ID');
      }

      if (apiError.message.includes('INVALID_INPUTS')) {
        throw new ValidationError(apiError.message.split(': ')[1], 'INVALID_INPUTS');
      }

      if (apiError.message.includes('INVALID_BALANCE')) {
        throw new ValidationError(apiError.message.split(': ')[1], 'INVALID_BALANCE');
      }

      // Re-throw as generic error
      const err = new Error('Failed to process block');
      (err as any).statusCode = 500;
      (err as any).code = 'INTERNAL_ERROR';
      throw err;
    }
  }

  async getBalance(
    request: FastifyRequest<{
      Params: GetBalanceParams;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { address } = request.params;

      const balance = await this.blockchainService.getAddressBalance(address);

      return reply.status(200).send({
        address,
        balance
      });
    } catch {
      const err = new Error('Failed to get balance');
      (err as any).statusCode = 500;
      (err as any).code = 'INTERNAL_ERROR';
      throw err;
    }
  }

  // async getAllBlocks(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  //   try {
  //     const blocks = await this.blockchainService.getAllBlocks();
  //
  //     return reply.status(200).send({
  //       blocks,
  //       count: blocks.length
  //     });
  //   } catch {
  //     const err = new Error('Failed to get blocks');
  //     (err as any).statusCode = 500;
  //     (err as any).code = 'INTERNAL_ERROR';
  //     throw err;
  //   }
  // }

  async rollback(
    request: FastifyRequest<{
      Querystring: RollbackQuery;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const targetHeight = Number(request.query.height);

      const result = await this.blockchainService.rollbackToHeight(targetHeight);

      return reply.status(200).send({
        message: 'Rollback completed successfully',
        targetHeight: result.targetHeight,
        previousHeight: result.previousHeight
      });
    } catch (error) {
      const apiError = error as Error;

      if (apiError.message.includes('Cannot rollback to height')) {
        throw new ValidationError(apiError.message, 'INVALID_HEIGHT');
      }

      if (apiError.message.includes('Cannot rollback more than')) {
        throw new ValidationError(apiError.message, 'ROLLBACK_TOO_FAR');
      }

      const err = new Error('Failed to rollback');
      (err as any).statusCode = 500;
      (err as any).code = 'INTERNAL_ERROR';
      throw err;
    }
  }
}
