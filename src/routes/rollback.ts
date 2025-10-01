import type { FastifyInstance } from 'fastify';
import { BlockchainService } from '../services/blockchain';
import { ValidationError } from '../services/validation';

export async function registerRollbackRoutes(
  fastify: FastifyInstance,
  blockchainService: BlockchainService
): Promise<void> {
  fastify.post<{ Querystring: { height?: string } }>(
    '/rollback',
    async (request, reply) => {
      try {
        const heightParam = request.query.height;

        if (!heightParam) {
          reply.code(400).send({
            error: 'Height query parameter is required',
          });
          return;
        }

        const height = parseInt(heightParam, 10);

        if (isNaN(height)) {
          reply.code(400).send({
            error: 'Height must be a valid number',
          });
          return;
        }

        await blockchainService.rollback(height);

        reply.code(200).send({
          message: `Successfully rolled back to height ${height}`,
        });
      } catch (error) {
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
    }
  );
}
