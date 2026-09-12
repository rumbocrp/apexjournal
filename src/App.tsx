import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { HotkeyProvider, useHotkeys } from './context/HotkeyContext';
import { Titlebar } from './components/layout/Titlebar';
import { Sidebar } from './components/layout/Sidebar';
import { CommandPalette } from './components/palette/CommandPalette';
import { QuickCaptureModal } from './components/capture/QuickCaptureModal';
import { HotkeyManagerModal } from './components/hotkeys/HotkeyManagerModal';
import { LockScreen } from './views/LockScreen';
import { DashboardView } from './views/DashboardView';
import { BlotterView } from './views/BlotterView';
import { PipelineView } from './views/PipelineView';
import { JournalView } from './views/JournalView';
import { triggerBackupExport, triggerExcelExport, triggerCsvExport } from './api/export';

function MainAppShell() {
  const { status, loading, lock } = useAuth();
  const {
    activeView,
    setActiveView,
    setCommandPaletteOpen,
    openQuickCapture,
    refreshAll,
    toggleSidebar,
    activeCaseDetailId,
  } = useData();

  const { registerActionHandler, setHotkeyManagerOpen } = useHotkeys();

  // Register core hotkey actions
  useEffect(() => {
    const unregNavDash = registerActionHandler('nav_dashboard', () => setActiveView('dashboard'));
    const unregNavBlotter = registerActionHandler('nav_blotter', () => setActiveView('blotter'));
    const unregNavPipe = registerActionHandler('nav_pipeline', () => setActiveView('pipeline'));
    const unregNavJournal = registerActionHandler('nav_journal', () => setActiveView('journal'));

    const unregPalette = registerActionHandler('global_command_palette', () => {
      setCommandPaletteOpen(true);
    });

    const unregQuickCapture = registerActionHandler('global_quick_capture', () => {
      openQuickCapture('transaction');
    });

    const unregHotkeyMgr = registerActionHandler('global_hotkey_manager', () => {
      setHotkeyManagerOpen(true);
    });

    const unregLock = registerActionHandler('global_lock_vault', () => {
      lock();
    });

    const unregRefresh = registerActionHandler('global_refresh_data', () => {
      refreshAll();
    });

    const unregSidebar = registerActionHandler('global_toggle_sidebar', () => {
      toggleSidebar();
    });

    const unregBackup = registerActionHandler('global_export_backup', async () => {
      try {
        const res = await triggerBackupExport();
        alert(`Copia de seguridad guardada con éxito en:\n${res.destination_path}`);
      } catch (err: any) {
        alert(`No se pudo guardar la copia: ${err.message || err}`);
      }
    });

    const unregExcel = registerActionHandler('global_export_excel', async () => {
      try {
        await triggerExcelExport();
        alert('Informe de cuentas en Excel generado con éxito.');
      } catch (err: any) {
        alert(`Error al exportar Excel: ${err.message || err}`);
      }
    });

    const unregCsv = registerActionHandler('global_export_csv', async () => {
      try {
        const exportType = activeView === 'pipeline' ? 'cases' : activeView === 'journal' ? 'journal' : 'transactions';
        await triggerCsvExport(exportType);
      } catch (err: any) {
        alert(`Error al exportar CSV: ${err.message || err}`);
      }
    });

    return () => {
      unregNavDash();
      unregNavBlotter();
      unregNavPipe();
      unregNavJournal();
      unregPalette();
      unregQuickCapture();
      unregHotkeyMgr();
      unregLock();
      unregRefresh();
      unregSidebar();
      unregBackup();
      unregExcel();
      unregCsv();
    };
  }, [
    registerActionHandler,
    setActiveView,
    setCommandPaletteOpen,
    openQuickCapture,
    setHotkeyManagerOpen,
    lock,
    refreshAll,
    toggleSidebar,
    activeView,
    activeCaseDetailId,
  ]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#09090b] flex items-center justify-center text-zinc-400 font-mono text-xs">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
          <span>Verificando sesión cifrada...</span>
        </div>
      </div>
    );
  }

  if (!status.unlocked) {
    return <LockScreen />;
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-[#09090b] text-[#f4f4f5] font-sans antialiased overflow-hidden select-none">
      {/* Native macOS Overlay Titlebar */}
      <Titlebar />

      {/* Main App Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar />

        {/* Dynamic Core View Content */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          {activeView === 'dashboard' && <DashboardView />}
          {activeView === 'blotter' && <BlotterView />}
          {activeView === 'pipeline' && <PipelineView />}
          {activeView === 'journal' && <JournalView />}
        </main>
      </div>

      {/* Global Modals, Palettes & Hotkey Manager */}
      <CommandPalette />
      <QuickCaptureModal />
      <HotkeyManagerModal />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <HotkeyProvider>
          <MainAppShell />
        </HotkeyProvider>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
