import React, { useState } from 'react';
import { ExposureSpectrumBarProps, AgingBucketTelemetry } from './types';

/**
 * ExposureSpectrumBar: Continuous multi-segment health & risk spectrum.
 * Strict Anti-AI-Slop & UI/UX Pro Max standard.
 * Features recessed hardware groove styling, hairline segment dividers,
 * interactive hover telemetry crosshair, and accessible legend.
 */
export const ExposureSpectrumBar: React.FC<ExposureSpectrumBarProps> = ({
  buckets,
  heightPx = 7,
  showLabels = true,
  className = '',
}) => {
  const [hoveredBucket, setHoveredBucket] = useState<AgingBucketTelemetry | null>(null);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Continuous Recessed Channel */}
      <div
        style={{ height: `${heightPx}px` }}
        className="w-full bg-[#0c0c0e] rounded overflow-hidden flex border border-[#1e1e24] p-[1px] select-none relative shadow-inner"
        onMouseLeave={() => setHoveredBucket(null)}
      >
        {buckets.map((b, idx) => {
          if (b.percentage <= 0) return null;
          return (
            <div
              key={b.id}
              style={{
                width: `${b.percentage}%`,
                backgroundColor: b.colorHex,
              }}
              onMouseEnter={() => setHoveredBucket(b)}
              className={`h-full transition-fast cursor-pointer ${
                idx > 0 ? 'border-l border-[#0c0c0e]/80' : ''
              } hover:brightness-110`}
              role="progressbar"
              aria-valuenow={b.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${b.label}: ${b.percentage.toFixed(1)}%`}
            />
          );
        })}
      </div>

      {/* Axis Percentage Boundaries or Dynamic Hover Telemetry */}
      {showLabels && (
        <div className="flex items-center justify-between text-[10px] font-mono select-none h-4">
          {hoveredBucket ? (
            <div className="flex items-center space-x-1.5 text-obsidian-200">
              <span
                style={{ backgroundColor: hoveredBucket.colorHex }}
                className="w-1.5 h-1.5 rounded-full inline-block"
              />
              <span className="font-semibold">{hoveredBucket.shortLabel}:</span>
              <span className="tabular-nums">
                ${hoveredBucket.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-obsidian-500 font-normal">
                ({hoveredBucket.percentage.toFixed(1)}% • {hoveredBucket.invoiceCount} {hoveredBucket.invoiceCount === 1 ? 'factura' : 'facturas'})
              </span>
            </div>
          ) : (
            <>
              <span className="text-obsidian-400">
                0-30d: <strong className="text-[#34d399]">{buckets[0]?.percentage.toFixed(0)}%</strong>
              </span>
              <span className="text-obsidian-500 text-[9px] uppercase tracking-wider">
                Exposición de Cartera
              </span>
              <span className="text-obsidian-400">
                +90d: <strong className="text-[#f87171]">{buckets[3]?.percentage.toFixed(0)}%</strong>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
