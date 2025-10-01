import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { blockSchema } from '../types/domain';
import { BlockchainService } from '../services/blockchain';
import { ValidationError } from '../services/validation';

export async function registerBlockRoutes(
  fastify: FastifyInstance,
  blockchainService: BlockchainService
): Promise<void> {
  fastify.post('/blocks', async (request, reply) => {
    try {
      // Validate request body
      const block = blockSchema.parse(request.body);

      // Process the block
      await blockchainService.processBlock(block);

      reply.code(201).send({ message: 'Block processed successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          error: 'Validation error',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      if (error instanceof ValidationError) {
        reply.code(400).send({
          error: error.message,
        });
        return;
      }

      fastify.log.error(error);
      reply.code(500).send({
        error: 'Internal server error',
      });
    }
  });
}
