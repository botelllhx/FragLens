import { AppError } from '@fraglens/shared';
import { describe, expect, it } from 'vitest';
import { SteamIdentifierResolver } from '../src/identifier-resolver.js';
import type { PerformanceData, PlayerMatch } from '../src/match.js';
import { MatchService } from '../src/match-service.js';
import type { PerformanceSource } from '../src/ports.js';

const STEAM_ID = '76561198034202275';

function match(id: string, finishedAt: string, overrides: Partial<PlayerMatch> = {}): PlayerMatch {
  return {
    id,
    origin: 'matchmaking',
    originMatchId: null,
    finishedAt,
    map: 'de_mirage',
    outcome: 'win',
    score: { team: 13, opponent: 7 },
    hasBannedPlayer: false,
    stats: {
      kills: 16,
      deaths: 13,
      assists: 4,
      headshotKills: 13,
      damage: 1454,
      roundsPlayed: 20,
      roundsWon: 13,
      roundsLost: 7,
      roundsSurvived: 7,
      mvps: 4,
      multiKills: { twoKills: 3, threeKills: 0, fourKills: 1, fiveKills: 0 },
      flashAssists: 2,
      utility: {
        flashbangsThrown: 18,
        flashbangsHitEnemies: 12,
        heGrenadesThrown: 9,
        molotovsThrown: 8,
        smokesThrown: 17,
      },
      trades: {
        tradeKillOpportunities: 13,
        tradeKillAttempts: 8,
        tradeKills: 5,
        tradedDeathOpportunities: 7,
        tradedDeathAttempts: 7,
        tradedDeaths: 4,
      },
    },
    leetify: { rating: 0.0341, ctRating: -0.0553, tRating: 0.0938 },
    ...overrides,
  };
}

function performance(matches: PlayerMatch[]): PerformanceData {
  return {
    steamId64: STEAM_ID,
    playerName: 'Jogador',
    privacyMode: 'public',
    totalMatches: 500,
    ranks: { premier: 15234, faceitLevel: 8, faceitElo: 1850, wingman: null },
    ratings: {
      leetifyRating: 1.2,
      aim: 70,
      positioning: 60,
      utility: 50,
      clutch: 0.1,
      opening: 0.05,
      ctRating: 0.02,
      tRating: 0.03,
    },
    matches,
  };
}

function createService(data: PerformanceData | null) {
  const requested: string[] = [];
  const source: PerformanceSource = {
    getPlayerPerformance: (steamId64) => {
      requested.push(steamId64);
      return Promise.resolve(data);
    },
  };
  const service = new MatchService({
    resolver: new SteamIdentifierResolver({ resolveVanity: () => Promise.resolve(STEAM_ID) }),
    performance: source,
    now: () => new Date('2026-09-14T12:00:00.000Z'),
  });
  return { service, requested };
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

describe('MatchService', () => {
  it('ordena da partida mais recente para a mais antiga e calcula as métricas', async () => {
    const { service, requested } = createService(
      performance([
        match('antiga', '2026-09-01T10:00:00.000Z'),
        match('recente', '2026-09-10T10:00:00.000Z', {
          outcome: 'loss',
          score: { team: 5, opponent: 13 },
        }),
      ]),
    );

    const history = await service.getMatchHistory('jogador');

    expect(requested).toEqual([STEAM_ID]);
    expect(history.matches.map((item) => item.id)).toEqual(['recente', 'antiga']);
    expect(history.matches[0]?.metrics).toEqual({
      killDeathRatio: 1.23,
      averageDamagePerRound: 72.7,
      headshotPercentage: 81.3,
    });
    expect(history.recentForm).toEqual({ outcomes: ['loss', 'win'], wins: 1, losses: 1, ties: 0 });
    expect(history.attribution).toContain('Leetify');
    expect(history.fetchedAt).toBe('2026-09-14T12:00:00.000Z');
  });

  it('aplica o limite, mas a forma recente considera as últimas 10 disponíveis', async () => {
    const matches = Array.from({ length: 12 }, (_, index) =>
      match(`m${index}`, new Date(Date.UTC(2026, 8, 20 - index)).toISOString(), {
        outcome: index % 2 === 0 ? 'win' : 'loss',
      }),
    );
    const { service } = createService(performance(matches));

    const history = await service.getMatchHistory(STEAM_ID, { limit: 3 });

    expect(history.matches.map((item) => item.id)).toEqual(['m0', 'm1', 'm2']);
    expect(history.availableMatches).toBe(12);
    expect(history.recentForm.outcomes).toHaveLength(10);
    expect(history.recentForm.wins).toBe(5);
  });

  it.each([0, 101, 2.5])('rejeita limite inválido (%s)', async (limit) => {
    const { service, requested } = createService(performance([]));

    const error = await captureError(service.getMatchHistory(STEAM_ID, { limit }));

    expect(error.code).toBe('INVALID_INPUT');
    expect(requested).toEqual([]);
  });

  it('explica como obter dados quando a Leetify não conhece o jogador', async () => {
    const { service } = createService(null);

    const error = await captureError(service.getMatchHistory(STEAM_ID));

    expect(error.code).toBe('NOT_FOUND');
    expect(error.hints.join(' ')).toContain('leetify.com');
  });
});
