import type { MatchOutcome, PerformanceData, PlayerMatch } from '@fraglens/core';
import type { LeetifyMatch, LeetifyPlayerStats, LeetifyProfile } from './schemas.js';

export function toPlayerMatch(match: LeetifyMatch, stats: LeetifyPlayerStats): PlayerMatch {
  return {
    id: match.id,
    origin: match.data_source,
    originMatchId: match.data_source_match_id ?? null,
    finishedAt: match.finished_at,
    map: match.map_name,
    outcome: outcomeOf(stats.rounds_won, stats.rounds_lost),
    // Conferido em 100 partidas reais: rounds_won/rounds_lost batem com o placar do time do jogador.
    score: { team: stats.rounds_won, opponent: stats.rounds_lost },
    hasBannedPlayer: match.has_banned_player ?? false,
    stats: {
      kills: stats.total_kills,
      deaths: stats.total_deaths,
      assists: stats.total_assists,
      headshotKills: stats.total_hs_kills,
      damage: stats.total_damage,
      roundsPlayed: stats.rounds_count,
      roundsWon: stats.rounds_won,
      roundsLost: stats.rounds_lost,
      roundsSurvived: stats.rounds_survived,
      mvps: stats.mvps,
      multiKills: {
        twoKills: stats.multi2k,
        threeKills: stats.multi3k,
        fourKills: stats.multi4k,
        fiveKills: stats.multi5k,
      },
      flashAssists: stats.flash_assist,
      utility: {
        flashbangsThrown: stats.flashbang_thrown,
        flashbangsHitEnemies: stats.flashbang_hit_foe,
        heGrenadesThrown: stats.he_thrown,
        molotovsThrown: stats.molotov_thrown,
        smokesThrown: stats.smoke_thrown,
      },
      trades: {
        tradeKillOpportunities: stats.trade_kill_opportunities,
        tradeKillAttempts: stats.trade_kill_attempts,
        tradeKills: stats.trade_kills_succeed,
        tradedDeathOpportunities: stats.traded_death_opportunities,
        tradedDeathAttempts: stats.traded_death_attempts,
        tradedDeaths: stats.traded_deaths_succeed,
      },
    },
    leetify: {
      rating: stats.leetify_rating ?? null,
      ctRating: stats.ct_leetify_rating ?? null,
      tRating: stats.t_leetify_rating ?? null,
    },
  };
}

export function outcomeOf(roundsWon: number, roundsLost: number): MatchOutcome {
  if (roundsWon > roundsLost) return 'win';
  if (roundsWon < roundsLost) return 'loss';
  return 'tie';
}

export function toPerformanceData(
  steamId64: string,
  profile: LeetifyProfile,
  matches: PlayerMatch[],
): PerformanceData {
  return {
    steamId64,
    playerName: profile.name,
    privacyMode: profile.privacy_mode ?? null,
    totalMatches: profile.total_matches ?? null,
    ranks: {
      premier: profile.ranks?.premier ?? null,
      faceitLevel: profile.ranks?.faceit ?? null,
      faceitElo: profile.ranks?.faceit_elo ?? null,
      wingman: profile.ranks?.wingman ?? null,
    },
    ratings: {
      leetifyRating: profile.ranks?.leetify ?? null,
      aim: profile.rating?.aim ?? null,
      positioning: profile.rating?.positioning ?? null,
      utility: profile.rating?.utility ?? null,
      clutch: profile.rating?.clutch ?? null,
      opening: profile.rating?.opening ?? null,
      ctRating: profile.rating?.ct_leetify ?? null,
      tRating: profile.rating?.t_leetify ?? null,
    },
    matches,
  };
}
