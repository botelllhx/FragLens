import type {
  MapPerformance,
  MatchStats,
  Outcome,
  PerformanceBlock,
  PerformanceSummary,
  PeriodComparison,
  RecentForm,
  StreakSummary,
} from '@fraglens/analysis';

export type MatchOutcome = Outcome;
export type PlayerMatchStats = MatchStats;

/** Métricas próprias da Leetify, repassadas sem alteração (exigência das diretrizes da Leetify). */
export interface LeetifyMatchRatings {
  rating: number | null;
  ctRating: number | null;
  tRating: number | null;
}

export interface PlayerMatch {
  id: string;
  /** Origem informada pela fonte: "matchmaking", "matchmaking_competitive", "faceit", "hltv"… */
  origin: string;
  originMatchId: string | null;
  /** ISO 8601. */
  finishedAt: string;
  /** Nome interno do mapa, ex.: "de_mirage". */
  map: string;
  outcome: MatchOutcome;
  score: { team: number; opponent: number };
  hasBannedPlayer: boolean;
  stats: PlayerMatchStats;
  leetify: LeetifyMatchRatings;
}

export interface PlayerRanks {
  premier: number | null;
  faceitLevel: number | null;
  faceitElo: number | null;
  wingman: number | null;
}

/** Notas agregadas da Leetify, repassadas sem alteração. */
export interface LeetifyProfileRatings {
  leetifyRating: number | null;
  aim: number | null;
  positioning: number | null;
  utility: number | null;
  clutch: number | null;
  opening: number | null;
  ctRating: number | null;
  tRating: number | null;
}

export interface PerformanceData {
  steamId64: string;
  playerName: string;
  privacyMode: string | null;
  totalMatches: number | null;
  ranks: PlayerRanks;
  ratings: LeetifyProfileRatings;
  matches: PlayerMatch[];
}

/** Métricas calculadas pelo FragLens a partir dos contadores da partida. */
export interface MatchMetrics {
  killDeathRatio: number;
  averageDamagePerRound: number | null;
  headshotPercentage: number | null;
}

export interface AnalyzedMatch extends PlayerMatch {
  metrics: MatchMetrics;
}

export interface MatchHistory {
  steamId64: string;
  playerName: string;
  ranks: PlayerRanks;
  leetify: {
    privacyMode: string | null;
    totalMatches: number | null;
    ratings: LeetifyProfileRatings;
  };
  /** Total de partidas retornadas pela fonte, antes do limite. */
  availableMatches: number;
  matches: AnalyzedMatch[];
  recentForm: RecentForm;
  attribution: string;
  /** ISO 8601. */
  fetchedAt: string;
}

/** Campos comuns aos relatórios calculados a partir das partidas. */
export interface PerformanceReportBase {
  steamId64: string;
  playerName: string;
  ranks: PlayerRanks;
  /** Partidas consideradas, depois do limite. */
  sampleSize: number;
  /** Datas (ISO 8601) da partida mais antiga e da mais recente consideradas. */
  period: { from: string; to: string } | null;
  attribution: string;
  /** ISO 8601. */
  fetchedAt: string;
}

export interface MapReport extends PerformanceReportBase {
  /** Mapas com menos partidas que isso são marcados como amostra pequena. */
  minMapSample: number;
  maps: MapPerformance[];
}

export interface ProgressReport extends PerformanceReportBase {
  summary: PerformanceSummary;
  comparison: PeriodComparison;
  streaks: StreakSummary;
  blocks: PerformanceBlock[];
}
