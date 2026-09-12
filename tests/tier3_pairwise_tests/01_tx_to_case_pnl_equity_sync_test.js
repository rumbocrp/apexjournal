const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 3 - Pairwise 01: Transaction -> Case PnL & Equity Curve Sync', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'PairwiseTxPassword2026!' });
  });

  test('test_adding_case_income_updates_case_pnl_and_equity_curve_simultaneously', async () => {
    const cs = await app.case_create({
      input: { title: 'Fintech Overhaul', client_name: 'Nova Bank', quoted_amount: 50000 }
    });

    await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 20000, case_id: cs.id, status: 'CLEARED' }
    });

    // 1. Case Detail PnL check
    const detail = await app.case_get_detail({ id: cs.id });
    expect(detail.realized_income).toBe(20000.00);
    expect(detail.net_margin).toBe(20000.00);

    // 2. Equity Curve check
    const curve = await app.analytics_get_equity_curve({ timeframe: 'ALL' });
    expect(curve.length).toBe(1);
    expect(curve[0].cumulative_equity).toBe(20000.00);

    // 3. Dashboard KPI check
    const metrics = await app.analytics_get_dashboard();
    expect(metrics.cumulative_net_margin).toBe(20000.00);
    expect(metrics.realized_volume).toBe(20000.00);
  });

  test('test_adding_case_expense_reduces_case_margin_and_equity_curve', async () => {
    const cs = await app.case_create({
      input: { title: 'App Redesign', client_name: 'Echo Media', quoted_amount: 30000 }
    });

    await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 30000, case_id: cs.id, status: 'CLEARED' }
    });
    await app.transaction_create({
      input: { date: '2026-08-05', type: 'EXPENSE', amount: 10000, case_id: cs.id, status: 'CLEARED' }
    });

    const detail = await app.case_get_detail({ id: cs.id });
    expect(detail.net_margin).toBe(20000.00);
    expect(detail.profit_margin_pct).toBeCloseTo(66.67, 1);

    const curve = await app.analytics_get_equity_curve({ timeframe: 'ALL' });
    expect(curve.length).toBe(2);
    expect(curve[1].cumulative_equity).toBe(20000.00);
  });

  test('test_updating_transaction_amount_recalculates_case_pnl_and_equity_curve', async () => {
    const cs = await app.case_create({ input: { title: 'Cloud Project', client_name: 'Atlas' } });
    const tx = await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 10000, case_id: cs.id, status: 'CLEARED' }
    });

    await app.transaction_update({ id: tx.id, input: { amount: 15000 } });

    const detail = await app.case_get_detail({ id: cs.id });
    expect(detail.net_margin).toBe(15000.00);

    const curve = await app.analytics_get_equity_curve({ timeframe: 'ALL' });
    expect(curve[0].cumulative_equity).toBe(15000.00);
  });

  test('test_deleting_transaction_reverts_case_pnl_and_equity_curve', async () => {
    const cs = await app.case_create({ input: { title: 'Temporary Work', client_name: 'Flux Inc' } });
    const tx = await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 8000, case_id: cs.id, status: 'CLEARED' }
    });

    await app.transaction_delete({ id: tx.id });

    const detail = await app.case_get_detail({ id: cs.id });
    expect(detail.net_margin).toBe(0.00);

    const curve = await app.analytics_get_equity_curve({ timeframe: 'ALL' });
    expect(curve.length).toBe(0);
  });

  test('test_transaction_status_cleared_triggers_pnl_inclusion', async () => {
    const cs = await app.case_create({ input: { title: 'Pending Case', client_name: 'Pulse LLC' } });
    const tx = await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 12000, case_id: cs.id, status: 'PENDING' }
    });

    let detail = await app.case_get_detail({ id: cs.id });
    expect(detail.realized_income).toBe(0.00); // Un-cleared

    await app.transaction_update({ id: tx.id, input: { status: 'CLEARED' } });

    detail = await app.case_get_detail({ id: cs.id });
    expect(detail.realized_income).toBe(12000.00);
  });
});
