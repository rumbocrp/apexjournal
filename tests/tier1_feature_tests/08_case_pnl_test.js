const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 1 - Feature 08: Case PnL Calculation', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'CasePnLPassword2026!' });
  });

  test('test_case_pnl_with_only_income_has_100_percent_margin', async () => {
    const cs = await app.case_create({
      input: { title: 'Enterprise Modernization', client_name: 'Alpha Bank', quoted_amount: 25000 }
    });

    await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 20000, case_id: cs.id, status: 'CLEARED' }
    });

    const detail = await app.case_get_detail({ id: cs.id });
    expect(detail.realized_income).toBe(20000.00);
    expect(detail.realized_expense).toBe(0.00);
    expect(detail.net_margin).toBe(20000.00);
    expect(detail.profit_margin_pct).toBe(100.00);
  });

  test('test_case_pnl_with_income_and_expenses', async () => {
    const cs = await app.case_create({
      input: { title: 'Cloud Migration', client_name: 'Beta Healthcare', quoted_amount: 30000 }
    });

    await app.transaction_create({
      input: { date: '2026-08-05', type: 'INCOME', amount: 30000, case_id: cs.id, status: 'CLEARED' }
    });
    await app.transaction_create({
      input: { date: '2026-08-06', type: 'EXPENSE', amount: 8500, case_id: cs.id, status: 'CLEARED' }
    });

    const detail = await app.case_get_detail({ id: cs.id });
    expect(detail.realized_income).toBe(30000.00);
    expect(detail.realized_expense).toBe(8500.00);
    expect(detail.net_margin).toBe(21500.00);
    expect(detail.profit_margin_pct).toBeCloseTo(71.67, 1);
  });

  test('test_case_pnl_with_loss_exceeding_income', async () => {
    const cs = await app.case_create({
      input: { title: 'Security Audit Overrun', client_name: 'Gamma Labs', quoted_amount: 5000 }
    });

    await app.transaction_create({
      input: { date: '2026-08-10', type: 'INCOME', amount: 5000, case_id: cs.id, status: 'CLEARED' }
    });
    await app.transaction_create({
      input: { date: '2026-08-12', type: 'EXPENSE', amount: 7000, case_id: cs.id, status: 'CLEARED' }
    });

    const detail = await app.case_get_detail({ id: cs.id });
    expect(detail.net_margin).toBe(-2000.00);
    expect(detail.profit_margin_pct).toBe(-40.00);
  });

  test('test_case_pnl_with_zero_transactions', async () => {
    const cs = await app.case_create({
      input: { title: 'Unstarted Lead', client_name: 'Delta Corp' }
    });

    const detail = await app.case_get_detail({ id: cs.id });
    expect(detail.realized_income).toBe(0.00);
    expect(detail.realized_expense).toBe(0.00);
    expect(detail.net_margin).toBe(0.00);
    expect(detail.profit_margin_pct).toBe(0.00);
  });

  test('test_case_pnl_with_multicurrency_transactions', async () => {
    const cs = await app.case_create({
      input: { title: 'Global Consulting', client_name: 'Euro Fin' }
    });

    await app.transaction_create({
      input: { date: '2026-08-15', type: 'INCOME', amount: 10000, currency: 'USD', exchange_rate: 1.0, case_id: cs.id }
    });
    await app.transaction_create({
      input: { date: '2026-08-16', type: 'EXPENSE', amount: 2000, currency: 'EUR', exchange_rate: 1.10, case_id: cs.id }
    });

    const detail = await app.case_get_detail({ id: cs.id });
    // Income = 10,000, Expense = 2,200 USD -> Net = 7,800 USD (78.0%)
    expect(detail.realized_income).toBe(10000.00);
    expect(detail.realized_expense).toBe(2200.00);
    expect(detail.net_margin).toBe(7800.00);
    expect(detail.profit_margin_pct).toBe(78.00);
  });
});
