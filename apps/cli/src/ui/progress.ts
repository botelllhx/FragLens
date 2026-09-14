import type {
  ComparedMetric,
  MetricComparison,
  PerformanceBlock,
  PerformanceSummary,
  ProgressReport,
  StreakSummary,
} from '@fraglens/core';
import { formatDate, formatDecimal, plural, type FormatOptions } from './format.js';
import { banner, keyValues, rule, section } from './layout.js';
import { decimalOrDash, percentOrDash, playerLines, reportFooter } from './report.js';
import { renderTable, type Cell } from './table.js';
import type { Theme } from './theme.js';

export function renderProgressReport(
  report: ProgressReport,
  theme: Theme,
  format: FormatOptions,
): string {
  const body =
    report.sampleSize === 0
      ? [...section('RESUMO', [theme.colors.dim('Nenhuma partida disponível na Leetify.')], theme)]
      : [
          ...section(
            `RESUMO (${report.sampleSize} partidas)`,
            summaryLines(report.summary, theme),
            theme,
          ),
          ...section('RECENTE × ANTERIOR', comparisonLines(report, theme), theme),
          ...section('SEQUÊNCIAS', streakLines(report.streaks, theme), theme),
          ...section('EVOLUÇÃO', blockLines(report.blocks, theme, format), theme),
        ];

  return [
    '',
    ...banner(theme),
    '',
    ...section('JOGADOR', playerLines(report, theme, format), theme),
    ...body,
    rule(theme),
    ...reportFooter(report, theme, format),
    '',
  ].join('\n');
}

function summaryLines(summary: PerformanceSummary, theme: Theme): string[] {
  const { multiKills, utility, trades } = summary;

  return keyValues(
    [
      [
        'Resultado',
        `${summary.wins} V · ${summary.losses} D · ${summary.ties} E (${percentOrDash(summary.winRate, theme)} de vitórias)`,
      ],
      ['K/D', decimalOrDash(summary.killDeathRatio, 2, theme)],
      ['KDA', decimalOrDash(summary.kda, 2, theme)],
      ['ADR', decimalOrDash(summary.averageDamagePerRound, 1, theme)],
      ['HS%', percentOrDash(summary.headshotPercentage, theme)],
      [
        'Por round',
        `${decimalOrDash(summary.killsPerRound, 2, theme)} kills · ${decimalOrDash(summary.deathsPerRound, 2, theme)} mortes · ${decimalOrDash(summary.assistsPerRound, 2, theme)} assist.`,
      ],
      [
        'Rounds',
        `${percentOrDash(summary.rounds.winRate, theme)} vencidos · ${percentOrDash(summary.rounds.survivalRate, theme)} sobrevividos`,
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
    ] as [string, string][],
    theme,
  );
}

const METRIC_LABELS: Readonly<Record<ComparedMetric, string>> = {
  winRate: 'Vitórias',
  killDeathRatio: 'K/D',
  averageDamagePerRound: 'ADR',
  headshotPercentage: 'HS%',
};

const PERCENT_POINT_METRICS: ReadonlySet<ComparedMetric> = new Set([
  'winRate',
  'headshotPercentage',
]);

function comparisonLines(report: ProgressReport, theme: Theme): string[] {
  const { comparison } = report;
  const recentLabel = `Últimas ${comparison.recentMatches}`;
  const previousLabel = `${comparison.previousMatches} anteriores`;

  if (!comparison.sufficient) {
    return [
      `Dados insuficientes para comparar: ${recentLabel.toLowerCase()} × ${previousLabel}.`,
      theme.colors.dim('São necessárias pelo menos 5 partidas em cada período.'),
    ];
  }

  const rows: Cell[][] = (Object.keys(METRIC_LABELS) as ComparedMetric[]).map((metric) => {
    const values = comparison.metrics[metric];
    return [
      METRIC_LABELS[metric],
      formatMetric(metric, values.recent, theme),
      formatMetric(metric, values.previous, theme),
      formatVariation(metric, values, theme),
    ];
  });

  return [
    ...renderTable(
      [
        { header: 'Métrica' },
        { header: recentLabel, align: 'right' },
        { header: previousLabel, align: 'right' },
        { header: 'Variação' },
      ],
      rows,
      theme,
    ),
    '',
    theme.colors.dim(
      `${theme.symbols.up}/${theme.symbols.down} indicam variação acima do limite de cada métrica; ${theme.symbols.stable} indica estável (ver docs/metrics.md).`,
    ),
  ];
}

function formatMetric(metric: ComparedMetric, value: number | null, theme: Theme): string {
  if (metric === 'winRate' || metric === 'headshotPercentage') return percentOrDash(value, theme);
  return decimalOrDash(value, metric === 'killDeathRatio' ? 2 : 1, theme);
}

function formatVariation(metric: ComparedMetric, values: MetricComparison, theme: Theme): Cell {
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
      return { text: `${symbols.stable} ${amount}`, style: colors.dim };
  }
}

const OUTCOME_NAMES = {
  win: ['vitória', 'vitórias'],
  loss: ['derrota', 'derrotas'],
  tie: ['empate', 'empates'],
} as const;

function streakLines(result: StreakSummary, theme: Theme): string[] {
  let current = theme.symbols.dash;
  if (result.current) {
    const [singular, pluralForm] = OUTCOME_NAMES[result.current.outcome];
    current = plural(result.current.length, singular, pluralForm);
  }

  return keyValues(
    [
      ['Sequência atual', current],
      ['Maior sequência de vitórias', String(result.longestWinStreak)],
      ['Maior sequência de derrotas', String(result.longestLossStreak)],
    ],
    theme,
  );
}

const BAR_WIDTH = 10;

function blockLines(
  blocks: readonly PerformanceBlock[],
  theme: Theme,
  format: FormatOptions,
): string[] {
  const { colors, symbols } = theme;

  const rows: Cell[][] = blocks.map((block) => {
    const filled = block.winRate === null ? 0 : Math.round((block.winRate / 100) * BAR_WIDTH);
    const bar =
      symbols.bar.repeat(filled) + colors.dim(symbols.barEmpty.repeat(BAR_WIDTH - filled));

    return [
      `${formatDate(block.from, format)} a ${formatDate(block.to, format)}`,
      `${block.matches}${block.complete ? '' : '*'}`,
      { text: symbols.barEmpty.repeat(BAR_WIDTH), style: () => bar },
      percentOrDash(block.winRate, theme),
      decimalOrDash(block.killDeathRatio, 2, theme),
      decimalOrDash(block.averageDamagePerRound, 1, theme),
      percentOrDash(block.headshotPercentage, theme),
    ];
  });

  const notes = [colors.dim('Blocos de 10 partidas consecutivas, do mais antigo ao mais recente.')];
  if (blocks.some((block) => !block.complete)) {
    notes.push(colors.dim('* Bloco com menos de 10 partidas.'));
  }

  return [
    ...renderTable(
      [
        { header: 'Período' },
        { header: 'Partidas', align: 'right' },
        { header: 'Vitórias' },
        { header: '', align: 'right' },
        { header: 'K/D', align: 'right' },
        { header: 'ADR', align: 'right' },
        { header: 'HS%', align: 'right' },
      ],
      rows,
      theme,
    ),
    '',
    ...notes,
  ];
}
