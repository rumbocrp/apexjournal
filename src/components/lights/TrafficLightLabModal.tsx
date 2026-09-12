import React, { useEffect } from 'react';
import { X, Activity } from 'lucide-react';
import { TrafficLightSimulator } from './TrafficLightSimulator';

interface TrafficLightLabModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * TrafficLightLabModal: Floating laboratory window for interactive stress testing
 * and real-time visualization of the Sistema de Luces engine.
 */
export const TrafficLightLabModal: React.FC<TrafficLightLabModalProps> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 select-none">
      <div className="relative w-full max-w-4xl bg-[#09090b] border border-[#242429] rounded-xl shadow-modal overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Title Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#242429] bg-[#111113]">
          <div className="flex items-center space-x-2.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-bold tracking-wider uppercase text-obsidian-100">
              Laboratorio de Telemetría: Sistema de Luces
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#161619] text-obsidian-400 border border-[#242429]">
              v2.0 Standalone
            </span>
          </div>

          <button
            onClick={onClose}
            className="text-obsidian-400 hover:text-white p-1 rounded hover:bg-[#1e1e24] transition-fast"
            title="Cerrar modal (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Simulator Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#09090b]">
          <TrafficLightSimulator />
        </div>
      </div>
    </div>
  );
};
