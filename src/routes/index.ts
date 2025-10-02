import { FastifyPluginAsync } from 'fastify';
import blockchainRoutes from './blockchain.route.ts';
import healthRoutes from './health.route.ts';

const routes: FastifyPluginAsync = async fastify => {
  // Register health routes at root
  await fastify.register(healthRoutes);

  // Register blockchain routes under /api prefix
  await fastify.register(blockchainRoutes, { prefix: '/api' });
};

export default routes;
