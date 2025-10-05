import { FastifyPluginAsync } from 'fastify';
import { FastifyHealthController } from '../controllers/health.controller.ts';
import { swaggerRouteSchemas } from '../config/swagger.config.ts';

const healthRoutes: FastifyPluginAsync = async fastify => {
  const controller = new FastifyHealthController();

  // GET / - Health check endpoint
  fastify.get('/', {
    schema: swaggerRouteSchemas.health,
    handler: controller.getHealth.bind(controller)
  });
};

export default healthRoutes;
