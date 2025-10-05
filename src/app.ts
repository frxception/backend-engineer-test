import fastify, { FastifyInstance } from 'fastify';
import { DatabaseConfig } from './config/database.config.ts';
import { DatabaseService } from './models';
import { AppConfig } from './config/app.config.ts';
import { swaggerOptions, swaggerUiOptions } from './config/swagger.config.ts';

// Check if pino-pretty is available (dev dependency)
function getPinoTransport() {
  if (process.env.NODE_ENV !== 'development') {
    return undefined;
  }

  try {
    // Try to require pino-pretty to check if it's available
    require.resolve('pino-pretty');
    return {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    };
  } catch {
    // pino-pretty not available (production build), use default logger
    return undefined;
  }
}

export async function createApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'error' : 'info',
      transport: getPinoTransport()
    }
  });

  // Set custom schema compilers to disable automatic validation
  // Schemas are kept only for Swagger documentation
  app.setValidatorCompiler(() => {
    return () => true; // Always valid - we use Zod validation in preHandlers
  });

  app.setSerializerCompiler(() => {
    return data => JSON.stringify(data); // Standard JSON serialization
  });

  // Register security plugins (this is like the middleware part of the api)
  await app.register(import('@fastify/helmet'), {
    global: true
  });

  await app.register(import('@fastify/cors'), {
    origin: AppConfig.ALLOWED_ORIGINS === '*' ? true : AppConfig.ALLOWED_ORIGINS.split(','),
    credentials: true
  });

  await app.register(import('@fastify/rate-limit'), {
    max: AppConfig.RATE_LIMIT.max,
    timeWindow: AppConfig.RATE_LIMIT.windowMs,
    errorResponseBuilder: function (request, context) {
      return {
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests from this IP, please try again later with this request: ${JSON.stringify(request)}`,
        expiresIn: Math.round(context.ttl / 1000)
      };
    }
  });

  // Register form body parser
  await app.register(import('@fastify/formbody'));

  // Register validation plugin
  await app.register(import('./plugins/validation.plugin.ts'));

  // Initialize database
  // Reset singleton instance if in test environment to ensure clean state
  if (process.env.NODE_ENV === 'test' || process.env.DATABASE_URL?.includes('test_mydatabase')) {
    DatabaseConfig.resetInstance();
  }

  await DatabaseConfig.testConnection();
  const pool = DatabaseConfig.getInstance();
  const dbService = new DatabaseService(pool);

  // TODO: Need to refactor this coz this ugly!!!
  // Clean database if in test environment
  if (process.env.NODE_ENV === 'test' || process.env.DATABASE_URL?.includes('test_mydatabase')) {
    await pool.query('DROP TABLE IF EXISTS address_balances CASCADE');
    await pool.query('DROP TABLE IF EXISTS outputs CASCADE');
    await pool.query('DROP TABLE IF EXISTS transactions CASCADE');
    await pool.query('DROP TABLE IF EXISTS blocks CASCADE');
  }

  await dbService.initializeTables();
  console.log('Database tables initialized');

  // Make database service available to routes
  app.decorate('db', dbService);

  // Close database pool on server shutdown
  app.addHook('onClose', async () => {
    console.log('Closing database connection pool...');
    await pool.end();
    console.log('Database connection pool closed');
  });

  // Register Swagger for API documentation (must be before routes)
  if (process.env.NODE_ENV !== 'test') {
    await app.register(import('@fastify/swagger'), swaggerOptions);
    await app.register(import('@fastify/swagger-ui'), swaggerUiOptions);
  }

  // Register routes
  await app.register(import('./routes/index'), { prefix: '/' });

  // Global error handler
  app.setErrorHandler(async (error, request, reply) => {
    const statusCode = error.statusCode || 500;
    const errorCode = (error as any).code || 'INTERNAL_ERROR';
    const message = error.message || 'Internal server error';

    request.log.error({ error, statusCode, errorCode }, `Error ${statusCode}: ${message}`);

    return reply.status(statusCode).send({
      error: errorCode,
      message
    });
  });

  // 404 handler
  app.setNotFoundHandler(async (request, reply) => {
    return reply.status(404).send({
      error: 'NOT_FOUND',
      message: 'Endpoint not found'
    });
  });

  // @ts-ignore
  return app;
}

// Extend Fastify types
declare module 'fastify' {
  // eslint-disable-next-line no-unused-vars
  interface FastifyInstance {
    db: DatabaseService;
  }
}
