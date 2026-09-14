import type {
  AnalyzedMatch,
  MatchHistory,
  MatchOutcome,
  PlayerRanks,
  RecentForm,
} from '@fraglens/core';
import {
  formatDate,
  formatDateTime,
  formatDecimal,
  formatInteger,
  formatMapName,
  formatPercent,
  safeText,
  type FormatOptions,
} from './format.js';
import { banner, keyValues, rule, section } from './layout.js';
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

const OUTCOME_LETTERS: Readonly<Record<MatchOutcome, string>> = { win: 'V', loss: 'D', tie: 'E' };

export function renderMatchHistory(
  history: MatchHistory,
  theme: Theme,
  format: FormatOptions,
): string {
  const { colors } = theme;

  const player = [
    colors.bold(safeText(history.playerName)),
    '',
    ...keyValues([['SteamID64', history.steamId64], ...rankRows(history.ranks)], theme),
  ];

  return [
    '',
    ...banner(theme),
    '',
    ...section('JOGADOR', player, theme),
    ...section(`FORMA RECENTE`, formLines(history.recentForm, theme), theme),
    ...section(
      `PARTIDAS (${history.matches.length} de ${history.availableMatches})`,
      renderMatches(history.matches, theme, format),
      theme,
    ),
    rule(theme),
    colors.dim(history.attribution),
    colors.dim('K-D-A, ADR e HS% calculados pelo FragLens a partir dos dados de cada partida.'),
    colors.dim(`Consultado em ${formatDateTime(history.fetchedAt, format)}`),
    '',
  ].join('\n');
}

export function rankRows(ranks: PlayerRanks): [string, string][] {
  const faceit =
    ranks.faceitLevel === null
      ? 'Indisponível'
      : [
          `Nível ${ranks.faceitLevel}`,
          ranks.faceitElo === null ? null : `${formatInteger(ranks.faceitElo)} Elo`,
        ]
          .filter(Boolean)
          .join(' · ');

  return [
    ['Premier', ranks.premier === null ? 'Indisponível' : formatInteger(ranks.premier)],
    ['FACEIT', faceit],
  ];
}

export function formLines(form: RecentForm, theme: Theme): string[] {
  const { outcomes, wins, losses, ties } = form;
  if (outcomes.length === 0) return [theme.colors.dim('Sem partidas para calcular.')];

  const letters = outcomes.map((outcome) => styleOutcome(outcome, theme)(OUTCOME_LETTERS[outcome]));
  return [
    letters.join(' '),
    '',
    `Últimas ${outcomes.length}: ${wins} V · ${losses} D · ${ties} E`,
    theme.colors.dim('V = vitória · D = derrota · E = empate · mais recente à esquerda'),
  ];
}

function renderMatches(
  matches: readonly AnalyzedMatch[],
  theme: Theme,
  format: FormatOptions,
): string[] {
  if (matches.length === 0) return [theme.colors.dim('Nenhuma partida disponível na Leetify.')];

  const empty = theme.symbols.dash;
  const rows: Cell[][] = matches.map((match) => [
    formatDate(match.finishedAt, format),
    formatMapName(match.map),
    ORIGIN_LABELS[match.origin] ?? safeText(match.origin),
    `${match.score.team}-${match.score.opponent}`,
    { text: OUTCOME_LETTERS[match.outcome], style: styleOutcome(match.outcome, theme) },
    `${match.stats.kills}-${match.stats.deaths}-${match.stats.assists}`,
    formatDecimal(match.metrics.killDeathRatio, 2),
    match.metrics.averageDamagePerRound === null
      ? empty
      : formatDecimal(match.metrics.averageDamagePerRound, 1),
    match.metrics.headshotPercentage === null
      ? empty
      : formatPercent(match.metrics.headshotPercentage),
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

function styleOutcome(outcome: MatchOutcome, { colors }: Theme): (text: string) => string {
  switch (outcome) {
    case 'win':
      return colors.green;
    case 'loss':
      return colors.red;
    case 'tie':
      return colors.yellow;
  }
}
