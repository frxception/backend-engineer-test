#!/bin/bash

# Test wrapper script - ensures .test.env is always loaded
# Usage: ./scripts/test-wrapper.sh [test files or patterns]

# Load test environment variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Run bun test with .test.env loaded
cd "$PROJECT_ROOT"
exec bun --env-file=.test.env test "$@"
