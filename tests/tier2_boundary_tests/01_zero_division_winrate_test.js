const { describe, test, expect, beforeEach, ApexJournalTestInstance, oracle } = require('../harness');

describe('Tier 2 - Boundary 01: 0-Division Win Rate Prevention', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'ZeroDivisionPassword2026!' });
  });

  test('test_win_rate_with_zero_proposals_returns_zero', async () => {
    const rate = oracle.calculateWinRate({ cases: [] });
    expect(rate).toBe(0.00);
    expect(Number.isFinite(rate)).toBe(true);
    expect(Number.isNaN(rate)).toBe(false);
  });

  test('test_win_rate_with_only_leads_returns_zero', async () => {
    await app.case_create({ input: { title: 'Lead 1', client_name: 'Acme', stage: 'LEAD' } });
    await app.case_create({ input: { title: 'Lead 2', client_name: 'Beta', stage: 'LEAD' } });

    const metrics = await app.analytics_get_dashboard();
    expect(metrics.proposal_win_rate).toBe(0.00);
    expect(Number.isNaN(metrics.proposal_win_rate)).toBe(false);
  });

  test('test_win_rate_with_only_active_projects_returns_zero', async () => {
    await app.case_create({ input: { title: 'Active 1', client_name: 'Gamma', stage: 'ACTIVE' } });
    const metrics = await app.analytics_get_dashboard();
    expect(metrics.proposal_win_rate).toBe(0.00);
  });

  test('test_win_rate_with_only_quotations_returns_zero', async () => {
    await app.case_create({ input: { title: 'Quotation 1', client_name: 'Delta', stage: 'QUOTATION' } });
    const metrics = await app.analytics_get_dashboard();
    expect(metrics.proposal_win_rate).toBe(0.00);
  });

  test('test_win_rate_formula_strictly_returns_finite_number', () => {
    const rate = oracle.calculateWinRate({ cases: [] });
    expect(typeof rate).toBe('number');
    expect(rate).toBe(0.00);
  });
});
