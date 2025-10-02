import { Pool } from 'pg';

export class DatabaseConfig {
  private static instance: Pool;

  public static getInstance(): Pool {
    if (!DatabaseConfig.instance) {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL is required');
      }

      DatabaseConfig.instance = new Pool({
        connectionString: databaseUrl,
        max: process.env.DATABASE_POOL_MAX ? parseInt(process.env.DATABASE_POOL_MAX, 10) : 20,
        idleTimeoutMillis: process.env.DATABASE_IDLE_TIMEOUT_MS
          ? parseInt(process.env.DATABASE_IDLE_TIMEOUT_MS, 10)
          : 30000,
        connectionTimeoutMillis: process.env.DATABASE_CONNECTION_TIMEOUT_MS
          ? parseInt(process.env.DATABASE_CONNECTION_TIMEOUT_MS, 10)
          : 2000
      });
    }

    return DatabaseConfig.instance;
  }

  public static resetInstance(): void {
    if (DatabaseConfig.instance) {
      DatabaseConfig.instance.end();
      DatabaseConfig.instance = null as any;
    }
  }

  public static async testConnection(): Promise<void> {
    const pool = DatabaseConfig.getInstance();
    try {
      await pool.query('SELECT 1');
      console.log('Database connection successful');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }
}
