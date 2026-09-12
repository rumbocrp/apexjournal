const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 1 - Feature 09: Cumulative Equity Curve Engine', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'EquityCurvePassword2026!' });
  });

  test('test_single_day_equity_curve_point', async () => {
    await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 5000, status: 'CLEARED' }
    });

    const curve = await app.analytics_get_equity_curve({ timeframe: 'ALL' });
    expect(curve.length).toBe(1);
    expect(curve[0].date).toBe('2026-08-01');
    expect(curve[0].daily_delta).toBe(5000.00);
    expect(curve[0].cumulative_equity).toBe(5000.00);
    expect(curve[0].volume_income).toBe(5000.00);
    expect(curve[0].volume_expense).toBe(0.00);
  });

  test('test_multi_day_running_cumulative_equity', async () => {
    await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 10000, status: 'CLEARED' } // +10k -> cum 10k
    });
    await app.transaction_create({
      input: { date: '2026-08-02', type: 'EXPENSE', amount: 3000, status: 'CLEARED' } // -3k -> cum 7k
    });
    await app.transaction_create({
      input: { date: '2026-08-03', type: 'INCOME', amount: 5000, status: 'CLEARED' }  // +5k -> cum 12k
    });

    const curve = await app.analytics_get_equity_curve({ timeframe: 'ALL' });
    expect(curve.length).toBe(3);
    expect(curve[0].cumulative_equity).toBe(10000.00);
    expect(curve[1].cumulative_equity).toBe(7000.00);
    expect(curve[2].cumulative_equity).toBe(12000.00);
  });

  test('test_equity_curve_handles_net_negative_drawdown', async () => {
    await app.transaction_create({
      input: { date: '2026-08-01', type: 'EXPENSE', amount: 5000, status: 'CLEARED' }
    });

    const curve = await app.analytics_get_equity_curve({ timeframe: 'ALL' });
    expect(curve.length).toBe(1);
    expect(curve[0].daily_delta).toBe(-5000.00);
    expect(curve[0].cumulative_equity).toBe(-5000.00);
  });

  test('test_equity_curve_timeframe_filtering_1m', async () => {
    const today = new Date();
    const tenDaysAgo = new Date(today.getTime() - 10 * 86400000).toISOString().split('T')[0];
    const fortyDaysAgo = new Date(today.getTime() - 40 * 86400000).toISOString().split('T')[0];

    await app.transaction_create({
      input: { date: fortyDaysAgo, type: 'INCOME', amount: 2000, status: 'CLEARED' }
    });
    await app.transaction_create({
      input: { date: tenDaysAgo, type: 'INCOME', amount: 3000, status: 'CLEARED' }
    });

    const curve1M = await app.analytics_get_equity_curve({ timeframe: '1M' });
    expect(curve1M.length).toBe(1);
    expect(curve1M[0].date).toBe(tenDaysAgo);
    expect(curve1M[0].cumulative_equity).toBe(5000.00); // Preserves running cumulative baseline
  });

  test('test_equity_curve_all_selector_returns_full_history', async () => {
    const today = new Date();
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 86400000).toISOString().split('T')[0];
    const fiveDaysAgo = new Date(today.getTime() - 5 * 86400000).toISOString().split('T')[0];

    await app.transaction_create({
      input: { date: sixtyDaysAgo, type: 'INCOME', amount: 1000, status: 'CLEARED' }
    });
    await app.transaction_create({
      input: { date: fiveDaysAgo, type: 'INCOME', amount: 2000, status: 'CLEARED' }
    });

    const curveALL = await app.analytics_get_equity_curve({ timeframe: 'ALL' });
    expect(curveALL.length).toBe(2);
  });
});
