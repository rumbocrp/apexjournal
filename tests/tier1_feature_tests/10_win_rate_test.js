const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 1 - Feature 10: Executive KPI Win Rate Engine', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'WinRatePassword2026!' });
  });

  test('test_win_rate_100_percent_when_all_closed_cases_completed', async () => {
    await app.case_create({ input: { title: 'Case 1', client_name: 'Client A', stage: 'COMPLETED' } });
    await app.case_create({ input: { title: 'Case 2', client_name: 'Client B', stage: 'COMPLETED' } });
    await app.case_create({ input: { title: 'Case 3', client_name: 'Client C', stage: 'COMPLETED' } });

    const metrics = await app.analytics_get_dashboard();
    expect(metrics.proposal_win_rate).toBe(100.00);
  });

  test('test_win_rate_0_percent_when_all_closed_cases_lost', async () => {
    await app.case_create({ input: { title: 'Lost 1', client_name: 'Client X', stage: 'LOST' } });
    await app.case_create({ input: { title: 'Lost 2', client_name: 'Client Y', stage: 'LOST' } });

    const metrics = await app.analytics_get_dashboard();
    expect(metrics.proposal_win_rate).toBe(0.00);
  });

  test('test_win_rate_mixed_completed_and_lost', async () => {
    // 3 Won, 1 Lost -> 3/4 = 75.0%
    await app.case_create({ input: { title: 'Won 1', client_name: 'Client 1', stage: 'COMPLETED' } });
    await app.case_create({ input: { title: 'Won 2', client_name: 'Client 2', stage: 'COMPLETED' } });
    await app.case_create({ input: { title: 'Won 3', client_name: 'Client 3', stage: 'COMPLETED' } });
    await app.case_create({ input: { title: 'Lost 1', client_name: 'Client 4', stage: 'LOST' } });

    const metrics = await app.analytics_get_dashboard();
    expect(metrics.proposal_win_rate).toBe(75.00);
  });

  test('test_win_rate_ignores_leads_and_active_projects', async () => {
    // 1 Won, 1 Lost, 5 Active, 5 Leads -> 1/2 = 50.0%
    await app.case_create({ input: { title: 'Won', client_name: 'Client 1', stage: 'COMPLETED' } });
    await app.case_create({ input: { title: 'Lost', client_name: 'Client 2', stage: 'LOST' } });
    await app.case_create({ input: { title: 'Active', client_name: 'Client 3', stage: 'ACTIVE' } });
    await app.case_create({ input: { title: 'Lead', client_name: 'Client 4', stage: 'LEAD' } });
    await app.case_create({ input: { title: 'Quotation', client_name: 'Client 5', stage: 'QUOTATION' } });

    const metrics = await app.analytics_get_dashboard();
    expect(metrics.proposal_win_rate).toBe(50.00);
  });

  test('test_win_rate_updates_on_case_transition', async () => {
    const cs = await app.case_create({
      input: { title: 'Opportunity', client_name: 'Target Client', stage: 'QUOTATION' }
    });

    let metrics = await app.analytics_get_dashboard();
    expect(metrics.proposal_win_rate).toBe(0.00);

    await app.case_update({ id: cs.id, input: { stage: 'COMPLETED' } });
    metrics = await app.analytics_get_dashboard();
    expect(metrics.proposal_win_rate).toBe(100.00);
  });
});
