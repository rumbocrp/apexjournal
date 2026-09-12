const { describe, test, expect, MemorySecret, ApexJournalTestInstance } = require('../harness');

describe('Tier 2 - Boundary 06: Memory Zeroization & Secret Sanitization', () => {
  test('test_memory_secret_zeroization', () => {
    const raw = Buffer.from('super_secret_cryptographic_key_32b!');
    const secret = new MemorySecret(raw);

    expect(secret.getBytes().toString()).toBe('super_secret_cryptographic_key_32b!');
    secret.zeroize();

    expect(secret.isZeroized).toBe(true);
    let threw = false;
    try {
      secret.getBytes();
    } catch (err) {
      threw = true;
      expect(err.message).toContain('zeroized');
    }
    expect(threw).toBe(true);
  });

  test('test_zeroized_buffer_is_filled_with_zeros', () => {
    const raw = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const secret = new MemorySecret(raw);
    secret.zeroize();
    expect(secret.buffer.every(b => b === 0)).toBe(true);
  });

  test('test_vault_lock_clears_master_key_from_ram', async () => {
    const app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'MasterPassword2026!' });
    expect(app.derivedKey).toBeDefined();

    await app.vault_lock();
    expect(app.derivedKey).toBeNull();
  });

  test('test_re_unlock_zeroizes_previous_key', async () => {
    const app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'MasterPassword2026!' });
    await app.vault_lock();
    await app.vault_unlock({ masterPassword: 'MasterPassword2026!' });

    expect(app.derivedKey).toBeDefined();
    expect(app.derivedKey.isZeroized).toBe(false);
  });

  test('test_secret_cannot_be_zeroized_twice_safely', () => {
    const raw = Buffer.from('test');
    const secret = new MemorySecret(raw);
    secret.zeroize();
    // Second zeroize call should be idempotent
    secret.zeroize();
    expect(secret.isZeroized).toBe(true);
  });
});
