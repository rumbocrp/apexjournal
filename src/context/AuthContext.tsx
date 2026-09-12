import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api';
import { VaultStatus } from '../types';

interface AuthContextType {
  status: VaultStatus;
  loading: boolean;
  error: string | null;
  unlock: (password: string) => Promise<boolean>;
  setup: (password: string, enableBiometrics?: boolean, autoLockMinutes?: number) => Promise<boolean>;
  unlockBiometric: () => Promise<boolean>;
  lock: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  clearError: () => void;
}

const defaultStatus: VaultStatus = {
  initialized: false,
  unlocked: false,
  biometric_available: false,
  auto_lock_minutes: 15,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<VaultStatus>(defaultStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await authApi.getStatus();
      if (res) {
        setStatus(res);
      }
    } catch (err: any) {
      console.error('Failed to get vault status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Periodic heartbeat / touch on user interaction
  useEffect(() => {
    if (!status.unlocked) return;

    let lastTouch = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastTouch > 15000) {
        lastTouch = now;
        authApi.touch().catch(() => {});
      }
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [status.unlocked]);

  const unlock = async (password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.unlock({ master_password: password });
      setStatus(res);
      return res.unlocked;
    } catch (err: any) {
      const msg = err?.message || 'Incorrect master password';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const setup = async (password: string, enableBiometrics = true, autoLockMinutes = 15): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.setup({
        master_password: password,
        enable_biometrics: enableBiometrics,
        auto_lock_minutes: autoLockMinutes,
      });
      setStatus(res);
      return res.unlocked;
    } catch (err: any) {
      const msg = err?.message || 'Failed to initialize encrypted vault';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const unlockBiometric = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.unlockBiometric();
      setStatus(res);
      return res.unlocked;
    } catch (err: any) {
      const msg = err?.message || 'Biometric authentication failed';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const lock = async () => {
    try {
      await authApi.lock();
    } catch (err) {
      console.error('Lock error:', err);
    }
    setStatus((prev) => ({ ...prev, unlocked: false }));
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        status,
        loading,
        error,
        unlock,
        setup,
        unlockBiometric,
        lock,
        refreshStatus,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
