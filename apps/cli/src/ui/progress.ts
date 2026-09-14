import type { PerformanceBlock, ProgressReport } from '@fraglens/core';
import {
  barCell,
  comparisonDetail,
  comparisonLines,
  decimalOrDash,
  percentOrDash,
  performanceFooter,
  periodText,
  playerTitle,
  ranksText,
  streakLine,
  summaryCards,
  summaryDetailLines,
} from './components.js';
import { formatDate, type FormatOptions } from './format.js';
import { header, section } from './layout.js';
import { renderTable, type Cell } from './table.js';
import type { Theme } from './theme.js';

export function renderProgressReport(
  report: ProgressReport,
  theme: Theme,
  format: FormatOptions,
): string {
  const { colors } = theme;

  const body =
    report.sampleSize === 0
      ? section('DESEMPENHO', [colors.dim('Nenhuma partida disponível na Leetify.')], theme)
      : [
          ...section(
            'DESEMPENHO',
            [
              ...summaryCards(report.summary, theme),
              '',
              ...summaryDetailLines(report.summary, theme),
            ],
            theme,
            periodText(report, format),
          ),
          ...section(
            'TENDÊNCIA',
            [...comparisonLines(report.comparison, theme), '', streakLine(report.streaks, theme)],
            theme,
            report.comparison.sufficient ? comparisonDetail(report.comparison) : undefined,
          ),
          ...section(
            'EVOLUÇÃO',
            blockLines(report.blocks, theme, format),
            theme,
            'blocos de 10 partidas, do mais antigo ao mais recente',
          ),
        ];

  return [
    ...header(
      playerTitle(report.playerName, report.steamId64, theme),
      [colors.dim(ranksText(report.ranks, theme))],
      theme,
    ),
    ...body,
    ...performanceFooter(report, theme, format),
  ].join('\n');
}

function blockLines(
  blocks: readonly PerformanceBlock[],
  theme: Theme,
  format: FormatOptions,
): string[] {
  const rows: Cell[][] = blocks.map((block) => [
    `${formatDate(block.from, format)} a ${formatDate(block.to, format)}`,
    `${block.matches}${block.complete ? '' : '*'}`,
    barCell(block.winRate, theme),
    percentOrDash(block.winRate, theme),
    decimalOrDash(block.killDeathRatio, 2, theme),
    decimalOrDash(block.averageDamagePerRound, 1, theme),
    percentOrDash(block.headshotPercentage, theme),
  ]);

  const table = renderTable(
    [
      { header: 'Período' },
      { header: 'Jogos', align: 'right' },
      { header: 'Vitórias' },
      { header: '', align: 'right' },
      { header: 'K/D', align: 'right' },
      { header: 'ADR', align: 'right' },
      { header: 'HS%', align: 'right' },
    ],
    rows,
    theme,
  );

  if (!blocks.some((block) => !block.complete)) return table;
  return [...table, theme.colors.dim('* bloco com menos de 10 partidas')];
}
