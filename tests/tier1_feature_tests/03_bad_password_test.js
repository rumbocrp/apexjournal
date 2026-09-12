const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 1 - Feature 03: Bad Password Rejection', () => {
  let app;
  const validPassword = 'ApexJournalMasterKey#2026!';

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: validPassword });
    await app.vault_lock();
  });

  test('test_unlock_rejects_wrong_password', async () => {
    let threw = false;
    try {
      await app.vault_unlock({ masterPassword: 'WrongPassword123!' });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('Authentication failed');
    }
    expect(threw).toBe(true);
    const status = await app.vault_get_status();
    expect(status.unlocked).toBe(false);
  });

  test('test_unlock_rejects_truncated_password', async () => {
    let threw = false;
    try {
      await app.vault_unlock({ masterPassword: validPassword.slice(0, 10) });
    } catch (err) {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  test('test_unlock_rejects_case_mismatch', async () => {
    let threw = false;
    try {
      await app.vault_unlock({ masterPassword: validPassword.toLowerCase() });
    } catch (err) {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  test('test_unlock_rejects_special_character_variant', async () => {
    let threw = false;
    try {
      await app.vault_unlock({ masterPassword: 'ApexJournalMasterKey#2026?' });
    } catch (err) {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  test('test_unlock_leaves_vault_locked_after_failure', async () => {
    try {
      await app.vault_unlock({ masterPassword: 'invalid' });
    } catch {
      // Expected
    }
    const status = await app.vault_get_status();
    expect(status.unlocked).toBe(false);
  });
});
