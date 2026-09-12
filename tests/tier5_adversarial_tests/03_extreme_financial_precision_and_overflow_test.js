const { describe, test, expect, beforeEach, ApexJournalTestInstance, oracle } = require('../harness');

describe('Tier 5 - Adversarial 03: Extreme Financial Precision, Overflow & Rate Boundaries', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance({ baseCurrency: 'USD' });
    await app.vault_setup({ masterPassword: 'AdversarialPrecisionPassword2026!' });
  });

  test('test_sub_cent_half_to_even_rounding_accuracy', async () => {
    // Test exact half-cent rounding behavior (e.g. 10.005 vs 10.004)
    const tx1 = await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 10.005, exchange_rate: 1.0 }
    });
    expect(tx1.base_amount).toBe(10.01);

    const tx2 = await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 10.004, exchange_rate: 1.0 }
    });
    expect(tx2.base_amount).toBe(10.00);
  });

  test('test_multi_currency_high_precision_exchange_rate_multiplication', async () => {
    // 123,456.78 EUR @ 1.085023 USD/EUR
    // Exact: 133,953.44754594 -> Rounded: 133,953.45 USD
    const tx = await app.transaction_create({
      input: {
        date: '2026-08-01',
        type: 'INCOME',
        amount: 123456.78,
        currency: 'EUR',
        exchange_rate: 1.085023
      }
    });
    expect(tx.base_amount).toBe(133953.45);
  });

  test('test_negative_and_zero_exchange_rates_are_rejected', async () => {
    let threwZero = false;
    try {
      await app.transaction_create({
        input: { date: '2026-08-01', type: 'INCOME', amount: 1000, exchange_rate: 0 }
      });
    } catch (err) {
      threwZero = true;
      expect(err.message).toContain('positive');
    }
    expect(threwZero).toBe(true);

    let threwNegative = false;
    try {
      await app.transaction_create({
        input: { date: '2026-08-01', type: 'INCOME', amount: 1000, exchange_rate: -1.25 }
      });
    } catch (err) {
      threwNegative = true;
      expect(err.message).toContain('positive');
    }
    expect(threwNegative).toBe(true);
  });

  test('test_non_numeric_and_nan_amounts_are_rejected', async () => {
    let threwNaN = false;
    try {
      await app.transaction_create({
        input: { date: '2026-08-01', type: 'INCOME', amount: NaN }
      });
    } catch (err) {
      threwNaN = true;
      expect(err.message).toContain('Valid transaction amount');
    }
    expect(threwNaN).toBe(true);

    let threwString = false;
    try {
      await app.transaction_create({
        input: { date: '2026-08-01', type: 'INCOME', amount: 'invalid_number' }
      });
    } catch (err) {
      threwString = true;
      expect(err.message).toContain('Valid transaction amount');
    }
    expect(threwString).toBe(true);
  });

  test('test_multi_billion_dollar_extreme_financial_volume', async () => {
    // 10 Billion transaction
    const hugeTx = await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 10000000000.00, status: 'CLEARED' }
    });
    expect(hugeTx.base_amount).toBe(10000000000.00);

    const metrics = await app.analytics_get_dashboard();
    expect(metrics.realized_volume).toBe(10000000000.00);
    expect(metrics.cumulative_net_margin).toBe(10000000000.00);
    expect(Number.isFinite(metrics.cumulative_net_margin)).toBe(true);
  });
});
