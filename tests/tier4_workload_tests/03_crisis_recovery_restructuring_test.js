const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 4 - Workload 03: Crisis Recovery & Restructuring Engagement', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'CrisisRecoveryPassword2026!' });
  });

  test('test_troubled_project_with_cost_overrun_and_subsequent_recovery', async () => {
    const today = new Date();
    const d100 = new Date(today.getTime() - 100 * 86400000).toISOString().split('T')[0];

    const cs = await app.case_create({
      input: { title: 'Crisis Restructuring', client_name: 'Distressed Asset Corp', quoted_amount: 25000, stage: 'ACTIVE' }
    });

    // Subcontractor expense overruns ($30k incurred on $25k quoted case)
    await app.transaction_create({ input: { date: '2026-05-01', type: 'EXPENSE', amount: 15000, case_id: cs.id, status: 'CLEARED' } });
    await app.transaction_create({ input: { date: '2026-05-15', type: 'EXPENSE', amount: 15000, case_id: cs.id, status: 'CLEARED' } });

    // Client invoice delayed past 90 days
    const invoiceTx = await app.transaction_create({
      input: { date: d100, type: 'INCOME', amount: 25000, case_id: cs.id, status: 'INVOICED' }
    });

    let detail = await app.case_get_detail({ id: cs.id });
    expect(detail.net_margin).toBe(-30000.00); // Plunged into deep red

    let ar = await app.analytics_get_ar_aging();
    expect(ar.critical_90_plus).toBe(25000.00);
    expect(ar.traffic_light).toBe('RED');

    // Renegotiation: Emergency scope recovery payment cleared + change order
    await app.transaction_update({ id: invoiceTx.id, input: { status: 'CLEARED' } });
    await app.transaction_create({ input: { date: '2026-08-25', type: 'INCOME', amount: 15000, case_id: cs.id, status: 'CLEARED', notes: 'Change Order Surcharge' } });

    // Re-verify PnL recovered to positive margin ($40k income - $30k expense = +$10k)
    detail = await app.case_get_detail({ id: cs.id });
    expect(detail.net_margin).toBe(10000.00);
    expect(detail.profit_margin_pct).toBe(25.00);

    ar = await app.analytics_get_ar_aging();
    expect(ar.traffic_light).toBe('GREEN');
  });
});
