import { invokeCommand, isTauriAvailable } from './client';
import { DashboardMetrics, EquityCurvePoint, ARAgingSummary, Timeframe } from '../types';

export const analyticsApi = {
  getDashboard: () => invokeCommand<DashboardMetrics>('analytics_get_dashboard'),
  getEquityCurve: (timeframe?: Timeframe) =>
    invokeCommand<EquityCurvePoint[]>('analytics_get_equity_curve', { timeframe }),
  // SPEC §6.2 canonical: get_ar_aging_summary, fallback to legacy for old backends.
  // Bypasses invokeCommand mock-swallow when running under Tauri so a missing
  // canonical command retries the legacy backend instead of returning mock data.
  getARAging: async (): Promise<ARAgingSummary> => {
    if (isTauriAvailable()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        try {
          return await invoke<ARAgingSummary>('get_ar_aging_summary');
        } catch {
          return await invoke<ARAgingSummary>('analytics_get_ar_aging');
        }
      } catch {
        // Import failed: fall through to mock router below.
      }
    }
    return await invokeCommand<ARAgingSummary>('get_ar_aging_summary');
  },
};
