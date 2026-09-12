const fs = require('fs');
const path = require('path');
const os = require('os');
const { describe, test, expect, beforeEach, afterEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 5 - Adversarial 02: Cryptographic Bit-Flip & Container Tamper Fuzzing', () => {
  let app;
  let tempBackupPath;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'AdversarialCryptoPassword2026!' });
    tempBackupPath = path.join(os.tmpdir(), `apex_fuzz_${Date.now()}.vault`);

    await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 50000, notes: 'Golden Payload' }
    });
    await app.vault_export_backup({ destinationPath: tempBackupPath });
  });

  afterEach(() => {
    if (fs.existsSync(tempBackupPath)) {
      try { fs.unlinkSync(tempBackupPath); } catch {}
    }
  });

  test('test_magic_bytes_corruption_is_rejected', async () => {
    const raw = fs.readFileSync(tempBackupPath);
    const corrupted = Buffer.from(raw);
    corrupted[0] = 0x58; // 'X' instead of 'A'
    fs.writeFileSync(tempBackupPath, corrupted);

    const freshApp = new ApexJournalTestInstance();
    let threw = false;
    try {
      await freshApp.vault_restore_backup({
        sourcePath: tempBackupPath,
        masterPassword: 'AdversarialCryptoPassword2026!'
      });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('magic bytes mismatch');
    }
    expect(threw).toBe(true);
  });

  test('test_salt_tampering_is_rejected', async () => {
    const raw = fs.readFileSync(tempBackupPath);
    const corrupted = Buffer.from(raw);
    corrupted[10] ^= 0xFF; // Flip bit in salt
    fs.writeFileSync(tempBackupPath, corrupted);

    const freshApp = new ApexJournalTestInstance();
    let threw = false;
    try {
      await freshApp.vault_restore_backup({
        sourcePath: tempBackupPath,
        masterPassword: 'AdversarialCryptoPassword2026!'
      });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('Failed to restore backup');
    }
    expect(threw).toBe(true);
  });

  test('test_auth_tag_tampering_is_rejected', async () => {
    const raw = fs.readFileSync(tempBackupPath);
    const corrupted = Buffer.from(raw);
    // Auth tag is located at offset 48..64
    corrupted[50] ^= 0x01;
    fs.writeFileSync(tempBackupPath, corrupted);

    const freshApp = new ApexJournalTestInstance();
    let threw = false;
    try {
      await freshApp.vault_restore_backup({
        sourcePath: tempBackupPath,
        masterPassword: 'AdversarialCryptoPassword2026!'
      });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('Failed to restore backup');
    }
    expect(threw).toBe(true);
  });

  test('test_ciphertext_body_tampering_is_rejected', async () => {
    const raw = fs.readFileSync(tempBackupPath);
    const corrupted = Buffer.from(raw);
    // Ciphertext is at offset 64+
    corrupted[70] ^= 0x55;
    fs.writeFileSync(tempBackupPath, corrupted);

    const freshApp = new ApexJournalTestInstance();
    let threw = false;
    try {
      await freshApp.vault_restore_backup({
        sourcePath: tempBackupPath,
        masterPassword: 'AdversarialCryptoPassword2026!'
      });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('Failed to restore backup');
    }
    expect(threw).toBe(true);
  });

  test('test_truncated_container_payload_is_rejected', async () => {
    const corrupted = Buffer.from("APEX_SHORT");
    fs.writeFileSync(tempBackupPath, corrupted);

    const freshApp = new ApexJournalTestInstance();
    let threw = false;
    try {
      await freshApp.vault_restore_backup({
        sourcePath: tempBackupPath,
        masterPassword: 'AdversarialCryptoPassword2026!'
      });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('too small');
    }
    expect(threw).toBe(true);
  });
});
