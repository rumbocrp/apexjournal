const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 2 - Boundary 03: Leap Years & Date Boundaries', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'LeapYearPassword2026!' });
  });

  test('test_leap_year_february_29_transaction', async () => {
    const tx = await app.transaction_create({
      input: { date: '2028-02-29', type: 'INCOME', amount: 15000.00, status: 'CLEARED' }
    });
    expect(tx.date).toBe('2028-02-29');

    const curve = await app.analytics_get_equity_curve({ timeframe: 'ALL' });
    expect(curve.some(p => p.date === '2028-02-29')).toBe(true);
  });

  test('test_year_boundary_dec_31_to_jan_01_equity_curve', async () => {
    await app.transaction_create({
      input: { date: '2025-12-31', type: 'INCOME', amount: 10000.00, status: 'CLEARED' }
    });
    await app.transaction_create({
      input: { date: '2026-01-01', type: 'EXPENSE', amount: 4000.00, status: 'CLEARED' }
    });

    const curve = await app.analytics_get_equity_curve({ timeframe: 'ALL' });
    expect(curve.length).toBe(2);
    expect(curve[0].date).toBe('2025-12-31');
    expect(curve[0].cumulative_equity).toBe(10000.00);
    expect(curve[1].date).toBe('2026-01-01');
    expect(curve[1].cumulative_equity).toBe(6000.00);
  });

  test('test_ar_aging_across_leap_year_boundary', async () => {
    // 2028 is a leap year (Feb 29 exists)
    const refDate = new Date('2028-03-05');
    const invoiceDate = '2028-02-01'; // 33 days gap (28 + 1 leap + 4 = 33 days)

    await app.transaction_create({
      input: { date: invoiceDate, type: 'INCOME', amount: 5000.00, status: 'INVOICED' }
    });

    const { calculateARAging } = require('../harness/oracle');
    const ar = calculateARAging({ transactions: app.transactions, referenceDate: refDate });
    expect(ar.pending_31_60).toBe(5000.00);
    expect(ar.current_0_30).toBe(0.00);
  });

  test('test_iso_date_with_timezone_offsets', async () => {
    const tx = await app.transaction_create({
      input: { date: '2026-08-30T19:00:00Z', type: 'INCOME', amount: 2000.00 }
    });
    expect(tx.date.startsWith('2026-08-30')).toBe(true);
  });

  test('test_date_filtering_exact_boundaries', async () => {
    await app.transaction_create({ input: { date: '2026-08-10', type: 'INCOME', amount: 1000 } });
    await app.transaction_create({ input: { date: '2026-08-15', type: 'INCOME', amount: 2000 } });
    await app.transaction_create({ input: { date: '2026-08-20', type: 'INCOME', amount: 3000 } });

    const filtered = await app.transaction_list({
      filter: { startDate: '2026-08-10', endDate: '2026-08-15' }
    });
    expect(filtered.length).toBe(2);
    expect(filtered.map(t => t.amount)).toEqual([1000, 2000]);
  });
});
