import { createApp } from './app';
import { AppConfig } from './config/app.config.ts';

async function startServer() {
  try {
    const app = await createApp();

    const address = await app.listen({
      port: Number(AppConfig.PORT),
      host: AppConfig.HOST
    });

    console.log(`🚀 Fastify server listening at ${address}`);
    console.log(`📊 Environment: ${AppConfig.NODE_ENV}`);
    console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n📴 Received ${signal}. Starting graceful shutdown...`);

      try {
        await app.close();
        console.log('✅ Fastify server closed successfully');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();
