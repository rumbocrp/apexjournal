import React, { useState } from 'react';
import { Fingerprint, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { vaultRestoreBackup } from '../api/export';
import { ApexLogo } from '../components/layout/ApexLogo';
import { Dropdown } from '../components/common/Dropdown';

export const LockScreen: React.FC = () => {
  const { status, unlock, setup, unlockBiometric, error, clearError, loading, refreshStatus } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [enableBiometrics, setEnableBiometrics] = useState(true);
  const [autoLockMinutes, setAutoLockMinutes] = useState(15);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restorePath, setRestorePath] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreLoading, setRestoreLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!password) {
      setLocalError('Por favor ingresa tu contraseña maestra');
      return;
    }

    if (!status.initialized) {
      if (password !== confirmPassword) {
        setLocalError('Las contraseñas no coinciden');
        return;
      }
      if (password.length < 8) {
        setLocalError('La contraseña maestra debe tener al menos 8 caracteres');
        return;
      }
      await setup(password, enableBiometrics && status.biometric_available, autoLockMinutes);
    } else {
      await unlock(password);
    }
  };

  const handleBiometricClick = async () => {
    setLocalError(null);
    clearError();
    await unlockBiometric();
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen w-screen bg-obsidian-950 text-obsidian-100 flex flex-col justify-between p-8 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between w-full max-w-md mx-auto">
        <div className="flex items-center space-x-2.5">
          <ApexLogo size={20} />
          <span className="text-xs font-semibold tracking-wider text-obsidian-200 uppercase font-mono">
            ApexJournal
          </span>
        </div>
        <span className="text-[11px] text-obsidian-500 font-mono">
          v0.1.0 • AES-256
        </span>
      </div>

      {/* Center Auth Card */}
      <div className="w-full max-w-sm mx-auto my-auto">
        <div className="craft-card p-6 shadow-card space-y-5 bg-surface-primary border-surface-border">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mx-auto mb-1">
              <ApexLogo size={36} />
            </div>
            <h1 className="text-sm font-semibold tracking-[0.2em] text-obsidian-100 font-mono uppercase">
              {status.initialized ? 'Bóveda Cifrada' : 'Inicializar Bóveda'}
            </h1>
            <p className="text-xs text-obsidian-400">
              {status.initialized
                ? 'Ingresa tu clave de acceso para descifrar la base de datos local.'
                : 'Define una contraseña maestra para cifrar tus registros con SQLCipher (AES-256).'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-obsidian-400 mb-1">
                Contraseña Maestra
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-100 placeholder-obsidian-600 focus:outline-none focus:border-obsidian-400 font-mono transition-fast"
                autoFocus
              />
            </div>

            {!status.initialized && (
              <>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-obsidian-400 mb-1">
                    Confirmar Contraseña
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-100 placeholder-obsidian-600 focus:outline-none focus:border-obsidian-400 font-mono transition-fast"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  {status.biometric_available && (
                    <div className="flex items-center space-x-2 bg-surface-secondary px-3 py-2 rounded border border-surface-border">
                      <input
                        type="checkbox"
                        id="bioCheckbox"
                        checked={enableBiometrics}
                        onChange={(e) => setEnableBiometrics(e.target.checked)}
                        className="rounded border-surface-border bg-surface-primary text-emerald-500 focus:ring-0"
                      />
                      <label htmlFor="bioCheckbox" className="text-xs text-obsidian-300 cursor-pointer">
                        Touch ID
                      </label>
                    </div>
                  )}
                  <div>
                    <Dropdown
                      value={String(autoLockMinutes)}
                      onChange={(v) => setAutoLockMinutes(Number(v))}
                      ariaLabel="Minutos de auto-bloqueo"
                      options={[
                        { value: '5', label: 'Auto-bloqueo: 5m' },
                        { value: '15', label: 'Auto-bloqueo: 15m' },
                        { value: '30', label: 'Auto-bloqueo: 30m' },
                        { value: '60', label: 'Auto-bloqueo: 60m' },
                      ]}
                    />
                  </div>
                </div>
              </>
            )}

            {displayError && (
              <div className="text-xs text-financial-negativeText bg-financial-negativeMuted border border-financial-negativeBorder p-2.5 rounded flex items-start space-x-2 font-mono">
                <AlertTriangle className="w-4 h-4 shrink-0 text-financial-negative mt-0.5" />
                <span>{displayError}</span>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-signal hover:bg-signal-hover text-obsidian-950 font-semibold text-xs rounded-md transition-fast disabled:opacity-40"
              >
                {loading
                  ? 'Verificando clave...'
                  : status.initialized
                  ? 'Desbloquear Bóveda'
                  : 'Crear Bóveda Segura'}
              </button>

              {status.initialized && status.biometric_available && (
                <button
                  type="button"
                  onClick={handleBiometricClick}
                  disabled={loading}
                  className="w-full py-2 bg-surface-secondary hover:bg-surface-hover border border-surface-border text-obsidian-300 hover:text-white text-xs font-semibold rounded flex items-center justify-center space-x-2 transition-fast"
                >
                  <Fingerprint className="w-4 h-4 text-financial-positive" />
                  <span>Desbloquear con Touch ID</span>
                </button>
              )}
            </div>
          </form>

          {/* Bottom Restore Link */}
          <div className="border-t border-surface-borderSubtle pt-3 text-center">
            <button
              onClick={() => setShowRestoreModal(true)}
              className="text-[11px] text-obsidian-500 hover:text-obsidian-300 font-mono transition-fast"
            >
              Restaurar copia (.vault)
            </button>
          </div>
        </div>
      </div>

      {/* Footer System Info */}
      <div className="text-center text-[10px] text-obsidian-600 font-mono">
        Almacenamiento local con cifrado en reposo • Zero-knowledge • Memoria con zeroización
      </div>

      {/* Restore Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="craft-card w-full max-w-sm p-5 space-y-4 bg-surface-primary border-surface-border shadow-modal">
            <div className="flex items-center justify-between border-b border-surface-border pb-2">
              <span className="text-xs font-semibold font-mono text-obsidian-200 uppercase">
                Restaurar Copia de Seguridad
              </span>
              <button
                onClick={() => setShowRestoreModal(false)}
                className="p-1 rounded text-obsidian-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-mono text-obsidian-400 mb-1">
                  Ruta del archivo .vault
                </label>
                <input
                  type="text"
                  placeholder="/ruta/hacia/backup.vault"
                  value={restorePath}
                  onChange={(e) => setRestorePath(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-obsidian-400 mb-1">
                  Contraseña del archivo
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={restorePassword}
                  onChange={(e) => setRestorePassword(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-surface-secondary border border-surface-border rounded text-xs text-obsidian-200 font-mono"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRestoreModal(false)}
                  className="px-3 py-1.5 bg-surface-secondary hover:bg-surface-hover text-obsidian-300 text-xs rounded border border-surface-border"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={restoreLoading || !restorePath || !restorePassword}
                  onClick={async () => {
                    setRestoreLoading(true);
                    try {
                      await vaultRestoreBackup(restorePath, restorePassword);
                      alert('Bóveda restaurada correctamente.');
                      setShowRestoreModal(false);
                      await refreshStatus();
                    } catch (err: any) {
                      alert(`Error al restaurar: ${err.message || err}`);
                    } finally {
                      setRestoreLoading(false);
                    }
                  }}
                  className="px-3 py-1.5 bg-obsidian-100 hover:bg-white text-obsidian-950 font-bold text-xs rounded disabled:opacity-40"
                >
                  {restoreLoading ? 'Restaurando...' : 'Restaurar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
