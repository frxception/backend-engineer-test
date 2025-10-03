#!/bin/bash

# Professional test database setup script

set -e

echo "🔧 Setting up isolated test environment..."

# Load test environment variables from .test.env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_ENV_FILE="$PROJECT_ROOT/.test.env"

if [ -f "$TEST_ENV_FILE" ]; then
    echo "📋 Loading configuration from .test.env..."
    # Export variables from .test.env
    set -a
    source "$TEST_ENV_FILE"
    set +a
else
    echo "⚠️  .test.env file not found at $TEST_ENV_FILE"
    echo "💡 Using default configuration..."
fi

# Configuration from .test.env
TEST_DB_NAME="${POSTGRES_DB:-test_mydatabase}"
MAIN_DB_NAME="${MAIN_DB_NAME:-mydatabase}"
DB_USER="${POSTGRES_USER:-myuser}"
DB_PASSWORD="${POSTGRES_PASSWORD:-mypassword}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DOCKER_SERVICE_NAME="${DOCKER_DB_SERVICE_NAME:-db-test}"  # Service name in docker-compose.test.yaml

# Function to check if database exists
db_exists() {
    docker-compose -f docker-compose.test.yaml exec -T "$DOCKER_SERVICE_NAME" psql -U "$DB_USER" -d postgres \
        -tAc "SELECT 1 FROM pg_database WHERE datname='$1';" 2>/dev/null | grep -q 1
}

# Function to create database if it doesn't exist
create_test_db() {
    if db_exists "$TEST_DB_NAME"; then
        echo "✅ Test database '$TEST_DB_NAME' already exists"
    else
        echo "🗄️ Creating test database '$TEST_DB_NAME'..."
        docker-compose -f docker-compose.test.yaml exec -T "$DOCKER_SERVICE_NAME" psql -U "$DB_USER" -d postgres \
            -c "CREATE DATABASE $TEST_DB_NAME;"
        echo "✅ Test database created successfully"
    fi
}

# Function to reset test database
reset_test_db() {
    echo "🧹 Resetting test database..."
    docker-compose -f docker-compose.test.yaml exec -T "$DOCKER_SERVICE_NAME" psql -U "$DB_USER" -d "$TEST_DB_NAME" \
        -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    echo "✅ Test database reset complete"
}

# Main execution
case "${1:-setup}" in
    "setup")
        echo "📊 Ensuring test database is running..."
        if ! docker-compose -f docker-compose.test.yaml ps "$DOCKER_SERVICE_NAME" | grep -q "Up"; then
            echo "🚀 Starting test database service..."
            docker-compose -f docker-compose.test.yaml up -d "$DOCKER_SERVICE_NAME"
            echo "⏳ Waiting for database to be ready..."
            sleep 5
        fi

        create_test_db
        ;;

    "reset")
        reset_test_db
        ;;

    "clean")
        echo "🗑️ Removing test database..."
        # Check if container is running before trying to drop database
        if docker-compose -f docker-compose.test.yaml ps "$DOCKER_SERVICE_NAME" | grep -q "Up"; then
            docker-compose -f docker-compose.test.yaml exec -T "$DOCKER_SERVICE_NAME" psql -U "$DB_USER" -d postgres \
                -c "DROP DATABASE IF EXISTS $TEST_DB_NAME;" 2>/dev/null || true
            echo "✅ Test database removed"
        else
            echo "⚠️  Test database container is not running, skipping database drop"
            echo "💡 The database will be recreated when the container starts next time"
        fi
        ;;

    *)
        echo "Usage: $0 {setup|reset|clean}"
        echo "  setup: Create test database if it doesn't exist"
        echo "  reset: Clear all data from test database"
        echo "  clean: Remove test database entirely"
        exit 1
        ;;
esac

echo "🎯 Test database configuration:"
echo "  DATABASE_URL: postgres://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$TEST_DB_NAME"
