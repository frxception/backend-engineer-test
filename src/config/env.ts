import { z } from 'zod';

// Environment variable schema
const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database Configuration
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MAX: z.string().transform(Number).pipe(z.number().positive()).default('20'),
  DATABASE_IDLE_TIMEOUT_MS: z.string().transform(Number).pipe(z.number().positive()).default('30000'),
  DATABASE_CONNECTION_TIMEOUT_MS: z.string().transform(Number).pipe(z.number().positive()).default('2000'),

  // Server Configuration
  PORT: z.string().transform(Number).pipe(z.number().positive()).default('3000'),
  HOST: z.string().default('0.0.0.0'),

  // Logging Configuration
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Application Configuration
  BODY_LIMIT_MB: z.string().transform(Number).pipe(z.number().positive()).default('10'),
  REQUEST_TIMEOUT_MS: z.string().transform(Number).pipe(z.number().positive()).default('30000'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Load and validate environment variables
 * @throws {Error} if validation fails
 */
export function loadEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
      throw new Error(`Environment validation failed:\n${errors}`);
    }
    throw error;
  }
}

/**
 * Get a specific environment variable with type safety
 */
export function getEnv<K extends keyof Env>(key: K): Env[K] {
  const env = loadEnv();
  return env[key];
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}
