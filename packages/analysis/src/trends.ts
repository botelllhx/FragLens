import type { Outcome } from './form.js';
import { round } from './match-metrics.js';
import { summarize } from './summary.js';
import type { MatchSample } from './types.js';

export interface Streak {
  outcome: Outcome;
  length: number;
}

export interface StreakSummary {
  /** Sequência que inclui a partida mais recente. */
  current: Streak | null;
  longestWinStreak: number;
  longestLossStreak: number;
}

/** Sequências de resultados. Empates interrompem sequências de vitórias e de derrotas. */
export function streaks(outcomesNewestFirst: readonly Outcome[]): StreakSummary {
  const [latest] = outcomesNewestFirst;
  let current: Streak | null = null;

  if (latest) {
    let length = 0;
    for (const outcome of outcomesNewestFirst) {
      if (outcome !== latest) break;
      length++;
    }
    current = { outcome: latest, length };
  }

  return {
    current,
    longestWinStreak: longestRun(outcomesNewestFirst, 'win'),
    longestLossStreak: longestRun(outcomesNewestFirst, 'loss'),
  };
}

function longestRun(outcomes: readonly Outcome[], target: Outcome): number {
  let best = 0;
  let run = 0;
  for (const outcome of outcomes) {
    run = outcome === target ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export const RECENT_WINDOW = 10;
export const PREVIOUS_WINDOW = 20;
/** Mínimo de partidas em cada período para calcular variação. */
export const MIN_COMPARISON_SAMPLE = 5;

/**
 * Variação mínima para considerar que a métrica subiu ou caiu; abaixo disso é "estável".
 * Win rate e HS% em pontos percentuais.
 */
export const TREND_THRESHOLDS = {
  winRate: 5,
  killDeathRatio: 0.05,
  averageDamagePerRound: 3,
  headshotPercentage: 2,
} as const;

const DELTA_DIGITS = {
  winRate: 1,
  killDeathRatio: 2,
  averageDamagePerRound: 1,
  headshotPercentage: 1,
} as const;

export type ComparedMetric = keyof typeof TREND_THRESHOLDS;
export type TrendDirection = 'up' | 'down' | 'stable';

export interface MetricComparison {
  recent: number | null;
  previous: number | null;
  delta: number | null;
  direction: TrendDirection | null;
}

export interface PeriodComparison {
  recentMatches: number;
  previousMatches: number;
  /** `false` quando algum período tem menos de MIN_COMPARISON_SAMPLE partidas. */
  sufficient: boolean;
  metrics: Record<ComparedMetric, MetricComparison>;
}

/** Compara as partidas mais recentes com as imediatamente anteriores (padrão: 10 × 20). */
export function compareRecentToPrevious(
  matchesNewestFirst: readonly MatchSample[],
  windows: { recent: number; previous: number } = {
    recent: RECENT_WINDOW,
    previous: PREVIOUS_WINDOW,
  },
): PeriodComparison {
  const recent = matchesNewestFirst.slice(0, windows.recent);
  const previous = matchesNewestFirst.slice(windows.recent, windows.recent + windows.previous);
  const sufficient =
    recent.length >= MIN_COMPARISON_SAMPLE && previous.length >= MIN_COMPARISON_SAMPLE;
  const recentSummary = summarize(recent);
  const previousSummary = summarize(previous);

  const compare = (metric: ComparedMetric): MetricComparison => {
    const recentValue = recentSummary[metric];
    const previousValue = previousSummary[metric];
    if (!sufficient || recentValue === null || previousValue === null) {
      return { recent: recentValue, previous: previousValue, delta: null, direction: null };
    }

    const delta = round(recentValue - previousValue, DELTA_DIGITS[metric]);
    const direction: TrendDirection =
      Math.abs(delta) < TREND_THRESHOLDS[metric] ? 'stable' : delta > 0 ? 'up' : 'down';
    return { recent: recentValue, previous: previousValue, delta, direction };
  };

  return {
    recentMatches: recent.length,
    previousMatches: previous.length,
    sufficient,
    metrics: {
      winRate: compare('winRate'),
      killDeathRatio: compare('killDeathRatio'),
      averageDamagePerRound: compare('averageDamagePerRound'),
      headshotPercentage: compare('headshotPercentage'),
    },
  };
}

export const BLOCK_SIZE = 10;

export interface PerformanceBlock {
  /** ISO 8601 da partida mais antiga e da mais recente do bloco. */
  from: string;
  to: string;
  matches: number;
  /** `false` para o bloco mais antigo quando sobram menos partidas que o tamanho do bloco. */
  complete: boolean;
  wins: number;
  losses: number;
  ties: number;
  winRate: number | null;
  killDeathRatio: number | null;
  averageDamagePerRound: number | null;
  headshotPercentage: number | null;
}

/**
 * Divide as partidas em blocos consecutivos a partir da mais recente (o bloco mais
 * recente é sempre completo) e retorna do bloco mais antigo para o mais recente.
 */
export function performanceBlocks(
  matchesNewestFirst: readonly MatchSample[],
  size = BLOCK_SIZE,
): PerformanceBlock[] {
  const blocks: PerformanceBlock[] = [];

  for (let start = 0; start < matchesNewestFirst.length; start += size) {
    const block = matchesNewestFirst.slice(start, start + size);
    const summary = summarize(block);
    const dates = block.map((match) => match.finishedAt).sort();

    blocks.push({
      from: dates[0] ?? '',
      to: dates.at(-1) ?? '',
      matches: block.length,
      complete: block.length === size,
      wins: summary.wins,
      losses: summary.losses,
      ties: summary.ties,
      winRate: summary.winRate,
      killDeathRatio: summary.killDeathRatio,
      averageDamagePerRound: summary.averageDamagePerRound,
      headshotPercentage: summary.headshotPercentage,
    });
  }

  return blocks.reverse();
}
