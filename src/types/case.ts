import { JournalEntry } from './journal';

export type CaseStage = 'LEAD' | 'QUOTATION' | 'ACTIVE' | 'COMPLETED' | 'LOST';

export interface Milestone {
  id: string;
  case_id: string;
  title: string;
  description?: string;
  due_date?: string;
  completed: boolean;
  amount?: number;
  completed_date?: string | null;
  created_at: string;
}

export interface CreateMilestoneInput {
  id?: string;
  case_id: string;
  title: string;
  description?: string;
  due_date?: string;
  completed?: boolean;
  amount?: number;
}

export interface Case {
  id: string;
  code?: string;
  title: string;
  client_name: string;
  client_contact?: string | null;
  stage: CaseStage;
  quoted_amount: number;
  currency: string;
  proposal_value_base?: number;
  start_date?: string | null;
  target_completion_date?: string | null;
  closed_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCaseInput {
  id?: string;
  code?: string;
  title: string;
  client_name: string;
  client_contact?: string | null;
  stage?: CaseStage;
  quoted_amount?: number;
  currency?: string;
  start_date?: string | null;
  target_completion_date?: string | null;
  closed_date?: string | null;
  notes?: string | null;
}

export interface UpdateCaseInput {
  code?: string;
  title?: string;
  client_name?: string;
  client_contact?: string | null;
  stage?: CaseStage;
  quoted_amount?: number;
  currency?: string;
  start_date?: string | null;
  target_completion_date?: string | null;
  closed_date?: string | null;
  notes?: string | null;
}

export interface CaseDetail extends Case {
  realized_income: number;
  realized_expense: number;
  net_margin: number;
  profit_margin_pct: number;
  milestones: Milestone[];
  diary_entries: JournalEntry[];
}
