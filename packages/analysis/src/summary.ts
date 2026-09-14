import { killDeathRatio, round } from './match-metrics.js';
import { percentage, ratio } from './ratios.js';
import type { MatchSample } from './types.js';

export interface PerformanceSummary {
  matches: number;
  wins: number;
  losses: number;
  ties: number;
  /** % de partidas vencidas; empates contam no total. */
  winRate: number | null;
  rounds: {
    played: number;
    won: number;
    lost: number;
    winRate: number | null;
    /** % de rounds em que o jogador sobreviveu. */
    survivalRate: number | null;
  };
  totals: {
    kills: number;
    deaths: number;
    assists: number;
    headshotKills: number;
    damage: number;
    mvps: number;
    flashAssists: number;
  };
  killDeathRatio: number | null;
  kda: number | null;
  headshotPercentage: number | null;
  averageDamagePerRound: number | null;
  killsPerRound: number | null;
  deathsPerRound: number | null;
  assistsPerRound: number | null;
  /** Médias por partida. */
  averageKills: number | null;
  averageDeaths: number | null;
  multiKills: {
    twoKills: number;
    threeKills: number;
    fourKills: number;
    fiveKills: number;
    /** % de rounds com 2 ou mais kills. */
    roundsWithMultiKillPercentage: number | null;
  };
  utility: {
    flashAssistsPerMatch: number | null;
    /** Granadas lançadas (flash, HE, molotov, smoke) por round. */
    utilityPerRound: number | null;
    enemiesFlashedPerFlashbang: number | null;
  };
  trades: {
    /** % das oportunidades de trade em que o jogador tentou o trade. */
    tradeKillAttemptRate: number | null;
    /** % das tentativas de trade que resultaram em kill. */
    tradeKillSuccessRate: number | null;
    /** % das tentativas de trocar a morte do jogador que deram certo. */
    tradedDeathSuccessRate: number | null;
  };
}

/**
 * Agrega as partidas somando os contadores antes de dividir: o K/D do período é
 * total de kills ÷ total de mortes, e não a média dos K/D de cada partida.
 */
export function summarize(matches: readonly MatchSample[]): PerformanceSummary {
  const totals = sumCounters(matches);
  const count = matches.length;
  const multiKillRounds = totals.twoKills + totals.threeKills + totals.fourKills + totals.fiveKills;

  return {
    matches: count,
    wins: totals.wins,
    losses: totals.losses,
    ties: totals.ties,
    winRate: percentage(totals.wins, count),
    rounds: {
      played: totals.rounds,
      won: totals.roundsWon,
      lost: totals.roundsLost,
      winRate: percentage(totals.roundsWon, totals.rounds),
      survivalRate: percentage(totals.roundsSurvived, totals.rounds),
    },
    totals: {
      kills: totals.kills,
      deaths: totals.deaths,
      assists: totals.assists,
      headshotKills: totals.headshotKills,
      damage: totals.damage,
      mvps: totals.mvps,
      flashAssists: totals.flashAssists,
    },
    killDeathRatio: count > 0 ? killDeathRatio(totals.kills, totals.deaths) : null,
    kda: count > 0 ? round((totals.kills + totals.assists) / Math.max(totals.deaths, 1), 2) : null,
    headshotPercentage: percentage(totals.headshotKills, totals.kills),
    averageDamagePerRound: ratio(totals.damage, totals.rounds, 1),
    killsPerRound: ratio(totals.kills, totals.rounds, 2),
    deathsPerRound: ratio(totals.deaths, totals.rounds, 2),
    assistsPerRound: ratio(totals.assists, totals.rounds, 2),
    averageKills: ratio(totals.kills, count, 1),
    averageDeaths: ratio(totals.deaths, count, 1),
    multiKills: {
      twoKills: totals.twoKills,
      threeKills: totals.threeKills,
      fourKills: totals.fourKills,
      fiveKills: totals.fiveKills,
      roundsWithMultiKillPercentage: percentage(multiKillRounds, totals.rounds),
    },
    utility: {
      flashAssistsPerMatch: ratio(totals.flashAssists, count, 1),
      utilityPerRound: ratio(totals.utilityThrown, totals.rounds, 2),
      enemiesFlashedPerFlashbang: ratio(totals.flashbangsHitEnemies, totals.flashbangsThrown, 2),
    },
    trades: {
      tradeKillAttemptRate: percentage(totals.tradeKillAttempts, totals.tradeKillOpportunities),
      tradeKillSuccessRate: percentage(totals.tradeKills, totals.tradeKillAttempts),
      tradedDeathSuccessRate: percentage(totals.tradedDeaths, totals.tradedDeathAttempts),
    },
  };
}

function sumCounters(matches: readonly MatchSample[]) {
  const totals = {
    wins: 0,
    losses: 0,
    ties: 0,
    rounds: 0,
    roundsWon: 0,
    roundsLost: 0,
    roundsSurvived: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    headshotKills: 0,
    damage: 0,
    mvps: 0,
    flashAssists: 0,
    twoKills: 0,
    threeKills: 0,
    fourKills: 0,
    fiveKills: 0,
    utilityThrown: 0,
    flashbangsThrown: 0,
    flashbangsHitEnemies: 0,
    tradeKillOpportunities: 0,
    tradeKillAttempts: 0,
    tradeKills: 0,
    tradedDeathAttempts: 0,
    tradedDeaths: 0,
  };

  for (const { outcome, stats } of matches) {
    if (outcome === 'win') totals.wins++;
    else if (outcome === 'loss') totals.losses++;
    else totals.ties++;

    totals.rounds += stats.roundsPlayed;
    totals.roundsWon += stats.roundsWon;
    totals.roundsLost += stats.roundsLost;
    totals.roundsSurvived += stats.roundsSurvived;
    totals.kills += stats.kills;
    totals.deaths += stats.deaths;
    totals.assists += stats.assists;
    totals.headshotKills += stats.headshotKills;
    totals.damage += stats.damage;
    totals.mvps += stats.mvps;
    totals.flashAssists += stats.flashAssists;
    totals.twoKills += stats.multiKills.twoKills;
    totals.threeKills += stats.multiKills.threeKills;
    totals.fourKills += stats.multiKills.fourKills;
    totals.fiveKills += stats.multiKills.fiveKills;
    totals.utilityThrown +=
      stats.utility.flashbangsThrown +
      stats.utility.heGrenadesThrown +
      stats.utility.molotovsThrown +
      stats.utility.smokesThrown;
    totals.flashbangsThrown += stats.utility.flashbangsThrown;
    totals.flashbangsHitEnemies += stats.utility.flashbangsHitEnemies;
    totals.tradeKillOpportunities += stats.trades.tradeKillOpportunities;
    totals.tradeKillAttempts += stats.trades.tradeKillAttempts;
    totals.tradeKills += stats.trades.tradeKills;
    totals.tradedDeathAttempts += stats.trades.tradedDeathAttempts;
    totals.tradedDeaths += stats.trades.tradedDeaths;
  }

  return totals;
}
