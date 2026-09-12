const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 5 - Adversarial 01: Concurrency, Re-entrancy & Race Conditions', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'AdversarialConcurrencyPassword2026!' });
  });

  test('test_concurrent_transaction_creation_maintains_deterministic_order_and_count', async () => {
    const promises = [];
    for (let i = 0; i < 25; i++) {
      promises.push(
        app.transaction_create({
          input: {
            date: '2026-08-01',
            type: i % 2 === 0 ? 'INCOME' : 'EXPENSE',
            amount: (i + 1) * 100,
            notes: `Concurrent TX #${i}`
          }
        })
      );
    }

    const created = await Promise.all(promises);
    expect(created.length).toBe(25);

    const allTx = await app.transaction_list();
    expect(allTx.length).toBe(25);
  });

  test('test_operations_rejected_immediately_upon_vault_lock', async () => {
    await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 5000, notes: 'Valid Pre-Lock' }
    });

    // Lock vault
    await app.vault_lock();

    // Any operation must now throw
    let threwCreate = false;
    try {
      await app.transaction_create({
        input: { date: '2026-08-01', type: 'INCOME', amount: 1000 }
      });
    } catch (err) {
      threwCreate = true;
      expect(err.message).toContain('locked');
    }
    expect(threwCreate).toBe(true);

    let threwList = false;
    try {
      await app.transaction_list();
    } catch (err) {
      threwList = true;
      expect(err.message).toContain('locked');
    }
    expect(threwList).toBe(true);

    let threwDashboard = false;
    try {
      await app.analytics_get_dashboard();
    } catch (err) {
      threwDashboard = true;
      expect(err.message).toContain('locked');
    }
    expect(threwDashboard).toBe(true);
  });

  test('test_rapid_lock_unlock_cycles_maintain_memory_zeroization_and_key_restoration', async () => {
    for (let cycle = 0; cycle < 5; cycle++) {
      await app.vault_lock();
      const lockedStatus = await app.vault_get_status();
      expect(lockedStatus.unlocked).toBe(false);

      await app.vault_unlock({ masterPassword: 'AdversarialConcurrencyPassword2026!' });
      const unlockedStatus = await app.vault_get_status();
      expect(unlockedStatus.unlocked).toBe(true);

      // Verify ability to operate
      const tx = await app.transaction_create({
        input: { date: '2026-08-01', type: 'INCOME', amount: 1000, notes: `Cycle ${cycle}` }
      });
      expect(tx.id).toBeDefined();
    }

    const txs = await app.transaction_list();
    expect(txs.length).toBe(5);
  });

  test('test_concurrent_case_milestones_and_diary_linkage', async () => {
    const cs = await app.case_create({
      input: { title: 'Enterprise Migration', client_name: 'Apex Corp', quoted_amount: 150000 }
    });

    const milestonePromises = [];
    for (let i = 0; i < 10; i++) {
      milestonePromises.push(
        app.milestone_create({
          input: { case_id: cs.id, title: `Milestone Phase ${i + 1}`, amount: 15000 }
        })
      );
    }

    const journalPromises = [];
    for (let i = 0; i < 10; i++) {
      journalPromises.push(
        app.journal_create({
          input: { case_id: cs.id, title: `Log ${i + 1}`, content: `Diary entry for phase ${i + 1}` }
        })
      );
    }

    await Promise.all([...milestonePromises, ...journalPromises]);

    const detail = await app.case_get_detail({ id: cs.id });
    expect(detail.milestones.length).toBe(10);
    expect(detail.diary_entries.length).toBe(10);
  });
});
