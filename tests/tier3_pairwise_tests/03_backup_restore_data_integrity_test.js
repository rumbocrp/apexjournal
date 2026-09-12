const path = require('path');
const { describe, test, expect, beforeEach, afterEach, ApexJournalTestInstance, TestDbManager } = require('../harness');

describe('Tier 3 - Pairwise 03: Backup Restore -> Full Data Integrity Parity', () => {
  let app;
  let dbManager;
  let tmpDir;
  const password = 'IntegrityMasterPassword2026!';

  beforeEach(async () => {
    dbManager = new TestDbManager();
    tmpDir = dbManager.createTempDirectory('integrity_test_');
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: password });
  });

  afterEach(() => {
    dbManager.cleanup();
  });

  test('test_full_relational_graph_restores_with_identical_analytics', async () => {
    // 1. Setup multi-table database state
    const cs1 = await app.case_create({ input: { title: 'Strategy Alpha', client_name: 'Corp 1', stage: 'COMPLETED', quoted_amount: 50000 } });
    const cs2 = await app.case_create({ input: { title: 'Audit Beta', client_name: 'Corp 2', stage: 'LOST', quoted_amount: 20000 } });

    await app.milestone_create({ input: { case_id: cs1.id, title: 'Phase 1 Delivery', completed: true, amount: 25000 } });
    await app.milestone_create({ input: { case_id: cs1.id, title: 'Phase 2 Delivery', completed: true, amount: 25000 } });

    await app.transaction_create({ input: { date: '2026-08-01', type: 'INCOME', amount: 25000, case_id: cs1.id, status: 'CLEARED' } });
    await app.transaction_create({ input: { date: '2026-08-05', type: 'EXPENSE', amount: 5000, case_id: cs1.id, status: 'CLEARED' } });
    await app.transaction_create({ input: { date: '2026-08-10', type: 'INCOME', amount: 20000, currency: 'EUR', exchange_rate: 1.10, case_id: cs1.id, status: 'CLEARED' } }); // 22,000 USD

    await app.journal_create({ input: { title: 'Kickoff Notes', content: 'Detailed roadmap notes.', case_id: cs1.id, tags: ['#kickoff', '#strategy'] } });

    // 2. Baseline analytics capture
    const baselineDashboard = await app.analytics_get_dashboard();
    const baselineCurve = await app.analytics_get_equity_curve({ timeframe: 'ALL' });
    const baselineAR = await app.analytics_get_ar_aging();
    const baselineCaseDetail = await app.case_get_detail({ id: cs1.id });

    // 3. Export backup
    const backupFile = path.join(tmpDir, 'integrity_test.vault');
    await app.vault_export_backup({ destinationPath: backupFile });

    // 4. Restore to brand new instance
    const freshApp = new ApexJournalTestInstance();
    await freshApp.vault_restore_backup({ sourcePath: backupFile, masterPassword: password });

    // 5. Compare restored analytics to baseline
    const restoredDashboard = await freshApp.analytics_get_dashboard();
    const restoredCurve = await freshApp.analytics_get_equity_curve({ timeframe: 'ALL' });
    const restoredAR = await freshApp.analytics_get_ar_aging();
    const restoredCaseDetail = await freshApp.case_get_detail({ id: cs1.id });

    expect(restoredDashboard).toEqual(baselineDashboard);
    expect(restoredCurve).toEqual(baselineCurve);
    expect(restoredAR).toEqual(baselineAR);
    expect(restoredCaseDetail.net_margin).toBe(baselineCaseDetail.net_margin);
    expect(restoredCaseDetail.milestones.length).toBe(2);
    expect(restoredCaseDetail.diary_entries.length).toBe(1);
  });
});
