import type { PerformanceAnalysis, PlayerAnalysis, PlayerProfile } from '@fraglens/core';
import {
  bansText,
  comparisonDetail,
  comparisonLines,
  decimalOrDash,
  formLine,
  mapTable,
  noticeLines,
  percentOrDash,
  periodText,
  playerTitle,
  playtimeText,
  ranksText,
  recordText,
  streakLine,
  summaryCards,
} from './components.js';
import { countryName, formatDateTime, type FormatOptions } from './format.js';
import { footer, header, section } from './layout.js';
import type { Theme } from './theme.js';

export function renderAnalysis(
  analysis: PlayerAnalysis,
  theme: Theme,
  format: FormatOptions,
): string {
  const { profile, performance } = analysis;

  return [
    ...header(
      playerTitle(profile.summary.personaName, profile.summary.steamId64, theme),
      [profileLine(profile, theme), theme.colors.dim(ranksText(performance?.ranks ?? null, theme))],
      theme,
    ),
    ...(performance
      ? performanceSections(performance, theme, format)
      : section('DESEMPENHO', noticeLines(analysis.notices, theme), theme)),
    ...section('IA', [aiLine(analysis, theme)], theme),
    ...footer(footerParts(analysis, format), theme),
  ].join('\n');
}

function profileLine(profile: PlayerProfile, theme: Theme): string {
  const { countryCode } = profile.summary;
  return [
    ...(countryCode ? [countryName(countryCode)] : []),
    playtimeText(profile.cs2),
    bansText(profile.bans, theme, 'short'),
  ].join(' · ');
}

function performanceSections(
  performance: PerformanceAnalysis,
  theme: Theme,
  format: FormatOptions,
): string[] {
  const { summary, recentForm, comparison } = performance;

  const details = theme.colors.dim(
    [
      recordText(summary.wins, summary.losses, summary.ties),
      `${decimalOrDash(summary.killsPerRound, 2, theme)} kills por round`,
      `${percentOrDash(summary.rounds.winRate, theme)} dos rounds vencidos`,
      `trades ${percentOrDash(summary.trades.tradeKillSuccessRate, theme)}`,
    ].join(' · '),
  );

  return [
    ...section(
      'DESEMPENHO',
      [...summaryCards(summary, theme), details],
      theme,
      periodText(performance, format),
    ),
    ...section(
      'FORMA RECENTE',
      [formLine(recentForm, theme)],
      theme,
      recentForm.outcomes.length > 0 ? `últimas ${recentForm.outcomes.length}` : undefined,
    ),
    ...section(
      'MAPAS',
      mapTable(
        performance.maps,
        { minMapSample: performance.minMapSample, highlights: performance.mapHighlights },
        theme,
      ),
      theme,
    ),
    ...section(
      'TENDÊNCIA',
      [
        ...comparisonLines(comparison, theme),
        '',
        streakLine(performance.streaks, theme),
        theme.colors.dim('evolução completa: fraglens progress <jogador>'),
      ],
      theme,
      comparison.sufficient ? comparisonDetail(comparison) : undefined,
    ),
  ];
}

function aiLine(analysis: PlayerAnalysis, { colors }: Theme): string {
  if (analysis.aiAnalysis.status === 'disabled') {
    return colors.dim('Desativada nesta consulta (--no-ai).');
  }
  return colors.dim(
    'Nenhum provedor de IA configurado (AI_PROVIDER) · as métricas acima não usam IA.',
  );
}

function footerParts(analysis: PlayerAnalysis, format: FormatOptions): string[] {
  const { profile, performance } = analysis;
  return [
    ...(performance
      ? [performance.attribution, 'métricas calculadas pelo FragLens (docs/metrics.md)']
      : []),
    `perfil Steam de ${formatDateTime(profile.fetchedAt, format)}${profile.cached ? ' (cache)' : ''}`,
    `análise gerada em ${formatDateTime(analysis.analyzedAt, format)}`,
  ];
}
