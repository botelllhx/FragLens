import { AppError } from '@fraglens/shared';
import { describe, expect, it } from 'vitest';
import { SteamIdentifierResolver } from '../src/identifier-resolver.js';
import type { SteamGateway } from '../src/ports.js';
import type { SteamPlayerSummary } from '../src/profile.js';
import { ProfileService } from '../src/profile-service.js';

const STEAM_ID = '76561198034202275';

const SUMMARY: SteamPlayerSummary = {
  steamId64: STEAM_ID,
  personaName: 'Jogador',
  profileUrl: 'https://steamcommunity.com/id/jogador/',
  avatarUrl: 'https://avatars.steamstatic.com/avatar_full.jpg',
  visibility: 'public',
  countryCode: 'BR',
  accountCreatedAt: '2010-11-27T02:40:08.000Z',
};

function fakeSteam(overrides: Partial<SteamGateway> = {}) {
  const calls: string[] = [];
  const gateway: SteamGateway = {
    resolveVanity: (vanity) => {
      calls.push(`resolveVanity:${vanity}`);
      return Promise.resolve(vanity === 'jogador' ? STEAM_ID : null);
    },
    getPlayerSummary: (id) => {
      calls.push(`getPlayerSummary:${id}`);
      return Promise.resolve(id === STEAM_ID ? SUMMARY : null);
    },
    getBanStatus: (id) => {
      calls.push(`getBanStatus:${id}`);
      return Promise.resolve(null);
    },
    getCs2Playtime: (id) => {
      calls.push(`getCs2Playtime:${id}`);
      return Promise.resolve({ visible: false, totalHours: null, lastTwoWeeksHours: null });
    },
    ...overrides,
  };
  return { gateway, calls };
}

function createService(gateway: SteamGateway) {
  return new ProfileService({
    steam: gateway,
    resolver: new SteamIdentifierResolver(gateway),
    now: () => new Date('2026-09-14T12:00:00.000Z'),
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

describe('SteamIdentifierResolver', () => {
  it('não consulta a Steam quando a entrada já é uma SteamID64', async () => {
    const { gateway, calls } = fakeSteam();

    await expect(new SteamIdentifierResolver(gateway).resolve(STEAM_ID)).resolves.toBe(STEAM_ID);
    expect(calls).toEqual([]);
  });

  it('resolve URL personalizada pela Steam', async () => {
    const { gateway, calls } = fakeSteam();

    const steamId = await new SteamIdentifierResolver(gateway).resolve(
      'https://steamcommunity.com/id/jogador',
    );

    expect(steamId).toBe(STEAM_ID);
    expect(calls).toEqual(['resolveVanity:jogador']);
  });

  it('informa NOT_FOUND quando a URL personalizada não existe', async () => {
    const { gateway } = fakeSteam();

    const error = await captureError(new SteamIdentifierResolver(gateway).resolve('inexistente'));

    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toContain('"inexistente"');
  });
});

describe('ProfileService', () => {
  it('monta o perfil com resumo, banimentos e horas de CS2', async () => {
    const { gateway, calls } = fakeSteam();

    const profile = await createService(gateway).getProfile('jogador');

    expect(profile).toEqual({
      steamId64: STEAM_ID,
      summary: SUMMARY,
      bans: null,
      cs2: { visible: false, totalHours: null, lastTwoWeeksHours: null },
      fetchedAt: '2026-09-14T12:00:00.000Z',
    });
    expect(calls).toEqual([
      'resolveVanity:jogador',
      `getPlayerSummary:${STEAM_ID}`,
      `getBanStatus:${STEAM_ID}`,
      `getCs2Playtime:${STEAM_ID}`,
    ]);
  });

  it('informa NOT_FOUND quando a SteamID64 não corresponde a uma conta', async () => {
    const { gateway } = fakeSteam({ getPlayerSummary: () => Promise.resolve(null) });

    const error = await captureError(createService(gateway).getProfile(STEAM_ID));

    expect(error.code).toBe('NOT_FOUND');
  });

  it('rejeita entrada inválida sem consultar a Steam', async () => {
    const { gateway, calls } = fakeSteam();

    const error = await captureError(createService(gateway).getProfile('https://example.com/id/x'));

    expect(error.code).toBe('INVALID_INPUT');
    expect(calls).toEqual([]);
  });
});
