const { describe, test, expect, beforeEach, ApexJournalTestInstance } = require('../harness');

describe('Tier 4 - Workload 05: Intensive Operating Diary & Case Audit Trail', () => {
  let app;

  beforeEach(async () => {
    app = new ApexJournalTestInstance();
    await app.vault_setup({ masterPassword: 'DiaryAuditPassword2026!' });
  });

  test('test_case_with_extensive_linked_markdown_entries_and_tags', async () => {
    const cs = await app.case_create({ input: { title: 'Architecture Overhaul', client_name: 'FinTech Group' } });

    // Add 25 Markdown diary entries with code blocks, tables, and tags
    for (let i = 1; i <= 25; i++) {
      const tag = i % 2 === 0 ? '#architecture' : '#strategy';
      await app.journal_create({
        input: {
          title: 'Daily Architecture Log #' + i,
          content: '## Daily Architecture Review\n\n- Component ' + i + ' verified\n- Status: OK\n\n```rust\nfn verify_' + i + '() -> bool { true }\n```',
          case_id: cs.id,
          tags: [tag, '#audit']
        }
      });
    }

    const detail = await app.case_get_detail({ id: cs.id });
    expect(detail.diary_entries.length).toBe(25);

    const architectureEntries = await app.journal_list({ filter: { tag: '#architecture' } });
    expect(architectureEntries.length).toBe(12);

    const auditEntries = await app.journal_list({ filter: { tag: '#audit' } });
    expect(auditEntries.length).toBe(25);

    const csv = await app.export_csv({ exportType: 'journal' });
    expect(csv.includes('Daily Architecture Log #25')).toBe(true);
  });
});
