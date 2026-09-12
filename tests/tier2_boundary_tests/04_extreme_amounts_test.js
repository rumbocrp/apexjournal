const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 2 - Boundary 04: Extreme Amounts & Precision', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'ExtremeAmountsPassword2026!' });
  });

  test('test_micro_amount_precision', async () => {
    const tx = await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 0.01, exchange_rate: 1.0 }
    });
    expect(tx.amount).toBe(0.01);
    expect(tx.base_amount).toBe(0.01);
  });

  test('test_large_financial_amounts_billions', async () => {
    const tx = await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 999999999999.99, exchange_rate: 1.0 }
    });
    expect(tx.amount).toBe(999999999999.99);
    expect(tx.base_amount).toBe(999999999999.99);

    const metrics = await app.analytics_get_dashboard();
    expect(metrics.cumulative_net_margin).toBe(999999999999.99);
  });

  test('test_zero_amount_transaction', async () => {
    const tx = await app.transaction_create({
      input: { date: '2026-08-01', type: 'EXPENSE', amount: 0.00 }
    });
    expect(tx.amount).toBe(0.00);
    expect(tx.base_amount).toBe(0.00);
  });

  test('test_floating_point_sum_precision', async () => {
    // 0.10 + 0.20 must equal 0.30, not 0.30000000000000004
    await app.transaction_create({ input: { date: '2026-08-01', type: 'INCOME', amount: 0.10 } });
    await app.transaction_create({ input: { date: '2026-08-01', type: 'INCOME', amount: 0.20 } });

    const metrics = await app.analytics_get_dashboard();
    expect(metrics.cumulative_net_margin).toBe(0.30);
  });

  test('test_extreme_exchange_rates', async () => {
    // Micro FX rate
    const tx1 = await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 1000000, currency: 'VND', exchange_rate: 0.000041 }
    });
    expect(tx1.base_amount).toBe(41.00);

    // Large FX rate
    const tx2 = await app.transaction_create({
      input: { date: '2026-08-01', type: 'EXPENSE', amount: 2, currency: 'BTC', exchange_rate: 65000.50 }
    });
    expect(tx2.base_amount).toBe(130001.00);
  });
});
