#!/bin/bash
# ApexJournal 4-Tier E2E Test Suite Runner
# Executes all test tiers (Tier 1: Feature Coverage, Tier 2: Boundary, Tier 3: Pairwise, Tier 4: Workloads)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo ""
echo "================================================================"
echo "          APEXJOURNAL E2E TEST RUNNER (4-TIER SUITE)           "
echo "================================================================"
echo "Project Root: $PROJECT_ROOT"
echo "Node Runtime: $(node -v)"
echo "Timestamp:    $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

cd "$PROJECT_ROOT"
node "$SCRIPT_DIR/runner.js" "$@"
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "[E2E RUNNER SUCCESS] All test assertions satisfied."
  exit 0
else
  echo "[E2E RUNNER FAILURE] One or more tests failed. Exit code: $EXIT_CODE"
  exit $EXIT_CODE
fi
