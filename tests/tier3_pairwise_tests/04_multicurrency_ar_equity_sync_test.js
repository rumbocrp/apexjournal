const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 3 - Pairwise 04: Multi-Currency AR Aging & Equity Curve Sync', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance({ baseCurrency: 'USD' });
    await app.vault_setup({ masterPassword: 'CurrencyARPassword2026!' });
  });

  test('test_unpaid_foreign_invoice_appears_in_ar_and_advances_equity_curve_on_clear', async () => {
    const today = new Date();
    const tenDaysAgo = new Date(today.getTime() - 10 * 86400000).toISOString().split('T')[0];

    // 5,000 EUR @ 1.10 = $5,500 USD invoiced
    const tx = await app.transaction_create({
      input: {
        date: tenDaysAgo,
        type: 'INCOME',
        amount: 5000.00,
        currency: 'EUR',
        exchange_rate: 1.10,
        status: 'INVOICED'
      }
    });

    // 1. Check AR Aging includes converted USD amount ($5,500)
    let ar = await app.analytics_get_ar_aging();
    expect(ar.current_0_30).toBe(5500.00);
    expect(ar.total_receivable).toBe(5500.00);

    // 2. Check Equity Curve is NOT affected yet
    let curve = await app.analytics_get_equity_curve({ timeframe: 'ALL' });
    expect(curve.length).toBe(0);

    // 3. Mark invoice PAID/CLEARED
    await app.transaction_update({ id: tx.id, input: { status: 'CLEARED' } });

    // 4. Check AR Aging drops to $0
    ar = await app.analytics_get_ar_aging();
    expect(ar.total_receivable).toBe(0.00);

    // 5. Check Equity Curve now reflects +$5,500 USD
    curve = await app.analytics_get_equity_curve({ timeframe: 'ALL' });
    expect(curve.length).toBe(1);
    expect(curve[0].cumulative_equity).toBe(5500.00);
  });
});
