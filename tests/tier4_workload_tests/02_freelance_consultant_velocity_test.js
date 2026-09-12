const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 4 - Workload 02: High-Velocity Freelance Strategy Consultant', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'FreelanceVelocity2026!' });
  });

  test('test_rapid_proposal_pitching_and_milestone_deliveries', async () => {
    // 7 Won proposals, 3 Lost proposals (70% win rate)
    for (let i = 1; i <= 7; i++) {
      const cs = await app.case_create({ input: { title: 'Consulting Sprint #' + i, client_name: 'Client ' + i, stage: 'COMPLETED', quoted_amount: 15000 } });
      await app.transaction_create({ input: { date: '2026-08-' + String(i).padStart(2, '0'), type: 'INCOME', amount: 15000, case_id: cs.id, status: 'CLEARED' } });
    }
    for (let i = 8; i <= 10; i++) {
      await app.case_create({ input: { title: 'Lost Pitch #' + i, client_name: 'Client ' + i, stage: 'LOST', quoted_amount: 10000 } });
    }

    const metrics = await app.analytics_get_dashboard();
    expect(metrics.proposal_win_rate).toBe(70.00);
    expect(metrics.realized_volume).toBe(105000.00);
    expect(metrics.avg_ticket_size).toBe(15000.00);
  });
});
