import Fastify from 'fastify';
import { Pool } from 'pg';
import { initializeDatabase } from './database/schema';
import { BlockchainRepository } from './database/repository';
import { BlockchainService } from './services/blockchain';
import { registerBlockRoutes } from './routes/blocks';
import { registerBalanceRoutes } from './routes/balance';
import { registerRollbackRoutes } from './routes/rollback';
import { loadEnv } from './config/env';

// Load and validate environment variables
const env = loadEnv();

const fastify = Fastify({
  logger: {
    level: env.LOG_LEVEL,
  },
  bodyLimit: env.BODY_LIMIT_MB * 1024 * 1024, // Convert MB to bytes
  requestTimeout: env.REQUEST_TIMEOUT_MS,
});

async function bootstrap() {
  fastify.log.info(`Bootstrapping application in ${env.NODE_ENV} mode...`);

  // Initialize database connection pool
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
  });

  // Test database connection
  try {
    await pool.query('SELECT NOW()');
    fastify.log.info('Database connection established');
  } catch (error) {
    fastify.log.error('Failed to connect to database:', error);
    throw error;
  }

  // Initialize database schema
  await initializeDatabase(pool);
  fastify.log.info('Database schema initialized');

  // Initialize services
  const repository = new BlockchainRepository(pool);
  const blockchainService = new BlockchainService(repository);

  // Register routes
  await registerBlockRoutes(fastify, blockchainService);
  await registerBalanceRoutes(fastify, blockchainService);
  await registerRollbackRoutes(fastify, blockchainService);

  fastify.log.info('Routes registered');

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Graceful shutdown
  const gracefulShutdown = async () => {
    fastify.log.info('Received shutdown signal, closing connections...');
    await fastify.close();
    await pool.end();
    fastify.log.info('Connections closed, exiting');
    process.exit(0);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  return fastify;
}

try {
  const app = await bootstrap();
  await app.listen({
    port: env.PORT,
    host: env.HOST,
  });
  app.log.info(`Server listening on http://${env.HOST}:${env.PORT}`);
} catch (err) {
  console.error('Failed to start application:', err);
  process.exit(1);
}