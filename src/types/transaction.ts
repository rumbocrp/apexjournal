export type TransactionType = 'INCOME' | 'EXPENSE';
export type TransactionStatus = 'CLEARED' | 'PENDING' | 'INVOICED' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface Transaction {
  id: string;
  date: string; // ISO 8601 YYYY-MM-DD
  type: TransactionType;
  category_id: string;
  category_name?: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  base_amount: number;
  status: TransactionStatus;
  case_id?: string | null;
  case_title?: string | null;
  notes?: string | null;
}

export interface CreateTransactionInput {
  id?: string;
  date: string;
  type: TransactionType;
  category_id?: string;
  category_name?: string;
  amount: number;
  currency?: string;
  exchange_rate?: number;
  status?: TransactionStatus;
  case_id?: string | null;
  case_title?: string | null;
  notes?: string | null;
}

export interface UpdateTransactionInput {
  date?: string;
  type?: TransactionType;
  category_id?: string;
  category_name?: string;
  amount?: number;
  currency?: string;
  exchange_rate?: number;
  status?: TransactionStatus;
  case_id?: string | null;
  case_title?: string | null;
  notes?: string | null;
}

export interface TransactionFilter {
  type?: string;
  status?: string;
  case_id?: string;
  category_id?: string;
  currency?: string;
  start_date?: string;
  end_date?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color_hex: string;
  is_system: boolean;
  created_at: string;
}

export interface CreateCategoryInput {
  id?: string;
  name: string;
  type: TransactionType;
  color_hex?: string;
  is_system?: boolean;
}

export interface ExchangeRate {
  currency_code: string;
  rate_to_base: number;
  updated_at: string;
}
