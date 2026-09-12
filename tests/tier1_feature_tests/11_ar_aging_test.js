const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 1 - Feature 11: Accounts Receivable Aging Schedule', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'ARAgingPassword2026!' });
  });

  test('test_ar_aging_current_bucket_0_30_days', async () => {
    const today = new Date();
    const tenDaysAgo = new Date(today.getTime() - 10 * 86400000).toISOString().split('T')[0];

    await app.transaction_create({
      input: { date: tenDaysAgo, type: 'INCOME', amount: 5000, status: 'INVOICED' }
    });

    const ar = await app.analytics_get_ar_aging();
    expect(ar.current_0_30).toBe(5000.00);
    expect(ar.pending_31_60).toBe(0.00);
    expect(ar.overdue_61_90).toBe(0.00);
    expect(ar.critical_90_plus).toBe(0.00);
    expect(ar.total_receivable).toBe(5000.00);
    expect(ar.traffic_light).toBe('GREEN');
  });

  test('test_ar_aging_pending_bucket_31_60_days', async () => {
    const today = new Date();
    const fortyFiveDaysAgo = new Date(today.getTime() - 45 * 86400000).toISOString().split('T')[0];

    await app.transaction_create({
      input: { date: fortyFiveDaysAgo, type: 'INCOME', amount: 8000, status: 'INVOICED' }
    });

    const ar = await app.analytics_get_ar_aging();
    expect(ar.pending_31_60).toBe(8000.00);
    expect(ar.traffic_light).toBe('GREEN');
  });

  test('test_ar_aging_overdue_bucket_61_90_days', async () => {
    const today = new Date();
    const seventyFiveDaysAgo = new Date(today.getTime() - 75 * 86400000).toISOString().split('T')[0];

    await app.transaction_create({
      input: { date: seventyFiveDaysAgo, type: 'INCOME', amount: 12000, status: 'INVOICED' }
    });

    const ar = await app.analytics_get_ar_aging();
    expect(ar.overdue_61_90).toBe(12000.00);
    expect(ar.traffic_light).toBe('YELLOW');
  });

  test('test_ar_aging_critical_bucket_90_plus_days', async () => {
    const today = new Date();
    const oneHundredDaysAgo = new Date(today.getTime() - 100 * 86400000).toISOString().split('T')[0];

    await app.transaction_create({
      input: { date: oneHundredDaysAgo, type: 'INCOME', amount: 15000, status: 'INVOICED' }
    });

    const ar = await app.analytics_get_ar_aging();
    expect(ar.critical_90_plus).toBe(15000.00);
    expect(ar.traffic_light).toBe('RED');
  });

  test('test_ar_aging_total_receivable_sum', async () => {
    const today = new Date();
    const d10 = new Date(today.getTime() - 10 * 86400000).toISOString().split('T')[0];
    const d45 = new Date(today.getTime() - 45 * 86400000).toISOString().split('T')[0];
    const d75 = new Date(today.getTime() - 75 * 86400000).toISOString().split('T')[0];
    const d110 = new Date(today.getTime() - 110 * 86400000).toISOString().split('T')[0];

    await app.transaction_create({ input: { date: d10, type: 'INCOME', amount: 1000, status: 'INVOICED' } });
    await app.transaction_create({ input: { date: d45, type: 'INCOME', amount: 2000, status: 'INVOICED' } });
    await app.transaction_create({ input: { date: d75, type: 'INCOME', amount: 3000, status: 'INVOICED' } });
    await app.transaction_create({ input: { date: d110, type: 'INCOME', amount: 4000, status: 'INVOICED' } });

    const ar = await app.analytics_get_ar_aging();
    expect(ar.total_receivable).toBe(10000.00);
    expect(ar.traffic_light).toBe('RED');
  });
});
