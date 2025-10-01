import type { FastifyInstance } from 'fastify';
import { BlockchainService } from '../services/blockchain';

export async function registerBalanceRoutes(
  fastify: FastifyInstance,
  blockchainService: BlockchainService
): Promise<void> {
  fastify.get<{ Params: { address: string } }>(
    '/balance/:address',
    async (request, reply) => {
      try {
        const { address } = request.params;

        if (!address || address.trim() === '') {
          reply.code(400).send({
            error: 'Address parameter is required',
          });
          return;
        }

        const balance = await blockchainService.getBalance(address);

        reply.code(200).send({
          address,
          balance,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          error: 'Internal server error',
        });
      }
    }
  );
}
