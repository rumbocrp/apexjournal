import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Table as TableIcon,
  Plus,
  Search,
  Trash2,
  Check,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  Download,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useHotkeys } from '../context/HotkeyContext';
import { HotkeyBadge } from '../components/hotkeys';
import { Dropdown } from '../components/common/Dropdown';
import { Transaction, TransactionStatus, TransactionType } from '../types';
import { triggerCsvExport } from '../api/export';

export const BlotterView: React.FC = () => {
  const {
    transactions,
    categories,
    cases,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    openQuickCapture,
  } = useData();

  const { registerActionHandler } = useHotkeys();

  // Input refs for direct keyboard focusing
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quickAmountInputRef = useRef<HTMLInputElement>(null);
  const quickNotesInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Status sequence for filtering and one-click cycling
  const filterStatusCycle = ['ALL', 'CLEARED', 'INVOICED', 'PENDING', 'PAID'];

  // Register Blotter-scoped hotkey handlers
  useEffect(() => {
    const unregSearch = registerActionHandler('blotter_focus_search', () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });

    const unregAmount = registerActionHandler('blotter_focus_amount', () => {
      quickAmountInputRef.current?.focus();
      quickAmountInputRef.current?.select();
    });

    const unregNotes = registerActionHandler('blotter_focus_notes', () => {
      quickNotesInputRef.current?.focus();
      quickNotesInputRef.current?.select();
    });

    const unregType = registerActionHandler('blotter_toggle_type', () => {
      setQuickType((prev) => (prev === 'INCOME' ? 'EXPENSE' : 'INCOME'));
    });

    const unregStatus = registerActionHandler('blotter_cycle_status', () => {
      setFilterStatus((curr) => {
        const idx = filterStatusCycle.indexOf(curr);
        return filterStatusCycle[(idx + 1) % filterStatusCycle.length];
      });
    });

    return () => {
      unregSearch();
      unregAmount();
      unregNotes();
      unregType();
      unregStatus();
    };
  }, [registerActionHandler]);

  // Fast Top Capture Row state
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickType, setQuickType] = useState<TransactionType>('INCOME');
  const [quickCategoryId, setQuickCategoryId] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickCaseId, setQuickCaseId] = useState('');
  const [quickNotes, setQuickNotes] = useState('');
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);

  // Inline cell editing state
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'notes' | 'amount' | 'date' } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Status sequence for one-click cycling
  const statusCycle: TransactionStatus[] = ['CLEARED', 'PENDING', 'INVOICED', 'PAID'];

  const handleCycleStatus = async (tx: Transaction, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIdx = statusCycle.indexOf(tx.status as TransactionStatus);
    const nextStatus = currentIdx !== -1 ? statusCycle[(currentIdx + 1) % statusCycle.length] : 'CLEARED';
    await updateTransaction(tx.id, { status: nextStatus });
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(quickAmount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    setIsSubmittingQuick(true);
    try {
      const selectedCat = categories.find((c) => c.id === quickCategoryId) || categories[0];
      await createTransaction({
        date: quickDate,
        type: quickType,
        category_id: selectedCat?.id || 'cat-1',
        category_name: selectedCat?.name || 'General',
        amount: numAmount,
        currency: 'USD',
        exchange_rate: 1.0,
        status: quickType === 'INCOME' ? 'INVOICED' : 'CLEARED',
        case_id: quickCaseId || undefined,
        notes: quickNotes.trim() || undefined,
      });

      setQuickAmount('');
      setQuickNotes('');
    } catch (err: any) {
      console.error('Failed to create quick transaction:', err);
    } finally {
      setIsSubmittingQuick(false);
    }
  };

  const handleStartCellEdit = (id: string, field: 'notes' | 'amount' | 'date', currentVal: string) => {
    setEditingCell({ id, field });
    setEditValue(currentVal);
  };

  const handleSaveCellEdit = async () => {
    if (!editingCell) return;
    const { id, field } = editingCell;

    if (field === 'notes') {
      await updateTransaction(id, { notes: editValue.trim() || undefined });
    } else if (field === 'amount') {
      const val = parseFloat(editValue);
      if (!isNaN(val) && val > 0) {
        await updateTransaction(id, { amount: val });
      }
    } else if (field === 'date') {
      if (editValue) {
        await updateTransaction(id, { date: editValue });
      }
    }

    setEditingCell(null);
  };

  const handleDelete = async (id: string) => {
    await deleteTransaction(id);
    setDeletingId(null);
  };

  // Filtered dataset
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType !== 'ALL' && t.type !== filterType) return false;
      if (filterCategory !== 'ALL' && t.category_id !== filterCategory) return false;
      if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
      if (filterStartDate && t.date < filterStartDate) return false;
      if (filterEndDate && t.date > filterEndDate) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchNotes = t.notes?.toLowerCase().includes(q);
        const matchCat = t.category_name?.toLowerCase().includes(q);
        const matchCase = t.case_title?.toLowerCase().includes(q);
        const matchAmt = t.amount.toString().includes(q);
        if (!matchNotes && !matchCat && !matchCase && !matchAmt) return false;
      }
      return true;
    });
  }, [
    transactions,
    filterType,
    filterCategory,
    filterStatus,
    filterStartDate,
    filterEndDate,
    search,
  ]);

  // Financial summary metrics
  const summary = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    for (const t of filteredTransactions) {
      const amt = t.base_amount ?? t.amount * (t.exchange_rate ?? 1.0);
      if (t.type === 'INCOME') totalIncome += amt;
      else if (t.type === 'EXPENSE') totalExpense += amt;
    }
    const net = Math.round((totalIncome - totalExpense) * 100) / 100;
    return {
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      netMargin: net,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian-950 overflow-hidden text-obsidian-100">
      {/* Top Header & Filter Bar */}
      <div className="p-4 border-b border-surface-border bg-surface-primary space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold tracking-[0.2em] text-obsidian-100 font-mono uppercase flex items-center space-x-2">
              <TableIcon className="w-4 h-4 text-obsidian-400" />
              <span>Registro de Movimientos Financieros</span>
            </h1>
            <p className="text-xs text-obsidian-500">
              Control tabular de cobros, pagos, facturación e imputaciones de costo
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* CSV Export */}
            <button
              onClick={async () => {
                try {
                  const csv = await triggerCsvExport('transactions');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `movimientos_${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                } catch (err: any) {
                  alert(`Error al exportar CSV: ${err.message || err}`);
                }
              }}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-surface-secondary hover:bg-surface-hover border border-surface-border text-obsidian-300 hover:text-white text-xs font-medium rounded transition-fast"
              title="Exportar movimientos en CSV"
            >
              <Download className="w-3.5 h-3.5 text-obsidian-400" />
              <span>Exportar CSV</span>
              <HotkeyBadge actionId="global_export_csv" />
            </button>

            {/* Modal Quick Capture */}
            <button
              onClick={() => openQuickCapture('transaction')}
              className="flex items-center space-x-1 px-3 py-1.5 bg-obsidian-100 hover:bg-white text-obsidian-950 text-xs font-semibold rounded transition-fast"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Registro</span>
              <HotkeyBadge actionId="global_quick_capture" variant="accent" />
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2 pt-1">
          {/* Search Box */}
          <div className="md:col-span-2 relative">
            <Search className="w-3.5 h-3.5 text-obsidian-500 absolute left-2.5 top-2.5" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por notas, cliente o importe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-200 placeholder-obsidian-500 focus:outline-none focus:border-obsidian-400"
            />
            <div className="absolute right-2 top-2 pointer-events-none">
              <HotkeyBadge actionId="blotter_focus_search" variant="subtle" />
            </div>
          </div>

          {/* Type Filter */}
          <Dropdown
            value={filterType}
            onChange={setFilterType}
            fullWidth={false}
            ariaLabel="Filtrar por tipo"
            options={[
              { value: 'ALL', label: 'Tipo: Todos' },
              { value: 'INCOME', label: 'Solo Ingresos (+)' },
              { value: 'EXPENSE', label: 'Solo Gastos (-)' },
            ]}
          />

          {/* Status Filter */}
          <div className="relative">
            <Dropdown
              value={filterStatus}
              onChange={setFilterStatus}
              hideChevron
              ariaLabel="Filtrar por estado"
              options={[
                { value: 'ALL', label: 'Estado: Todos' },
                { value: 'CLEARED', label: 'Cobrado (Cleared)' },
                { value: 'INVOICED', label: 'Facturado (Invoiced)' },
                { value: 'PENDING', label: 'Pendiente (Pending)' },
                { value: 'PAID', label: 'Liquidado (Paid)' },
              ]}
            />
            <div className="absolute right-1.5 top-1.5 pointer-events-none">
              <HotkeyBadge actionId="blotter_cycle_status" variant="subtle" />
            </div>
          </div>

          {/* Category Filter */}
          <Dropdown
            value={filterCategory}
            onChange={setFilterCategory}
            fullWidth={false}
            ariaLabel="Filtrar por categoría"
            options={[
              { value: 'ALL', label: 'Categoría: Todas' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />

          {/* Date range start */}
          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            className="px-2 py-1 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-300 focus:outline-none font-mono"
            title="Fecha inicio"
          />

          {/* Date range end */}
          <input
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            className="px-2 py-1 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-300 focus:outline-none font-mono"
            title="Fecha fin"
          />
        </div>

        {/* Live Filter Summary Bar */}
        <div className="flex items-center justify-between text-[11px] font-mono border-t border-surface-borderSubtle pt-2 text-obsidian-400">
          <div>
            Mostrando <span className="font-bold text-obsidian-200">{summary.count}</span> movimientos
          </div>
          <div className="flex items-center space-x-4">
            <div>
              Ingresos: <span className="text-financial-positiveText font-bold">+${summary.totalIncome.toLocaleString()}</span>
            </div>
            <div>
              Gastos: <span className="text-financial-negativeText font-bold">-${summary.totalExpense.toLocaleString()}</span>
            </div>
            <div>
              Neto:{' '}
              <span
                className={`font-bold ${
                  summary.netMargin >= 0 ? 'text-financial-positiveText' : 'text-financial-negativeText'
                }`}
              >
                ${summary.netMargin.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Fast Inline Quick Capture Row */}
      <form
        onSubmit={handleQuickSubmit}
        className="px-4 py-2.5 bg-surface-secondary border-b border-surface-border grid grid-cols-12 gap-2 items-center text-xs shrink-0"
      >
        <div className="col-span-2">
          <input
            type="date"
            value={quickDate}
            onChange={(e) => setQuickDate(e.target.value)}
            className="w-full px-2 py-1 bg-surface-primary border border-surface-border rounded text-obsidian-200 text-xs font-mono"
            required
          />
        </div>

        <div className="col-span-1 relative">
          <Dropdown
            value={quickType}
            onChange={(v) => setQuickType(v as TransactionType)}
            hideChevron
            ariaLabel="Tipo de movimiento"
            triggerClassName={`!bg-surface-primary !py-1 !pl-1.5 font-semibold ${
              quickType === 'INCOME' ? '!text-financial-positiveText' : '!text-financial-negativeText'
            }`}
            options={[
              { value: 'INCOME', label: 'Ingreso (+)' },
              { value: 'EXPENSE', label: 'Gasto (-)' },
            ]}
          />
          <div className="absolute right-1 top-1 pointer-events-none">
            <HotkeyBadge actionId="blotter_toggle_type" variant="subtle" />
          </div>
        </div>

        <div className="col-span-2 relative">
          <input
            ref={quickAmountInputRef}
            type="number"
            step="0.01"
            placeholder="0.00"
            value={quickAmount}
            onChange={(e) => setQuickAmount(e.target.value)}
            className="w-full pl-2 pr-7 py-1 bg-surface-primary border border-surface-border rounded text-obsidian-100 text-xs font-mono font-bold"
            required
          />
          <div className="absolute right-1.5 top-1 pointer-events-none">
            <HotkeyBadge actionId="blotter_focus_amount" variant="subtle" />
          </div>
        </div>

        <div className="col-span-2">
          <Dropdown
            value={quickCategoryId}
            onChange={setQuickCategoryId}
            ariaLabel="Categoría"
            triggerClassName="!bg-surface-primary !py-1 !px-2"
            options={[
              { value: '', label: 'Categoría...' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>

        <div className="col-span-2">
          <Dropdown
            value={quickCaseId}
            onChange={setQuickCaseId}
            ariaLabel="Vincular a proyecto"
            triggerClassName="!bg-surface-primary !py-1 !px-2"
            options={[
              { value: '', label: 'Sin vincular...' },
              ...cases.map((cs) => ({
                value: cs.id,
                label: `${cs.title} (${cs.client_name})`,
              })),
            ]}
          />
        </div>

        <div className="col-span-2 relative">
          <input
            ref={quickNotesInputRef}
            type="text"
            placeholder="Descripción / Nota..."
            value={quickNotes}
            onChange={(e) => setQuickNotes(e.target.value)}
            className="w-full pl-2 pr-7 py-1 bg-surface-primary border border-surface-border rounded text-obsidian-200 text-xs"
          />
          <div className="absolute right-1.5 top-1 pointer-events-none">
            <HotkeyBadge actionId="blotter_focus_notes" variant="subtle" />
          </div>
        </div>

        <div className="col-span-1 flex justify-end">
          <button
            type="submit"
            disabled={isSubmittingQuick || !quickAmount}
            className="w-full py-1 bg-obsidian-100 hover:bg-white text-obsidian-950 font-bold rounded text-xs transition-fast disabled:opacity-40"
          >
            + Añadir
          </button>
        </div>
      </form>

      {/* Main High-Density Data Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-surface-primary text-[10px] uppercase font-mono tracking-wider text-obsidian-500 border-b border-surface-border select-none z-10">
            <tr>
              <th className="py-2 px-3 w-28">Fecha</th>
              <th className="py-2 px-3 w-24">Tipo</th>
              <th className="py-2 px-3 w-32 text-right">Importe</th>
              <th className="py-2 px-3 w-36">Estado</th>
              <th className="py-2 px-3 w-36">Categoría</th>
              <th className="py-2 px-3 w-48">Proyecto / Cliente</th>
              <th className="py-2 px-3">Descripción</th>
              <th className="py-2 px-3 w-16 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-borderSubtle">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-obsidian-500">
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <TableIcon className="w-5 h-5 text-obsidian-600" />
                    <span className="text-xs">No se encontraron movimientos con los filtros aplicados.</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => {
                const isIncome = tx.type === 'INCOME';
                const isEditingNotes = editingCell?.id === tx.id && editingCell?.field === 'notes';
                const isEditingAmount = editingCell?.id === tx.id && editingCell?.field === 'amount';
                const isEditingDate = editingCell?.id === tx.id && editingCell?.field === 'date';

                return (
                  <tr
                    key={tx.id}
                    className="hover:bg-surface-hover/60 transition-fast group"
                  >
                    {/* Date */}
                    <td
                      className="py-2 px-3 font-mono text-obsidian-300 whitespace-nowrap cursor-pointer hover:underline"
                      onClick={() => handleStartCellEdit(tx.id, 'date', tx.date)}
                    >
                      {isEditingDate ? (
                        <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="date"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleSaveCellEdit}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveCellEdit()}
                            autoFocus
                            className="px-1 py-0.5 bg-surface-primary border border-obsidian-400 rounded text-xs font-mono text-obsidian-100"
                          />
                        </div>
                      ) : (
                        tx.date
                      )}
                    </td>

                    {/* Type */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center space-x-1 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isIncome
                            ? 'bg-financial-positiveMuted text-financial-positiveText border border-financial-positiveBorder'
                            : 'bg-financial-negativeMuted text-financial-negativeText border border-financial-negativeBorder'
                        }`}
                      >
                        {isIncome ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        <span>{isIncome ? 'Ingreso' : 'Gasto'}</span>
                      </span>
                    </td>

                    {/* Amount */}
                    <td
                      className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap cursor-pointer hover:underline tabular-nums"
                      onClick={() => handleStartCellEdit(tx.id, 'amount', tx.amount.toString())}
                    >
                      {isEditingAmount ? (
                        <div className="flex items-center justify-end space-x-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleSaveCellEdit}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveCellEdit()}
                            autoFocus
                            className="w-24 px-1 py-0.5 bg-surface-primary border border-obsidian-400 rounded text-xs font-mono text-right text-obsidian-100"
                          />
                        </div>
                      ) : (
                        <span className={isIncome ? 'text-financial-positiveText' : 'text-financial-negativeText'}>
                          {isIncome ? '+' : '-'}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>

                    {/* Status badge (Click to cycle status) */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <button
                        onClick={(e) => handleCycleStatus(tx, e)}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider transition-fast ${
                          tx.status === 'CLEARED'
                            ? 'bg-financial-positiveMuted text-financial-positiveText border border-financial-positiveBorder'
                            : tx.status === 'INVOICED'
                            ? 'bg-surface-secondary text-obsidian-200 border border-surface-border'
                            : tx.status === 'PENDING'
                            ? 'bg-financial-warningMuted text-financial-warningText border border-financial-warningBorder'
                            : 'bg-financial-positiveMuted text-financial-positiveText border border-financial-positiveBorder'
                        }`}
                        title="Clic para cambiar estado del cobro"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>{tx.status}</span>
                      </button>
                    </td>

                    {/* Category */}
                    <td className="py-2 px-3 text-obsidian-300 whitespace-nowrap">
                      {tx.category_name || 'General'}
                    </td>

                    {/* Case / Project */}
                    <td className="py-2 px-3 text-obsidian-300 whitespace-nowrap">
                      {tx.case_title ? (
                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-surface-secondary border border-surface-border text-[11px] text-obsidian-300 font-mono">
                          <Briefcase className="w-3 h-3 text-obsidian-500" />
                          <span className="truncate max-w-[140px]">{tx.case_title}</span>
                        </span>
                      ) : (
                        <span className="text-obsidian-600 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td
                      className="py-2 px-3 text-obsidian-300 cursor-pointer hover:underline"
                      onClick={() => handleStartCellEdit(tx.id, 'notes', tx.notes || '')}
                    >
                      {isEditingNotes ? (
                        <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleSaveCellEdit}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveCellEdit()}
                            autoFocus
                            className="w-full px-2 py-0.5 bg-surface-primary border border-obsidian-400 rounded text-xs text-obsidian-100"
                          />
                        </div>
                      ) : (
                        <span className="text-obsidian-300 line-clamp-1">{tx.notes || <span className="text-obsidian-600">—</span>}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      {deletingId === tx.id ? (
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="p-1 rounded bg-financial-negative hover:bg-red-600 text-white transition-fast"
                            title="Confirmar eliminación"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="p-1 rounded bg-surface-secondary hover:bg-surface-hover text-obsidian-400 transition-fast"
                            title="Cancelar"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(tx.id)}
                          className="p-1 rounded text-obsidian-600 hover:text-financial-negativeText hover:bg-financial-negativeMuted transition-fast opacity-0 group-hover:opacity-100"
                          title="Eliminar movimiento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
