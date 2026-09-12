import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  TrendingUp,
  Table,
  Briefcase,
  BookOpen,
  PlusCircle,
  Lock,
  RefreshCw,
  FileText,
  DollarSign,
  Maximize2,
  FileSpreadsheet,
  Download,
  Keyboard,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useHotkeys } from '../../context/HotkeyContext';
import { triggerBackupExport, triggerExcelExport } from '../../api/export';

interface PaletteAction {
  id: string;
  category: 'Navegación' | 'Acciones' | 'Proyectos' | 'Notas' | 'Movimientos' | 'Configuración';
  title: string;
  subtitle?: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  perform: () => void;
}

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    setActiveView,
    openQuickCapture,
    refreshAll,
    cases,
    journal,
    setActiveCaseDetailId,
    setZenMode,
  } = useData();
  const { lock } = useAuth();
  const { getDisplayCombo, setHotkeyManagerOpen } = useHotkeys();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isCommandPaletteOpen]);

  // Handle Escape key when open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        e.preventDefault();
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  // Build items list with reactive hotkey badges
  const baseActions: PaletteAction[] = [
    {
      id: 'nav-dashboard',
      category: 'Navegación',
      title: 'Ir al Resumen Principal',
      subtitle: 'Balance de capital, métricas clave y diagnóstico de cobros',
      badge: getDisplayCombo('nav_dashboard'),
      icon: TrendingUp,
      perform: () => {
        setActiveView('dashboard');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'nav-blotter',
      category: 'Navegación',
      title: 'Ir a Ingresos y Gastos',
      subtitle: 'Historial tabular de cobros, facturas y gastos',
      badge: getDisplayCombo('nav_blotter'),
      icon: Table,
      perform: () => {
        setActiveView('blotter');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'nav-pipeline',
      category: 'Navegación',
      title: 'Ir a Proyectos y Clientes',
      subtitle: 'Tablero de cotizaciones, entregas y rentabilidad',
      badge: getDisplayCombo('nav_pipeline'),
      icon: Briefcase,
      perform: () => {
        setActiveView('pipeline');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'nav-journal',
      category: 'Navegación',
      title: 'Ir a Bitácora y Notas',
      subtitle: 'Registro cronológico y editor Markdown',
      badge: getDisplayCombo('nav_journal'),
      icon: BookOpen,
      perform: () => {
        setActiveView('journal');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'act-new-tx',
      category: 'Acciones',
      title: 'Registrar Movimiento Financiero',
      subtitle: 'Añadir un ingreso, gasto o factura emitida',
      badge: getDisplayCombo('global_quick_capture'),
      icon: DollarSign,
      perform: () => {
        setCommandPaletteOpen(false);
        openQuickCapture('transaction');
      },
    },
    {
      id: 'act-new-case',
      category: 'Acciones',
      title: 'Crear Nuevo Proyecto / Caso',
      subtitle: 'Registrar nuevo presupuesto, cliente o hito',
      badge: getDisplayCombo('pipeline_new_case'),
      icon: PlusCircle,
      perform: () => {
        setCommandPaletteOpen(false);
        openQuickCapture('case');
      },
    },
    {
      id: 'act-new-note',
      category: 'Acciones',
      title: 'Crear Entrada en Bitácora',
      subtitle: 'Redactar nueva nota o acuerdo operativo',
      badge: getDisplayCombo('journal_new_entry'),
      icon: FileText,
      perform: () => {
        setCommandPaletteOpen(false);
        openQuickCapture('note');
      },
    },
    {
      id: 'act-zen',
      category: 'Acciones',
      title: 'Alternar Modo Zen de Bitácora',
      subtitle: 'Ocultar paneles laterales para escritura enfocada',
      badge: getDisplayCombo('journal_toggle_zen'),
      icon: Maximize2,
      perform: () => {
        setActiveView('journal');
        setZenMode((prev) => !prev);
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'act-hotkeys',
      category: 'Configuración',
      title: 'Personalizar Atajos de Teclado',
      subtitle: 'Ver y reasignar todos los hotkeys de la plataforma',
      badge: getDisplayCombo('global_hotkey_manager'),
      icon: Keyboard,
      perform: () => {
        setCommandPaletteOpen(false);
        setHotkeyManagerOpen(true);
      },
    },
    {
      id: 'act-backup',
      category: 'Acciones',
      title: 'Exportar Copia de Seguridad Bóveda',
      subtitle: 'Guardar contenedor cifrado (.vault) con Argon2id',
      badge: getDisplayCombo('global_export_backup'),
      icon: Download,
      perform: async () => {
        setCommandPaletteOpen(false);
        try {
          const res = await triggerBackupExport();
          alert(`Copia guardada en:\n${res.destination_path}`);
        } catch (err: any) {
          alert(`Error al respaldar: ${err.message || err}`);
        }
      },
    },
    {
      id: 'act-export-excel',
      category: 'Acciones',
      title: 'Exportar Informe Completo en Excel',
      subtitle: 'Generar auditoría con balance, clientes y bitácora',
      badge: getDisplayCombo('global_export_excel'),
      icon: FileSpreadsheet,
      perform: async () => {
        setCommandPaletteOpen(false);
        try {
          await triggerExcelExport();
          alert('Informe de cuentas en Excel generado con éxito.');
        } catch (err: any) {
          alert(`Error al exportar Excel: ${err.message || err}`);
        }
      },
    },
    {
      id: 'act-lock',
      category: 'Acciones',
      title: 'Bloquear Bóveda Cifrada',
      subtitle: 'Zeroizar memoria y cerrar base de datos SQLCipher',
      badge: getDisplayCombo('global_lock_vault'),
      icon: Lock,
      perform: () => {
        setCommandPaletteOpen(false);
        lock();
      },
    },
    {
      id: 'act-refresh',
      category: 'Acciones',
      title: 'Recargar Datos del Sistema',
      subtitle: 'Sincronizar base de datos con vista activa',
      badge: getDisplayCombo('global_refresh_data'),
      icon: RefreshCw,
      perform: () => {
        refreshAll();
        setCommandPaletteOpen(false);
      },
    },
  ];

  // Dynamic Case Actions
  const caseActions: PaletteAction[] = cases.map((c) => ({
    id: `case-${c.id}`,
    category: 'Proyectos',
    title: `${c.code ? c.code + ': ' : ''}${c.title}`,
    subtitle: `Cliente: ${c.client_name} • $${c.quoted_amount.toLocaleString()} (${c.stage})`,
    icon: Briefcase,
    perform: () => {
      setActiveView('pipeline');
      setActiveCaseDetailId(c.id);
      setCommandPaletteOpen(false);
    },
  }));

  // Dynamic Journal Actions
  const journalActions: PaletteAction[] = journal.slice(0, 10).map((j) => ({
    id: `journal-${j.id}`,
    category: 'Notas',
    title: j.title || 'Nota sin título',
    subtitle: j.content.substring(0, 70),
    icon: FileText,
    perform: () => {
      setActiveView('journal');
      setCommandPaletteOpen(false);
    },
  }));

  // Filtered Actions
  const allActions = [...baseActions, ...caseActions, ...journalActions];
  const filteredActions = allActions.filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle?.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredActions.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredActions.length) % Math.max(1, filteredActions.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        filteredActions[selectedIndex].perform();
      }
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/70 p-4"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="craft-card w-full max-w-xl bg-surface-primary border-surface-border shadow-modal overflow-hidden flex flex-col max-h-[480px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-surface-border flex items-center space-x-3 bg-surface-secondary/50">
          <Search className="w-4 h-4 text-obsidian-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Escribe un comando, proyecto o nota..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-sm text-obsidian-100 placeholder-obsidian-500 focus:outline-none"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-surface-primary text-obsidian-400 font-mono border border-surface-border">
            ESC
          </kbd>
        </div>

        {/* Action List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-0.5 select-none">
          {filteredActions.length === 0 ? (
            <div className="p-8 text-center text-xs text-obsidian-500">
              No se encontraron comandos para "{query}"
            </div>
          ) : (
            filteredActions.map((action, idx) => {
              const Icon = action.icon;
              const isSelected = selectedIndex === idx;

              return (
                <div
                  key={action.id}
                  onClick={() => action.perform()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2 rounded flex items-center justify-between cursor-pointer transition-fast ${
                    isSelected
                      ? 'bg-surface-secondary text-obsidian-100 border border-surface-borderSubtle'
                      : 'text-obsidian-300 hover:bg-surface-hover/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-obsidian-100' : 'text-obsidian-500'}`} />
                    <div className="truncate">
                      <div className="text-xs font-medium text-obsidian-100 truncate">{action.title}</div>
                      {action.subtitle && (
                        <div className="text-[10px] text-obsidian-500 truncate">{action.subtitle}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 ml-3">
                    <span className="text-[9px] font-mono text-obsidian-500 uppercase px-1.5 py-0.2 rounded bg-surface-primary border border-surface-borderSubtle">
                      {action.category}
                    </span>
                    {action.badge && (
                      <kbd className="text-[9px] font-mono text-obsidian-400 px-1.5 py-0.5 rounded bg-surface-primary border border-surface-border font-medium tabular-nums">
                        {action.badge}
                      </kbd>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Guide */}
        <div className="px-4 py-2 border-t border-surface-border bg-surface-secondary/40 text-[10px] font-mono text-obsidian-500 flex items-center justify-between select-none">
          <span>↑↓ para navegar • Enter para ejecutar</span>
          <span>ApexJournal Command Engine</span>
        </div>
      </div>
    </div>
  );
};
