import type { MapReport } from '@fraglens/core';
import { formatMapName, type FormatOptions } from './format.js';
import { banner, rule, section } from './layout.js';
import { decimalOrDash, percentOrDash, playerLines, reportFooter } from './report.js';
import { renderTable, type Cell } from './table.js';
import type { Theme } from './theme.js';

export function renderMapReport(report: MapReport, theme: Theme, format: FormatOptions): string {
  return [
    '',
    ...banner(theme),
    '',
    ...section('JOGADOR', playerLines(report, theme, format), theme),
    ...section('MAPAS', renderMaps(report, theme), theme),
    rule(theme),
    ...reportFooter(report, theme, format),
    '',
  ].join('\n');
}

function renderMaps(report: MapReport, theme: Theme): string[] {
  if (report.maps.length === 0) {
    return [theme.colors.dim('Nenhuma partida disponível na Leetify.')];
  }

  const rows: Cell[][] = report.maps.map((map) => [
    `${formatMapName(map.map)}${map.lowSample ? '*' : ''}`,
    String(map.matches),
    `${map.wins}-${map.losses}-${map.ties}`,
    percentOrDash(map.winRate, theme),
    decimalOrDash(map.killDeathRatio, 2, theme),
    decimalOrDash(map.averageDamagePerRound, 1, theme),
    percentOrDash(map.headshotPercentage, theme),
    decimalOrDash(map.averageKills, 1, theme),
    decimalOrDash(map.averageDeaths, 1, theme),
  ]);

  const table = renderTable(
    [
      { header: 'Mapa' },
      { header: 'Partidas', align: 'right' },
      { header: 'V-D-E', align: 'right' },
      { header: 'Vitórias', align: 'right' },
      { header: 'K/D', align: 'right' },
      { header: 'ADR', align: 'right' },
      { header: 'HS%', align: 'right' },
      { header: 'Kills méd.', align: 'right' },
      { header: 'Mortes méd.', align: 'right' },
    ],
    rows,
    theme,
  );

  const notes = [theme.colors.dim('V-D-E = vitórias, derrotas e empates.')];
  if (report.maps.some((map) => map.lowSample)) {
    notes.push(
      theme.colors.dim(
        `* Menos de ${report.minMapSample} partidas no mapa: amostra pequena, interprete com cuidado.`,
      ),
    );
  }

  return [...table, '', ...notes];
}
