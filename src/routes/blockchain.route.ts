import { FastifyPluginAsync } from 'fastify';
import { FastifyBlockchainController } from '../controllers/blockchain.controller.ts';
import { ProcessBlockRequestSchema, GetBalanceParamsSchema } from '../schemas/blockchain.schema.ts';
import { createValidationHook, validateRollbackQuery } from '../plugins/validation.plugin.ts';
import { BlockchainService } from '../services/blockchain.service.ts';

const blockchainRoutes: FastifyPluginAsync = async fastify => {
  // Create blockchain controller instance
  const blockchainService = new BlockchainService(fastify.db);
  const controller = new FastifyBlockchainController(blockchainService);

  // POST /blocks - Process a new block
  fastify.post('/blocks', {
    preHandler: createValidationHook({
      body: ProcessBlockRequestSchema
    }),
    handler: controller.processBlock.bind(controller)
  });

  // GET /balance/:address - Get address balance
  fastify.get<{
    Body: any;
    Querystring: any;
    Params: { address: string };
  }>('/balance/:address', {
    preHandler: createValidationHook({
      params: GetBalanceParamsSchema
    }),
    handler: controller.getBalance.bind(controller)
  });

  // GET /getAllBlocks - Get all blocks from database
  fastify.get('/getAllBlocks', {
    handler: controller.getAllBlocks.bind(controller)
  });

  // POST /rollback - Rollback to specific height
  fastify.post<{
    Querystring: { height: number };
  }>('/rollback', {
    preHandler: validateRollbackQuery,
    handler: controller.rollback.bind(controller)
  });
};

export default blockchainRoutes;
