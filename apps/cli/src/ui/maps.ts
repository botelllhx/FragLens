import type { MapReport } from '@fraglens/core';
import { mapTable, performanceFooter, periodText, playerTitle, ranksText } from './components.js';
import type { FormatOptions } from './format.js';
import { header, section } from './layout.js';
import type { Theme } from './theme.js';

export function renderMapReport(report: MapReport, theme: Theme, format: FormatOptions): string {
  return [
    ...header(
      playerTitle(report.playerName, report.steamId64, theme),
      [theme.colors.dim(ranksText(report.ranks, theme))],
      theme,
    ),
    ...section(
      'MAPAS',
      mapTable(report.maps, { minMapSample: report.minMapSample }, theme),
      theme,
      periodText(report, format),
    ),
    ...performanceFooter(report, theme, format),
  ].join('\n');
}
