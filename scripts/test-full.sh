#!/bin/bash

# Comprehensive test runner for blockchain indexer
# This script sets up test environment, runs all tests, and provides detailed reporting

set -e

# Trap handler for cleanup on exit (success or failure)
cleanup_on_exit() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo -e "${YELLOW}⚠️  Tests failed or interrupted, running cleanup...${NC}"
    fi
    # Run cleanup script
    "${SCRIPT_DIR}/test-cleanup.sh" 2>/dev/null || true
    exit $exit_code
}

trap cleanup_on_exit EXIT INT TERM

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load test environment variables from .test.env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_ENV_FILE="$PROJECT_ROOT/.test.env"

if [ -f "$TEST_ENV_FILE" ]; then
    echo -e "${BLUE}📋 Loading configuration from .test.env...${NC}"
    # Export variables from .test.env
    set -a
    source "$TEST_ENV_FILE"
    set +a
else
    echo -e "${YELLOW}⚠️  .test.env file not found at $TEST_ENV_FILE${NC}"
    echo -e "${YELLOW}💡 Using default configuration...${NC}"
fi

# Test configuration from .test.env with defaults
TEST_DATABASE_URL=${TEST_DATABASE_URL:-"postgres://myuser:mypassword@localhost:5432/test_mydatabase"}
POSTGRES_USER=${POSTGRES_USER:-"myuser"}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-"mypassword"}
POSTGRES_DB=${POSTGRES_DB:-"test_mydatabase"}
MAIN_DB_NAME=${MAIN_DB_NAME:-"mydatabase"}
DOCKER_SERVICE_NAME="${DOCKER_DB_SERVICE_NAME:-db-test}"  # Service name in docker-compose.test.yaml


echo -e "${BLUE}🧪 Blockchain Indexer Test Suite${NC}"
echo -e "${BLUE}===================================${NC}"
echo ""

# Check if bun is available
if ! command -v bun &> /dev/null; then
    echo -e "${RED}❌ Bun is not installed. Please install Bun first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Bun is available${NC}"

# Check if PostgreSQL is available
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  psql command not found, skipping database connectivity test${NC}"
else
    echo -e "${GREEN}✅ PostgreSQL client is available${NC}"
fi

echo ""

# Function to start test database container
start_test_db() {
    echo -e "${YELLOW}🚀 Starting test database container...${NC}"

    # Check if container is already running
    if docker-compose -f docker-compose.test.yaml ps "$DOCKER_SERVICE_NAME" | grep -q "Up"; then
        echo -e "${GREEN}✅ Test database container is already running${NC}"
    else
        # Start the container
        docker-compose -f docker-compose.test.yaml up -d "$DOCKER_SERVICE_NAME"
        echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
        sleep 5
        echo -e "${GREEN}✅ Test database container started${NC}"
    fi
}

# Function to cleanup test database
cleanup_test_db() {
    echo -e "${YELLOW}🧹 Cleaning up test database...${NC}"

    # Note: Port 5433 is used because docker-compose.test.yaml maps container port 5432 to host port 5433
    local DB_PORT=5433

    # Create test database if it doesn't exist using variables from .test.env
    if command -v psql &> /dev/null; then
        psql "postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$DB_PORT/postgres" -c "DROP DATABASE IF EXISTS $POSTGRES_DB;" 2>/dev/null || true
        psql "postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:$DB_PORT/postgres" -c "CREATE DATABASE $POSTGRES_DB;" 2>/dev/null || echo -e "${YELLOW}⚠️  Could not create test database, continuing anyway...${NC}"
    else
        echo -e "${YELLOW}⚠️  psql not available, skipping database cleanup${NC}"
    fi
}

# Function to run a specific test file
run_test_file() {
    local test_file="$1"
    local test_name="$2"
    local use_env_file="$3"

    echo -e "${BLUE}📋 Running $test_name...${NC}"

    # Always use test wrapper to ensure .test.env is loaded
    if "${SCRIPT_DIR}/test-wrapper.sh" "$test_file" --timeout 30000; then
        echo -e "${GREEN}✅ $test_name passed${NC}"
        return 0
    else
        echo -e "${RED}❌ $test_name failed${NC}"
        return 1
    fi
}

# Initialize test environment
echo -e "${YELLOW}🔧 Setting up test environment...${NC}"
start_test_db
cleanup_test_db

# Check if database is reachable
echo -e "${BLUE}🔍 Testing database connectivity...${NC}"
if command -v pg_isready &> /dev/null && pg_isready -d "$TEST_DATABASE_URL" 2>/dev/null; then
    echo -e "${GREEN}✅ Test database is reachable${NC}"
elif command -v psql &> /dev/null; then
    # Try to connect directly
    if psql "$TEST_DATABASE_URL" -c "SELECT 1;" &>/dev/null; then
        echo -e "${GREEN}✅ Test database is reachable${NC}"
    else
        echo -e "${RED}❌ Test database is not reachable${NC}"
        echo -e "${YELLOW}💡 Make sure PostgreSQL is running and accessible at: $TEST_DATABASE_URL${NC}"
        echo -e "${YELLOW}💡 You can start it with: docker-compose up -d db${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Cannot test database connectivity, proceeding anyway...${NC}"
fi

echo ""

# Test counters
total_tests=0
passed_tests=0
failed_tests=0

# Run unit tests (utils.spec.ts) - no env file needed
echo -e "${BLUE}🔧 Running Unit Tests${NC}"
echo -e "${BLUE}===================${NC}"
if run_test_file "spec/utils.spec.ts" "Utils Unit Tests" "false"; then
    ((passed_tests++))
else
    ((failed_tests++))
fi
((total_tests++))
echo ""

# Run database tests (index.spec.ts) - use env file
echo -e "${BLUE}🗄️  Running Database Tests${NC}"
echo -e "${BLUE}=========================${NC}"
if run_test_file "spec/index.spec.ts" "Database Integration Tests" "true"; then
    ((passed_tests++))
else
    ((failed_tests++))
fi
((total_tests++))
echo ""

# Check if we need to start a temporary server for API tests
echo -e "${BLUE}🌐 Running API Integration Tests${NC}"
echo -e "${BLUE}===============================${NC}"

# For API tests, we need to make sure no server is already running
if lsof -i :3000 &>/dev/null; then
    echo -e "${YELLOW}⚠️  Port 3000 is already in use. API tests may fail.${NC}"
    echo -e "${YELLOW}💡 Please stop any running servers or use a different port.${NC}"
fi

if run_test_file "spec/api.spec.ts" "API Integration Tests" "true"; then
    ((passed_tests++))
else
    ((failed_tests++))
fi
((total_tests++))
echo ""

# Final report
echo -e "${BLUE}📊 Test Results Summary${NC}"
echo -e "${BLUE}======================${NC}"
echo ""

if [ $failed_tests -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    echo -e "${GREEN}✅ $passed_tests/$total_tests test suites passed${NC}"
    echo ""
    echo -e "${GREEN}🚀 Your blockchain indexer is ready for deployment!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    echo -e "${RED}✅ $passed_tests/$total_tests test suites passed${NC}"
    echo -e "${RED}❌ $failed_tests/$total_tests test suites failed${NC}"
    echo ""
    echo -e "${YELLOW}💡 Check the output above for details on failed tests${NC}"
    echo -e "${YELLOW}💡 Common issues:${NC}"
    echo -e "${YELLOW}   - Database not running: docker-compose up -d db${NC}"
    echo -e "${YELLOW}   - Port 3000 in use: Stop other servers${NC}"
    echo -e "${YELLOW}   - Missing dependencies: bun install${NC}"
    exit 1
fi
