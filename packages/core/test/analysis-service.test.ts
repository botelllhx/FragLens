import { AppError } from '@fraglens/shared';
import { describe, expect, it } from 'vitest';
import { AnalysisService } from '../src/analysis-service.js';
import { SteamIdentifierResolver } from '../src/identifier-resolver.js';
import type { PerformanceData, PlayerMatch } from '../src/match.js';
import { MatchService } from '../src/match-service.js';
import type {
  PerformanceSource,
  PlayerStore,
  SteamGateway,
  SyncJobResult,
  SyncJobType,
} from '../src/ports.js';
import { ProfileService } from '../src/profile-service.js';
import { StoreGuard } from '../src/store-guard.js';

const STEAM_ID = '76561198034202275';
const NOW = new Date('2026-10-01T12:00:00.000Z');

function gateway(overrides: Partial<SteamGateway> = {}): SteamGateway {
  return {
    resolveVanity: () => Promise.resolve(STEAM_ID),
    getPlayerSummary: (steamId64) =>
      Promise.resolve({
        steamId64,
        personaName: 'Jogador',
        profileUrl: `https://steamcommunity.com/profiles/${steamId64}/`,
        avatarUrl: 'https://avatars.steamstatic.com/avatar_full.jpg',
        visibility: 'public',
        countryCode: 'BR',
        accountCreatedAt: null,
      }),
    getBanStatus: () => Promise.resolve(null),
    getCs2Playtime: () =>
      Promise.resolve({ visible: true, totalHours: 500, lastTwoWeeksHours: 10 }),
    ...overrides,
  };
}

function match(index: number): PlayerMatch {
  return {
    id: `m${index}`,
    origin: 'matchmaking',
    originMatchId: null,
    finishedAt: new Date(Date.UTC(2026, 8, 30) - index * 86_400_000).toISOString(),
    map: index % 2 === 0 ? 'de_mirage' : 'de_inferno',
    outcome: index % 3 === 0 ? 'loss' : 'win',
    score: { team: 13, opponent: 7 },
    hasBannedPlayer: false,
    stats: {
      kills: 20,
      deaths: 15,
      assists: 4,
      headshotKills: 8,
      damage: 1600,
      roundsPlayed: 20,
      roundsWon: 13,
      roundsLost: 7,
      roundsSurvived: 6,
      mvps: 2,
      multiKills: { twoKills: 2, threeKills: 1, fourKills: 0, fiveKills: 0 },
      flashAssists: 1,
      utility: {
        flashbangsThrown: 5,
        flashbangsHitEnemies: 3,
        heGrenadesThrown: 2,
        molotovsThrown: 2,
        smokesThrown: 3,
      },
      trades: {
        tradeKillOpportunities: 6,
        tradeKillAttempts: 4,
        tradeKills: 2,
        tradedDeathOpportunities: 5,
        tradedDeathAttempts: 3,
        tradedDeaths: 1,
      },
    },
    leetify: { rating: null, ctRating: null, tRating: null },
  };
}

function performanceData(count: number): PerformanceData {
  return {
    steamId64: STEAM_ID,
    playerName: 'Jogador',
    privacyMode: 'public',
    totalMatches: count,
    ranks: { premier: 12000, faceitLevel: null, faceitElo: null, wingman: null },
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
    matches: Array.from({ length: count }, (_, index) => match(index)),
  };
}

function jobStore() {
  const jobs: { type: SyncJobType; result: SyncJobResult | null }[] = [];
  const store: PlayerStore = {
    findLatestProfile: () => Promise.resolve(null),
    saveProfile: () => Promise.resolve(),
    getCacheInfo: () => Promise.resolve(null),
    startSyncJob: (_steamId64, type) => {
      jobs.push({ type, result: null });
      return Promise.resolve(String(jobs.length - 1));
    },
    finishSyncJob: (id, result) => {
      const job = jobs[Number(id)];
      if (job) job.result = result;
      return Promise.resolve();
    },
  };
  return { store, jobs };
}

function createService(options: { steam?: SteamGateway; performance: PerformanceSource }) {
  const steam = options.steam ?? gateway();
  const resolver = new SteamIdentifierResolver(steam);
  const { store, jobs } = jobStore();
  const guard = new StoreGuard(store);
  const now = () => NOW;

  const service = new AnalysisService({
    resolver,
    store: guard,
    profiles: new ProfileService({ steam, resolver, store: guard, now }),
    matches: new MatchService({ resolver, performance: options.performance, now }),
    now,
  });
  return { service, jobs };
}

const source = (data: PerformanceData | null): PerformanceSource => ({
  getPlayerPerformance: () => Promise.resolve(data),
});

async function captureError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('Era esperado um AppError');
}

describe('AnalysisService', () => {
  it('combina perfil e desempenho e registra o job de análise', async () => {
    const { service, jobs } = createService({ performance: source(performanceData(24)) });

    const analysis = await service.analyze('jogador');

    expect(analysis.steamId64).toBe(STEAM_ID);
    expect(analysis.profile.summary.personaName).toBe('Jogador');
    expect(analysis.performance).toMatchObject({
      sampleSize: 24,
      ranks: { premier: 12000 },
      summary: { matches: 24, wins: 16, losses: 8 },
      mapHighlights: { eligibleMaps: 2 },
    });
    expect(analysis.performance?.recentMatches).toHaveLength(10);
    expect(analysis.performance?.recentForm.outcomes).toHaveLength(10);
    expect(analysis.notices).toEqual([]);
    expect(analysis.aiAnalysis.status).toBe('not-configured');
    expect(analysis.analyzedAt).toBe(NOW.toISOString());
    expect(jobs).toEqual([
      { type: 'analysis', result: { status: 'succeeded' } },
      { type: 'steam-profile', result: { status: 'succeeded' } },
    ]);
  });

  it('respeita o limite de partidas e a desativação da IA', async () => {
    const { service } = createService({ performance: source(performanceData(24)) });

    const analysis = await service.analyze(STEAM_ID, { limit: 5, ai: false });

    expect(analysis.performance?.sampleSize).toBe(5);
    expect(analysis.aiAnalysis.status).toBe('disabled');
  });

  it('sem dados na Leetify, entrega o perfil com um aviso', async () => {
    const { service } = createService({ performance: source(null) });

    const analysis = await service.analyze(STEAM_ID);

    expect(analysis.performance).toBeNull();
    expect(analysis.profile.summary.personaName).toBe('Jogador');
    expect(analysis.notices[0]).toMatchObject({ code: 'NOT_FOUND' });
    expect(analysis.notices[0]?.hints.length).toBeGreaterThan(0);
  });

  it('falha temporária na Leetify também vira aviso', async () => {
    const { service, jobs } = createService({
      performance: {
        getPlayerPerformance: () =>
          Promise.reject(new AppError('RATE_LIMITED', 'Leetify: limite de requisições atingido.')),
      },
    });

    const analysis = await service.analyze(STEAM_ID);

    expect(analysis.performance).toBeNull();
    expect(analysis.notices[0]?.code).toBe('RATE_LIMITED');
    expect(jobs[0]?.result).toEqual({ status: 'succeeded' });
  });

  it('falha na Steam interrompe a análise e registra o job como falho', async () => {
    const failure = new AppError('UPSTREAM_UNAVAILABLE', 'Steam: serviço indisponível no momento.');
    const { service, jobs } = createService({
      steam: gateway({ getPlayerSummary: () => Promise.reject(failure) }),
      performance: source(performanceData(10)),
    });

    const error = await captureError(service.analyze(STEAM_ID));

    expect(error).toBe(failure);
    expect(jobs[0]).toEqual({
      type: 'analysis',
      result: {
        status: 'failed',
        errorCode: 'UPSTREAM_UNAVAILABLE',
        errorMessage: 'Steam: serviço indisponível no momento.',
      },
    });
  });

  it('limite inválido continua sendo erro', async () => {
    const { service } = createService({ performance: source(performanceData(10)) });

    const error = await captureError(service.analyze(STEAM_ID, { limit: 0 }));

    expect(error.code).toBe('INVALID_INPUT');
  });
});
