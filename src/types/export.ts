export interface BackupResult {
  success: boolean;
  destination_path: string;
  bytes_written: number;
  timestamp: string;
}

export type ExportType = 'transactions' | 'cases' | 'journal';

export interface ExportBackupArgs {
  destinationPath: string;
}

export interface RestoreBackupArgs {
  sourcePath: string;
  masterPassword: string;
}
