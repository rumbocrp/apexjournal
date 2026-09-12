import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  Award,
  DollarSign,
  FileCheck2,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  FileSpreadsheet,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useHotkeys } from '../context/HotkeyContext';
import { HotkeyBadge } from '../components/hotkeys';
import { Timeframe, EquityCurvePoint } from '../types';
import { triggerExcelExport } from '../api/export';
import { TrafficLightSystemPanel } from '../components/lights/TrafficLightSystem';

export const DashboardView: React.FC = () => {
  const { dashboardMetrics, equityCurve, arAging, timeframe, setTimeframe, transactions, setActiveView } = useData();
  const { registerActionHandler } = useHotkeys();

  // Register Dashboard timeframe hotkeys
  useEffect(() => {
    const unreg1w = registerActionHandler('dashboard_tf_1w', () => setTimeframe('1W'));
    const unreg1m = registerActionHandler('dashboard_tf_1m', () => setTimeframe('1M'));
    const unreg3m = registerActionHandler('dashboard_tf_3m', () => setTimeframe('3M'));
    const unreg1y = registerActionHandler('dashboard_tf_1y', () => setTimeframe('1Y'));
    const unregAll = registerActionHandler('dashboard_tf_all', () => setTimeframe('ALL'));

    return () => {
      unreg1w();
      unreg1m();
      unreg3m();
      unreg1y();
      unregAll();
    };
  }, [registerActionHandler, setTimeframe]);

  // Hover state for interactive SVG equity curve crosshair
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Group monthly volume bars for the bottom chart
  const monthlyVolumes = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    const cleared = transactions.filter((t) => t.status === 'CLEARED' || t.status === 'PAID');
    for (const t of cleared) {
      const month = t.date.substring(0, 7); // YYYY-MM
      if (!map.has(month)) {
        map.set(month, { income: 0, expense: 0 });
      }
      const data = map.get(month)!;
      const amt = t.base_amount || t.amount * (t.exchange_rate || 1.0);
      if (t.type === 'INCOME') data.income += amt;
      else if (t.type === 'EXPENSE') data.expense += amt;
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, val]) => ({
        month,
        income: Math.round(val.income),
        expense: Math.round(val.expense),
      }));
  }, [transactions]);

  // Compute SVG coordinates for Equity Curve
  const chartData = equityCurve;
  const chartHeight = 220;
  const chartWidth = 700;
  const padding = { top: 20, right: 30, bottom: 30, left: 60 };

  const { points, lineD, areaD, minVal, maxVal } = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { points: [], lineD: '', areaD: '', minVal: 0, maxVal: 1000 };
    }

    const values = chartData.map((d) => d.cumulative_equity);
    let min = Math.min(...values, 0);
    let max = Math.max(...values, 1000);
    if (min === max) {
      min -= 500;
      max += 500;
    }
    const range = max - min;

    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    const pts = chartData.map((d, i) => {
      const x =
        chartData.length === 1
          ? padding.left + innerWidth / 2
          : padding.left + (i / (chartData.length - 1)) * innerWidth;
      const y = padding.top + innerHeight - ((d.cumulative_equity - min) / range) * innerHeight;
      return { x, y, data: d };
    });

    // Build SVG path
    let lD = '';
    pts.forEach((pt, i) => {
      if (i === 0) lD += `M ${pt.x} ${pt.y}`;
      else lD += ` L ${pt.x} ${pt.y}`;
    });

    let aD = '';
    if (pts.length > 0) {
      const bottomY = padding.top + innerHeight;
      aD = `${lD} L ${pts[pts.length - 1].x} ${bottomY} L ${pts[0].x} ${bottomY} Z`;
    }

    return { points: pts, lineD: lD, areaD: aD, minVal: min, maxVal: max };
  }, [chartData, chartWidth, chartHeight, padding.left, padding.right, padding.top, padding.bottom]);

  const activePoint: { x: number; y: number; data: EquityCurvePoint } | null =
    hoveredPointIndex !== null && points[hoveredPointIndex]
      ? points[hoveredPointIndex]
      : points.length > 0
      ? points[points.length - 1]
      : null;

  // Profit Margin calculation
  const profitMarginPct =
    dashboardMetrics && dashboardMetrics.realized_volume > 0
      ? Math.round(
          ((dashboardMetrics.cumulative_net_margin / dashboardMetrics.realized_volume) * 100) * 10
        ) / 10
      : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-obsidian-950 text-obsidian-100">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-surface-border pb-4">
        <div>
          <h1 className="text-sm font-semibold tracking-[0.2em] text-obsidian-100 font-mono uppercase">
            Resumen Operativo y Financiero
          </h1>
          <p className="text-xs text-obsidian-500 mt-0.5">
            Métricas clave, curva de capital y diagnóstico de cuentas por cobrar
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Export Excel Report Button */}
          <button
            onClick={async () => {
              try {
                await triggerExcelExport();
                alert('Informe de cuentas en Excel generado con éxito.');
              } catch (err: any) {
                alert(`Error al exportar Excel: ${err.message || err}`);
              }
            }}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-surface-secondary hover:bg-surface-hover border border-surface-border text-obsidian-300 hover:text-white text-xs font-medium rounded-md transition-fast"
            title="Descargar resumen en Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-obsidian-400" />
            <span>Exportar Excel</span>
            <HotkeyBadge actionId="global_export_excel" />
          </button>

          {/* Timeframe Selectors */}
          <div className="flex items-center space-x-0.5 bg-surface-primary p-0.5 rounded-md border border-surface-border">
            {(['1W', '1M', '3M', '1Y', 'ALL'] as Timeframe[]).map((tf) => {
              const actionId =
                tf === '1W'
                  ? 'dashboard_tf_1w'
                  : tf === '1M'
                  ? 'dashboard_tf_1m'
                  : tf === '3M'
                  ? 'dashboard_tf_3m'
                  : tf === '1Y'
                  ? 'dashboard_tf_1y'
                  : 'dashboard_tf_all';

              return (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-1 text-xs font-mono font-medium rounded transition-fast flex items-center space-x-1 ${
                    timeframe === tf
                      ? 'bg-obsidian-100 text-obsidian-950 font-bold'
                      : 'text-obsidian-400 hover:text-obsidian-200 hover:bg-surface-secondary'
                  }`}
                  title={`Marco: ${tf}`}
                >
                  <span>{tf === '1W' ? '1S' : tf === '1M' ? '1M' : tf === '3M' ? '3M' : tf === '1Y' ? '1A' : 'TODO'}</span>
                  <HotkeyBadge actionId={actionId} variant="subtle" className="text-[8px] px-0.5" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5 Executive KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {/* KPI 1: Cumulative Net Margin */}
        <div className="craft-card p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-obsidian-400">
            <span className="font-medium">Margen Neto Acumulado</span>
            <DollarSign className="w-3.5 h-3.5 text-obsidian-500" />
          </div>
          <div className="text-xl font-bold font-mono text-obsidian-100 tabular-nums">
            ${dashboardMetrics ? dashboardMetrics.cumulative_net_margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span
              className={`metric-badge ${
                (dashboardMetrics?.cumulative_net_margin ?? 0) >= 0
                  ? 'bg-financial-positiveMuted text-financial-positiveText border border-financial-positiveBorder'
                  : 'bg-financial-negativeMuted text-financial-negativeText border border-financial-negativeBorder'
              }`}
            >
              {(dashboardMetrics?.cumulative_net_margin ?? 0) >= 0 ? (
                <ArrowUpRight className="w-3 h-3 text-financial-positive" />
              ) : (
                <ArrowDownRight className="w-3 h-3 text-financial-negative" />
              )}
              <span>{profitMarginPct}% Margen</span>
            </span>
            <span className="text-obsidian-500 text-[10px] font-mono">Realizado</span>
          </div>
        </div>

        {/* KPI 2: Proposal Win Rate */}
        <div className="craft-card p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-obsidian-400">
            <span className="font-medium">Ratio de Cierre</span>
            <Award className="w-3.5 h-3.5 text-obsidian-500" />
          </div>
          <div className="text-xl font-bold font-mono text-obsidian-100 tabular-nums">
            {dashboardMetrics ? `${dashboardMetrics.proposal_win_rate}%` : '0%'}
          </div>
          <div className="flex items-center justify-between text-[11px] text-obsidian-500">
            <span className="font-mono text-[10px] text-obsidian-400">Propuestas</span>
            <span className="text-[10px] font-mono">Efectividad</span>
          </div>
        </div>

        {/* KPI 3: Realized Volume */}
        <div className="craft-card p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-obsidian-400">
            <span className="font-medium">Volumen Cobrado</span>
            <TrendingUp className="w-3.5 h-3.5 text-financial-positive" />
          </div>
          <div className="text-xl font-bold font-mono text-financial-positiveText tabular-nums">
            ${dashboardMetrics ? dashboardMetrics.realized_volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-[10px] text-obsidian-500 font-mono">Cobros Liquidados</div>
        </div>

        {/* KPI 4: Invoiced Volume */}
        <div className="craft-card p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-obsidian-400">
            <span className="font-medium">Facturado / Emitido</span>
            <FileCheck2 className="w-3.5 h-3.5 text-obsidian-500" />
          </div>
          <div className="text-xl font-bold font-mono text-obsidian-100 tabular-nums">
            ${dashboardMetrics ? dashboardMetrics.invoiced_volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-[10px] text-obsidian-500 font-mono">Facturas en Tránsito</div>
        </div>

        {/* KPI 5: Average Ticket Size */}
        <div className="craft-card p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-obsidian-400">
            <span className="font-medium">Ticket Promedio</span>
            <Layers className="w-3.5 h-3.5 text-obsidian-500" />
          </div>
          <div className="text-xl font-bold font-mono text-obsidian-100 tabular-nums">
            ${dashboardMetrics ? dashboardMetrics.avg_ticket_size.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-[10px] text-obsidian-500 font-mono">Por Caso Cerrado</div>
        </div>
      </div>

      {/* Main Visuals Row: Equity Curve & SISTEMA DE LUCES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Interactive Equity Curve Chart (8 cols) */}
        <div className="lg:col-span-8 craft-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-obsidian-400 font-mono">
                Curva Acumulada de Capital
              </div>
              <div className="text-lg font-bold font-mono text-obsidian-100 tabular-nums">
                ${activePoint?.data.cumulative_equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </div>
            </div>

            {/* Hover Tooltip Header */}
            {activePoint && (
              <div className="text-right space-y-0.5 bg-surface-secondary px-3 py-1.5 rounded border border-surface-border">
                <div className="text-[10px] font-mono text-obsidian-400 flex items-center space-x-1 justify-end">
                  <Calendar className="w-3 h-3 text-obsidian-500" />
                  <span>{activePoint.data.date}</span>
                </div>
                <div className="text-xs font-mono font-semibold">
                  <span className="text-obsidian-500 text-[10px] mr-1">Delta diario:</span>
                  <span
                    className={
                      activePoint.data.daily_delta >= 0 ? 'text-financial-positiveText' : 'text-financial-negativeText'
                    }
                  >
                    {activePoint.data.daily_delta >= 0 ? '+' : ''}$
                    {activePoint.data.daily_delta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* SVG Chart Container */}
          <div className="w-full relative select-none">
            {points.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-center text-xs text-obsidian-500 border border-dashed border-surface-border rounded">
                <TrendingUp className="w-5 h-5 text-obsidian-600 mb-2" />
                <span>No hay registros financieros en el intervalo seleccionado.</span>
                <span className="text-[11px] text-obsidian-600 mt-0.5">Utiliza ⌘N para ingresar cobros o gastos.</span>
              </div>
            ) : (
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-56 overflow-visible"
                onMouseLeave={() => setHoveredPointIndex(null)}
              >
                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1.0].map((ratio) => {
                  const y = padding.top + (chartHeight - padding.top - padding.bottom) * ratio;
                  const val = Math.round(maxVal - ratio * (maxVal - minVal));
                  return (
                    <g key={ratio}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={chartWidth - padding.right}
                        y2={y}
                        stroke="#1e1e24"
                        strokeDasharray="2 2"
                      />
                      <text
                        x={padding.left - 8}
                        y={y + 3}
                        fill="#63636c"
                        fontSize="9"
                        fontFamily="Jost, 'SF Mono', monospace"
                        textAnchor="end"
                      >
                        ${val.toLocaleString()}
                      </text>
                    </g>
                  );
                })}

                {/* Shaded Area */}
                <path d={areaD} fill="url(#solidAreaGrad)" />

                {/* Line */}
                <path
                  d={lineD}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Solid subtle gradient */}
                <defs>
                  <linearGradient id="solidAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Hover Interaction Areas & Points */}
                {points.map((pt, idx) => (
                  <g key={pt.data.date}>
                    <rect
                      x={pt.x - 10}
                      y={0}
                      width={20}
                      height={chartHeight}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPointIndex(idx)}
                    />
                    {hoveredPointIndex === idx && (
                      <>
                        <line
                          x1={pt.x}
                          y1={padding.top}
                          x2={pt.x}
                          y2={chartHeight - padding.bottom}
                          stroke="#63636c"
                          strokeDasharray="2 2"
                          strokeWidth="1"
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="3.5"
                          fill="#10b981"
                          stroke="#09090b"
                          strokeWidth="2"
                        />
                      </>
                    )}
                  </g>
                ))}

                {/* X Axis dates */}
                {points.length > 0 && (
                  <>
                    <text
                      x={points[0].x}
                      y={chartHeight - 8}
                      fill="#63636c"
                      fontSize="9.5"
                      fontFamily="Jost, 'SF Mono', monospace"
                      textAnchor="start"
                    >
                      {points[0].data.date}
                    </text>
                    <text
                      x={points[points.length - 1].x}
                      y={chartHeight - 8}
                      fill="#63636c"
                      fontSize="9.5"
                      fontFamily="Jost, 'SF Mono', monospace"
                      textAnchor="end"
                    >
                      {points[points.length - 1].data.date}
                    </text>
                  </>
                )}
              </svg>
            )}
          </div>
        </div>

        {/* Modular SISTEMA DE LUCES Component (4 cols) */}
        <div className="lg:col-span-4">
          <TrafficLightSystemPanel
            arAging={arAging}
            onInspectBlotter={() => setActiveView('blotter')}
          />
        </div>
      </div>

      {/* Monthly PnL Volume Bars Section */}
      <div className="craft-card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-obsidian-400 font-mono">
            Balance Comparativo Mensual (Ingresos vs Gastos)
          </div>
          <div className="flex items-center space-x-4 text-xs font-mono">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded bg-financial-positive" />
              <span className="text-obsidian-400 text-[11px]">Ingresos Liquidados</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded bg-financial-negative" />
              <span className="text-obsidian-400 text-[11px]">Gastos Operativos</span>
            </div>
          </div>
        </div>

        {/* Volume Bars */}
        {monthlyVolumes.length === 0 ? (
          <div className="h-28 flex flex-col items-center justify-center text-center text-xs text-obsidian-500 border border-dashed border-surface-border rounded">
            <span>No hay movimientos para generar el balance mensual.</span>
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-2.5 pt-1">
            {monthlyVolumes.map((m) => {
              const max = Math.max(m.income, m.expense, 1000);
              const incPct = Math.min(100, Math.round((m.income / max) * 100));
              const expPct = Math.min(100, Math.round((m.expense / max) * 100));

              return (
                <div
                  key={m.month}
                  className="craft-card-inset p-3 space-y-2 text-center"
                >
                  <div className="text-xs font-mono font-semibold text-obsidian-300">{m.month}</div>
                  {/* Bar heights */}
                  <div className="h-20 flex items-end justify-center space-x-1.5 py-1">
                    <div
                      style={{ height: `${Math.max(6, incPct)}%` }}
                      className="w-3.5 bg-financial-positive rounded-t-sm"
                      title={`Ingresos: $${m.income.toLocaleString()}`}
                    />
                    <div
                      style={{ height: `${Math.max(6, expPct)}%` }}
                      className="w-3.5 bg-financial-negative rounded-t-sm"
                      title={`Gastos: $${m.expense.toLocaleString()}`}
                    />
                  </div>
                  <div className="text-[10px] font-mono space-y-0.5 tabular-nums">
                    <div className="text-financial-positiveText font-medium">+${m.income.toLocaleString()}</div>
                    <div className="text-financial-negativeText font-medium">-${m.expense.toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
