const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 3 - Pairwise 02: Case Stage Change -> Win Rate Sync', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'StageChangePassword2026!' });
  });

  test('test_case_transitions_synchronize_with_dashboard_kpis', async () => {
    // 1. Create Lead (Win rate = 0.0%)
    const cs1 = await app.case_create({ input: { title: 'Pitch 1', client_name: 'Client 1', stage: 'LEAD' } });
    let metrics = await app.analytics_get_dashboard();
    expect(metrics.proposal_win_rate).toBe(0.00);

    // 2. Advance to Quotation (Win rate = 0.0%)
    await app.case_update({ id: cs1.id, input: { stage: 'QUOTATION' } });
    metrics = await app.analytics_get_dashboard();
    expect(metrics.proposal_win_rate).toBe(0.00);

    // 3. Move to COMPLETED -> Win rate = 100.0% (1/1)
    await app.case_update({ id: cs1.id, input: { stage: 'COMPLETED' } });
    metrics = await app.analytics_get_dashboard();
    expect(metrics.proposal_win_rate).toBe(100.00);

    // 4. Create second case and mark LOST -> Win rate = 50.0% (1/2)
    await app.case_create({ input: { title: 'Pitch 2', client_name: 'Client 2', stage: 'LOST' } });
    metrics = await app.analytics_get_dashboard();
    expect(metrics.proposal_win_rate).toBe(50.00);

    // 5. Create third case and mark COMPLETED -> Win rate = 66.67% (2/3)
    await app.case_create({ input: { title: 'Pitch 3', client_name: 'Client 3', stage: 'COMPLETED' } });
    metrics = await app.analytics_get_dashboard();
    expect(metrics.proposal_win_rate).toBeCloseTo(66.67, 1);
  });
});
