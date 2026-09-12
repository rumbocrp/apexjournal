const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 1 - Feature 04: Auto-Lock & Session Inactivity', () => {
  let app;
  const password = 'AutoLockPassword2026!';

  beforeEach(async () => {
    app = new ApexJournalTestInstance({ autoLockMinutes: 5 });
    await app.vault_setup({ masterPassword: password });
  });

  test('test_manual_vault_lock_drops_decryption_state', async () => {
    await app.vault_lock();
    const status = await app.vault_get_status();
    expect(status.unlocked).toBe(false);
    expect(app.derivedKey).toBeNull();
  });

  test('test_queries_fail_when_locked', async () => {
    await app.vault_lock();
    let threw = false;
    try {
      await app.transaction_list();
    } catch (err) {
      threw = true;
      expect(err.message).toContain('locked');
    }
    expect(threw).toBe(true);
  });

  test('test_case_operations_fail_when_locked', async () => {
    await app.vault_lock();
    let threw = false;
    try {
      await app.case_create({
        input: { title: 'Test Locked Case', client_name: 'Acme Corp' }
      });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('locked');
    }
    expect(threw).toBe(true);
  });

  test('test_re_unlock_restores_data_access', async () => {
    await app.transaction_create({
      input: {
        date: '2026-08-30',
        type: 'INCOME',
        amount: 5000,
        currency: 'USD'
      }
    });

    await app.vault_lock();
    await app.vault_unlock({ masterPassword: password });

    const txs = await app.transaction_list();
    expect(txs.length).toBe(1);
    expect(txs[0].amount).toBe(5000);
  });

  test('test_vault_get_status_reflects_locked_state', async () => {
    await app.vault_lock();
    const status = await app.vault_get_status();
    expect(status.initialized).toBe(true);
    expect(status.unlocked).toBe(false);
    expect(status.autoLockMinutes).toBe(5);
  });
});
