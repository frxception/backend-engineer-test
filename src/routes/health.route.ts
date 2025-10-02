import { FastifyPluginAsync } from 'fastify';
import { FastifyHealthController } from '../controllers/health.controller.ts';

const healthRoutes: FastifyPluginAsync = async fastify => {
  const controller = new FastifyHealthController();

  // GET / - Health check endpoint
  fastify.get('/', {
    handler: controller.getHealth.bind(controller)
  });
};

export default healthRoutes;
