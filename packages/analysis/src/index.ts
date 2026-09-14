export { recentForm, type Outcome, type RecentForm } from './form.js';
export { MIN_MAP_SAMPLE, performanceByMap, type MapPerformance } from './maps.js';
export {
  averageDamagePerRound,
  headshotPercentage,
  killDeathRatio,
  round,
} from './match-metrics.js';
export { percentage, ratio } from './ratios.js';
export { summarize, type PerformanceSummary } from './summary.js';
export {
  BLOCK_SIZE,
  compareRecentToPrevious,
  MIN_COMPARISON_SAMPLE,
  performanceBlocks,
  PREVIOUS_WINDOW,
  RECENT_WINDOW,
  streaks,
  TREND_THRESHOLDS,
  type ComparedMetric,
  type MetricComparison,
  type PerformanceBlock,
  type PeriodComparison,
  type Streak,
  type StreakSummary,
  type TrendDirection,
} from './trends.js';
export type { MatchSample, MatchStats } from './types.js';
