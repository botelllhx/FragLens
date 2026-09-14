import type { Outcome } from './form.js';

/** Contadores de uma partida, na perspectiva do jogador analisado. */
export interface MatchStats {
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
  /** Rounds com 2, 3, 4 e 5 kills. */
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

/** O mínimo que o motor de métricas precisa de uma partida. */
export interface MatchSample {
  /** ISO 8601. */
  finishedAt: string;
  map: string;
  outcome: Outcome;
  stats: MatchStats;
}
