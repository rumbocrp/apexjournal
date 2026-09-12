const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 5 - Adversarial 05: Rapid Lifecycle Stress & High Volume Churn', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance({ baseCurrency: 'USD' });
    await app.vault_setup({ masterPassword: 'AdversarialLifecyclePassword2026!' });
  });

  test('test_high_volume_transaction_churn_with_interleaved_updates_and_deletions', async () => {
    const createdIds = [];

    // Create 100 transactions
    for (let i = 0; i < 100; i++) {
      const tx = await app.transaction_create({
        input: {
          date: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
          type: i % 3 === 0 ? 'EXPENSE' : 'INCOME',
          amount: (i + 1) * 50,
          status: 'CLEARED',
          notes: `Batch TX #${i}`
        }
      });
      createdIds.push(tx.id);
    }

    expect(createdIds.length).toBe(100);

    // Update 30 transactions
    for (let i = 0; i < 30; i++) {
      await app.transaction_update({
        id: createdIds[i],
        input: { amount: 999.99, notes: `Updated TX #${i}` }
      });
    }

    // Delete 20 transactions
    for (let i = 80; i < 100; i++) {
      await app.transaction_delete({ id: createdIds[i] });
    }

    const remaining = await app.transaction_list();
    expect(remaining.length).toBe(80);

    // Verify analytics still compute deterministically
    const metrics = await app.analytics_get_dashboard();
    expect(Number.isFinite(metrics.cumulative_net_margin)).toBe(true);

    const curve = await app.analytics_get_equity_curve({ timeframe: 'ALL' });
    expect(curve.length).toBeGreaterThan(0);
  });

  test('test_rapid_case_stage_transition_pipeline_churn', async () => {
    const stages = ['LEAD', 'QUOTATION', 'ACTIVE', 'COMPLETED', 'LOST'];
    const cs = await app.case_create({
      input: { title: 'Dynamic Client Work', client_name: 'Churn Corp', quoted_amount: 50000 }
    });

    for (let cycle = 0; cycle < 10; cycle++) {
      for (const stage of stages) {
        await app.case_update({ id: cs.id, input: { stage } });
        const updated = await app.case_get_detail({ id: cs.id });
        expect(updated.stage).toBe(stage);
      }
    }
  });

  test('test_monotonic_equity_curve_date_continuity_under_dense_activity', async () => {
    // Generate transactions on varied dates
    const dates = [
      '2026-01-01', '2026-01-05', '2026-01-10', '2026-02-01', '2026-02-15',
      '2026-03-01', '2026-03-20', '2026-04-01', '2026-05-01', '2026-06-01'
    ];

    for (let i = 0; i < dates.length; i++) {
      await app.transaction_create({
        input: { date: dates[i], type: 'INCOME', amount: 5000, status: 'CLEARED' }
      });
    }

    const curve = await app.analytics_get_equity_curve({ timeframe: 'ALL' });
    expect(curve.length).toBe(dates.length);

    // Verify cumulative equity increases strictly monotonically
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].cumulative_equity).toBeGreaterThan(curve[i - 1].cumulative_equity);
      expect(new Date(curve[i].date).getTime()).toBeGreaterThan(new Date(curve[i - 1].date).getTime());
    }
  });
});
