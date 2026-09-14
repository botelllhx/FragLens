import type { RecentForm } from '@fraglens/analysis';

export type MatchOutcome = 'win' | 'loss' | 'tie';

export interface PlayerMatchStats {
  kills: number;
  deaths: number;
  assists: number;
  headshotKills: number;
  damage: number;
  roundsPlayed: number;
  roundsWon: number;
  roundsLost: number;
  roundsSurvived: number;
  mvps: number;
  multiKills: { twoKills: number; threeKills: number; fourKills: number; fiveKills: number };
  flashAssists: number;
  utility: {
    flashbangsThrown: number;
    flashbangsHitEnemies: number;
    heGrenadesThrown: number;
    molotovsThrown: number;
    smokesThrown: number;
  };
  trades: {
    tradeKillOpportunities: number;
    tradeKillAttempts: number;
    tradeKills: number;
    tradedDeathOpportunities: number;
    tradedDeathAttempts: number;
    tradedDeaths: number;
  };
}

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
