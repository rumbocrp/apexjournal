# ApexJournal

Local-first, AES-256 encrypted desktop operating and financial journal. Combines multi-currency PnL, cumulative equity curve, win rate, and accounts-receivable aging analytics with a case pipeline (kanban), milestones, and a Markdown operations diary.

Stack: Tauri v2 + Rust (SQLCipher, Argon2id, zeroize) + React 18 / Vite / TypeScript / Tailwind CSS.

## 1. Linux prerequisites

Supported: Ubuntu 22.04 / 24.04, Debian 12 (x86_64).

Install everything with one command chain:

```bash
sudo bash scripts/install-linux-deps.sh
```

This installs system libraries (WebKitGTK, GTK, OpenSSL, appindicator, librsvg, xdotool), the Rust toolchain, Node.js LTS + pnpm, then the Python (`requirements.txt`) and Node dependencies. Python-only tooling can be installed alone with:

```bash
pip install -r requirements.txt
```

## 2. Build the Linux app

```bash
bash scripts/build-linux.sh
```

Output bundles:

- `src-tauri/target/release/bundle/deb/ApexJournal_0.1.0_amd64.deb`
- `src-tauri/target/release/bundle/appimage/ApexJournal_0.1.0_amd64.AppImage`

The build must run on Linux. Tauri desktop bundles cannot be cross-compiled from macOS.

## 3. Install and run

```bash
sudo dpkg -i src-tauri/target/release/bundle/deb/ApexJournal_0.1.0_amd64.deb
apex-journal
```

Or run the AppImage directly:

```bash
chmod +x src-tauri/target/release/bundle/appimage/ApexJournal_0.1.0_amd64.AppImage
./src-tauri/target/release/bundle/appimage/ApexJournal_0.1.0_amd64.AppImage
```

For development (hot reload):

```bash
pnpm dev
```

## 4. Tests

```bash
bash run_tests.sh
```

Runs `cargo check`, the Rust test suite, the Tier 1-4 E2E suite, empirical frontend checks, and the production frontend build.

## 5. Notes

- Vault data lives under the OS app-data directory (`~/.local/share/com.apexjournal.app/vault/` on Linux) and is AES-256 encrypted at rest. The master password never touches disk.
- Biometric unlock is macOS-only (Touch ID / Keychain). On Linux the app uses the built-in mock key store, so `vault_unlock_biometric` reports unavailable and password unlock is the supported path.
- Icons are generated from `make_icons.py` (requires `Pillow` from `requirements.txt`) and are committed under `src-tauri/icons/` and `public/`.
