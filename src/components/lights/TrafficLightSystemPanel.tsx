import React from 'react';
import { ArrowRight } from 'lucide-react';
import { TrafficLightSystemPanelProps } from './types';
import { HardwareOpticalBezel } from './HardwareOpticalBezel';
import { ExposureSpectrumBar } from './ExposureSpectrumBar';
import { AgingBreakdownGrid } from './AgingBreakdownGrid';

/**
 * TrafficLightSystemPanel: Full-featured Accounts Receivable Telemetry Instrument.
 * Encapsulates the complete Anti-AI-Slop operational standard.
 */
export const TrafficLightSystemPanel: React.FC<TrafficLightSystemPanelProps> = ({
  report,
  onInspectBlotter,
  onSelectBucket,
  colorblindMode = false,
  className = '',
}) => {
  const { state, stateLabel, stateDescription, totalReceivable, buckets } = report;

  return (
    <div
      className={`craft-card p-5 space-y-4 flex flex-col justify-between bg-[#111113] border-[#242429] select-none ${className}`}
    >
      {/* Top Header with Hardware Optical Bezel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-surface-border pb-2.5">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-obsidian-200 font-mono">
              Sistema de Luces (AR)
            </span>
          </div>

          <HardwareOpticalBezel
            state={state}
            size="md"
            showLabels={true}
            colorblindMode={colorblindMode}
          />
        </div>

        {/* Financial Balance Summary */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-obsidian-500 font-mono">
            <span>Total Pendiente de Cobro</span>
            <span
              className={`font-semibold text-[10px] ${
                state === 'GREEN'
                  ? 'text-traffic-greenText'
                  : state === 'YELLOW'
                  ? 'text-traffic-yellowText'
                  : 'text-traffic-redText'
              }`}
            >
              {stateLabel}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-obsidian-100 tabular-nums">
            ${totalReceivable.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <p className="text-[11px] text-obsidian-500 leading-tight">
            {stateDescription}
          </p>
        </div>

        {/* Multi-Segment Exposure Spectrum Bar */}
        <ExposureSpectrumBar buckets={buckets} heightPx={6} showLabels={true} />
      </div>

      {/* 4 Buckets Breakdown Grid */}
      <AgingBreakdownGrid
        buckets={buckets}
        onSelectBucket={onSelectBucket}
      />

      {/* Bottom Action / Direct Filter Trigger */}
      {onInspectBlotter && (
        <div className="border-t border-surface-borderSubtle pt-2 flex items-center justify-between">
          <span className="text-[10px] font-mono text-obsidian-500">
            {report.totalInvoices} {report.totalInvoices === 1 ? 'factura pendiente' : 'facturas pendientes'}
          </span>
          <button
            onClick={onInspectBlotter}
            className="flex items-center space-x-1 text-[11px] font-mono text-obsidian-400 hover:text-white transition-fast"
          >
            <span>Ver en Registro</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
