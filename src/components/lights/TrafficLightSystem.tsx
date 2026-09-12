import React from 'react';
import { ArrowRight } from 'lucide-react';
import { TrafficLight, ARAgingSummary } from '../../types';

interface HardwareBeaconProps {
  state: TrafficLight;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
}

/**
 * HardwareOpticalBezel: Physical 3-diode LED status cluster (Anti-AI-Slop standard).
 * Replaces generic glowing pastel pills with precision-machined industrial optics.
 */
export const HardwareOpticalBezel: React.FC<HardwareBeaconProps> = ({
  state,
  size = 'md',
  showLabels = false,
}) => {
  const dotSize = size === 'sm' ? 'w-2 h-2' : size === 'lg' ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5';
  const containerPadding = size === 'sm' ? 'p-1 gap-1' : size === 'lg' ? 'p-1.5 gap-2' : 'p-1.5 gap-1.5';

  return (
    <div
      className={`inline-flex items-center bg-[#0e0e11] border border-[#242429] rounded-md ${containerPadding} shadow-subtle select-none`}
      role="status"
      aria-label={`Sistema de Luces Estado: ${state}`}
    >
      {/* Green Diode (0-30d Current) */}
      <div
        className={`relative ${dotSize} rounded-full border transition-fast flex items-center justify-center ${
          state === 'GREEN'
            ? 'bg-[#10b981] border-[#34d399]'
            : 'bg-[#06281e]/40 border-[#0e533c]/60 opacity-35'
        }`}
        title="Verde: Cartera al día"
      >
        {state === 'GREEN' && (
          <span className="w-0.5 h-0.5 bg-white/90 rounded-full" aria-hidden="true" />
        )}
      </div>

      {/* Amber Diode (31-90d Warning) */}
      <div
        className={`relative ${dotSize} rounded-full border transition-fast flex items-center justify-center ${
          state === 'YELLOW'
            ? 'bg-[#f59e0b] border-[#fbbf24]'
            : 'bg-[#2c1b04]/40 border-[#6b4308]/60 opacity-35'
        }`}
        title="Ámbar: Atención / Mora media"
      >
        {state === 'YELLOW' && (
          <span className="w-0.5 h-0.5 bg-white/90 rounded-full" aria-hidden="true" />
        )}
      </div>

      {/* Red Diode (+90d Critical) */}
      <div
        className={`relative ${dotSize} rounded-full border transition-fast flex items-center justify-center ${
          state === 'RED'
            ? 'bg-[#ef4444] border-[#f87171]'
            : 'bg-[#2e0b11]/40 border-[#711b25]/60 opacity-35'
        }`}
        title="Rojo: Mora crítica urgente"
      >
        {state === 'RED' && (
          <span className="w-0.5 h-0.5 bg-white/90 rounded-full" aria-hidden="true" />
        )}
      </div>

      {showLabels && (
        <span
          className={`font-mono text-[10px] font-bold tracking-wider uppercase ml-1 ${
            state === 'GREEN'
              ? 'text-[#34d399]'
              : state === 'YELLOW'
              ? 'text-[#fbbf24]'
              : 'text-[#f87171]'
          }`}
        >
          {state === 'GREEN' ? 'SANO' : state === 'YELLOW' ? 'ALERTA' : 'CRÍTICO'}
        </span>
      )}
    </div>
  );
};

interface ARAgingPanelProps {
  arAging: ARAgingSummary | null;
  onInspectBlotter?: () => void;
}

/**
 * TrafficLightSystemPanel: Comprehensive Accounts Receivable Aging Instrument.
 * Full Anti-AI-Slop implementation with exposure breakdown spectrum and telemetry.
 */
export const TrafficLightSystemPanel: React.FC<ARAgingPanelProps> = ({
  arAging,
  onInspectBlotter,
}) => {
  const lightState = arAging?.traffic_light || 'GREEN';
  const totalAr = arAging?.total_receivable || 0;
  const current0_30 = arAging?.current_0_30 || 0;
  const pending31_60 = arAging?.pending_31_60 || 0;
  const overdue61_90 = arAging?.overdue_61_90 || 0;
  const critical90Plus = arAging?.critical_90_plus || 0;

  const pctCurrent = totalAr > 0 ? (current0_30 / totalAr) * 100 : 100;
  const pctPending = totalAr > 0 ? (pending31_60 / totalAr) * 100 : 0;
  const pctOverdue = totalAr > 0 ? (overdue61_90 / totalAr) * 100 : 0;
  const pctCritical = totalAr > 0 ? (critical90Plus / totalAr) * 100 : 0;

  // Status Diagnostics Text
  const statusSummary =
    lightState === 'GREEN'
      ? { label: 'CARTERA SANA', desc: '100% de facturas dentro del plazo ordinario de cobro.' }
      : lightState === 'YELLOW'
      ? { label: 'ATENCIÓN REQUERIDA', desc: 'Existen cuentas con más de 60 días sin liquidar.' }
      : { label: 'MORA CRÍTICA (+90D)', desc: 'Facturas con más de 90 días en mora. Riesgo de incobrabilidad.' };

  return (
    <div className="craft-card p-5 space-y-4 flex flex-col justify-between bg-[#111113] border-[#242429]">
      {/* Header & Hardware Optical Indicator */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-surface-border pb-2.5">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-obsidian-200 font-mono">
              Sistema de Luces (AR)
            </span>
          </div>

          <HardwareOpticalBezel state={lightState} size="md" showLabels={true} />
        </div>

        {/* Total Metric & Diagnostic Subtitle */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-obsidian-500 font-mono">
            <span>Total Pendiente de Cobro</span>
            <span
              className={`font-semibold text-[10px] ${
                lightState === 'GREEN'
                  ? 'text-traffic-greenText'
                  : lightState === 'YELLOW'
                  ? 'text-traffic-yellowText'
                  : 'text-traffic-redText'
              }`}
            >
              {statusSummary.label}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-obsidian-100 tabular-nums">
            ${totalAr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-obsidian-500 leading-tight">
            {statusSummary.desc}
          </p>
        </div>

        {/* Multi-Segment Exposure Spectrum Bar */}
        <div className="space-y-1 pt-1">
          <div className="h-1.5 w-full bg-[#161619] rounded overflow-hidden flex border border-[#1a1a1e]">
            <div
              style={{ width: `${pctCurrent}%` }}
              className="bg-[#10b981] transition-fast"
              title={`0-30d: $${current0_30.toLocaleString()} (${pctCurrent.toFixed(1)}%)`}
            />
            <div
              style={{ width: `${pctPending}%` }}
              className="bg-[#63636c] transition-fast"
              title={`31-60d: $${pending31_60.toLocaleString()} (${pctPending.toFixed(1)}%)`}
            />
            <div
              style={{ width: `${pctOverdue}%` }}
              className="bg-[#f59e0b] transition-fast"
              title={`61-90d: $${overdue61_90.toLocaleString()} (${pctOverdue.toFixed(1)}%)`}
            />
            <div
              style={{ width: `${pctCritical}%` }}
              className="bg-[#ef4444] transition-fast"
              title={`+90d: $${critical90Plus.toLocaleString()} (${pctCritical.toFixed(1)}%)`}
            />
          </div>
          <div className="flex justify-between text-[9px] font-mono text-obsidian-500">
            <span>Vigente ({pctCurrent.toFixed(0)}%)</span>
            <span>Riesgo Crítico ({pctCritical.toFixed(0)}%)</span>
          </div>
        </div>
      </div>

      {/* 4 Buckets Breakdown Grid */}
      <div className="space-y-1.5 pt-1">
        {/* Bucket 1: 0 - 30 days */}
        <div className="craft-card-inset p-2 flex items-center justify-between text-xs bg-[#161619] border-[#1a1a1e]">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
            <span className="text-obsidian-300 font-medium text-[11px]">0 - 30 días (Vigente)</span>
          </div>
          <div className="text-right font-mono">
            <span className="font-bold text-[#34d399] text-xs tabular-nums">
              ${current0_30.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Bucket 2: 31 - 60 days */}
        <div className="craft-card-inset p-2 flex items-center justify-between text-xs bg-[#161619] border-[#1a1a1e]">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#63636c]" />
            <span className="text-obsidian-300 font-medium text-[11px]">31 - 60 días (En plazo)</span>
          </div>
          <div className="text-right font-mono">
            <span className="font-bold text-obsidian-200 text-xs tabular-nums">
              ${pending31_60.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Bucket 3: 61 - 90 days */}
        <div className="craft-card-inset p-2 flex items-center justify-between text-xs bg-[#161619] border-[#1a1a1e]">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
            <span className="text-[#fbbf24] font-medium text-[11px]">61 - 90 días (Vencido)</span>
          </div>
          <div className="text-right font-mono">
            <span className="font-bold text-[#fbbf24] text-xs tabular-nums">
              ${overdue61_90.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Bucket 4: +90 days */}
        <div className="craft-card-inset p-2 flex items-center justify-between text-xs bg-[#161619] border-[#1a1a1e]">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
            <span className="text-[#f87171] font-medium text-[11px]">+90 días (Crítico)</span>
          </div>
          <div className="text-right font-mono">
            <span className="font-bold text-[#f87171] text-xs tabular-nums">
              ${critical90Plus.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      {onInspectBlotter && (
        <div className="border-t border-surface-borderSubtle pt-2 flex justify-end">
          <button
            onClick={onInspectBlotter}
            className="flex items-center space-x-1 text-[11px] font-mono text-obsidian-400 hover:text-white transition-fast"
          >
            <span>Ver Facturas en Registro</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
