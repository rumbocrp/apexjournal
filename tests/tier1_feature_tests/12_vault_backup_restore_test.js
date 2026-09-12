const path = require('path');
const { describe, test, expect, beforeEach, afterEach, ApexJournalTestInstance, TestDbManager } = require('../harness');

describe('Tier 1 - Feature 12: Encrypted .vault Backup & Restore', () => {
  let app;
  let dbManager;
  let tmpDir;
  const password = 'VaultBackupPassword2026!';

  beforeEach(async () => {
    dbManager = new TestDbManager();
    tmpDir = dbManager.createTempDirectory('backup_test_');
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: password });
  });

  afterEach(() => {
    dbManager.cleanup();
  });

  test('test_export_backup_generates_encrypted_file', async () => {
    const backupFile = path.join(tmpDir, 'apex_export.vault');
    const result = await app.vault_export_backup({ destinationPath: backupFile });

    expect(result.success).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(64);
  });

  test('test_restore_backup_restores_complete_state', async () => {
    const cs = await app.case_create({
      input: { title: 'Restore Verification Case', client_name: 'Omega Systems' }
    });
    await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 15000, case_id: cs.id, status: 'CLEARED' }
    });
    await app.journal_create({
      input: { title: 'Restore Diary Entry', content: 'Important strategic notes.', case_id: cs.id }
    });

    const backupFile = path.join(tmpDir, 'full_state.vault');
    await app.vault_export_backup({ destinationPath: backupFile });

    const restoredApp = new ApexJournalTestInstance();
    await restoredApp.vault_restore_backup({ sourcePath: backupFile, masterPassword: password });

    const cases = await restoredApp.case_list();
    expect(cases.length).toBe(1);
    expect(cases[0].title).toBe('Restore Verification Case');

    const txs = await restoredApp.transaction_list();
    expect(txs.length).toBe(1);
    expect(txs[0].amount).toBe(15000.00);

    const journals = await restoredApp.journal_list();
    expect(journals.length).toBe(1);
    expect(journals[0].title).toBe('Restore Diary Entry');
  });

  test('test_restore_backup_rejects_wrong_password', async () => {
    const backupFile = path.join(tmpDir, 'wrong_pw.vault');
    await app.vault_export_backup({ destinationPath: backupFile });

    const restoredApp = new ApexJournalTestInstance();
    let threw = false;
    try {
      await restoredApp.vault_restore_backup({ sourcePath: backupFile, masterPassword: 'IncorrectPassword!' });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('Invalid password');
    }
    expect(threw).toBe(true);
  });

  test('test_restore_backup_rejects_tampered_file', async () => {
    const fs = require('fs');
    const backupFile = path.join(tmpDir, 'tampered.vault');
    await app.vault_export_backup({ destinationPath: backupFile });

    const bytes = fs.readFileSync(backupFile);
    // Tamper ciphertext byte
    bytes[bytes.length - 5] ^= 0xFF;
    fs.writeFileSync(backupFile, bytes);

    const restoredApp = new ApexJournalTestInstance();
    let threw = false;
    try {
      await restoredApp.vault_restore_backup({ sourcePath: backupFile, masterPassword: password });
    } catch (err) {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  test('test_restore_backup_preserves_multicurrency_records', async () => {
    await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 5000, currency: 'EUR', exchange_rate: 1.085 }
    });

    const backupFile = path.join(tmpDir, 'currency_backup.vault');
    await app.vault_export_backup({ destinationPath: backupFile });

    const restoredApp = new ApexJournalTestInstance();
    await restoredApp.vault_restore_backup({ sourcePath: backupFile, masterPassword: password });

    const txs = await restoredApp.transaction_list();
    expect(txs[0].currency).toBe('EUR');
    expect(txs[0].exchange_rate).toBe(1.085);
    expect(txs[0].base_amount).toBeCloseTo(5425.00, 2);
  });
});
