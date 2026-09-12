const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 3 - Pairwise 05: Milestone Completion -> Invoiced Volume Sync', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'MilestoneSyncPassword2026!' });
  });

  test('test_milestone_workflow_links_to_case_completion_and_avg_ticket', async () => {
    const cs = await app.case_create({
      input: { title: 'Enterprise Portal', client_name: 'Global Logix', quoted_amount: 60000, stage: 'ACTIVE' }
    });

    const m1 = await app.milestone_create({ input: { case_id: cs.id, title: 'Architecture Deliverable', amount: 20000, completed: false } });
    const m2 = await app.milestone_create({ input: { case_id: cs.id, title: 'MVP Deliverable', amount: 40000, completed: false } });

    await app.milestone_toggle({ id: m1.id, completed: true });
    await app.transaction_create({ input: { date: '2026-08-01', type: 'INCOME', amount: 20000, case_id: cs.id, status: 'CLEARED' } });

    await app.milestone_toggle({ id: m2.id, completed: true });
    await app.transaction_create({ input: { date: '2026-08-15', type: 'INCOME', amount: 40000, case_id: cs.id, status: 'CLEARED' } });

    await app.case_update({ id: cs.id, input: { stage: 'COMPLETED' } });

    const metrics = await app.analytics_get_dashboard();
    expect(metrics.realized_volume).toBe(60000.00);
    expect(metrics.avg_ticket_size).toBe(60000.00);
    expect(metrics.proposal_win_rate).toBe(100.00);
  });
});
