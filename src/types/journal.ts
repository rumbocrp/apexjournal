export interface JournalEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  case_id?: string | null;
  case_title?: string | null;
  tags: string[];
  is_starred: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateJournalInput {
  id?: string;
  date?: string;
  title?: string;
  content: string;
  case_id?: string | null;
  tags?: string[];
  is_starred?: boolean;
}

export interface UpdateJournalInput {
  date?: string;
  title?: string;
  content?: string;
  case_id?: string | null;
  tags?: string[];
  is_starred?: boolean;
}

export interface JournalFilter {
  case_id?: string;
  tag?: string;
  search?: string;
}
