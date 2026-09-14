import type { AnalyzedMatch, MatchHistory } from '@fraglens/core';
import {
  formLine,
  outcomeLetter,
  outcomeStyle,
  percentOrDash,
  decimalOrDash,
  playerTitle,
  ranksText,
} from './components.js';
import {
  formatDate,
  formatDateTime,
  formatDecimal,
  formatMapName,
  safeText,
  type FormatOptions,
} from './format.js';
import { footer, header, section } from './layout.js';
import { renderTable, type Cell } from './table.js';
import type { Theme } from './theme.js';

const ORIGIN_LABELS: Readonly<Record<string, string>> = {
  matchmaking: 'Matchmaking',
  matchmaking_competitive: 'Competitivo',
  matchmaking_wingman: 'Wingman',
  faceit: 'FACEIT',
  hltv: 'HLTV',
  renown: 'Renown',
};

export function renderMatchHistory(
  history: MatchHistory,
  theme: Theme,
  format: FormatOptions,
): string {
  const { recentForm } = history;

  return [
    ...header(
      playerTitle(history.playerName, history.steamId64, theme),
      [theme.colors.dim(ranksText(history.ranks, theme))],
      theme,
    ),
    ...section(
      'FORMA RECENTE',
      [formLine(recentForm, theme)],
      theme,
      recentForm.outcomes.length > 0 ? `últimas ${recentForm.outcomes.length}` : undefined,
    ),
    ...section(
      'PARTIDAS',
      matchTable(history.matches, theme, format),
      theme,
      `${history.matches.length} de ${history.availableMatches}`,
    ),
    ...footer(
      [
        history.attribution,
        'K/D, ADR e HS% calculados pelo FragLens',
        `consultado em ${formatDateTime(history.fetchedAt, format)}`,
      ],
      theme,
    ),
  ].join('\n');
}

function matchTable(
  matches: readonly AnalyzedMatch[],
  theme: Theme,
  format: FormatOptions,
): string[] {
  if (matches.length === 0) return [theme.colors.dim('Nenhuma partida disponível na Leetify.')];

  const rows: Cell[][] = matches.map((match) => [
    formatDate(match.finishedAt, format),
    formatMapName(match.map),
    ORIGIN_LABELS[match.origin] ?? safeText(match.origin),
    `${match.score.team}-${match.score.opponent}`,
    { text: outcomeLetter(match.outcome), style: outcomeStyle(match.outcome, theme) },
    `${match.stats.kills}-${match.stats.deaths}-${match.stats.assists}`,
    formatDecimal(match.metrics.killDeathRatio, 2),
    decimalOrDash(match.metrics.averageDamagePerRound, 1, theme),
    percentOrDash(match.metrics.headshotPercentage, theme),
  ]);

  return renderTable(
    [
      { header: 'Data' },
      { header: 'Mapa' },
      { header: 'Origem' },
      { header: 'Placar', align: 'right' },
      { header: 'Res.' },
      { header: 'K-D-A', align: 'right' },
      { header: 'K/D', align: 'right' },
      { header: 'ADR', align: 'right' },
      { header: 'HS%', align: 'right' },
    ],
    rows,
    theme,
  );
}
