import type {
  AnalysisNotice,
  MapHighlights,
  MapPerformance,
  PerformanceAnalysis,
  PlayerAnalysis,
  PlayerProfile,
  PlayerRanks,
} from '@fraglens/core';
import {
  countryName,
  formatDateTime,
  formatHours,
  formatMapName,
  safeText,
  type FormatOptions,
} from './format.js';
import { banner, keyValues, rule, section } from './layout.js';
import { mapTableLines } from './maps.js';
import { formLines, rankRows } from './matches.js';
import { renderBans } from './profile.js';
import { comparisonLines, streakLines, summaryLines } from './progress.js';
import { decimalOrDash, percentOrDash, sampleDescription } from './report.js';
import type { Theme } from './theme.js';

export function renderAnalysis(
  analysis: PlayerAnalysis,
  theme: Theme,
  format: FormatOptions,
): string {
  const { performance } = analysis;

  return [
    '',
    ...banner(theme),
    '',
    ...section('JOGADOR', playerLines(analysis.profile, performance?.ranks ?? null, theme), theme),
    ...(performance
      ? performanceSections(performance, theme, format)
      : section('DESEMPENHO', noticeLines(analysis.notices, theme), theme)),
    ...section('ANÁLISE COM IA', aiLines(analysis, theme), theme),
    rule(theme),
    ...footerLines(analysis, theme, format),
    '',
  ].join('\n');
}

function playerLines(profile: PlayerProfile, ranks: PlayerRanks | null, theme: Theme): string[] {
  const { summary, cs2 } = profile;

  const hours =
    cs2.visible && cs2.totalHours !== null && cs2.lastTwoWeeksHours !== null
      ? `${formatHours(cs2.totalHours)} (${formatHours(cs2.lastTwoWeeksHours)} nas últimas 2 semanas)`
      : 'Indisponível (detalhes de jogos privados)';

  const rows: [string, string][] = [
    ['SteamID64', summary.steamId64],
    ['Perfil', safeText(summary.profileUrl)],
    ['País', summary.countryCode ? countryName(summary.countryCode) : 'Não informado'],
    ['Horas de CS2', hours],
    ['Banimentos', renderBans(profile.bans, theme)],
    ...(ranks
      ? rankRows(ranks)
      : ([
          ['Premier', 'Indisponível'],
          ['FACEIT', 'Indisponível'],
        ] as [string, string][])),
  ];

  return [theme.colors.bold(safeText(summary.personaName)), '', ...keyValues(rows, theme)];
}

function performanceSections(
  performance: PerformanceAnalysis,
  theme: Theme,
  format: FormatOptions,
): string[] {
  const { colors } = theme;

  return [
    ...section(
      'DESEMPENHO',
      [
        colors.dim(`Base: ${sampleDescription(performance, format)}`),
        '',
        ...summaryLines(performance.summary, theme),
      ],
      theme,
    ),
    ...section('FORMA RECENTE', formLines(performance.recentForm, theme), theme),
    ...section(
      'MAPAS',
      [
        ...mapTableLines(performance.maps, performance.minMapSample, theme),
        '',
        ...highlightLines(performance.mapHighlights, performance.minMapSample, theme),
      ],
      theme,
    ),
    ...section('TENDÊNCIA', comparisonLines(performance.comparison, theme), theme),
    ...section(
      'SEQUÊNCIAS',
      [
        ...streakLines(performance.streaks, theme),
        '',
        colors.dim('Evolução completa: fraglens progress <jogador>'),
      ],
      theme,
    ),
  ];
}

function highlightLines(highlights: MapHighlights, minSample: number, theme: Theme): string[] {
  const { colors, symbols } = theme;
  if (!highlights.best || !highlights.worst) {
    return [
      colors.dim(
        `Melhor e pior mapa: são necessários ao menos 2 mapas com ${minSample} ou mais partidas.`,
      ),
    ];
  }

  return [
    `${colors.green(symbols.up)} Melhor mapa: ${describeMap(highlights.best, theme)}`,
    `${colors.red(symbols.down)} Pior mapa: ${describeMap(highlights.worst, theme)}`,
  ];
}

function describeMap(map: MapPerformance, theme: Theme): string {
  return `${formatMapName(map.map)} (${percentOrDash(map.winRate, theme)} de vitórias · K/D ${decimalOrDash(map.killDeathRatio, 2, theme)} · ${map.matches} partidas)`;
}

function noticeLines(notices: readonly AnalysisNotice[], theme: Theme): string[] {
  const { colors, symbols } = theme;
  return notices.flatMap((notice) => [
    `${colors.yellow(symbols.warn)} ${notice.message}`,
    ...notice.hints.map((hint) => `  ${symbols.bullet} ${hint}`),
  ]);
}

function aiLines(analysis: PlayerAnalysis, theme: Theme): string[] {
  const { colors } = theme;
  if (analysis.aiAnalysis.status === 'disabled') {
    return [colors.dim('Desativada nesta consulta (--no-ai).')];
  }
  return [
    colors.dim('Nenhum provedor de IA configurado (AI_PROVIDER).'),
    colors.dim('Todas as métricas acima foram calculadas pelo FragLens, sem IA.'),
  ];
}

function footerLines(analysis: PlayerAnalysis, theme: Theme, format: FormatOptions): string[] {
  const { colors } = theme;
  const { profile, performance } = analysis;

  const lines = [
    colors.dim(
      `Perfil Steam obtido em ${formatDateTime(profile.fetchedAt, format)}${profile.cached ? ' (cache)' : ''}`,
    ),
  ];
  if (performance) {
    lines.push(
      colors.dim(performance.attribution),
      colors.dim('Métricas calculadas pelo FragLens (fórmulas em docs/metrics.md).'),
    );
  }
  lines.push(colors.dim(`Análise gerada em ${formatDateTime(analysis.analyzedAt, format)}`));
  return lines;
}
