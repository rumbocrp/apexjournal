import { invokeCommand } from './client';
import { VaultStatus, VaultInitRequest, VaultUnlockRequest } from '../types';

export const authApi = {
  getStatus: () => invokeCommand<VaultStatus>('vault_get_status'),
  setup: (request: VaultInitRequest) => invokeCommand<VaultStatus>('vault_setup', { request }),
  unlock: (request: VaultUnlockRequest) => invokeCommand<VaultStatus>('vault_unlock', { request }),
  unlockBiometric: () => invokeCommand<VaultStatus>('vault_unlock_biometric'),
  lock: () => invokeCommand<void>('vault_lock'),
  touch: () => invokeCommand<void>('vault_touch'),
};
