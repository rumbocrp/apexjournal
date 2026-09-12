import React from 'react';
import { AgingBucketTelemetry } from './types';

interface AgingBreakdownGridProps {
  buckets: AgingBucketTelemetry[];
  onSelectBucket?: (bucketId: string) => void;
  selectedBucketId?: string | null;
  className?: string;
}

/**
 * AgingBreakdownGrid: 4-tier granular telemetry insets.
 * Uses high-density monospace layout with tabular numerals and clean 1px borders.
 */
export const AgingBreakdownGrid: React.FC<AgingBreakdownGridProps> = ({
  buckets,
  onSelectBucket,
  selectedBucketId,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {buckets.map((b) => {
        const isSelected = selectedBucketId === b.id;

        return (
          <div
            key={b.id}
            onClick={() => onSelectBucket && onSelectBucket(b.id)}
            className={`p-2 rounded flex items-center justify-between text-xs transition-fast ${
              onSelectBucket ? 'cursor-pointer' : ''
            } ${
              isSelected
                ? 'bg-[#1e1e24] border border-[#36363f]'
                : 'bg-[#161619] border border-[#1a1a1e] hover:border-[#242429]'
            }`}
          >
            {/* Left label & signal diode */}
            <div className="flex items-center space-x-2">
              <span
                style={{ backgroundColor: b.colorHex }}
                className="w-1.5 h-1.5 rounded-full shrink-0"
                aria-hidden="true"
              />
              <span className="text-obsidian-300 font-medium text-[11px] truncate max-w-[140px]">
                {b.label}
              </span>
              {b.invoiceCount > 0 && (
                <span className="text-[9px] font-mono text-obsidian-500 bg-[#111113] px-1 py-0.2 rounded border border-[#1a1a1e]">
                  {b.invoiceCount}
                </span>
              )}
            </div>

            {/* Right Financial Telemetry */}
            <div className="text-right font-mono flex items-center space-x-2">
              <span
                style={{ color: b.colorHex === '#63636c' ? '#d4d4d8' : b.colorHex }}
                className="font-bold text-xs tabular-nums"
              >
                ${b.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-[10px] text-obsidian-500 w-8 text-right tabular-nums">
                {b.percentage.toFixed(0)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
