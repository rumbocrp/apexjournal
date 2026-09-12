const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 1 - Feature 01: Vault Setup', () => {
  let app;

  beforeEach(() => {
    app = new ApexJournalTestInstance();
  });

  test('test_vault_setup_initializes_empty_vault', async () => {
    const status = await app.vault_setup({ masterPassword: 'CorrectHorseBatteryStaple123!' });
    expect(status.initialized).toBe(true);
    expect(status.unlocked).toBe(true);
  });

  test('test_vault_setup_rejects_short_password', async () => {
    let threw = false;
    try {
      await app.vault_setup({ masterPassword: 'short' });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('at least 8 characters');
    }
    expect(threw).toBe(true);
    const status = await app.vault_get_status();
    expect(status.initialized).toBe(false);
  });

  test('test_vault_setup_rejects_empty_password', async () => {
    let threw = false;
    try {
      await app.vault_setup({ masterPassword: '' });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('at least 8 characters');
    }
    expect(threw).toBe(true);
  });

  test('test_vault_setup_prevents_duplicate_initialization', async () => {
    await app.vault_setup({ masterPassword: 'MasterPassword2026!' });
    let threw = false;
    try {
      await app.vault_setup({ masterPassword: 'SecondPassword2026!' });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('already initialized');
    }
    expect(threw).toBe(true);
  });

  test('test_vault_setup_initializes_default_categories', async () => {
    await app.vault_setup({ masterPassword: 'MasterPassword2026!' });
    const categories = await app.category_list();
    expect(categories.length).toBeGreaterThanOrEqual(4);
    const names = categories.map(c => c.name);
    expect(names).toContain('Client Consulting Fee');
    expect(names).toContain('Retainer');
  });

  test('test_vault_setup_enables_biometric_if_supported', async () => {
    const status = await app.vault_setup({ masterPassword: 'MasterPassword2026!' });
    expect(status.biometricAvailable).toBe(true);
  });
});
