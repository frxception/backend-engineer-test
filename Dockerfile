# Production image
FROM oven/bun:1-slim

# Set working directory
WORKDIR /usr/src/app

# Copy package files first for better layer caching
COPY package.json bun.lockb ./

# Install production dependencies only (skip prepare scripts like husky)
RUN bun install --production --frozen-lockfile --ignore-scripts

# Copy application source code
COPY src ./src

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 bunuser && \
    chown -R bunuser:nodejs /usr/src/app

# Switch to non-root user
USER bunuser

# Expose the port (can be overridden)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD bun run -e 'fetch("http://localhost:3000/").then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))'

# Define the command to run the app
CMD ["bun", "start"]
