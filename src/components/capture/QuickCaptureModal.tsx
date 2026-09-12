import React, { useState, useEffect } from 'react';
import { X, DollarSign, Briefcase, BookOpen } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { TransactionType, TransactionStatus, CaseStage } from '../../types';
import { Dropdown } from '../common/Dropdown';

export const QuickCaptureModal: React.FC = () => {
  const {
    isQuickCaptureOpen,
    quickCaptureTab,
    openQuickCapture,
    closeQuickCapture,
    categories,
    cases,
    createTransaction,
    createCase,
    createJournalEntry,
  } = useData();

  // Transaction form state
  const [txType, setTxType] = useState<TransactionType>('INCOME');
  const [txAmount, setTxAmount] = useState('');
  const [txCurrency] = useState('USD');
  const [txCategoryId, setTxCategoryId] = useState('');
  const [txCaseId, setTxCaseId] = useState('');
  const [txStatus, setTxStatus] = useState<TransactionStatus>('CLEARED');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txNotes, setTxNotes] = useState('');

  // Case form state
  const [caseTitle, setCaseTitle] = useState('');
  const [caseClient, setCaseClient] = useState('');
  const [caseContact, setCaseContact] = useState('');
  const [caseStage, setCaseStage] = useState<CaseStage>('LEAD');
  const [caseAmount, setCaseAmount] = useState('');
  const [caseCurrency] = useState('USD');
  const [caseTargetDate, setCaseTargetDate] = useState('');
  const [caseNotes, setCaseNotes] = useState('');

  // Note form state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCaseId, setNoteCaseId] = useState('');
  const [noteTags, setNoteTags] = useState('');
  const [noteStarred] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Set default category when list is loaded
  useEffect(() => {
    if (categories.length > 0 && !txCategoryId) {
      const match = categories.find((c) => c.type === txType);
      if (match) setTxCategoryId(match.id);
      else setTxCategoryId(categories[0].id);
    }
  }, [categories, txType, txCategoryId]);

  // Global shortcut Cmd+N and Cmd+Enter / Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (isQuickCaptureOpen) {
          closeQuickCapture();
        } else {
          openQuickCapture('transaction');
        }
      } else if (e.key === 'Escape' && isQuickCaptureOpen) {
        e.preventDefault();
        closeQuickCapture();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && isQuickCaptureOpen) {
        e.preventDefault();
        if (quickCaptureTab === 'transaction') handleTransactionSubmit();
        else if (quickCaptureTab === 'case') handleCaseSubmit();
        else if (quickCaptureTab === 'note') handleNoteSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuickCaptureOpen, quickCaptureTab, openQuickCapture, closeQuickCapture]);

  if (!isQuickCaptureOpen) return null;

  const handleTransactionSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!txAmount || isNaN(Number(txAmount))) return;
    setSubmitting(true);
    try {
      const selectedCat = categories.find((c) => c.id === txCategoryId);
      const selectedCase = cases.find((c) => c.id === txCaseId);
      await createTransaction({
        date: txDate,
        type: txType,
        category_id: txCategoryId,
        category_name: selectedCat?.name,
        amount: Number(txAmount),
        currency: txCurrency,
        exchange_rate: 1.0,
        status: txStatus,
        case_id: txCaseId || null,
        case_title: selectedCase?.title || null,
        notes: txNotes || null,
      });
      // Reset & close
      setTxAmount('');
      setTxNotes('');
      closeQuickCapture();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCaseSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!caseTitle || !caseClient) return;
    setSubmitting(true);
    try {
      await createCase({
        title: caseTitle,
        client_name: caseClient,
        client_contact: caseContact || null,
        stage: caseStage,
        quoted_amount: Number(caseAmount) || 0,
        currency: caseCurrency,
        target_completion_date: caseTargetDate || null,
        notes: caseNotes || null,
      });
      // Reset & close
      setCaseTitle('');
      setCaseClient('');
      setCaseContact('');
      setCaseAmount('');
      setCaseNotes('');
      closeQuickCapture();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNoteSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!noteTitle && !noteContent) return;
    setSubmitting(true);
    try {
      const tagList = noteTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await createJournalEntry({
        title: noteTitle || 'Nota rápida',
        content: noteContent,
        case_id: noteCaseId || null,
        tags: tagList,
        is_starred: noteStarred,
      });
      // Reset & close
      setNoteTitle('');
      setNoteContent('');
      setNoteTags('');
      closeQuickCapture();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 select-none"
      onClick={closeQuickCapture}
    >
      <div
        className="craft-card w-full max-w-lg bg-surface-primary border-surface-border shadow-modal overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Tabs */}
        <div className="p-3 border-b border-surface-border bg-surface-secondary flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => openQuickCapture('transaction')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition-fast ${
                quickCaptureTab === 'transaction'
                  ? 'bg-obsidian-100 text-obsidian-950 font-bold shadow-subtle'
                  : 'text-obsidian-400 hover:text-obsidian-200'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Movimiento</span>
            </button>

            <button
              onClick={() => openQuickCapture('case')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition-fast ${
                quickCaptureTab === 'case'
                  ? 'bg-obsidian-100 text-obsidian-950 font-bold shadow-subtle'
                  : 'text-obsidian-400 hover:text-obsidian-200'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Proyecto</span>
            </button>

            <button
              onClick={() => openQuickCapture('note')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition-fast ${
                quickCaptureTab === 'note'
                  ? 'bg-obsidian-100 text-obsidian-950 font-bold shadow-subtle'
                  : 'text-obsidian-400 hover:text-obsidian-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Nota</span>
            </button>
          </div>

          <button
            onClick={closeQuickCapture}
            className="p-1 rounded text-obsidian-500 hover:text-white transition-fast"
            title="Cerrar (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab 1: Transaction Form */}
        {quickCaptureTab === 'transaction' && (
          <form onSubmit={handleTransactionSubmit} className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                  Tipo de Movimiento
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-secondary border border-surface-border rounded">
                  <button
                    type="button"
                    onClick={() => setTxType('INCOME')}
                    className={`py-1 text-center font-mono font-bold rounded transition-fast ${
                      txType === 'INCOME'
                        ? 'bg-financial-positiveMuted text-financial-positiveText border border-financial-positiveBorder'
                        : 'text-obsidian-400 hover:text-obsidian-200'
                    }`}
                  >
                    + Ingreso
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType('EXPENSE')}
                    className={`py-1 text-center font-mono font-bold rounded transition-fast ${
                      txType === 'EXPENSE'
                        ? 'bg-financial-negativeMuted text-financial-negativeText border border-financial-negativeBorder'
                        : 'text-obsidian-400 hover:text-obsidian-200'
                    }`}
                  >
                    - Gasto
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                  Importe ({txCurrency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-3 py-1.5 bg-surface-secondary border border-surface-border rounded text-sm text-obsidian-100 font-mono font-bold placeholder-obsidian-600 focus:outline-none focus:border-obsidian-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                  Categoría
                </label>
                <Dropdown
                  value={txCategoryId}
                  onChange={setTxCategoryId}
                  ariaLabel="Categoría"
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                  Estado
                </label>
                <Dropdown
                  value={txStatus}
                  onChange={(v) => setTxStatus(v as TransactionStatus)}
                  ariaLabel="Estado"
                  options={[
                    { value: 'CLEARED', label: 'Cobrado / Pagado (Cleared)' },
                    { value: 'INVOICED', label: 'Factura Emitida (Invoiced)' },
                    { value: 'PENDING', label: 'Pendiente (Pending)' },
                    { value: 'PAID', label: 'Liquidado (Paid)' },
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                  Proyecto Vinculado (Opcional)
                </label>
                <Dropdown
                  value={txCaseId}
                  onChange={setTxCaseId}
                  ariaLabel="Proyecto vinculado"
                  options={[
                    { value: '', label: 'Sin vincular a proyecto' },
                    ...cases.map((cs) => ({
                      value: cs.id,
                      label: `${cs.title} (${cs.client_name})`,
                    })),
                  ]}
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                  Fecha
                </label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-300 font-mono focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                Descripción / Concepto
              </label>
              <input
                type="text"
                placeholder="Ej. Anticipo diseño interfaz, Servidor AWS..."
                value={txNotes}
                onChange={(e) => setTxNotes(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-200 placeholder-obsidian-600 focus:outline-none focus:border-obsidian-400"
              />
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-surface-borderSubtle">
              <span className="text-[10px] text-obsidian-500 font-mono">
                Presiona ⌘+Enter para guardar
              </span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={closeQuickCapture}
                  className="px-3 py-1.5 bg-surface-secondary hover:bg-surface-hover text-obsidian-300 rounded border border-surface-border transition-fast"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !txAmount}
                  className="px-4 py-1.5 bg-signal hover:bg-signal-hover text-obsidian-950 font-semibold rounded-md transition-fast disabled:opacity-40"
                >
                  {submitting ? 'Guardando...' : 'Guardar Movimiento'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Tab 2: Case / Project Form */}
        {quickCaptureTab === 'case' && (
          <form onSubmit={handleCaseSubmit} className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                  Nombre del Proyecto
                </label>
                <input
                  type="text"
                  placeholder="Ej. Rediseño Web Corporativa"
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-3 py-1.5 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-100 placeholder-obsidian-600 focus:outline-none focus:border-obsidian-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                  Cliente / Empresa
                </label>
                <input
                  type="text"
                  placeholder="Ej. Acme Corp"
                  value={caseClient}
                  onChange={(e) => setCaseClient(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-100 placeholder-obsidian-600 focus:outline-none focus:border-obsidian-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                  Persona de Contacto
                </label>
                <input
                  type="text"
                  placeholder="Ej. Carlos Mendoza"
                  value={caseContact}
                  onChange={(e) => setCaseContact(e.target.value)}
                  className="w-full px-3 py-1.5 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-200 placeholder-obsidian-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                  Etapa Inicial
                </label>
                <Dropdown
                  value={caseStage}
                  onChange={(v) => setCaseStage(v as CaseStage)}
                  ariaLabel="Etapa inicial"
                  options={[
                    { value: 'LEAD', label: '1. Interesado (Lead)' },
                    { value: 'QUOTATION', label: '2. En Presupuesto' },
                    { value: 'ACTIVE', label: '3. En Desarrollo' },
                    { value: 'COMPLETED', label: '4. Entregado / Cobrado' },
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                  Importe Presupuestado ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={caseAmount}
                  onChange={(e) => setCaseAmount(e.target.value)}
                  className="w-full px-3 py-1.5 bg-surface-secondary border border-surface-border rounded text-xs font-mono font-bold text-obsidian-100 placeholder-obsidian-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                  Fecha Prevista de Entrega
                </label>
                <input
                  type="date"
                  value={caseTargetDate}
                  onChange={(e) => setCaseTargetDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-surface-secondary border border-surface-border rounded text-xs font-mono text-obsidian-300 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                Alcance / Notas Iniciales
              </label>
              <textarea
                rows={2}
                placeholder="Objetivos clave del trabajo..."
                value={caseNotes}
                onChange={(e) => setCaseNotes(e.target.value)}
                className="w-full p-2.5 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-200 placeholder-obsidian-600 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-surface-borderSubtle">
              <span className="text-[10px] text-obsidian-500 font-mono">
                Presiona ⌘+Enter para guardar
              </span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={closeQuickCapture}
                  className="px-3 py-1.5 bg-surface-secondary hover:bg-surface-hover text-obsidian-300 rounded border border-surface-border transition-fast"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !caseTitle || !caseClient}
                  className="px-4 py-1.5 bg-signal hover:bg-signal-hover text-obsidian-950 font-semibold rounded-md transition-fast disabled:opacity-40"
                >
                  {submitting ? 'Guardando...' : 'Crear Proyecto'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Tab 3: Note Form */}
        {quickCaptureTab === 'note' && (
          <form onSubmit={handleNoteSubmit} className="p-5 space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                Título de la Entrada
              </label>
              <input
                type="text"
                placeholder="Ej. Minuta reunión con cliente..."
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                autoFocus
                className="w-full px-3 py-1.5 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-100 placeholder-obsidian-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                Contenido (Markdown)
              </label>
              <textarea
                rows={4}
                placeholder="Escribe los puntos clave..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="w-full p-2.5 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-200 placeholder-obsidian-600 font-mono focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                  Vincular a Proyecto
                </label>
                <Dropdown
                  value={noteCaseId}
                  onChange={setNoteCaseId}
                  ariaLabel="Vincular a proyecto"
                  options={[
                    { value: '', label: 'Sin vincular a proyecto' },
                    ...cases.map((c) => ({
                      value: c.id,
                      label: `${c.title} (${c.client_name})`,
                    })),
                  ]}
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-obsidian-400 mb-1">
                  Etiquetas
                </label>
                <input
                  type="text"
                  placeholder="reunión, acuerdo, entrega"
                  value={noteTags}
                  onChange={(e) => setNoteTags(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-300 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-surface-borderSubtle">
              <span className="text-[10px] text-obsidian-500 font-mono">
                Presiona ⌘+Enter para guardar
              </span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={closeQuickCapture}
                  className="px-3 py-1.5 bg-surface-secondary hover:bg-surface-hover text-obsidian-300 rounded border border-surface-border transition-fast"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || (!noteTitle && !noteContent)}
                  className="px-4 py-1.5 bg-signal hover:bg-signal-hover text-obsidian-950 font-semibold rounded-md transition-fast disabled:opacity-40"
                >
                  {submitting ? 'Guardando...' : 'Guardar Nota'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
