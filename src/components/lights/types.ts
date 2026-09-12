/**
 * SISTEMA DE LUCES: Data Contracts & Type Definitions
 * Industrial Hardware Optical Telemetry Standard (Anti-AI-Slop)
 */

export type TrafficLightState = 'GREEN' | 'YELLOW' | 'RED';

export type BucketSeverity = 'optimal' | 'neutral' | 'warning' | 'critical';

export interface RawInvoiceInput {
  id: string;
  amount: number;
  date: string; // ISO-8601 YYYY-MM-DD
  currency?: string;
  exchange_rate?: number;
  client_name?: string;
  invoice_number?: string;
  status?: 'INVOICED' | 'PENDING' | 'CLEARED' | 'PAID';
}

export interface AgingBucketTelemetry {
  id: '0_30' | '31_60' | '61_90' | '90_plus';
  label: string;             // e.g. "0 - 30 días (Vigente)"
  shortLabel: string;        // e.g. "0-30d"
  daysRange: [number, number | null]; // [min, max] where null is unbounded
  amount: number;            // Total amount normalized in base currency (USD)
  percentage: number;        // Proportional share of total (0 - 100%)
  invoiceCount: number;      // Number of invoices in this bucket
  severity: BucketSeverity;  // Semantic severity level
  colorHex: string;          // Optical signal hex code
}

export interface TrafficLightTelemetryReport {
  state: TrafficLightState;
  stateLabel: string;        // "CARTERA SANA" | "ATENCIÓN REQUERIDA" | "MORA CRÍTICA"
  stateDescription: string;  // Concise diagnostic summary
  totalReceivable: number;   // Total amount outstanding across all buckets
  totalInvoices: number;     // Total count of pending invoices
  currency: string;          // Base currency (e.g. "USD")
  buckets: AgingBucketTelemetry[];
  evaluatedAt: string;       // ISO-8601 evaluation timestamp
  hasCriticalExposure: boolean;
  hasModerateExposure: boolean;
}

export interface TrafficLightEngineOptions {
  referenceDate?: string | Date; // Defaults to current system date
  baseCurrency?: string;         // Defaults to "USD"
  criticalThresholdDays?: number;// Defaults to 90
  warningThresholdDays?: number; // Defaults to 60
}

export interface OpticalBezelProps {
  state: TrafficLightState;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  colorblindMode?: boolean;
  className?: string;
}

export interface ExposureSpectrumBarProps {
  buckets: AgingBucketTelemetry[];
  heightPx?: number;
  showLabels?: boolean;
  className?: string;
}

export interface TrafficLightSystemPanelProps {
  report: TrafficLightTelemetryReport;
  onInspectBlotter?: () => void;
  onSelectBucket?: (bucketId: string) => void;
  colorblindMode?: boolean;
  className?: string;
}
