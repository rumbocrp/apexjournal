const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 1 - Feature 13: CSV Data Export', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'CSVExportPassword2026!' });
  });

  test('test_export_transactions_csv_headers_and_rows', async () => {
    await app.transaction_create({
      input: {
        date: '2026-08-01',
        type: 'INCOME',
        amount: 5000.00,
        currency: 'USD',
        status: 'CLEARED',
        notes: 'Monthly Retainer'
      }
    });

    const csv = await app.export_csv({ exportType: 'transactions' });
    const lines = csv.split('\n');
    expect(lines[0]).toBe('ID,Date,Type,Category,Amount,Currency,ExchangeRate,BaseAmount,Status,Case,Notes');
    expect(lines[1]).toContain('2026-08-01');
    expect(lines[1]).toContain('5000.00');
    expect(lines[1]).toContain('CLEARED');
  });

  test('test_export_cases_csv', async () => {
    await app.case_create({
      input: { title: 'Strategy Overhaul', client_name: 'Zenith Tech', quoted_amount: 45000, stage: 'ACTIVE' }
    });

    const csv = await app.export_csv({ exportType: 'cases' });
    const lines = csv.split('\n');
    expect(lines[0]).toBe('ID,Title,Client,Stage,QuotedAmount,Currency,CreatedAt,UpdatedAt');
    expect(lines[1]).toContain('"Strategy Overhaul"');
    expect(lines[1]).toContain('"Zenith Tech"');
    expect(lines[1]).toContain('ACTIVE');
  });

  test('test_export_journal_csv', async () => {
    await app.journal_create({
      input: { title: 'Sprint Review', content: 'Delivered phase 1 successfully.', tags: ['#sprint', '#review'] }
    });

    const csv = await app.export_csv({ exportType: 'journal' });
    const lines = csv.split('\n');
    expect(lines[0]).toBe('ID,Date,Title,Content,CaseID,Tags,CreatedAt');
    expect(lines[1]).toContain('"Sprint Review"');
    expect(lines[1]).toContain('#sprint;#review');
  });

  test('test_export_csv_escapes_commas_and_quotes', async () => {
    await app.transaction_create({
      input: {
        date: '2026-08-05',
        type: 'EXPENSE',
        amount: 250.00,
        notes: 'Dinner with "VIP" Client, including drinks'
      }
    });

    const csv = await app.export_csv({ exportType: 'transactions' });
    expect(csv).toContain('"Dinner with ""VIP"" Client, including drinks"');
  });

  test('test_export_csv_empty_tables', async () => {
    const csv = await app.export_csv({ exportType: 'transactions' });
    const lines = csv.split('\n');
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('ID,Date,Type');
  });
});
