const fs = require('fs');
const path = require('path');
const { describe, test, expect, beforeEach, afterEach, ApexJournalTestInstance, TestDbManager } = require('../harness');

describe('Tier 2 - Boundary 05: Corrupted Backup Rejection', () => {
  let app;
  let dbManager;
  let tmpDir;

  beforeEach(async () => {
    dbManager = new TestDbManager();
    tmpDir = dbManager.createTempDirectory('corrupted_test_');
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'CorruptedTestPassword2026!' });
  });

  afterEach(() => {
    dbManager.cleanup();
  });

  test('test_restore_rejects_truncated_file', async () => {
    const truncPath = path.join(tmpDir, 'truncated.vault');
    fs.writeFileSync(truncPath, Buffer.from('APEX_TOO_SHORT'));

    const freshApp = new ApexJournalTestInstance();
    let threw = false;
    try {
      await freshApp.vault_restore_backup({ sourcePath: truncPath, masterPassword: 'pw' });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('too small');
    }
    expect(threw).toBe(true);
  });

  test('test_restore_rejects_invalid_magic_bytes', async () => {
    const invalidMagicPath = path.join(tmpDir, 'invalid_magic.vault');
    const dummyData = Buffer.concat([Buffer.from('FAKE'), Buffer.alloc(100, 0xAA)]);
    fs.writeFileSync(invalidMagicPath, dummyData);

    const freshApp = new ApexJournalTestInstance();
    let threw = false;
    try {
      await freshApp.vault_restore_backup({ sourcePath: invalidMagicPath, masterPassword: 'pw' });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('magic bytes mismatch');
    }
    expect(threw).toBe(true);
  });

  test('test_restore_rejects_tampered_iv', async () => {
    const backupFile = path.join(tmpDir, 'valid.vault');
    await app.vault_export_backup({ destinationPath: backupFile });

    const bytes = fs.readFileSync(backupFile);
    bytes[38] ^= 0x01; // Corrupt IV byte
    const tamperedFile = path.join(tmpDir, 'tampered_iv.vault');
    fs.writeFileSync(tamperedFile, bytes);

    const freshApp = new ApexJournalTestInstance();
    let threw = false;
    try {
      await freshApp.vault_restore_backup({ sourcePath: tamperedFile, masterPassword: 'CorruptedTestPassword2026!' });
    } catch (err) {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  test('test_restore_rejects_tampered_ciphertext', async () => {
    const backupFile = path.join(tmpDir, 'valid2.vault');
    await app.vault_export_backup({ destinationPath: backupFile });

    const bytes = fs.readFileSync(backupFile);
    bytes[bytes.length - 1] ^= 0x01; // Corrupt ciphertext byte
    const tamperedFile = path.join(tmpDir, 'tampered_cipher.vault');
    fs.writeFileSync(tamperedFile, bytes);

    const freshApp = new ApexJournalTestInstance();
    let threw = false;
    try {
      await freshApp.vault_restore_backup({ sourcePath: tamperedFile, masterPassword: 'CorruptedTestPassword2026!' });
    } catch (err) {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  test('test_restore_rejects_empty_file', async () => {
    const emptyFile = path.join(tmpDir, 'empty.vault');
    fs.writeFileSync(emptyFile, Buffer.alloc(0));

    const freshApp = new ApexJournalTestInstance();
    let threw = false;
    try {
      await freshApp.vault_restore_backup({ sourcePath: emptyFile, masterPassword: 'pw' });
    } catch (err) {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
