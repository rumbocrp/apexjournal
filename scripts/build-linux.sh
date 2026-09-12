#!/usr/bin/env bash
# Build the ApexJournal Linux desktop app (.deb + .AppImage).
# Run on Ubuntu 22.04/24.04 or Debian 12 after scripts/install-linux-deps.sh.
# Output: src-tauri/target/release/bundle/deb/*.deb and .../appimage/*.AppImage
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.cargo/bin:$PATH"

python3 "$ROOT/make_icons.py"
pnpm --dir "$ROOT" install
pnpm --dir "$ROOT" build
pnpm --dir "$ROOT" exec tauri build

echo "Build complete. Bundles in src-tauri/target/release/bundle/{deb,appimage}/"
