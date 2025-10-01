import Fastify from 'fastify';
import { Pool } from 'pg';
import { initializeDatabase } from './database/schema';
import { BlockchainRepository } from './database/repository';
import { BlockchainService } from './services/blockchain';
import { registerBlockRoutes } from './routes/blocks';
import { registerBalanceRoutes } from './routes/balance';
import { registerRollbackRoutes } from './routes/rollback';

const fastify = Fastify({
  logger: true,
  bodyLimit: 10485760, // 10MB limit for large block payloads
});

async function bootstrap() {
  fastify.log.info('Bootstrapping application...');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Initialize database connection pool
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
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
    port: 3000,
    host: '0.0.0.0',
  });
  app.log.info('Server listening on http://0.0.0.0:3000');
} catch (err) {
  console.error('Failed to start application:', err);
  process.exit(1);
}