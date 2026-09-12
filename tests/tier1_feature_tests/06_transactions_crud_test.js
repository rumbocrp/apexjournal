const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 1 - Feature 06: Transactions CRUD', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'TransactionPassword2026!' });
  });

  test('test_create_income_transaction', async () => {
    const tx = await app.transaction_create({
      input: {
        date: '2026-08-15',
        type: 'INCOME',
        amount: 12500.50,
        currency: 'USD',
        notes: 'Q3 Enterprise Architecture Advisory Fee'
      }
    });

    expect(tx.id).toBeDefined();
    expect(tx.type).toBe('INCOME');
    expect(tx.amount).toBe(12500.50);
    expect(tx.base_amount).toBe(12500.50);
    expect(tx.status).toBe('CLEARED');
  });

  test('test_create_expense_transaction', async () => {
    const tx = await app.transaction_create({
      input: {
        date: '2026-08-16',
        type: 'EXPENSE',
        category_id: 'cat-4',
        amount: 250.00,
        currency: 'USD',
        notes: 'AWS Infrastructure Hosting'
      }
    });

    expect(tx.type).toBe('EXPENSE');
    expect(tx.category_name).toBe('Software & SaaS Subscriptions');
    expect(tx.amount).toBe(250.00);
  });

  test('test_update_transaction_amount_and_status', async () => {
    const tx = await app.transaction_create({
      input: {
        date: '2026-08-18',
        type: 'INCOME',
        amount: 5000.00,
        currency: 'USD',
        status: 'PENDING'
      }
    });

    const updated = await app.transaction_update({
      id: tx.id,
      input: {
        amount: 5500.00,
        status: 'CLEARED'
      }
    });

    expect(updated.amount).toBe(5500.00);
    expect(updated.base_amount).toBe(5500.00);
    expect(updated.status).toBe('CLEARED');
  });

  test('test_delete_transaction', async () => {
    const tx = await app.transaction_create({
      input: {
        date: '2026-08-20',
        type: 'EXPENSE',
        amount: 100.00,
        currency: 'USD'
      }
    });

    await app.transaction_delete({ id: tx.id });
    const list = await app.transaction_list();
    expect(list.some(t => t.id === tx.id)).toBe(false);
  });

  test('test_list_transactions_with_category_and_type_filter', async () => {
    await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', category_id: 'cat-1', amount: 3000 }
    });
    await app.transaction_create({
      input: { date: '2026-08-02', type: 'EXPENSE', category_id: 'cat-4', amount: 500 }
    });

    const incomeOnly = await app.transaction_list({ filter: { type: 'INCOME' } });
    expect(incomeOnly.length).toBe(1);
    expect(incomeOnly[0].amount).toBe(3000);

    const expenseOnly = await app.transaction_list({ filter: { type: 'EXPENSE' } });
    expect(expenseOnly.length).toBe(1);
    expect(expenseOnly[0].amount).toBe(500);
  });

  test('test_list_transactions_with_text_search', async () => {
    await app.transaction_create({
      input: { date: '2026-08-01', type: 'INCOME', amount: 4000, notes: 'Stripe Payout for Case Alpha' }
    });
    await app.transaction_create({
      input: { date: '2026-08-02', type: 'EXPENSE', amount: 800, notes: 'Flight to London for Client Meeting' }
    });

    const results = await app.transaction_list({ filter: { search: 'London' } });
    expect(results.length).toBe(1);
    expect(results[0].notes).toContain('London');
  });
});
