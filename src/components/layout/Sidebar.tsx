import React from 'react';
import {
  TrendingUp,
  Table,
  Briefcase,
  BookOpen,
  Plus,
  Lock,
  ChevronLeft,
  ChevronRight,
  Keyboard,
} from 'lucide-react';
import { useData, ViewType } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useHotkeys } from '../../context/HotkeyContext';
import { HotkeyBadge } from '../hotkeys';
import { ApexLogo } from './ApexLogo';

interface NavItem {
  id: ViewType;
  actionId: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', actionId: 'nav_dashboard', label: 'Resumen Principal', icon: TrendingUp },
  { id: 'blotter', actionId: 'nav_blotter', label: 'Ingresos y Gastos', icon: Table },
  { id: 'pipeline', actionId: 'nav_pipeline', label: 'Proyectos y Clientes', icon: Briefcase },
  { id: 'journal', actionId: 'nav_journal', label: 'Notas y Bitácora', icon: BookOpen },
];

export const Sidebar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    openQuickCapture,
    dashboardMetrics,
    isSidebarCollapsed,
    toggleSidebar,
  } = useData();
  const { lock } = useAuth();
  const { setHotkeyManagerOpen } = useHotkeys();

  return (
    <aside
      className={`${
        isSidebarCollapsed ? 'w-14' : 'w-56'
      } bg-[#0c0c0e] border-r border-surface-border flex flex-col justify-between select-none h-full z-20 shrink-0 transition-all duration-150 ease-in-out`}
      aria-label="Navegación principal"
    >
      {/* Top section: Brand, Quick capture & navigation */}
      <div className="p-3 space-y-3">
        {/* Toggle Collapse & Brand Header */}
        <div className="flex items-center justify-between px-1">
          {!isSidebarCollapsed ? (
            <div className="flex items-center space-x-2">
              <ApexLogo size={18} />
              <span className="font-semibold text-xs tracking-wider text-obsidian-200 uppercase font-mono">
                ApexJournal
              </span>
            </div>
          ) : (
            <div className="mx-auto">
              <ApexLogo size={20} />
            </div>
          )}
          {!isSidebarCollapsed && (
            <button
              onClick={toggleSidebar}
              className="p-1 rounded bg-surface-secondary hover:bg-surface-hover text-obsidian-400 hover:text-obsidian-200 border border-surface-border transition-fast ml-auto"
              title="Colapsar menú (⌘[)"
              aria-label="Colapsar menú"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          )}
        </div>
        {isSidebarCollapsed && (
          <div className="flex justify-center pt-1">
            <button
              onClick={toggleSidebar}
              className="p-1 rounded bg-surface-secondary hover:bg-surface-hover text-obsidian-400 hover:text-obsidian-200 border border-surface-border transition-fast"
              title="Expandir menú (⌘[)"
              aria-label="Expandir menú"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Quick Capture Button */}
        <button
          onClick={() => openQuickCapture('transaction')}
          className={`w-full flex items-center ${
            isSidebarCollapsed ? 'justify-center px-1' : 'justify-between px-3'
          } py-2 bg-obsidian-100 hover:bg-white text-obsidian-950 rounded font-medium text-xs transition-fast`}
          title="Nuevo registro rápido"
        >
          <div className="flex items-center space-x-2">
            <Plus className="w-3.5 h-3.5 text-obsidian-950 shrink-0" />
            {!isSidebarCollapsed && <span className="font-semibold text-[11px]">Nuevo Registro</span>}
          </div>
          {!isSidebarCollapsed && (
            <HotkeyBadge actionId="global_quick_capture" variant="accent" />
          )}
        </button>

        {/* Navigation List */}
        <nav className="space-y-0.5 pt-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-2.5'
                } py-2 rounded text-xs transition-fast ${
                  isActive
                    ? 'bg-surface-secondary text-obsidian-100 font-semibold border-l-2 border-obsidian-100 pl-2'
                    : 'text-obsidian-400 hover:text-obsidian-200 hover:bg-surface-hover/50 font-normal'
                }`}
                title={item.label}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-obsidian-100' : 'text-obsidian-500'
                    }`}
                  />
                  {!isSidebarCollapsed && <span className="text-[11px] truncate">{item.label}</span>}
                </div>
                {!isSidebarCollapsed && (
                  <HotkeyBadge actionId={item.actionId} variant={isActive ? 'accent' : 'subtle'} />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom section: Financial status, Atajos & Lock */}
      <div className="p-3 border-t border-surface-border space-y-2">
        {!isSidebarCollapsed && dashboardMetrics && (
          <div className="p-2.5 rounded bg-surface-secondary border border-surface-borderSubtle space-y-1">
            <div className="text-[10px] text-obsidian-500 font-mono uppercase tracking-wider">
              Capital Total
            </div>
            <div className="text-sm font-bold font-mono text-obsidian-100 tabular-nums">
              ${dashboardMetrics.cumulative_net_margin.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        )}

        {/* Hotkey Manager Trigger */}
        <button
          onClick={() => setHotkeyManagerOpen(true)}
          className={`w-full flex items-center ${
            isSidebarCollapsed ? 'justify-center' : 'justify-between px-2.5'
          } py-1.5 text-xs text-obsidian-400 hover:text-obsidian-200 hover:bg-surface-secondary rounded border border-transparent hover:border-surface-border transition-fast`}
          title="Gestor de Atajos y Teclado"
        >
          <div className="flex items-center space-x-2">
            <Keyboard className="w-3.5 h-3.5 shrink-0" />
            {!isSidebarCollapsed && <span className="text-[11px]">Atajos de Teclado</span>}
          </div>
          {!isSidebarCollapsed && (
            <HotkeyBadge actionId="global_hotkey_manager" variant="subtle" />
          )}
        </button>

        {/* Lock Vault */}
        <button
          onClick={lock}
          className={`w-full flex items-center ${
            isSidebarCollapsed ? 'justify-center' : 'justify-between px-2.5'
          } py-1.5 text-xs text-obsidian-400 hover:text-financial-negativeText hover:bg-financial-negativeMuted rounded border border-transparent hover:border-financial-negativeBorder transition-fast`}
          title="Bloquear sesión"
        >
          <div className="flex items-center space-x-2">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            {!isSidebarCollapsed && <span className="text-[11px]">Bloquear Bóveda</span>}
          </div>
          {!isSidebarCollapsed && (
            <HotkeyBadge actionId="global_lock_vault" variant="subtle" />
          )}
        </button>
      </div>
    </aside>
  );
};
