const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 1 - Feature 07: Multi-Currency System', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance({ baseCurrency: 'USD' });
    await app.vault_setup({ masterPassword: 'MultiCurrencyPassword2026!' });
  });

  test('test_foreign_currency_conversion_to_usd_base', async () => {
    const tx = await app.transaction_create({
      input: {
        date: '2026-08-10',
        type: 'INCOME',
        amount: 4500.00,
        currency: 'EUR',
        exchange_rate: 1.0850
      }
    });

    expect(tx.currency).toBe('EUR');
    expect(tx.amount).toBe(4500.00);
    expect(tx.exchange_rate).toBe(1.0850);
    expect(tx.base_amount).toBeCloseTo(4882.50, 2);
  });

  test('test_zero_decimal_currency_conversion', async () => {
    const tx = await app.transaction_create({
      input: {
        date: '2026-08-12',
        type: 'EXPENSE',
        amount: 500000,
        currency: 'JPY',
        exchange_rate: 0.0068
      }
    });

    expect(tx.currency).toBe('JPY');
    expect(tx.amount).toBe(500000);
    expect(tx.base_amount).toBeCloseTo(3400.00, 2);
  });

  test('test_gbp_conversion_with_high_rate', async () => {
    const tx = await app.transaction_create({
      input: {
        date: '2026-08-14',
        type: 'INCOME',
        amount: 10000.00,
        currency: 'GBP',
        exchange_rate: 1.2850
      }
    });

    expect(tx.base_amount).toBe(12850.00);
  });

  test('test_rejection_of_negative_or_zero_exchange_rate', async () => {
    let threwZero = false;
    try {
      await app.transaction_create({
        input: {
          date: '2026-08-15',
          type: 'INCOME',
          amount: 1000,
          currency: 'EUR',
          exchange_rate: 0
        }
      });
    } catch (err) {
      threwZero = true;
      expect(err.message).toContain('Exchange rate must be strictly positive');
    }
    expect(threwZero).toBe(true);

    let threwNegative = false;
    try {
      await app.transaction_create({
        input: {
          date: '2026-08-15',
          type: 'INCOME',
          amount: 1000,
          currency: 'EUR',
          exchange_rate: -1.25
        }
      });
    } catch (err) {
      threwNegative = true;
    }
    expect(threwNegative).toBe(true);
  });

  test('test_multi_currency_blotter_aggregation', async () => {
    await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 5000, currency: 'USD', exchange_rate: 1.0 }
    });
    await app.transaction_create({
      input: { date: '2026-08-02', type: 'INCOME', amount: 4000, currency: 'EUR', exchange_rate: 1.10 }
    });
    await app.transaction_create({
      input: { date: '2026-08-03', type: 'EXPENSE', amount: 2000, currency: 'GBP', exchange_rate: 1.30 }
    });

    const metrics = await app.analytics_get_dashboard();
    expect(metrics.cumulative_net_margin).toBe(6800.00);
    expect(metrics.realized_volume).toBe(9400.00);
    expect(metrics.base_currency).toBe('USD');
  });
});
