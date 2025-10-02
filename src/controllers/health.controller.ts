import { FastifyRequest, FastifyReply } from 'fastify';
import { HealthResponseSchema } from '../schemas/blockchain.schema.ts';

export class FastifyHealthController {
  async getHealth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const response = HealthResponseSchema.parse({
      message: 'Blockchain Indexer API',
      endpoints: [
        'POST /blocks - Process a new block',
        'GET /balance/:address - Get address balance',
        'GET /getAllBlocks - Get all blocks',
        'POST /rollback - Rollback to specific height'
      ],
      status: 'healthy',
      timestamp: new Date().toISOString()
    });

    return reply.status(200).send(response);
  }
}
