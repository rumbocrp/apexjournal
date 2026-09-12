import { invokeCommand } from './client';
import { JournalEntry, CreateJournalInput, UpdateJournalInput, JournalFilter } from '../types';

export const journalApi = {
  list: (filter?: JournalFilter) => invokeCommand<JournalEntry[]>('journal_list', { filter }),
  create: (input: CreateJournalInput) => invokeCommand<JournalEntry>('journal_create', { input }),
  update: (id: string, input: UpdateJournalInput) =>
    invokeCommand<JournalEntry>('journal_update', { id, input }),
};
