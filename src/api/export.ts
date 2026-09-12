import { invokeCommand } from './client';
import { BackupResult, ExportType } from '../types';

/**
 * Trigger an encrypted .vault backup export
 */
export async function vaultExportBackup(destinationPath: string): Promise<BackupResult> {
  return await invokeCommand<BackupResult>('vault_export_backup', { destinationPath });
}

/**
 * Restore database snapshot from an encrypted .vault backup archive
 */
export async function vaultRestoreBackup(sourcePath: string, masterPassword: string): Promise<void> {
  return await invokeCommand<void>('vault_restore_backup', { sourcePath, masterPassword });
}

/**
 * Generate CSV data string for transactions, cases, or journal
 */
export async function exportCsv(exportType: ExportType): Promise<string> {
  return await invokeCommand<string>('export_csv', { exportType });
}

/**
 * Export full structured multi-sheet Excel report
 */
export async function exportExcel(destinationPath: string): Promise<void> {
  return await invokeCommand<void>('export_excel', { destinationPath });
}

/**
 * Trigger browser/desktop file download for string or Blob content
 */
export function downloadFile(filename: string, content: string | Blob, mimeType: string = 'text/plain;charset=utf-8') {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Helper to export CSV and download automatically
 */
export async function triggerCsvExport(exportType: ExportType, customFilename?: string): Promise<string> {
  const csv = await exportCsv(exportType);
  const filename = customFilename || `apex_journal_${exportType}_${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile(filename, csv, 'text/csv;charset=utf-8');
  return csv;
}

/**
 * Helper to export Excel workbook
 */
export async function triggerExcelExport(destinationPath?: string): Promise<void> {
  const defaultPath = destinationPath || `apex_journal_financial_report_${new Date().toISOString().split('T')[0]}.xml`;
  await exportExcel(defaultPath);
}

/**
 * Helper to export Encrypted .vault container
 */
export async function triggerBackupExport(destinationPath?: string): Promise<BackupResult> {
  const defaultPath = destinationPath || `apex_journal_backup_${new Date().toISOString().split('T')[0]}.vault`;
  return await vaultExportBackup(defaultPath);
}
