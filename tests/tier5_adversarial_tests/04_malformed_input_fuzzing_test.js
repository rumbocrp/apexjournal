const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 5 - Adversarial 04: Malformed Input Fuzzing, Injection & Unicode/RTL', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'AdversarialFuzzingPassword2026!' });
  });

  test('test_sql_injection_payloads_in_case_and_transaction_notes_are_safely_persisted', async () => {
    const sqlPayloads = [
      "'; DROP TABLE transactions; --",
      "' OR '1'='1",
      "UNION SELECT * FROM sqlite_master WHERE '1'='1",
      "admin'--",
      "'; VACUUM; --"
    ];

    for (let i = 0; i < sqlPayloads.length; i++) {
      const payload = sqlPayloads[i];
      const cs = await app.case_create({
        input: { title: `SQL Case: ${payload}`, client_name: `Client ${payload}` }
      });
      expect(cs.title).toBe(`SQL Case: ${payload}`);

      const tx = await app.transaction_create({
        input: {
          date: '2026-08-01',
          type: 'INCOME',
          amount: 1000,
          case_id: cs.id,
          notes: `Notes: ${payload}`
        }
      });
      expect(tx.notes).toBe(`Notes: ${payload}`);
    }

    // Ensure database remained intact and all 5 cases exist
    const cases = await app.case_list();
    expect(cases.length).toBe(5);
  });

  test('test_xss_and_script_injection_payloads_in_journal_are_unaltered', async () => {
    const xssPayload = "<script>alert('xss_attack')</script><img src=x onerror=alert(1)>";
    const entry = await app.journal_create({
      input: { title: 'Security Advisory', content: xssPayload, tags: ['security', '<tag>'] }
    });
    expect(entry.content).toBe(xssPayload);

    const list = await app.journal_list();
    expect(list[0].content).toBe(xssPayload);
  });

  test('test_unicode_emojis_and_rtl_arabic_hebrew_strings_handled_correctly', async () => {
    const rtlTitle = "مشروع استشارات استراتيجية ⚡ 🚀 (Apex Strategy)";
    const arabicClient = "شركة الشرق الأوسط للتكنولوجيا";
    const hebrewNotes = "ייעוץ פיננסי מתקדם 💼 📈";

    const cs = await app.case_create({
      input: { title: rtlTitle, client_name: arabicClient, quoted_amount: 75000 }
    });
    expect(cs.title).toBe(rtlTitle);
    expect(cs.client_name).toBe(arabicClient);

    const tx = await app.transaction_create({
      input: {
        date: '2026-08-01',
        type: 'INCOME',
        amount: 25000,
        case_id: cs.id,
        notes: hebrewNotes
      }
    });
    expect(tx.notes).toBe(hebrewNotes);

    const csv = await app.export_csv({ exportType: 'transactions' });
    expect(csv).toContain(hebrewNotes);
  });

  test('test_rfc4180_csv_escaping_with_complex_embedded_quotes_commas_and_newlines', async () => {
    const nastyNotes = 'Line 1 with, "quotes", and commas\nLine 2 with \r\n CRLF and "nested "quotes""';
    await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 1234.56, notes: nastyNotes }
    });

    const csv = await app.export_csv({ exportType: 'transactions' });
    // CSV output must wrap field in quotes and double internal quotes
    expect(csv).toContain('Line 1 with, ""quotes"", and commas');
    expect(csv).toContain('nested ""quotes""""');
  });

  test('test_empty_or_whitespace_titles_are_rejected', async () => {
    let threwEmptyCase = false;
    try {
      await app.case_create({ input: { title: '   ', client_name: 'Valid Client' } });
    } catch (err) {
      threwEmptyCase = true;
      expect(err.message).toContain('Case title is required');
    }
    expect(threwEmptyCase).toBe(true);

    let threwEmptyClient = false;
    try {
      await app.case_create({ input: { title: 'Valid Title', client_name: '   ' } });
    } catch (err) {
      threwEmptyClient = true;
      expect(err.message).toContain('Client name is required');
    }
    expect(threwEmptyClient).toBe(true);

    let threwEmptyJournal = false;
    try {
      await app.journal_create({ input: { content: '   ' } });
    } catch (err) {
      threwEmptyJournal = true;
      expect(err.message).toContain('content cannot be empty');
    }
    expect(threwEmptyJournal).toBe(true);
  });
});
