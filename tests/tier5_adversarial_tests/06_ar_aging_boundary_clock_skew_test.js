const { describe, test, expect, beforeEach, ApexJournalTestInstance, oracle } = require('../harness');

describe('Tier 5 - Adversarial 06: Accounts Receivable Aging Boundary & Clock Skew', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance({ baseCurrency: 'USD' });
    await app.vault_setup({ masterPassword: 'AdversarialARAgingPassword2026!' });
  });

  test('test_exact_aging_boundary_buckets_0_30_60_90', async () => {
    const refDate = new Date('2026-08-30T12:00:00Z');
    const dayMs = 86400000;

    const txs = [
      // 0 days old -> Current 0-30
      { id: 'tx-0', date: new Date(refDate.getTime() - 0 * dayMs).toISOString().split('T')[0], amount: 1000, type: 'INCOME', status: 'INVOICED' },
      // 30 days old -> Current 0-30
      { id: 'tx-30', date: new Date(refDate.getTime() - 30 * dayMs).toISOString().split('T')[0], amount: 2000, type: 'INCOME', status: 'INVOICED' },
      // 31 days old -> Pending 31-60
      { id: 'tx-31', date: new Date(refDate.getTime() - 31 * dayMs).toISOString().split('T')[0], amount: 3000, type: 'INCOME', status: 'INVOICED' },
      // 60 days old -> Pending 31-60
      { id: 'tx-60', date: new Date(refDate.getTime() - 60 * dayMs).toISOString().split('T')[0], amount: 4000, type: 'INCOME', status: 'INVOICED' },
      // 61 days old -> Overdue 61-90
      { id: 'tx-61', date: new Date(refDate.getTime() - 61 * dayMs).toISOString().split('T')[0], amount: 5000, type: 'INCOME', status: 'INVOICED' },
      // 90 days old -> Overdue 61-90
      { id: 'tx-90', date: new Date(refDate.getTime() - 90 * dayMs).toISOString().split('T')[0], amount: 6000, type: 'INCOME', status: 'INVOICED' },
      // 91 days old -> Critical 90+
      { id: 'tx-91', date: new Date(refDate.getTime() - 91 * dayMs).toISOString().split('T')[0], amount: 7000, type: 'INCOME', status: 'INVOICED' }
    ];

    const ar = oracle.calculateARAging({ transactions: txs, referenceDate: refDate });
    expect(ar.current_0_30).toBe(3000.00);    // 1000 + 2000
    expect(ar.pending_31_60).toBe(7000.00);   // 3000 + 4000
    expect(ar.overdue_61_90).toBe(11000.00);  // 5000 + 6000
    expect(ar.critical_90_plus).toBe(7000.00); // 7000
    expect(ar.total_receivable).toBe(28000.00);
    expect(ar.traffic_light).toBe('RED');
  });

  test('test_ar_traffic_light_states_green_yellow_red', () => {
    const refDate = new Date('2026-08-30T12:00:00Z');
    const dayMs = 86400000;

    // Green state: only 0-30 and 31-60
    const greenTxs = [
      { date: new Date(refDate.getTime() - 10 * dayMs).toISOString().split('T')[0], amount: 5000, type: 'INCOME', status: 'INVOICED' },
      { date: new Date(refDate.getTime() - 40 * dayMs).toISOString().split('T')[0], amount: 5000, type: 'INCOME', status: 'INVOICED' }
    ];
    const arGreen = oracle.calculateARAging({ transactions: greenTxs, referenceDate: refDate });
    expect(arGreen.traffic_light).toBe('GREEN');

    // Yellow state: has 61-90 overdue but no 90+
    const yellowTxs = [
      ...greenTxs,
      { date: new Date(refDate.getTime() - 75 * dayMs).toISOString().split('T')[0], amount: 3000, type: 'INCOME', status: 'INVOICED' }
    ];
    const arYellow = oracle.calculateARAging({ transactions: yellowTxs, referenceDate: refDate });
    expect(arYellow.traffic_light).toBe('YELLOW');

    // Red state: has 90+ critical
    const redTxs = [
      ...yellowTxs,
      { date: new Date(refDate.getTime() - 120 * dayMs).toISOString().split('T')[0], amount: 2000, type: 'INCOME', status: 'INVOICED' }
    ];
    const arRed = oracle.calculateARAging({ transactions: redTxs, referenceDate: refDate });
    expect(arRed.traffic_light).toBe('RED');
  });

  test('test_future_dated_invoiced_transactions_do_not_produce_negative_age', () => {
    const refDate = new Date('2026-08-30T12:00:00Z');
    // Future date: 2026-09-30 (+31 days into future)
    const futureTxs = [
      { date: '2026-09-30', amount: 15000, type: 'INCOME', status: 'INVOICED' }
    ];

    const ar = oracle.calculateARAging({ transactions: futureTxs, referenceDate: refDate });
    expect(ar.current_0_30).toBe(15000.00);
    expect(ar.total_receivable).toBe(15000.00);
    expect(ar.traffic_light).toBe('GREEN');
  });

  test('test_cleared_and_paid_income_transactions_excluded_from_ar_aging', async () => {
    await app.transaction_create({
      input: { date: '2026-05-01', type: 'INCOME', amount: 10000, status: 'CLEARED' } // >90 days old but cleared
    });
    await app.transaction_create({
      input: { date: '2026-05-01', type: 'INCOME', amount: 10000, status: 'PAID' } // >90 days old but paid
    });
    await app.transaction_create({
      input: { date: '2026-08-25', type: 'INCOME', amount: 4000, status: 'INVOICED' } // Active receivable
    });

    const ar = await app.analytics_get_ar_aging();
    expect(ar.total_receivable).toBe(4000.00);
    expect(ar.critical_90_plus).toBe(0.00);
    expect(ar.traffic_light).toBe('GREEN');
  });
});
