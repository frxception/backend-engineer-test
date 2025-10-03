#!/bin/bash

# Test cleanup script - cleans up resources after tests
# This ensures no hanging processes, open ports, or orphaned containers

set -e

# Colors for output
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load test environment variables from .test.env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_ENV_FILE="$PROJECT_ROOT/.test.env"

if [ -f "$TEST_ENV_FILE" ]; then
    # Export variables from .test.env
    set -a
    source "$TEST_ENV_FILE"
    set +a
fi

# Configuration from .test.env with defaults
API_PORT=${PORT:-3001}
DOCKER_CONTAINER_NAME=${DOCKER_CONTAINER_NAME:-"test-db"}

echo -e "${BLUE}🧹 Cleaning up test resources...${NC}"

# 1. Kill any processes using the test API port
if lsof -ti:$API_PORT &>/dev/null; then
    echo -e "${YELLOW}🔪 Killing processes on port $API_PORT...${NC}"
    lsof -ti:$API_PORT | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✅ Port $API_PORT freed${NC}"
else
    echo -e "${GREEN}✅ Port $API_PORT is already free${NC}"
fi

# 2. Kill any hanging bun test processes
if pgrep -f "bun.*test" &>/dev/null; then
    echo -e "${YELLOW}🔪 Killing hanging bun test processes...${NC}"
    pkill -f "bun.*test" 2>/dev/null || true
    echo -e "${GREEN}✅ Bun test processes cleaned up${NC}"
else
    echo -e "${GREEN}✅ No hanging bun test processes${NC}"
fi

# 3. Clean up Docker test containers if they exist
if command -v docker &>/dev/null; then
    # Check if docker-compose.test.yaml services are running
    if docker-compose -f docker-compose.test.yaml ps -q 2>/dev/null | grep -q .; then
        echo -e "${YELLOW}🐳 Stopping Docker test containers...${NC}"
        docker-compose -f docker-compose.test.yaml down -v 2>/dev/null || true
        echo -e "${GREEN}✅ Docker test containers stopped${NC}"
    else
        echo -e "${GREEN}✅ No Docker test containers running${NC}"
    fi

    # Clean up any orphaned test containers
    if docker ps -a --filter "name=test" --format "{{.Names}}" | grep -q .; then
        echo -e "${YELLOW}🐳 Cleaning up orphaned test containers...${NC}"
        docker ps -a --filter "name=test" --format "{{.Names}}" | xargs docker rm -f 2>/dev/null || true
        echo -e "${GREEN}✅ Orphaned test containers removed${NC}"
    fi
fi

# 4. Close any hanging database connections (optional - can be aggressive)
# Uncomment if you want to force-close all connections to test database
# if command -v psql &>/dev/null && [ -n "$TEST_DATABASE_URL" ]; then
#     echo -e "${YELLOW}🔌 Closing database connections...${NC}"
#     POSTGRES_USER=${POSTGRES_USER:-myuser}
#     POSTGRES_DB=${POSTGRES_DB:-test_mydatabase}
#     psql -U "$POSTGRES_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$POSTGRES_DB';" 2>/dev/null || true
#     echo -e "${GREEN}✅ Database connections closed${NC}"
# fi

echo ""
echo -e "${GREEN}✨ Test cleanup complete!${NC}"
echo -e "${BLUE}💡 All test resources have been cleaned up${NC}"
