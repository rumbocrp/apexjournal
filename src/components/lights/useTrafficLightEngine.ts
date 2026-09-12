import { useMemo } from 'react';
import { RawInvoiceInput, TrafficLightEngineOptions, TrafficLightTelemetryReport } from './types';
import { evaluateTrafficLights } from './trafficLightEngine';

/**
 * React Hook that wraps the deterministic Sistema de Luces engine with memoized performance.
 */
export function useTrafficLightEngine(
  invoices: RawInvoiceInput[],
  options?: TrafficLightEngineOptions
): TrafficLightTelemetryReport {
  return useMemo(() => {
    return evaluateTrafficLights(invoices, options);
  }, [invoices, options?.referenceDate, options?.baseCurrency, options?.criticalThresholdDays, options?.warningThresholdDays]);
}
