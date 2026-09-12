import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { transactionsApi, casesApi, journalApi, analyticsApi } from '../api';
import {
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
} from '../types';

export type ViewType = 'dashboard' | 'blotter' | 'pipeline' | 'journal';

interface DataContextType {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  transactions: Transaction[];
  categories: Category[];
  cases: Case[];
  journal: JournalEntry[];
  dashboardMetrics: DashboardMetrics | null;
  equityCurve: EquityCurvePoint[];
  arAging: ARAgingSummary | null;
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  loading: boolean;
  refreshAll: () => Promise<void>;
  // Transactions
  loadTransactions: (filter?: TransactionFilter) => Promise<void>;
  createTransaction: (input: CreateTransactionInput) => Promise<Transaction>;
  updateTransaction: (id: string, input: UpdateTransactionInput) => Promise<Transaction>;
  deleteTransaction: (id: string) => Promise<void>;
  // Cases
  createCase: (input: CreateCaseInput) => Promise<Case>;
  updateCase: (id: string, input: UpdateCaseInput) => Promise<Case>;
  getCaseDetail: (id: string) => Promise<CaseDetail>;
  createMilestone: (input: CreateMilestoneInput) => Promise<Milestone>;
  toggleMilestone: (id: string, completed: boolean) => Promise<Milestone>;
  // Journal
  loadJournal: (filter?: JournalFilter) => Promise<void>;
  createJournalEntry: (input: CreateJournalInput) => Promise<JournalEntry>;
  updateJournalEntry: (id: string, input: UpdateJournalInput) => Promise<JournalEntry>;
  // Modals & UI Navigation State
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  isQuickCaptureOpen: boolean;
  quickCaptureTab: 'transaction' | 'case' | 'note';
  openQuickCapture: (tab?: 'transaction' | 'case' | 'note') => void;
  closeQuickCapture: () => void;
  activeCaseDetailId: string | null;
  setActiveCaseDetailId: (id: string | null) => void;
  isZenMode: boolean;
  setZenMode: React.Dispatch<React.SetStateAction<boolean>>;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status } = useAuth();
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [equityCurve, setEquityCurve] = useState<EquityCurvePoint[]>([]);
  const [arAging, setArAging] = useState<ARAgingSummary | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('ALL');
  const [loading, setLoading] = useState(false);

  // Modals & state
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [quickCaptureTab, setQuickCaptureTab] = useState<'transaction' | 'case' | 'note'>('transaction');
  const [activeCaseDetailId, setActiveCaseDetailId] = useState<string | null>(null);
  const [isZenMode, setZenMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const refreshAll = useCallback(async () => {
    if (!status.unlocked) return;
    setLoading(true);
    try {
      const [txs, cats, cs, jnl, metrics, curve, ar] = await Promise.all([
        transactionsApi.list(),
        transactionsApi.listCategories(),
        casesApi.list(),
        journalApi.list(),
        analyticsApi.getDashboard(),
        analyticsApi.getEquityCurve(timeframe),
        analyticsApi.getARAging(),
      ]);

      if (txs) setTransactions(txs);
      if (cats) setCategories(cats);
      if (cs) setCases(cs);
      if (jnl) setJournal(jnl);
      if (metrics) setDashboardMetrics(metrics);
      if (curve) setEquityCurve(curve);
      if (ar) setArAging(ar);
    } catch (err) {
      console.error('Error refreshing application data:', err);
    } finally {
      setLoading(false);
    }
  }, [status.unlocked, timeframe]);

  useEffect(() => {
    if (status.unlocked) {
      refreshAll();
    }
  }, [status.unlocked, refreshAll]);

  // Refetch equity curve on timeframe change
  useEffect(() => {
    if (!status.unlocked) return;
    analyticsApi.getEquityCurve(timeframe).then((pts) => {
      if (pts) setEquityCurve(pts);
    }).catch(console.error);
  }, [timeframe, status.unlocked]);

  // Transactions
  const loadTransactions = async (filter?: TransactionFilter) => {
    try {
      const res = await transactionsApi.list(filter);
      if (res) setTransactions(res);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  };

  const createTransaction = async (input: CreateTransactionInput) => {
    const res = await transactionsApi.create(input);
    await refreshAll();
    return res;
  };

  const updateTransaction = async (id: string, input: UpdateTransactionInput) => {
    const res = await transactionsApi.update(id, input);
    await refreshAll();
    return res;
  };

  const deleteTransaction = async (id: string) => {
    await transactionsApi.delete(id);
    await refreshAll();
  };

  // Cases
  const createCase = async (input: CreateCaseInput) => {
    const res = await casesApi.create(input);
    await refreshAll();
    return res;
  };

  const updateCase = async (id: string, input: UpdateCaseInput) => {
    const res = await casesApi.update(id, input);
    await refreshAll();
    return res;
  };

  const getCaseDetail = async (id: string) => {
    return await casesApi.getDetail(id);
  };

  const createMilestone = async (input: CreateMilestoneInput) => {
    const res = await casesApi.createMilestone(input);
    await refreshAll();
    return res;
  };

  const toggleMilestone = async (id: string, completed: boolean) => {
    const res = await casesApi.toggleMilestone(id, completed);
    await refreshAll();
    return res;
  };

  // Journal
  const loadJournal = async (filter?: JournalFilter) => {
    try {
      const res = await journalApi.list(filter);
      if (res) setJournal(res);
    } catch (err) {
      console.error('Failed to load journal entries:', err);
    }
  };

  const createJournalEntry = async (input: CreateJournalInput) => {
    const res = await journalApi.create(input);
    await refreshAll();
    return res;
  };

  const updateJournalEntry = async (id: string, input: UpdateJournalInput) => {
    const res = await journalApi.update(id, input);
    await refreshAll();
    return res;
  };

  // Quick Capture modal controls
  const openQuickCapture = (tab: 'transaction' | 'case' | 'note' = 'transaction') => {
    setQuickCaptureTab(tab);
    setIsQuickCaptureOpen(true);
  };

  const closeQuickCapture = () => {
    setIsQuickCaptureOpen(false);
  };

  return (
    <DataContext.Provider
      value={{
        activeView,
        setActiveView,
        transactions,
        categories,
        cases,
        journal,
        dashboardMetrics,
        equityCurve,
        arAging,
        timeframe,
        setTimeframe,
        loading,
        refreshAll,
        loadTransactions,
        createTransaction,
        updateTransaction,
        deleteTransaction,
        createCase,
        updateCase,
        getCaseDetail,
        createMilestone,
        toggleMilestone,
        loadJournal,
        createJournalEntry,
        updateJournalEntry,
        isCommandPaletteOpen,
        setCommandPaletteOpen,
        isQuickCaptureOpen,
        quickCaptureTab,
        openQuickCapture,
        closeQuickCapture,
        activeCaseDetailId,
        setActiveCaseDetailId,
        isZenMode,
        setZenMode,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        toggleSidebar,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
