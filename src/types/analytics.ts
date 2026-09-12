export type Timeframe = '1W' | '1M' | '3M' | '1Y' | 'ALL';
export type TrafficLight = 'GREEN' | 'YELLOW' | 'RED';

export interface DashboardMetrics {
  cumulative_net_margin: number;
  proposal_win_rate: number;
  realized_volume: number;
  invoiced_volume: number;
  avg_ticket_size: number;
  base_currency: string;
}

export interface EquityCurvePoint {
  date: string;
  daily_delta: number;
  cumulative_equity: number;
  volume_income: number;
  volume_expense: number;
}

export interface ARAgingSummary {
  current_0_30: number;
  pending_31_60: number;
  overdue_61_90: number;
  critical_90_plus: number;
  total_receivable: number;
  traffic_light: TrafficLight;
}

export interface CasePnLResult {
  realized_income: number;
  realized_expense: number;
  net_margin: number;
  profit_margin_pct: number;
}
