const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 4 - Workload 01: Multi-National Digital Agency Annual Lifecycle', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance({ baseCurrency: 'USD' });
    await app.vault_setup({ masterPassword: 'AgencyAnnualPassword2026!' });
  });

  test('test_12_month_digital_agency_lifecycle_with_multicurrency_clients', async () => {
    // Client A: $120,000 USD Annual Retainer ($10k / month)
    const caseA = await app.case_create({ input: { title: 'Enterprise Advisory Retainer', client_name: 'Acme Global', stage: 'ACTIVE', quoted_amount: 120000 } });
    for (let month = 1; month <= 12; month++) {
      const date = '2026-' + String(month).padStart(2, '0') + '-01';
      await app.transaction_create({ input: { date, type: 'INCOME', amount: 10000, currency: 'USD', case_id: caseA.id, status: 'CLEARED' } });
    }

    // Client B: 80,000 EUR Cloud Migration (@ 1.0850 = $86,800 USD)
    const caseB = await app.case_create({ input: { title: 'Cloud Transformation', client_name: 'Euro FinTech', stage: 'COMPLETED', quoted_amount: 86800 } });
    await app.transaction_create({ input: { date: '2026-03-15', type: 'INCOME', amount: 40000, currency: 'EUR', exchange_rate: 1.0850, case_id: caseB.id, status: 'CLEARED' } });
    await app.transaction_create({ input: { date: '2026-06-15', type: 'INCOME', amount: 40000, currency: 'EUR', exchange_rate: 1.0850, case_id: caseB.id, status: 'CLEARED' } });

    // Client C: 50,000 GBP Strategy (@ 1.28 = $64,000 USD)
    const caseC = await app.case_create({ input: { title: 'UK Market Expansion', client_name: 'London Retail', stage: 'COMPLETED', quoted_amount: 64000 } });
    await app.transaction_create({ input: { date: '2026-09-01', type: 'INCOME', amount: 50000, currency: 'GBP', exchange_rate: 1.2800, case_id: caseC.id, status: 'CLEARED' } });

    // Client D: Lost proposal
    await app.case_create({ input: { title: 'Legacy Modernization', client_name: 'Delta Corp', stage: 'LOST', quoted_amount: 30000 } });

    // Monthly Operational Expenses (SaaS, Subcontractors, Travel)
    for (let month = 1; month <= 12; month++) {
      const date = '2026-' + String(month).padStart(2, '0') + '-28';
      await app.transaction_create({ input: { date, type: 'EXPENSE', amount: 3500, currency: 'USD', status: 'CLEARED', notes: 'Monthly Operations & SaaS' } });
    }

    // Assertions across 12-month agency operations:
    // Total Cleared Inflow = 120,000 + 86,800 + 64,000 = $270,800 USD
    // Total Cleared Outflow = 12 * 3,500 = $42,000 USD
    // Net Margin = $228,800 USD
    const metrics = await app.analytics_get_dashboard();
    expect(metrics.realized_volume).toBe(270800.00);
    expect(metrics.cumulative_net_margin).toBe(228800.00);
    // Win rate: 2 completed (B, C) / 3 closed (B, C, D) = 66.67%
    expect(metrics.proposal_win_rate).toBeCloseTo(66.67, 1);

    const curve = await app.analytics_get_equity_curve({ timeframe: 'ALL' });
    expect(curve.length).toBeGreaterThanOrEqual(15);
    expect(curve[curve.length - 1].cumulative_equity).toBe(228800.00);

    const csv = await app.export_csv({ exportType: 'transactions' });
    expect(csv.split('\n').length).toBeGreaterThanOrEqual(27);
  });
});
