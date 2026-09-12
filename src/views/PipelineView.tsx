import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  ChevronRight,
  ChevronLeft,
  Calendar,
  CheckCircle2,
  X,
  FileText,
  Download,
  LayoutGrid,
  List,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useHotkeys } from '../context/HotkeyContext';
import { HotkeyBadge } from '../components/hotkeys';
import { Case, CaseStage, CaseDetail, Milestone } from '../types';
import { triggerCsvExport } from '../api/export';

const STAGES: { id: CaseStage; label: string; tagClass: string }[] = [
  { id: 'LEAD', label: '1. Interesados', tagClass: 'bg-surface-secondary text-obsidian-300 border-surface-border' },
  { id: 'QUOTATION', label: '2. Presupuesto', tagClass: 'bg-financial-warningMuted text-financial-warningText border-financial-warningBorder' },
  { id: 'ACTIVE', label: '3. En Desarrollo', tagClass: 'bg-surface-secondary text-obsidian-100 border-obsidian-500' },
  { id: 'COMPLETED', label: '4. Entregados', tagClass: 'bg-financial-positiveMuted text-financial-positiveText border-financial-positiveBorder' },
  { id: 'LOST', label: '5. Cancelados', tagClass: 'bg-financial-negativeMuted text-financial-negativeText border-financial-negativeBorder' },
];

export const PipelineView: React.FC = () => {
  const {
    cases,
    updateCase,
    getCaseDetail,
    createMilestone,
    toggleMilestone,
    openQuickCapture,
    activeCaseDetailId,
    setActiveCaseDetailId,
    createJournalEntry,
  } = useData();

  const { registerActionHandler } = useHotkeys();

  // Dual View Mode: 'kanban' or 'table'
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  const [selectedCaseDetail, setSelectedCaseDetail] = useState<CaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Register Pipeline hotkey handlers
  useEffect(() => {
    const unregView = registerActionHandler('pipeline_toggle_view', () => {
      setViewMode((curr) => (curr === 'kanban' ? 'table' : 'kanban'));
    });

    const unregNewCase = registerActionHandler('pipeline_new_case', () => {
      openQuickCapture('case');
    });

    return () => {
      unregView();
      unregNewCase();
    };
  }, [registerActionHandler, openQuickCapture]);

  // New milestone form in drawer
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneAmount, setNewMilestoneAmount] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');

  // New diary note in drawer
  const [diaryNoteText, setDiaryNoteText] = useState('');

  // Load detail whenever activeCaseDetailId changes
  useEffect(() => {
    if (activeCaseDetailId) {
      setDetailLoading(true);
      getCaseDetail(activeCaseDetailId)
        .then((detail) => {
          setSelectedCaseDetail(detail);
        })
        .catch(console.error)
        .finally(() => setDetailLoading(false));
    } else {
      setSelectedCaseDetail(null);
    }
  }, [activeCaseDetailId, getCaseDetail]);

  const handleStageMove = async (c: Case, direction: 'prev' | 'next', e: React.MouseEvent) => {
    e.stopPropagation();
    const stageIds: CaseStage[] = ['LEAD', 'QUOTATION', 'ACTIVE', 'COMPLETED', 'LOST'];
    const currIdx = stageIds.indexOf(c.stage);
    let nextIdx = currIdx;
    if (direction === 'prev' && currIdx > 0) nextIdx = currIdx - 1;
    if (direction === 'next' && currIdx < stageIds.length - 1) nextIdx = currIdx + 1;

    if (nextIdx !== currIdx) {
      await updateCase(c.id, { stage: stageIds[nextIdx] });
      if (selectedCaseDetail && selectedCaseDetail.id === c.id) {
        setSelectedCaseDetail((prev) => (prev ? { ...prev, stage: stageIds[nextIdx] } : null));
      }
    }
  };

  const handleToggleMilestone = async (m: Milestone) => {
    await toggleMilestone(m.id, !m.completed);
    if (selectedCaseDetail) {
      const refreshed = await getCaseDetail(selectedCaseDetail.id);
      setSelectedCaseDetail(refreshed);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseDetail || !newMilestoneTitle) return;
    await createMilestone({
      case_id: selectedCaseDetail.id,
      title: newMilestoneTitle,
      amount: Number(newMilestoneAmount) || 0,
      due_date: newMilestoneDate || undefined,
    });
    setNewMilestoneTitle('');
    setNewMilestoneAmount('');
    setNewMilestoneDate('');
    const refreshed = await getCaseDetail(selectedCaseDetail.id);
    setSelectedCaseDetail(refreshed);
  };

  const handleAddDiaryNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseDetail || !diaryNoteText) return;
    await createJournalEntry({
      title: `Nota: ${selectedCaseDetail.title}`,
      content: diaryNoteText,
      case_id: selectedCaseDetail.id,
      tags: ['Proyecto', selectedCaseDetail.code || 'Nota'],
    });
    setDiaryNoteText('');
    const refreshed = await getCaseDetail(selectedCaseDetail.id);
    setSelectedCaseDetail(refreshed);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian-950 overflow-hidden relative text-obsidian-100">
      {/* Top Action Bar */}
      <div className="p-4 border-b border-surface-border bg-surface-primary flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-sm font-semibold tracking-[0.2em] text-obsidian-100 font-mono uppercase flex items-center space-x-2">
            <Briefcase className="w-4 h-4 text-obsidian-400" />
            <span>Proyectos y Cartera de Clientes</span>
          </h1>
          <p className="text-xs text-obsidian-500">
            Pipeline de cotizaciones, entregas en curso y rentabilidad por cuenta
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Dual View Switcher */}
          <div className="flex items-center bg-surface-secondary p-0.5 rounded border border-surface-border">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-fast ${
                viewMode === 'kanban'
                  ? 'bg-obsidian-100 text-obsidian-950 font-bold'
                  : 'text-obsidian-400 hover:text-obsidian-200'
              }`}
              title="Vista de Tablero"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Tablero</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-fast ${
                viewMode === 'table'
                  ? 'bg-obsidian-100 text-obsidian-950 font-bold'
                  : 'text-obsidian-400 hover:text-obsidian-200'
              }`}
              title="Vista de Tabla"
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
            <div className="px-1">
              <HotkeyBadge actionId="pipeline_toggle_view" variant="subtle" />
            </div>
          </div>

          {/* Export CSV */}
          <button
            onClick={async () => {
              try {
                const csv = await triggerCsvExport('cases');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `proyectos_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
              } catch (err: any) {
                alert(`Error al exportar CSV: ${err.message || err}`);
              }
            }}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-surface-secondary hover:bg-surface-hover border border-surface-border text-obsidian-300 hover:text-white text-xs font-medium rounded transition-fast"
            title="Exportar proyectos en CSV"
          >
            <Download className="w-3.5 h-3.5 text-obsidian-400" />
            <span>Exportar CSV</span>
            <HotkeyBadge actionId="global_export_csv" />
          </button>

          {/* Create Project Button */}
          <button
            onClick={() => openQuickCapture('case')}
            className="flex items-center space-x-1 px-3 py-1.5 bg-obsidian-100 hover:bg-white text-obsidian-950 text-xs font-semibold rounded transition-fast"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Proyecto</span>
            <HotkeyBadge actionId="pipeline_new_case" variant="accent" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'kanban' ? (
        /* Kanban Board View */
        <div className="flex-1 overflow-x-auto p-4 flex space-x-3.5 select-none bg-obsidian-950">
          {STAGES.map((st) => {
            const stageCases = cases.filter((c) => c.stage === st.id);
            const totalQuoted = stageCases.reduce((acc, c) => acc + c.quoted_amount, 0);

            return (
              <div
                key={st.id}
                className="w-72 shrink-0 flex flex-col bg-surface-primary border border-surface-border rounded-lg max-h-full"
              >
                {/* Column Header */}
                <div className="p-3 border-b border-surface-border flex items-center justify-between bg-surface-secondary/40 rounded-t-lg">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-xs text-obsidian-200 font-mono">{st.label}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-secondary text-obsidian-400 border border-surface-borderSubtle">
                      {stageCases.length}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-obsidian-400 tabular-nums">
                    ${totalQuoted.toLocaleString()}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                  {stageCases.length === 0 ? (
                    <div className="py-8 text-center text-xs text-obsidian-600 border border-dashed border-surface-borderSubtle rounded">
                      Sin proyectos en esta etapa
                    </div>
                  ) : (
                    stageCases.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setActiveCaseDetailId(c.id)}
                        className="craft-card-interactive p-3 space-y-2.5 cursor-pointer shadow-subtle group"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-mono text-obsidian-500 uppercase tracking-wider block">
                              {c.code || 'EXP-00'}
                            </span>
                            <h2 className="text-xs font-semibold text-obsidian-100 group-hover:text-white transition-fast line-clamp-1">
                              {c.title}
                            </h2>
                          </div>
                          <span className="text-xs font-mono font-bold text-financial-positiveText tabular-nums">
                            ${c.quoted_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-obsidian-400 font-mono pt-1 border-t border-surface-borderSubtle">
                          <span className="truncate max-w-[130px]">{c.client_name}</span>
                          {c.target_completion_date && (
                            <span className="text-[10px] text-obsidian-500 flex items-center space-x-1">
                              <Calendar className="w-2.5 h-2.5" />
                              <span>{c.target_completion_date}</span>
                            </span>
                          )}
                        </div>

                        {/* Quick Move Stage Arrows */}
                        <div className="flex items-center justify-between pt-1 border-t border-surface-borderSubtle text-[10px]">
                          <button
                            onClick={(e) => handleStageMove(c, 'prev', e)}
                            className="p-1 rounded bg-surface-secondary hover:bg-surface-hover text-obsidian-400 hover:text-obsidian-200 transition-fast"
                            title="Mover a etapa anterior"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                          <span className="text-[10px] font-mono text-obsidian-500 uppercase">
                            Cambiar etapa
                          </span>
                          <button
                            onClick={(e) => handleStageMove(c, 'next', e)}
                            className="p-1 rounded bg-surface-secondary hover:bg-surface-hover text-obsidian-400 hover:text-obsidian-200 transition-fast"
                            title="Mover a siguiente etapa"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View Mode */
        <div className="flex-1 overflow-auto bg-obsidian-950">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-surface-primary text-[10px] uppercase font-mono tracking-wider text-obsidian-500 border-b border-surface-border select-none z-10">
              <tr>
                <th className="py-2.5 px-4 w-28">Código</th>
                <th className="py-2.5 px-4">Proyecto</th>
                <th className="py-2.5 px-4 w-48">Cliente</th>
                <th className="py-2.5 px-4 w-36">Etapa</th>
                <th className="py-2.5 px-4 w-32 text-right">Cotizado</th>
                <th className="py-2.5 px-4 w-32">Entrega</th>
                <th className="py-2.5 px-4 w-20 text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-borderSubtle">
              {cases.map((c) => {
                const stageObj = STAGES.find((s) => s.id === c.stage);
                return (
                  <tr
                    key={c.id}
                    onClick={() => setActiveCaseDetailId(c.id)}
                    className="hover:bg-surface-hover/60 transition-fast cursor-pointer group"
                  >
                    <td className="py-2.5 px-4 font-mono text-obsidian-400">{c.code || '—'}</td>
                    <td className="py-2.5 px-4 font-semibold text-obsidian-100 group-hover:text-white">
                      {c.title}
                    </td>
                    <td className="py-2.5 px-4 text-obsidian-300">{c.client_name}</td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${stageObj?.tagClass}`}>
                        {stageObj?.label || c.stage}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-financial-positiveText tabular-nums">
                      ${c.quoted_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-obsidian-400">{c.target_completion_date || '—'}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button className="text-[11px] font-mono text-obsidian-400 hover:text-white">
                        Ver →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Case Detail Slide-in Drawer */}
      {activeCaseDetailId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <div className="w-full max-w-xl h-full bg-surface-primary border-l border-surface-border shadow-modal flex flex-col justify-between overflow-hidden">
            {detailLoading || !selectedCaseDetail ? (
              <div className="flex-1 flex items-center justify-center text-xs text-obsidian-500 font-mono">
                Cargando datos del proyecto...
              </div>
            ) : (
              <>
                {/* Drawer Header */}
                <div className="p-5 border-b border-surface-border bg-surface-secondary space-y-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-primary text-obsidian-300 border border-surface-border">
                        {selectedCaseDetail.code || 'PROYECTO'}
                      </span>
                      <span className="text-xs font-mono font-semibold text-financial-warningText">
                        {STAGES.find((s) => s.id === selectedCaseDetail.stage)?.label}
                      </span>
                    </div>

                    <button
                      onClick={() => setActiveCaseDetailId(null)}
                      className="p-1.5 rounded bg-surface-primary hover:bg-surface-hover text-obsidian-400 hover:text-white transition-fast"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-obsidian-100 tracking-tight">
                      {selectedCaseDetail.title}
                    </h2>
                    <div className="flex items-center space-x-4 text-xs text-obsidian-400 mt-1 font-mono">
                      <span>Cliente: {selectedCaseDetail.client_name}</span>
                      {selectedCaseDetail.client_contact && <span>Contacto: {selectedCaseDetail.client_contact}</span>}
                    </div>
                  </div>

                  {/* Financial Summary Strip */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-surface-borderSubtle">
                    <div className="craft-card-inset p-2 text-center space-y-0.5">
                      <div className="text-[9px] text-obsidian-500 font-mono uppercase">Presupuesto</div>
                      <div className="text-xs font-bold font-mono text-obsidian-100 tabular-nums">
                        ${selectedCaseDetail.quoted_amount.toLocaleString()}
                      </div>
                    </div>
                    <div className="craft-card-inset p-2 text-center space-y-0.5">
                      <div className="text-[9px] text-obsidian-500 font-mono uppercase">Ingreso Cobrado</div>
                      <div className="text-xs font-bold font-mono text-financial-positiveText tabular-nums">
                        ${selectedCaseDetail.realized_income.toLocaleString()}
                      </div>
                    </div>
                    <div className="craft-card-inset p-2 text-center space-y-0.5">
                      <div className="text-[9px] text-obsidian-500 font-mono uppercase">Gasto Imputado</div>
                      <div className="text-xs font-bold font-mono text-financial-negativeText tabular-nums">
                        ${selectedCaseDetail.realized_expense.toLocaleString()}
                      </div>
                    </div>
                    <div className="craft-card-inset p-2 text-center space-y-0.5">
                      <div className="text-[9px] text-obsidian-500 font-mono uppercase">Margen Real</div>
                      <div
                        className={`text-xs font-bold font-mono tabular-nums ${
                          selectedCaseDetail.net_margin >= 0 ? 'text-financial-positiveText' : 'text-financial-negativeText'
                        }`}
                      >
                        ${selectedCaseDetail.net_margin.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Drawer Body: Milestones & Project Diary */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  {/* Milestones Checklist Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-surface-border pb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-obsidian-300 font-mono flex items-center space-x-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-obsidian-400" />
                        <span>Hitos y Entregas Parciales</span>
                      </h3>
                      <span className="text-[10px] font-mono text-obsidian-500">
                        {selectedCaseDetail.milestones.filter((m) => m.completed).length} /{' '}
                        {selectedCaseDetail.milestones.length} completados
                      </span>
                    </div>

                    {/* Milestones List */}
                    <div className="space-y-1.5">
                      {selectedCaseDetail.milestones.length === 0 ? (
                        <div className="py-4 text-center text-xs text-obsidian-500 border border-dashed border-surface-borderSubtle rounded">
                          No hay hitos definidos para este proyecto.
                        </div>
                      ) : (
                        selectedCaseDetail.milestones.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => handleToggleMilestone(m)}
                            className={`p-2.5 rounded border transition-fast flex items-center justify-between text-xs cursor-pointer ${
                              m.completed
                                ? 'bg-surface-secondary/40 border-surface-borderSubtle text-obsidian-500'
                                : 'bg-surface-secondary border-surface-border text-obsidian-200 hover:border-obsidian-500'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              <input
                                type="checkbox"
                                checked={m.completed}
                                onChange={() => {}}
                                className="rounded bg-surface-primary border-surface-border text-emerald-500 focus:ring-0"
                              />
                              <span className={m.completed ? 'line-through' : 'font-medium'}>{m.title}</span>
                            </div>
                            <div className="flex items-center space-x-3 font-mono text-[11px]">
                              {m.due_date && <span className="text-obsidian-500">{m.due_date}</span>}
                              {(m.amount ?? 0) > 0 && (
                                <span className="font-bold text-obsidian-300 tabular-nums">
                                  ${(m.amount ?? 0).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Milestone Inline Form */}
                    <form onSubmit={handleAddMilestone} className="grid grid-cols-12 gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Nombre del nuevo hito..."
                        value={newMilestoneTitle}
                        onChange={(e) => setNewMilestoneTitle(e.target.value)}
                        className="col-span-6 px-2.5 py-1.5 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-200 placeholder-obsidian-500"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Importe ($)"
                        value={newMilestoneAmount}
                        onChange={(e) => setNewMilestoneAmount(e.target.value)}
                        className="col-span-3 px-2.5 py-1.5 bg-surface-secondary border border-surface-border rounded text-xs font-mono text-obsidian-200"
                      />
                      <button
                        type="submit"
                        className="col-span-3 py-1.5 bg-obsidian-100 hover:bg-white text-obsidian-950 font-bold text-xs rounded transition-fast"
                      >
                        + Añadir
                      </button>
                    </form>
                  </div>

                  {/* Project Diary / Notes Feed */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-surface-border pb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-obsidian-300 font-mono flex items-center space-x-2">
                        <FileText className="w-3.5 h-3.5 text-obsidian-400" />
                        <span>Bitácora Vinculada al Proyecto</span>
                      </h3>
                      <span className="text-[10px] font-mono text-obsidian-500">
                        {selectedCaseDetail.diary_entries.length} notas
                      </span>
                    </div>

                    {/* Diary Notes Feed */}
                    <div className="space-y-2">
                      {selectedCaseDetail.diary_entries.length === 0 ? (
                        <div className="py-4 text-center text-xs text-obsidian-500 border border-dashed border-surface-borderSubtle rounded">
                          No hay notas de bitácora para este caso.
                        </div>
                      ) : (
                        selectedCaseDetail.diary_entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="craft-card-inset p-3 space-y-1.5 text-xs border border-surface-borderSubtle"
                          >
                            <div className="flex items-center justify-between text-[10px] text-obsidian-500 font-mono">
                              <span className="font-semibold text-obsidian-300">{entry.title}</span>
                              <span>{entry.updated_at ? entry.updated_at.substring(0, 10) : 'Hoy'}</span>
                            </div>
                            <p className="text-obsidian-300 whitespace-pre-line text-xs font-sans">
                              {entry.content}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Fast Add Diary Note Form */}
                    <form onSubmit={handleAddDiaryNote} className="space-y-2 pt-1">
                      <textarea
                        rows={2}
                        placeholder="Escribir avance o acuerdo importante..."
                        value={diaryNoteText}
                        onChange={(e) => setDiaryNoteText(e.target.value)}
                        className="w-full p-2.5 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-200 placeholder-obsidian-500 focus:outline-none"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={!diaryNoteText}
                          className="px-3 py-1 bg-obsidian-100 hover:bg-white text-obsidian-950 text-xs font-semibold rounded transition-fast disabled:opacity-40"
                        >
                          Guardar Nota
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Drawer Footer */}
                <div className="p-4 border-t border-surface-border bg-surface-secondary flex items-center justify-between shrink-0">
                  <span className="text-[10px] text-obsidian-500 font-mono">
                    ID: {selectedCaseDetail.id}
                  </span>
                  <button
                    onClick={() => setActiveCaseDetailId(null)}
                    className="px-3 py-1.5 bg-surface-primary hover:bg-surface-hover text-obsidian-300 text-xs rounded border border-surface-border transition-fast"
                  >
                    Cerrar Detalle
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
