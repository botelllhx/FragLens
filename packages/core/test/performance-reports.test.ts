import { AppError } from '@fraglens/shared';
import { describe, expect, it } from 'vitest';
import { SteamIdentifierResolver } from '../src/identifier-resolver.js';
import type { PerformanceData, PlayerMatch } from '../src/match.js';
import { MatchService } from '../src/match-service.js';

const STEAM_ID = '76561198034202275';

const STATS: PlayerMatch['stats'] = {
  kills: 20,
  deaths: 10,
  assists: 5,
  headshotKills: 10,
  damage: 2000,
  roundsPlayed: 20,
  roundsWon: 13,
  roundsLost: 7,
  roundsSurvived: 10,
  mvps: 3,
  multiKills: { twoKills: 3, threeKills: 1, fourKills: 0, fiveKills: 0 },
  flashAssists: 2,
  utility: {
    flashbangsThrown: 10,
    flashbangsHitEnemies: 5,
    heGrenadesThrown: 4,
    molotovsThrown: 3,
    smokesThrown: 3,
  },
  trades: {
    tradeKillOpportunities: 10,
    tradeKillAttempts: 5,
    tradeKills: 4,
    tradedDeathOpportunities: 8,
    tradedDeathAttempts: 4,
    tradedDeaths: 2,
  },
};

function match(index: number, overrides: Partial<PlayerMatch> = {}): PlayerMatch {
  return {
    id: `m${index}`,
    origin: 'matchmaking',
    originMatchId: null,
    // index 0 = mais recente; a fonte entrega fora de ordem de propósito (ver `shuffled`).
    finishedAt: new Date(Date.UTC(2026, 8, 30) - index * 86_400_000).toISOString(),
    map: 'de_mirage',
    outcome: 'win',
    score: { team: 13, opponent: 7 },
    hasBannedPlayer: false,
    stats: STATS,
    leetify: { rating: null, ctRating: null, tRating: null },
    ...overrides,
  };
}

function service(matches: PlayerMatch[] | null) {
  const data: PerformanceData | null = matches && {
    steamId64: STEAM_ID,
    playerName: 'Jogador',
    privacyMode: 'public',
    totalMatches: matches.length,
    ranks: { premier: null, faceitLevel: null, faceitElo: null, wingman: null },
    ratings: {
      leetifyRating: null,
      aim: null,
      positioning: null,
      utility: null,
      clutch: null,
      opening: null,
      ctRating: null,
      tRating: null,
    },
    matches,
  };
  return new MatchService({
    resolver: new SteamIdentifierResolver({ resolveVanity: () => Promise.resolve(STEAM_ID) }),
    performance: { getPlayerPerformance: () => Promise.resolve(data) },
    now: () => new Date('2026-10-01T00:00:00.000Z'),
  });
}

async function captureError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('Era esperado um AppError');
}

const shuffled = (matches: PlayerMatch[]) => [...matches].reverse();

describe('MatchService: relatórios de desempenho', () => {
  it('getMapReport considera as partidas mais recentes dentro do limite', async () => {
    const matches = shuffled([
      match(0),
      match(1, { map: 'de_inferno', outcome: 'loss' }),
      match(2, { map: 'de_ancient' }),
    ]);

    const report = await service(matches).getMapReport(STEAM_ID, { limit: 2 });

    expect(report).toMatchObject({
      steamId64: STEAM_ID,
      playerName: 'Jogador',
      sampleSize: 2,
      period: { from: match(1).finishedAt, to: match(0).finishedAt },
      minMapSample: 5,
      fetchedAt: '2026-10-01T00:00:00.000Z',
    });
    expect(report.attribution).toContain('Leetify');
    expect(report.maps.map((map) => map.map)).toEqual(['de_mirage', 'de_inferno']);
  });

  it('getProgressReport combina resumo, comparação, sequências e blocos', async () => {
    const matches = shuffled(
      Array.from({ length: 15 }, (_, index) =>
        match(index, { outcome: index < 3 ? 'win' : 'loss' }),
      ),
    );

    const report = await service(matches).getProgressReport(STEAM_ID);

    expect(report.sampleSize).toBe(15);
    expect(report.summary).toMatchObject({ matches: 15, wins: 3, losses: 12 });
    expect(report.streaks.current).toEqual({ outcome: 'win', length: 3 });
    expect(report.comparison).toMatchObject({
      recentMatches: 10,
      previousMatches: 5,
      sufficient: true,
    });
    expect(report.blocks.map((block) => block.matches)).toEqual([5, 10]);
  });

  it('sem partidas, o período é nulo e as métricas ficam indisponíveis', async () => {
    const report = await service([]).getProgressReport(STEAM_ID);

    expect(report.period).toBeNull();
    expect(report.summary.killDeathRatio).toBeNull();
    expect(report.blocks).toEqual([]);
  });

  it('explica quando a Leetify não tem dados do jogador', async () => {
    const error = await captureError(service(null).getMapReport(STEAM_ID));

    expect(error.code).toBe('NOT_FOUND');
  });
});
