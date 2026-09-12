const fs = require('fs');
const path = require('path');
const { describe, test, expect, beforeEach, afterEach, ApexJournalTestInstance, TestDbManager, oracle } = require('../harness');

describe('Tier 1 - Feature 05: Disk Encryption Binary Entropy', () => {
  let app;
  let dbManager;
  let tmpDir;
  const password = 'CryptographicEntropy2026#Vault';

  beforeEach(async () => {
    dbManager = new TestDbManager();
    tmpDir = dbManager.createTempDirectory('entropy_test_');
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: password });
  });

  afterEach(() => {
    dbManager.cleanup();
  });

  test('test_encrypted_vault_binary_has_high_shannon_entropy', async () => {
    for (let i = 0; i < 50; i++) {
      await app.transaction_create({
        input: {
          date: '2026-08-' + String(i % 28 + 1).padStart(2, '0'),
          type: i % 2 === 0 ? 'INCOME' : 'EXPENSE',
          amount: 1000 + i * 150.25,
          currency: 'USD',
          notes: 'Sensitive financial contract note record #' + i + ' for Confidential Client Alpha'
        }
      });
    }

    const backupFile = path.join(tmpDir, 'entropy_test.vault');
    await app.vault_export_backup({ destinationPath: backupFile });

    const bytes = fs.readFileSync(backupFile);
    const ciphertext = bytes.subarray(4);
    const entropy = oracle.calculateShannonEntropy(ciphertext);

    expect(entropy).toBeGreaterThan(7.90);
  });

  test('test_sqlite_header_magic_bytes_absent', async () => {
    const backupFile = path.join(tmpDir, 'magic_check.vault');
    await app.vault_export_backup({ destinationPath: backupFile });

    const bytes = fs.readFileSync(backupFile);
    const sqliteHeader = Buffer.from('SQLite format 3\x00');
    expect(bytes.includes(sqliteHeader)).toBe(false);
  });

  test('test_no_plaintext_leakage_in_ciphertext', async () => {
    const secretKeyword = 'TOP_SECRET_OFFSHORE_RETAINER_ALPHA_999';
    await app.transaction_create({
      input: {
        date: '2026-08-30',
        type: 'INCOME',
        amount: 999999.00,
        currency: 'USD',
        notes: secretKeyword
      }
    });

    const backupFile = path.join(tmpDir, 'leakage_check.vault');
    await app.vault_export_backup({ destinationPath: backupFile });

    const fileContent = fs.readFileSync(backupFile, 'utf8');
    expect(fileContent.includes(secretKeyword)).toBe(false);
  });

  test('test_uniform_byte_distribution', async () => {
    for (let i = 0; i < 20; i++) {
      await app.journal_create({
        input: {
          title: 'Architecture Review #' + i,
          content: 'Detailed operating notes containing complex business algorithms and strategy.'
        }
      });
    }

    const backupFile = path.join(tmpDir, 'distribution_check.vault');
    await app.vault_export_backup({ destinationPath: backupFile });

    const bytes = fs.readFileSync(backupFile);
    const byteCounts = new Array(256).fill(0);
    for (const b of bytes.subarray(4)) {
      byteCounts[b]++;
    }

    const nonZeroCount = byteCounts.filter(c => c > 0).length;
    expect(nonZeroCount).toBeGreaterThan(240);
  });

  test('test_encrypted_file_structure_contains_valid_salt_and_iv', async () => {
    const backupFile = path.join(tmpDir, 'structure_check.vault');
    await app.vault_export_backup({ destinationPath: backupFile });

    const bytes = fs.readFileSync(backupFile);
    expect(bytes.length).toBeGreaterThanOrEqual(64);

    const magic = bytes.subarray(0, 4).toString('utf8');
    expect(magic).toBe('APEX');

    const salt = bytes.subarray(4, 36);
    expect(salt.length).toBe(32);

    const iv = bytes.subarray(36, 48);
    expect(iv.length).toBe(12);

    const tag = bytes.subarray(48, 64);
    expect(tag.length).toBe(16);
  });
});
