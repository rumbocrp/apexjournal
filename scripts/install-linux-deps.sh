#!/usr/bin/env bash
# Install all ApexJournal Linux build dependencies with a single command chain.
# Usage: sudo bash scripts/install-linux-deps.sh   (Ubuntu 22.04 / 24.04, Debian 12)
set -euo pipefail

sudo apt-get update && sudo apt-get install -y \
  build-essential curl wget file python3 python3-pip pkg-config \
  libssl-dev libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev

# Rust toolchain (skip if already installed)
if ! command -v cargo >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
fi

# Node.js LTS + pnpm (skip steps for tools already installed)
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
if ! command -v pnpm >/dev/null 2>&1; then
  sudo npm install -g pnpm
fi

# Python + Node project dependencies (single command each)
pip3 install -r "$(dirname "$0")/../requirements.txt"
pnpm --dir "$(dirname "$0")/.." install

echo "All Linux dependencies installed."
