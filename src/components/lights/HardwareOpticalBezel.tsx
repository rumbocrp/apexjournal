import React from 'react';
import { Check, AlertTriangle, AlertCircle } from 'lucide-react';
import { OpticalBezelProps } from './types';

/**
 * HardwareOpticalBezel: Machined industrial 3-diode optical cluster.
 * Strict Anti-AI-Slop & UI/UX Pro Max standard.
 * Features CNC-style machined dark bezel, physical LED lens optics,
 * specular glass refraction highlight, and colorblind glyph accessibility.
 */
export const HardwareOpticalBezel: React.FC<OpticalBezelProps> = ({
  state,
  size = 'md',
  showLabels = false,
  colorblindMode = false,
  className = '',
}) => {
  // Dimension scales
  const dimensions = {
    sm: {
      diode: 'w-2 h-2',
      housing: 'p-1 gap-1',
      iconSize: 7,
      specular: 'w-0.5 h-0.5 top-[1px] left-[1px]',
      fontSize: 'text-[9px]',
    },
    md: {
      diode: 'w-2.5 h-2.5',
      housing: 'p-1.5 gap-1.5',
      iconSize: 9,
      specular: 'w-0.5 h-0.5 top-[1.5px] left-[1.5px]',
      fontSize: 'text-[10px]',
    },
    lg: {
      diode: 'w-3.5 h-3.5',
      housing: 'p-2 gap-2',
      iconSize: 11,
      specular: 'w-1 h-1 top-[2px] left-[2px]',
      fontSize: 'text-xs',
    },
  }[size];

  return (
    <div
      className={`inline-flex items-center bg-[#0c0c0e] border border-[#242429] rounded-md ${dimensions.housing} shadow-subtle select-none ${className}`}
      role="status"
      aria-label={`Sistema de Luces Estado: ${state}`}
      aria-live="polite"
    >
      {/* Diode 1: Green Lens (0 - 30d Current) */}
      <div
        className={`relative ${dimensions.diode} rounded-full border transition-fast flex items-center justify-center ${
          state === 'GREEN'
            ? 'bg-[#10b981] border-[#34d399]'
            : 'bg-[#06281e]/30 border-[#0e533c]/40 opacity-25'
        }`}
        title="Verde: Cartera al día (0-30 días)"
      >
        {state === 'GREEN' && (
          colorblindMode ? (
            <Check className="text-white" style={{ width: dimensions.iconSize, height: dimensions.iconSize }} strokeWidth={3} />
          ) : (
            <span
              className={`absolute ${dimensions.specular} bg-white/95 rounded-full pointer-events-none`}
              aria-hidden="true"
            />
          )
        )}
      </div>

      {/* Diode 2: Amber Lens (31 - 90d Warning) */}
      <div
        className={`relative ${dimensions.diode} rounded-full border transition-fast flex items-center justify-center ${
          state === 'YELLOW'
            ? 'bg-[#f59e0b] border-[#fbbf24]'
            : 'bg-[#2c1b04]/30 border-[#6b4308]/40 opacity-25'
        }`}
        title="Ámbar: Atención / Mora moderada (31-90 días)"
      >
        {state === 'YELLOW' && (
          colorblindMode ? (
            <AlertTriangle className="text-white" style={{ width: dimensions.iconSize, height: dimensions.iconSize }} strokeWidth={3} />
          ) : (
            <span
              className={`absolute ${dimensions.specular} bg-white/95 rounded-full pointer-events-none`}
              aria-hidden="true"
            />
          )
        )}
      </div>

      {/* Diode 3: Red Lens (+90d Critical) */}
      <div
        className={`relative ${dimensions.diode} rounded-full border transition-fast flex items-center justify-center ${
          state === 'RED'
            ? 'bg-[#ef4444] border-[#f87171]'
            : 'bg-[#2e0b11]/30 border-[#711b25]/40 opacity-25'
        }`}
        title="Rojo: Mora crítica (+90 días)"
      >
        {state === 'RED' && (
          colorblindMode ? (
            <AlertCircle className="text-white" style={{ width: dimensions.iconSize, height: dimensions.iconSize }} strokeWidth={3} />
          ) : (
            <span
              className={`absolute ${dimensions.specular} bg-white/95 rounded-full pointer-events-none`}
              aria-hidden="true"
            />
          )
        )}
      </div>

      {/* Status Label Tag */}
      {showLabels && (
        <span
          className={`font-mono ${dimensions.fontSize} font-bold tracking-wider uppercase ml-1 px-1.5 py-0.5 rounded border ${
            state === 'GREEN'
              ? 'text-[#34d399] bg-[#06281e] border-[#0e533c]'
              : state === 'YELLOW'
              ? 'text-[#fbbf24] bg-[#2c1b04] border-[#6b4308]'
              : 'text-[#f87171] bg-[#2e0b11] border-[#711b25]'
          }`}
        >
          {state === 'GREEN' ? 'SANO' : state === 'YELLOW' ? 'ALERTA' : 'CRÍTICO'}
        </span>
      )}
    </div>
  );
};
