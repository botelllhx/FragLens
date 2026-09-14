import type {
  PerformanceData,
  PerformanceSource,
  PlayerMatch,
  SteamBanStatus,
  SteamGateway,
  SteamPlayerSummary,
} from '@fraglens/core';
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
    timeZone: 'UTC',
    ...overrides,
  });
  return { exitCode, stdout, stderr };
}
