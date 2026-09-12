export interface VaultStatus {
  initialized: boolean;
  unlocked: boolean;
  biometric_available: boolean;
  auto_lock_minutes: number;
}

export interface VaultInitRequest {
  master_password: string;
  enable_biometrics?: boolean;
  auto_lock_minutes?: number;
}

export interface VaultUnlockRequest {
  master_password: string;
}

export interface KdfMeta {
  algorithm: string;
  version: number;
  m_cost: number;
  t_cost: number;
  p_cost: number;
  salt_hex: string;
}

export interface VaultMetadata {
  version: number;
  kdf: KdfMeta;
  biometrics_enabled: boolean;
  auto_lock_minutes: number;
  created_at: string;
  updated_at: string;
}
