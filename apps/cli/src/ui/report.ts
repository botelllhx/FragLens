import type { PerformanceReportBase } from '@fraglens/core';
import {
  formatDate,
  formatDateTime,
  formatDecimal,
  formatPercent,
  safeText,
  type FormatOptions,
} from './format.js';
import { keyValues } from './layout.js';
import type { Theme } from './theme.js';

/** Nome, SteamID64 e período analisado, comuns aos relatórios de desempenho. */
export function playerLines(report: PerformanceReportBase, theme: Theme, format: FormatOptions) {
  return [
    theme.colors.bold(safeText(report.playerName)),
    '',
    ...keyValues(
      [
        ['SteamID64', report.steamId64],
        ['Base', sampleDescription(report, format)],
      ],
      theme,
    ),
  ];
}

export function sampleDescription(report: PerformanceReportBase, format: FormatOptions): string {
  if (report.sampleSize === 0 || !report.period) return 'nenhuma partida disponível';
  const matches = `${report.sampleSize} ${report.sampleSize === 1 ? 'partida' : 'partidas'}`;
  return `${matches} · de ${formatDate(report.period.from, format)} a ${formatDate(report.period.to, format)}`;
}

export function reportFooter(
  report: PerformanceReportBase,
  theme: Theme,
  format: FormatOptions,
): string[] {
  const { colors } = theme;
  return [
    colors.dim(report.attribution),
    colors.dim('Métricas calculadas pelo FragLens (fórmulas em docs/metrics.md).'),
    colors.dim(`Consultado em ${formatDateTime(report.fetchedAt, format)}`),
  ];
}

/** Decimal ou traço quando o valor não pode ser calculado. */
export function decimalOrDash(value: number | null, digits: number, theme: Theme): string {
  return value === null ? theme.symbols.dash : formatDecimal(value, digits);
}

export function percentOrDash(value: number | null, theme: Theme): string {
  return value === null ? theme.symbols.dash : formatPercent(value);
}
