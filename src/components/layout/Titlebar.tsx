import React from 'react';
import { Lock, Search, Download, Keyboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useHotkeys } from '../../context/HotkeyContext';
import { triggerBackupExport } from '../../api/export';
import { ApexLogo } from './ApexLogo';
import { HardwareOpticalBezel } from '../lights/TrafficLightSystem';
import { HotkeyBadge } from '../hotkeys';
import { isMacPlatform } from '../../services/hotkeys/hotkeyRegistry';

export const Titlebar: React.FC = () => {
  const { status, lock } = useAuth();
  const { setCommandPaletteOpen, arAging, setActiveView } = useData();
  const { setHotkeyManagerOpen } = useHotkeys();
  // macOS overlay titlebar reserves left space for traffic lights; native
  // Linux/Windows decorations need no such padding.
  const leftPad = isMacPlatform() ? 'pl-20' : 'pl-4';

  return (
    <header
      className={`h-10 w-full flex items-center justify-between ${leftPad} pr-4 select-none bg-surface-primary border-b border-surface-border z-30 shrink-0`}
      data-tauri-drag-region
    >
      {/* Brand & App Info */}
      <div className="flex items-center space-x-2.5">
        <ApexLogo size={18} />
        <span className="text-xs font-semibold tracking-wider text-obsidian-200 font-mono">
          ApexJournal
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-secondary text-obsidian-500 font-mono border border-surface-borderSubtle">
          v0.1.0
        </span>
      </div>

      {/* Global Actions */}
      <div className="flex items-center space-x-2">
        {/* Compact Sistema de Luces Indicator in Titlebar */}
        {status.unlocked && arAging && (
          <button
            onClick={() => setActiveView('dashboard')}
            className="flex items-center space-x-1.5 px-2 py-1 rounded bg-surface-secondary hover:bg-surface-hover border border-surface-border transition-fast"
            title="Estado general de cobros (Sistema de Luces)"
          >
            <span className="text-[10px] font-mono text-obsidian-400">AR:</span>
            <HardwareOpticalBezel state={arAging.traffic_light} size="sm" showLabels={false} />
          </button>
        )}

        {/* Command Palette Trigger */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center space-x-2 text-xs text-obsidian-300 hover:text-white px-2.5 py-1 rounded bg-surface-secondary hover:bg-surface-hover border border-surface-border transition-fast"
          title="Buscar o ejecutar comandos"
        >
          <Search className="w-3.5 h-3.5 text-obsidian-400" />
          <span className="text-[11px] text-obsidian-300">Comandos</span>
          <HotkeyBadge actionId="global_command_palette" />
        </button>

        {/* Hotkey Manager Trigger */}
        {status.unlocked && (
          <button
            onClick={() => setHotkeyManagerOpen(true)}
            className="flex items-center space-x-1.5 text-xs text-obsidian-300 hover:text-white px-2 py-1 rounded bg-surface-secondary hover:bg-surface-hover border border-surface-border transition-fast"
            title="Ver y editar atajos de teclado"
          >
            <Keyboard className="w-3.5 h-3.5 text-obsidian-400" />
            <span className="text-[11px]">Atajos</span>
            <HotkeyBadge actionId="global_hotkey_manager" />
          </button>
        )}

        {/* Export & Backup */}
        {status.unlocked && (
          <button
            onClick={async () => {
              try {
                const res = await triggerBackupExport();
                alert(`Copia de seguridad guardada con éxito en:\n${res.destination_path}`);
              } catch (err: any) {
                alert(`No se pudo guardar la copia: ${err.message || err}`);
              }
            }}
            className="flex items-center space-x-1.5 text-xs text-obsidian-300 hover:text-white px-2.5 py-1 rounded bg-surface-secondary hover:bg-surface-hover border border-surface-border transition-fast"
            title="Guardar copia de seguridad cifrada"
          >
            <Download className="w-3.5 h-3.5 text-obsidian-400" />
            <span className="text-[11px]">Respaldo</span>
            <HotkeyBadge actionId="global_export_backup" />
          </button>
        )}

        {/* Lock Vault */}
        {status.unlocked && (
          <button
            onClick={lock}
            className="flex items-center space-x-1.5 text-xs text-obsidian-300 hover:text-financial-negativeText px-2.5 py-1 rounded bg-surface-secondary hover:bg-financial-negativeMuted border border-surface-border hover:border-financial-negativeBorder transition-fast"
            title="Bloquear sesión y proteger datos"
          >
            <Lock className="w-3.5 h-3.5 text-obsidian-400" />
            <span className="text-[11px]">Bloquear</span>
            <HotkeyBadge actionId="global_lock_vault" />
          </button>
        )}
      </div>
    </header>
  );
};
