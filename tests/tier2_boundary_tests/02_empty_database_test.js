const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 2 - Boundary 02: Empty Database Operations', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'EmptyDatabasePassword2026!' });
  });

  test('test_empty_database_dashboard_metrics', async () => {
    const metrics = await app.analytics_get_dashboard();
    expect(metrics).toEqual({
      cumulative_net_margin: 0.00,
      proposal_win_rate: 0.00,
      realized_volume: 0.00,
      invoiced_volume: 0.00,
      avg_ticket_size: 0.00,
      base_currency: 'USD'
    });
  });

  test('test_empty_database_equity_curve', async () => {
    const curve = await app.analytics_get_equity_curve({ timeframe: 'ALL' });
    expect(curve).toEqual([]);
  });

  test('test_empty_database_ar_aging', async () => {
    const ar = await app.analytics_get_ar_aging();
    expect(ar).toEqual({
      current_0_30: 0.00,
      pending_31_60: 0.00,
      overdue_61_90: 0.00,
      critical_90_plus: 0.00,
      total_receivable: 0.00,
      traffic_light: 'GREEN'
    });
  });

  test('test_empty_database_transaction_list', async () => {
    const txs = await app.transaction_list();
    expect(txs).toEqual([]);
  });

  test('test_empty_database_case_list', async () => {
    const cases = await app.case_list();
    expect(cases).toEqual([]);
  });
});
