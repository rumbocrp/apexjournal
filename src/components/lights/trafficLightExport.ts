import { TrafficLightTelemetryReport } from './types';

/**
 * Generates an executive Markdown report of the current Sistema de Luces state.
 */
export function generateExecutiveMarkdownReport(report: TrafficLightTelemetryReport): string {
  const lines: string[] = [
    `# INFORME EJECUTIVO DE CARTERA: SISTEMA DE LUCES`,
    `**Fecha de Evaluación:** ${report.evaluatedAt.split('T')[0]}`,
    `**Estado Global:** ${report.stateLabel} (${report.state})`,
    `**Total Pendiente de Cobro:** $${report.totalReceivable.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${report.currency}`,
    `**Total Facturas en Auditoría:** ${report.totalInvoices}`,
    ``,
    `## Diagnóstico Operativo`,
    `> ${report.stateDescription}`,
    ``,
    `## Desglose de Exposición por Cubetas Temporales`,
    `| Cubeta de Envejecimiento | Importe (${report.currency}) | Proporción (%) | Facturas | Severidad |`,
    `| :--- | :--- | :--- | :--- | :--- |`,
  ];

  for (const b of report.buckets) {
    lines.push(
      `| **${b.label}** | $${b.amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} | ${b.percentage.toFixed(1)}% | ${b.invoiceCount} | ${b.severity.toUpperCase()} |`
    );
  }

  lines.push(``);
  lines.push(`---`);
  lines.push(`*Generado automáticamente por el Motor Anti-AI-Slop del Sistema de Luces.*`);

  return lines.join('\n');
}

/**
 * Generates RFC-4180 compliant CSV content for the aging buckets.
 */
export function generateAgingCsv(report: TrafficLightTelemetryReport): string {
  const rows: string[] = [
    `"Cubeta","Rango_Dias","Importe_${report.currency}","Porcentaje","Numero_Facturas","Severidad","Estado_Global"`,
  ];

  for (const b of report.buckets) {
    const range = b.daysRange[1] !== null ? `${b.daysRange[0]}-${b.daysRange[1]}` : `+${b.daysRange[0]}`;
    rows.push(
      `"${b.label}","${range}",${b.amount.toFixed(2)},${b.percentage.toFixed(2)},${b.invoiceCount},"${b.severity}","${report.state}"`
    );
  }

  return rows.join('\n');
}

/**
 * Client-side file downloader helper for web or desktop.
 */
export function downloadTextFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
