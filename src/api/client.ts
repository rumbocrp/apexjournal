import {
  VaultStatus,
  VaultInitRequest,
  VaultUnlockRequest,
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionFilter,
  Category,
  Case,
  CreateCaseInput,
  UpdateCaseInput,
  CaseDetail,
  Milestone,
  CreateMilestoneInput,
  JournalEntry,
  CreateJournalInput,
  UpdateJournalInput,
  JournalFilter,
  DashboardMetrics,
  EquityCurvePoint,
  ARAgingSummary,
  Timeframe,
  BackupResult,
  ExportType,
} from '../types';

// Standard default system categories
const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Client Consulting Fee', type: 'INCOME', color_hex: '#10B981', is_system: true, created_at: new Date().toISOString() },
  { id: 'cat-2', name: 'Retainer', type: 'INCOME', color_hex: '#3B82F6', is_system: true, created_at: new Date().toISOString() },
  { id: 'cat-3', name: 'Subcontractor / Engineering', type: 'EXPENSE', color_hex: '#EF4444', is_system: true, created_at: new Date().toISOString() },
  { id: 'cat-4', name: 'Software & SaaS Subscriptions', type: 'EXPENSE', color_hex: '#F59E0B', is_system: true, created_at: new Date().toISOString() },
  { id: 'cat-5', name: 'Travel & Hospitality', type: 'EXPENSE', color_hex: '#64748B', is_system: true, created_at: new Date().toISOString() },
  { id: 'cat-6', name: 'Legal & Accounting', type: 'EXPENSE', color_hex: '#a1a1aa', is_system: true, created_at: new Date().toISOString() },
];

// In-memory mock store
class MockBackend {
  private vaultStatus: VaultStatus = {
    initialized: false,
    unlocked: false,
    biometric_available: false,
    auto_lock_minutes: 15,
  };
  private categories: Category[] = [...INITIAL_CATEGORIES];
  private cases: Case[] = [];
  private milestones: Milestone[] = [];
  private transactions: Transaction[] = [];
  private journal: JournalEntry[] = [];

  // Auth
  async getStatus(): Promise<VaultStatus> {
    return { ...this.vaultStatus };
  }

  async setupVault(req: VaultInitRequest): Promise<VaultStatus> {
    this.vaultStatus = {
      initialized: true,
      unlocked: true,
      biometric_available: req.enable_biometrics ?? true,
      auto_lock_minutes: req.auto_lock_minutes ?? 15,
    };
    return { ...this.vaultStatus };
  }

  async unlockVault(_req: VaultUnlockRequest): Promise<VaultStatus> {
    this.vaultStatus.unlocked = true;
    return { ...this.vaultStatus };
  }

  async unlockBiometric(): Promise<VaultStatus> {
    this.vaultStatus.unlocked = true;
    return { ...this.vaultStatus };
  }

  async lockVault(): Promise<void> {
    this.vaultStatus.unlocked = false;
  }

  // Transactions
  async listTransactions(filter?: TransactionFilter): Promise<Transaction[]> {
    let list = [...this.transactions];
    if (!filter) return list.sort((a, b) => b.date.localeCompare(a.date));

    if (filter.type && filter.type !== 'ALL') {
      list = list.filter((t) => t.type === filter.type);
    }
    if (filter.status && filter.status !== 'ALL') {
      list = list.filter((t) => t.status === filter.status);
    }
    if (filter.case_id && filter.case_id !== 'ALL') {
      list = list.filter((t) => t.case_id === filter.case_id);
    }
    if (filter.category_id && filter.category_id !== 'ALL') {
      list = list.filter((t) => t.category_id === filter.category_id);
    }
    const start = filter.start_date || filter.startDate;
    if (start) {
      list = list.filter((t) => t.date >= start);
    }
    const end = filter.end_date || filter.endDate;
    if (end) {
      list = list.filter((t) => t.date <= end);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (t) =>
          (t.notes && t.notes.toLowerCase().includes(q)) ||
          (t.category_name && t.category_name.toLowerCase().includes(q)) ||
          (t.case_title && t.case_title.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }

  async createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    const category = this.categories.find((c) => c.id === input.category_id || c.name === input.category_name);
    const caseObj = input.case_id ? this.cases.find((c) => c.id === input.case_id) : null;
    const rate = input.exchange_rate ?? 1.0;
    const tx: Transaction = {
      id: input.id || `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      date: input.date || new Date().toISOString().split('T')[0],
      type: input.type,
      category_id: input.category_id || category?.id || 'cat-1',
      category_name: input.category_name || category?.name || 'General',
      amount: Number(input.amount),
      currency: input.currency || 'USD',
      exchange_rate: rate,
      base_amount: Math.round(Number(input.amount) * rate * 100) / 100,
      status: input.status || 'CLEARED',
      case_id: input.case_id || null,
      case_title: caseObj ? caseObj.title : input.case_title || null,
      notes: input.notes || null,
    };
    this.transactions.unshift(tx);
    return tx;
  }

  async updateTransaction(id: string, input: UpdateTransactionInput): Promise<Transaction> {
    const idx = this.transactions.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error(`Transaction ${id} not found`);

    const current = this.transactions[idx];
    const category = input.category_id
      ? this.categories.find((c) => c.id === input.category_id)
      : input.category_name
      ? this.categories.find((c) => c.name === input.category_name)
      : undefined;
    const caseObj = input.case_id !== undefined ? (input.case_id ? this.cases.find((c) => c.id === input.case_id) : null) : undefined;
    const amount = input.amount !== undefined ? Number(input.amount) : current.amount;
    const rate = input.exchange_rate !== undefined ? Number(input.exchange_rate) : current.exchange_rate;

    const updated: Transaction = {
      ...current,
      date: input.date ?? current.date,
      type: input.type ?? current.type,
      category_id: input.category_id ?? category?.id ?? current.category_id,
      category_name: input.category_name ?? category?.name ?? current.category_name,
      amount,
      currency: input.currency ?? current.currency,
      exchange_rate: rate,
      base_amount: Math.round(amount * rate * 100) / 100,
      status: input.status ?? current.status,
      case_id: input.case_id !== undefined ? input.case_id : current.case_id,
      case_title: caseObj !== undefined ? (caseObj ? caseObj.title : null) : input.case_title ?? current.case_title,
      notes: input.notes !== undefined ? input.notes : current.notes,
    };

    this.transactions[idx] = updated;
    return updated;
  }

  async deleteTransaction(id: string): Promise<void> {
    this.transactions = this.transactions.filter((t) => t.id !== id);
  }

  async listCategories(): Promise<Category[]> {
    return [...this.categories];
  }

  // Cases
  async listCases(): Promise<Case[]> {
    return [...this.cases];
  }

  async createCase(input: CreateCaseInput): Promise<Case> {
    const count = this.cases.length + 101;
    const c: Case = {
      id: input.id || `case-${Date.now()}`,
      code: input.code || `CS-${count}`,
      title: input.title,
      client_name: input.client_name,
      client_contact: input.client_contact || null,
      stage: input.stage || 'LEAD',
      quoted_amount: Number(input.quoted_amount || 0),
      currency: input.currency || 'USD',
      proposal_value_base: Number(input.quoted_amount || 0),
      start_date: input.start_date || null,
      target_completion_date: input.target_completion_date || null,
      closed_date: input.closed_date || null,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.cases.unshift(c);
    return c;
  }

  async updateCase(id: string, input: UpdateCaseInput): Promise<Case> {
    const idx = this.cases.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`Case ${id} not found`);

    const current = this.cases[idx];
    const updated: Case = {
      ...current,
      code: input.code ?? current.code,
      title: input.title ?? current.title,
      client_name: input.client_name ?? current.client_name,
      client_contact: input.client_contact !== undefined ? input.client_contact : current.client_contact,
      stage: input.stage ?? current.stage,
      quoted_amount: input.quoted_amount !== undefined ? Number(input.quoted_amount) : current.quoted_amount,
      currency: input.currency ?? current.currency,
      start_date: input.start_date !== undefined ? input.start_date : current.start_date,
      target_completion_date: input.target_completion_date !== undefined ? input.target_completion_date : current.target_completion_date,
      closed_date: input.closed_date !== undefined ? input.closed_date : current.closed_date,
      notes: input.notes !== undefined ? input.notes : current.notes,
      updated_at: new Date().toISOString(),
    };
    this.cases[idx] = updated;
    return updated;
  }

  async getCaseDetail(id: string): Promise<CaseDetail> {
    const c = this.cases.find((item) => item.id === id);
    if (!c) throw new Error(`Case ${id} not found`);

    const caseTx = this.transactions.filter((t) => t.case_id === id);
    let realized_income = 0;
    let realized_expense = 0;
    for (const tx of caseTx) {
      if (tx.status === 'CLEARED' || tx.status === 'PAID') {
        const amt = tx.base_amount || tx.amount * (tx.exchange_rate || 1.0);
        if (tx.type === 'INCOME') realized_income += amt;
        else if (tx.type === 'EXPENSE') realized_expense += amt;
      }
    }
    realized_income = Math.round(realized_income * 100) / 100;
    realized_expense = Math.round(realized_expense * 100) / 100;
    const net_margin = Math.round((realized_income - realized_expense) * 100) / 100;
    const profit_margin_pct = realized_income > 0 ? Math.round(((net_margin / realized_income) * 100) * 100) / 100 : 0.0;

    const caseMilestones = this.milestones.filter((m) => m.case_id === id);
    const caseDiary = this.journal.filter((j) => j.case_id === id);

    return {
      ...c,
      realized_income,
      realized_expense,
      net_margin,
      profit_margin_pct,
      milestones: caseMilestones,
      diary_entries: caseDiary,
    };
  }

  async createMilestone(input: CreateMilestoneInput): Promise<Milestone> {
    const m: Milestone = {
      id: input.id || `m-${Date.now()}`,
      case_id: input.case_id,
      title: input.title,
      description: input.description || '',
      due_date: input.due_date || new Date().toISOString().split('T')[0],
      completed: input.completed ?? false,
      amount: input.amount ?? 0,
      created_at: new Date().toISOString(),
    };
    this.milestones.push(m);
    return m;
  }

  async toggleMilestone(id: string, completed: boolean): Promise<Milestone> {
    const idx = this.milestones.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`Milestone ${id} not found`);
    this.milestones[idx].completed = completed;
    this.milestones[idx].completed_date = completed ? new Date().toISOString().split('T')[0] : null;
    return this.milestones[idx];
  }

  // Journal
  async listJournal(filter?: JournalFilter): Promise<JournalEntry[]> {
    let list = [...this.journal];
    if (filter?.case_id && filter.case_id !== 'ALL') {
      list = list.filter((j) => j.case_id === filter.case_id);
    }
    if (filter?.tag && filter.tag !== 'ALL') {
      list = list.filter((j) => j.tags.includes(filter.tag!));
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (j) => j.title.toLowerCase().includes(q) || j.content.toLowerCase().includes(q) || j.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }

  async createJournal(input: CreateJournalInput): Promise<JournalEntry> {
    const caseObj = input.case_id ? this.cases.find((c) => c.id === input.case_id) : null;
    const entry: JournalEntry = {
      id: input.id || `j-${Date.now()}`,
      date: input.date || new Date().toISOString().split('T')[0],
      title: input.title || 'Untitled Note',
      content: input.content,
      case_id: input.case_id || null,
      case_title: caseObj ? caseObj.title : null,
      tags: input.tags || [],
      is_starred: input.is_starred ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.journal.unshift(entry);
    return entry;
  }

  async updateJournal(id: string, input: UpdateJournalInput): Promise<JournalEntry> {
    const idx = this.journal.findIndex((j) => j.id === id);
    if (idx === -1) throw new Error(`Journal entry ${id} not found`);

    const current = this.journal[idx];
    const caseObj = input.case_id !== undefined ? (input.case_id ? this.cases.find((c) => c.id === input.case_id) : null) : undefined;
    const updated: JournalEntry = {
      ...current,
      date: input.date ?? current.date,
      title: input.title ?? current.title,
      content: input.content ?? current.content,
      case_id: input.case_id !== undefined ? input.case_id : current.case_id,
      case_title: caseObj !== undefined ? (caseObj ? caseObj.title : null) : current.case_title,
      tags: input.tags ?? current.tags,
      is_starred: input.is_starred !== undefined ? input.is_starred : current.is_starred,
      updated_at: new Date().toISOString(),
    };
    this.journal[idx] = updated;
    return updated;
  }

  // Analytics (Oracle compliant mathematical engine)
  async getDashboard(): Promise<DashboardMetrics> {
    let realized_income = 0;
    let realized_expense = 0;
    for (const t of this.transactions) {
      if (t.status === 'CLEARED' || t.status === 'PAID') {
        const amt = t.base_amount ?? t.amount * (t.exchange_rate ?? 1.0);
        if (t.type === 'INCOME') realized_income += amt;
        else if (t.type === 'EXPENSE') realized_expense += amt;
      }
    }
    realized_income = Math.round(realized_income * 100) / 100;
    realized_expense = Math.round(realized_expense * 100) / 100;
    const net_margin = Math.round((realized_income - realized_expense) * 100) / 100;

    const closed = this.cases.filter((c) => c.stage === 'COMPLETED' || c.stage === 'LOST');
    const won = closed.filter((c) => c.stage === 'COMPLETED');
    const winRate = closed.length > 0 ? Math.round(((won.length / closed.length) * 100) * 100) / 100 : 0.0;

    let invoiced_volume = 0;
    for (const c of this.cases) {
      if (c.stage === 'ACTIVE' || c.stage === 'COMPLETED' || c.stage === 'QUOTATION') {
        invoiced_volume += Number(c.quoted_amount || 0);
      }
    }
    for (const t of this.transactions) {
      if (t.type === 'INCOME' && t.status === 'INVOICED') {
        invoiced_volume += Number(t.base_amount ?? t.amount * (t.exchange_rate ?? 1.0));
      }
    }
    invoiced_volume = Math.round(invoiced_volume * 100) / 100;

    const completed = this.cases.filter((c) => c.stage === 'COMPLETED');
    let avg_ticket_size = 0;
    if (completed.length > 0) {
      const tot = completed.reduce((sum, c) => sum + Number(c.quoted_amount || 0), 0);
      avg_ticket_size = Math.round((tot / completed.length) * 100) / 100;
    }

    return {
      cumulative_net_margin: net_margin,
      proposal_win_rate: winRate,
      realized_volume: realized_income,
      invoiced_volume,
      avg_ticket_size,
      base_currency: 'USD',
    };
  }

  async getEquityCurve(timeframe: Timeframe = 'ALL'): Promise<EquityCurvePoint[]> {
    const cleared = this.transactions
      .filter((t) => t.status === 'CLEARED' || t.status === 'PAID')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const dailyMap = new Map<string, { volume_income: number; volume_expense: number }>();
    for (const tx of cleared) {
      const dateStr = tx.date.split('T')[0];
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, { volume_income: 0, volume_expense: 0 });
      }
      const day = dailyMap.get(dateStr)!;
      const amt = Number(tx.base_amount ?? tx.amount * (tx.exchange_rate ?? 1.0));
      if (tx.type === 'INCOME') day.volume_income += amt;
      else if (tx.type === 'EXPENSE') day.volume_expense += amt;
    }

    const refTime = new Date().getTime();
    let cutoff: Date | null = null;
    if (timeframe === '1W') cutoff = new Date(refTime - 7 * 86400000);
    else if (timeframe === '1M') cutoff = new Date(refTime - 30 * 86400000);
    else if (timeframe === '3M') cutoff = new Date(refTime - 90 * 86400000);
    else if (timeframe === '1Y') cutoff = new Date(refTime - 365 * 86400000);

    const sortedDates = Array.from(dailyMap.keys()).sort();
    const fullSeries: EquityCurvePoint[] = [];
    let running = 0;

    for (const d of sortedDates) {
      const dayData = dailyMap.get(d)!;
      const inc = Math.round(dayData.volume_income * 100) / 100;
      const exp = Math.round(dayData.volume_expense * 100) / 100;
      const delta = Math.round((inc - exp) * 100) / 100;
      running = Math.round((running + delta) * 100) / 100;

      const pDate = new Date(d);
      if (!cutoff || pDate >= cutoff) {
        fullSeries.push({
          date: d,
          daily_delta: delta,
          cumulative_equity: running,
          volume_income: inc,
          volume_expense: exp,
        });
      }
    }
    return fullSeries;
  }

  async getARAging(): Promise<ARAgingSummary> {
    const outstanding = this.transactions.filter(
      (t) => t.type === 'INCOME' && (t.status === 'INVOICED' || t.status === 'PENDING')
    );

    let c0_30 = 0;
    let p31_60 = 0;
    let o61_90 = 0;
    let cr90_plus = 0;

    const refTime = new Date().getTime();

    for (const tx of outstanding) {
      const txTime = new Date(tx.date).getTime();
      const ageDays = Math.max(0, Math.floor((refTime - txTime) / (1000 * 60 * 60 * 24)));
      const amt = Number(tx.base_amount ?? tx.amount * (tx.exchange_rate ?? 1.0));

      if (ageDays <= 30) c0_30 += amt;
      else if (ageDays <= 60) p31_60 += amt;
      else if (ageDays <= 90) o61_90 += amt;
      else cr90_plus += amt;
    }

    c0_30 = Math.round(c0_30 * 100) / 100;
    p31_60 = Math.round(p31_60 * 100) / 100;
    o61_90 = Math.round(o61_90 * 100) / 100;
    cr90_plus = Math.round(cr90_plus * 100) / 100;

    const total = Math.round((c0_30 + p31_60 + o61_90 + cr90_plus) * 100) / 100;
    let traffic_light: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    if (cr90_plus > 0) traffic_light = 'RED';
    else if (o61_90 > 0) traffic_light = 'YELLOW';

    return {
      current_0_30: c0_30,
      pending_31_60: p31_60,
      overdue_61_90: o61_90,
      critical_90_plus: cr90_plus,
      total_receivable: total,
      traffic_light,
    };
  }

  async exportCsv(exportType: ExportType): Promise<string> {
    const escapeCsv = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    if (exportType === 'transactions') {
      let csv = 'id,date,type,category,amount,currency,exchange_rate,base_amount,status,case_title,notes\n';
      for (const t of this.transactions) {
        const cat = this.categories.find((c) => c.id === t.category_id)?.name || t.category_name || '';
        const cs = this.cases.find((c) => c.id === t.case_id)?.title || t.case_title || '';
        csv += `${escapeCsv(t.id)},${escapeCsv(t.date)},${escapeCsv(t.type)},${escapeCsv(cat)},${t.amount.toFixed(2)},${escapeCsv(t.currency)},${t.exchange_rate.toFixed(4)},${t.base_amount.toFixed(2)},${escapeCsv(t.status)},${escapeCsv(cs)},${escapeCsv(t.notes || '')}\n`;
      }
      return csv;
    } else if (exportType === 'cases') {
      let csv = 'id,code,title,client_name,client_contact,stage,quoted_amount,currency,start_date,target_completion_date,closed_date,created_at,updated_at\n';
      for (const c of this.cases) {
        csv += `${escapeCsv(c.id)},${escapeCsv(c.code || '')},${escapeCsv(c.title)},${escapeCsv(c.client_name)},${escapeCsv(c.client_contact || '')},${escapeCsv(c.stage)},${c.quoted_amount.toFixed(2)},${escapeCsv(c.currency)},${escapeCsv(c.start_date || '')},${escapeCsv(c.target_completion_date || '')},${escapeCsv(c.closed_date || '')},${escapeCsv(c.created_at)},${escapeCsv(c.updated_at)}\n`;
      }
      return csv;
    } else {
      let csv = 'id,date,title,content,case_id,tags,is_starred,created_at,updated_at\n';
      for (const j of this.journal) {
        csv += `${escapeCsv(j.id)},${escapeCsv(j.date)},${escapeCsv(j.title)},${escapeCsv(j.content)},${escapeCsv(j.case_id || '')},${escapeCsv(j.tags.join(', '))},${j.is_starred ? 'true' : 'false'},${escapeCsv(j.created_at)},${escapeCsv(j.updated_at)}\n`;
      }
      return csv;
    }
  }

  async exportExcel(destinationPath: string): Promise<void> {
    console.log(`[MockBackend] Excel export simulated to ${destinationPath}`);
  }

  async exportBackup(destinationPath: string): Promise<BackupResult> {
    return {
      success: true,
      destination_path: destinationPath || 'apex_journal_backup.vault',
      bytes_written: 1024,
      timestamp: new Date().toISOString(),
    };
  }

  async restoreBackup(sourcePath: string, _masterPassword: string): Promise<void> {
    console.log(`[MockBackend] Restoring backup from ${sourcePath}`);
  }
}

export const mockBackend = new MockBackend();

export function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function invokeCommand<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  // Inside Tauri, backend errors propagate to the caller. Falling back to the
  // in-memory mock here would mask real backend failures as plausible local
  // data (silent corruption of user judgment). Mock is browser-only.
  if (isTauriAvailable()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  }

  // Browser Mock router
  switch (cmd) {
    case 'vault_get_status':
      return (await mockBackend.getStatus()) as unknown as T;
    case 'vault_setup':
      return (await mockBackend.setupVault(args.request || args)) as unknown as T;
    case 'vault_unlock':
      return (await mockBackend.unlockVault(args.request || args)) as unknown as T;
    case 'vault_unlock_biometric':
      return (await mockBackend.unlockBiometric()) as unknown as T;
    case 'vault_lock':
      return (await mockBackend.lockVault()) as unknown as T;
    case 'vault_touch':
      return undefined as unknown as T;

    case 'transaction_list':
      return (await mockBackend.listTransactions(args.filter)) as unknown as T;
    case 'transaction_create':
      return (await mockBackend.createTransaction(args.input)) as unknown as T;
    case 'transaction_update':
      return (await mockBackend.updateTransaction(args.id, args.input)) as unknown as T;
    case 'transaction_delete':
      return (await mockBackend.deleteTransaction(args.id)) as unknown as T;
    case 'category_list':
      return (await mockBackend.listCategories()) as unknown as T;

    case 'case_list':
      return (await mockBackend.listCases()) as unknown as T;
    case 'case_create':
      return (await mockBackend.createCase(args.input)) as unknown as T;
    case 'case_update':
      return (await mockBackend.updateCase(args.id, args.input)) as unknown as T;
    case 'case_get_detail':
      return (await mockBackend.getCaseDetail(args.id)) as unknown as T;
    case 'milestone_create':
      return (await mockBackend.createMilestone(args.input)) as unknown as T;
    case 'milestone_toggle':
      return (await mockBackend.toggleMilestone(args.id, args.completed)) as unknown as T;

    case 'journal_list':
      return (await mockBackend.listJournal(args.filter)) as unknown as T;
    case 'journal_create':
      return (await mockBackend.createJournal(args.input)) as unknown as T;
    case 'journal_update':
      return (await mockBackend.updateJournal(args.id, args.input)) as unknown as T;

    case 'analytics_get_dashboard':
      return (await mockBackend.getDashboard()) as unknown as T;
    case 'analytics_get_equity_curve':
      return (await mockBackend.getEquityCurve(args.timeframe)) as unknown as T;
    case 'get_ar_aging_summary':
    case 'analytics_get_ar_aging':
      return (await mockBackend.getARAging()) as unknown as T;

    case 'vault_export_backup':
      return (await mockBackend.exportBackup(args.destinationPath || args.destination_path)) as unknown as T;
    case 'vault_restore_backup':
      return (await mockBackend.restoreBackup(args.sourcePath || args.source_path, args.masterPassword || args.master_password)) as unknown as T;
    case 'export_csv':
      return (await mockBackend.exportCsv(args.exportType || args.export_type)) as unknown as T;
    case 'export_excel':
      return (await mockBackend.exportExcel(args.destinationPath || args.destination_path)) as unknown as T;

    default:
      console.warn(`Unhandled command: ${cmd}`);
      return undefined as unknown as T;
  }
}
