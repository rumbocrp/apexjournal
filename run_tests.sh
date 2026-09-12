#!/usr/bin/env bash
set -e
export PATH="$HOME/.cargo/bin:/Users/nuevo/Library/pnpm/bin:/Users/nuevo/.local/bin:$PATH"

python3 "$(dirname "$0")/make_icons.py"

echo "=== Running Cargo Check ==="
cargo check --manifest-path src-tauri/Cargo.toml

echo "=== Running Cargo Test (Backend Unit & Integration) ==="
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture

echo "=== Running 4-Tier E2E Test Suite ==="
bash tests/e2e_runner.sh

echo "=== Running Empirical Shortcuts & Auth Tests ==="
node tests/empirical_m3_shortcuts_and_auth_test.js
node tests/empirical_hotkey_system_test.js

echo "=== Running Frontend Build Check ==="
node node_modules/typescript/bin/tsc && node node_modules/vite/bin/vite.js build

echo "=== All ApexJournal Backend & Frontend Verification Passed ==="
