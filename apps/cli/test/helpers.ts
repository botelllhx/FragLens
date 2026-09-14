import type {
  PerformanceData,
  PerformanceSource,
  PlayerMatch,
  PlayerProfile,
  PlayerStore,
  SteamBanStatus,
  SteamGateway,
  SteamPlayerSummary,
  SyncJobResult,
} from '@fraglens/core';
import type { Database } from '@fraglens/db';
import { run, type CliDeps } from '../src/program.js';

export const STEAM_ID = '76561198034202275';

export const SUMMARY: SteamPlayerSummary = {
  steamId64: STEAM_ID,
  personaName: 'Jogador Teste',
  profileUrl: 'https://steamcommunity.com/id/jogador/',
  avatarUrl: 'https://avatars.steamstatic.com/avatar_full.jpg',
  visibility: 'public',
  countryCode: 'BR',
  accountCreatedAt: '2010-11-27T02:40:08.000Z',
};

export const NO_BANS: SteamBanStatus = {
  vacBanned: false,
  vacBanCount: 0,
  gameBanCount: 0,
  communityBanned: false,
  economyBan: 'none',
  daysSinceLastBan: null,
};

export function fakeGateway(overrides: Partial<SteamGateway> = {}): SteamGateway {
  return {
    resolveVanity: (vanity) => Promise.resolve(vanity === 'jogador' ? STEAM_ID : null),
    getPlayerSummary: (id) => Promise.resolve(id === STEAM_ID ? SUMMARY : null),
    getBanStatus: () => Promise.resolve(NO_BANS),
    getCs2Playtime: () =>
      Promise.resolve({ visible: true, totalHours: 15387.4, lastTwoWeeksHours: 24.3 }),
    ...overrides,
  };
}

export function playerMatch(
  id: string,
  finishedAt: string,
  overrides: Partial<PlayerMatch> = {},
): PlayerMatch {
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

export function performanceData(matches: PlayerMatch[]): PerformanceData {
  return {
    steamId64: STEAM_ID,
    playerName: 'Jogador Teste',
    privacyMode: 'public',
    totalMatches: 480,
    ranks: { premier: 15234, faceitLevel: 8, faceitElo: 1850, wingman: null },
    ratings: {
      leetifyRating: 1.37,
      aim: 71.2,
      positioning: 60.1,
      utility: 52.3,
      clutch: 0.11,
      opening: 0.04,
      ctRating: 0.02,
      tRating: 0.03,
    },
    matches,
  };
}

export function fakePerformance(data: PerformanceData | null): PerformanceSource {
  return { getPlayerPerformance: () => Promise.resolve(data) };
}

/** Banco em memória com o mesmo contrato do PrismaPlayerStore. */
export function memoryPlayerStore() {
  const profiles: PlayerProfile[] = [];
  const jobs: { id: string; steamId64: string; startedAt: string; result: SyncJobResult | null }[] =
    [];

  const store: PlayerStore = {
    findLatestProfile: (steamId64) => {
      const latest = profiles.filter((profile) => profile.steamId64 === steamId64).at(-1);
      return Promise.resolve(latest ? { profile: latest, dataVersion: latest.dataVersion } : null);
    },
    saveProfile: (profile) => {
      profiles.push(profile);
      return Promise.resolve();
    },
    getCacheInfo: (steamId64) => {
      const own = profiles.filter((profile) => profile.steamId64 === steamId64);
      const job = jobs.filter((candidate) => candidate.steamId64 === steamId64).at(-1);
      if (own.length === 0 && !job) return Promise.resolve(null);
      const latest = own.at(-1);
      return Promise.resolve({
        steamId64,
        firstSeenAt: job?.startedAt ?? latest?.fetchedAt ?? '',
        snapshotCount: own.length,
        latestFetchedAt: latest?.fetchedAt ?? null,
        latestDataVersion: latest?.dataVersion ?? null,
        lastSyncJob: job
          ? {
              type: 'steam-profile',
              status: job.result?.status ?? 'running',
              startedAt: job.startedAt,
              finishedAt: job.result ? job.startedAt : null,
              errorCode: job.result?.status === 'failed' ? job.result.errorCode : null,
            }
          : null,
      });
    },
    startSyncJob: (steamId64) => {
      const id = `job-${jobs.length + 1}`;
      jobs.push({ id, steamId64, startedAt: new Date().toISOString(), result: null });
      return Promise.resolve(id);
    },
    finishSyncJob: (id, result) => {
      const job = jobs.find((candidate) => candidate.id === id);
      if (job) job.result = result;
      return Promise.resolve();
    },
  };

  return { store, profiles, jobs };
}

export function fakeDatabase(overrides: Partial<Database> = {}): Database {
  return {
    players: memoryPlayerStore().store,
    checkHealth: () => Promise.resolve({ appliedMigrations: 1, pendingMigrations: [] }),
    close: () => Promise.resolve(),
    ...overrides,
  };
}

/** Executa a CLI em memória, sem terminal, rede ou arquivo .env. */
export async function runCli(args: string[], overrides: Partial<CliDeps> = {}) {
  let stdout = '';
  let stderr = '';
  const exitCode = await run(['node', 'fraglens', ...args], {
    io: {
      stdout: (text) => {
        stdout += text;
      },
      stderr: (text) => {
        stderr += text;
      },
    },
    env: { STEAM_API_KEY: 'chave-de-teste' },
    version: '1.2.3',
    nodeVersion: '22.18.0',
    colorsEnabled: false,
    unicode: true,
    createSteamGateway: () => fakeGateway(),
    createPerformanceSource: () => fakePerformance(performanceData([])),
    connectDatabase: () => fakeDatabase(),
    timeZone: 'UTC',
    ...overrides,
  });
  return { exitCode, stdout, stderr };
}
