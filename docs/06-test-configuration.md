# Test Configuration Guide

## Overview

This project uses a clean, environment-based test configuration that separates test settings from production code and provides consistent test execution across different environments.

## Configuration Structure

```
.test.env                     # Test environment variables (not committed)
.test.env.example             # Template for test configuration (committed)
package.json                  # Test scripts that use .test.env
scripts/test-wrapper.sh       # Loads .test.env and runs tests
scripts/test-db-setup.sh      # Database setup automation
scripts/test-cleanup.sh       # Resource cleanup after tests
scripts/test-full.sh          # Full test suite runner
docker-compose.test.yaml      # Isolated test database configuration
```

## Test Environment Variables

### .test.env

All test-specific configuration is centralized in the `.test.env` file:

```bash
# Test environment configuration
NODE_ENV=test

# PostgreSQL Configuration (for docker-compose.test.yaml)
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mypassword
POSTGRES_DB=test_mydatabase
POSTGRES_PORT=5432

MAIN_DB_NAME=mydatabase

# Test database (isolated from development on port 5433)
TEST_DATABASE_URL=postgres://myuser:mypassword@localhost:5433/test_mydatabase
DATABASE_URL=postgres://myuser:mypassword@localhost:5433/test_mydatabase

# Test-specific optimizations
DATABASE_POOL_MAX=10                  # Smaller pool for tests
DATABASE_IDLE_TIMEOUT_MS=10000       # Shorter idle timeout
DATABASE_CONNECTION_TIMEOUT_MS=2000  # Faster timeouts

# Server Configuration
PORT=3001                            # Different port from development
HOST=0.0.0.0

# Docker db service name for testing
DOCKER_DB_SERVICE_NAME=db-test

# CORS Configuration
ALLOWED_ORIGINS=*

# Rate Limiting (relaxed for tests)
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW_MS=60000

# Blockchain Configuration
MAX_ROLLBACK_BLOCKS=100          # Smaller rollback limit for faster tests
```

**Key Points:**

- Test database runs on **port 5433** (isolated from development on port 5432)
- Both `TEST_DATABASE_URL` and `DATABASE_URL` point to the test database
- Server runs on port 3001 during tests (3000 for development)
- Relaxed rate limiting for test performance

### Benefits of This Approach

1. **Centralized Configuration**: All test settings in one place
2. **Environment Isolation**: Separate from development/production
3. **Version Control Friendly**: template file (.example) is committed, actual file is not
4. **Team Consistency**: Everyone uses the same test configuration
5. **CI/CD Ready**: Easy to override for different environments

## Test Scripts

### Package.json Scripts

```json
{
  "test": "npm run test:db:setup && ./scripts/test-wrapper.sh spec/ --timeout 60000 && npm run test:nuke",
  "test:db:setup": "./scripts/test-db-setup.sh setup",
  "test:db:reset": "./scripts/test-db-setup.sh reset",
  "test:db:drop": "./scripts/test-db-setup.sh clean",
  "test:cleanup": "./scripts/test-cleanup.sh",
  "test:nuke": "npm run test:cleanup && npm run test:db:drop",
  "test:unit": "./scripts/test-wrapper.sh spec/utils.spec.ts --timeout 10000",
  "test:db": "npm run test:db:setup && ./scripts/test-wrapper.sh spec/index.spec.ts --timeout 30000 && npm run test:nuke",
  "test:api": "npm run test:db:setup && ./scripts/test-wrapper.sh spec/api.spec.ts --timeout 60000 && npm run test:nuke",
  "test:ci": "docker-compose -f docker-compose.test.yaml up -d db-test && sleep 5 && ./scripts/test-wrapper.sh spec/ --timeout 60000 && npm run test:nuke",
  "test:full": "./scripts/test-full.sh"
}
```

**Script Changes:**

- All test commands now use `./scripts/test-wrapper.sh` which loads `.test.env`
- New `test:nuke` script for complete cleanup (stops containers, removes test DB)
- New `test:cleanup` for resource cleanup (ports, processes, containers)
- New `test:ci` for CI/CD environments

### Script Breakdown

| Script      | Purpose                    | Environment File | Database Required  | Cleanup |
| ----------- | -------------------------- | ---------------- | ------------------ | ------- |
| `test`      | All tests (36 tests)       | ✅ .test.env     | ✅ Yes (port 5433) | ✅ Yes  |
| `test:db`   | Database tests (13 tests)  | ✅ .test.env     | ✅ Yes (port 5433) | ✅ Yes  |
| `test:api`  | API integration (23 tests) | ✅ .test.env     | ✅ Yes (port 5433) | ✅ Yes  |
| `test:unit` | Unit tests only            | ✅ .test.env     | ❌ No              | ❌ No   |
| `test:ci`   | CI/CD pipeline tests       | ✅ .test.env     | ✅ Yes (port 5433) | ✅ Yes  |
| `test:full` | Complete test suite        | ✅ .test.env     | ✅ Yes (port 5433) | ✅ Yes  |

## Database Setup

### Automated Setup

The `test-db-setup.sh` script handles database preparation:

```bash
# Create test database if it doesn't exist
./scripts/test-db-setup.sh setup

# Reset test database (clear all data)
./scripts/test-db-setup.sh reset

# Remove test database entirely
./scripts/test-db-setup.sh clean
```

### Manual Setup

If you prefer manual setup:

```bash
# Connect to PostgreSQL
docker-compose exec db psql -U myuser -d mydatabase

# Create test database
CREATE DATABASE test_mydatabase;

# Verify it exists
\l
```

## Running Tests

### Quick Start

```bash
# First time setup
cp .test.env.example .test.env

# Ensure test database is running
docker-compose -f docker-compose.test.yaml up -d db-test

# Run all tests
npm test

# Run specific test types
npm run test:unit    # Fast unit tests only
npm run test:db      # Database integration tests (13 tests)
npm run test:api     # Full API integration tests (23 tests)
```

**Important:** Always use `npm test` or `npm run test:*` commands. Do NOT run `bun test` directly as it won't load the `.test.env` file.

### Development Workflow

```bash
# During development
npm run test:unit    # Quick feedback loop

# Before committing
npm test             # Full test suite

# Reset test data if needed
npm run test:reset
```

## Environment Isolation

### Why Separate Test Database?

| Scenario            | Shared Database (❌)      | Separate Test Database (✅)  |
| ------------------- | ------------------------- | ---------------------------- |
| Running tests       | Destroys dev data         | Safe isolation               |
| Multiple developers | Conflicts and failures    | Everyone works independently |
| CI/CD               | Can't run automated tests | Full automation possible     |
| Debugging           | Fear of breaking data     | Test freely                  |

### Database URLs by Environment

```bash
# Development (.env)
DATABASE_URL=postgres://myuser:mypassword@localhost:5432/mydatabase

# Testing (.test.env) - IMPORTANT: Different port!
TEST_DATABASE_URL=postgres://myuser:mypassword@localhost:5433/test_mydatabase
DATABASE_URL=postgres://myuser:mypassword@localhost:5433/test_mydatabase

# Production (would be different server)
DATABASE_URL=postgres://prod_user:secure_pass@prod-db:5432/production_db
```

**Critical Note:** The test database runs on **port 5433** via `docker-compose.test.yaml` to avoid conflicts with the development database on port 5432.

## Configuration Best Practices

### 1. Environment File Management

```bash
# ✅ Good: Use template file
.test.env.example     # Committed to git (template)
.test.env            # Not committed (actual values)

# ❌ Bad: Hardcode in scripts
TEST_DATABASE_URL=postgres://... npm test

# ✅ Good: Use test wrapper
./scripts/test-wrapper.sh spec/

# ❌ Bad: Run bun test directly (doesn't load .test.env)
bun test spec/
```

### 2. Test Optimization

```bash
# ✅ Good: Optimized for test speed
DB_POOL_SIZE=5              # Smaller pool
LOG_LEVEL=error            # Less logging
DISABLE_RATE_LIMITING=true # No throttling

# ❌ Bad: Production settings in tests
DB_POOL_SIZE=20            # Too many connections
LOG_LEVEL=info            # Noisy output
```

### 3. Script Organization

```bash
# ✅ Good: Specific scripts for specific needs
npm run test:unit          # Unit tests only
npm run test:db           # Database tests only
npm run test:api          # API tests only

# ❌ Bad: One size fits all
npm test                  # Always runs everything (slow feedback)
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: myuser
          POSTGRES_PASSWORD: mypassword
          POSTGRES_DB: test_mydatabase
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Create test.env
        run: cp test.env.example test.env

      - name: Run tests
        env:
          TEST_DATABASE_URL: postgres://myuser:mypassword@localhost:5432/test_mydatabase
        run: npm test
```

### Docker Compose for CI

```yaml
# docker-compose.test.yml
version: '3.8'
services:
  test-db:
    image: postgres:15
    environment:
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
      POSTGRES_DB: test_mydatabase
    tmpfs:
      - /var/lib/postgresql/data # In-memory for speed
```

## Troubleshooting

### Common Issues

1. **test.env file missing**

   ```bash
   # Solution: Create from template
   cp test.env.example test.env
   ```

2. **Database connection errors**

   ```bash
   # Solution: Start database
   docker-compose up -d db
   npm run test:setup
   ```

3. **Port conflicts**

   ```bash
   # Solution: Check what's using the port
   lsof -i :3000
   lsof -i :5432
   ```

4. **Stale test data**
   ```bash
   # Solution: Reset test database
   npm run test:reset
   ```

### Debugging Tests

```bash
# Debug specific test file
bun --env-file=test.env test spec/api.spec.ts --verbose

# Debug with environment variables
DEBUG=* bun --env-file=test.env test spec/index.spec.ts

# Check environment loading
node -p "require('dotenv').config({path: 'test.env'}); process.env"
```

This configuration provides a robust, maintainable test setup that scales from local development to production CI/CD pipelines.
