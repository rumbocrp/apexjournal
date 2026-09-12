import React, { useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { RawInvoiceInput } from './types';
import { useTrafficLightEngine } from './useTrafficLightEngine';
import { TrafficLightSystemPanel } from './TrafficLightSystemPanel';

/**
 * TrafficLightSimulator: Interactive Scenario Playground.
 * Allows simulating cash flow stress tests, overdue debt, and observing the state machine transitions.
 */
export const TrafficLightSimulator: React.FC = () => {
  const [colorblind, setColorblind] = useState(false);

  // Initial Scenario: Clean & Balanced
  const defaultInvoices: RawInvoiceInput[] = [
    { id: 'sim-1', amount: 3500, date: new Date().toISOString().split('T')[0], status: 'INVOICED', client_name: 'Acme Corp' },
    { id: 'sim-2', amount: 1800, date: getIsoDateOffset(-15), status: 'INVOICED', client_name: 'Stark Labs' },
    { id: 'sim-3', amount: 2400, date: getIsoDateOffset(-45), status: 'INVOICED', client_name: 'Wayne Ent.' },
  ];

  const [invoices, setInvoices] = useState<RawInvoiceInput[]>(defaultInvoices);
  const [newAmount, setNewAmount] = useState('');
  const [newDaysAgo, setNewDaysAgo] = useState('10');
  const [newClient, setNewClient] = useState('');

  const report = useTrafficLightEngine(invoices);

  function getIsoDateOffset(daysOffset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split('T')[0];
  }

  const handleAddInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newAmount);
    if (isNaN(amt) || amt <= 0) return;

    const days = parseInt(newDaysAgo, 10) || 0;
    const date = getIsoDateOffset(-days);

    const newInv: RawInvoiceInput = {
      id: `sim-${Date.now()}`,
      amount: amt,
      date,
      status: 'INVOICED',
      client_name: newClient || 'Cliente Simulado',
    };

    setInvoices((prev) => [newInv, ...prev]);
    setNewAmount('');
    setNewClient('');
  };

  const handleRemoveInvoice = (id: string) => {
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  };

  const applyPreset = (preset: 'all_good' | 'amber_warning' | 'critical_red') => {
    if (preset === 'all_good') {
      setInvoices([
        { id: 'p-1', amount: 5000, date: getIsoDateOffset(-5), status: 'INVOICED', client_name: 'Cliente Alpha' },
        { id: 'p-2', amount: 3200, date: getIsoDateOffset(-20), status: 'INVOICED', client_name: 'Cliente Beta' },
      ]);
    } else if (preset === 'amber_warning') {
      setInvoices([
        { id: 'p-1', amount: 4000, date: getIsoDateOffset(-10), status: 'INVOICED', client_name: 'Cliente Alpha' },
        { id: 'p-2', amount: 2800, date: getIsoDateOffset(-75), status: 'INVOICED', client_name: 'Cliente Mora Media' },
      ]);
    } else if (preset === 'critical_red') {
      setInvoices([
        { id: 'p-1', amount: 2500, date: getIsoDateOffset(-10), status: 'INVOICED', client_name: 'Cliente Alpha' },
        { id: 'p-2', amount: 4800, date: getIsoDateOffset(-110), status: 'INVOICED', client_name: 'Cliente Mora Grave' },
      ]);
    }
  };

  return (
    <div className="craft-card p-6 bg-[#09090b] border-[#242429] space-y-6 text-[#ededef]">
      {/* Simulator Header */}
      <div className="flex items-center justify-between border-b border-[#242429] pb-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight uppercase font-mono text-[#ededef]">
            Simulador Interactivo del Sistema de Luces
          </h2>
          <p className="text-xs text-obsidian-500">
            Prueba en tiempo real escenarios de riesgo y observa la respuesta óptica del motor
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-xs font-mono text-obsidian-300 cursor-pointer bg-[#161619] px-2.5 py-1 rounded border border-[#242429]">
            <input
              type="checkbox"
              checked={colorblind}
              onChange={(e) => setColorblind(e.target.checked)}
              className="rounded bg-[#09090b] border-[#242429] text-emerald-500 focus:ring-0"
            />
            <span>Modo Daltonismo</span>
          </label>

          <button
            onClick={() => setInvoices(defaultInvoices)}
            className="flex items-center space-x-1 px-2.5 py-1 bg-[#161619] hover:bg-[#1e1e24] text-xs text-obsidian-300 rounded border border-[#242429] transition-fast"
            title="Restablecer escenario base"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer</span>
          </button>
        </div>
      </div>

      {/* Preset Scenario Quick Switches */}
      <div className="flex items-center space-x-2 text-xs font-mono">
        <span className="text-obsidian-500 text-[11px]">Escenarios rápidos:</span>
        <button
          onClick={() => applyPreset('all_good')}
          className="px-2.5 py-1 bg-[#06281e] text-[#34d399] border border-[#0e533c] rounded hover:bg-[#083528] transition-fast font-bold text-[10px]"
        >
          [●] Escenario Verde (Sano)
        </button>
        <button
          onClick={() => applyPreset('amber_warning')}
          className="px-2.5 py-1 bg-[#2c1b04] text-[#fbbf24] border border-[#6b4308] rounded hover:bg-[#3d2506] transition-fast font-bold text-[10px]"
        >
          [●] Escenario Ámbar (75 días)
        </button>
        <button
          onClick={() => applyPreset('critical_red')}
          className="px-2.5 py-1 bg-[#2e0b11] text-[#f87171] border border-[#711b25] rounded hover:bg-[#400f17] transition-fast font-bold text-[10px]"
        >
          [●] Escenario Rojo (+110 días)
        </button>
      </div>

      {/* Main Grid: Telemetry Panel vs Invoices Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Output Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="text-xs font-mono uppercase text-obsidian-400 font-semibold">
            Salida de Telemetría en Vivo
          </div>
          <TrafficLightSystemPanel
            report={report}
            colorblindMode={colorblind}
          />
        </div>

        {/* Input Invoice Generator & Table (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="text-xs font-mono uppercase text-obsidian-400 font-semibold">
            Inyector de Facturas y Vencimientos
          </div>

          {/* Form */}
          <form
            onSubmit={handleAddInvoice}
            className="grid grid-cols-12 gap-2 p-3 bg-[#161619] border border-[#242429] rounded-lg text-xs"
          >
            <div className="col-span-5">
              <input
                type="text"
                placeholder="Nombre del Cliente..."
                value={newClient}
                onChange={(e) => setNewClient(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#111113] border border-[#242429] rounded text-xs text-obsidian-100 placeholder-obsidian-500"
              />
            </div>
            <div className="col-span-3">
              <input
                type="number"
                step="0.01"
                placeholder="Importe $"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#111113] border border-[#242429] rounded text-xs font-mono font-bold text-obsidian-100 placeholder-obsidian-500"
                required
              />
            </div>
            <div className="col-span-2">
              <input
                type="number"
                placeholder="Días"
                value={newDaysAgo}
                onChange={(e) => setNewDaysAgo(e.target.value)}
                className="w-full px-2 py-1.5 bg-[#111113] border border-[#242429] rounded text-xs font-mono text-obsidian-300"
                title="Antigüedad en días"
                required
              />
            </div>
            <div className="col-span-2">
              <button
                type="submit"
                className="w-full py-1.5 bg-obsidian-100 hover:bg-white text-obsidian-950 font-bold text-xs rounded transition-fast"
              >
                + Inyectar
              </button>
            </div>
          </form>

          {/* Live Injected Invoices Table */}
          <div className="bg-[#111113] border border-[#242429] rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead className="bg-[#161619] text-[10px] uppercase tracking-wider text-obsidian-500 border-b border-[#242429] sticky top-0">
                <tr>
                  <th className="py-2 px-3">Cliente</th>
                  <th className="py-2 px-3">Fecha Emisión</th>
                  <th className="py-2 px-3 text-right">Importe</th>
                  <th className="py-2 px-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1e]">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#161619] transition-fast">
                    <td className="py-2 px-3 text-obsidian-200">{inv.client_name}</td>
                    <td className="py-2 px-3 text-obsidian-400 text-[11px]">{inv.date}</td>
                    <td className="py-2 px-3 text-right font-bold text-obsidian-100 tabular-nums">
                      ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleRemoveInvoice(inv.id)}
                        className="text-obsidian-500 hover:text-rose-400 p-1 transition-fast"
                        title="Eliminar factura simulada"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
