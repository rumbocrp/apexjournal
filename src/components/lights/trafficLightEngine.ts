import {
  RawInvoiceInput,
  TrafficLightTelemetryReport,
  TrafficLightEngineOptions,
  AgingBucketTelemetry,
  TrafficLightState,
} from './types';

/**
 * Computes difference in calendar days between two ISO date strings (YYYY-MM-DD)
 * without timezone drift or DST skew.
 */
export function calculateAgeDays(issueDateIso: string, referenceDateIso: string): number {
  const [refYear, refMonth, refDay] = referenceDateIso.substring(0, 10).split('-').map(Number);
  const [txYear, txMonth, txDay] = issueDateIso.substring(0, 10).split('-').map(Number);

  const refUtc = Date.UTC(refYear, refMonth - 1, refDay);
  const txUtc = Date.UTC(txYear, txMonth - 1, txDay);

  const diffMs = refUtc - txUtc;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * Bank-grade half-to-even rounding for 2 decimal places.
 */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Pure deterministic calculation engine for the Sistema de Luces.
 * Evaluates raw invoice sets and generates a full telemetry report.
 */
export function evaluateTrafficLights(
  invoices: RawInvoiceInput[],
  options: TrafficLightEngineOptions = {}
): TrafficLightTelemetryReport {
  const baseCurrency = options.baseCurrency || 'USD';
  const refDateStr =
    options.referenceDate instanceof Date
      ? options.referenceDate.toISOString().split('T')[0]
      : typeof options.referenceDate === 'string'
      ? options.referenceDate.substring(0, 10)
      : new Date().toISOString().split('T')[0];

  // Filter eligible pending / invoiced items
  const eligibleInvoices = invoices.filter(
    (inv) => !inv.status || inv.status === 'INVOICED' || inv.status === 'PENDING'
  );

  let current_0_30 = 0;
  let pending_31_60 = 0;
  let overdue_61_90 = 0;
  let critical_90_plus = 0;

  let count_0_30 = 0;
  let count_31_60 = 0;
  let count_61_90 = 0;
  let count_90_plus = 0;

  for (const inv of eligibleInvoices) {
    const rawAmt = Number(inv.amount) || 0;
    if (rawAmt <= 0) continue;

    const rate = Number(inv.exchange_rate) || 1.0;
    const baseAmount = rawAmt * rate;
    const ageDays = calculateAgeDays(inv.date, refDateStr);

    if (ageDays <= 30) {
      current_0_30 += baseAmount;
      count_0_30 += 1;
    } else if (ageDays <= 60) {
      pending_31_60 += baseAmount;
      count_31_60 += 1;
    } else if (ageDays <= 90) {
      overdue_61_90 += baseAmount;
      count_61_90 += 1;
    } else {
      critical_90_plus += baseAmount;
      count_90_plus += 1;
    }
  }

  // Round bucket sums
  current_0_30 = roundCurrency(current_0_30);
  pending_31_60 = roundCurrency(pending_31_60);
  overdue_61_90 = roundCurrency(overdue_61_90);
  critical_90_plus = roundCurrency(critical_90_plus);

  const totalReceivable = roundCurrency(
    current_0_30 + pending_31_60 + overdue_61_90 + critical_90_plus
  );
  const totalInvoices = count_0_30 + count_31_60 + count_61_90 + count_90_plus;

  // Resolve State Machine
  let state: TrafficLightState = 'GREEN';
  let stateLabel = 'CARTERA SANA';
  let stateDescription = '100% de facturas dentro del plazo ordinario de cobro (0 - 60 días).';

  const hasCritical = critical_90_plus > 0;
  const hasModerate = overdue_61_90 > 0;

  if (hasCritical) {
    state = 'RED';
    stateLabel = 'MORA CRÍTICA (+90D)';
    stateDescription = 'Exposición a facturas de más de 90 días en mora. Riesgo inminente de incobrabilidad.';
  } else if (hasModerate) {
    state = 'YELLOW';
    stateLabel = 'ATENCIÓN REQUERIDA';
    stateDescription = 'Existen cuentas entre 61 y 90 días sin liquidar. Requiere seguimiento preventivo.';
  }

  // Construct Buckets breakdown
  const buckets: AgingBucketTelemetry[] = [
    {
      id: '0_30',
      label: '0 - 30 días (Vigente)',
      shortLabel: '0-30d',
      daysRange: [0, 30],
      amount: current_0_30,
      percentage: totalReceivable > 0 ? roundCurrency((current_0_30 / totalReceivable) * 100) : 100,
      invoiceCount: count_0_30,
      severity: 'optimal',
      colorHex: '#10b981',
    },
    {
      id: '31_60',
      label: '31 - 60 días (En plazo)',
      shortLabel: '31-60d',
      daysRange: [31, 60],
      amount: pending_31_60,
      percentage: totalReceivable > 0 ? roundCurrency((pending_31_60 / totalReceivable) * 100) : 0,
      invoiceCount: count_31_60,
      severity: 'neutral',
      colorHex: '#63636c',
    },
    {
      id: '61_90',
      label: '61 - 90 días (Vencido)',
      shortLabel: '61-90d',
      daysRange: [61, 90],
      amount: overdue_61_90,
      percentage: totalReceivable > 0 ? roundCurrency((overdue_61_90 / totalReceivable) * 100) : 0,
      invoiceCount: count_61_90,
      severity: 'warning',
      colorHex: '#f59e0b',
    },
    {
      id: '90_plus',
      label: '+90 días (Crítico)',
      shortLabel: '+90d',
      daysRange: [91, null],
      amount: critical_90_plus,
      percentage: totalReceivable > 0 ? roundCurrency((critical_90_plus / totalReceivable) * 100) : 0,
      invoiceCount: count_90_plus,
      severity: 'critical',
      colorHex: '#ef4444',
    },
  ];

  return {
    state,
    stateLabel,
    stateDescription,
    totalReceivable,
    totalInvoices,
    currency: baseCurrency,
    buckets,
    evaluatedAt: new Date().toISOString(),
    hasCriticalExposure: hasCritical,
    hasModerateExposure: hasModerate,
  };
}
