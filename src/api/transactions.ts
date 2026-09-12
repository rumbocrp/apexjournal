import { invokeCommand } from './client';
import {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionFilter,
  Category,
} from '../types';

export const transactionsApi = {
  list: (filter?: TransactionFilter) => invokeCommand<Transaction[]>('transaction_list', { filter }),
  create: (input: CreateTransactionInput) => invokeCommand<Transaction>('transaction_create', { input }),
  update: (id: string, input: UpdateTransactionInput) =>
    invokeCommand<Transaction>('transaction_update', { id, input }),
  delete: (id: string) => invokeCommand<void>('transaction_delete', { id }),
  listCategories: () => invokeCommand<Category[]>('category_list'),
};
