const path = require('path');
const { describe, test, expect, beforeEach, afterEach, ApexJournalTestInstance, TestDbManager } = require('../harness');

describe('Tier 4 - Workload 04: Full System Disaster Recovery & Machine Migration', () => {
  let app;
  let dbManager;
  let tmpDir;
  const masterKey = 'DisasterRecoveryKey#2026!';

  beforeEach(async () => {
    dbManager = new TestDbManager();
    tmpDir = dbManager.createTempDirectory('dr_test_');
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: masterKey });
  });

  afterEach(() => {
    dbManager.cleanup();
  });

  test('test_catastrophic_crash_and_clean_restoration_on_new_machine', async () => {
    // 1. Populate rich multi-month database state
    for (let i = 1; i <= 10; i++) {
      const cs = await app.case_create({ input: { title: 'Project ' + i, client_name: 'Client ' + i, stage: i % 2 === 0 ? 'COMPLETED' : 'ACTIVE', quoted_amount: 10000 * i } });
      await app.transaction_create({ input: { date: '2026-08-' + String(i).padStart(2, '0'), type: 'INCOME', amount: 5000 * i, case_id: cs.id, status: 'CLEARED' } });
      await app.journal_create({ input: { title: 'Log #' + i, content: 'Diary text #' + i, case_id: cs.id } });
    }

    const baselineDashboard = await app.analytics_get_dashboard();

    // 2. Export encrypted backup
    const drBackupFile = path.join(tmpDir, 'agency_production_backup.vault');
    await app.vault_export_backup({ destinationPath: drBackupFile });

    // 3. Simulate hardware failure: instance completely reset/wiped
    app.reset();

    // 4. Spin up fresh instance and restore backup
    const newMachineApp = new ApexJournalTestInstance();
    await newMachineApp.vault_restore_backup({ sourcePath: drBackupFile, masterPassword: masterKey });

    // 5. Verify restored state
    const restoredDashboard = await newMachineApp.analytics_get_dashboard();
    expect(restoredDashboard).toEqual(baselineDashboard);

    const cases = await newMachineApp.case_list();
    expect(cases.length).toBe(10);
    const txs = await newMachineApp.transaction_list();
    expect(txs.length).toBe(10);
    const journals = await newMachineApp.journal_list();
    expect(journals.length).toBe(10);
  });
});
