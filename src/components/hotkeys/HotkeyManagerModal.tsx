import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Keyboard,
  RotateCcw,
  AlertTriangle,
  Check,
  Edit2,
} from 'lucide-react';
import { useHotkeys } from '../../context/HotkeyContext';
import { HotkeyCategory, HotkeyDefinition } from '../../services/hotkeys/types';
import { eventToCombo, formatDisplayCombo } from '../../services/hotkeys/hotkeyRegistry';

const CATEGORIES: { id: 'all' | HotkeyCategory; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'navigation', label: 'Navegación' },
  { id: 'global', label: 'Sistema & Global' },
  { id: 'blotter', label: 'Movimientos' },
  { id: 'pipeline', label: 'Proyectos' },
  { id: 'journal', label: 'Bitácora' },
  { id: 'dashboard', label: 'Resumen' },
];

export const HotkeyManagerModal: React.FC = () => {
  const {
    hotkeys,
    isHotkeyManagerOpen,
    setHotkeyManagerOpen,
    updateHotkey,
    resetHotkey,
    resetAllHotkeys,
    setIsRecording,
  } = useHotkeys();

  const [activeTab, setActiveTab] = useState<'all' | HotkeyCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [recordedCombo, setRecordedCombo] = useState<string>('');
  const [conflictWarning, setConflictWarning] = useState<HotkeyDefinition | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search when modal opens
  useEffect(() => {
    if (isHotkeyManagerOpen) {
      setSearchQuery('');
      setEditingActionId(null);
      setConflictWarning(null);
      setRecordedCombo('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isHotkeyManagerOpen]);

  // Keep recording state synced with context
  useEffect(() => {
    setIsRecording(editingActionId !== null);
    return () => setIsRecording(false);
  }, [editingActionId, setIsRecording]);

  // Close modal on Escape when not recording
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isHotkeyManagerOpen && !editingActionId) {
        e.preventDefault();
        setHotkeyManagerOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isHotkeyManagerOpen, editingActionId, setHotkeyManagerOpen]);

  // Listener for key recording
  useEffect(() => {
    if (!editingActionId) return;

    const handleRecordKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Cancel on Escape
      if (e.key === 'Escape') {
        setEditingActionId(null);
        setConflictWarning(null);
        setRecordedCombo('');
        return;
      }

      const combo = eventToCombo(e);
      if (!combo) return; // modifier key alone

      setRecordedCombo(combo);

      // Attempt update
      const res = updateHotkey(editingActionId, combo, false);
      if (!res.success && res.conflictWith) {
        setConflictWarning(res.conflictWith);
      } else {
        // Success
        setConflictWarning(null);
        setEditingActionId(null);
        setSuccessToast(`Atajo actualizado a ${combo}`);
        setTimeout(() => setSuccessToast(null), 2500);
      }
    };

    window.addEventListener('keydown', handleRecordKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleRecordKeyDown, { capture: true });
  }, [editingActionId, updateHotkey]);

  if (!isHotkeyManagerOpen) return null;

  const handleForceAssign = () => {
    if (!editingActionId || !recordedCombo) return;
    updateHotkey(editingActionId, recordedCombo, true);
    setConflictWarning(null);
    setEditingActionId(null);
    setSuccessToast(`Atajo forzado a ${recordedCombo}`);
    setTimeout(() => setSuccessToast(null), 2500);
  };

  const filteredHotkeys = hotkeys.filter((h) => {
    if (activeTab !== 'all' && h.category !== activeTab) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = h.name.toLowerCase().includes(q);
      const matchDesc = h.description.toLowerCase().includes(q);
      const matchCombo = h.currentCombo.toLowerCase().includes(q);
      const matchCat = h.categoryLabel.toLowerCase().includes(q);
      return matchName || matchDesc || matchCombo || matchCat;
    }
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none"
      onClick={() => {
        if (!editingActionId) setHotkeyManagerOpen(false);
      }}
    >
      <div
        className="w-full max-w-2xl bg-surface-primary border border-surface-border rounded-lg shadow-modal overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-surface-border bg-surface-secondary/60 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded bg-surface-primary border border-surface-border">
              <Keyboard className="w-4 h-4 text-obsidian-200" />
            </div>
            <div>
              <h2 className="text-xs font-bold font-mono tracking-wider text-obsidian-100 uppercase">
                Gestor de Atajos y Teclado
              </h2>
              <p className="text-[11px] text-obsidian-500">
                Atajos universales, editables y de latencia cero para todas las funciones
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (confirm('¿Restablecer todos los atajos de teclado a los valores de fábrica?')) {
                  resetAllHotkeys();
                  setSuccessToast('Todos los atajos se han restablecido.');
                  setTimeout(() => setSuccessToast(null), 2500);
                }
              }}
              className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-sans font-medium text-obsidian-400 hover:text-obsidian-200 bg-surface-primary border border-surface-border hover:border-surface-borderSubtle rounded transition-fast"
              title="Restaurar combinaciones predeterminadas"
            >
              <RotateCcw className="w-3 h-3 text-obsidian-400" />
              <span>Restablecer Todo</span>
            </button>

            <button
              onClick={() => setHotkeyManagerOpen(false)}
              className="p-1 text-obsidian-400 hover:text-obsidian-100 rounded hover:bg-surface-hover transition-fast"
              title="Cerrar modal (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Success toast banner */}
        {successToast && (
          <div className="bg-financial-positiveMuted border-b border-financial-positiveBorder px-4 py-1.5 text-xs text-financial-positiveText font-mono flex items-center space-x-2">
            <Check className="w-3.5 h-3.5" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Conflict Resolution Banner */}
        {conflictWarning && editingActionId && (
          <div className="p-3 bg-financial-warningMuted border-b border-financial-warningBorder text-xs text-financial-warningText flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-financial-warning" />
              <span>
                Conflicto: la combinación{' '}
                <strong className="font-mono underline">{recordedCombo}</strong> ya está asignada a:{' '}
                <strong>"{conflictWarning.name}"</strong>.
              </span>
            </div>
            <div className="flex items-center space-x-2 shrink-0 ml-3">
              <button
                onClick={handleForceAssign}
                className="px-2 py-0.5 text-[11px] font-semibold bg-financial-warning hover:bg-yellow-400 text-black rounded transition-fast"
              >
                Reasignar (Sobrescribir)
              </button>
              <button
                onClick={() => {
                  setConflictWarning(null);
                  setEditingActionId(null);
                }}
                className="px-2 py-0.5 text-[11px] text-obsidian-300 hover:text-white bg-surface-primary border border-surface-border rounded transition-fast"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Search & Category Tabs */}
        <div className="p-3 border-b border-surface-border bg-surface-primary space-y-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-obsidian-500 absolute left-2.5 top-2.5" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar función, campo o tecla..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-200 placeholder-obsidian-500 focus:outline-none focus:border-obsidian-400"
            />
          </div>

          <div className="flex items-center space-x-1 overflow-x-auto pb-0.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-fast ${
                  activeTab === cat.id
                    ? 'bg-surface-secondary text-obsidian-100 border border-surface-borderSubtle font-semibold'
                    : 'text-obsidian-400 hover:text-obsidian-200 hover:bg-surface-hover/40'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hotkeys List Table */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 divide-y divide-surface-borderSubtle">
          {filteredHotkeys.length === 0 ? (
            <div className="py-12 text-center text-xs text-obsidian-500">
              No se encontraron atajos para el filtro seleccionado.
            </div>
          ) : (
            filteredHotkeys.map((item) => {
              const isEditing = editingActionId === item.id;
              const isModified = item.currentCombo !== item.defaultCombo;

              return (
                <div
                  key={item.id}
                  className={`pt-2.5 pb-2 px-2 flex items-center justify-between rounded transition-fast ${
                    isEditing
                      ? 'bg-surface-secondary border border-obsidian-400'
                      : 'hover:bg-surface-hover/50'
                  }`}
                >
                  <div className="pr-3 space-y-0.5 truncate">
                    <div className="flex items-center space-x-2 truncate">
                      <span className="text-xs font-semibold text-obsidian-100 truncate">
                        {item.name}
                      </span>
                      <span className="text-[9px] font-mono text-obsidian-500 px-1 py-0.2 rounded bg-surface-secondary border border-surface-borderSubtle uppercase">
                        {item.categoryLabel}
                      </span>
                      {isModified && (
                        <span className="text-[9px] font-mono text-financial-positiveText px-1 py-0.2 rounded bg-financial-positiveMuted border border-financial-positiveBorder">
                          Personalizado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-obsidian-400 truncate">{item.description}</p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {isEditing ? (
                      <div className="flex items-center space-x-2">
                        <div className="px-2.5 py-1 rounded bg-obsidian-950 border-2 border-dashed border-obsidian-400 text-obsidian-100 font-mono text-xs animate-pulse">
                          Presiona la nueva tecla...
                        </div>
                        <button
                          onClick={() => {
                            setEditingActionId(null);
                            setConflictWarning(null);
                          }}
                          className="px-2 py-1 text-[10px] text-obsidian-400 hover:text-obsidian-200 bg-surface-primary border border-surface-border rounded"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingActionId(item.id);
                            setConflictWarning(null);
                            setRecordedCombo('');
                          }}
                          className="px-2.5 py-1 rounded bg-surface-secondary hover:bg-surface-hover border border-surface-border hover:border-surface-borderSubtle flex items-center space-x-2 group transition-fast"
                          title="Haz clic para cambiar este atajo"
                        >
                          <kbd className="font-mono text-xs font-bold text-obsidian-200 tracking-wider">
                            {formatDisplayCombo(item.currentCombo) || '(Sin atajo)'}
                          </kbd>
                          <Edit2 className="w-3 h-3 text-obsidian-500 group-hover:text-obsidian-300" />
                        </button>

                        {isModified && (
                          <button
                            onClick={() => resetHotkey(item.id)}
                            className="p-1 text-obsidian-500 hover:text-obsidian-300 rounded hover:bg-surface-hover transition-fast"
                            title="Restablecer combinación original"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-surface-border bg-surface-secondary/40 text-[11px] font-mono text-obsidian-500 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span>Haz clic en cualquier atajo para reasignarlo</span>
            <span>•</span>
            <span>Esc para salir</span>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-obsidian-400">
            ApexJournal Keyboard Velocity Engine
          </div>
        </div>
      </div>
    </div>
  );
};
