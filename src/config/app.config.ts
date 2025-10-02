export const AppConfig = {
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '*',
  MAX_ROLLBACK_BLOCKS: process.env.MAX_ROLLBACK_BLOCKS
    ? parseInt(process.env.MAX_ROLLBACK_BLOCKS, 10)
    : 2000,
  RATE_LIMIT: {
    windowMs: process.env.RATE_LIMIT_WINDOW_MS
      ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10)
      : 15 * 60 * 1000, // default: 15 minutes
    max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : 100 // default: 100 requests per window
  }
};
