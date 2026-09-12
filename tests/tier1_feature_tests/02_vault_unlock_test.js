const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 1 - Feature 02: Vault Unlock', () => {
  let app;
  const password = 'SuperSecureMasterPassword2026!';

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: password });
    await app.vault_lock();
  });

  test('test_vault_unlock_with_correct_password', async () => {
    const status = await app.vault_unlock({ masterPassword: password });
    expect(status.unlocked).toBe(true);
    expect(status.initialized).toBe(true);
  });

  test('test_vault_unlock_returns_vault_status', async () => {
    const status = await app.vault_unlock({ masterPassword: password });
    expect(status).toEqual({
      initialized: true,
      unlocked: true,
      biometricAvailable: true,
      autoLockMinutes: 15
    });
  });

  test('test_vault_unlock_biometric_when_enrolled', async () => {
    const status = await app.vault_unlock_biometric();
    expect(status.unlocked).toBe(true);
  });

  test('test_vault_unlock_resets_activity_timer', async () => {
    const before = Date.now();
    await app.vault_unlock({ masterPassword: password });
    expect(app.lastActivityTimestamp).toBeGreaterThanOrEqual(before);
  });

  test('test_vault_unlock_on_uninitialized_vault_fails', async () => {
    const freshApp = new ApexJournalTestInstance();
    let threw = false;
    try {
      await freshApp.vault_unlock({ masterPassword: password });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('not initialized');
    }
    expect(threw).toBe(true);
  });
});
