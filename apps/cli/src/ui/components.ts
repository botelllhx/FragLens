import type {
  ComparedMetric,
  Cs2Playtime,
  MapHighlights,
  MapPerformance,
  MatchOutcome,
  MetricComparison,
  PerformanceReportBase,
  PerformanceSummary,
  PeriodComparison,
  PlayerRanks,
  RecentForm,
  SteamBanStatus,
  StreakSummary,
} from '@fraglens/core';
import {
  formatDate,
  formatDateTime,
  formatDecimal,
  formatHours,
  formatInteger,
  formatMapName,
  formatPercent,
  plural,
  safeText,
  type FormatOptions,
} from './format.js';
import { footer, keyValues, statCards } from './layout.js';
import { renderTable, type Cell } from './table.js';
import type { Theme } from './theme.js';

// Blocos visuais reaproveitados pelos comandos. Nenhum cálculo acontece aqui: os valores
// chegam prontos do core e só são formatados.

/** "Nome · SteamID64" para o cabeçalho. */
export function playerTitle(name: string, steamId64: string, { colors }: Theme): string {
  return `${colors.bold(safeText(name))} ${colors.dim(`· ${steamId64}`)}`;
}

/** Atribuição da fonte, origem das métricas e horário da consulta. */
export function performanceFooter(
  report: PerformanceReportBase,
  theme: Theme,
  format: FormatOptions,
): string[] {
  return footer(
    [
      report.attribution,
      'métricas calculadas pelo FragLens (docs/metrics.md)',
      `consultado em ${formatDateTime(report.fetchedAt, format)}`,
    ],
    theme,
  );
}

export function decimalOrDash(value: number | null, digits: number, theme: Theme): string {
  return value === null ? theme.symbols.dash : formatDecimal(value, digits);
}

export function percentOrDash(value: number | null, theme: Theme): string {
  return value === null ? theme.symbols.dash : formatPercent(value);
}

export function recordText(wins: number, losses: number, ties: number): string {
  return `${wins}V ${losses}D ${ties}E`;
}

/** "100 partidas · 15/05/2026 a 13/09/2026". */
export function periodText(report: PerformanceReportBase, format: FormatOptions): string {
  if (report.sampleSize === 0 || !report.period) return 'nenhuma partida disponível';
  return `${plural(report.sampleSize, 'partida', 'partidas')} · ${formatDate(report.period.from, format)} a ${formatDate(report.period.to, format)}`;
}

export function ranksText(ranks: PlayerRanks | null, theme: Theme): string {
  const dash = theme.symbols.dash;
  const premier = ranks?.premier == null ? dash : formatInteger(ranks.premier);
  const faceit =
    ranks?.faceitLevel == null
      ? dash
      : `nível ${ranks.faceitLevel}${ranks.faceitElo === null ? '' : ` (${formatInteger(ranks.faceitElo)} Elo)`}`;
  return `Premier ${premier} · FACEIT ${faceit}`;
}

export function playtimeText(cs2: Cs2Playtime): string {
  if (!cs2.visible || cs2.totalHours === null || cs2.lastTwoWeeksHours === null) {
    return 'horas de CS2 privadas';
  }
  return `${formatHours(cs2.totalHours)} de CS2 (${formatHours(cs2.lastTwoWeeksHours)} em 2 semanas)`;
}

/** `short` para linhas de resumo; `long` para a seção de banimentos do perfil. */
export function bansText(
  bans: SteamBanStatus | null,
  theme: Theme,
  variant: 'short' | 'long',
): string {
  const { colors, symbols } = theme;
  const long = variant === 'long';
  if (!bans) {
    return colors.dim(
      long ? 'Informações de banimento indisponíveis.' : 'banimentos indisponíveis',
    );
  }

  const parts: string[] = [];
  if (bans.vacBanCount > 0) {
    parts.push(
      long
        ? plural(bans.vacBanCount, 'banimento VAC', 'banimentos VAC')
        : `${bans.vacBanCount} VAC`,
    );
  }
  if (bans.gameBanCount > 0) {
    parts.push(
      long
        ? plural(bans.gameBanCount, 'banimento de jogo', 'banimentos de jogo')
        : `${bans.gameBanCount} de jogo`,
    );
  }
  if (bans.communityBanned) parts.push('banido da comunidade');
  if (bans.economyBan !== 'none') parts.push(`restrição de trocas (${safeText(bans.economyBan)})`);

  if (parts.length === 0) {
    return colors.green(`${symbols.ok} ${long ? 'Nenhum banimento registrado' : 'sem banimentos'}`);
  }

  const lastBan =
    bans.daysSinceLastBan === null
      ? ''
      : ` · último há ${plural(bans.daysSinceLastBan, 'dia', 'dias')}`;
  return colors.red(`${symbols.fail} ${parts.join(' · ')}${lastBan}`);
}

const OUTCOME_LETTERS: Readonly<Record<MatchOutcome, string>> = { win: 'V', loss: 'D', tie: 'E' };

export function outcomeLetter(outcome: MatchOutcome): string {
  return OUTCOME_LETTERS[outcome];
}

export function outcomeStyle(outcome: MatchOutcome, { colors }: Theme): (text: string) => string {
  switch (outcome) {
    case 'win':
      return colors.green;
    case 'loss':
      return colors.red;
    case 'tie':
      return colors.yellow;
  }
}

export function formLine(form: RecentForm, theme: Theme): string {
  if (form.outcomes.length === 0) return theme.colors.dim('Sem partidas.');

  // Quadrados só quando há cor: sem ela, a cor seria a única informação e ficaria ilegível.
  const useSquares = theme.colorsEnabled && theme.unicode;
  const marks = form.outcomes
    .map((outcome) => outcomeStyle(outcome, theme)(useSquares ? '■' : outcomeLetter(outcome)))
    .join(' ');

  return `${marks}   ${recordText(form.wins, form.losses, form.ties)}  ${theme.colors.dim('(mais recente à esquerda)')}`;
}

export function summaryCards(summary: PerformanceSummary, theme: Theme): string[] {
  return statCards(
    [
      { label: 'VITÓRIAS', value: percentOrDash(summary.winRate, theme) },
      { label: 'K/D', value: decimalOrDash(summary.killDeathRatio, 2, theme) },
      { label: 'ADR', value: decimalOrDash(summary.averageDamagePerRound, 1, theme) },
      { label: 'HS%', value: percentOrDash(summary.headshotPercentage, theme) },
      { label: 'KDA', value: decimalOrDash(summary.kda, 2, theme) },
    ],
    theme,
  );
}

export function summaryDetailLines(summary: PerformanceSummary, theme: Theme): string[] {
  const { multiKills, trades, utility, rounds } = summary;
  return keyValues(
    [
      ['Resultado', recordText(summary.wins, summary.losses, summary.ties)],
      [
        'Por round',
        `${decimalOrDash(summary.killsPerRound, 2, theme)} kills · ${decimalOrDash(summary.deathsPerRound, 2, theme)} mortes · ${decimalOrDash(summary.assistsPerRound, 2, theme)} assistências`,
      ],
      [
        'Rounds',
        `${percentOrDash(rounds.winRate, theme)} vencidos · ${percentOrDash(rounds.survivalRate, theme)} sobrevividos`,
      ],
      [
        'Multi-kills',
        `2K ${multiKills.twoKills} · 3K ${multiKills.threeKills} · 4K ${multiKills.fourKills} · 5K ${multiKills.fiveKills} (${percentOrDash(multiKills.roundsWithMultiKillPercentage, theme)} dos rounds)`,
      ],
      [
        'Trades',
        `${percentOrDash(trades.tradeKillSuccessRate, theme)} de sucesso · ${percentOrDash(trades.tradedDeathSuccessRate, theme)} das mortes trocadas`,
      ],
      [
        'Utilitários',
        `${decimalOrDash(utility.utilityPerRound, 2, theme)} por round · ${decimalOrDash(utility.flashAssistsPerMatch, 1, theme)} flash assists por partida`,
      ],
    ],
    theme,
  );
}

const BAR_WIDTH = 10;

/** Barra de 0 a 100% com largura fixa. O texto da célula serve só para medir a coluna. */
export function barCell(percent: number | null, theme: Theme): Cell {
  const { colors, symbols } = theme;
  const filled = percent === null ? 0 : Math.round((percent / 100) * BAR_WIDTH);
  const bar =
    (filled > 0 ? colors.cyan(symbols.bar.repeat(filled)) : '') +
    colors.dim(symbols.barEmpty.repeat(BAR_WIDTH - filled));
  return { text: symbols.barEmpty.repeat(BAR_WIDTH), style: () => bar };
}

export function mapTable(
  maps: readonly MapPerformance[],
  options: { minMapSample: number; highlights?: MapHighlights },
  theme: Theme,
): string[] {
  const { colors, symbols } = theme;
  if (maps.length === 0) return [colors.dim('Nenhuma partida disponível na Leetify.')];

  const best = options.highlights?.best?.map;
  const worst = options.highlights?.worst?.map;

  const rows: Cell[][] = maps.map((map) => [
    `${formatMapName(map.map)}${map.lowSample ? '*' : ''}`,
    String(map.matches),
    `${map.wins}-${map.losses}-${map.ties}`,
    barCell(map.winRate, theme),
    percentOrDash(map.winRate, theme),
    decimalOrDash(map.killDeathRatio, 2, theme),
    decimalOrDash(map.averageDamagePerRound, 1, theme),
    percentOrDash(map.headshotPercentage, theme),
    map.map === best
      ? { text: `${symbols.up} melhor`, style: colors.green }
      : map.map === worst
        ? { text: `${symbols.down} pior`, style: colors.red }
        : '',
  ]);

  const table = renderTable(
    [
      { header: 'Mapa' },
      { header: 'Jogos', align: 'right' },
      { header: 'V-D-E', align: 'right' },
      { header: 'Vitórias' },
      { header: '', align: 'right' },
      { header: 'K/D', align: 'right' },
      { header: 'ADR', align: 'right' },
      { header: 'HS%', align: 'right' },
      { header: '' },
    ],
    rows,
    theme,
  );

  const notes: string[] = [];
  if (maps.some((map) => map.lowSample)) {
    notes.push(colors.dim(`* menos de ${options.minMapSample} partidas no mapa: amostra pequena`));
  }
  if (options.highlights && !best) {
    notes.push(
      colors.dim(
        `melhor e pior mapa exigem ao menos 2 mapas com ${options.minMapSample} ou mais partidas`,
      ),
    );
  }

  return notes.length > 0 ? [...table, '', ...notes] : table;
}

export function comparisonDetail(comparison: PeriodComparison): string {
  return `últimas ${comparison.recentMatches} × ${comparison.previousMatches} anteriores`;
}

const COMPARED_METRICS: readonly (readonly [ComparedMetric, string])[] = [
  ['winRate', 'Vitórias'],
  ['killDeathRatio', 'K/D'],
  ['averageDamagePerRound', 'ADR'],
  ['headshotPercentage', 'HS%'],
];

const PERCENT_POINT_METRICS: ReadonlySet<ComparedMetric> = new Set([
  'winRate',
  'headshotPercentage',
]);

/** Anterior → recente, com a variação colorida. */
export function comparisonLines(comparison: PeriodComparison, theme: Theme): string[] {
  if (!comparison.sufficient) {
    return [
      theme.colors.dim(
        `Dados insuficientes para comparar (${comparison.recentMatches} recentes × ${comparison.previousMatches} anteriores; mínimo de 5 em cada período).`,
      ),
    ];
  }

  const rows: Cell[][] = COMPARED_METRICS.map(([metric, label]) => {
    const values = comparison.metrics[metric];
    return [
      label,
      metricValue(metric, values.previous, theme),
      theme.symbols.arrow,
      metricValue(metric, values.recent, theme),
      variationCell(metric, values, theme),
    ];
  });

  return renderTable(
    [
      { header: '' },
      { header: '', align: 'right' },
      { header: '' },
      { header: '', align: 'right' },
      { header: '' },
    ],
    rows,
    theme,
    { header: false },
  );
}

function metricValue(metric: ComparedMetric, value: number | null, theme: Theme): string {
  if (PERCENT_POINT_METRICS.has(metric)) return percentOrDash(value, theme);
  return decimalOrDash(value, metric === 'killDeathRatio' ? 2 : 1, theme);
}

function variationCell(metric: ComparedMetric, values: MetricComparison, theme: Theme): Cell {
  const { colors, symbols } = theme;
  if (values.delta === null || values.direction === null) return symbols.dash;

  const digits = metric === 'killDeathRatio' ? 2 : 1;
  const sign = values.delta > 0 ? '+' : '';
  const unit = PERCENT_POINT_METRICS.has(metric) ? ' p.p.' : '';
  const amount = `${sign}${formatDecimal(values.delta, digits)}${unit}`;

  switch (values.direction) {
    case 'up':
      return { text: `${symbols.up} ${amount}`, style: colors.green };
    case 'down':
      return { text: `${symbols.down} ${amount}`, style: colors.red };
    case 'stable':
      return { text: `${symbols.stable} estável (${amount})`, style: colors.dim };
  }
}

const OUTCOME_NAMES = {
  win: ['vitória', 'vitórias'],
  loss: ['derrota', 'derrotas'],
  tie: ['empate', 'empates'],
} as const;

export function streakLine(streaks: StreakSummary, theme: Theme): string {
  let current: string = theme.symbols.dash;
  if (streaks.current) {
    const [singular, pluralForm] = OUTCOME_NAMES[streaks.current.outcome];
    current = plural(streaks.current.length, singular, pluralForm);
  }
  return `Sequência atual: ${current} ${theme.colors.dim(`· maiores sequências: ${streaks.longestWinStreak}V / ${streaks.longestLossStreak}D`)}`;
}

export function noticeLines(
  notices: readonly { message: string; hints: readonly string[] }[],
  theme: Theme,
): string[] {
  const { colors, symbols } = theme;
  return notices.flatMap((notice) => [
    `${colors.yellow(symbols.warn)} ${notice.message}`,
    ...notice.hints.map((hint) => colors.dim(`  ${symbols.bullet} ${hint}`)),
  ]);
}
